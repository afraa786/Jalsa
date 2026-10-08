from datetime import date

import numpy as np
import pandas as pd

from config import LEVELS, ZONES
from features import FEATURES, build_features
from simulate import generate_training_data, mc_draw, scenario_mean


def test_feature_shape():
    df = pd.DataFrame([{
        "date": date(2026, 10, 8),
        "hour": 19,
        "zone": "main_market",
        "rain": 0,
    }])
    result = build_features(df)
    assert list(result.columns) == FEATURES
    assert result.shape == (1, len(FEATURES))


def test_scenario_bounds():
    value = scenario_mean("main_market", date(2026, 10, 8), 19, False)
    assert 0 <= value <= 100


def test_monte_carlo_bounds():
    values = mc_draw("main_market", date(2026, 10, 8), 19, False, draws=1000, seed=1)
    assert len(values) == 1000
    assert np.all(values >= 0)
    assert np.all(values <= 100)


def test_simulator_labels():
    data = generate_training_data(rows=2000)
    assert len(data) == 2000
    assert set(data["label"].unique()).issubset({0, 1, 2, 3})
    assert set(data["zone"].unique()).issubset(set(ZONES))
    assert len(LEVELS) == 4
