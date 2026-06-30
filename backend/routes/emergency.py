from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import EmergencyNumber

router = APIRouter(tags=["emergency-numbers"])


@router.get("/emergency-numbers/{country_code}")
def get_emergency_numbers(country_code: str, db: Session = Depends(get_db)):
    record = db.query(EmergencyNumber).filter(
        EmergencyNumber.country_code == country_code.upper()
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Country not found")
    return {
        "police": record.police,
        "ambulance": record.ambulance,
        "fire": record.fire,
        "unified": record.unified,
        "country_name": record.country_name,
    }
