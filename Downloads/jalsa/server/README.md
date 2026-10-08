# Jalsa Backend

Jalsa is a crowd-intelligence backend that predicts crowd intensity for a selected zone, date and hour.

It uses:

- Monte Carlo simulation to generate synthetic training scenarios
- XGBoost for 4-class crowd prediction
- FastAPI for REST APIs
- CSV logging for real busyness observations
- Optional Next.js frontend through CORS

## Important data note

Jalsa does not claim to receive an exact number of people from Google.

A live busyness percentage is treated as a place-level signal. Area-level intelligence can be created by collecting signals from multiple places and aggregating them.

Synthetic model metrics describe performance on the synthetic simulator. They are not proof of real-world accuracy.

When at least 150 valid real readings are present in `data/live_log.csv`, `python train.py` blends those readings into training with 5x sample weight. The resulting `model/metrics.json` records whether real-data blending occurred.

## 1. Requirements

Python 3.10+ is recommended.

## 2. Create a virtual environment

Windows:

```powershell
py -3 -m venv .venv
.venv\Scripts\activate
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

## 4. Train the model

```bash
python train.py
```

This creates:

```text
model/xgb.json
model/metrics.json
```

## 5. Start the API

```bash
uvicorn api:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/health
```

## 6. Run tests

With the API stopped:

```bash
pytest -q
```

## 7. Next.js frontend

Set:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

The API allows the local Next.js origins:

```text
http://localhost:3000
http://127.0.0.1:3000
```

## 8. Docker deployment

From the `server` directory, build and run the API:

```bash
docker build -t jalsa-api .
docker run --rm -p 8000:8000 \
  -e JALSA_FRONTEND_ORIGIN=https://your-frontend.example \
  -v jalsa-data:/app/data \
  jalsa-api
```

Open `http://localhost:8000/docs` to check the API. The image uses Python 3.12, installs the XGBoost runtime library, runs as a non-root user, honors a platform-provided `PORT` (default `8000`), and exposes a `/health` container health check. If `model/xgb.json` is not present in the build context, the image trains the synthetic model during the build. The named volume keeps `/log` observations across container replacements.

Set `JALSA_FRONTEND_ORIGIN` to the deployed frontend origin. Do not expose `/log` or `/retrain` publicly without adding authentication; CSV storage is intended for a single container, not concurrent multi-instance deployment.

## API endpoints

### GET /
Basic service information.

### GET /health
Checks API and model status.

### GET /zones
Returns configured zones, monitored places and crowd classes.

### GET /festivals
Returns configured upcoming festivals.

### POST /predict

Example:

```json
{
  "zone": "main_market",
  "date": "2026-10-08",
  "hour": 19,
  "rain": false
}
```

Returns:

- crowd level
- confidence
- class probabilities
- expected crowd
- Monte Carlo P10/P50/P90
- probability of high-or-more crowd

### GET /forecast/day

Example:

```text
/forecast/day?zone=main_market&date=2026-10-08&rain=false
```

Returns the full 07:00-23:00 forecast and the three quietest hours.

### GET /forecast/heatmap

Example:

```text
/forecast/heatmap?zone=main_market&start=2026-10-08&days=14
```

Returns a day-by-hour grid.

### POST /log

Example:

```json
{
  "place": "Vaishali Nagar Market",
  "live_pct": 68,
  "zone": "main_market"
}
```

The reading is saved to:

```text
data/live_log.csv
```

### GET /metrics
Returns persisted training metrics.

### POST /retrain
Starts model retraining in a FastAPI background task.

## Project structure

```text
jalsa_backend/
├── api.py
├── collect.py
├── config.py
├── features.py
├── simulate.py
├── train.py
├── requirements.txt
├── .env.example
├── README.md
├── data/
│   └── .gitkeep
├── model/
│   └── .gitkeep
└── tests/
    ├── test_api.py
    └── test_core.py
```

## Changing monitored places

Edit `config.py`.

Do not put fake Google data in the project. If collecting place-level readings, record them through `/log`.

## Production note

Before deploying publicly:

- restrict CORS to your real frontend domain
- protect `/log` and `/retrain` with authentication
- use a database instead of CSV for multi-user production
- store secrets in environment variables
- use HTTPS
