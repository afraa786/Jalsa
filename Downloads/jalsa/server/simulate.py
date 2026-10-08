"""Synthetic crowd scenario generator and Monte Carlo inference."""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from config import FESTIVALS, ZONES
from features import build_features


ZONE_MULTIPLIER = {
    "main_market": 1.00,
    "retail": 0.92,
    "food": 1.08,
    "transit": 1.15,
}


def base_crowd(hour: int) -> float:
    """A smooth, human-readable daily pattern from 0-100."""
    morning = 20 * np.exp(-((hour - 10.0) ** 2) / 8.0)
    lunch = 28 * np.exp(-((hour - 14.0) ** 2) / 7.0)
    evening = 62 * np.exp(-((hour - 19.5) ** 2) / 10.0)
    late = 16 * np.exp(-((hour - 22.0) ** 2) / 3.0)
    baseline = 7
    return float(np.clip(baseline + morning + lunch + evening + late, 0, 100))


def scenario_mean(zone: str, d: date, hour: int, rain: bool) -> float:
    if zone not in ZONES:
        raise ValueError(f"Unknown zone: {zone}")

    row = pd.DataFrame([{
        "date": d,
        "hour": hour,
        "zone": zone,
        "rain": int(rain),
    }])
    f = build_features(row).iloc[0]

    value = base_crowd(hour)
    value *= ZONE_MULTIPLIER[zone]
    value *= 1.0 + 0.10 * float(f["is_weekend"])
    value *= 1.0 + 0.45 * float(f["festival_effect"])
    value *= 0.78 if rain else 1.0

    return float(np.clip(value, 0, 100))


def generate_training_data(rows: int = 50_000, seed: int = 42) -> pd.DataFrame:
    """Generate reproducible synthetic observations for model training."""
    if rows < 1000:
        raise ValueError("rows must be at least 1000")

    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2026-01-01")
    offsets = rng.integers(0, 365, size=rows)
    dates = (start + pd.to_timedelta(offsets, unit="D")).date
    hours = rng.integers(7, 24, size=rows)
    zones = rng.choice(ZONES, size=rows)
    rain = rng.binomial(1, 0.18, size=rows)

    # Vectorized simulator for fast training-data generation.
    hours_f = hours.astype(float)
    morning = 20 * np.exp(-((hours_f - 10.0) ** 2) / 8.0)
    lunch = 28 * np.exp(-((hours_f - 14.0) ** 2) / 7.0)
    evening = 62 * np.exp(-((hours_f - 19.5) ** 2) / 10.0)
    late = 16 * np.exp(-((hours_f - 22.0) ** 2) / 3.0)
    expected = 7 + morning + lunch + evening + late

    zone_mult = np.select(
        [zones == "retail", zones == "food", zones == "transit"],
        [0.92, 1.08, 1.15],
        default=1.00,
    )
    expected = expected * zone_mult
    dow = np.array([d.weekday() for d in dates])
    expected *= 1.0 + 0.10 * (dow >= 5)

    festival_effect = np.zeros(rows, dtype=float)
    for festival_day, (_, weight) in FESTIVALS.items():
        days = np.array([(festival_day - d).days for d in dates], dtype=float)
        mask = (days >= 0) & (days <= 14)
        festival_effect[mask] = np.maximum(
            festival_effect[mask], weight * ((15 - days[mask]) / 15.0)
        )
    expected *= 1.0 + 0.45 * festival_effect
    expected *= np.where(rain.astype(bool), 0.78, 1.0)
    expected = np.clip(expected, 0, 100)

    noise = rng.normal(0, 9.0, size=rows)
    crowd = np.clip(expected + noise, 0, 100)

    labels = np.select(
        [crowd < 25, crowd < 50, crowd < 75],
        [0, 1, 2],
        default=3,
    ).astype(int)

    return pd.DataFrame({
        "date": dates,
        "hour": hours,
        "zone": zones,
        "rain": rain,
        "crowd": crowd.round(2),
        "label": labels,
    })


def mc_draw(
    zone: str,
    d: date,
    hour: int,
    rain: bool,
    draws: int = 5000,
    seed: int | None = None,
) -> np.ndarray:
    """Draw plausible crowd intensities for uncertainty estimates."""
    if draws < 100:
        raise ValueError("draws must be at least 100")

    mean = scenario_mean(zone, d, hour, rain)
    rng = np.random.default_rng(seed)

    # Uncertainty grows slightly in extreme conditions.
    std = 7.0 + (12.0 if mean > 75 else 0.0) + (4.0 if rain else 0.0)
    return np.clip(rng.normal(mean, std, size=draws), 0, 100)
