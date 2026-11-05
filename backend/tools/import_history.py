"""Imports past laboratory records for Trend Analysis. Run from the backend folder:

    python tools\\import_history.py

Reads history\\report_summary.csv and history\\test_history.csv from the documents dataset.
These records are a prepared (synthetic) history dataset made for the prototype. They are stored with
source = "prepared history (synthetic)" and the Trend Analysis page notes where past records come from.
Running it again replaces them.
"""
import csv
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import HistoryReport, HistoryResult  # noqa: E402

SOURCE = "prepared history (synthetic)"
DIRS = ["../data/documents/sentineltex_documents_v2/history", "../data/documents/history"]

folder = Path(sys.argv[1]) if len(sys.argv) > 1 else next((Path(d) for d in DIRS if Path(d).is_dir()), None)
if folder is None or not (folder / "report_summary.csv").exists():
    sys.exit("history folder not found. Extract sentineltex_documents_v2.zip into data\\documents (see README)")


def day(s: str) -> datetime:
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            pass
    raise ValueError(f"Unknown date: {s}")


Base.metadata.create_all(bind=engine)
db = SessionLocal()
db.query(HistoryResult).filter_by(source=SOURCE).delete()
db.query(HistoryReport).filter_by(source=SOURCE).delete()

n_rep = 0
with open(folder / "report_summary.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        decision = "NOT VERIFIABLE" if r["overall_decision"].startswith("NOT VERIFIABLE") else r["overall_decision"]
        db.add(HistoryReport(report_no=r["report_no"], report_date=day(r["report_date"]), sample_code=r["sample_id"],
                             specification=r["specification"], supplier=r["supplier"], decision=decision,
                             failed_clauses=r["failed_clauses"].strip(), source=SOURCE))
        n_rep += 1
n_res = 0
with open(folder / "test_history.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["value"].strip() == "":
            continue
        db.add(HistoryResult(report_no=r["report_no"], report_date=day(r["report_date"]), supplier=r["supplier"],
                             clause=r["clause"], property=r["property"], direction=r["direction"] or "",
                             value=float(r["value"]), unit=r["unit"], compliant=r["compliant"].strip().lower() == "true",
                             source=SOURCE))
        n_res += 1
db.commit()
db.close()
print(f"Imported {n_rep} reports and {n_res} test results as '{SOURCE}'.")
