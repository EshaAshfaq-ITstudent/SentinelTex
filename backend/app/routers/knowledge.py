"""Specification knowledge base (RAG with ChromaDB), LLM explanations and the Lab Chatbot."""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import QualityReport, User
from ..rag import chat, explain, index, llm
from ..security import get_current_user

router = APIRouter(tags=["Knowledge and Lab Chatbot"])


class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    specification: str = Field(default="STS/UC/01", max_length=30)


@router.get("/knowledge/status")
def knowledge_status(user: User = Depends(get_current_user)):
    return {"chunks": index.count(), "embedding": index.embedder().name, "llm": llm.status()}


@router.post("/chat")
def ask(body: ChatIn, user: User = Depends(get_current_user)):
    if index.count() == 0:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Knowledge base is empty: run tools\\build_knowledge.py")
    return chat.answer(body.question, spec=body.specification)


@router.post("/reports/{report_id}/explain")
def explain_report(report_id: int, refresh: bool = False, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """LLM explanation of the report's decision with clause references. Saved in the report after the first call."""
    report = db.get(QualityReport, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    details = json.loads(report.details_json or "{}")
    cached = details.get("llm_explanation")
    if cached and cached.get("method") == "llm" and not refresh:
        return cached
    if not details.get("compliance"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This report has no compliance result to explain")
    result = explain.explain(details["compliance"], report.sample.specification)
    details["llm_explanation"] = result
    report.details_json = json.dumps(details)   # explanation only: decision and status are not touched
    db.commit()
    return result
