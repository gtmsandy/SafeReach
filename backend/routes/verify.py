from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Facility, FacilityVerification

router = APIRouter(tags=["verify"])


class VerifyRequest(BaseModel):
    is_operational: bool
    device_hash: str


@router.post("/verify/{facility_id}")
def verify_facility(
    facility_id: str,
    body: VerifyRequest,
    db: Session = Depends(get_db),
):
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    db.add(FacilityVerification(
        facility_id=facility_id,
        is_operational=body.is_operational,
        device_hash=body.device_hash,
    ))

    facility.verified = body.is_operational
    facility.last_verified = datetime.utcnow()
    db.commit()

    return {"success": True}
