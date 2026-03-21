from datetime import date

import numpy as np
from scipy.optimize import brentq

from app.engine.cashflows import generate_cashflows
from app.engine.day_count import year_fraction
from app.engine.interpolation import bootstrap_zero_curve, interpolate_curve
from app.models.bond import DayCountConvention


def compute_z_spread(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    dirty_price_market: float,
    treasury_points: list[tuple[float, float]],
) -> float | None:
    """Z-spread = constant spread to zero curve that reproduces the observed dirty price.

    Solves: dirty_price_market = Σ CF_i · exp(-(z_i + Z) · τ_i)
    where z_i are bootstrapped zero rates. Uses Brent's method.

    Args:
        dirty_price_market: observed (or YTM-derived) dirty price to calibrate to
        treasury_points: list of (tenor, par_yield) tuples

    Returns:
        Z-spread in basis points, or None if no curve data.
    """
    if not treasury_points:
        return None

    zero_curve = bootstrap_zero_curve(treasury_points, frequency)
    cfs = generate_cashflows(settlement_date, maturity_date, coupon, face_value, frequency)

    if not cfs:
        return None

    def price_at_spread(z: float) -> float:
        pv = 0.0
        for cf in cfs:
            cf_date = date.fromisoformat(cf["date"])
            t = year_fraction(settlement_date, cf_date, day_count)
            if t > 0:
                z_rate = interpolate_curve(zero_curve, t)
                pv += cf["amount"] * np.exp(-(z_rate + z) * t)
        return pv

    try:
        z = brentq(lambda z: price_at_spread(z) - dirty_price_market, -0.10, 0.50, xtol=1e-8)
        return float(z) * 10000  # bps
    except ValueError:
        return None
