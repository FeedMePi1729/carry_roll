from enum import Enum
from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class DecompositionMode(str, Enum):
    Z_SPREAD = "z_spread"
    YIELD = "yield"


class PnLDecompositionRequest(BaseModel):
    mode: DecompositionMode = DecompositionMode.Z_SPREAD
    horizon_days: int = 1
    z_spread_override_bps: Optional[float] = None  # user override for final Z-spread (in bps)
    ytm_override: Optional[float] = None  # user override for final YTM (decimal, e.g. 0.05)


class ZSpreadDecompositionResult(BaseModel):
    mode: str = "z_spread"
    carry: float        # accrual carry: c·F·dt - repo·P₀·dt (always non-zero)
    pull_to_par: float  # pure price convergence: (P_ptp - P0) + CF - c·F·dt
    roll_down: float    # Z-spread rolling with zero curve slope = P_rd - P_ptp
    spread_change: float  # extra spread repricing = P2 - P_rd (0 if no override)
    total: float        # financed P&L: P2 - P0 + CF - financing_cost
    # Intermediate prices for transparency ("show working")
    p0: float     # P(t; mat, z_t)          — current dirty price (exact = YTM price)
    p_ptp: float  # P(t+dt; mat, z_t)       — aged, same spread (price convergence ref)
    p_rd: float   # P(t+dt; mat, z_rd)      — aged, rolled spread
    p2: float     # P(t+dt; mat, z_new)     — aged, final spread (actual ending price)
    cf: float           # cash flows in (t, t+dt]
    coupon_income: float   # smooth coupon accrual: c·F·dt
    financing_cost: float  # repo financing cost: repo·P₀·dt
    residual: float  # should be ~0 (sanity check: total vs p2-p0+cf-financing_cost)
    # Natural roll reference values
    z_spread_t_bps: float   # current Z-spread in bps
    z_spread_rd_bps: float  # natural roll Z-spread in bps (z_t + Δzero), horizon-dependent


class YieldDecompositionResult(BaseModel):
    mode: str = "yield"
    carry: float        # accrual carry: c·F·dt - repo·P₀·dt (always non-zero)
    pull_to_par: float  # pure price convergence: (P_ptp - P0) + CF - c·F·dt
    roll_down: float    # YTM rolling down par curve = P_rd - P_ptp
    yield_change: float  # extra yield repricing = P2 - P_rd (0 if no override)
    total: float        # financed P&L: P2 - P0 + CF - financing_cost
    # Intermediate prices
    p0: float     # P(t; mat, ytm)         — current dirty price
    p_ptp: float  # P(t+dt; mat, ytm)      — aged, same YTM
    p_rd: float   # P(t+dt; mat, y_rd)     — aged, rolled YTM
    p2: float     # P(t+dt; mat, ytm_new)  — aged, final YTM (actual ending price)
    cf: float           # cash flows in (t, t+dt]
    coupon_income: float   # smooth coupon accrual: c·F·dt
    financing_cost: float  # repo financing cost: repo·P₀·dt
    residual: float
    # Natural roll reference value
    y_rd_pct: float  # natural roll YTM in % (treasury at rolled maturity + excess), horizon-dependent
