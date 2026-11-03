"""Lab Chatbot: answers questions from the specification only, with clause references.
If nothing relevant is found, it says so instead of guessing."""
import re

from . import grounding, index, llm

SYSTEM = ("You are the SentinelTex Lab Chatbot for a military textile testing laboratory. Answer ONLY from the "
          "specification extracts given to you. Cite each clause you use as [clause X]. If the extracts do not "
          "contain the answer, reply exactly: I cannot verify that from the specification in the knowledge base. "
          "Never invent limits, test methods or standards. Keep the answer short.")
REFUSAL = "I cannot verify that from the specification in the knowledge base."
# minimum similarity for a question to count as covered by the specification (per embedding type)
MIN_SIMILARITY = {"minilm": 0.35, "keyword": 0.12}
CLAUSE_ASKED = re.compile(r"\b([1-6]\.\d{1,2}[ab]?)\b")


def answer(question: str, spec: str = "STS/UC/01", k: int = 4) -> dict:
    question = question.strip()[:500]
    hits = index.search(question, k=k, spec=spec)
    asked = CLAUSE_ASKED.findall(question)
    if asked:                                   # "what does clause 3.5a say?": fetch it exactly
        exact = index.get_clauses(asked, spec)
        hits = exact + [h for h in hits if h["id"] not in {e["id"] for e in exact}]
        for e in exact:
            e.setdefault("similarity", 1.0)
    threshold = MIN_SIMILARITY[index.embedder().name]
    if not hits or max(h.get("similarity", 0) for h in hits) < threshold:
        return {"answer": REFUSAL, "method": "refused_no_match", "sources": [],
                "best_similarity": max((h.get("similarity", 0) for h in hits), default=0)}

    hits = hits[:k]
    context = "\n".join(f"[clause {h['clause']}] {h['text']}" for h in hits)
    sources = [{"clause": h["clause"], "page": h["page"], "similarity": h.get("similarity"), "text": h["text"]} for h in hits]
    try:
        text = llm.generate(f"Specification extracts:\n{context}\n\nQuestion: {question}", SYSTEM, max_tokens=250)
    except llm.LLMUnavailable as e:
        return {"answer": "The language model is not running, so here are the most relevant clauses:",
                "method": "retrieval_only", "sources": sources, "llm_error": str(e)}
    return {"answer": text, "method": "llm", "model": llm.MODEL, "sources": sources,
            "grounding": grounding.check(text, context, {h["clause"] for h in hits})}
