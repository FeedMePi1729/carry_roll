"""Bond P&L decomposition engine.

Decomposes bond P&L into carry, roll-down, and spread/yield change
components using full repricing (no duration/convexity approximations).
"""

from datetime import date, timedelta

import numpy as np

from app.engine.cashflows import generate_cashflows
from app.engine.day_count import year_fraction
from app.engine.interpolation import bootstrap_zero_curve, interpolate_curve
from app.engine.pricing import dirty_price
from app.models.bond import DayCountConvention


def _dirty_price_on_curve(
    settlement: date,
    maturity: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    treasury_points: list[tuple[float, float]],
    g_spread: float,
) -> float:
    """Compute dirty price by discounting cashflows on the gov zero curve + g-spread.

    Uses continuous compounding: PV = sum(CF_i * exp(-(z_i + g_spread) * t_i))
    where z_i is the bootstrapped zero rate at each cashflow time.

    Args:
        settlement: settlement date (pricing as-of date)
        maturity: bond maturity date
        coupon: annual coupon rate (decimal, e.g. 0.05)
        face_value: par value
        frequency: coupons per year
        day_count: day count convention
        treasury_points: list of (tenor, par_yield) tuples
        g_spread: g-spread in decimal (e.g. 0.005 for 50 bps)

    Returns:
        Dirty price (sum of discounted future cashflows)
    """
    zero_curve = bootstrap_zero_curve(treasury_points, frequency)
    cfs = generate_cashflows(settlement, maturity, coupon, face_value, frequency)

    if not cfs:
        return face_value

    pv = 0.0
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        t = year_fraction(settlement, cf_date, day_count)
        if t <= 0:
            continue
        z_rate = interpolate_curve(zero_curve, t)
        pv += cf["amount"] * np.exp(-(z_rate + g_spread) * t)

    return float(pv)


def _cashflows_in_interval(
    settlement: date,
    new_settlement: date,
    maturity: date,
    coupon: float,
    face_value: float,
    frequency: int,
) -> float:
    """Sum of cashflow amounts paid in the interval (settlement, new_settlement].

    Args:
        settlement: start of interval (exclusive)
        new_settlement: end of interval (inclusive)
        maturity: bond maturity date
        coupon: annual coupon rate (decimal)
        face_value: par value
        frequency: coupons per year

    Returns:
        Total cashflow amount in the interval
    """
    cfs = generate_cashflows(settlement, maturity, coupon, face_value, frequency)
    total = 0.0
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        if settlement < cf_date <= new_settlement:
            total += cf["amount"]
    return total


def decompose_g_spread(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    ytm: float,
    treasury_points: list[tuple[float, float]],
    horizon_days: int = 1,
    g_spread_override: float | None = None,
) -> dict:
    """Decompose bond P&L into carry, roll, and spread change (G-spread mode).

    Uses full repricing on the bootstrapped zero curve + g-spread for curve-based
    prices and flat-yield (semi-annual compounding) for carry reference prices.

    Three components:
        carry = Pf - P_flat + CF          (time passage at flat yield)
        roll  = (P1 - P0) - (Pf - P_flat) (change in richness vs flat)
        spread_change = P2 - P1            (pure spread repricing)
        total = carry + roll + spread_change

    Args:
        settlement_date: current settlement date
        maturity_date: bond maturity date
        coupon: annual coupon rate (decimal)
        face_value: par value
        frequency: coupons per year
        day_count: day count convention
        ytm: bond's current yield to maturity (decimal)
        treasury_points: list of (tenor, par_yield) tuples from treasury curve
        horizon_days: holding period in days
        g_spread_override: new g-spread at t+dt in decimal (None = unchanged)

    Returns:
        dict with decomposition results matching GSpreadDecompositionResult fields
    """
    new_settlement = settlement_date + timedelta(days=horizon_days)

    # Current g-spread: ytm minus interpolated treasury yield at bond maturity
    maturity_yrs = year_fraction(settlement_date, maturity_date, day_count)
    treasury_yield_at_mat = interpolate_curve(treasury_points, maturity_yrs)
    g_spread_t = ytm - treasury_yield_at_mat

    # New g-spread for t+dt
    g_new = g_spread_override if g_spread_override is not None else g_spread_t

    # P0: current dirty price on gov curve + current spread
    p0 = _dirty_price_on_curve(
        settlement_date, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, g_spread_t,
    )

    # P_flat: current dirty price at flat YTM (semi-annual compounding)
    p_flat = dirty_price(
        settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count,
    )

    # Pf: aged dirty price at flat YTM (carry reference)
    pf = dirty_price(
        new_settlement, maturity_date, coupon, face_value, ytm, frequency, day_count,
    )

    # P1: aged dirty price on gov curve + same spread
    p1 = _dirty_price_on_curve(
        new_settlement, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, g_spread_t,
    )

    # P2: aged dirty price on gov curve + new spread
    p2 = _dirty_price_on_curve(
        new_settlement, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, g_new,
    )

    # CF: cashflows paid in (t, t+dt]
    cf = _cashflows_in_interval(
        settlement_date, new_settlement, maturity_date, coupon, face_value, frequency,
    )

    # Decomposition
    carry = pf - p_flat + cf
    roll = (p1 - p0) - (pf - p_flat)
    spread_change = p2 - p1
    total = carry + roll + spread_change
    residual = total - (p2 - p0 + cf)

    return {
        "mode": "g_spread",
        "carry": carry,
        "roll": roll,
        "spread_change": spread_change,
        "total": total,
        "p0": p0,
        "p_flat": p_flat,
        "pf": pf,
        "p1": p1,
        "p2": p2,
        "cf": cf,
        "residual": residual,
    }


def decompose_yield(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    ytm: float,
    horizon_days: int = 1,
    ytm_override: float | None = None,
) -> dict:
    """Decompose bond P&L into carry (including roll) and yield change (Yield mode).

    Uses flat-yield pricing (semi-annual compounding) throughout.

    Two components:
        carry_incl_roll = P1 - P0 + CF     (full carry including roll)
        yield_change = P2 - P1              (pure yield repricing)
        total = carry_incl_roll + yield_change

    Args:
        settlement_date: current settlement date
        maturity_date: bond maturity date
        coupon: annual coupon rate (decimal)
        face_value: par value
        frequency: coupons per year
        day_count: day count convention
        ytm: bond's current yield to maturity (decimal)
        horizon_days: holding period in days
        ytm_override: new YTM at t+dt in decimal (None = unchanged)

    Returns:
        dict with decomposition results matching YieldDecompositionResult fields
    """
    new_settlement = settlement_date + timedelta(days=horizon_days)

    # New YTM for t+dt
    ybar_new = ytm_override if ytm_override is not None else ytm

    # P0: current dirty price at flat YTM
    p0 = dirty_price(
        settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count,
    )

    # P1: aged dirty price at same YTM
    p1 = dirty_price(
        new_settlement, maturity_date, coupon, face_value, ytm, frequency, day_count,
    )

    # P2: aged dirty price at new YTM
    p2 = dirty_price(
        new_settlement, maturity_date, coupon, face_value, ybar_new, frequency, day_count,
    )

    # CF: cashflows paid in (t, t+dt]
    cf = _cashflows_in_interval(
        settlement_date, new_settlement, maturity_date, coupon, face_value, frequency,
    )

    # Decomposition
    carry_incl_roll = p1 - p0 + cf
    yield_change = p2 - p1
    total = carry_incl_roll + yield_change
    residual = total - (p2 - p0 + cf)

    return {
        "mode": "yield",
        "carry_incl_roll": carry_incl_roll,
        "yield_change": yield_change,
        "total": total,
        "p0": p0,
        "p1": p1,
        "p2": p2,
        "cf": cf,
        "residual": residual,
    }
