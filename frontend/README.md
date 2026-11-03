# SentinelTex frontend (React)

The desktop interface. React pages first (in the browser), Electron wraps them into a desktop app at the end.

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

## Files

| File | What it does | Status |
|---|---|---|
| `src/api.js` | Every backend call (login, samples, uploads, analyze, reports, review) | Done, use these functions |
| `src/auth.jsx` | Who is logged in, sign in, sign out | Done |
| `src/App.jsx` | Pages and which role may open them | Done |
| `src/theme.css` | Colours and styles (palette from the camo fabric) | Done, extend as needed |
| `src/components/Layout.jsx` | Sidebar menu per role, Sign Out | Done |
| `src/components/StatusBadge.jsx` | Coloured PASS / FAIL / REJECT / Waiting badges | Done |
| `src/components/AuthImage.jsx` | Shows an uploaded photo (with defect boxes) | Done |
| `src/pages/Login.jsx` | Login | Done (example) |
| `src/pages/Samples.jsx` | Analyst: sample list and new sample | Done (example) |
| `src/pages/SampleDetail.jsx` | Analyst: upload photo and lab report, run analysis | **Faiza: 2 TODOs** |
| `src/pages/ReviewQueue.jsx` | AM / DM: reports waiting for review | **Faiza: 2 TODOs** |
| `src/pages/ReportView.jsx` | Quality Assessment Report, approve or reject | **Faiza: 4 TODOs** |
| `src/pages/ComingSoon.jsx` | Placeholder for Image Analysis, Test Analysis, Trend Analysis, Lab Chatbot | Later |

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
