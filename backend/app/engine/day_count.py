from datetime import date

from app.models.bond import DayCountConvention


def year_fraction(start: date, end: date, convention: DayCountConvention) -> float:
    if convention == DayCountConvention.ACT_360:
        return (end - start).days / 360.0
    elif convention == DayCountConvention.ACT_365:
        return (end - start).days / 365.0
    elif convention == DayCountConvention.THIRTY_360:
        d1 = min(start.day, 30)
        d2 = min(end.day, 30) if d1 >= 30 else end.day
        return (
            360 * (end.year - start.year) + 30 * (end.month - start.month) + (d2 - d1)
        ) / 360.0
    raise ValueError(f"Unknown convention: {convention}")
