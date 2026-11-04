"""SentinelTex backend. Run from the `backend` folder:

    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000/docs to try every endpoint in the browser.
If the interface has been built (frontend/dist, made by `npm run build`), it is served at http://127.0.0.1:8000/
so the desktop app needs only this one local server.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import PROJECT_DIR

from .database import Base, engine
from .routers import auth, knowledge, reports, samples, trends
from .vision.detect import model_status

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SentinelTex API", version="0.1.0",
              description="Military uniform fabric quality assurance and standards verification (FYP prototype)")

# Only the local desktop app may call the API
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(samples.router)
app.include_router(reports.router)
app.include_router(knowledge.router)
app.include_router(trends.router)


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "image_model": model_status()}


# The built interface (desktop app). Mounted last, so every API route above takes priority.
UI_DIR = PROJECT_DIR / "frontend" / "dist"
if (UI_DIR / "index.html").exists():
    app.mount("/", StaticFiles(directory=UI_DIR, html=True), name="ui")
