# SentinelTex frontend (React + Electron)

The desktop interface: React pages, shown in an Electron window as a desktop app.

## Run it (two terminals)

**Terminal 1: backend**
```
cd %USERPROFILE%\SentinelTex
venv\Scripts\activate
cd backend
uvicorn app.main:app --reload
```

**Terminal 2: frontend** (first time only: `npm install`, takes a minute)
```
cd %USERPROFILE%\SentinelTex\frontend
npm install
npm run dev
```
Open http://localhost:5173 and log in with the users made by `python seed_users.py` (analyst, am, dm).
Save a file and the page updates by itself.

## Desktop app (Electron)

The desktop app opens its own SentinelTex window, starts the backend by itself, and stops it when the window closes.
Only one terminal is needed. Ollama must be running for LLM answers.

```
cd %USERPROFILE%\SentinelTex\frontend
npm install
npm run desktop
```

* `npm run desktop` builds the interface (`dist`) and opens the app. The backend serves the built interface at
  http://127.0.0.1:8000, so the window and the API share one local address.
* `npm run desktop:dev` opens the window on the Vite dev server instead (run `npm run dev` and the backend first),
  for working on pages with instant reload.
* `npm run dist:win` makes a single `SentinelTex.exe` in `frontend\release`. It is a launcher: it still uses the
  project folder `%USERPROFILE%\SentinelTex` (its venv, models, data and database). Set `SENTINELTEX_HOME` if the
  project is somewhere else.
* If the backend does not start, the window says so; the reason is in `backend\desktop_backend.log`.
* Air gapped: the window shows only the local app. Any outside link is blocked, and no new windows can open.

| File | What it does |
|---|---|
| `electron/main.cjs` | Starts and stops the backend, waits for it, opens the window, blocks outside links |
| `electron/icon.png` | App icon |
| `package.json` "build" | Settings for the .exe (electron-builder, portable) |

## Files

| File | What it does | Status |
|---|---|---|
| `src/api.js` | Every backend call (login, samples, uploads, analyze, reports, review) | Done, use these functions |
| `src/auth.jsx` | Who is logged in, sign in, sign out | Done |
| `src/App.jsx` | Pages and which role may open them | Done |
| `src/theme.css` | Colours and styles (palette from the camo fabric) | Done, extend as needed |
| `src/components/Layout.jsx` | Sidebar menu per role, Sign Out | Done |
| `src/components/StatusBadge.jsx` | Coloured PASS / FAIL / REJECT / Waiting badges | Done |
| `src/components/AuthImage.jsx` | Shows an uploaded photo | Done |
| `src/components/DecisionTimeline.jsx` | Analyst → AM → DM track with approval stamps | Done |
| `src/components/EvidenceModal.jsx` | Evidence view: where on the scan a value was read | Done |
| `src/components/DefectOverlay.jsx` | Fabric photo with defect boxes, toggles per defect type, confidence slider | Done |
| `src/components/Icon.jsx`, `Loading.jsx` | Line icons (offline, inline SVG) and loading spinner | Done |
| `src/pages/Home.jsx` | AM / DM overview: waiting reports, recent decisions, system status | Done |
| `src/pages/Login.jsx` | Login | Done (example) |
| `src/pages/Samples.jsx` | Analyst: sample list and new sample | Done (example) |
| `src/pages/SampleDetail.jsx` | Analyst: upload photo and lab report, run analysis | **Faiza: 2 TODOs** |
| `src/pages/ReviewQueue.jsx` | AM / DM: reports waiting for review | **Faiza: 2 TODOs** |
| `src/pages/ReportView.jsx` | Quality Assessment Report, approve or reject | **Faiza: 4 TODOs** |
| `src/pages/TestAnalysis.jsx` | AM / DM: OCR and compliance overview | Done (Faiza) |
| `src/pages/TrendAnalysis.jsx` | AM / DM: trends | Done |
| `src/pages/LabChatbot.jsx` | AM / DM: chatbot | Done |
| `src/pages/ComingSoon.jsx` | Placeholder for Image Analysis | Maham |

Every TODO comment says which `api.js` function to call and what to show.
Copy the pattern from `Samples.jsx`: `useState` keeps the data, `useEffect` loads it, `try/catch` shows errors.

## Suggested order

1. `SampleDetail.jsx` TODO 1 and 2 (upload and Run analysis): then the whole flow works from the UI
2. `ReportView.jsx` TODO 4 (Approve / Reject): then AM and DM can finish a report
3. `ReportView.jsx` TODO 1 (clause table), then TODO 2 and 3
4. `ReviewQueue.jsx` TODO 1 and 2

Test the full flow after each step: analyst uploads and analyses, AM approves, DM approves, status Approved.
Also test a rejection: it must come back to the analyst as "Returned for re-analysis".

## Rules

* Work on your branch: `git checkout -b faiza-frontend`, push it, Esha merges.
* Never commit `node_modules` or `dist` (the `.gitignore` blocks them).
* Do not change `api.js` function names; if you need a new backend call, tell Esha.
