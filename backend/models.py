import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, String, Text,
    BigInteger, Numeric, ForeignKey, CHAR,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from database import Base


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    facility_type = Column(String(50), nullable=False)
    trauma_level = Column(Integer, nullable=True)
    country_code = Column(CHAR(2), nullable=False)
    lat = Column(Numeric(10, 7), nullable=True)
    lng = Column(Numeric(10, 7), nullable=True)
    address = Column(Text, nullable=True)
    phone_primary = Column(String(30), nullable=True)
    phone_secondary = Column(String(30), nullable=True)
    operating_hours = Column(JSONB, nullable=True)
    services = Column(ARRAY(Text), nullable=True)
    verified = Column(Boolean, default=False)
    last_verified = Column(DateTime, nullable=True)
    osm_id = Column(BigInteger, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmergencyNumber(Base):
    __tablename__ = "emergency_numbers"

    country_code = Column(CHAR(2), primary_key=True)
    country_name = Column(String(100), nullable=True)
    police = Column(String(20), nullable=True)
    ambulance = Column(String(20), nullable=True)
    fire = Column(String(20), nullable=True)
    unified = Column(String(20), nullable=True)
    languages = Column(ARRAY(Text), nullable=True)


class FirstAidProtocol(Base):
    __tablename__ = "first_aid_protocols"

    id = Column(String(50), primary_key=True)
    severity = Column(String(20), nullable=True)
    steps = Column(JSONB, nullable=False)
    source = Column(Text, nullable=True)
    warnings = Column(JSONB, nullable=True)


class TriageSession(Base):
    __tablename__ = "triage_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_code = Column(CHAR(2), nullable=True)
    severity = Column(String(20), nullable=True)
    facility_id = Column(String(50), ForeignKey("facilities.id"), nullable=True)
    was_offline = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FacilityVerification(Base):
    __tablename__ = "facility_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_id = Column(String(50), ForeignKey("facilities.id"), nullable=False)
    is_operational = Column(Boolean, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    device_hash = Column(String(64), nullable=True)
