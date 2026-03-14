from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID, uuid4


class DayCountConvention(str, Enum):
    ACT_360 = "ACT/360"
    ACT_365 = "ACT/365"
    THIRTY_360 = "30/360"


class BondInput(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    ticker: Optional[str] = None
    coupon: float  # Annual rate, e.g. 0.05 = 5%
    face_value: float = 100.0
    settlement_date: str  # ISO date YYYY-MM-DD
    maturity_date: str  # ISO date YYYY-MM-DD
    day_count: DayCountConvention = DayCountConvention.ACT_365
    frequency: int = 2  # Coupons per year
    ytm: float
    repo_rate: float
    g_spread: Optional[float] = None
    z_spread: Optional[float] = None
    recovery_rate: float = 0.4
    market_price: Optional[float] = None


class BondAnalytics(BaseModel):
    bond_id: UUID
    dirty_price: float
    clean_price: float
    accrued_interest: float
    carry: float
    carry_annualized: float
    roll_down: Optional[float] = None
    theta: float
    g_spread_bps: Optional[float] = None
    z_spread_bps: Optional[float] = None
    hazard_rate: Optional[float] = None
    survival_probabilities: list[dict] = []
    cashflows: list[dict] = []


class BondWithAnalytics(BaseModel):
    bond: BondInput
    analytics: BondAnalytics
