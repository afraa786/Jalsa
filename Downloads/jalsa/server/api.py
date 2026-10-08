"""Jalsa FastAPI backend.

Run:
    python train.py
    uvicorn api:app --reload

Docs:
    http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import xgboost as xgb
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import collect
from config import CLOSE_HOUR, FESTIVALS, LEVELS, LEVEL_MID, PLACES, ZONES
from features import FEATURES, build_features
from simulate import mc_draw

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model" / "xgb.json"
METRICS_PATH = ROOT / "model" / "metrics.json"

@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()
    yield


app = FastAPI(
    title="Jalsa API",
    version="1.0.0",
    description="Crowd-intelligence API for predicting crowd intensity.",
    lifespan=lifespan,
)

frontend_origins = os.getenv("JALSA_FRONTEND_ORIGINS", "http://localhost:3000")
allowed_origins = {
    origin.strip()
    for origin in frontend_origins.split(",")
    if origin.strip()
}
allowed_origins.update({
    "http://127.0.0.1:3000",
    "http://localhost:3000",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL: xgb.XGBClassifier | None = None


def load_model():
    global MODEL
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Model not found. Run `python train.py` before starting the API."
        )
    model = xgb.XGBClassifier()
    model.load_model(str(MODEL_PATH))
    MODEL = model



class PredictIn(BaseModel):
    zone: str = Field(default="main_market")
    date: dt.date
    hour: int = Field(default=19, ge=7, le=CLOSE_HOUR)
    rain: bool = False

    @field_validator("zone")
    @classmethod
    def valid_zone(cls, value: str):
        if value not in ZONES:
            raise ValueError(f"zone must be one of {ZONES}")
        return value


class LogIn(BaseModel):
    place: str = Field(min_length=1, max_length=200)
    live_pct: float = Field(ge=0, le=100)
    zone: Optional[str] = None
    timestamp: Optional[dt.datetime] = None

    @field_validator("zone")
    @classmethod
    def valid_zone(cls, value):
        if value is not None and value not in ZONES:
            raise ValueError(f"zone must be one of {ZONES}")
        return value


def ensure_model():
    if MODEL is None:
        load_model()
    return MODEL


def _check_zone(zone: str):
    if zone not in ZONES:
        raise HTTPException(
            status_code=422,
            detail=f"zone must be one of {ZONES}",
        )


def _probabilities(zone: str, date: dt.date, hours: list[int], rain: bool):
    model = ensure_model()
    df = pd.DataFrame({
        "date": [date] * len(hours),
        "hour": hours,
        "zone": [zone] * len(hours),
        "rain": [int(rain)] * len(hours),
    })
    features = build_features(df)[FEATURES]
    probabilities = model.predict_proba(features)

    # XGBoost's class order is [0,1,2,3] for this model.
    expected = probabilities @ np.asarray(LEVEL_MID)
    return probabilities, expected


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": MODEL is not None,
        "model_exists": MODEL_PATH.exists(),
    }


@app.get("/zones")
def zones():
    return {
        "zones": ZONES,
        "places": PLACES,
        "levels": LEVELS,
    }


@app.get("/festivals")
def festivals(upcoming_only: bool = True):
    today = dt.date.today()
    result = []

    for festival_date, (name, weight) in sorted(FESTIVALS.items()):
        if upcoming_only and festival_date < today:
            continue
        result.append({
            "date": festival_date.isoformat(),
            "name": name,
            "weight": weight,
            "days_away": (festival_date - today).days,
        })

    return result


@app.post("/predict")
def predict(q: PredictIn):
    _check_zone(q.zone)

    probabilities, expected = _probabilities(
        q.zone,
        q.date,
        [q.hour],
        q.rain,
    )

    p = probabilities[0]
    index = int(np.argmax(p))

    simulation = mc_draw(
        q.zone,
        q.date,
        q.hour,
        q.rain,
        draws=5000,
    )

    return {
        "zone": q.zone,
        "date": q.date.isoformat(),
        "hour": q.hour,
        "rain": q.rain,
        "level": LEVELS[index],
        "confidence": float(p[index]),
        "probabilities": {
            level: float(prob)
            for level, prob in zip(LEVELS, p)
        },
        "expected_crowd": float(expected[0]),
        "monte_carlo": {
            "p10": float(np.percentile(simulation, 10)),
            "p50": float(np.percentile(simulation, 50)),
            "p90": float(np.percentile(simulation, 90)),
            "prob_high_or_more": float((simulation >= 50).mean()),
        },
    }


@app.get("/forecast/day")
def forecast_day(
    zone: str = "main_market",
    date: dt.date = Query(default_factory=dt.date.today),
    rain: bool = False,
):
    _check_zone(zone)

    hours = list(range(7, CLOSE_HOUR + 1))
    probabilities, expected = _probabilities(zone, date, hours, rain)

    hourly = []
    for hour, p, value in zip(hours, probabilities, expected):
        level = LEVELS[int(np.argmax(p))]
        hourly.append({
            "hour": hour,
            "expected_crowd": float(value),
            "level": level,
            "confidence": float(np.max(p)),
        })

    quietest = sorted(hourly, key=lambda x: x["expected_crowd"])[:3]

    return {
        "zone": zone,
        "date": date.isoformat(),
        "rain": rain,
        "hourly": hourly,
        "best_hours": quietest,
    }


@app.get("/forecast/heatmap")
def heatmap(
    zone: str = "main_market",
    start: dt.date = Query(default_factory=dt.date.today),
    days: int = Query(14, ge=1, le=60),
    rain: bool = False,
):
    _check_zone(zone)

    hours = list(range(7, CLOSE_HOUR + 1))
    output = []

    for offset in range(days):
        current = start + dt.timedelta(days=offset)
        _, expected = _probabilities(zone, current, hours, rain)
        output.append({
            "date": current.isoformat(),
            "hours": hours,
            "expected_crowd": [float(v) for v in expected],
        })

    return {
        "zone": zone,
        "start": start.isoformat(),
        "days": days,
        "rain": rain,
        "data": output,
    }


@app.post("/log")
def log_reading(r: LogIn):
    zone = r.zone

    if zone is None:
        match = next(
            (p for p in PLACES if p["name"].casefold() == r.place.casefold()),
            None,
        )
        zone = match["zone"] if match else "main_market"

    _check_zone(zone)

    timestamp = (
        r.timestamp or dt.datetime.now(dt.timezone.utc)
    ).isoformat(timespec="minutes")

    collect.append_reading(
        timestamp=timestamp,
        place=r.place,
        zone=zone,
        live_pct=r.live_pct,
        source="api",
    )

    return {
        "saved": True,
        "place": r.place,
        "zone": zone,
        "live_pct": r.live_pct,
        "timestamp": timestamp,
    }


@app.get("/metrics")
def metrics():
    if not METRICS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Metrics not found. Run `python train.py` first.",
        )
    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))


@app.post("/retrain")
def retrain(background_tasks: BackgroundTasks):
    def job():
        subprocess.run(
            [sys.executable, str(ROOT / "train.py")],
            cwd=str(ROOT),
            check=False,
        )
        load_model()

    background_tasks.add_task(job)
    return {"status": "retraining_started"}


@app.get("/")
def root():
    return {
        "name": "Jalsa API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
