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
* Code decides pass or fail against clauses. The LLM only explains and cites the clause; it never decides.
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
python tests\test_analysis_real_scan.py ..\data\documents\sentineltex_documents_v2\lab_reports\scans\STTL-TR-2026-0080.jpg
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
| Image Analysis (YOLO on Kaggle, then plug in) | Next |
| Specification in ChromaDB + LLM explanation | Next |
| Trend Analysis, Lab Chatbot | Later |
| Electron and React interface | Later |

## Measured results (31 Oct 2026, 100 lab report images)

* Test values read exactly: 94.1% overall (flatbed scan 97.9%, phone photo 92.9%, photocopy 88.8%); wrong and not flagged 1.7%.
* Final decision correct 70/100; no REJECT was ever accepted; failed clauses matched in 93/100.
  Most mismatches are cautious NOT VERIFIABLE results. Details: docs/test_analysis_results.md

## Writing style for team documents

Concise and practical. No hyphens or dashes in prose. Plain words over jargon.
