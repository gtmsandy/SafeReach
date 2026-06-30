from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Facility
from utils import score_facility

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("/nearby")
def get_nearby_facilities(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(20),
    types: str | None = Query(None),
    country: str | None = Query(None),
    severity: str = Query("serious"),
    db: Session = Depends(get_db),
):
    query = db.query(Facility)
    if country:
        query = query.filter(Facility.country_code == country)
    if types:
        type_list = [t.strip() for t in types.split(",") if t.strip()]
        query = query.filter(Facility.facility_type.in_(type_list))

    facilities = query.all()
    scored = [
        score_facility(f, severity, lat, lng)
        for f in facilities
        if f.lat is not None and f.lng is not None
    ]
    scored = [s for s in scored if s["distance_km"] <= radius_km]
    scored.sort(key=lambda x: x["totalScore"], reverse=True)

    return [{k: v for k, v in s.items() if k != "totalScore"} for s in scored[:20]]
