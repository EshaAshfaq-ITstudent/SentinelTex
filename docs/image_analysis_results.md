# Image Analysis results

## v1 (YOLOv8s, our dataset only)

Trained on Kaggle (Tesla T4), 640 px, seed 0. Numbers copied from the notebook output (2 Nov 2026).
Retraining with the same data and seed gave identical numbers.

| Set | Contents | Precision | Recall | mAP50 | mAP50-95 |
|---|---|---|---|---|---|
| Validation | 68 images: 40 synthetic, 28 real | 0.937 | 0.760 | 0.823 | 0.659 |
| Test | 58 real camo photos only | 0.187 | 0.125 | 0.089 | 0.048 |

Test per class (mAP50): stain 0.267, spot 0.090, tear 0.0, loose_thread 0.0.
The test set has no discoloration or pattern_defect photos.

Image level on test (cutoff 0.25): 11 of 28 defective photos flagged, 17 missed; 2 of 30 clean photos wrongly flagged, 28 passed.

**Finding:** a large synthetic to real gap. The training set had no real tear photos and only 8 real loose thread
photos, so the model learned the look of the generated defects. The high validation score comes from the synthetic
validation images and must not be reported as real world accuracy.

**Design response:** a defect found only by the image model is marked CHECK MANUALLY for the Assistant Manager
and cannot reject a lot by itself (backend/app/compliance/checker.py, tested in tests/test_compliance_rules.py).

## v2 (adds real public fabric defect photos)

Notebook: notebooks/sentineltex_yolo_training_v2.ipynb. Same unchanged real test set as v1.
Public data: Fabric Stain Dataset (CC0 1.0) and FabriD (CC BY 4.0, Mendeley Data, dataset vncdwps24r).
Results: to be added from metrics_v2.json after the Kaggle run.
