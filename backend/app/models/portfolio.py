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
    name: str = ""
    weighted_carry_1m: float
    weighted_carry_1y: float
    weighted_roll_1m: Optional[float] = None
    weighted_roll_1y: Optional[float] = None
    positions: list[dict] = []
