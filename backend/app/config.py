"""Settings for the SentinelTex backend.

Values can be overridden with environment variables or a `.env` file in the
`backend` folder (never commit `.env`).
"""
import os
import secrets
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


def _load_dotenv() -> None:
    """Read KEY=VALUE lines from backend/.env into the environment (no extra library needed)."""
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _secret_key() -> str:
    """Use SENTINELTEX_SECRET_KEY if set, otherwise create one once and keep it in backend/.env."""
    key = os.environ.get("SENTINELTEX_SECRET_KEY")
    if key:
        return key
    key = secrets.token_hex(32)
    with open(BACKEND_DIR / ".env", "a", encoding="utf-8") as f:
        f.write(f"SENTINELTEX_SECRET_KEY={key}\n")
    os.environ["SENTINELTEX_SECRET_KEY"] = key
    return key


_load_dotenv()

SECRET_KEY = _secret_key()
JWT_ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.environ.get("SENTINELTEX_TOKEN_MINUTES", "480"))  # one working day

DATA_DIR = Path(os.environ.get("SENTINELTEX_DATA_DIR", PROJECT_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = Path(os.environ.get("SENTINELTEX_DB", BACKEND_DIR / "sentineltex.db"))

ALLOWED_IMAGE_TYPES = {".jpg", ".jpeg", ".png"}
ALLOWED_REPORT_TYPES = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_UPLOAD_MB = 25

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
