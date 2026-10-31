"""End to end check: scan -> OCR -> compliance decision, compared with the answer keys.

Run from the backend folder:
    python tools/evaluate_decisions.py <scans folder> <answer_keys folder>
"""
import json, sys
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.compliance.checker import assess  # noqa: E402
from app.ocr.extract import extract_report, load_rules  # noqa: E402

RULES = load_rules("STS/UC/01")


def one(args):
    scan, key_path = args
    key = json.loads(Path(key_path).read_text(encoding="utf-8"))
    ocr = extract_report(scan)
    a = assess(RULES, ocr["results"], ocr["visual_text"])
    want = key["overall_decision"].split(" (")[0]
    return key["file"], key.get("capture", "?"), want, a["decision"], sorted(key["failed_clauses"]), sorted(a["failed_clauses"])


def main():
    scans, keys = Path(sys.argv[1]), Path(sys.argv[2])
    jobs = [(str(scans / (k.stem + ".jpg")), str(k)) for k in sorted(keys.glob("*.json"))]
    conf, by_cap, clause_ok = Counter(), defaultdict(Counter), 0
    rows = []
    with ProcessPoolExecutor(max_workers=4) as ex:
        for i, (fn, cap, want, got, wf, gf) in enumerate(ex.map(one, jobs), 1):
            conf[(want, got)] += 1; by_cap[cap]["n"] += 1; by_cap[cap]["right"] += want == got
            clause_ok += wf == gf; rows.append((fn, cap, want, got, wf, gf))
            print(f"\r{i}/{len(jobs)}", end="", flush=True)
    n = len(jobs); right = sum(v for (w, g), v in conf.items() if w == g)
    print(f"\n\nFinal decision correct: {right}/{n} ({100*right/n:.0f}%)   same failed clauses: {clause_ok}/{n}")
    for cap, c in by_cap.items():
        print(f"  {cap:12s} {c['right']}/{c['n']}")
    print("\nTrue decision -> system decision")
    for (w, g), v in sorted(conf.items()):
        print(f"  {w:15s} -> {g:15s} {v}")
    print("\nDangerous errors (a REJECT accepted):", sum(v for (w, g), v in conf.items() if w == "REJECT" and g == "ACCEPT"))
    for r in rows:
        if r[2] != r[3]:
            print("  ", r)


if __name__ == "__main__":
    main()
