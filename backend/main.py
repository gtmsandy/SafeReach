import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from database import Base, engine, SessionLocal
from utils import seed_reference_data
from routes.facilities import router as facilities_router
from routes.emergency import router as emergency_router
from routes.triage import router as triage_router
from routes.firstaid import router as firstaid_router
from routes.sync import router as sync_router
from routes.verify import router as verify_router

app = FastAPI(
    title="SafeReach API",
    description="Offline-first emergency response API for BIMSTEC nations",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facilities_router, prefix="/api/v1")
app.include_router(emergency_router, prefix="/api/v1")
app.include_router(triage_router, prefix="/api/v1")
app.include_router(firstaid_router, prefix="/api/v1")
app.include_router(sync_router, prefix="/api/v1")
app.include_router(verify_router, prefix="/api/v1")


@app.on_event("startup")
def startup():
    for attempt in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
                seed_reference_data(db)
            finally:
                db.close()
            return
        except OperationalError:
            time.sleep(2)
    print("[SafeReach] Database not ready — tables will be created on first successful connection")


@app.get("/")
def root():
    return {"service": "SafeReach API", "docs": "/docs"}
