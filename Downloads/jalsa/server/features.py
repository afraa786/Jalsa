"""Feature engineering shared by simulation, training and inference."""
from __future__ import annotations

import math
from datetime import date

import numpy as np
import pandas as pd

from config import FESTIVALS


FEATURES = [
    "hour",
    "hour_sin",
    "hour_cos",
    "dow",
    "dow_sin",
    "dow_cos",
    "is_weekend",
    "days_to_festival",
    "festival_effect",
    "rain",
    "zone_code",
]

ZONE_CODES = {
    "main_market": 0,
    "retail": 1,
    "food": 2,
    "transit": 3,
}


def _festival_features(d: date):
    if not FESTIVALS:
        return 999.0, 0.0

    future = [(day, weight) for day, (_, weight) in FESTIVALS.items() if day >= d]
    if not future:
        return 999.0, 0.0

    festival_day, weight = min(future, key=lambda x: x[0])
    days = (festival_day - d).days

    # Strongest in the week immediately before the festival, still visible
    # during the preceding second week.
    if 0 <= days <= 14:
        effect = weight * ((15 - days) / 15.0)
    else:
        effect = 0.0

    # Festival day / holiday gets the full configured effect.
    if days == 0:
        effect = weight

    return float(days), float(effect)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    required = {"date", "hour", "zone", "rain"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    out = df.copy()
    out["date"] = pd.to_datetime(out["date"]).dt.date
    out["hour"] = pd.to_numeric(out["hour"], errors="raise").astype(int)
    out["rain"] = pd.to_numeric(out["rain"], errors="raise").astype(int).clip(0, 1)

    out["dow"] = [d.weekday() for d in out["date"]]
    out["is_weekend"] = (out["dow"] >= 5).astype(int)

    out["hour_sin"] = np.sin(2 * math.pi * (out["hour"] - 7) / 17)
    out["hour_cos"] = np.cos(2 * math.pi * (out["hour"] - 7) / 17)
    out["dow_sin"] = np.sin(2 * math.pi * out["dow"] / 7)
    out["dow_cos"] = np.cos(2 * math.pi * out["dow"] / 7)

    festival = [_festival_features(d) for d in out["date"]]
    out["days_to_festival"] = [x[0] for x in festival]
    out["festival_effect"] = [x[1] for x in festival]

    unknown = set(out["zone"]) - set(ZONE_CODES)
    if unknown:
        raise ValueError(f"Unknown zone(s): {sorted(unknown)}")
    out["zone_code"] = out["zone"].map(ZONE_CODES).astype(int)

    return out[FEATURES]
