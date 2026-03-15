from datetime import date, timedelta

import numpy as np

from app.models.bond import DayCountConvention
from app.engine.cashflows import generate_cashflows
from app.engine.pricing import accrued_interest
from app.engine.day_count import year_fraction
from app.engine.interpolation import bootstrap_zero_curve, interpolate_curve


def compute_roll_down(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    treasury_points: list[tuple[float, float]],
    z_spread: float,
    horizon_days: int = 90,
) -> float | None:
    """Compute roll-down: clean price change from aging along the yield curve.

    Uses z-spread over the bootstrapped zero curve for pricing, which accounts
    for the full term structure at every cashflow date rather than using a single
    interpolated yield point (g-spread approach).

    Assumes the yield curve stays static. The bond "rolls down" to shorter
    maturities on the curve after the horizon period.

    Args:
        treasury_points: list of (tenor, yield) from the treasury curve
        z_spread: the bond's z-spread over the zero curve (in decimal, not bps)
        horizon_days: holding period in days (default 90 = ~3 months)

    Returns:
        Roll-down in clean price terms, or None if treasury curve unavailable
    """
    if not treasury_points:
        return None

    zero_curve = bootstrap_zero_curve(treasury_points, frequency)
    cfs = generate_cashflows(settlement_date, maturity_date, coupon, face_value, frequency)

    if not cfs:
        return None

    # Current dirty price via zero curve + z_spread
    pv_now = 0.0
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        t = year_fraction(settlement_date, cf_date, day_count)
        if t > 0:
            z_rate = interpolate_curve(zero_curve, t)
            pv_now += cf["amount"] * np.exp(-(z_rate + z_spread) * t)

    ai_now = accrued_interest(
        settlement_date, maturity_date, coupon, face_value, frequency, day_count
    )
    clean_price_now = pv_now - ai_now

    # After horizon, bond has shorter maturity
    new_settlement = settlement_date + timedelta(days=horizon_days)
    if new_settlement >= maturity_date:
        return face_value - clean_price_now

    # Rolled dirty price: same z_spread, shorter times to each cashflow
    pv_rolled = 0.0
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        t = year_fraction(new_settlement, cf_date, day_count)
        if t > 0:
            z_rate = interpolate_curve(zero_curve, t)
            pv_rolled += cf["amount"] * np.exp(-(z_rate + z_spread) * t)

    ai_rolled = accrued_interest(
        new_settlement, maturity_date, coupon, face_value, frequency, day_count
    )
    clean_price_rolled = pv_rolled - ai_rolled

    return clean_price_rolled - clean_price_now
