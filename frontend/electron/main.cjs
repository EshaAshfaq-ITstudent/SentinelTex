// SentinelTex desktop app (Electron).
// Starts the local backend (FastAPI in the project's venv), waits until it answers, then shows the
// interface the backend serves at http://127.0.0.1:8000. Everything stays on this laptop.
//
//   npm run desktop        build the interface and open the desktop app
//   npm run desktop:dev    open the app on the Vite dev server (http://localhost:5173) while developing

const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn, execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')

const DEV = process.argv.includes('--dev')
const PORT = 8000
const API = `http://127.0.0.1:${PORT}`
const WIN = process.platform === 'win32'

// Project folder: SENTINELTEX_HOME if set; when running from the source tree, two levels up from this file;
// for the packaged .exe, the usual clone location %USERPROFILE%\SentinelTex.
function projectDir() {
  if (process.env.SENTINELTEX_HOME) return process.env.SENTINELTEX_HOME
  if (!app.isPackaged) return path.resolve(__dirname, '..', '..')
  return path.join(app.getPath('home'), 'SentinelTex')
}
const ROOT = projectDir()
const BACKEND = path.join(ROOT, 'backend')
const PYTHON = path.join(ROOT, 'venv', WIN ? 'Scripts' : 'bin', WIN ? 'python.exe' : 'python')

let backend = null          // the backend process, only if this app started it
let win = null

function healthy() {
  return new Promise((resolve) => {
    const req = http.get(`${API}/health`, (res) => { res.resume(); resolve(res.statusCode === 200) })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
  })
}

async function waitForBackend(seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await healthy()) return true
    if (backend && backend.exitCode !== null) return false        // it crashed: stop waiting
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

function startBackend() {
  if (!fs.existsSync(PYTHON)) throw new Error(`Python environment not found:\n${PYTHON}\n\nFollow the Run Checklist sections 1 and 2.`)
  const log = fs.openSync(path.join(BACKEND, 'desktop_backend.log'), 'a')
  backend = spawn(PYTHON, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: BACKEND, windowsHide: true, stdio: ['ignore', log, log] })
}

function stopBackend() {
  if (!backend || backend.exitCode !== null) return
  if (WIN) execFile('taskkill', ['/pid', String(backend.pid), '/T', '/F'], () => {})
  else backend.kill()
}

function message(title, text) {
  const html = `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#1e2420;color:#e9ecdf;
    font-family:Segoe UI,system-ui,sans-serif"><div style="text-align:center;max-width:520px;padding:16px">
    <div style="font-weight:700;letter-spacing:1px;font-size:22px">SENTINEL<span style="color:#c8b88a">TEX</span></div>
    <p style="color:#a3ab98;white-space:pre-wrap">${title}</p><p style="font-size:13px;color:#a3ab98;white-space:pre-wrap">${text}</p></div></body>`
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

async function boot() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1000, minHeight: 640, backgroundColor: '#1e2420', title: 'SentinelTex',
    icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  // Air gapped: the window may only show the local app. Any other link is blocked.
  const local = (url) => url.startsWith(API) || url.startsWith('http://localhost:5173') || url.startsWith('data:')
  win.webContents.on('will-navigate', (e, url) => { if (!local(url)) e.preventDefault() })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (DEV) { win.loadURL('http://localhost:5173'); return }

  message('Starting…', 'Loading the local analysis services. This can take up to a minute the first time.')
  try {
    if (!(await healthy())) startBackend()                         // reuse a backend that is already running
    if (!(await waitForBackend(120))) {
      message('The backend did not start.', `See ${path.join(BACKEND, 'desktop_backend.log')}\nfor the reason, then restart the app.`)
      return
    }
    if (!fs.existsSync(path.join(ROOT, 'frontend', 'dist', 'index.html'))) {
      message('The interface has not been built yet.', 'In the frontend folder run:  npm run build\nthen restart the app.')
      return
    }
    win.loadURL(`${API}/`)
  } catch (err) {
    message('SentinelTex could not start.', err.message)
  }
}

app.whenReady().then(boot)
app.on('window-all-closed', () => { stopBackend(); app.quit() })
app.on('before-quit', stopBackend)
