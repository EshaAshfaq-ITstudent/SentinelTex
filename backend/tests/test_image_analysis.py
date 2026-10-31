"""Image Analysis test: runs the trained model on one fabric photo.

Run from the backend folder after putting best.pt in SentinelTex\\models:
    python tests\\test_image_analysis.py
    python tests\\test_image_analysis.py path\\to\\photo.jpg
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.vision.detect import detect, model_status  # noqa: E402

DEFAULT = "../data/images/sentineltex_dataset_v1/images/test"
status = model_status()
print("Model:", json.dumps(status))
if not status["available"]:
    sys.exit("Image Analysis test skipped: " + status["reason"])

target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT)
photos = sorted(target.glob("*.jpg"))[:5] if target.is_dir() else [target]
assert photos, f"No photos found at {target}"
for p in photos:
    r = detect(p, save_annotated=False)
    print(f"{p.name}: {r['defects_found']} defect(s) {r['counts']}")
    for b in r["boxes"]:
        assert 0 <= b["confidence"] <= 1 and len(b["box"]) == 4
print("Image analysis test passed")
