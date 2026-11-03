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
