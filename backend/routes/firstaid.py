from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import FirstAidProtocol

router = APIRouter(tags=["first-aid"])


@router.get("/first-aid/{protocol_id}")
def get_first_aid(
    protocol_id: str,
    lang: str = Query("en"),
    db: Session = Depends(get_db),
):
    protocol = db.query(FirstAidProtocol).filter(FirstAidProtocol.id == protocol_id).first()
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    steps = []
    for step in protocol.steps or []:
        text = step.get(lang) or step.get("en", "")
        steps.append({
            "step": step.get("step"),
            "text": text,
            "icon": step.get("icon"),
        })

    return {
        "id": protocol.id,
        "severity": protocol.severity,
        "steps": steps,
        "warnings": protocol.warnings or [],
        "source": protocol.source,
    }
