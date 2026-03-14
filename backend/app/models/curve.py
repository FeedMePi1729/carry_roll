from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class CurveGroup(BaseModel):
    ticker: str
    bond_ids: list[UUID]


class CurveAnalytics(BaseModel):
    ticker: str
    points: list[dict] = []
    avg_g_spread_bps: Optional[float] = None
    avg_z_spread_bps: Optional[float] = None
    survival_curve: list[dict] = []


class BondMoveInput(BaseModel):
    ytm: float
    maturity_years: Optional[float] = None
