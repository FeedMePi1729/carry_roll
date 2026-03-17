from enum import Enum
from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class DecompositionMode(str, Enum):
    G_SPREAD = "g_spread"
    YIELD = "yield"


class PnLDecompositionRequest(BaseModel):
    mode: DecompositionMode = DecompositionMode.G_SPREAD
    horizon_days: int = 1
    g_spread_override_bps: Optional[float] = None  # user override for new g-spread at t+dt (in bps)
    ytm_override: Optional[float] = None  # user override for new YTM at t+dt (decimal, e.g. 0.05)


class GSpreadDecompositionResult(BaseModel):
    mode: str = "g_spread"
    carry: float
    roll: float
    spread_change: float
    total: float
    # Intermediate prices for transparency ("show working")
    p0: float  # P(t; yG_t, g_t) — current dirty price on gov curve + spread
    p_flat: float  # P(t; flat ybar_t) — current dirty price at flat YTM
    pf: float  # P(t+dt; flat ybar_t) — aged dirty price at flat YTM (carry ref)
    p1: float  # P(t+dt; yG_t, g_t) — aged at same curve + same spread
    p2: float  # P(t+dt; yG_t, g_new) — aged at same curve + new spread
    cf: float  # cash flows in [t, t+dt]
    residual: float  # should be ~0 (sanity check: total vs p2-p0+cf)


class YieldDecompositionResult(BaseModel):
    mode: str = "yield"
    carry_incl_roll: float
    yield_change: float
    total: float
    # Intermediate prices
    p0: float  # P(t; ybar_t) — current dirty price at flat YTM
    p1: float  # P(t+dt; ybar_t) — aged at same YTM
    p2: float  # P(t+dt; ybar_new) — aged at new YTM
    cf: float  # cash flows in [t, t+dt]
    residual: float
