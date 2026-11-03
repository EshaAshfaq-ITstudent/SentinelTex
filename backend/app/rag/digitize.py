"""Specification digitisation (Objective 2): scanned specification pages -> OCR -> clause chunks.

Each chunk is one clause (or one test method line) with its section, so retrieval returns a citable unit.
The result is saved as JSON (app/knowledge/<spec>_digitized.json) so a person can review exactly what
went into the knowledge base before it is indexed.
"""
import json
import re
from pathlib import Path

import pytesseract

from ..ocr import extract as _extract  # noqa: F401  (importing it applies SENTINELTEX_TESSERACT)
from ..ocr.preprocess import prepare

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"

CLAUSE_START = re.compile(r"^(\d)\s?[.,]\s?(\d{1,2}[ab]?)\s+(.*)$")        # 3.5a ..., "1,1 ..."
CLAUSE_NO_DOT = re.compile(r"^([1-6])(\d)\s+([A-Z].*)$")                   # OCR dropped the dot: "42 Pattern ..."
SECTION = re.compile(r"^(\d)\s?[.,]?\s+([A-Z][A-Z ,&]{3,})$")               # "4, VISUAL INSPECTION"
METHOD = re.compile(r"^(ISO\s?[\dA-Z][\w-]*(?:-\d+)?)\s+(.*)$")
STOP = re.compile(r"RECORD OF AMENDMENTS", re.I)
SKIP = re.compile(r"^(TABLE \d|Clause\b|SENTINEL TEXTILE|Textile Testing and Quality|Specification No\.|SPECIFICATION$)", re.I)

FIXES = [  # common OCR slips in this document's vocabulary
    (r"threads/c[e]?m\b|threads/em\b|threads/cem\b", "threads/cm"),
    (r"(\d)\s?t0\s?(\d)", r"\1 to \2"),
    (r"\s%o\b", " %"),
    (r"Not more than \|", "Not more than 1"),
    (r"\s+", " "),
]


def ocr_pages(scan_paths: list[str | Path]) -> list[str]:
    pages = []
    for p in scan_paths:
        gray, _info = prepare(p)
        pages.append(pytesseract.image_to_string(gray, config="--psm 4"))
    return pages


def _clean(line: str) -> str:
    for pat, rep in FIXES:
        line = re.sub(pat, rep, line)
    return line.strip(" -—_|")


def chunk_pages(pages: list[str], spec_id: str) -> list[dict]:
    chunks, current, section = [], None, ""
    stopped = False
    for page_no, text in enumerate(pages, 1):
        for raw in text.splitlines():
            line = _clean(raw)
            if not line or stopped:
                continue
            if STOP.search(line):
                stopped = True
                continue
            if SKIP.match(line):
                continue
            m_sec = SECTION.match(line)
            if m_sec:
                section = f"{m_sec.group(1)} {m_sec.group(2).title().strip()}"
                current = None
                continue
            m = CLAUSE_START.match(line) or CLAUSE_NO_DOT.match(line)
            m_iso = METHOD.match(line)
            if m:
                clause = f"{m.group(1)}.{m.group(2)}"
                current = {"clause": clause, "section": section, "page": page_no, "body": m.group(3)}
                chunks.append(current)
            elif m_iso and section.startswith("2"):
                current = {"clause": "2.1", "section": section, "page": page_no, "method": m_iso.group(1).replace("ISO", "ISO "),
                           "body": f"{m_iso.group(1)} {m_iso.group(2)}"}
                current["method"] = re.sub(r"ISO\s+", "ISO ", current["method"])
                chunks.append(current)
            elif current is not None and len(line) > 2 and not re.fullmatch(r"[\W\d ]+", line):
                current["body"] += " " + line          # continuation of the clause above
            elif section == "" and line:
                pass                                     # title block before Section 1
    # test method titles go into the table rows that use them, and the method list becomes one chunk
    titles = {re.sub(r"\s+", " ", c["method"]): c["body"] for c in chunks if "method" in c}
    methods = [c for c in chunks if "method" in c]
    chunks = [c for c in chunks if "method" not in c]
    if methods:
        chunks.insert(next((i for i, c in enumerate(chunks) if c["clause"] > "2.1"), len(chunks)),
                      {"clause": "2.1", "section": methods[0]["section"], "page": methods[0]["page"],
                       "body": "Test methods: " + "; ".join(m["body"] for m in methods)})
    for c in chunks:
        for code, title in sorted(titles.items(), key=lambda kv: -len(kv[0])):
            if re.search(re.escape(code) + r"(?![\d-])", c["body"]) and c["clause"].startswith("3."):
                c["body"] += f" (test method {title})"
                break
    out = []
    for i, c in enumerate(chunks):
        body = re.sub(r"\s+", " ", c["body"]).strip()
        kind = "method" if "method" in c else ("table_row" if re.match(r"^[34]\.([1-9]|1[0-2])[ab]?$", c["clause"]) else "clause")
        label = f"{spec_id}, section {c['section']}, clause {c['clause']}"
        if kind == "table_row" and c["section"].startswith("3"):
            label += " (Table 1 columns: characteristic, direction, method, unit, requirement)"
        if kind == "table_row" and c["section"].startswith("4"):
            label += " (Table 2 columns: defect, requirement, class)"
        out.append({"id": f"{spec_id}#{i:03d}", "spec": spec_id, "clause": c["clause"], "section": c["section"],
                    "page": c["page"], "kind": kind, "text": f"{label}: {body}"})
    return out


def digitize(spec_id: str, scan_paths: list[str | Path]) -> Path:
    chunks = chunk_pages(ocr_pages(scan_paths), spec_id)
    path = KNOWLEDGE_DIR / f"{spec_id.replace('/', '-')}_digitized.json"
    path.write_text(json.dumps({"spec": spec_id, "source_scans": [Path(p).name for p in scan_paths],
                                "chunks": chunks}, indent=1, ensure_ascii=False), encoding="utf-8")
    return path


def load_digitized(spec_id: str) -> list[dict]:
    path = KNOWLEDGE_DIR / f"{spec_id.replace('/', '-')}_digitized.json"
    return json.loads(path.read_text(encoding="utf-8"))["chunks"]
