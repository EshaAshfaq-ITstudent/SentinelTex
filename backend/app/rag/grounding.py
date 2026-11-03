"""Checks an LLM answer against the context it was given: every cited clause and every number must come
from that context. Anything else is reported, so the reviewer knows not to trust that sentence."""
import re

# only explicit references count as citations ("[clause 3.5a]", "clause 3.5a", "clauses 3.5a and 4.1")
CLAUSE_REF = re.compile(r"\bclauses?\s*((?:[1-6]\.\d{1,2}[ab]?(?:\s*(?:,|and|&)\s*)?)+)", re.I)
ONE_CLAUSE = re.compile(r"[1-6]\.\d{1,2}[ab]?")
NUMBER = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])")


def check(answer: str, context: str, allowed_clauses: set[str]) -> dict:
    cited = sorted({c for m in CLAUSE_REF.finditer(answer) for c in ONE_CLAUSE.findall(m.group(1))})
    unknown = [c for c in cited if c not in allowed_clauses]
    answer_wo_refs = CLAUSE_REF.sub(" ", answer)
    ctx_numbers = {float(n) for n in NUMBER.findall(context)}
    stray = sorted({n for n in NUMBER.findall(answer_wo_refs) if float(n) not in ctx_numbers and float(n) not in (0, 1)})
    return {"cited_clauses": cited, "unknown_clauses": unknown, "unsupported_numbers": stray,
            "grounded": not unknown and not stray}
