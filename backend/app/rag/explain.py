"""LLM explanation of a compliance result, citing the specification clauses retrieved from ChromaDB.
The decision itself is made by the deterministic checker; the LLM only explains it."""
from . import grounding, index, llm

SYSTEM = ("You are the SentinelTex assistant in a military textile testing laboratory. You explain a quality "
          "decision to an Assistant Manager or Deputy Manager. Rules: use ONLY the specification clauses and "
          "results given to you. Cite every clause you mention as [clause X]. Never change the decision. Never "
          "invent limits, values, clauses or standards. If something cannot be checked from the given clauses, "
          "say it cannot be verified. Write 3 to 6 short sentences in plain English, no lists.")

DECISION_CLAUSES = {"REJECT": ["5.2"], "NOT VERIFIABLE": ["5.4"], "ACCEPT": ["5.2", "5.3"]}


def _fmt_check(c: dict) -> str:
    val = "not reported" if c.get("value") is None else f"{c['value']} {c.get('unit') or ''}".strip()
    return (f"- clause {c['clause']} {c['property']} {c.get('direction') or ''}: result {c['result']}, "
            f"value {val}, requirement {c['requirement']} (source: {c.get('source', '')})").replace("  ", " ")


def explain(compliance: dict, spec: str, use_llm: bool = True) -> dict:
    checks = compliance.get("checks", [])
    focus = [c for c in checks if c["result"] in ("FAIL", "CHECK MANUALLY", "NOT REPORTED")]
    clause_ids = sorted({c["clause"] for c in focus} | set(DECISION_CLAUSES.get(compliance["decision"], [])))
    sources = index.get_clauses(clause_ids, spec)
    if not sources:
        return {"text": "The specification is not in the knowledge base yet, so the decision cannot be explained "
                        "with clause references. Run tools\\build_knowledge.py.", "method": "none", "sources": []}

    context = "\n".join(f"[clause {s['clause']}] {s['text']}" for s in sources)
    results = "\n".join(_fmt_check(c) for c in focus) or "- every checked clause passed"
    passed = sum(1 for c in checks if c["result"] == "PASS")
    prompt = (f"Specification clauses:\n{context}\n\nDecision made by the rule checker: {compliance['decision']}\n"
              f"Checks that passed: {passed}\nChecks that need attention:\n{results}\n\n"
              "Explain this decision to the reviewer, citing the clauses.")

    out = {"sources": [{"clause": s["clause"], "page": s["page"], "text": s["text"]} for s in sources]}
    if use_llm:
        try:
            text = llm.generate(prompt, SYSTEM)
            allowed = {s["clause"] for s in sources} | {c["clause"] for c in checks}
            out.update(text=text, method="llm", model=llm.MODEL,
                       grounding=grounding.check(text, context + "\n" + results, allowed))
            return out
        except llm.LLMUnavailable as e:
            out["llm_error"] = str(e)
    # Without the LLM: the same facts as fixed sentences
    parts = [f"Decision {compliance['decision']}: {passed} checks passed."]
    for c in focus:
        if c["result"] == "FAIL":
            parts.append(f"Clause {c['clause']} ({c['property']}) failed: value {c['value']} against requirement {c['requirement']}.")
        elif c["result"] == "CHECK MANUALLY":
            parts.append(f"Clause {c['clause']} ({c['property']}) needs a person to check it ({c.get('source', '')}).")
        else:
            parts.append(f"Clause {c['clause']} ({c['property']}) was not reported.")
    rule = {"REJECT": "5.2", "NOT VERIFIABLE": "5.4"}.get(compliance["decision"])
    if rule:
        parts.append(f"See clause {rule} for the acceptance rule.")
    out.update(text=" ".join(parts), method="template")
    return out
