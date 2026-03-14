from datetime import date, timedelta
from app.models.bond import DayCountConvention
from app.engine.pricing import accrued_interest, dirty_price
from app.engine.day_count import year_fraction
from app.engine.interpolation import interpolate_curve


def compute_roll_down(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    ytm: float,
    frequency: int,
    day_count: DayCountConvention,
    treasury_points: list[tuple[float, float]],
    spread: float,
    horizon_days: int = 90,
) -> float | None:
    """Compute roll-down: clean price change from aging along the yield curve.

    Assumes the yield curve stays static. The bond "rolls down" to a
    shorter maturity point on the curve after the horizon period.

    Returns the change in *clean* price so that carry + roll_down equals
    total P&L at an unchanged yield curve without double-counting coupon accrual.

    Args:
        treasury_points: list of (tenor, yield) from the treasury curve
        spread: the bond's spread over treasuries (g-spread)
        horizon_days: holding period in days (default 90 = ~3 months)

    Returns:
        Roll-down in clean price terms, or None if treasury curve unavailable
    """
    if not treasury_points:
        return None

    # Current clean price
    price_now = dirty_price(
        settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count
    )
    ai_now = accrued_interest(
        settlement_date, maturity_date, coupon, face_value, frequency, day_count
    )
    clean_price_now = price_now - ai_now

    # After horizon, bond has shorter maturity
    new_settlement = settlement_date + timedelta(days=horizon_days)
    if new_settlement >= maturity_date:
        return face_value - clean_price_now

    new_maturity_yrs = year_fraction(new_settlement, maturity_date, day_count)

    # Interpolate treasury yield at the new maturity
    new_treasury_yield = interpolate_curve(treasury_points, new_maturity_yrs)

    # New yield = treasury at shorter maturity + spread
    new_ytm = new_treasury_yield + spread

    # Reprice at new settlement, same maturity date, new yield
    price_rolled = dirty_price(
        new_settlement, maturity_date, coupon, face_value, new_ytm, frequency, day_count
    )
    ai_rolled = accrued_interest(
        new_settlement, maturity_date, coupon, face_value, frequency, day_count
    )
    clean_price_rolled = price_rolled - ai_rolled

    return clean_price_rolled - clean_price_now
