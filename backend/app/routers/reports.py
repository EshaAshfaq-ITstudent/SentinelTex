"""Quality Assessment Reports and the AM / DM approval workflow."""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import QualityReport, ReportStatus, Review, Role, User
from ..compliance.checker import assess
from ..ocr.extract import extract_report, load_rules
from ..schemas import ReportOut, ReviewIn
from ..vision.detect import ModelUnavailable, analyse_images
from ..rag import explain as rag_explain
from ..security import get_current_user, require_roles
from .samples import get_sample_or_404

router = APIRouter(tags=["Quality Assessment Reports"])


def run_analysis(sample) -> tuple[str, str, dict]:
    """Run every connected module on the sample's files and combine the results.

    Connected: Image Analysis (YOLO on the fabric photos), Test Analysis (OCR of the lab report)
    compliance checking against the specification, and a clause based explanation (LLM version via /explain).
    """
    images = [f for f in sample.files if f.kind == "image"]
    lab_reports = [f for f in sample.files if f.kind == "lab_report"]
    details = {"images": [f.original_name for f in images], "lab_reports": [f.original_name for f in lab_reports],
               "image_analysis": None, "test_analysis": None, "compliance": None, "llm_explanation": None}
    rules = load_rules(sample.specification)

    ocr = None
    if lab_reports:
        latest = max(lab_reports, key=lambda f: f.uploaded_at)
        try:
            ocr = extract_report(latest.stored_path, spec_id=sample.specification)
            ocr["file"] = latest.original_name
            details["test_analysis"] = ocr
        except Exception as e:                     # unreadable file: report it, do not crash the request
            details["test_analysis"] = {"error": f"Could not read {latest.original_name}: {e}"}

    image_defects = None
    if images:
        try:
            vision = analyse_images([(f.stored_path, f.original_name) for f in images])
            details["image_analysis"] = vision
            image_defects = vision["defects"]
        except ModelUnavailable as e:              # no trained model yet: say so, keep going
            details["image_analysis"] = {"skipped": str(e)}

    result = assess(rules, ocr["results"] if ocr else None, ocr["visual_text"] if ocr else None, image_defects)
    details["compliance"] = result
    try:   # quick explanation with clause text from ChromaDB; the LLM version is made on request (/explain)
        details["llm_explanation"] = rag_explain.explain(result, sample.specification, use_llm=False)
    except Exception as e:
        details["llm_explanation"] = {"text": f"Explanation not available: {e}", "method": "none", "sources": []}
    passed = sum(1 for c in result["checks"] if c["result"] == "PASS")
    summary = (f"Decision {result['decision']}. {passed} checks passed, "
               f"{len(result['failed_clauses'])} failed ({', '.join(result['failed_clauses']) or 'none'}), "
               f"{len(result['unverified_clauses'])} need manual checking or were not reported.")
    if image_defects is not None:
        found = ", ".join(f"{d['count']} {d['defect']}" for d in image_defects) or "no defects"
        summary += f" Image Analysis found {found}."
    elif images:
        summary += " Image Analysis skipped (no trained model)."
    if not lab_reports:
        summary += " No lab report uploaded."
    return result["decision"], summary, details


@router.post("/samples/{sample_code}/analyze", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def analyze_sample(sample_code: str, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(Role.LAB_ANALYST))):
    sample = get_sample_or_404(db, sample_code)
    if not sample.files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload at least one image or lab report first")
    latest = max(sample.reports, key=lambda r: r.version, default=None)
    if latest and latest.status in (ReportStatus.PENDING_AM, ReportStatus.PENDING_DM):
        raise HTTPException(status.HTTP_409_CONFLICT, "A report for this sample is already waiting for review")
    if latest and latest.status == ReportStatus.APPROVED:
        raise HTTPException(status.HTTP_409_CONFLICT, "This sample already has a final approved report")
    decision, summary, details = run_analysis(sample)
    report = QualityReport(sample_id=sample.id, version=(latest.version + 1) if latest else 1,
                           status=ReportStatus.PENDING_AM, decision=decision, summary=summary,
                           details_json=json.dumps(details))
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports", response_model=list[ReportOut])
def list_reports(status_filter: ReportStatus | None = None, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    """AM dashboard: ?status_filter=pending_am   DM dashboard: ?status_filter=pending_dm"""
    query = select(QualityReport).order_by(QualityReport.created_at.desc())
    if status_filter:
        query = query.where(QualityReport.status == status_filter)
    return db.scalars(query).all()


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    report = db.get(QualityReport, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return report


@router.post("/reports/{report_id}/review", response_model=ReportOut)
def review_report(report_id: int, body: ReviewIn, db: Session = Depends(get_db),
                  user: User = Depends(require_roles(Role.AM, Role.DM))):
    report = db.get(QualityReport, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    expected = ReportStatus.PENDING_AM if user.role == Role.AM else ReportStatus.PENDING_DM
    if report.status != expected:
        who = "Assistant Manager" if user.role == Role.AM else "Deputy Manager"
        raise HTTPException(status.HTTP_409_CONFLICT, f"Report is '{report.status.value}', not waiting for the {who}")
    if not body.approve and not body.comment.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Give a reason when rejecting a report")
    db.add(Review(report_id=report.id, reviewer_id=user.id, role=user.role, approved=body.approve, comment=body.comment))
    if not body.approve:
        report.status = ReportStatus.RETURNED          # either rejection sends it back for re-analysis
    elif user.role == Role.AM:
        report.status = ReportStatus.PENDING_DM
    else:
        report.status = ReportStatus.APPROVED          # both AM and DM have approved
    db.commit()
    db.refresh(report)
    return report
