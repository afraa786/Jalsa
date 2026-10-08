from datetime import date

from fastapi.testclient import TestClient

import api


def test_root():
    with TestClient(api.app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["name"] == "Jalsa API"


def test_zones():
    with TestClient(api.app) as client:
        response = client.get("/zones")
        assert response.status_code == 200
        body = response.json()
        assert "zones" in body
        assert "places" in body
        assert "levels" in body


def test_predict():
    with TestClient(api.app) as client:
        response = client.post("/predict", json={
            "zone": "main_market",
            "date": date.today().isoformat(),
            "hour": 19,
            "rain": False,
        })
        assert response.status_code == 200
        body = response.json()
        assert body["level"] in ["Low", "Moderate", "High", "Very High"]
        assert 0 <= body["confidence"] <= 1
        assert 0 <= body["expected_crowd"] <= 100
        assert set(body["probabilities"]) == {"Low", "Moderate", "High", "Very High"}
        assert "monte_carlo" in body


def test_invalid_hour():
    with TestClient(api.app) as client:
        response = client.post("/predict", json={
            "zone": "main_market",
            "date": date.today().isoformat(),
            "hour": 5,
            "rain": False,
        })
        assert response.status_code == 422


def test_heatmap():
    with TestClient(api.app) as client:
        response = client.get(
            "/forecast/heatmap",
            params={"zone": "main_market", "days": 3},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 3
        assert len(body["data"][0]["hours"]) == 17
