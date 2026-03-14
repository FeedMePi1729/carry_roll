import numpy as np


def compute_hazard_rate(spread_bps: float | None, recovery_rate: float) -> float | None:
    """Compute constant hazard rate from spread and recovery rate.

    lambda = spread / (1 - R)
    """
    if spread_bps is None:
        return None
    spread = spread_bps / 10000  # Convert from bps
    if recovery_rate >= 1.0:
        return None
    return spread / (1 - recovery_rate)


def compute_survival_curve(
    hazard_rate: float | None,
    max_years: float = 30,
    step: float = 0.5,
) -> list[dict]:
    """Compute survival probabilities S(t) = exp(-lambda * t)."""
    if hazard_rate is None:
        return []

    times = np.arange(0, max_years + step, step)
    probs = np.exp(-hazard_rate * times)

    return [{"t": float(t), "prob": float(p)} for t, p in zip(times, probs)]
