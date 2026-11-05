# SentinelTex Electron Desktop Application

## 1. Overview

SentinelTex is available as a Windows desktop application using Electron. It provides a standalone desktop window for the existing React-based user interface and connects to the locally running FastAPI backend.

The desktop application operates within the SentinelTex local environment.

## 2. Application Architecture

The desktop application consists of:

- **Electron:** Creates and manages the desktop application window.
- **React + Vite:** Provides the frontend interface.
- **FastAPI:** Handles authentication, sample management, uploads, analysis, reports, and approval workflows.
- **Local Services:** Uses the project's existing virtual environment, models, data, and database.

## 3. Backend Startup and Shutdown

When the Electron application starts, it automatically launches the FastAPI backend.

The backend serves the built frontend and API through:

`http://127.0.0.1:8000`

When the Electron window is closed, the application stops its managed backend process.

If the backend fails to start, diagnostic information is written to:

`backend/desktop_backend.log`

## 4. Air-Gapped Desktop Behaviour

The Electron window is restricted to the local SentinelTex application.

- External website navigation is blocked.
- New external browser windows are prevented.
- Application communication uses the local backend.
- The desktop interface does not require an externally hosted frontend.

Ollama must be running for local LLM chatbot responses.

## 5. Running the Desktop Application

Open PowerShell and execute:

```powershell
cd "$env:USERPROFILE\SentinelTex\frontend"
npm install
npm run desktop