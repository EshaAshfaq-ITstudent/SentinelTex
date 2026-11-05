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

## v2 (run 3 Nov 2026): our data only, new training setup

Notebook: notebooks/sentineltex_yolo_training_v2.ipynb. Results files: docs/image_results_v2/.
**The public datasets were not loaded in this run** (dataset_v2_composition.json lists only our images), so v2 tests
the new training setup alone: real defect photos repeated 3 times, synthetic validation images moved into training,
model chosen on real validation photos only, confidence cutoff chosen on validation. Test set unchanged from v1.

| Set | Precision | Recall | mAP50 | mAP50-95 |
|---|---|---|---|---|
| Validation (28 real photos, 8 spot boxes) | 0.788 | 0.375 | 0.471 | n/a |
| Test (58 real camo photos, same as v1) | 0.340 | 0.062 | 0.108 | 0.052 |

Test per class (mAP50): stain 0.219, spot 0.209, tear 0.0, loose_thread 0.005.

Image level on test (is a photo flagged as defective?):

| Cutoff | Defects found | Missed | Clean flagged wrongly | Clean passed | F1 |
|---|---|---|---|---|---|
| 0.10 (chosen on validation) | 20 of 28 | 8 | 3 of 30 | 27 | 0.784 |
| 0.25 (same as v1) | 7 of 28 | 21 | 1 of 30 | 29 | 0.389 |

**Reading:** box level accuracy barely moved (mAP50 0.089 to 0.108); tears and loose threads are still not found.
The better image level result comes mainly from the lower cutoff, which was chosen on validation, not on test.
v1 was not measured at cutoff 0.10, so the two image level results are not directly comparable.
The validation set is very small (8 boxes, spots only), so model selection on it is weak.

## v3 (run 4 to 5 Nov 2026, final): v2 setup plus public photos

Notebook: notebooks/sentineltex_yolo_training_v2.ipynb (fixed to find datasets in nested Kaggle folders).
Results files: docs/image_results_v3/. Test set unchanged (58 real camo photos).

**What the public data added:** 80 FabriD photos and 68 Fabric Stain Dataset photos (train and validation).
The defect box counts in training are exactly the same as v2, so **all of these were defect free photos**: the
labelled defect photos of both datasets were not read (their label format was not recognised by the notebook).
v3 therefore adds real clean fabric photos from other sources, not real tear or loose thread examples.

| Set | Precision | Recall | mAP50 | mAP50-95 |
|---|---|---|---|---|
| Validation (50 photos: 28 ours + 22 public, 8 spot boxes) | 0.105 | 0.500 | 0.066 | 0.019 |
| Test (58 real camo photos, same as v1 and v2) | 0.535 | 0.166 | 0.141 | 0.059 |

Test per class (mAP50): stain 0.441, spot 0.122, tear 0.0, loose_thread 0.0.

Image level on test (is a photo flagged as defective?):

| Cutoff | Defects found | Missed | Clean flagged wrongly | Clean passed | F1 |
|---|---|---|---|---|---|
| 0.05 (chosen on validation) | 23 of 28 | 5 | 1 of 30 | 29 | 0.885 |
| 0.25 (same as v1) | 4 of 28 | 24 | 0 of 30 | 30 | 0.250 |

## Comparison and reading (for the report)

| Version | Training data | Test mAP50 | Stain mAP50 | Photos flagged correctly (cutoff chosen on validation) |
|---|---|---|---|---|
| v1 | ours (mostly synthetic defects) | 0.089 | 0.267 | not measured at a validation chosen cutoff |
| v2 | ours, real defect photos repeated 3 times, model chosen on real validation | 0.108 | 0.219 | 20 of 28, 3 false alarms (cutoff 0.10) |
| v3 | v2 plus defect free public photos | 0.141 | 0.441 | 23 of 28, 1 false alarm (cutoff 0.05) |

* The model is useful as a **photo level screening aid**: with the validated cutoff it flags 23 of 28 defective
  real photos with 1 false alarm out of 30 clean ones.
* It **cannot locate or name every defect**: tears and loose threads are still not found (mAP50 0.0), because the
  training set has no real photos of them. Stains improved most.
* This is why the system marks a defect found only by the model as **CHECK MANUALLY** for the reviewer, and the
  backend uses the validated cutoff 0.05 (backend/app/config.py, SENTINELTEX_DETECT_CONF).
* The validation set is small (8 boxes), so the chosen cutoff is uncertain; more real defect photos are the
  main next step (future work).
