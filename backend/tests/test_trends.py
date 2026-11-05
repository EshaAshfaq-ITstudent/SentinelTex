"""Trend Analysis: imports the history files and checks every number against the CSV files directly.
Run from the backend folder (needs the documents dataset):
    python tests\\test_trends.py
"""
import csv, json, os, subprocess, sys, tempfile
from collections import Counter

TMP = tempfile.mkdtemp()
os.environ.update(SENTINELTEX_DB=os.path.join(TMP, "t.db"), SENTINELTEX_DATA_DIR=os.path.join(TMP, "data"))
os.environ.setdefault("SENTINELTEX_SECRET_KEY", "test-secret-key-only-for-tests-0123456789")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

DIRS = ["../data/documents/sentineltex_documents_v2/history", "../data/documents/history"]
hist = sys.argv[1] if len(sys.argv) > 1 else next((d for d in DIRS if os.path.isdir(d)), None)
if hist is None:
    sys.exit("history folder not found: extract sentineltex_documents_v2.zip into data\\documents")

out = subprocess.run([sys.executable, os.path.join(HERE, "tools", "import_history.py"), hist],
                     capture_output=True, text=True, env=os.environ)
assert out.returncode == 0, out.stderr
print(out.stdout.strip())

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import QualityReport, Role, Sample, User  # noqa: E402
from app.security import hash_password  # noqa: E402

c = TestClient(app)
db = SessionLocal()
for u, r in (("am", Role.AM), ("analyst", Role.LAB_ANALYST)):
    db.add(User(username=u, full_name=u, role=r, password_hash=hash_password("password123")))
db.commit()
tok = lambda u: {"Authorization": "Bearer " + c.post("/auth/login", data={"username": u, "password": "password123"}).json()["access_token"]}  # noqa: E731
AM, AN = tok("am"), tok("analyst")

summary = list(csv.DictReader(open(os.path.join(hist, "report_summary.csv"), encoding="utf-8")))
tests = [t for t in csv.DictReader(open(os.path.join(hist, "test_history.csv"), encoding="utf-8")) if t["value"].strip()]

# only managers see trends
assert c.get("/trends/overview", headers=AN).status_code == 403

o = c.get("/trends/overview?source=history", headers=AM).json()
assert o["total_reports"] == len(summary)
want = Counter("NOT VERIFIABLE" if s["overall_decision"].startswith("NOT") else s["overall_decision"] for s in summary)
assert o["decisions"] == dict(want), (o["decisions"], want)
assert sum(m["total"] for m in o["monthly"]) == len(summary)
assert "prepared history dataset" in o["note"] and set(o["by_source"]) == {"Past records"}
# clause failure counts match the failed clause lists in the CSV (tests and visual defects)
want_f = Counter(c for s in summary for c in set(s["failed_clauses"].split()))
assert {cf["clause"]: cf["failed"] for cf in o["clause_failures"]} == dict(want_f)
assert all(cf["tested"] == len(summary) for cf in o["clause_failures"])
assert any(cf["clause"].startswith("4.") for cf in o["clause_failures"])     # visual defects are included
# supplier reject rates match the CSV
for s in o["suppliers"]:
    rows = [x for x in summary if x["supplier"] == s["supplier"]]
    assert s["reports"] == len(rows) and s["reject"] == sum(x["overall_decision"] == "REJECT" for x in rows), s

# one supplier, one date window
sup = summary[0]["supplier"]
o2 = c.get(f"/trends/overview?source=history&supplier={sup}&date_from=2026-05-01&date_to=2026-08-31", headers=AM).json()
from datetime import datetime  # noqa: E402
day = lambda s: datetime.strptime(s, "%d-%m-%Y")  # noqa: E731
assert o2["total_reports"] == sum(x["supplier"] == sup and datetime(2026, 5, 1) <= day(x["report_date"]) <= datetime(2026, 8, 31) for x in summary)
assert c.get("/trends/overview?date_from=31-12-2026", headers=AM).status_code == 400

# clause trend: values, limit, out of limit count
t = c.get("/trends/clause/3.5a?source=history", headers=AM).json()
rows = [x for x in tests if x["clause"] == "3.5a"]
assert t["stats"]["n"] == len(rows) and t["limit"] == 35 and t["kind"] == "min"
assert t["stats"]["out_of_limit"] == sum(x["compliant"] != "True" for x in rows)
assert all(p["value"] >= 35 for p in t["points"] if p["compliant"])
assert c.get("/trends/clause/9.9", headers=AM).status_code == 404

# reports analysed in SentinelTex are included and labelled
smp = Sample(sample_code="ST-0500", specification="STS/UC/01", created_by=1); db.add(smp); db.commit()
checks = [{"clause": "3.5a", "property": "Tear force (trouser)", "direction": "Warp", "unit": "N", "value": 31.0, "result": "FAIL"}]
db.add(QualityReport(sample_id=smp.id, decision="REJECT", details_json=json.dumps({"compliance": {"checks": checks}}))); db.commit()
o3 = c.get("/trends/overview", headers=AM).json()
assert o3["total_reports"] == len(summary) + 1 and o3["by_source"]["SentinelTex analyses"] == 1
t3 = c.get("/trends/clause/3.5a?source=system", headers=AM).json()
assert t3["stats"]["n"] == 1 and t3["points"][0]["compliant"] is False
print("Trend Analysis tests passed")
