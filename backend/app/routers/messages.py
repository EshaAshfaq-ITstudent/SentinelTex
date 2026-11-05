"""Messages between the Lab Analyst, Assistant Manager and Deputy Manager.

One thread per sample, so every conversation stays next to the reports it is about (and is kept as a record).
A message goes to everyone working on the sample, or privately to one person: then only the sender and that
person can see it. Everything is stored in the local database; nothing leaves the laptop.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Message, MessageRead, Sample, User
from ..schemas import MessageIn, MessageOut, PersonOut, ThreadOut
from ..security import get_current_user
from .samples import get_sample_or_404

router = APIRouter(tags=["Messages"])


def visible_to(user: User):
    """Messages this user may see: sent to everyone, sent by them, or sent to them."""
    return or_(Message.recipient_id.is_(None), Message.recipient_id == user.id, Message.sender_id == user.id)


def _out(m: Message, sample_code: str, user: User) -> MessageOut:
    return MessageOut(id=m.id, sample_code=sample_code, sender=m.sender.full_name, sender_role=m.sender.role,
                      mine=m.sender_id == user.id, recipient=m.recipient.full_name if m.recipient else None,
                      recipient_role=m.recipient.role if m.recipient else None, text=m.text, created_at=m.created_at)


def _mark_read(db: Session, user: User, sample_id: int, last_id: int):
    row = db.get(MessageRead, (user.id, sample_id))
    if row is None:
        db.add(MessageRead(user_id=user.id, sample_id=sample_id, last_seen_id=last_id))
    elif last_id > row.last_seen_id:
        row.last_seen_id = last_id
    db.commit()


@router.get("/messages/people", response_model=list[PersonOut])
def people(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Who a message can be sent to (everyone except yourself)."""
    return db.scalars(select(User).where(User.id != user.id).order_by(User.role, User.full_name)).all()


@router.get("/samples/{sample_code}/messages", response_model=list[MessageOut])
def thread(sample_code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The messages about this sample that this user may see, oldest first. Opening the thread marks it as read."""
    sample = get_sample_or_404(db, sample_code)
    msgs = db.scalars(select(Message).where(Message.sample_id == sample.id, visible_to(user)).order_by(Message.id)).all()
    if msgs:
        _mark_read(db, user, sample.id, msgs[-1].id)
    return [_out(m, sample.sample_code, user) for m in msgs]


@router.post("/samples/{sample_code}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send(sample_code: str, body: MessageIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sample = get_sample_or_404(db, sample_code)
    if body.to_user_id is not None and (body.to_user_id == user.id or db.get(User, body.to_user_id) is None):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose another person to send the message to")
    msg = Message(sample_id=sample.id, sender_id=user.id, recipient_id=body.to_user_id, text=body.text.strip())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    _mark_read(db, user, sample.id, msg.id)
    return _out(msg, sample.sample_code, user)


@router.get("/messages", response_model=list[ThreadOut])
def threads(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Threads with at least one message this user may see: last such message and how many are unread."""
    last_ids = dict(db.execute(select(Message.sample_id, func.max(Message.id)).where(visible_to(user))
                               .group_by(Message.sample_id)).all())
    seen = dict(db.execute(select(MessageRead.sample_id, MessageRead.last_seen_id).where(MessageRead.user_id == user.id)).all())
    out = []
    for sample_id, last_id in last_ids.items():
        last = db.get(Message, last_id)
        unread = db.scalar(select(func.count(Message.id)).where(
            Message.sample_id == sample_id, Message.id > seen.get(sample_id, 0), Message.sender_id != user.id, visible_to(user)))
        out.append(ThreadOut(sample_code=db.get(Sample, sample_id).sample_code, last_text=last.text[:140],
                             last_sender=last.sender.full_name, last_at=last.created_at, unread=unread or 0))
    return sorted(out, key=lambda t: t.last_at, reverse=True)
