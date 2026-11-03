# Knowledge base and LLM results (Objective 2 and 3)

Measured on 3 Nov 2026 with `python tools\evaluate_rag.py`: first with the keyword fallback embedding, then on
the laptop with the MiniLM embedding model. The chatbot gives the LLM the top 4 clauses, so "in top 3" matters most.

| Measure | Keyword fallback | MiniLM (laptop, 3 Nov) |
|---|---|---|
| Specification digitisation: test clauses with exact limit and method | 18 / 18 | 18 / 18 |
| Specification digitisation: visual clauses with exact requirement | 6 / 6 | 6 / 6 |
| Retrieval, questions using the specification's own wording: correct clause first | 42 / 42 | 41 / 42 (42 / 42 in top 3) |
| Retrieval, paraphrased everyday questions: correct clause first | 4 / 10 | 6 / 10 (10 / 10 in top 3) |
| Out of scope questions refused before the LLM | 5 / 6 | 4 / 6 |
| In scope questions let through | 18 / 18 | 18 / 18 |
| LLM explanations fully grounded | not measured yet (needs Ollama) | pending |

Reading: OCR digitisation of the specification is exact for every clause. Keyword search works when the
question uses the specification's terms but fails on paraphrases, which is the reason for the semantic
embedding model (MiniLM). Every LLM answer is checked automatically: cited clauses and numbers must come from the
retrieved clauses or the checker results, otherwise the interface warns the reviewer.
