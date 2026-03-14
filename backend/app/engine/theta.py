from datetime import date, timedelta
from app.models.bond import DayCountConvention
from app.engine.pricing import dirty_price


def compute_theta(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    ytm: float,
    frequency: int,
    day_count: DayCountConvention,
    dt_days: int = 1,
) -> float:
    """Compute theta: price change from pure time decay at constant yield.

    theta = price(T - dt, ytm) - price(T, ytm)
    """
    price_now = dirty_price(
        settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count
    )

    # Age the bond by dt_days
    new_settlement = settlement_date + timedelta(days=dt_days)
    if new_settlement >= maturity_date:
        # Bond matures, return par + final coupon - current price
        return face_value - price_now

    price_aged = dirty_price(
        new_settlement, maturity_date, coupon, face_value, ytm, frequency, day_count
    )

    return price_aged - price_now
