"""Runs the real OCR + compliance pipeline through the API on report ST-0080 (needs the documents dataset).
Run from the backend folder:  python tests/test_analysis_real_scan.py <path to STTL-TR-2026-0080.jpg>
"""
import json, os, sys, tempfile
TMP = tempfile.mkdtemp()
os.environ["SENTINELTEX_DB"] = os.path.join(TMP, "t.db"); os.environ["SENTINELTEX_DATA_DIR"] = os.path.join(TMP, "data")
os.environ.setdefault("SENTINELTEX_SECRET_KEY", "test-secret-key-only-for-tests-0123456789")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password

# Extract All may or may not create the extra sentineltex_documents_v2 folder: accept both
CANDIDATES = ["../data/documents/sentineltex_documents_v2/lab_reports/scans/STTL-TR-2026-0080.jpg",
              "../data/documents/lab_reports/scans/STTL-TR-2026-0080.jpg"]
scan = sys.argv[1] if len(sys.argv) > 1 else next((c for c in CANDIDATES if os.path.exists(c)), CANDIDATES[0])
if not os.path.exists(scan):
    sys.exit(f"Lab report scan not found: {scan}. Extract sentineltex_documents_v2.zip into data\\documents (see README)")
c = TestClient(app)
db = SessionLocal(); db.add(User(username="analyst", full_name="A", role=Role.LAB_ANALYST, password_hash=hash_password("password123"))); db.commit(); db.close()
H = {"Authorization": "Bearer " + c.post("/auth/login", data={"username": "analyst", "password": "password123"}).json()["access_token"]}
assert c.post("/samples", json={"sample_code": "ST-0080"}, headers=H).status_code == 201
with open(scan, "rb") as f:
    assert c.post("/samples/ST-0080/lab-report", files={"file": ("STTL-TR-2026-0080.jpg", f, "image/jpeg")}, headers=H).status_code == 201
photo = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(scan)))), "linked_samples", "photos", "IMG_7156.jpg")
if os.path.exists(photo):                      # fabric photo of the same sample, for Image Analysis
    with open(photo, "rb") as f:
        assert c.post("/samples/ST-0080/image", files={"file": ("IMG_7156.jpg", f, "image/jpeg")}, headers=H).status_code == 201
for f in c.get("/samples/ST-0080", headers=H).json()["files"]:   # upload quality check: real files pass it
    assert f["quality"]["ok"], (f["original_name"], f["quality"])
rep = c.post("/samples/ST-0080/analyze", headers=H).json()
assert rep["status"] == "draft"
d = json.loads(rep["details_json"])
print("Decision:", rep["decision"]); print("Summary:", rep["summary"])
ta = d.get("test_analysis") or {}
if "error" in ta:                              # OCR could not run: say why instead of failing silently
    sys.exit("OCR failed: " + ta["error"] + "\nIs Tesseract installed? Check with: tesseract --version (see README, Troubleshooting)")
ia = d["image_analysis"]
if ia and "images" in ia:
    for im in ia["images"]:
        print("  Image", im["file"], im.get("counts", im.get("error")))
elif ia:
    print("  Image Analysis:", ia)
for ch in d["compliance"]["checks"]:
    print(f"  {ch['clause']:5s} {ch['result']:14s} value={ch['value']}  requirement: {ch['requirement']}  ({ch['source']})")
assert rep["decision"] == "REJECT" and "4.1" in d["compliance"]["failed_clauses"]
print("Real scan analysis test passed")
