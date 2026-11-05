"""Request and response shapes for the API."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import ReportStatus, Role


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    full_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    role: Role


class SampleCreate(BaseModel):
    sample_code: str = Field(pattern=r"^ST-\d{4}$", examples=["ST-0080"])
    specification: str = Field(default="STS/UC/01", max_length=30)
    description: str = Field(default="", max_length=200)


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    original_name: str
    uploaded_at: datetime
    quality: dict | None = None


class ReviewIn(BaseModel):
    approve: bool
    comment: str = Field(default="", max_length=1000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role: Role
    approved: bool
    comment: str
    created_at: datetime


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sample_code: str = ""
    version: int
    status: ReportStatus
    decision: str
    summary: str
    details_json: str
    created_at: datetime
    reviews: list[ReviewOut] = []


class SampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sample_code: str
    specification: str
    description: str
    created_at: datetime
    files: list[FileOut] = []
    reports: list[ReportOut] = []


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    to_user_id: int | None = None          # None = everyone working on the sample; a user id = only that person


class MessageOut(BaseModel):
    id: int
    sample_code: str
    sender: str
    sender_role: Role
    mine: bool
    recipient: str | None = None           # None = everyone; else the one person it was sent to
    recipient_role: Role | None = None
    text: str
    created_at: datetime


class PersonOut(BaseModel):
    id: int
    full_name: str
    role: Role


class ThreadOut(BaseModel):
    sample_code: str
    last_text: str
    last_sender: str
    last_at: datetime
    unread: int
