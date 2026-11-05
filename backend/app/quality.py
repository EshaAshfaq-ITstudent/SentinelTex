"""Upload quality check: warns the Lab Analyst about a photo or scan that is too blurry, too dark or too small
before it is analysed. It only warns; it never blocks an upload.

Thresholds were measured on the project files (5 Nov 2026):
* Lab report scans: sharpness of the 100 real scans was 412 or more. A scan blurred to sharpness 189 still
  opened, but the OCR read only 6 of 18 values (0 of 18 at 57). So a scan below 300 gets a warning.
* Fabric photos: the 82 real uniform photos were 38 or more (smooth close ups score low), so photos warn below 25.
Sharpness = variance of the Laplacian on the image scaled to 1000 px on its long side.
"""
import json
from pathlib import Path

import cv2
import numpy as np

from .ocr.preprocess import load_image

LIMITS = {
    "lab_report": {"sharp": 300, "min_side": 1000, "dark": 90, "bright": 250},
    "image": {"sharp": 25, "min_side": 480, "dark": 40, "bright": 235},
}


def measure(path: str | Path, kind: str) -> dict:
    lim = LIMITS[kind]
    gray = cv2.cvtColor(load_image(path), cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    scale = 1000 / max(h, w)
    small = cv2.resize(gray, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
    sharp = float(cv2.Laplacian(small, cv2.CV_64F).var())
    bright = float(small.mean())
    what = "scan" if kind == "lab_report" else "photo"
    warnings = []
    if sharp < lim["sharp"]:
        warnings.append(f"The {what} looks blurry" + (", so the OCR may miss values. Scan it again if you can." if kind == "lab_report"
                                                    else ". Defects may be missed. Take it again with the camera held still."))
    if min(h, w) < lim["min_side"]:
        warnings.append(f"The {what} is small ({w} x {h} pixels). Use at least {lim['min_side']} pixels on the short side.")
    if bright < lim["dark"]:
        warnings.append(f"The {what} is too dark. Use more light.")
    elif bright > lim["bright"]:
        warnings.append(f"The {what} is almost blank or too bright.")
    return {"ok": not warnings, "warnings": warnings, "sharpness": round(sharp, 1), "brightness": round(bright, 1),
            "width": w, "height": h}


def sidecar(stored_path: str | Path) -> Path:
    p = Path(stored_path)
    return p.with_name(p.name + ".quality.json")


def check_and_save(stored_path: str | Path, kind: str) -> dict:
    try:
        result = measure(stored_path, kind)
    except Exception as e:                   # an unreadable file is reported, not fatal
        result = {"ok": False, "warnings": [f"The file could not be opened as an image: {e}"]}
    sidecar(stored_path).write_text(json.dumps(result), encoding="utf-8")
    return result


def load(stored_path: str | Path) -> dict | None:
    try:
        return json.loads(sidecar(stored_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
