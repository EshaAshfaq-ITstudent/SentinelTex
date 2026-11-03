"""Talks to the local LLM through Ollama (runs on the same laptop: nothing leaves the machine)."""
import json
import os
import urllib.error
import urllib.request

OLLAMA_URL = os.environ.get("SENTINELTEX_OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("SENTINELTEX_LLM_MODEL", "llama3.2:3b")
TIMEOUT = int(os.environ.get("SENTINELTEX_LLM_TIMEOUT", "180"))     # CPU only laptops are slow


class LLMUnavailable(RuntimeError):
    pass


def generate(prompt: str, system: str, max_tokens: int = 350) -> str:
    body = json.dumps({"model": MODEL, "prompt": prompt, "system": system, "stream": False,
                       "options": {"temperature": 0, "num_predict": max_tokens, "num_ctx": 4096}}).encode()
    req = urllib.request.Request(f"{OLLAMA_URL}/api/generate", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read())["response"].strip()
    except (urllib.error.URLError, TimeoutError, ConnectionError, KeyError, json.JSONDecodeError) as e:
        raise LLMUnavailable(f"Ollama not reachable at {OLLAMA_URL} (is it running, and is {MODEL} pulled?): {e}") from e


def status() -> dict:
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=3) as r:
            models = [m["name"] for m in json.loads(r.read()).get("models", [])]
        return {"available": MODEL in models, "model": MODEL,
                **({} if MODEL in models else {"reason": f"{MODEL} not pulled (ollama pull {MODEL})"})}
    except Exception as e:
        return {"available": False, "model": MODEL, "reason": f"Ollama not running: {e}"}
