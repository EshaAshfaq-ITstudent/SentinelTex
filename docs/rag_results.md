# Knowledge base and LLM results (Objective 2 and 3)

Measured on 3 and 4 Nov 2026 with `python tools\evaluate_rag.py`: first with the keyword fallback embedding, then on
the laptop with the MiniLM embedding model. The chatbot gives the LLM the top 4 clauses, so "in top 3" matters most.

| Measure | Keyword fallback | MiniLM + llama3.2:3b (laptop, 3 and 4 Nov) |
|---|---|---|
| Specification digitisation: test clauses with exact limit and method | 18 / 18 | 18 / 18 |
| Specification digitisation: visual clauses with exact requirement | 6 / 6 | 6 / 6 |
| Retrieval, questions using the specification's own wording: correct clause first | 42 / 42 | 41 / 42 (42 / 42 in top 3) |
| Retrieval, paraphrased everyday questions: correct clause first | 4 / 10 | 6 / 10 (10 / 10 in top 3) |
| Out of scope questions refused before the LLM | 5 / 6 | 4 / 6 |
| In scope questions let through | 18 / 18 | 18 / 18 |
| LLM explanations fully grounded (llama3.2:3b, 10 reports with failures or missing results) | not measured | 10 / 10 |

Reading: OCR digitisation of the specification is exact for every clause. Keyword search works when the
question uses the specification's terms but fails on paraphrases, which is the reason for the semantic
embedding model (MiniLM). Every LLM answer is checked automatically: cited clauses and numbers must come from the
retrieved clauses or the checker results, otherwise the interface warns the reviewer.


## Notes on the numbers

* **Grounded** means every clause the LLM cited and every number it wrote appears in the clauses and checker results
  it was given (automatic check, `app/rag/grounding.py`). It does not prove each sentence is a perfect summary;
  the reviewer still reads it, and the pass or fail decision is always made by the rule checker, not the LLM.
* Explanations tested (4 Nov, laptop, CPU only): 7 REJECT and 3 NOT VERIFIABLE reports. Every one cited the
  acceptance rule that applies (clause 5.2 for rejection, 5.4 for missing results) except STTL-TR-2026-0028,
  which cited only the failed clause 4.5.
* **Out of scope filter:** similarity of the best match for the 6 off topic questions was 0.061, 0.068, 0.324,
  0.347, 0.398 and 0.422. The lowest in scope question scored 0.545 in the specification's wording but 0.258 when
  paraphrased, so no single threshold separates them. The threshold stays at 0.35: it refuses clearly unrelated
  questions before the LLM, and for the off topic questions that pass it the LLM is
  instructed to answer "I cannot verify that from the specification" when the clauses do not cover it.
  Raising it would also refuse genuine paraphrased questions.
