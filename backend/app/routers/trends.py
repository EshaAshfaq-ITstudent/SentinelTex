"""Trend Analysis: quality over time, by clause and by supplier.

Two kinds of records are combined, and every answer says how many came from each:
* past laboratory records imported with tools/import_history.py (in this prototype: synthetic demo history)
* reports analysed in SentinelTex itself (latest version of each sample)
"""
import json
from collections import Counter, defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import HistoryReport, HistoryResult, QualityReport, Role, User
from ..ocr.extract import load_rules
from ..security import require_roles

router = APIRouter(prefix="/trends", tags=["Trend Analysis"])
SYSTEM = "SentinelTex analyses"
NEAR = 0.05           # a passing value within 5 % of its limit counts as "close to the limit"


def _system_reports(db: Session):
    """Latest analysed version of each sample, as (date, sample, decision, checks)."""
    latest = {}
    for r in db.scalars(select(QualityReport)):
        if r.sample_id not in latest or r.version > latest[r.sample_id].version:
            latest[r.sample_id] = r
    for r in latest.values():
        checks = json.loads(r.details_json or "{}").get("compliance", {}).get("checks", [])
        yield r, checks


def _in_range(d: datetime, start: datetime | None, end: datetime | None) -> bool:
    d = d.replace(tzinfo=None)
    return (start is None or d >= start) and (end is None or d <= end)


def _collect(db, source, supplier, start, end):
    reports, results = [], []
    if source in ("all", "history"):
        for h in db.scalars(select(HistoryReport)):
            if (supplier is None or h.supplier == supplier) and _in_range(h.report_date, start, end):
                reports.append({"date": h.report_date, "supplier": h.supplier, "decision": h.decision,
                                "failed": h.failed_clauses.split(), "report_no": h.report_no, "source": h.source})
        for t in db.scalars(select(HistoryResult)):
            if (supplier is None or t.supplier == supplier) and _in_range(t.report_date, start, end):
                results.append({"date": t.report_date, "supplier": t.supplier, "clause": t.clause, "property": t.property,
                                "direction": t.direction, "value": t.value, "unit": t.unit, "compliant": t.compliant,
                                "report_no": t.report_no, "source": t.source})
    if source in ("all", "system") and supplier in (None, "not recorded"):
        for r, checks in _system_reports(db):
            d = r.created_at.replace(tzinfo=None)
            if not _in_range(d, start, end):
                continue
            reports.append({"date": d, "supplier": "not recorded", "decision": r.decision,
                            "failed": [c["clause"] for c in checks if c["result"] == "FAIL"],
                            "report_no": f"{r.sample_code} v{r.version}", "source": SYSTEM})
            for c in checks:
                if c.get("unit") != "count" and isinstance(c.get("value"), (int, float)) and c["result"] in ("PASS", "FAIL"):
                    results.append({"date": d, "supplier": "not recorded", "clause": c["clause"], "property": c["property"],
                                    "direction": c.get("direction", ""), "value": float(c["value"]), "unit": c.get("unit", ""),
                                    "compliant": c["result"] == "PASS", "report_no": f"{r.sample_code} v{r.version}",
                                    "source": SYSTEM})
    return reports, results


def _parse_day(s: str | None):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dates must look like 2026-05-31")


@router.get("/overview")
def overview(source: str = Query("all", pattern="^(all|history|system)$"), supplier: str | None = None,
             date_from: str | None = None, date_to: str | None = None, db: Session = Depends(get_db),
             user: User = Depends(require_roles(Role.AM, Role.DM))):
    reports, results = _collect(db, source, supplier, _parse_day(date_from), _parse_day(date_to))
    months = defaultdict(Counter)
    for r in reports:
        months[r["date"].strftime("%Y-%m")][r["decision"]] += 1
    monthly = [{"month": m, "total": sum(c.values()), "accept": c["ACCEPT"], "reject": c["REJECT"],
                "not_verifiable": c["NOT VERIFIABLE"]} for m, c in sorted(months.items())]

    # share of reports that failed each clause (Section 3 tests and Section 4 visual defects)
    names = {r["clause"]: r["property"] + (f" ({r['direction']})" if r["direction"] else "")
             for r in load_rules("STS/UC/01")["requirements"]}
    names.update({v["clause"]: v["defect"] for v in load_rules("STS/UC/01")["visual"]})
    failed = Counter(c for r in reports for c in set(r["failed"]))
    total_r = len(reports)
    clause_failures = sorted(({"clause": c, "property": names.get(c, c), "tested": total_r, "failed": n,
                               "rate": round(n / total_r, 3)} for c, n in failed.items()),
                             key=lambda x: (-x["rate"], x["clause"]))
    sup = defaultdict(Counter)
    for r in reports:
        sup[r["supplier"]]["reports"] += 1
        sup[r["supplier"]][r["decision"]] += 1
    suppliers = sorted(({"supplier": s, "reports": c["reports"], "accept": c["ACCEPT"], "reject": c["REJECT"],
                         "not_verifiable": c["NOT VERIFIABLE"], "reject_rate": round(c["REJECT"] / c["reports"], 3)}
                        for s, c in sup.items()), key=lambda x: -x["reject_rate"])
    by_source = Counter(r["source"] for r in reports)
    total = len(reports)
    return {"total_reports": total, "by_source": dict(by_source),
            "decisions": dict(Counter(r["decision"] for r in reports)),
            "accept_rate": round(sum(r["decision"] == "ACCEPT" for r in reports) / total, 3) if total else None,
            "monthly": monthly, "clause_failures": clause_failures, "suppliers": suppliers,
            "note": ("Imported records are synthetic demo history made for this prototype, not real laboratory data."
                     if any(s != SYSTEM for s in by_source) else "")}


@router.get("/clause/{clause}")
def clause_trend(clause: str, source: str = Query("all", pattern="^(all|history|system)$"), supplier: str | None = None,
                 date_from: str | None = None, date_to: str | None = None, specification: str = "STS/UC/01",
                 db: Session = Depends(get_db), user: User = Depends(require_roles(Role.AM, Role.DM))):
    rule = next((r for r in load_rules(specification)["requirements"] if r["clause"] == clause), None)
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Clause {clause} has no numeric limit in {specification}")
    _, results = _collect(db, source, supplier, _parse_day(date_from), _parse_day(date_to))
    pts = sorted((t for t in results if t["clause"] == clause), key=lambda t: t["date"])
    vals = [t["value"] for t in pts]

    def near(v):
        kind, lim = rule["kind"], rule["limit"]
        if kind == "range":
            span = lim[1] - lim[0]
            return min(v - lim[0], lim[1] - v) <= NEAR * span
        if kind == "min":
            return v - lim <= NEAR * abs(lim)
        if kind == "max":
            return lim - v <= NEAR * abs(lim)
        return lim - abs(v) <= NEAR * lim          # abs_max

    points = [{"date": t["date"].strftime("%Y-%m-%d"), "value": t["value"], "compliant": t["compliant"],
               "near_limit": t["compliant"] and near(t["value"]), "report_no": t["report_no"],
               "supplier": t["supplier"], "source": t["source"]} for t in pts]
    return {"clause": clause, "property": rule["property"], "direction": rule["direction"], "unit": rule["unit"],
            "requirement": rule["text"], "kind": rule["kind"], "limit": rule["limit"], "points": points,
            "stats": {"n": len(vals), "mean": round(sum(vals) / len(vals), 2) if vals else None,
                      "min": min(vals, default=None), "max": max(vals, default=None),
                      "out_of_limit": sum(not p["compliant"] for p in points),
                      "near_limit": sum(p["near_limit"] for p in points)}}


@router.get("/suppliers")
def supplier_list(db: Session = Depends(get_db), user: User = Depends(require_roles(Role.AM, Role.DM))):
    names = sorted({h.supplier for h in db.scalars(select(HistoryReport))})
    return names + (["not recorded"] if db.scalar(select(QualityReport.id).limit(1)) else [])
