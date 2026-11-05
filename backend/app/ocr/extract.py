"""Read a lab report scan and turn it into structured test results mapped to specification clauses.

Every value keeps its raw OCR text, so a reviewer can trace it back to the document.
Values that fail the unit sanity checks are flagged for manual review instead of being guessed.
"""
import difflib
import json
import os
import re
from pathlib import Path

import pytesseract

from .preprocess import prepare_variants

if os.environ.get("SENTINELTEX_TESSERACT"):           # e.g. C:\Program Files\Tesseract-OCR\tesseract.exe
    pytesseract.pytesseract.tesseract_cmd = os.environ["SENTINELTEX_TESSERACT"]

RULES_DIR = Path(__file__).resolve().parent.parent / "knowledge"

# Plausible range and printed decimals per kind of value (used to catch OCR mistakes)
CHECKS = {
    "N": (50, 3000, 1), "g/m2": (50, 400, 1), "threads/cm": (10, 100, 0), "pH": (2, 12, 1),
    "Delta E": (0, 10, 2), "grade": (1, 5, None), "blue wool grade": (1, 8, None),
}
NUM = r"[+\-]?\d+(?:[.,]\d+)?"


def load_rules(spec_id: str = "STS/UC/01") -> dict:
    path = RULES_DIR / f"{spec_id.replace('/', '-')}_rules.json"
    if not path.exists():
        raise FileNotFoundError(f"No specification rules for {spec_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def available_specs() -> list[str]:
    return sorted(p.name.replace("_rules.json", "").replace("-", "/") for p in RULES_DIR.glob("*_rules.json"))


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _method_key(m: str) -> str:
    """'ISO 105-X12' -> '105x12' (tolerant key for matching)."""
    return _norm(m.replace("ISO", ""))


def _check_for(rule: dict):
    if rule["unit"] == "N" and "tear" in rule["property"].lower():
        return (5, 200, 1)
    if rule["unit"] == "%":
        return (-15, 15, 1) if rule["kind"] == "abs_max" else (0, 100, 1)
    return CHECKS.get(rule["unit"], (None, None, None))


def parse_value(raw: str, rule: dict) -> tuple[float | None, str, list[str]]:
    """Return (value, how it was read, notes). Handles '4-5' grades, 'a / b' pairs, missing decimals."""
    notes = []
    s = raw.replace(",", ".").replace("O", "0").replace("o", "0").replace("l", "1").replace("I", "1")
    s = s.replace("—", "-").replace("–", "-").replace("=", "-")
    lo, hi, dec = _check_for(rule)
    if "grade" in rule["unit"]:
        grades = []
        for tok in re.findall(r"\d\s*-\s*\d|\d\.5|\d{2}|\d", s):
            t = tok.replace(" ", "")
            if "-" in t:
                a, b = t.split("-"); v = (int(a) + int(b)) / 2
            elif len(t) == 2 and t[1] == "5" and not t.startswith("1"):
                v = int(t[0]) + 0.5; notes.append(f"read '{t}' as {v}")
            else:
                v = float(t)
            grades.append(v)
        if not grades:
            return None, "no number found", notes
        value = min(grades) if rule["clause"] == "3.10" else grades[0]   # perspiration: lower of acid/alkaline
        if not (lo <= value <= hi):
            return value, "out of range", notes
        return value, "ok", notes
    if dec == 1 and "." not in s:
        joined = re.sub(r"^(\D*[+\-]?\d+)\s+(\d)(?!\d)", r"\1.\2", s)   # "6 7" -> "6.7" (point not read)
        if joined != s:
            notes.append("decimal point restored from a gap between digits")
            s = joined
    m = re.search(NUM, s)
    if not m:
        return None, "no number found", notes
    tok = m.group(0)
    value = float(tok)
    if dec and "." not in tok and lo is not None and not (lo <= value <= hi):
        fixed = value / (10 ** dec)                                   # decimal point lost by OCR
        if lo <= fixed <= hi:
            notes.append(f"decimal point restored: '{tok}' -> {fixed}")
            value = fixed
    if lo is not None and not (lo <= value <= hi):
        return value, "out of range", notes
    if rule["kind"] == "abs_max" and not tok.startswith(("+", "-")) and value != 0:
        notes.append("sign not read; compliance uses the absolute value, so the decision is unaffected")
    return value, "ok", notes


def _find_header(text: str) -> dict:
    flat = re.sub(r"\s+", " ", text)
    sample = re.search(r"ST\s*[-–]?\s*(\d{4})", flat)
    report = re.search(r"STTL\s*/\s*TR\s*/\s*(\d{4})\s*/\s*(\d{4})", flat)
    spec = re.search(r"STS\s*/\s*UC\s*/\s*0?(\d)", flat)
    return {"sample_id": f"ST-{sample.group(1)}" if sample else None,
            "report_no": f"STTL/TR/{report.group(1)}/{report.group(2)}" if report else None,
            "specification": f"STS/UC/0{spec.group(1)}" if spec else None}


def _find_visual(lines: list[str]) -> str:
    for i, ln in enumerate(lines):
        if re.search(r"visual", ln, re.I):
            tail = ln[re.search(r"visual", ln, re.I).end():]
            parts = [tail.split(":", 1)[1] if ":" in tail else re.sub(r"^\s*\S+", "", tail)]
            for nxt in lines[i + 1:i + 4]:
                if re.search(r"(?i)remarks|^\s*4\s*[.,]|results relate", nxt):
                    break
                parts.append(nxt)
            return re.sub(r"\s+", " ", " ".join(parts)).strip(" :")
    return ""


GOOD_ENOUGH = 14   # rows read cleanly; below this, try the next page candidate (phone photos)
MAX_ATTEMPTS = 4


def extract_report(path: str | Path, spec_id: str | None = None, save_page: bool = False) -> dict:
    """Try page candidates until enough rows are read; keep the best attempt.

    save_page=True also stores the cleaned page the OCR read (ocrpage_<name>.png next to the upload) and the
    position of every matched line on it, so the interface can show where each value was read (evidence view).
    """
    best = None
    for n, (clean, prep) in enumerate(prepare_variants(path), 1):
        result = _read(clean, prep, spec_id)
        ok = sum(1 for r in result["results"] if r["status"] == "ok")
        if best is None or ok > best[0]:
            best = (ok, result, clean)
        if ok >= GOOD_ENOUGH or n >= MAX_ATTEMPTS:
            break
    result, clean = best[1], best[2]
    if save_page:
        try:
            _add_evidence(result, clean, Path(path))
        except Exception as e:                       # evidence is a convenience: never fail the analysis for it
            result["evidence_error"] = str(e)
    return result


def _add_evidence(result: dict, clean, path: Path) -> None:
    """Locate each matched line on the cleaned page with Tesseract's word boxes and save that page."""
    import cv2
    data = pytesseract.image_to_data(clean, config="--psm 6", output_type=pytesseract.Output.DICT)
    groups = {}
    for i, word in enumerate(data["text"]):
        if not word.strip():
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        g = groups.setdefault(key, {"words": [], "x1": 10**9, "y1": 10**9, "x2": 0, "y2": 0})
        g["words"].append(word)
        g["x1"] = min(g["x1"], data["left"][i]); g["y1"] = min(g["y1"], data["top"][i])
        g["x2"] = max(g["x2"], data["left"][i] + data["width"][i]); g["y2"] = max(g["y2"], data["top"][i] + data["height"][i])
    lines = [(_norm(" ".join(g["words"])), g) for g in groups.values()]
    for r in result["results"] + ([{"raw_line": result.get("visual_text"), "_visual": True}] if result.get("visual_text") else []):
        if not r.get("raw_line"):
            continue
        want = _norm(r["raw_line"])
        score, g = max(((difflib.SequenceMatcher(None, want, t).ratio(), g) for t, g in lines), key=lambda x: x[0], default=(0, None))
        if g is not None and score >= 0.6:
            box = [g["x1"], g["y1"], g["x2"] - g["x1"], g["y2"] - g["y1"]]
            if r.get("_visual"):
                result["visual_box"] = box
            else:
                r["box"] = box
    page = path.with_name(f"ocrpage_{path.stem}.png")
    ok, buf = cv2.imencode(".png", clean)
    if ok:
        buf.tofile(str(page))
        result["page_image"] = page.name
        result["page_size"] = [int(clean.shape[1]), int(clean.shape[0])]


def _read(clean, prep: dict, spec_id: str | None) -> dict:
    text = pytesseract.image_to_string(clean, config="--psm 6")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    header = _find_header(text)
    wanted = spec_id or header["specification"]
    specs = available_specs()
    if wanted not in specs:                              # misread or missing: use the closest known spec, and say so
        guess = difflib.get_close_matches(wanted or "", specs, n=1, cutoff=0.0)
        header["specification_note"] = f"read as '{wanted}', using {guess[0] if guess else specs[0]}"
        wanted = guess[0] if guess else specs[0]
    rules = load_rules(wanted)

    # Candidate rows: lines with an ISO method code
    candidates = []
    for idx, ln in enumerate(lines):
        # suffix ("-1", "-X12") must touch the number, so a value like "-1.7" after "ISO 5077" is not taken
        m = re.search(r"(?:[I1l|][Ss5][O0o]|18[O0o])\s*([0-9OIl]{3,5})(?:[-–]([A-Za-z0-9]{1,3})(?![.\d]))?", ln)
        if not m:
            continue
        key = _norm((m.group(1) + (m.group(2) or "")).replace("O", "0").replace("I", "1").replace("l", "1"))
        candidates.append((idx, ln, key, ln[:m.start()], ln[m.end():]))

    # Score every (rule, line) pair, then assign greedily, best first, one line per rule
    pairs = []
    for r in rules["requirements"]:
        rkey = _method_key(r["method"])
        want = _norm(r["property"] + r["direction"])
        for idx, ln, key, before, after in candidates:
            if key != rkey and difflib.SequenceMatcher(None, key, rkey).ratio() < 0.8:
                continue
            score = difflib.SequenceMatcher(None, _norm(before), want).ratio()
            if r["direction"] and r["direction"].lower() in before.lower():
                score += 0.3
            if r["direction"] and ({"warp": "weft", "weft": "warp"}[r["direction"].lower()] in before.lower()):
                score -= 0.5
            pairs.append((score, r["clause"], idx, after))
    coded = {c[0] for c in candidates}
    for r in rules["requirements"]:
        want = _norm(r["property"] + r["direction"])
        for idx, ln in enumerate(lines):
            if idx in coded:
                continue
            m = re.search(r"(" + NUM + r"(?:\s*[-/]\s*\d(?:\.5)?)?)\s*[^\w]*\s*(?:%|g/m2|threads|N\b|grade|blue|pH|Delta)", ln)
            if not m:
                continue
            score = difflib.SequenceMatcher(None, _norm(ln[:m.start()])[:len(want) + 6], want).ratio()
            if r["direction"] and r["direction"].lower() not in ln.lower():
                score -= 0.3
            if score >= 0.6:
                pairs.append((score - 0.05, r["clause"], idx, ln[m.start():]))
    used_lines, used_rules, chosen = set(), set(), {}
    for score, clause, idx, after in sorted(pairs, reverse=True):
        if clause in used_rules or idx in used_lines or score < 0.35:
            continue
        used_rules.add(clause); used_lines.add(idx); chosen[clause] = (after, lines[idx])

    results = []
    for r in rules["requirements"]:
        base = {k: r[k] for k in ("clause", "property", "direction", "method", "unit")}
        if r["clause"] not in chosen:
            results.append({**base, "found": False, "value": None, "status": "not found", "raw_line": None, "notes": []})
            continue
        after, raw_line = chosen[r["clause"]]
        value_text = re.split(r"(?i)g/m2|threads|delta|blue|grade|\bph\b|%|\bN\b", after, maxsplit=1)[0]
        value, status, notes = parse_value(value_text, r)
        results.append({**base, "found": True, "value": value, "status": status, "raw_line": raw_line.strip(), "notes": notes})

    return {"header": header, "results": results, "visual_text": _find_visual(lines),
            "preprocessing": prep, "ocr_engine": f"tesseract {pytesseract.get_tesseract_version()}"}
