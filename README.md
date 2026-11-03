# SentinelTex

**Intelligent Military Uniform Quality Assurance and Standards Verification System**

Final Year Project, BS Information Technology, Bahria University Karachi Campus
Supervisor: Dr. Abdullah Ayub Khan

| Member | Responsibility |
|---|---|
| Esha Ashfaq | Standards, RAG and ChromaDB, LLM, backend, coordination |
| Maham Imran | Image Analysis (YOLO), Trend Analysis |
| Faiza Altaf | Test Analysis (OCR), desktop interface (Electron, React) |

---

## What SentinelTex does

SentinelTex is an offline desktop system for a military textile laboratory. For each fabric sample it:

1. Checks the **fabric photo** for defects (Image Analysis, YOLO)
2. Reads the **lab test report** scan (Test Analysis, OCR)
3. Finds the matching clauses in the **specification** (RAG with ChromaDB)
4. Compares every result with its clause and lets a local **LLM** explain the decision
5. Produces a **Quality Assessment Report** that the Assistant Manager and Deputy Manager must both approve

Everything runs locally on the laptop (air gapped design). No cloud APIs are used for project data.

## Tech stack

| Part | Technology |
|---|---|
| Desktop app | Electron, React |
| Backend | FastAPI (Python 3.11) |
| Image Analysis | YOLOv8 (Ultralytics), OpenCV |
| Test Analysis | Tesseract OCR, OpenCV |
| Knowledge retrieval | ChromaDB, sentence-transformers |
| LLM | Ollama with `llama3.2:3b` (runs on CPU) |
| Security | JWT login, role based access (Lab Analyst, AM, DM) |
| Database | SQLite through SQLAlchemy |

## Project structure

```
sentineltex/
├── backend/              FastAPI app
│   ├── app/
│   │   ├── routers/      API endpoints (login, samples, reports and approvals)
│   │   ├── ocr/          Test Analysis: reads lab report scans          (done)
│   │   ├── compliance/   Pass or fail checking against clauses          (done)
│   │   ├── knowledge/    Specification rules (STS/UC/01)
│   │   ├── vision/       Image Analysis (YOLO)                          (done, needs trained model)
│   │   └── rag/          Specification search (ChromaDB) and LLM        (next)
│   ├── tests/            Workflow and real scan tests
│   └── tools/            Accuracy evaluation scripts
├── docs/                 Results notes for the FYP report
├── frontend/             Electron and React desktop app                 (later)
├── notebooks/            Kaggle training notebook for the image model
├── data/                 Datasets (not on GitHub, see Data below)
├── models/               Trained model files (best.pt) (not on GitHub)
├── .gitignore
└── README.md
```

Folders are added as each part is built.

---

## Setup (Windows)

Laptop needed: at least 4 CPU cores, 16 GB RAM, 30 GB free space. No graphics card needed.

> After installing any program, **close the terminal and open a new one** before using it.
> To open a terminal: press Start, type `cmd`, press Enter.

### 1. Install the tools

| Tool | Get it from | Notes |
|---|---|---|
| Git | git-scm.com | Default options |
| Node.js (LTS) | nodejs.org | Default options |
| VS Code | code.visualstudio.com | Add the Python extension |
| Tesseract OCR | Search "tesseract UB Mannheim" | Install to `C:\Program Files\Tesseract-OCR` and add it to PATH |

Check:

```
git --version
node -v
tesseract --version
```

### 2. Install Python 3.11

The project needs **Python 3.11**. Newer versions (3.13, 3.14) may not work with PyTorch, ChromaDB and YOLO. You can keep a newer Python; 3.11 installs next to it.

```
py install 3.11
py -3.11 --version
```

If `py install` fails, download a 3.11.x "Windows installer (64 bit)" from python.org and tick **Add Python to PATH**.

### 3. Install Ollama and the LLM

1. Go to **ollama.com**, click **Download**, choose **Windows**, run `OllamaSetup.exe`, click **Install**
2. Ollama runs in the background (llama icon near the clock)
3. Open a **new** terminal and run:

```
ollama --version
ollama pull llama3.2:3b
ollama run llama3.2:3b "say hello"
```

It should reply with a greeting. If you see a `>>>` prompt, type `/bye` to exit.

### 4. Get the code

```
cd %USERPROFILE%
git clone <repository URL>
cd sentineltex
```

### 5. Create the virtual environment

```
py -3.11 -m venv venv
venv\Scripts\activate
python --version
```

It should print **Python 3.11.x** and show `(venv)` at the start of the line.

### 6. Install the Python libraries

From the main `SentinelTex` folder, with `(venv)` showing:

```
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

It worked if the last line says `Successfully installed ...` with no red `ERROR` lines. When new parts are added (YOLO, ChromaDB, LLM) their libraries go into `backend\requirements.txt`, so run this command again after every `git pull`.

---

## Run and test

```
cd %USERPROFILE%\SentinelTex
venv\Scripts\activate
cd backend
python tests\test_workflow.py
python tests\test_analysis_real_scan.py ..\data\documents\sentineltex_documents_v2\lab_reports\scans\STTL-TR-2026-0080.jpg
python seed_users.py                 (first time only: set passwords for analyst, am, dm)
uvicorn app.main:app --reload
```

Then open http://127.0.0.1:8000/docs. Accuracy results so far: `docs/test_analysis_results.md`.

## Train the Image Analysis model (Kaggle, free GPU)

1. Sign in at kaggle.com and verify your phone number (needed for GPU).
2. **Create → New Dataset**, upload `sentineltex_dataset_v1.zip`, name it `sentineltex-dataset`, keep it **Private**, click **Create**.
3. **Create → New Notebook → File → Import Notebook**, choose `notebooks\sentineltex_yolo_training.ipynb`.
4. In the right panel: **Add Input** → your `sentineltex-dataset`. Session options: Accelerator **GPU T4 x2**, Internet **On**.
5. Click **Run All** (about 20 to 40 minutes).
6. From the **Output** panel download `sentineltex_yolo_results.zip`. Put `best.pt` from it in `SentinelTex\models\` and keep the rest (metrics and charts) for the report.
7. Check it on the laptop, from the `backend` folder:

```
python tests\test_image_analysis.py
python tests\test_analysis_real_scan.py
python tests\test_compliance_rules.py
```

Without `models\best.pt` the backend still works and the report says Image Analysis was skipped.

**Version 2 (current):** use `notebooks\sentineltex_yolo_training_v2.ipynb` the same way, with two more inputs: the public **Fabric Stain Dataset** (search it under Add Input) and **FabriD** (download it from data.mendeley.com/datasets/vncdwps24r and upload it as a private Kaggle dataset). The notebook's first cell explains everything. Results of each version are in `docs\image_analysis_results.md`.

---

## Every time you start working

```
cd %USERPROFILE%\SentinelTex
venv\Scripts\activate
git pull
pip install -r backend\requirements.txt
```

## Working with Git

* **Pull before you start**, push when you finish a piece of work
* Work on your own branch, then merge:

```
git checkout -b esha-rag        (use your name and the part you are working on)
git add .
git commit -m "Short description of what you did"
git push -u origin esha-rag
```

* Never push the `venv` folder, datasets or model files. The `.gitignore` already blocks them.

## Data

Datasets and trained models are too large for GitHub. They are in the shared Google Drive folder:

**Drive link:** `<add link here>`

| File | Contents | Put it in |
|---|---|---|
| `sentineltex_dataset_v1.zip` | Fabric images with defect labels (YOLO format) | `data/images/` |
| `sentineltex_documents_v2.zip` | Specification, lab report scans, answer keys, linked photos | `data/documents/` |

| YOLO model file (`best.pt`) | Trained Image Analysis model | `models/` |

Use Windows "Extract All" into each folder. After extracting, these paths must exist:
`data/images/sentineltex_dataset_v1/images/train/` and `data/documents/sentineltex_documents_v2/lab_reports/scans/`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `python --version` shows 3.14 | Create the venv with `py -3.11 -m venv venv`, then activate it |
| `'ollama' is not recognized` | Install Ollama (step 3), then open a new terminal |
| `'tesseract' is not recognized` | Add `C:\Program Files\Tesseract-OCR` to PATH, open a new terminal |
| `(venv)` not showing | Run `venv\Scripts\activate` in the main `SentinelTex` folder (not inside `backend`) |
| `requires the httpx2 package` | Run `pip install -r backend\requirements.txt` again (httpx2 is now in the list) |
| Test command only opens the image | Type the whole line, starting with `python tests\test_analysis_real_scan.py` |
| Image Analysis skipped (no trained model) | Put `best.pt` in `SentinelTex\models\` (Kaggle step above) |
| pip shows red errors | Check that `python --version` says 3.11 inside the venv |

Add new problems here as we find them.
