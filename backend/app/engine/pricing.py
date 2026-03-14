from datetime import date
import numpy as np
from app.models.bond import DayCountConvention
from app.engine.day_count import year_fraction
from app.engine.cashflows import (
    generate_cashflows,
    get_previous_coupon_date,
    get_next_coupon_date,
)


def dirty_price(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    ytm: float,
    frequency: int,
    day_count: DayCountConvention,
) -> float:
    """Compute dirty price by discounting all future cashflows at YTM."""
    cfs = generate_cashflows(settlement_date, maturity_date, coupon, face_value, frequency)
    if not cfs:
        return face_value

    price = 0.0
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        t = year_fraction(settlement_date, cf_date, day_count)
        if t <= 0:
            continue
        discount = (1 + ytm / frequency) ** (t * frequency)
        price += cf["amount"] / discount

    return price


def accrued_interest(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
) -> float:
    """Compute accrued interest from last coupon date to settlement."""
    prev_coupon = get_previous_coupon_date(settlement_date, maturity_date, frequency)
    next_coupon = get_next_coupon_date(settlement_date, maturity_date, frequency)

    if prev_coupon >= settlement_date:
        return 0.0

    days_accrued = year_fraction(prev_coupon, settlement_date, day_count)
    days_period = year_fraction(prev_coupon, next_coupon, day_count)

    if days_period <= 0:
        return 0.0

    coupon_payment = face_value * coupon / frequency
    return coupon_payment * (days_accrued / days_period)


def clean_price(dirty: float, accrued: float) -> float:
    return dirty - accrued


def price_bond(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    ytm: float,
    frequency: int,
    day_count: DayCountConvention,
) -> dict:
    """Compute all price components for a bond."""
    dp = dirty_price(settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count)
    ai = accrued_interest(settlement_date, maturity_date, coupon, face_value, frequency, day_count)
    cp = clean_price(dp, ai)
    cfs = generate_cashflows(settlement_date, maturity_date, coupon, face_value, frequency)

    return {
        "dirty_price": dp,
        "clean_price": cp,
        "accrued_interest": ai,
        "cashflows": cfs,
    }
