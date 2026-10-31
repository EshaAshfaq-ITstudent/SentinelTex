"""Deterministic compliance checking: code decides pass or fail against each specification clause.
The LLM (added later) only explains these results; it never decides them.

Decision rule (specification clauses 5.2 to 5.4):
  any Section 3 failure, or any Major visual defect, or a Minor defect above its limit -> REJECT
  otherwise, any Section 3 result missing or unreadable                               -> NOT VERIFIABLE
  otherwise                                                                            -> ACCEPT
"""
import re

NUMBER_WORDS = {"one": 1, "a": 1, "an": 1, "single": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
                "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12}
# keyword -> defect class used by the specification (Section 4) and the image model
DEFECT_WORDS = [
    (r"hole|tear|cut", "tear"),
    (r"misregistration|misprint|missing print|print defect|smear", "pattern_defect"),
    (r"shade band|discolou?r", "discoloration"),
    (r"stain|ink mark", "stain"),
    (r"spot", "spot"),
    (r"loose thread|pulled thread|fray|floating thread", "loose_thread"),
]


def check_value(kind: str, limit, value: float) -> bool:
    if kind == "range":
        return limit[0] <= value <= limit[1]
    if kind == "min":
        return value >= limit
    if kind == "max":
        return value <= limit
    if kind == "abs_max":
        return abs(value) <= limit
    raise ValueError(f"Unknown rule kind: {kind}")


def parse_visual(text: str) -> tuple[list[dict], float]:
    """Turn a visual inspection note into defect counts, e.g. 'one tear ...; four loose threads ...'."""
    t = (text or "").lower()
    sample_m = re.search(r"(\d+(?:\.\d+)?)\s*m\s*sample", t)
    sample_len = float(sample_m.group(1)) if sample_m else 2.0
    if not t.strip() or re.search(r"\bno (visible )?defects?\b|^\s*nil\b|satisfactory", t):
        return [], sample_len
    found = {}
    for part in re.split(r"[;,]| and ", t):
        for pattern, cls in DEFECT_WORDS:
            matches = list(re.finditer(pattern, part))
            if not matches:
                continue
            m = matches[-1]                      # "fraying with two loose threads": count before the last keyword
            count = 1
            before = part[:m.start()]
            num = re.findall(r"\b(\d+|" + "|".join(NUMBER_WORDS) + r")\b", before)
            if num:
                n = num[-1]
                count = int(n) if n.isdigit() else NUMBER_WORDS[n]
            found[cls] = found.get(cls, 0) + count
            break
    return [{"defect": k, "count": v} for k, v in found.items()], sample_len


def assess(rules: dict, test_results: list[dict] | None, visual_text: str | None,
           image_defects: list[dict] | None = None) -> dict:
    """Combine lab values and visual findings into clause by clause checks and one decision."""
    checks = []
    # Section 3: lab test values
    by_clause = {r["clause"]: r for r in (test_results or [])}
    for req in rules["requirements"]:
        r = by_clause.get(req["clause"])
        base = {"clause": req["clause"], "property": req["property"], "direction": req["direction"],
                "requirement": req["text"], "unit": req["unit"], "source": "lab report"}
        if r is None or not r.get("found"):
            checks.append({**base, "value": None, "result": "NOT REPORTED"})
        elif r.get("status") != "ok" or r.get("value") is None:
            checks.append({**base, "value": r.get("value"), "result": "CHECK MANUALLY", "raw_line": r.get("raw_line")})
        else:
            ok = check_value(req["kind"], req["limit"], r["value"])
            checks.append({**base, "value": r["value"], "result": "PASS" if ok else "FAIL", "raw_line": r.get("raw_line")})

    # Section 4: visual defects (from the report's inspection note; image model results added when available)
    visual_rules = {v["cv_class"]: v for v in rules["visual"]}
    findings, sample_len = parse_visual(visual_text)
    sources = {f["defect"]: "lab report note" for f in findings}
    for d in image_defects or []:
        if d["defect"] not in {f["defect"] for f in findings}:
            findings.append({"defect": d["defect"], "count": d.get("count", 1)})
            sources[d["defect"]] = "image analysis"
    for f in findings:
        v = visual_rules.get(f["defect"])
        if v is None:
            continue
        if v["cls"] == "Major":
            result = "FAIL"
        else:
            per_m = f["count"] / sample_len
            result = "PASS" if per_m <= v.get("per_metre_limit", 0) else "FAIL"
        checks.append({"clause": v["clause"], "property": v["defect"], "direction": "", "requirement": v["requirement"],
                       "unit": "count", "value": f["count"], "result": result, "class": v["cls"],
                       "source": sources[f["defect"]]})

    failed = [c["clause"] for c in checks if c["result"] == "FAIL"]
    unverified = [c["clause"] for c in checks if c["result"] in ("NOT REPORTED", "CHECK MANUALLY")]
    if failed:
        decision = "REJECT"
    elif unverified:
        decision = "NOT VERIFIABLE"
    else:
        decision = "ACCEPT"
    return {"decision": decision, "failed_clauses": failed, "unverified_clauses": unverified, "checks": checks,
            "rule": "Clauses 5.2 to 5.4: reject on any Section 3 failure or Major visual defect; "
                    "cannot accept while a Section 3 result is missing or unreadable."}
