"""Checks the visual defect rules of the compliance checker. Run from the backend folder:
    python tests\\test_compliance_rules.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.compliance.checker import assess          # noqa: E402
from app.ocr.extract import load_rules             # noqa: E402

rules = load_rules("STS/UC/01")
all_pass = [{"clause": r["clause"], "found": True, "status": "ok",
             "value": (r["limit"][0] if r["kind"] == "range" else r["limit"])} for r in rules["requirements"]]

# 1. Clean report, nothing in the image: ACCEPT
r = assess(rules, all_pass, "No visible defects in 2 m sample.")
assert r["decision"] == "ACCEPT", r["decision"]

# 2. Tear written in the lab report: Major defect, REJECT
r = assess(rules, all_pass, "One tear approx. 8 mm in 2 m sample.")
assert r["decision"] == "REJECT" and "4.1" in r["failed_clauses"]

# 3. Tear seen only by the image model: a person must confirm, so CHECK MANUALLY, not REJECT
r = assess(rules, all_pass, "No visible defects in 2 m sample.", image_defects=[{"defect": "tear", "count": 1}])
c = next(c for c in r["checks"] if c["clause"] == "4.1")
assert c["result"] == "CHECK MANUALLY" and c["source"] == "image analysis", c
assert r["decision"] == "NOT VERIFIABLE", r["decision"]

# 4. Same defect in report and image: the report finding decides (FAIL)
r = assess(rules, all_pass, "One tear in 2 m sample.", image_defects=[{"defect": "tear", "count": 3}])
assert r["decision"] == "REJECT"
print("Compliance rule tests passed")
