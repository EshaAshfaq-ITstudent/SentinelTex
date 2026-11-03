"""Knowledge base: specification chunks stored in ChromaDB, searched by meaning.

Embeddings: the sentence-transformers model all-MiniLM-L6-v2, loaded from models/embeddings (downloaded once by
tools/build_knowledge.py, then used offline). If it is not available, a built in keyword embedding is used so the
system still works; the status endpoint says which one is active.
"""
import hashlib
import math
import os
import re
from functools import lru_cache
from pathlib import Path

from ..config import PROJECT_DIR

CHROMA_DIR = Path(os.environ.get("SENTINELTEX_CHROMA_DIR", PROJECT_DIR / "chroma_db"))
EMBED_DIR = Path(os.environ.get("SENTINELTEX_EMBED_DIR", PROJECT_DIR / "models" / "embeddings" / "all-MiniLM-L6-v2"))
EMBED_HF_NAME = "sentence-transformers/all-MiniLM-L6-v2"


STOPWORDS = set("a an the is are was what which who how many much for of to in on at by and or with it this that "
                "there does do shall be from as per its into than not any all each".split())


class KeywordEmbedding:
    """Offline fallback: hashed word and word pair counts (no download needed)."""
    name = "keyword"
    dims = 1024

    def _vec(self, text: str) -> list[float]:
        words = [w for w in re.findall(r"[a-z0-9]+(?:\.[0-9]+[ab]?)?", text.lower()) if w not in STOPWORDS]
        feats = words + [a + "_" + b for a, b in zip(words, words[1:])]
        v = [0.0] * self.dims
        for f in feats:
            h = int(hashlib.md5(f.encode()).hexdigest(), 16)
            v[h % self.dims] += 1.0 if (h >> 20) & 1 else -1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    def __call__(self, input):            # ChromaDB embedding function interface
        return [self._vec(t) for t in input]

    def embed_query(self, input):
        return self(input)

    def embed_documents(self, input):
        return self(input)

    @staticmethod
    def name_fn():
        return "sentineltex-keyword"


class MiniLMEmbedding:
    name = "minilm"

    def __init__(self, path: Path):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(str(path), device="cpu")

    def __call__(self, input):
        return self.model.encode(list(input), normalize_embeddings=True).tolist()

    def embed_query(self, input):
        return self(input)

    def embed_documents(self, input):
        return self(input)


@lru_cache(maxsize=1)
def embedder():
    if os.environ.get("SENTINELTEX_EMBEDDING", "") != "keyword" and EMBED_DIR.exists():
        try:
            return MiniLMEmbedding(EMBED_DIR)
        except Exception:                      # library missing or model broken: fall back, status shows it
            pass
    return KeywordEmbedding()


def _collection():
    import chromadb
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    # one collection per embedding type, so vectors of different sizes never mix
    return client.get_or_create_collection(f"specifications_{embedder().name}", metadata={"hnsw:space": "cosine"},
                                           embedding_function=None)


def build(chunks: list[dict]) -> int:
    col = _collection()
    old = col.get(where={"spec": chunks[0]["spec"]})["ids"] if chunks else []
    if old:
        col.delete(ids=old)
    texts = [c["text"] for c in chunks]
    col.add(ids=[c["id"] for c in chunks], documents=texts, embeddings=embedder()(texts),
            metadatas=[{k: c[k] for k in ("spec", "clause", "section", "page", "kind")} for c in chunks])
    return col.count()


def count() -> int:
    try:
        return _collection().count()
    except Exception:
        return 0


def search(query: str, k: int = 4, spec: str | None = None) -> list[dict]:
    col = _collection()
    if col.count() == 0:
        return []
    res = col.query(query_embeddings=embedder()([query]), n_results=min(k, col.count()),
                    where={"spec": spec} if spec else None)
    return [{"id": i, "text": d, "similarity": round(1 - dist, 3), **m}
            for i, d, dist, m in zip(res["ids"][0], res["documents"][0], res["distances"][0], res["metadatas"][0])]


def get_clauses(clauses: list[str], spec: str) -> list[dict]:
    """Exact lookup by clause number (used for explanations: no guessing which clause is meant)."""
    if not clauses:
        return []
    col = _collection()
    res = col.get(where={"$and": [{"spec": spec}, {"clause": {"$in": list(clauses)}}]})
    rows = [{"id": i, "text": d, **m} for i, d, m in zip(res["ids"], res["documents"], res["metadatas"])]
    return sorted(rows, key=lambda r: r["id"])
