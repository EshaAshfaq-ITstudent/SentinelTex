"""Measures the knowledge base and the LLM (numbers for the FYP report). Run from the backend folder:

    python tools\\evaluate_rag.py ..\\data\\documents\\sentineltex_documents_v2

1. Digitisation: is every clause from the specification answer key in the knowledge base, with its limit?
2. Retrieval: for a question about each clause, is the right clause the first hit (and in the top 3)?
3. Out of scope: are questions the specification does not cover refused?
4. Explanations (only if Ollama is running): are cited clauses and numbers all from the given context?
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.compliance.checker import assess  # noqa: E402
from app.ocr.extract import load_rules  # noqa: E402
from app.rag import chat, digitize, explain, index, llm  # noqa: E402

root = Path(sys.argv[1] if len(sys.argv) > 1 else "../data/documents/sentineltex_documents_v2")
if not (root / "specifications").is_dir() and Path("../data/documents/specifications").is_dir():
    root = Path("../data/documents")
gt = json.loads((root / "specifications" / "specifications_ground_truth.json").read_text())["STS/UC/01"]
spec = "STS/UC/01"
norm = lambda s: re.sub(r"[^a-z0-9.+/]", "", s.lower())  # noqa: E731

print("Embedding:", index.embedder().name, "| chunks indexed:", index.count())

# 1. digitisation
chunks = digitize.load_digitized(spec)
by_clause = {c["clause"]: c["text"] for c in chunks}
ok, bad = 0, []
for r in gt["requirements"]:
    t = norm(by_clause.get(r["clause"], ""))
    if t and norm(r["text"]) in t and norm(r["method"]) in t:
        ok += 1
    else:
        bad.append(r["clause"])
vis_ok = sum(1 for v in gt.get("visual", []) if norm(v.get("requirement", v.get("text", ""))) in norm(by_clause.get(v["clause"], "")))
print(f"\n1. Digitisation: {ok}/{len(gt['requirements'])} test clauses with exact limit and method"
      f"{'' if not bad else ' (wrong: ' + ', '.join(bad) + ')'}; visual clauses with exact requirement: {vis_ok}/{len(gt.get('visual', []))}")

# 2. retrieval: two question styles per test clause
def questions(r):
    d = f" in the {r['direction'].lower()} direction" if r["direction"] else ""
    return [f"What is the requirement for {r['property'].lower()}{d}?",
            f"Which limit applies to {r['property'].lower()}{d} and which test method is used?"]
top1 = top3 = total = 0
misses = []
for r in gt["requirements"]:
    for q in questions(r):
        hits = index.search(q, k=3, spec=spec)
        clauses = [h["clause"] for h in hits]
        total += 1
        top1 += bool(clauses) and clauses[0] == r["clause"]
        top3 += r["clause"] in clauses
        if not clauses or clauses[0] != r["clause"]:
            misses.append(f"{r['clause']} -> {clauses[:3]}")
for v in gt.get("visual", []):
    q = f"How many {v['defect'].lower()} are allowed?"
    hits = index.search(q, k=3, spec=spec)
    clauses = [h["clause"] for h in hits]
    total += 1; top1 += bool(clauses) and clauses[0] == v["clause"]; top3 += v["clause"] in clauses
    if not clauses or clauses[0] != v["clause"]:
        misses.append(f"{v['clause']} -> {clauses[:3]}")
print(f"2. Retrieval ({total} questions): correct clause first {top1}/{total} ({100*top1/total:.1f}%), "
      f"in top 3 {top3}/{total} ({100*top3/total:.1f}%)")
if misses:
    print("   not first:", "; ".join(misses[:12]))

# 2b. paraphrased questions in everyday words (harder: they do not reuse the specification's wording)
PARA = [("What polyester percentage is allowed in the blend?", {"3.1"}),
        ("How heavy should one square metre of the cloth be?", {"3.2"}),
        ("How strong must the fabric be when pulled lengthwise?", {"3.4a"}),
        ("How much is the cloth allowed to shrink after washing?", {"3.6a", "3.6b"}),
        ("How acidic or alkaline may the fabric be?", {"3.11"}),
        ("How close must the shade be to the approved reference?", {"3.12"}),
        ("Is a small hole in the fabric acceptable?", {"4.1"}),
        ("How long must the laboratory sample be?", {"5.1"}),
        ("What happens if one of the tests was not done?", {"5.4"}),
        ("What has to be written on each roll?", {"6.1"})]
p1 = p3 = 0
for q, want in PARA:
    clauses = [h["clause"] for h in index.search(q, k=3, spec=spec)]
    p1 += bool(clauses) and clauses[0] in want
    p3 += bool(want & set(clauses))
    if not clauses or clauses[0] not in want:
        print(f"   paraphrase miss: {q} -> {clauses}")
print(f"2b. Paraphrased questions ({len(PARA)}): correct clause first {p1}/{len(PARA)}, in top 3 {p3}/{len(PARA)}")

# 3. out of scope (the specification says nothing about these)
oos = ["What is the flame resistance requirement?", "What is the capital of France?",
       "What is the water repellency spray rating limit?", "Who won the cricket match yesterday?",
       "What is the minimum UV protection factor?", "How much does one roll cost?"]
refused = 0
oos_best = []
for q in oos:
    hits = index.search(q, k=4, spec=spec)
    best = max((h["similarity"] for h in hits), default=0)
    oos_best.append(best)
    refused += best < chat.MIN_SIMILARITY[index.embedder().name]
in_best = []
for r in gt["requirements"]:
    hits = index.search(questions(r)[0], k=1, spec=spec)
    in_best.append(hits[0]["similarity"] if hits else 0)
answered = sum(1 for s in in_best if s >= chat.MIN_SIMILARITY[index.embedder().name])
print(f"3. Out of scope refused before the LLM: {refused}/{len(oos)}; in scope questions let through: "
      f"{answered}/{len(in_best)} (threshold {chat.MIN_SIMILARITY[index.embedder().name]})")
para_best = [max((h["similarity"] for h in index.search(q, k=1, spec=spec)), default=0) for q, _ in PARA]
print(f"   similarity, out of scope: {sorted(round(x, 3) for x in oos_best)}")
print(f"   similarity, lowest in scope: specification wording {min(in_best):.3f}, paraphrased {min(para_best):.3f}")

# 4. explanation grounding with the real LLM, on reports with failures (true values from the answer keys)
st = llm.status()
if not st["available"]:
    print("4. Explanations: skipped,", st.get("reason"))
    sys.exit()
rules = load_rules(spec)
keys = sorted((root / "lab_reports" / "answer_keys").glob("*.json"))
picked = [k for k in keys if json.loads(k.read_text())["overall_decision"] != "ACCEPT"][:10]
grounded = 0
for k in picked:
    key = json.loads(k.read_text())
    results = [{"clause": r["clause"], "found": r["reported"], "status": "ok" if r["reported"] else "missing",
                "value": r.get("value")} for r in key["results"]]
    comp = assess(rules, results, key["visual_text"])
    ex = explain.explain(comp, spec)
    g = ex.get("grounding", {})
    grounded += bool(g.get("grounded"))
    print(f"   {key['file']}: {comp['decision']:15s} cited {g.get('cited_clauses')} "
          f"{'OK' if g.get('grounded') else 'NOT GROUNDED ' + str(g)}")
print(f"4. Explanations fully grounded (only given clauses and numbers): {grounded}/{len(picked)}")
