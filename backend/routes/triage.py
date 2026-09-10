import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import TriageSession, Facility

router = APIRouter(prefix="/triage", tags=["triage"])

QUESTIONS = {
    "q1": {
        "unconscious": 3, "confused": 2, "conscious": 0,
    },
    "q2": {
        "heavy": 3, "minor": 1, "none": 0,
    },
    "q3": {
        "yes": 2, "no": 0,
    },
    "q4": {
        "not_breathing": 4, "laboured": 3, "normal": 0,
    },
    "q5": {
        "many": 2, "few": 0,
    },
}

FACILITY_ROUTING = {
    "critical": ["trauma_center", "hospital", "ambulance"],
    "serious": ["hospital", "trauma_center", "ambulance"],
    "stable": ["hospital", "police", "clinic"],
}


class TriageResponse(BaseModel):
    q_id: str
    answer: str | None = None
    option_id: str | None = None


class Location(BaseModel):
    lat: float
    lng: float


class TriageRequest(BaseModel):
    responses: list[TriageResponse]
    location: Location | None = None
    country: str | None = None


@router.post("/classify")
def classify_triage(body: TriageRequest):
    total_score = 0
    flags = []

    for response in body.responses:
        answer = response.answer or response.option_id or ""
        q_scores = QUESTIONS.get(response.q_id, {})
        total_score += q_scores.get(answer, 0)

        if response.q_id == "q3" and answer == "yes":
            flags.append("NO_MOVE")

        if response.q_id == "q4" and answer == "not_breathing":
            return {
                "severity": "critical",
                "recommended_types": FACILITY_ROUTING["critical"],
                "first_aid_id": "cpr_needed",
                "flags": flags,
                "score": total_score,
            }

    if total_score >= 6:
        severity = "critical"
        first_aid_id = "critical_trauma"
    elif total_score >= 3:
        severity = "serious"
        first_aid_id = "serious_trauma"
    else:
        severity = "stable"
        first_aid_id = "minor_injury"

    return {
        "severity": severity,
        "recommended_types": FACILITY_ROUTING[severity],
        "first_aid_id": first_aid_id,
        "flags": flags,
        "score": total_score,
    }


class TriageSessionSyncRequest(BaseModel):
    id: uuid.UUID | None = None
    country_code: str | None = None
    severity: str
    facility_id: str | None = None
    was_offline: bool = True
    created_at: datetime | None = None
    score: int | None = None
    summary: str | None = None
    flags: list[str] | None = None
    responses: list[dict] | None = None
    model_config = {"extra": "ignore"}


class TriageBatchSyncRequest(BaseModel):
    sessions: list[TriageSessionSyncRequest]
    model_config = {"extra": "ignore"}


@router.post("/sessions")
@router.post("/session")
def sync_triage_session(
    body: TriageSessionSyncRequest,
    db: Session = Depends(get_db),
):
    session_id = body.id or uuid.uuid4()

    # Idempotency check: if session already exists, return without duplicate insert
    existing = db.query(TriageSession).filter(TriageSession.id == session_id).first()
    if existing:
        return {
            "success": True,
            "session_id": str(existing.id),
            "status": "already_synced",
            "created_at": existing.created_at.isoformat() if existing.created_at else None,
        }
    # Verify foreign key constraint on facility_id if provided
    valid_facility_id = None
    if body.facility_id:
        try:
            facility = db.query(Facility).filter(Facility.id == body.facility_id).first()
            if facility:
                valid_facility_id = body.facility_id
        except Exception:
            valid_facility_id = None

    country = body.country_code[:2].upper() if body.country_code else None
    created = body.created_at or datetime.utcnow()

    new_session = TriageSession(
        id=session_id,
        country_code=country,
        severity=body.severity,
        facility_id=valid_facility_id,
        was_offline=body.was_offline,
        created_at=created,
    )

    try:
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
    except IntegrityError:
        db.rollback()
        existing = db.query(TriageSession).filter(TriageSession.id == session_id).first()
        if existing:
            return {
                "success": True,
                "session_id": str(existing.id),
                "status": "already_synced",
                "created_at": existing.created_at.isoformat() if existing.created_at else None,
            }
        raise
    return {
        "success": True,
        "session_id": str(new_session.id),
        "status": "created",
        "created_at": new_session.created_at.isoformat() if new_session.created_at else None,
    }


@router.post("/sessions/batch")
def sync_triage_sessions_batch(
    body: TriageBatchSyncRequest,
    db: Session = Depends(get_db),
):
    results = []
    for item in body.sessions:
        session_id = item.id or uuid.uuid4()
        existing = db.query(TriageSession).filter(TriageSession.id == session_id).first()
        if existing:
            results.append({
                "session_id": str(existing.id),
                "status": "already_synced",
            })
            continue

        valid_facility_id = None
        if item.facility_id:
            try:
                fac = db.query(Facility).filter(Facility.id == item.facility_id).first()
                if fac:
                    valid_facility_id = item.facility_id
            except Exception:
                valid_facility_id = None
        country = item.country_code[:2].upper() if item.country_code else None
        created = item.created_at or datetime.utcnow()

        new_session = TriageSession(
            id=session_id,
            country_code=country,
            severity=item.severity,
            facility_id=valid_facility_id,
            was_offline=item.was_offline,
            created_at=created,
        )
        try:
            db.add(new_session)
            db.commit()
            results.append({
                "session_id": str(new_session.id),
                "status": "created",
            })
        except IntegrityError:
            db.rollback()
            existing = db.query(TriageSession).filter(TriageSession.id == session_id).first()
            if existing:
                results.append({
                    "session_id": str(existing.id),
                    "status": "already_synced",
                })
            else:
                raise

    return {"success": True, "results": results, "count": len(results)}

@router.get("/sessions/{session_id}")
def get_triage_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.query(TriageSession).filter(TriageSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": str(session.id),
        "country_code": session.country_code,
        "severity": session.severity,
        "facility_id": session.facility_id,
        "was_offline": session.was_offline,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }
