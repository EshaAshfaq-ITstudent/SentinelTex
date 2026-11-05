"""Samples and file uploads (Lab Analyst)."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import ALLOWED_IMAGE_TYPES, ALLOWED_REPORT_TYPES, MAX_UPLOAD_MB, UPLOAD_DIR
from ..database import get_db
from ..models import QualityReport, ReportStatus, Role, Sample, SampleFile, User
from ..quality import check_and_save, sidecar
from ..schemas import FileOut, SampleCreate, SampleOut
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/samples", tags=["Samples"])
analyst_only = require_roles(Role.LAB_ANALYST)


def get_sample_or_404(db: Session, sample_code: str) -> Sample:
    sample = db.scalar(select(Sample).where(Sample.sample_code == sample_code))
    if sample is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Sample {sample_code} not found")
    return sample


@router.post("", response_model=SampleOut, status_code=status.HTTP_201_CREATED)
def create_sample(body: SampleCreate, db: Session = Depends(get_db), user: User = Depends(analyst_only)):
    if db.scalar(select(Sample).where(Sample.sample_code == body.sample_code)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Sample {body.sample_code} already exists")
    sample = Sample(**body.model_dump(), created_by=user.id)
    db.add(sample)
    db.commit()
    db.refresh(sample)
    return sample


@router.get("", response_model=list[SampleOut])
def list_samples(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Sample).order_by(Sample.created_at.desc())).all()


@router.get("/{sample_code}", response_model=SampleOut)
def get_sample(sample_code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_sample_or_404(db, sample_code)


def _save_upload(sample: Sample, upload: UploadFile, kind: str, allowed: set[str], user: User, db: Session) -> SampleFile:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"File type {suffix or '(none)'} not allowed. Use: {', '.join(sorted(allowed))}")
    data = upload.file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File is larger than {MAX_UPLOAD_MB} MB")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is empty")
    folder = UPLOAD_DIR / sample.sample_code
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{kind}_{uuid.uuid4().hex[:12]}{suffix}"   # never trust the uploaded file name as a path
    stored.write_bytes(data)
    record = SampleFile(sample_id=sample.id, kind=kind, original_name=Path(upload.filename).name[:200],
                        stored_path=str(stored), uploaded_by=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    check_and_save(stored, kind)          # blur, darkness and size warnings for the analyst
    return record


@router.post("/{sample_code}/image", response_model=FileOut, status_code=status.HTTP_201_CREATED)
def upload_image(sample_code: str, file: UploadFile = File(...), db: Session = Depends(get_db),
                 user: User = Depends(analyst_only)):
    return _save_upload(get_sample_or_404(db, sample_code), file, "image", ALLOWED_IMAGE_TYPES, user, db)


@router.post("/{sample_code}/lab-report", response_model=FileOut, status_code=status.HTTP_201_CREATED)
def upload_lab_report(sample_code: str, file: UploadFile = File(...), db: Session = Depends(get_db),
                      user: User = Depends(analyst_only)):
    return _save_upload(get_sample_or_404(db, sample_code), file, "lab_report", ALLOWED_REPORT_TYPES, user, db)


@router.get("/files/{file_id}", tags=["Samples"])
def download_file(file_id: int, annotated: bool = False, ocr_page: bool = False, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """Any logged in user can view an uploaded file. annotated=true gives the photo with defect boxes, if made;
    ocr_page=true gives the cleaned lab report page the OCR read (for the evidence view)."""
    record = db.get(SampleFile, file_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    path = Path(record.stored_path)
    if annotated:
        boxed = path.with_name(f"annotated_{path.stem}.jpg")
        if boxed.exists():
            path = boxed
    if ocr_page:
        page = path.with_name(f"ocrpage_{path.stem}.png")
        if not page.exists():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No OCR page saved for this file (analyse it again)")
        path = page
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File is missing on disk")
    return FileResponse(path)


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: int, db: Session = Depends(get_db), user: User = Depends(analyst_only)):
    """Remove a bad upload (for example a blurry photo) before it is used. A file that a report already sent for
    review was based on cannot be removed, so every submitted report keeps its evidence."""
    record = db.get(SampleFile, file_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    submitted = [r for r in record.sample.reports if r.status != ReportStatus.DRAFT]
    if any(r.created_at >= record.uploaded_at for r in submitted if r.created_at and record.uploaded_at):
        raise HTTPException(status.HTTP_409_CONFLICT, "This file was used in a report already sent for review, so it is kept")
    path = Path(record.stored_path)
    for p in (path, sidecar(path), path.with_name(f"annotated_{path.stem}.jpg"), path.with_name(f"ocrpage_{path.stem}.png")):
        p.unlink(missing_ok=True)
    db.delete(record)
    db.commit()
