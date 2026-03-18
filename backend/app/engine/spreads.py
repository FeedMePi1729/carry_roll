from datetime import date

from app.engine.day_count import year_fraction
from app.engine.interpolation import interpolate_curve
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
