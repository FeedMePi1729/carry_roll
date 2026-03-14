from datetime import date

import numpy as np
from scipy.optimize import brentq

from app.engine.cashflows import generate_cashflows
from app.engine.day_count import year_fraction
from app.engine.interpolation import bootstrap_zero_curve, interpolate_curve
from app.models.bond import DayCountConvention


def compute_g_spread(
    ytm: float,
    settlement_date: date,
    maturity_date: date,
    day_count: DayCountConvention,
    treasury_points: list[tuple[float, float]],
) -> float | None:
    """G-spread = YTM - interpolated treasury yield at same maturity."""
    if not treasury_points:
        return None

    maturity_yrs = year_fraction(settlement_date, maturity_date, day_count)
    treasury_yield = interpolate_curve(treasury_points, maturity_yrs)
    return (ytm - treasury_yield) * 10000  # Convert to bps


def compute_z_spread(
    market_price: float,
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    treasury_points: list[tuple[float, float]],
) -> float | None:
    """Solve for z-spread: constant spread over zero curve that reprices the bond.

    market_price = sum(CF_i * exp(-(z_i + z_spread) * t_i))
    where z_i are zero rates from the bootstrapped treasury curve.
    """
    if not treasury_points:
        return None

    zero_curve = bootstrap_zero_curve(treasury_points, frequency)
    cfs = generate_cashflows(
        settlement_date, maturity_date, coupon, face_value, frequency
    )

    if not cfs:
        return None

    cf_times = []
    cf_amounts = []
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        t = year_fraction(settlement_date, cf_date, day_count)
        if t > 0:
            cf_times.append(t)
            cf_amounts.append(cf["amount"])

    if not cf_times:
        return None

    cf_times = np.array(cf_times)
    cf_amounts = np.array(cf_amounts)

    # Get zero rates at each cashflow time
    zero_rates = np.array([interpolate_curve(zero_curve, t) for t in cf_times])

    def price_error(z_spread):
        discount_factors = np.exp(-(zero_rates + z_spread) * cf_times)
        return np.sum(cf_amounts * discount_factors) - market_price

    try:
        z_spread = brentq(price_error, -0.05, 0.50, xtol=1e-8)
        return z_spread * 10000  # Convert to bps
    except (ValueError, RuntimeError):
        return None
