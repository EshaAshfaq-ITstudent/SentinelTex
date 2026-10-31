"""Image Analysis: find fabric defects in a photo with the trained YOLO model.

The model file (models/best.pt) comes from the Kaggle training notebook. If it is missing, or the
ultralytics library is not installed, analysis still runs and reports that image analysis was skipped.
"""
from collections import Counter
from functools import lru_cache
from pathlib import Path

from ..config import DETECT_CONF, MODEL_PATH


class ModelUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _model():
    if not MODEL_PATH.exists():
        raise ModelUnavailable(f"No trained model at {MODEL_PATH}. Put best.pt from the Kaggle run in the models folder.")
    try:
        from ultralytics import YOLO          # heavy import, only when needed
    except ImportError as e:
        raise ModelUnavailable("The ultralytics library is not installed (pip install -r backend/requirements.txt)") from e
    return YOLO(str(MODEL_PATH))


def model_status() -> dict:
    try:
        m = _model()
        return {"available": True, "model": MODEL_PATH.name, "classes": list(m.names.values())}
    except ModelUnavailable as e:
        return {"available": False, "reason": str(e)}


def detect(image_path: str | Path, save_annotated: bool = True) -> dict:
    """Run the detector on one photo. Returns every box, counts per defect, and the annotated image path."""
    import cv2
    import numpy as np

    image_path = Path(image_path)
    img = cv2.imdecode(np.fromfile(str(image_path), dtype=np.uint8), cv2.IMREAD_COLOR)   # works with any Windows path
    if img is None:
        raise ValueError(f"Could not open image {image_path.name}")
    model = _model()
    res = model.predict(img, conf=DETECT_CONF, imgsz=640, verbose=False)[0]
    boxes = []
    for b in res.boxes:
        x1, y1, x2, y2 = (round(float(v)) for v in b.xyxy[0])
        boxes.append({"defect": model.names[int(b.cls)], "confidence": round(float(b.conf), 3),
                      "box": [x1, y1, x2, y2]})
    out = {"file": image_path.name, "defects_found": len(boxes), "boxes": boxes,
           "counts": dict(Counter(b["defect"] for b in boxes)), "confidence_threshold": DETECT_CONF}
    if save_annotated:
        annotated = image_path.with_name(f"annotated_{image_path.stem}.jpg")
        ok, buf = cv2.imencode(".jpg", res.plot())
        if ok:
            buf.tofile(str(annotated))
            out["annotated_path"] = str(annotated)
    return out


def analyse_images(paths: list[tuple[str, str]]) -> dict:
    """paths: (stored_path, original_name). Combines all photos of a sample.

    For each defect type the sample count is the highest count seen in any one photo, so the same
    defect photographed twice is not counted twice.
    """
    per_image, combined = [], Counter()
    for stored, original in paths:
        try:
            r = detect(stored)
            r["file"] = original
            per_image.append(r)
            for k, v in r["counts"].items():
                combined[k] = max(combined[k], v)
        except ModelUnavailable:
            raise
        except Exception as e:                       # one bad photo should not stop the analysis
            per_image.append({"file": original, "error": str(e)})
    return {"images": per_image, "defects": [{"defect": k, "count": v} for k, v in combined.items()]}
