"""Measure Test Analysis (OCR) accuracy against the answer keys.

Run from the backend folder:
    python tools/evaluate_ocr.py <scans folder> <answer_keys folder> [--limit N]

Writes ocr_evaluation.csv (one row per test result) and prints a summary by capture type.
"""
import argparse
import csv
import json
import sys
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.ocr.extract import extract_report  # noqa: E402


def _alnum(t):
    return "".join(ch for ch in (t or "").lower() if ch.isalnum())


def same(a, b):
    return a is not None and b is not None and abs(float(a) - float(b)) < 1e-6


def evaluate_one(args):
    scan, key_path = args
    key = json.loads(Path(key_path).read_text(encoding="utf-8"))
    t0 = time.time()
    try:
        out = extract_report(scan)
    except Exception as e:  # keep going; record the failure
        return key["file"], key.get("capture", "?"), [], {"error": str(e)}, 0.0
    secs = time.time() - t0
    got = {r["clause"]: r for r in out["results"]}
    rows = []
    for k in key["results"]:
        g = got[k["clause"]]
        if not k["reported"]:
            outcome = "correctly absent" if not g["found"] else "false row"
        elif not g["found"]:
            outcome = "missed"
        elif same(g["value"], k["value"]):
            outcome = "exact" if g["status"] == "ok" else "exact but flagged"
        elif g["value"] is not None and k["unit"] == "%" and "Dimensional" in k["property"] and same(abs(g["value"]), abs(k["value"])):
            outcome = "sign lost (decision unaffected)"
        else:
            outcome = "wrong" if g["status"] == "ok" else "wrong but flagged"
        rows.append(dict(file=key["file"], capture=key.get("capture", "?"), layout=key.get("layout", "?"), clause=k["clause"],
                         expected=k.get("value"), got=g["value"], status=g["status"], outcome=outcome, raw_line=g["raw_line"]))
    hdr = out["header"]
    header_ok = {"sample_id": hdr["sample_id"] == key["header"]["sample_id"],
                 "report_no": hdr["report_no"] == key["report_no"],
                 "visual_text": _alnum(out["visual_text"])[:25] == _alnum(key["visual_text"])[:25]}
    return key["file"], key.get("capture", "?"), rows, header_ok, secs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scans"); ap.add_argument("keys"); ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=4); ap.add_argument("--out", default="ocr_evaluation.csv")
    a = ap.parse_args()
    keys = sorted(Path(a.keys).glob("*.json"))
    jobs = [(str(Path(a.scans) / (k.stem + ".jpg")), str(k)) for k in keys if (Path(a.scans) / (k.stem + ".jpg")).exists()]
    if a.limit:
        jobs = jobs[:a.limit]
    all_rows, headers, times, by_cap = [], defaultdict(lambda: defaultdict(int)), [], defaultdict(lambda: defaultdict(int))
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        for i, (fn, cap, rows, hdr, secs) in enumerate(ex.map(evaluate_one, jobs), 1):
            all_rows += rows; times.append(secs)
            for k, v in hdr.items():
                headers[k]["ok" if v is True else "bad"] += 1
            for r in rows:
                by_cap[cap][r["outcome"]] += 1; by_cap["ALL"][r["outcome"]] += 1
            print(f"\r{i}/{len(jobs)} reports", end="", flush=True)
    print()
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(all_rows[0].keys())); w.writeheader(); w.writerows(all_rows)

    print(f"\nReports: {len(jobs)}   average time per report: {sum(times)/max(1,len(times)):.1f} s")
    for k, v in headers.items():
        print(f"Header field {k}: {v['ok']}/{v['ok']+v['bad']} correct")
    print("\nTest values (reported in the document):")
    order = ["exact", "exact but flagged", "sign lost (decision unaffected)", "wrong but flagged", "wrong", "missed"]
    for cap in ["ALL", "scan", "photocopy", "phone_photo"]:
        c = by_cap.get(cap)
        if not c:
            continue
        n = sum(c[o] for o in order)
        exact = c["exact"] + c["exact but flagged"]
        usable = exact + c["sign lost (decision unaffected)"]
        silent = c["wrong"]
        print(f"  {cap:12s} n={n:5d}  exact {100*exact/n:5.1f}%  usable for decision {100*usable/n:5.1f}%  "
              f"wrong and NOT flagged {100*silent/n:4.1f}%  missed {100*c['missed']/n:4.1f}%  "
              f"| tests absent from report detected correctly: {c['correctly absent']}, false rows: {c['false row']}")
    print(f"\nDetails: {a.out}")


if __name__ == "__main__":
    main()
