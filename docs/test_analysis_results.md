# Test Analysis (OCR) and Compliance Check: First Results

Measured on 31 October 2026 on the 100 lab report images (44 flatbed scans, 26 photocopies, 30 phone photos),
compared with the answer key for each report. Engine: Tesseract 5 with our own preprocessing and checks.

## Pipeline

1. **Find the page** in phone photos and flatten it; try other page guesses if a first attempt reads poorly
2. **Straighten** the image (small rotations up to 3 degrees)
3. **Clean up**: remove shadows, photocopier specks and table lines
4. **OCR** with Tesseract
5. **Match rows to clauses** using the ISO method code and the test name; fall back to the test name if the code is unreadable
6. **Check each value** against its unit (plausible range, expected decimals); restore lost decimal points; flag anything doubtful for manual checking instead of guessing
7. **Compliance check in code** against the specification clauses; decision ACCEPT, REJECT or NOT VERIFIABLE

## Value extraction (1,754 test values)

| Capture | Exact | Wrong and not flagged | Missed |
|---|---|---|---|
| Flatbed scan | 97.9% | 0.8% | 0.0% |
| Phone photo | 92.9% | 1.0% | 4.2% |
| Photocopy | 88.8% | 4.0% | 1.8% |
| **All** | **94.1%** | **1.7%** | **1.7%** |

* Tests left out of a report were detected correctly in all 46 cases (no false rows).
* Report number read correctly in 99/100, sample ID in 83/100, visual inspection note in 92/100.

## Final decision (scan to decision, 100 reports)

| True decision | System said ACCEPT | NOT VERIFIABLE | REJECT |
|---|---|---|---|
| ACCEPT (64) | 34 | 24 | 6 |
| NOT VERIFIABLE (9) | 0 | 9 | 0 |
| REJECT (27) | **0** | 0 | 27 |

* **No rejected lot was accepted** (0 dangerous errors). Every REJECT was caught.
* Failed clauses matched the answer key in 93/100 reports.
* Most mismatches are cautious: one unreadable value makes the system ask for a manual check (NOT VERIFIABLE) instead of guessing. The AM and DM review step is where these are resolved.
* 6 acceptable lots were rejected because a value was misread without being flagged (mostly photocopies).

## Improvement steps measured

| Version | Change | Exact values |
|---|---|---|
| 1 | Basic cleanup and line removal | 83.1% |
| 2 | Speck removal, tolerant "ISO" matching, row fallback by test name, better page finding | 90.4% |
| 3 | Retry with other page guesses for phone photos | 94.1% |

## Next improvements

* Let the reviewer correct a flagged value in the interface
* Try PaddleOCR on photocopies and compare
* Read colour fastness grades more reliably on photocopies
