from datetime import date

from dateutil.relativedelta import relativedelta


def generate_cashflows(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
) -> list[dict]:
    """Generate cashflow schedule for a bond.

    Returns list of {date, amount, type} dicts for all future cashflows.
    Coupon dates are generated backward from maturity.
    """
    months_per_period = 12 // frequency
    coupon_payment = face_value * coupon / frequency

    # Generate coupon dates backward from maturity
    coupon_dates = []
    d = maturity_date
    while d > settlement_date:
        coupon_dates.append(d)
        d = d - relativedelta(months=months_per_period)
    coupon_dates.sort()

    cashflows = []
    for i, cd in enumerate(coupon_dates):
        cf = {"date": cd.isoformat(), "amount": coupon_payment, "type": "coupon"}
        if i == len(coupon_dates) - 1:
            # Last cashflow includes principal
            cf["amount"] += face_value
            cf["type"] = "coupon+principal"
        cashflows.append(cf)

    return cashflows


def get_previous_coupon_date(
    settlement_date: date, maturity_date: date, frequency: int
) -> date:
    """Find the most recent coupon date on or before settlement."""
    months_per_period = 12 // frequency
    d = maturity_date
    prev = d
    while d > settlement_date:
        prev = d
        d = d - relativedelta(months=months_per_period)
    return d


def get_next_coupon_date(
    settlement_date: date, maturity_date: date, frequency: int
) -> date:
    """Find the next coupon date after settlement."""
    months_per_period = 12 // frequency
    d = maturity_date
    dates = []
    while d > settlement_date:
        dates.append(d)
        d = d - relativedelta(months=months_per_period)
    dates.sort()
    return dates[0] if dates else maturity_date
