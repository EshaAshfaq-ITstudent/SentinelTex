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
├── backend/          FastAPI app (API, database, login, approvals)
│   ├── vision/       Image Analysis (YOLO)
│   ├── ocr/          Test Analysis (lab report reading)
│   ├── rag/          Specification search (ChromaDB) and LLM
│   └── compliance/   Pass or fail checking against clauses
├── frontend/         Electron and React desktop app
├── notebooks/        Kaggle training notebook
├── data/             Datasets (not on GitHub, see Data below)
├── models/           Trained model files (not on GitHub)
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

```
python -m pip install --upgrade pip
pip install fastapi "uvicorn[standard]" python-multipart pyjwt bcrypt sqlalchemy chromadb sentence-transformers opencv-python pytesseract pillow pypdfium2 ollama ultralytics
```

This takes 10 to 20 minutes. It worked if the last line says `Successfully installed ...` with no red `ERROR` lines.

---

## Every time you start working

```
cd %USERPROFILE%\sentineltex
venv\Scripts\activate
git pull
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
| Image dataset zip | Fabric images with defect labels (YOLO format) | `data/images/` |
| Documents zip | Specification and lab report scans with answer keys | `data/documents/` |
| YOLO model file (`best.pt`) | Trained Image Analysis model | `models/` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `python --version` shows 3.14 | Create the venv with `py -3.11 -m venv venv`, then activate it |
| `'ollama' is not recognized` | Install Ollama (step 3), then open a new terminal |
| `'tesseract' is not recognized` | Add `C:\Program Files\Tesseract-OCR` to PATH, open a new terminal |
| `(venv)` not showing | Run `venv\Scripts\activate` inside the `sentineltex` folder |
| pip shows red errors | Check that `python --version` says 3.11 inside the venv |

Add new problems here as we find them.
