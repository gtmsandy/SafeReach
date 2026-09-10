import uuid
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import get_db
from models import TriageSession

# In-memory SQLite engine for test isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create only the triage_sessions table for SQLite compatibility (avoids Postgres JSONB in facilities)
TriageSession.__table__.create(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides[get_db] = override_get_db
client = TestClient(main.app)


def test_triage_classify():
    res = client.post(
        "/api/v1/triage/classify",
        json={
            "responses": [
                {"q_id": "q1", "option_id": "unconscious"},
                {"q_id": "q2", "option_id": "heavy"},
            ]
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["severity"] == "critical"
    assert data["score"] == 6


def test_triage_sync_session_create_and_idempotency():
    session_uuid = str(uuid.uuid4())
    payload = {
        "id": session_uuid,
        "country_code": "BD",
        "severity": "critical",
        "was_offline": True,
        "score": 6,
        "summary": "Critical Trauma Assessment",
    }

    # 1. Initial sync -> status: created
    res1 = client.post("/api/v1/triage/sessions", json=payload)
    assert res1.status_code == 200, res1.text
    data1 = res1.json()
    assert data1["success"] is True
    assert data1["session_id"] == session_uuid
    assert data1["status"] == "created"

    # 2. Repeated sync with same ID -> status: already_synced (idempotent, no duplicate)
    res2 = client.post("/api/v1/triage/sessions", json=payload)
    assert res2.status_code == 200, res2.text
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["session_id"] == session_uuid
    assert data2["status"] == "already_synced"

    # 3. Verify exactly 1 record exists in database
    db = TestingSessionLocal()
    try:
        sessions = db.query(TriageSession).filter(TriageSession.id == uuid.UUID(session_uuid)).all()
        assert len(sessions) == 1
        assert sessions[0].country_code == "BD"
        assert sessions[0].severity == "critical"
        assert sessions[0].was_offline is True
    finally:
        db.close()

    # 4. Fetch session via GET
    res_get = client.get(f"/api/v1/triage/sessions/{session_uuid}")
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert get_data["id"] == session_uuid
    assert get_data["severity"] == "critical"


def test_triage_sync_concurrent_integrity_error_recovery():
    session_uuid = uuid.uuid4()
    # Pre-insert record into database directly (simulates thread A winning the race)
    db = TestingSessionLocal()
    try:
        db.add(TriageSession(
            id=session_uuid,
            country_code="TH",
            severity="serious",
            was_offline=False,
            created_at=datetime.utcnow(),
        ))
        db.commit()
    finally:
        db.close()

    # Now simulate thread B submitting the exact same ID
    res = client.post(
        "/api/v1/triage/sessions",
        json={
            "id": str(session_uuid),
            "country_code": "TH",
            "severity": "serious",
            "was_offline": False,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["session_id"] == str(session_uuid)
    assert data["status"] == "already_synced"


def test_facility_id_foreign_key_safety():
    session_uuid = str(uuid.uuid4())
    # Send unknown facility_id that doesn't exist
    res = client.post(
        "/api/v1/triage/sessions",
        json={
            "id": session_uuid,
            "country_code": "BD",
            "severity": "stable",
            "facility_id": "nonexistent_fac_999",
            "was_offline": True,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True

    # Verify session saved with NULL facility_id (safe from constraint violations)
    db = TestingSessionLocal()
    try:
        session = db.query(TriageSession).filter(TriageSession.id == uuid.UUID(session_uuid)).first()
        assert session is not None
        assert session.facility_id is None
        assert session.severity == "stable"
    finally:
        db.close()


def test_triage_sync_batch():
    id1 = str(uuid.uuid4())
    id2 = str(uuid.uuid4())
    payload = {
        "sessions": [
            {"id": id1, "country_code": "NP", "severity": "serious", "was_offline": False},
            {"id": id2, "country_code": "TH", "severity": "stable", "was_offline": True},
        ]
    }
    res = client.post("/api/v1/triage/sessions/batch", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["count"] == 2

    # Retrying batch preserves idempotency
    res_retry = client.post("/api/v1/triage/sessions/batch", json=payload)
    assert res_retry.status_code == 200
    retry_data = res_retry.json()
    assert retry_data["results"][0]["status"] == "already_synced"
    assert retry_data["results"][1]["status"] == "already_synced"


if __name__ == "__main__":
    test_triage_classify()
    test_triage_sync_session_create_and_idempotency()
    test_triage_sync_concurrent_integrity_error_recovery()
    test_facility_id_foreign_key_safety()
    test_triage_sync_batch()
    print("ALL BACKEND TRIAGE TESTS PASSED SUCCESSFULLY!")
