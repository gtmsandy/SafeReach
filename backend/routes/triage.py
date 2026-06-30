from fastapi import APIRouter
from pydantic import BaseModel

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
