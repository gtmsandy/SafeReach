from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Facility

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/delta")
def sync_delta(
    since: str = Query(...),
    country: str | None = Query(None),
    db: Session = Depends(get_db),
):
    since_dt = datetime.fromisoformat(since.replace("Z", "+00:00").replace("+00:00", ""))

    query = db.query(Facility).filter(Facility.updated_at >= since_dt)
    if country:
        query = query.filter(Facility.country_code == country.upper())

    facilities = []
    for f in query.all():
        facilities.append({
            "id": f.id,
            "name": f.name,
            "facility_type": f.facility_type,
            "trauma_level": f.trauma_level,
            "country_code": f.country_code,
            "lat": float(f.lat) if f.lat else None,
            "lng": float(f.lng) if f.lng else None,
            "address": f.address,
            "phone_primary": f.phone_primary,
            "phone_secondary": f.phone_secondary,
            "services": f.services,
            "verified": f.verified,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        })

    return {
        "facilities": facilities,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
