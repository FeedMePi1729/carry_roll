from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID, uuid4


class PortfolioPosition(BaseModel):
    bond_id: UUID
    weight: float


class PortfolioInput(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    positions: list[PortfolioPosition]


class PortfolioAnalytics(BaseModel):
    portfolio_id: UUID
    weighted_carry: float
    weighted_carry_annualized: float
    weighted_roll_down: Optional[float] = None
    weighted_theta: float
    positions: list[dict] = []
