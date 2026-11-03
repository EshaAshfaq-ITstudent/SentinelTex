"""Builds the specification knowledge base (ChromaDB). Run from the backend folder:

    python tools\\build_knowledge.py                 OCR the specification scans, then index them
    python tools\\build_knowledge.py --from-json     index the already digitised file (no OCR)

The first run also downloads the embedding model (about 90 MB) into models\\embeddings, once.
After that everything works offline.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.rag import digitize, index  # noqa: E402

SCAN_DIRS = ["../data/documents/sentineltex_documents_v2/specifications/scans", "../data/documents/specifications/scans"]

p = argparse.ArgumentParser()
p.add_argument("--spec", default="STS/UC/01")
p.add_argument("--scans", help="folder with the specification page scans")
p.add_argument("--from-json", action="store_true", help="skip OCR, use app/knowledge/<spec>_digitized.json")
p.add_argument("--no-download", action="store_true", help="do not download the embedding model")
a = p.parse_args()

if not a.from_json:
    folder = Path(a.scans) if a.scans else next((Path(d) for d in SCAN_DIRS if Path(d).is_dir()), None)
    if folder is None:
        sys.exit("Specification scans not found. Extract sentineltex_documents_v2.zip into data\\documents, or use --from-json")
    stem = a.spec.replace("/", "-")
    scans = sorted(folder.glob(f"{stem}_page*.jpg"))
    print(f"OCR of {len(scans)} pages from {folder} ...")
    out = digitize.digitize(a.spec, scans)
    print("Digitised clauses saved to", out)

if not a.no_download and not index.EMBED_DIR.exists():
    try:
        from sentence_transformers import SentenceTransformer
        print("Downloading the embedding model (once) ...")
        SentenceTransformer(index.EMBED_HF_NAME).save(str(index.EMBED_DIR))
        index.embedder.cache_clear()
    except Exception as e:
        print("Could not download the embedding model, using the keyword fallback:", e)

chunks = digitize.load_digitized(a.spec)
n = index.build(chunks)
print(f"Indexed {len(chunks)} chunks of {a.spec} with the '{index.embedder().name}' embedding. Collection size: {n}")
print("Example search 'tear strength weft':")
for h in index.search("tear strength weft", k=3, spec=a.spec):
    print(f"  clause {h['clause']:5s} similarity {h['similarity']}  {h['text'][:90]}")
