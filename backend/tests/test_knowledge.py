"""Knowledge base, LLM explanation and Lab Chatbot, end to end through the API.
Uses a small fake Ollama server, so it runs without the real model. Run from the backend folder:
    python tests\\test_knowledge.py
"""
import json, os, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

TMP = tempfile.mkdtemp()
os.environ.update(SENTINELTEX_DB=os.path.join(TMP, "t.db"), SENTINELTEX_DATA_DIR=os.path.join(TMP, "data"),
                  SENTINELTEX_CHROMA_DIR=os.path.join(TMP, "chroma"), SENTINELTEX_EMBEDDING="keyword",
                  SENTINELTEX_OLLAMA_URL="http://127.0.0.1:11555", SENTINELTEX_LLM_TIMEOUT="10")
os.environ.setdefault("SENTINELTEX_SECRET_KEY", "test-secret-key-only-for-tests-0123456789")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REPLY = {"text": ""}


class FakeOllama(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps({"models": [{"name": "llama3.2:3b"}]}).encode())
    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps({"response": REPLY["text"]}).encode())


srv = HTTPServer(("127.0.0.1", 11555), FakeOllama)
threading.Thread(target=srv.serve_forever, daemon=True).start()

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Role, User  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.rag import digitize, index  # noqa: E402
from app.ocr.extract import load_rules  # noqa: E402
from app.compliance.checker import assess  # noqa: E402
from app.rag import explain  # noqa: E402

c = TestClient(app)
db = SessionLocal(); db.add(User(username="am", full_name="AM", role=Role.AM, password_hash=hash_password("password123"))); db.commit(); db.close()
H = {"Authorization": "Bearer " + c.post("/auth/login", data={"username": "am", "password": "password123"}).json()["access_token"]}

# empty knowledge base: chatbot says so
assert c.post("/chat", json={"question": "tear force?"}, headers=H).status_code == 503
# build from the digitised specification (committed JSON, no OCR needed)
assert index.build(digitize.load_digitized("STS/UC/01")) > 30
st = c.get("/knowledge/status", headers=H).json()
assert st["chunks"] > 30 and st["embedding"] == "keyword" and st["llm"]["available"], st

# chatbot: grounded answer with sources
REPLY["text"] = "The warp tear force must be not less than 35 N [clause 3.5a]."
r = c.post("/chat", json={"question": "What is the requirement for tear force in the warp direction?"}, headers=H).json()
assert r["method"] == "llm" and r["sources"][0]["clause"] == "3.5a" and r["grounding"]["grounded"], r
# chatbot: an invented clause and number are flagged
REPLY["text"] = "It must be at least 50 N [clause 3.9b]."
r = c.post("/chat", json={"question": "What is the requirement for tear force in the warp direction?"}, headers=H).json()
assert not r["grounding"]["grounded"] and "3.9b" in r["grounding"]["unknown_clauses"] and "50" in r["grounding"]["unsupported_numbers"], r
# chatbot: question the specification does not cover is refused before the LLM
r = c.post("/chat", json={"question": "Who won the cricket match yesterday?"}, headers=H).json()
assert r["method"] == "refused_no_match", r
# chatbot: exact clause asked by number
REPLY["text"] = "Clause 4.1 permits no holes, tears or cuts [clause 4.1]."
r = c.post("/chat", json={"question": "What does clause 4.1 say?"}, headers=H).json()
assert r["sources"][0]["clause"] == "4.1", r

# explanation of a REJECT with a real failure
rules = load_rules("STS/UC/01")
vals = [{"clause": q["clause"], "found": True, "status": "ok",
         "value": (q["limit"][0] if q["kind"] == "range" else q["limit"])} for q in rules["requirements"]]
next(v for v in vals if v["clause"] == "3.5a")["value"] = 31.2
comp = assess(rules, vals, "No visible defects in 2 m sample.")
assert comp["decision"] == "REJECT"
REPLY["text"] = "The lot is rejected because warp tear force was 31.2 N, below the 35 N minimum [clause 3.5a]; any Section 3 failure means rejection [clause 5.2]."
ex = explain.explain(comp, "STS/UC/01")
assert ex["method"] == "llm" and ex["grounding"]["grounded"] and {"3.5a", "5.2"} <= {s["clause"] for s in ex["sources"]}, ex
# without the LLM: template text with the same facts
ex = explain.explain(comp, "STS/UC/01", use_llm=False)
assert ex["method"] == "template" and "3.5a" in ex["text"] and "31.2" in ex["text"], ex

# /reports/{id}/explain saves the LLM explanation in the report, without touching decision or status
from app.models import QualityReport, Sample  # noqa: E402
db = SessionLocal()
me_id = db.query(User).filter_by(username="am").one().id
smp = Sample(sample_code="ST-0099", specification="STS/UC/01", created_by=me_id); db.add(smp); db.commit()
rep = QualityReport(sample_id=smp.id, decision="REJECT", summary="s", details_json=json.dumps({"compliance": comp}))
db.add(rep); db.commit(); rid = rep.id; db.close()
REPLY["text"] = "Rejected: warp tear force 31.2 N is below 35 N [clause 3.5a], see [clause 5.2]."
r = c.post(f"/reports/{rid}/explain", headers=H).json()
assert r["method"] == "llm" and r["grounding"]["grounded"], r
saved = c.get(f"/reports/{rid}", headers=H).json()
assert json.loads(saved["details_json"])["llm_explanation"]["method"] == "llm"
assert saved["decision"] == "REJECT" and saved["status"] == "pending_am"
assert c.post("/reports/99999/explain", headers=H).status_code == 404

# LLM down: chatbot still returns the clauses
srv.shutdown(); srv.server_close()
r = c.post("/chat", json={"question": "What is the requirement for tear force in the warp direction?"}, headers=H).json()
assert r["method"] == "retrieval_only" and r["sources"][0]["clause"] == "3.5a", r
print("Knowledge, explanation and chatbot tests passed")
