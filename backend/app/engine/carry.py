from datetime import date, timedelta
from app.models.bond import DayCountConvention
from app.engine.day_count import year_fraction


def compute_carry(
    dirty_price: float,
    coupon: float,
    face_value: float,
    repo_rate: float,
    settlement_date: date,
    day_count: DayCountConvention,
    holding_days: int = 90,
) -> dict:
    """Compute carry for a bond over a holding period.

    carry = coupon income - financing cost
    """
    end_date = settlement_date + timedelta(days=holding_days)
    dt = year_fraction(settlement_date, end_date, day_count)

    if dt <= 0:
        return {"carry": 0.0, "carry_annualized": 0.0}

    coupon_income = face_value * coupon * dt
    financing_cost = dirty_price * repo_rate * dt
    carry = coupon_income - financing_cost

    carry_annualized = carry / dt

    return {
        "carry": carry,
        "carry_annualized": carry_annualized,
    }
