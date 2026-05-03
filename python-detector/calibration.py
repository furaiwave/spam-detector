from __future__ import annotations

import numpy as np
from schemas import Confidence


def temperature_scaling(logit: float, temperature: float = 1.5) -> Confidence:
    """
    Temperature scaling — покращує calibration без зміни rank.
    T > 1 робить confidence більш консервативним.
    """
    scaled = logit / temperature
    prob   = 1.0 / (1.0 + np.exp(-scaled))
    return prob  # type: ignore[return-value]


def isotonic_calibrate(probs: list[float]) -> list[float]:
    """Нормалізує список ймовірностей до суми 1.0"""
    arr   = np.array(probs, dtype=np.float64)
    arr   = np.clip(arr, 0, 1)
    total = arr.sum()
    if total == 0:
        return [1.0 / len(probs)] * len(probs)
    return (arr / total).tolist()