# SafeReach

Offline-first emergency response PWA for road accidents across BIMSTEC nations.

## Run locally

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Seed data

```bash
docker-compose exec backend python data_pipeline/osm_import.py
```

## Architecture

```
safereach/
├── frontend/          React 18 + Vite PWA (offline-first)
│   ├── src/logic/     Triage, ranking, Haversine, Dexie DB, crash detection
│   ├── src/data/      Bundled JSON: emergency numbers, first aid, facilities, bounds
│   ├── src/i18n/      Translations: en, bn, th, ne
│   └── src/components/ 8 screens + SilentSOS + CrashAlert overlays
└── backend/           FastAPI + PostgreSQL/PostGIS
    ├── routes/        /facilities /triage /firstaid /sync /verify
    └── data_pipeline/ osm_import.py — Overpass API → PostgreSQL → JSON
```

**Offline-first principle:** Toggle airplane mode after first page load. Full triage, facility lookup, first-aid guidance, and the map all work with zero network connection.

The service worker pre-caches all app assets on first load. Map tiles for your
detected country are proactively fetched at zoom levels 10-13 (city-level
navigation detail) capped at 200 tiles to respect device storage.

Triage and incident history are stored locally and can be synchronized with
the backend when connectivity is available.

## Data sources

- **Facilities:** OpenStreetMap via Overpass API (open data, ODbL license)
- **First Aid:** WHO First Aid Manual 2024 (public domain)
- **Emergency numbers:** Manually verified from official government sources
- **Maps:** OpenStreetMap tile layer, cached offline via Workbox service worker

## Offline capability

Toggle airplane mode after first page load. Full triage, facility lookup,
first-aid guidance, and the map all work with zero network connection.

The service worker pre-caches all app assets on first load. Map tiles for your
detected country are proactively fetched at zoom levels 10-13 (city-level
navigation detail) capped at 200 tiles to respect device storage.

## Key features

- **5-question offline triage** with severity-based facility routing (critical/serious/stable)
- **Haversine ranking** — nearest + most capable facility ranked by distance, type, trauma level, and verification status — runs entirely in the browser
- **Silent SOS** — one tap calls ambulance + SMS's GPS location to saved emergency contact
- **Crash detection** — accelerometer-based auto-SOS with 15-second cancellable countdown
- **Calm, clinical UI** — designed to reduce panic, not amplify it; no saturated red until a CRITICAL classification exists
- **Full BIMSTEC coverage** — 7 countries (BD, IN, TH, NP, LK, MM, BT), 4 languages (en, bn, th, ne), auto-detected from GPS
- **PWA installable** — passes Lighthouse PWA audit; installable as home screen app

## BIMSTEC Countries Supported

| Code | Country | Police | Ambulance | Unified |
|------|---------|--------|-----------|---------|
| BD | Bangladesh | 999 | 199 | 999 |
| IN | India | 100 | 108 | 112 |
| TH | Thailand | 191 | 1669 | 1669 |
| NP | Nepal | 100 | 102 | 112 |
| LK | Sri Lanka | 119 | 1990 | 1990 |
| MM | Myanmar | 199 | 192 | 199 |
| BT | Bhutan | 113 | 112 | 112 |

## Demo sequence

1. Open app → auto-detects country → calm HomeScreen with emergency numbers
2. Tap "Find Emergency Help" → triage Q1-5 → classified as CRITICAL
3. Results → muted severity banner → ranked hospitals → large "Call" button
4. Tap "First Aid Guide" → CPR steps in Bengali
5. Toggle airplane mode → repeat steps 1-4 including map → everything works
6. Silent SOS → opens dialer + queues SMS with GPS location
7. Change country to Thailand → shows 1669, Thai hospitals, Thai language
8. Settings → emergency contact, crash detection toggle, offline data status
9. Accident History → view locally stored incidents and synchronization status


Submitted for: Road Safety Hackathon 2026, IIT Madras CoERS  
Problem statement: RoadSOS  
Category: BIMSTEC / Non-Indian
