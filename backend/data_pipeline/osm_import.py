#!/usr/bin/env python3
"""
OSM Data Pipeline — imports BIMSTEC facility data from Overpass API
into PostgreSQL and exports bimstec_facilities.json for frontend offline seeding.

Usage:
    python data_pipeline/osm_import.py
"""

import json
import os
import sys
import time
from pathlib import Path

import psycopg2
import requests
from psycopg2.extras import execute_values

COUNTRIES = ["BD", "IN", "TH", "NP", "LK", "MM", "BT"]

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

AMENITY_MAP = {
    "hospital": "hospital",
    "police": "police",
    "ambulance_station": "ambulance",
    "blood_bank": "blood_bank",
}

TRAUMA_KEYWORDS = ["trauma", "emergency", "critical care"]

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://safereach:safereach_dev@localhost:5432/safereach",
)

FRONTEND_EXPORT = Path(
    os.getenv(
        "FRONTEND_EXPORT_PATH",
        str(
            Path(__file__).parent.parent.parent
            / "frontend"
            / "src"
            / "data"
            / "bimstec_facilities.json"
        )
    )
)

# ── Overpass retry settings ────────────────────────────────────────────────────
OVERPASS_MAX_RETRIES = 5
OVERPASS_BASE_DELAY = 15   # seconds — doubled on each retry
OVERPASS_RETRY_CODES = {429, 503, 504}

# ── DB connection retry settings ──────────────────────────────────────────────
DB_MAX_ATTEMPTS = 10
DB_RETRY_DELAY = 3   # seconds between attempts


def build_query(country_code: str) -> str:
    return f"""
[out:json][timeout:60];
area["ISO3166-1"="{country_code}"]->.a;
(
  node["amenity"="hospital"](area.a);
  node["amenity"="police"](area.a);
  node["amenity"="ambulance_station"](area.a);
  node["amenity"="blood_bank"](area.a);
  way["amenity"="hospital"](area.a);
);
out center;
"""


def fetch_osm(country_code: str) -> list[dict]:
    """Fetch Overpass data with exponential backoff on 429/503/504."""
    print(f"  Fetching OSM data for {country_code}...")
    for attempt in range(OVERPASS_MAX_RETRIES):
        try:
            resp = requests.post(
                OVERPASS_URL,
                data={"data": build_query(country_code)},
                headers={"User-Agent": "SafeReachEmergencyApp/1.0 (contact: admin@safereach.org)"},
                timeout=120,
            )
            if resp.status_code in OVERPASS_RETRY_CODES:
                delay = OVERPASS_BASE_DELAY * (2 ** attempt)
                print(
                    f"    HTTP {resp.status_code} — waiting {delay}s "
                    f"(attempt {attempt + 1}/{OVERPASS_MAX_RETRIES})..."
                )
                time.sleep(delay)
                continue

            resp.raise_for_status()
            return resp.json().get("elements", [])

        except requests.exceptions.Timeout:
            delay = OVERPASS_BASE_DELAY * (2 ** attempt)
            print(
                f"    Request timed out — waiting {delay}s "
                f"(attempt {attempt + 1}/{OVERPASS_MAX_RETRIES})..."
            )
            time.sleep(delay)

    raise RuntimeError(
        f"Failed to fetch OSM data for {country_code} after {OVERPASS_MAX_RETRIES} attempts"
    )


def parse_element(element: dict, country_code: str) -> dict | None:
    tags = element.get("tags", {})
    name = tags.get("name") or tags.get("name:en")
    if not name:
        return None

    amenity = tags.get("amenity")
    facility_type = AMENITY_MAP.get(amenity)
    if not facility_type:
        return None

    if element["type"] == "node":
        lat, lng = element.get("lat"), element.get("lon")
    else:
        center = element.get("center", {})
        lat, lng = center.get("lat"), center.get("lon")

    if lat is None or lng is None:
        return None

    name_lower = name.lower()
    trauma_level = None
    if facility_type == "hospital":
        if any(k in name_lower for k in TRAUMA_KEYWORDS):
            trauma_level = 1
        elif "district" in name_lower or "general" in name_lower:
            trauma_level = 2
        else:
            trauma_level = 3

    osm_id = element.get("id")
    stable_id = f"{country_code.lower()}-{facility_type[:4]}-{osm_id}"

    # Truncate phone numbers to 50 chars — OSM data can include long values.
    raw_phone = tags.get("phone") or tags.get("contact:phone")
    phone_primary = raw_phone[:50] if raw_phone else None

    return {
        "id": stable_id,
        "name": name,
        "facility_type": facility_type,
        "trauma_level": trauma_level,
        "country_code": country_code,
        "lat": round(float(lat), 7),
        "lng": round(float(lng), 7),
        "address": tags.get("addr:full") or tags.get("addr:street"),
        "phone_primary": phone_primary,
        "phone_secondary": None,
        "services": [amenity],
        "verified": False,
        "osm_id": osm_id,
    }


def connect_with_retry() -> psycopg2.extensions.connection:
    """Connect to PostgreSQL with retry loop — needed when 'db' hostname is
    transiently unresolvable right after Docker Compose starts the backend."""
    for attempt in range(DB_MAX_ATTEMPTS):
        try:
            conn = psycopg2.connect(DATABASE_URL)
            if attempt > 0:
                print(f"  DB connected on attempt {attempt + 1}.")
            return conn
        except psycopg2.OperationalError as e:
            if attempt < DB_MAX_ATTEMPTS - 1:
                print(
                    f"  DB connection failed (attempt {attempt + 1}/{DB_MAX_ATTEMPTS}): "
                    f"{e!s:.80} — retrying in {DB_RETRY_DELAY}s..."
                )
                time.sleep(DB_RETRY_DELAY)
            else:
                raise


def ensure_table(conn):
    """Create the facilities table if it doesn't already exist.
    Phone columns widened to VARCHAR(100) to accommodate OSM data."""
    with conn.cursor() as cur:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS facilities (
            id              VARCHAR(50) PRIMARY KEY,
            name            VARCHAR(255) NOT NULL,
            facility_type   VARCHAR(50) NOT NULL,
            trauma_level    INTEGER,
            country_code    CHAR(2) NOT NULL,
            lat             DECIMAL(10,7),
            lng             DECIMAL(10,7),
            address         TEXT,
            phone_primary   VARCHAR(100),
            phone_secondary VARCHAR(100),
            operating_hours JSONB,
            services        TEXT[],
            verified        BOOLEAN DEFAULT FALSE,
            last_verified   TIMESTAMP,
            osm_id          BIGINT,
            created_at      TIMESTAMP DEFAULT NOW(),
            updated_at      TIMESTAMP DEFAULT NOW()
        );
        -- Widen phone columns if they already exist with the old constraint.
        ALTER TABLE facilities
            ALTER COLUMN phone_primary TYPE VARCHAR(100),
            ALTER COLUMN phone_secondary TYPE VARCHAR(100);
        """)
    conn.commit()


def upsert_facilities(conn, facilities: list[dict]):
    if not facilities:
        return

    sql = """
    INSERT INTO facilities (
        id, name, facility_type, trauma_level, country_code,
        lat, lng, address, phone_primary, phone_secondary,
        services, verified, osm_id
    ) VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        facility_type = EXCLUDED.facility_type,
        trauma_level = EXCLUDED.trauma_level,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        address = EXCLUDED.address,
        phone_primary = EXCLUDED.phone_primary,
        services = EXCLUDED.services,
        osm_id = EXCLUDED.osm_id,
        updated_at = NOW()
    """

    rows = [
        (
            f["id"], f["name"], f["facility_type"], f["trauma_level"],
            f["country_code"], f["lat"], f["lng"], f["address"],
            f["phone_primary"], f["phone_secondary"], f["services"],
            f["verified"], f["osm_id"],
        )
        for f in facilities
    ]

    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def export_json(conn, path: Path):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, facility_type, trauma_level, country_code,
                   lat, lng, address, phone_primary, phone_secondary,
                   services, verified, osm_id
            FROM facilities
            ORDER BY country_code, name
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]

    for row in rows:
        if row.get("lat") is not None:
            row["lat"] = float(row["lat"])
        if row.get("lng") is not None:
            row["lng"] = float(row["lng"])

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    print(f"  Exported {len(rows)} facilities → {path}")


def main():
    print("SafeReach OSM Import Pipeline")
    all_facilities = []

    for country in COUNTRIES:
        try:
            elements = fetch_osm(country)
            parsed = [
                f for el in elements
                if (f := parse_element(el, country)) is not None
            ]
            print(f"  {country}: {len(parsed)} facilities parsed")
            all_facilities.extend(parsed)
            # Brief pause between countries to be a polite Overpass client.
            time.sleep(2)
        except Exception as e:
            print(f"  {country}: ERROR — {e}", file=sys.stderr)

    print(f"\nTotal parsed: {len(all_facilities)}")

    try:
        conn = connect_with_retry()
        ensure_table(conn)
        upsert_facilities(conn, all_facilities)
        export_json(conn, FRONTEND_EXPORT)
        conn.close()
        print("Done.")
    except psycopg2.OperationalError as e:
        print(f"Database unavailable after retries: {e}", file=sys.stderr)
        # Still export the JSON so the frontend can work offline.
        FRONTEND_EXPORT.parent.mkdir(parents=True, exist_ok=True)
        FRONTEND_EXPORT.write_text(json.dumps(all_facilities, indent=2, ensure_ascii=False))
        print(f"Exported JSON only (no DB): {FRONTEND_EXPORT}")
        sys.exit(1)


if __name__ == "__main__":
    main()
