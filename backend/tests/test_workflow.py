"""End to end test of login, samples, uploads and the AM / DM approval workflow.
Run from the backend folder:  python -m pytest -q   (or: python tests/test_workflow.py)
"""
import os, sys, tempfile
TMP = tempfile.mkdtemp()
os.environ["SENTINELTEX_DB"] = os.path.join(TMP, "test.db")
os.environ["SENTINELTEX_DATA_DIR"] = os.path.join(TMP, "data")
os.environ.setdefault("SENTINELTEX_SECRET_KEY", "test-secret-key-only-for-tests-0123456789")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password

client = TestClient(app)


def setup_users():
    db = SessionLocal()
    for u, r in (("analyst", Role.LAB_ANALYST), ("am", Role.AM), ("dm", Role.DM)):
        db.add(User(username=u, full_name=u.upper(), role=r, password_hash=hash_password("password123")))
    db.commit(); db.close()


def login(u, pw="password123"):
    r = client.post("/auth/login", data={"username": u, "password": pw})
    return r


def h(token): return {"Authorization": f"Bearer {token}"}


def test_full_workflow():
    setup_users()
    assert login("analyst", "wrong").status_code == 401
    A = h(login("analyst").json()["access_token"]); AM = h(login("am").json()["access_token"]); DM = h(login("dm").json()["access_token"])
    assert client.get("/auth/me", headers=AM).json()["role"] == "am"
    assert client.get("/samples").status_code == 401                         # no token
    assert client.post("/samples", json={"sample_code": "ST-0080"}, headers=AM).status_code == 403   # AM cannot create
    assert client.post("/samples", json={"sample_code": "bad"}, headers=A).status_code == 422
    assert client.post("/samples", json={"sample_code": "ST-0080"}, headers=A).status_code == 201
    assert client.post("/samples", json={"sample_code": "ST-0080"}, headers=A).status_code == 409
    assert client.post("/samples/ST-0080/analyze", headers=A).status_code == 400  # no files yet
    r = client.post("/samples/ST-0080/image", files={"file": ("photo.exe", b"x", "application/octet-stream")}, headers=A)
    assert r.status_code == 400
    assert client.post("/samples/ST-0080/image", files={"file": ("IMG_7156.jpg", b"\xff\xd8fakejpeg", "image/jpeg")}, headers=A).status_code == 201
    assert client.post("/samples/ST-0080/lab-report", files={"file": ("STTL-TR-2026-0080.jpg", b"\xff\xd8x", "image/jpeg")}, headers=A).status_code == 201
    rep = client.post("/samples/ST-0080/analyze", headers=A).json(); rid = rep["id"]
    assert rep["status"] == "pending_am" and rep["version"] == 1 and rep["sample_code"] == "ST-0080"
    assert client.get(f"/reports/{rid}", headers=A).json()["id"] == rid
    assert client.get("/reports/99999", headers=A).status_code == 404
    fid = client.get("/samples/ST-0080", headers=A).json()["files"][0]["id"]
    assert client.get(f"/samples/files/{fid}", headers=A).status_code == 200      # any logged in user can view
    assert client.get(f"/samples/files/{fid}").status_code == 401                 # not without login
    assert client.post("/samples/ST-0080/analyze", headers=A).status_code == 409    # already pending
    assert client.post(f"/reports/{rid}/review", json={"approve": True}, headers=DM).status_code == 409  # DM before AM
    assert client.post(f"/reports/{rid}/review", json={"approve": False}, headers=AM).status_code == 400   # reject needs reason
    r = client.post(f"/reports/{rid}/review", json={"approve": False, "comment": "Re-check tear"}, headers=AM).json()
    assert r["status"] == "returned_for_reanalysis"
    rep2 = client.post("/samples/ST-0080/analyze", headers=A).json(); rid2 = rep2["id"]
    assert rep2["version"] == 2 and rep2["status"] == "pending_am"
    assert [x["id"] for x in client.get("/reports?status_filter=pending_am", headers=AM).json()] == [rid2]
    assert client.post(f"/reports/{rid2}/review", json={"approve": True}, headers=AM).json()["status"] == "pending_dm"
    assert client.post(f"/reports/{rid2}/review", json={"approve": True}, headers=AM).status_code == 409   # AM twice
    assert client.post(f"/reports/{rid2}/review", json={"approve": True}, headers=A).status_code == 403    # analyst
    final = client.post(f"/reports/{rid2}/review", json={"approve": True, "comment": "OK"}, headers=DM).json()
    assert final["status"] == "approved" and len(final["reviews"]) == 2
    assert client.post("/samples/ST-0080/analyze", headers=A).status_code == 409    # already final
    s = client.get("/samples/ST-0080", headers=DM).json()
    assert len(s["files"]) == 2 and len(s["reports"]) == 2


if __name__ == "__main__":
    test_full_workflow(); print("All workflow checks passed")
