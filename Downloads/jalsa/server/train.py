"""Train and persist the Jalsa XGBoost classifier."""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from config import LEVELS
from collect import LOG_PATH
from features import FEATURES, build_features
from simulate import generate_training_data

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "model"
MODEL_DIR.mkdir(exist_ok=True)

MODEL_PATH = MODEL_DIR / "xgb.json"
METRICS_PATH = MODEL_DIR / "metrics.json"



def load_real_data() -> tuple:
    """Load logged place-level readings and convert 0-100 signals to classes."""
    if not LOG_PATH.exists():
        return None, None

    try:
        df = __import__("pandas").read_csv(LOG_PATH)
    except Exception:
        return None, None

    required = {"timestamp", "zone", "live_pct"}
    if not required.issubset(df.columns) or len(df) == 0:
        return None, None

    df["timestamp"] = __import__("pandas").to_datetime(df["timestamp"], errors="coerce")
    df["live_pct"] = __import__("pandas").to_numeric(df["live_pct"], errors="coerce")
    df = df.dropna(subset=["timestamp", "zone", "live_pct"]).copy()
    df = df[df["live_pct"].between(0, 100)]
    df = df[df["zone"].isin(__import__("config").ZONES)]
    if df.empty:
        return None, None

    df["date"] = df["timestamp"].dt.date
    df["hour"] = df["timestamp"].dt.hour.clip(7, 23)
    df["rain"] = 0
    df["label"] = __import__("numpy").select(
        [df["live_pct"] < 25, df["live_pct"] < 50, df["live_pct"] < 75],
        [0, 1, 2],
        default=3,
    ).astype(int)
    return df[["date", "hour", "zone", "rain", "label"]], df

def train(rows: int | None = None) -> dict:
    rows = rows or int(os.getenv("JALSA_SIM_ROWS", "50000"))
    data = generate_training_data(rows=rows, seed=42)
    real_data, real_raw = load_real_data()

    if real_data is not None and len(real_data) >= 150:
        # Real readings are weighted 5x, matching the project methodology.
        real_features = build_features(real_data[["date", "hour", "zone", "rain"]])
        X_syn = build_features(data[["date", "hour", "zone", "rain"]])
        y_syn = data["label"].astype(int)
        X_real = real_features
        y_real = real_data["label"].astype(int)
        X = __import__("pandas").concat([X_syn, X_real], ignore_index=True)
        y = __import__("pandas").concat([y_syn, y_real], ignore_index=True)
        sample_weight = __import__("numpy").concatenate([
            __import__("numpy").ones(len(X_syn)),
            __import__("numpy").full(len(X_real), 5.0),
        ])
    else:
        X = build_features(data[["date", "hour", "zone", "rain"]])
        y = data["label"].astype(int)
        sample_weight = None

    if sample_weight is None:
        sample_weight = __import__("numpy").ones(len(X))

    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, sample_weight,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    model = XGBClassifier(
        n_estimators=220,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.90,
        colsample_bytree=0.90,
        objective="multi:softprob",
        num_class=4,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=2,
    )

    model.fit(X_train, y_train, sample_weight=w_train)
    predictions = model.predict(X_test).astype(int)

    accuracy = float(accuracy_score(y_test, predictions))
    report = classification_report(
        y_test,
        predictions,
        target_names=LEVELS,
        output_dict=True,
        zero_division=0,
    )

    model.save_model(str(MODEL_PATH))

    metrics = {
        "model": "XGBoost",
        "task": "4-class crowd intensity classification",
        "classes": LEVELS,
        "synthetic_training_rows": int(rows),
        "real_data_rows": int(len(real_data)) if real_data is not None else 0,
        "real_data_blended": bool(real_data is not None and len(real_data) >= 150),
        "real_data_weight": 5.0 if real_data is not None and len(real_data) >= 150 else 0.0,
        "test_rows": int(len(X_test)),
        "accuracy": round(accuracy, 4),
        "classification_report": report,
        "features": FEATURES,
        "note": (
            "Synthetic-data metrics indicate how well the model learns the "
            "simulator. They are not real-world market accuracy."
        ),
    }

    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    result = train()
    print(json.dumps({
        "model": result["model"],
        "accuracy": result["accuracy"],
        "model_path": str(MODEL_PATH),
        "metrics_path": str(METRICS_PATH),
    }, indent=2))
