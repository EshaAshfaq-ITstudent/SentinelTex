"""Image cleanup before OCR: load, find the page in phone photos, straighten, remove table lines."""
from pathlib import Path

import cv2
import numpy as np

A4_W, A4_H = 1654, 2339   # A4 at 200 dpi


def load_image(path: str | Path) -> np.ndarray:
    """Return a BGR image. PDFs are rendered (first page). Works with non-English Windows paths."""
    path = Path(path)
    if path.suffix.lower() == ".pdf":
        import pypdfium2 as pdfium
        page = pdfium.PdfDocument(str(path))[0]
        rgb = np.array(page.render(scale=200 / 72).to_pil().convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not read image: {path.name}")
    return img


def _order_corners(pts: np.ndarray) -> np.ndarray:
    pts = pts.reshape(4, 2).astype(np.float32)
    s, d = pts.sum(axis=1), np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


def _looks_like_a4(quad: np.ndarray) -> bool:
    """Portrait page: height about 1.41 times width (allowing for perspective)."""
    tl, tr, br, bl = _order_corners(quad)
    w = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2
    h = (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2
    return w > 0 and 1.15 < h / w < 1.75


def _quad_from_mask(mask: np.ndarray, min_frac: float, max_frac: float):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total = mask.shape[0] * mask.shape[1]
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:3]:
        frac = cv2.contourArea(c) / total
        if not min_frac < frac < max_frac:
            continue
        hull = cv2.convexHull(c)
        for eps in (0.02, 0.03, 0.05):
            approx = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
            if len(approx) == 4 and _looks_like_a4(approx):
                return approx
    return None


def page_candidates(img: np.ndarray):
    """Yield possible flattened pages (best guess first), ending with the uncropped image.
    For phone photos the paper is cut out and flattened; for scans the image is used as it is."""
    h, w = img.shape[:2]
    scale = 1000 / max(h, w)
    small = cv2.resize(img, (int(w * scale), int(h * scale)))
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (7, 7), 0)
    masks = []
    # Grow a region from the centre (always paper) over the text-free, blurred image; it stops at the paper edge
    soft = cv2.medianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), 21)
    ff = np.zeros((soft.shape[0] + 2, soft.shape[1] + 2), np.uint8)
    cv2.floodFill(soft.copy(), ff, (soft.shape[1] // 2, soft.shape[0] // 2), 255, 3, 3,
                  4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
    masks.append(cv2.morphologyEx(ff[1:-1, 1:-1], cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)))
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    masks.append(cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)))
    bright = np.percentile(gray, 80)                       # paper is the brightest large area
    masks.append(cv2.morphologyEx((gray > bright - 25).astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8)))
    edges = cv2.dilate(cv2.Canny(gray, 30, 90), np.ones((5, 5), np.uint8))
    filled = edges.copy()
    cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, cnts, -1, 255, -1)
    masks.append(filled)
    for tol in (2, 5):                                    # stricter and looser region growing
        ff2 = np.zeros_like(ff)
        cv2.floodFill(soft.copy(), ff2, (soft.shape[1] // 2, soft.shape[0] // 2), 255, tol, tol,
                      4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
        masks.append(cv2.morphologyEx(ff2[1:-1, 1:-1], cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)))
    seen = []
    for m in masks:
        quad = _quad_from_mask(m, 0.35, 0.93)
        if quad is None:
            continue
        src = _order_corners(quad) / scale
        if any(np.abs(src - q).max() < 15 for q in seen):  # same corners as an earlier candidate
            continue
        seen.append(src)
        dst = np.array([[0, 0], [A4_W - 1, 0], [A4_W - 1, A4_H - 1], [0, A4_H - 1]], dtype=np.float32)
        yield cv2.warpPerspective(img, cv2.getPerspectiveTransform(src, dst), (A4_W, A4_H)), True
    yield img, False


def deskew(gray: np.ndarray) -> tuple[np.ndarray, float]:
    """Find the small rotation (up to 3 degrees) that makes text rows most horizontal."""
    small = cv2.resize(gray, None, fx=0.35, fy=0.35)
    bw = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    best, best_angle = -1.0, 0.0
    for angle in np.arange(-3.0, 3.01, 0.25):
        M = cv2.getRotationMatrix2D((bw.shape[1] / 2, bw.shape[0] / 2), angle, 1.0)
        rows = cv2.warpAffine(bw, M, (bw.shape[1], bw.shape[0])).sum(axis=1).astype(np.float64)
        score = rows.var()
        if score > best:
            best, best_angle = score, angle
    if abs(best_angle) < 0.1:
        return gray, 0.0
    M = cv2.getRotationMatrix2D((gray.shape[1] / 2, gray.shape[0] / 2), best_angle, 1.0)
    return cv2.warpAffine(gray, M, (gray.shape[1], gray.shape[0]), borderValue=255), float(best_angle)


def _remove_specks(gray: np.ndarray) -> np.ndarray:
    """Delete tiny isolated dark dots (photocopier toner) that OCR reads as stray characters.
    A dot is removed only if it is small, round AND has no ink nearby, so minus signs and decimal points stay."""
    bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    n, labels, stats, _ = cv2.connectedComponentsWithStats(bw, 8)
    small = np.zeros(n, bool)
    w, h = stats[1:, cv2.CC_STAT_WIDTH], stats[1:, cv2.CC_STAT_HEIGHT]
    roundish = (w <= 2 * h) & (h <= 2 * w)                   # a minus sign is wide and flat, so it is kept
    small[1:] = (stats[1:, cv2.CC_STAT_AREA] <= 30) & roundish
    big_ink = np.isin(labels, np.where(~small)[0]) & (labels > 0)
    near_ink = cv2.dilate(big_ink.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    specks = small[labels] & ~near_ink
    out = gray.copy()
    out[specks] = 255
    return out


def remove_lines(gray: np.ndarray) -> np.ndarray:
    """Erase ruled table lines, which confuse OCR, and even out the background."""
    bg = cv2.medianBlur(gray, 41)
    flat = cv2.divide(gray, bg, scale=255)                      # removes shadows and paper tint
    flat = _remove_specks(flat)
    bw = cv2.adaptiveThreshold(flat, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    w = gray.shape[1]
    horiz = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, w // 30), 1)))
    vert = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(40, w // 40))))
    lines = cv2.dilate(horiz | vert, np.ones((3, 3), np.uint8))
    out = flat.copy()
    out[lines > 0] = 255
    return out


def clean_page(img: np.ndarray, cropped: bool) -> tuple[np.ndarray, dict]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if gray.shape[1] < 1400:                                      # small phone images: enlarge for OCR
        f = 1654 / gray.shape[1]
        gray = cv2.resize(gray, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
    gray, angle = deskew(gray)
    return remove_lines(gray), {"page_cropped": cropped, "skew_corrected_deg": round(angle, 2)}


def prepare_variants(path: str | Path):
    """Yield (clean image, info) for each page candidate, best guess first."""
    img = load_image(path)
    for i, (page, cropped) in enumerate(page_candidates(img)):
        clean, info = clean_page(page, cropped)
        info["attempt"] = i + 1
        yield clean, info


def prepare(path: str | Path) -> tuple[np.ndarray, dict]:
    return next(prepare_variants(path))
