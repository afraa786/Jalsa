"""Jalsa configuration.

Keep place names and festival dates here. The backend does not claim to know
exact people counts; live_pct is a place-level busyness signal on a 0-100 scale.
"""
from datetime import date

LEVELS = ["Low", "Moderate", "High", "Very High"]
LEVEL_MID = [15.0, 37.5, 62.5, 87.5]

ZONES = [
    "main_market",
    "retail",
    "food",
    "transit",
]

PLACES = [
    {"name": "Vaishali Nagar Market", "zone": "main_market"},
    {"name": "Retail Cluster", "zone": "retail"},
    {"name": "Food Street", "zone": "food"},
    {"name": "Transit Point", "zone": "transit"},
]

# These are configurable example festival dates for the project.
# Verify dates before using them in an academic report.
FESTIVALS = {
    **{
        date(2026, 10, day): ("Navratri", 0.85)
        for day in range(11, 20)
    },
    date(2026, 11, 8): ("Diwali", 1.00),
    date(2026, 11, 9): ("Diwali Holiday", 0.85),
}

OPEN_HOUR = 7
CLOSE_HOUR = 23
