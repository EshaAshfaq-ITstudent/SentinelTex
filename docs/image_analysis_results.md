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

## v3 (next): v2 setup plus the public datasets

Same notebook, with the Fabric Stain Dataset (CC0 1.0) and FabriD (CC BY 4.0, Mendeley Data, vncdwps24r) actually
added as inputs. Check the notebook's step 3 and 4 output: every public dataset must show its image counts.
