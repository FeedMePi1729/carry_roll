"""Bond P&L decomposition engine.

Decomposes bond P&L into carry, pull-to-par, roll-down, and spread/yield change
components using full repricing (no duration/convexity approximations).
"""

from datetime import date, timedelta

import numpy as np
from scipy.optimize import brentq

from app.engine.cashflows import generate_cashflows
from app.engine.day_count import year_fraction
from app.engine.interpolation import bootstrap_zero_curve, interpolate_curve
from app.engine.pricing import dirty_price as flat_dirty_price
from app.models.bond import DayCountConvention


def _dirty_price_on_curve(
    settlement: date,
    maturity: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    treasury_points: list[tuple[float, float]],
    spread: float,
) -> float:
    """Compute dirty price by discounting cashflows on the gov zero curve + spread.

    Uses continuous compounding: PV = sum(CF_i * exp(-(z_i + spread) * t_i))
    where z_i is the bootstrapped zero rate at each cashflow time.
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
        pv += cf["amount"] * np.exp(-(z_rate + spread) * t)

    return float(pv)


def _cashflows_in_interval(
    settlement: date,
    new_settlement: date,
    maturity: date,
    coupon: float,
    face_value: float,
    frequency: int,
) -> float:
    """Sum of cashflow amounts paid in the interval (settlement, new_settlement]."""
    cfs = generate_cashflows(settlement, maturity, coupon, face_value, frequency)
    total = 0.0
    for cf in cfs:
        cf_date = date.fromisoformat(cf["date"])
        if settlement < cf_date <= new_settlement:
            total += cf["amount"]
    return total


def decompose_z_spread(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    ytm: float,
    treasury_points: list[tuple[float, float]],
    horizon_days: int = 1,
    z_spread_override: float | None = None,
    z_spread_rd_override: float | None = None,
    repo_rate: float = 0.0,
) -> dict:
    """Decompose bond P&L into carry, pull-to-par, roll-down, and spread change (Z-spread mode).

    Uses full repricing on the bootstrapped zero curve + Z-spread.
    Z-spread is calibrated via root-finding so that P₀ exactly matches the YTM-derived
    dirty price — no pricing error at the base.

    Four components (accrual-based, financed P&L):
        carry         = c·F·dt - repo·P₀·dt   (smooth coupon accrual minus financing cost)
        pull_to_par   = (P_ptp - P0) + CF - c·F·dt  (pure price convergence toward par)
        roll_down     = P_rd  - P_ptp          (Z-spread rolls with zero curve slope)
        spread_change = P2   - P_rd            (pure credit spread repricing vs natural roll)
        total         = (P2 - P0) + CF - repo·P₀·dt  ✓  (financed holding-period P&L)

    Carry is accrual-based (not lumpy): always non-zero, matches bond card Carry (1d/1w/1y).
    Pull-to-par absorbs (CF - coupon_income) so the identity holds across all horizons.

    Default (no override): z_new = z_spread_rd  →  spread_change = 0
    Override:              z_new = z_spread_override

    Roll-down spread: z_spread_rd = z_spread_t + (zero(T-dt) - zero(T))
    Preserves total yield (zero(T) + z_spread_t) expressed as Z-spread at new maturity.
    On an upward-sloping curve zero(T-dt) < zero(T), so z_spread_rd < z_spread_t → price rises.

    Intermediate prices:
        P0    = price(t,    mat,  z_t)   — current price (exact = YTM dirty price)
        P_ptp = price(t+dt, mat,  z_t)   — aged, actual remaining tenor, same spread
        P_rd  = price(t+dt, mat,  z_rd)  — aged, actual remaining tenor, rolled spread
        P2    = price(t+dt, mat,  z_new) — aged, actual remaining tenor, final spread

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
        z_spread_override: final Z-spread at t+dt in decimal (None = natural roll, spread_change=0)
        repo_rate: annualised repo/financing rate (decimal); used for carry and financed total

    Returns:
        dict with decomposition results matching ZSpreadDecompositionResult fields
    """
    new_settlement = settlement_date + timedelta(days=horizon_days)

    # Observed market price: YTM-derived dirty price (the price we calibrate Z-spread to)
    p0_market = flat_dirty_price(
        settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count
    )

    # Z-spread: solve for constant spread to zero curve that reproduces p0_market
    def _price_at_z(z: float) -> float:
        return _dirty_price_on_curve(
            settlement_date, maturity_date, coupon, face_value, frequency,
            day_count, treasury_points, z,
        )

    z_spread_t = brentq(lambda z: _price_at_z(z) - p0_market, -0.10, 0.50, xtol=1e-8)

    # Roll-down spread: total yield preserved at rolled maturity
    # z_spread_rd = z_spread_t + (zero(T-dt) - zero(T))
    # On upward-sloping curve: zero(T-dt) < zero(T) → z_spread_rd < z_spread_t → price rises
    maturity_yrs = year_fraction(settlement_date, maturity_date, day_count)
    zero_curve = bootstrap_zero_curve(treasury_points, frequency)
    zero_at_current_mat = interpolate_curve(zero_curve, maturity_yrs)
    rolled_mat_yrs = max(0.01, maturity_yrs - horizon_days / 365.25)
    zero_at_new_mat = interpolate_curve(zero_curve, rolled_mat_yrs)
    z_spread_rd = z_spread_t + (zero_at_new_mat - zero_at_current_mat)

    # If an issuer Z-spread curve is provided, use its value at rolled maturity instead
    if z_spread_rd_override is not None:
        z_spread_rd = z_spread_rd_override

    # Default: natural roll (spread_change = 0). Override: user-specified spread.
    z_new = z_spread_override if z_spread_override is not None else z_spread_rd

    # P0: current dirty price (exact = p0_market by construction of Z-spread)
    p0 = _dirty_price_on_curve(
        settlement_date, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, z_spread_t,
    )

    # P_ptp: aged dirty price at same spread — price convergence reference
    p_ptp = _dirty_price_on_curve(
        new_settlement, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, z_spread_t,
    )

    # P_rd: aged dirty price at rolled Z-spread
    p_rd = _dirty_price_on_curve(
        new_settlement, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, z_spread_rd,
    )

    # P2: aged dirty price at final Z-spread (actual ending price)
    p2 = _dirty_price_on_curve(
        new_settlement, maturity_date, coupon, face_value, frequency,
        day_count, treasury_points, z_new,
    )

    # CF: cashflows paid in (t, t+dt]
    cf = _cashflows_in_interval(
        settlement_date, new_settlement, maturity_date, coupon, face_value, frequency,
    )

    # Accrual-based carry: smooth coupon income minus repo financing cost
    # Consistent with carry.py and bond card Carry (1d/1w/1y). Always non-zero.
    dt = horizon_days / 365.25
    coupon_income = coupon * face_value * dt
    financing_cost = repo_rate * p0 * dt

    carry = coupon_income - financing_cost
    # pull_to_par: pure price convergence toward par, independent of coupon payment timing.
    # CF term corrects for the ex-coupon price drop when a coupon is paid in the window.
    pull_to_par = (p_ptp - p0) + cf - coupon_income
    roll_down = p_rd - p_ptp        # benefit from spread rolling with zero curve slope
    spread_change = p2 - p_rd       # extra spread change (0 when no override)
    total = carry + pull_to_par + roll_down + spread_change  # = P2 - P0 + CF - financing_cost
    residual = total - (p2 - p0 + cf - financing_cost)

    return {
        "mode": "z_spread",
        "carry": carry,
        "pull_to_par": pull_to_par,
        "roll_down": roll_down,
        "spread_change": spread_change,
        "total": total,
        "p0": p0,
        "p_ptp": p_ptp,
        "p_rd": p_rd,
        "p2": p2,
        "cf": cf,
        "coupon_income": coupon_income,
        "financing_cost": financing_cost,
        "residual": residual,
        "z_spread_t_bps": z_spread_t * 10000,
        "z_spread_rd_bps": z_spread_rd * 10000,
    }


def decompose_yield(
    settlement_date: date,
    maturity_date: date,
    coupon: float,
    face_value: float,
    frequency: int,
    day_count: DayCountConvention,
    ytm: float,
    treasury_points: list[tuple[float, float]],
    horizon_days: int = 1,
    ytm_override: float | None = None,
    repo_rate: float = 0.0,
) -> dict:
    """Decompose bond P&L into carry, pull-to-par, roll-down, and yield change (Yield mode).

    Uses flat-yield pricing (semi-annual compounding) throughout.

    Four components (accrual-based, financed P&L):
        carry         = c·F·dt - repo·P₀·dt   (smooth coupon accrual minus financing cost)
        pull_to_par   = (P_ptp - P0) + CF - c·F·dt  (pure price convergence toward par)
        roll_down     = P_rd  - P_ptp          (YTM rolls down the par curve)
        yield_change  = P2   - P_rd            (pure yield repricing vs natural roll)
        total         = (P2 - P0) + CF - repo·P₀·dt  ✓

    Default (no override): ybar_new = y_rd  →  yield_change = 0
    Override:              ybar_new = ytm_override

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
        ytm_override: final YTM at t+dt in decimal (None = natural roll, yield_change=0)
        repo_rate: annualised repo/financing rate (decimal); used for carry and financed total

    Returns:
        dict with decomposition results matching YieldDecompositionResult fields
    """
    new_settlement = settlement_date + timedelta(days=horizon_days)

    # Roll-down YTM: bond's excess over par treasury preserved at rolled maturity
    maturity_yrs = year_fraction(settlement_date, maturity_date, day_count)
    treasury_yield_at_mat = interpolate_curve(treasury_points, maturity_yrs)
    bond_excess = ytm - treasury_yield_at_mat
    rolled_mat_yrs = max(0.01, maturity_yrs - horizon_days / 365.25)
    treasury_yield_at_new = interpolate_curve(treasury_points, rolled_mat_yrs)
    y_rd = treasury_yield_at_new + bond_excess

    # Default: natural roll (yield_change = 0). Override: user-specified YTM.
    ybar_new = ytm_override if ytm_override is not None else y_rd

    # P0: current dirty price at flat YTM
    p0 = flat_dirty_price(
        settlement_date, maturity_date, coupon, face_value, ytm, frequency, day_count,
    )

    # P_ptp: aged dirty price at same YTM — price convergence reference
    p_ptp = flat_dirty_price(
        new_settlement, maturity_date, coupon, face_value, ytm, frequency, day_count,
    )

    # P_rd: aged dirty price at rolled YTM
    p_rd = flat_dirty_price(
        new_settlement, maturity_date, coupon, face_value, y_rd, frequency, day_count,
    )

    # P2: aged dirty price at final YTM (actual ending price)
    p2 = flat_dirty_price(
        new_settlement, maturity_date, coupon, face_value, ybar_new, frequency, day_count,
    )

    # CF: cashflows paid in (t, t+dt]
    cf = _cashflows_in_interval(
        settlement_date, new_settlement, maturity_date, coupon, face_value, frequency,
    )

    # Accrual-based carry: smooth coupon income minus repo financing cost
    dt = horizon_days / 365.25
    coupon_income = coupon * face_value * dt
    financing_cost = repo_rate * p0 * dt

    carry = coupon_income - financing_cost
    pull_to_par = (p_ptp - p0) + cf - coupon_income
    roll_down = p_rd - p_ptp
    yield_change = p2 - p_rd
    total = carry + pull_to_par + roll_down + yield_change  # = P2 - P0 + CF - financing_cost
    residual = total - (p2 - p0 + cf - financing_cost)

    return {
        "mode": "yield",
        "carry": carry,
        "pull_to_par": pull_to_par,
        "roll_down": roll_down,
        "yield_change": yield_change,
        "total": total,
        "p0": p0,
        "p_ptp": p_ptp,
        "p_rd": p_rd,
        "p2": p2,
        "cf": cf,
        "coupon_income": coupon_income,
        "financing_cost": financing_cost,
        "residual": residual,
        "y_rd_pct": y_rd * 100,
    }
