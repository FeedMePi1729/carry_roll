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


class BondMoveInput(BaseModel):
    ytm: float
    maturity_years: Optional[float] = None
