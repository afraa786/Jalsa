"""Safe local logger for real busyness observations.

This module deliberately does not pretend that Google provides an area-level
crowd count. A reading is a 0-100 place-level busyness signal that can later
be aggregated across multiple monitored places.
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

from config import PLACES, ZONES

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
LOG_PATH = DATA_DIR / "live_log.csv"

HEADER = ["timestamp", "place", "zone", "live_pct", "source"]


def _ensure_log():
    DATA_DIR.mkdir(exist_ok=True)
    if not LOG_PATH.exists():
        with LOG_PATH.open("w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(HEADER)


def append_reading(
    timestamp: str,
    place: str,
    zone: str,
    live_pct: float,
    source: str = "manual",
):
    if zone not in ZONES:
        raise ValueError(f"Unknown zone: {zone}")
    if not 0 <= live_pct <= 100:
        raise ValueError("live_pct must be between 0 and 100")

    _ensure_log()
    with LOG_PATH.open("a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([
            timestamp,
            place,
            zone,
            round(float(live_pct), 2),
            source,
        ])


def append(values):
    """Backward-compatible helper used by the API."""
    timestamp, place, zone, live_pct, source = values
    append_reading(timestamp, place, zone, live_pct, source or "api")


def read_rows():
    _ensure_log()
    with LOG_PATH.open("r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def manual_once():
    place = input("Place: ").strip()
    zone = input(f"Zone {ZONES}: ").strip()
    pct = float(input("Live busyness % (0-100): ").strip())
    append_reading(
        datetime.now().isoformat(timespec="minutes"),
        place,
        zone,
        pct,
        "manual",
    )
    print(f"Saved to {LOG_PATH}")


if __name__ == "__main__":
    manual_once()
