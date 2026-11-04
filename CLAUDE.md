# SentinelTex: context for Claude sessions

Read this before working in this repository. Keep it up to date when a module is finished or a decision changes.

## Project

SentinelTex: Intelligent Military Uniform Quality Assurance and Standards Verification System.
Final Year Project, BS Information Technology, Bahria University Karachi. Supervisor: Dr. Abdullah Ayub Khan.
Team: Esha Ashfaq (standards, RAG, LLM, backend, coordination), Maham Imran (Image Analysis, Trend Analysis),
Faiza Altaf (Test Analysis OCR, Electron and React interface).

An offline (air gapped) desktop system for a military textile lab. For each fabric sample it checks the fabric photo
for defects (YOLO), reads the lab report scan (OCR), retrieves the matching specification clauses (RAG with ChromaDB),
checks every result against its clause, has a local LLM explain the result, and produces a Quality Assessment Report
that the Assistant Manager (AM) and then the Deputy Manager (DM) must both approve. A rejection by either sends the
report back for re-analysis. Roles: Lab Analyst, AM, DM.

## Scope decisions (agreed)

* One fabric only: the team's digital camouflage ripstop uniform. One specification: STS/UC/01.
* Chatbot refuses when retrieval similarity is below a threshold (no LLM call); every LLM answer is checked: cited clauses and numbers must appear in the given context.
* Code decides pass or fail against clauses. The LLM only explains and cites the clause; it never decides.
* A defect found only by the image model is CHECK MANUALLY (a person confirms); only lab report findings can FAIL visual clauses.
* Unreadable or doubtful values are flagged "CHECK MANUALLY", never guessed. Missing results give "NOT VERIFIABLE".
* Everything runs locally. Cloud GPU (Kaggle) is used only to train the image model during development.
* LLM: Ollama with `llama3.2:3b` on CPU (laptop has no NVIDIA GPU, 16 GB RAM).
* Python 3.11 in `venv` at the project root. Windows 11.
* Do not describe the data source in team documents (log book, README). Do not invent results: every number in docs
  must come from a script that was actually run.

## Folders

```
backend/app/routers/     API: auth (JWT login), samples (create, upload image / lab report), reports (analyze, AM/DM review)
backend/app/ocr/         Test Analysis: preprocess.py (page finding, deskew, speck and line removal), extract.py (Tesseract, row to clause matching, unit checks)
backend/app/compliance/  checker.py: clause by clause PASS / FAIL / CHECK MANUALLY / NOT REPORTED, decision ACCEPT / REJECT / NOT VERIFIABLE
backend/app/rag/         digitize.py (spec scans -> OCR -> clause chunks JSON), index.py (ChromaDB, MiniLM or keyword fallback), llm.py (Ollama), explain.py, chat.py, grounding.py (cited clauses and numbers must be in context)
backend/app/vision/      detect.py: YOLO on fabric photos (models/best.pt, conf 0.25); per defect, sample count = max over photos; skipped if no model
frontend/                React app: npm install, npm run dev (port 5173). src/api.js holds every backend call. Desktop: npm run desktop (Electron, electron/main.cjs)
notebooks/               sentineltex_yolo_training.ipynb (Kaggle, YOLOv8s, 640 px, seed 0, val + real only test metrics)
backend/app/knowledge/   STS-UC-01_rules.json: 18 test clauses (3.1 to 3.12) and 6 visual clauses (4.1 to 4.6)
backend/tests/           test_workflow.py (login, roles, approval flow), test_analysis_real_scan.py (real scan through the API)
backend/tools/           evaluate_ocr.py, evaluate_decisions.py (accuracy against answer keys)
docs/                    results notes for the FYP report
data/                    not in git (see .gitignore)
  images/sentineltex_dataset_v1/          500 images, YOLO format, 6 classes, split by scene, test set real photos only
  documents/sentineltex_documents_v2/     specification scans, 100 lab report scans + answer keys, 24 linked photo samples
```

Image classes: 0 stain, 1 spot, 2 discoloration, 3 tear, 4 loose_thread, 5 pattern_defect.

## Commands (from the project root, Windows)

```
venv\Scripts\activate
cd backend
python tests\test_workflow.py
python tests\test_analysis_real_scan.py
python tests\test_image_analysis.py
python tests\test_compliance_rules.py
python tests\test_knowledge.py
python tools\build_knowledge.py     (once: OCR spec, embeddings, chroma_db)
python tools\evaluate_rag.py
python tools\import_history.py     (once: demo history for Trend Analysis)
python tests\test_trends.py
python tools\evaluate_ocr.py ..\data\documents\sentineltex_documents_v2\lab_reports\scans ..\data\documents\sentineltex_documents_v2\lab_reports\answer_keys
python tools\evaluate_decisions.py ..\data\documents\sentineltex_documents_v2\lab_reports\scans ..\data\documents\sentineltex_documents_v2\lab_reports\answer_keys
uvicorn app.main:app --reload        (then http://127.0.0.1:8000/docs)
python seed_users.py                 (set passwords for analyst, am, dm)
```

## Progress

| Module | Status |
|---|---|
| Backend: login, roles, samples, uploads, AM then DM approval | Done, tested |
| Test Analysis (OCR) + compliance check | Done, tested, connected to /analyze |
| Image Analysis: detect.py connected to /analyze. v1 trained (real test mAP50 0.089, synthetic to real gap). v2 notebook adds public real defect photos | v2 Kaggle run pending |
| Specification OCR into ChromaDB (app/rag), LLM explanation (/reports/{id}/explain), Lab Chatbot (/chat) with grounding check | Done, tested with keyword embedding and a fake Ollama; run evaluate_rag.py on the laptop with MiniLM + llama3.2 |
| Trend Analysis: tools/import_history.py (history CSVs, source 'demo history (synthetic)'), /trends/overview, /trends/clause/{c}, frontend TrendAnalysis.jsx | Done, tested against the CSVs |
| React interface: all pages done except AM/DM Image Analysis page (Maham). Test Analysis page (Faiza) reviewed | Done |
| Electron: frontend/electron/main.cjs starts/stops backend, loads http://127.0.0.1:8000 (backend serves frontend/dist), blocks outside links. npm run desktop / dist:win | Base done and tested on Linux; Windows .exe build and test: Faiza |

## Measured results (31 Oct 2026, 100 lab report images)

* Test values read exactly: 94.1% overall (flatbed scan 97.9%, phone photo 92.9%, photocopy 88.8%); wrong and not flagged 1.7%.
* Final decision correct 70/100; no REJECT was ever accepted; failed clauses matched in 93/100.
  Most mismatches are cautious NOT VERIFIABLE results. Details: docs/test_analysis_results.md

## Writing style for team documents

Concise and practical. No hyphens or dashes in prose. Plain words over jargon.
