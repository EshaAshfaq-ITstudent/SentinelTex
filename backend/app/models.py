"""Database tables.

Approval workflow (from the proposal):
    Lab Analyst runs analysis -> report DRAFT (the analyst checks what was read; may re-upload and run again)
    Lab Analyst sends it for review -> PENDING_AM
    AM approves -> PENDING_DM            AM rejects -> RETURNED (re-analysis)
    DM approves -> APPROVED (final)      DM rejects -> RETURNED (re-analysis)
    Lab Analyst re-runs analysis on a RETURNED report -> PENDING_AM again
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    LAB_ANALYST = "lab_analyst"
    AM = "am"   # Assistant Manager
    DM = "dm"   # Deputy Manager


class ReportStatus(str, enum.Enum):
    DRAFT = "draft"                      # analysed, checked by the analyst before it goes to the AM
    PENDING_AM = "pending_am"
    PENDING_DM = "pending_dm"
    APPROVED = "approved"
    RETURNED = "returned_for_reanalysis"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(Enum(Role))


class Sample(Base):
    __tablename__ = "samples"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)  # e.g. ST-0080
    specification: Mapped[str] = mapped_column(String(30), default="STS/UC/01")
    description: Mapped[str] = mapped_column(String(200), default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    files: Mapped[list["SampleFile"]] = relationship(back_populates="sample", cascade="all, delete-orphan")
    reports: Mapped[list["QualityReport"]] = relationship(back_populates="sample", cascade="all, delete-orphan")


class SampleFile(Base):
    __tablename__ = "sample_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_id: Mapped[int] = mapped_column(ForeignKey("samples.id"))
    kind: Mapped[str] = mapped_column(String(20))       # "image" or "lab_report"
    original_name: Mapped[str] = mapped_column(String(200))
    stored_path: Mapped[str] = mapped_column(String(400))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    sample: Mapped[Sample] = relationship(back_populates="files")

    @property
    def quality(self) -> dict | None:
        """Upload quality check result (saved next to the file, see app/quality.py)."""
        from .quality import load
        return load(self.stored_path)


class QualityReport(Base):
    __tablename__ = "quality_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_id: Mapped[int] = mapped_column(ForeignKey("samples.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)       # goes up on each re-analysis
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.PENDING_AM)
    decision: Mapped[str] = mapped_column(String(40), default="PENDING ANALYSIS")  # ACCEPT / REJECT / NOT VERIFIABLE
    summary: Mapped[str] = mapped_column(Text, default="")
    details_json: Mapped[str] = mapped_column(Text, default="{}")  # detected defects, OCR values, clause checks
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    sample: Mapped[Sample] = relationship(back_populates="reports")
    reviews: Mapped[list["Review"]] = relationship(back_populates="report", cascade="all, delete-orphan")

    @property
    def sample_code(self) -> str:
        return self.sample.sample_code if self.sample else ""


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("quality_reports.id"))
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[Role] = mapped_column(Enum(Role))
    approved: Mapped[bool]
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    report: Mapped[QualityReport] = relationship(back_populates="reviews")


# ---- Messages between the Lab Analyst, AM and DM: one thread per sample ----
class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_id: Mapped[int] = mapped_column(ForeignKey("samples.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    recipient_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)   # None = everyone on the sample
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    sender: Mapped[User] = relationship(foreign_keys=[sender_id])
    recipient: Mapped[User | None] = relationship(foreign_keys=[recipient_id])


class MessageRead(Base):
    """The last message each user has seen in each thread (for unread counts)."""
    __tablename__ = "message_reads"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    sample_id: Mapped[int] = mapped_column(ForeignKey("samples.id"), primary_key=True)
    last_seen_id: Mapped[int] = mapped_column(Integer, default=0)


# ---- Trend Analysis: past laboratory records imported from file (tools/import_history.py) ----
class HistoryReport(Base):
    __tablename__ = "history_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    report_date: Mapped[datetime] = mapped_column(DateTime)
    sample_code: Mapped[str] = mapped_column(String(20))
    specification: Mapped[str] = mapped_column(String(30))
    supplier: Mapped[str] = mapped_column(String(100), index=True)
    decision: Mapped[str] = mapped_column(String(40))              # ACCEPT / REJECT / NOT VERIFIABLE
    failed_clauses: Mapped[str] = mapped_column(String(200), default="")
    source: Mapped[str] = mapped_column(String(60))                # says where the record came from


class HistoryResult(Base):
    __tablename__ = "history_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_no: Mapped[str] = mapped_column(String(40), index=True)
    report_date: Mapped[datetime] = mapped_column(DateTime)
    supplier: Mapped[str] = mapped_column(String(100))
    clause: Mapped[str] = mapped_column(String(10), index=True)
    property: Mapped[str] = mapped_column(String(100))
    direction: Mapped[str] = mapped_column(String(20), default="")
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20), default="")
    compliant: Mapped[bool] = mapped_column(Boolean)
    source: Mapped[str] = mapped_column(String(60))
