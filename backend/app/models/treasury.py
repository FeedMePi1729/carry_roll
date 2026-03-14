from pydantic import BaseModel


class TreasuryCurvePoint(BaseModel):
    tenor: float  # In years
    yield_rate: float  # e.g. 0.045 = 4.5%


class TreasuryCurve(BaseModel):
    as_of_date: str  # ISO date
    points: list[TreasuryCurvePoint]
