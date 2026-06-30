import json
import math
import os
from pathlib import Path

from sqlalchemy.orm import Session

from models import EmergencyNumber, FirstAidProtocol, Facility

DATA_DIR = Path(__file__).parent / "data"
FRONTEND_DATA = Path(__file__).parent.parent / "frontend" / "src" / "data"


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371
    d_lat = math.radians(float(lat2) - float(lat1))
    d_lng = math.radians(float(lng2) - float(lng1))
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(float(lat1)))
        * math.cos(math.radians(float(lat2)))
        * math.sin(d_lng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


TYPE_SCORES = {
    "critical": {
        "trauma_center": 30, "hospital": 20, "ambulance": 15,
        "police": 5, "blood_bank": 10, "clinic": 2,
    },
    "serious": {
        "hospital": 30, "trauma_center": 25, "ambulance": 20,
        "blood_bank": 10, "police": 5, "clinic": 8,
    },
    "stable": {
        "hospital": 25, "clinic": 30, "police": 15,
        "ambulance": 10, "trauma_center": 20, "blood_bank": 5,
    },
}


def score_facility(facility, severity, user_lat, user_lng):
    distance = haversine_km(user_lat, user_lng, facility.lat, facility.lng)
    dist_score = max(0, 40 - distance * 2)
    type_map = TYPE_SCORES.get(severity, TYPE_SCORES["stable"])
    type_score = type_map.get(facility.facility_type, 0)
    trauma_score = 0
    if facility.trauma_level and severity in ("critical", "serious"):
        trauma_score = {1: 20, 2: 12, 3: 5}.get(facility.trauma_level, 0)
    verify_score = 10 if facility.verified else 0
    return {
        "id": str(facility.id),
        "name": facility.name,
        "type": facility.facility_type,
        "trauma_level": facility.trauma_level,
        "distance_km": round(distance, 1),
        "phone": facility.phone_primary,
        "lat": float(facility.lat) if facility.lat else None,
        "lng": float(facility.lng) if facility.lng else None,
        "services": facility.services or [],
        "totalScore": dist_score + type_score + trauma_score + verify_score,
    }


def seed_reference_data(db: Session):
    """Seed emergency numbers and first-aid protocols if empty."""
    if db.query(EmergencyNumber).count() == 0:
        numbers_path = FRONTEND_DATA / "emergency_numbers.json"
        if not numbers_path.exists():
            numbers_path = DATA_DIR / "emergency_numbers.json"
        if numbers_path.exists():
            for row in json.loads(numbers_path.read_text()):
                db.add(EmergencyNumber(
                    country_code=row["country_code"],
                    country_name=row["country_name"],
                    police=row.get("police"),
                    ambulance=row.get("ambulance"),
                    fire=row.get("fire"),
                    unified=row.get("unified"),
                    languages=row.get("languages"),
                ))

    if db.query(FirstAidProtocol).count() == 0:
        aid_path = FRONTEND_DATA / "first_aid_protocols.json"
        if not aid_path.exists():
            aid_path = DATA_DIR / "first_aid_protocols.json"
        if aid_path.exists():
            for row in json.loads(aid_path.read_text()):
                db.add(FirstAidProtocol(
                    id=row["id"],
                    severity=row.get("severity"),
                    steps=row["steps"],
                    source=row.get("source"),
                    warnings=row.get("warnings"),
                ))

    if db.query(Facility).count() == 0:
        fac_path = FRONTEND_DATA / "bimstec_facilities.json"
        if fac_path.exists():
            for row in json.loads(fac_path.read_text()):
                db.add(Facility(
                    id=row["id"],
                    name=row["name"],
                    facility_type=row["facility_type"],
                    trauma_level=row.get("trauma_level"),
                    country_code=row["country_code"],
                    lat=row.get("lat"),
                    lng=row.get("lng"),
                    address=row.get("address"),
                    phone_primary=row.get("phone_primary"),
                    phone_secondary=row.get("phone_secondary"),
                    services=row.get("services"),
                    verified=row.get("verified", False),
                    osm_id=row.get("osm_id"),
                ))

    db.commit()
