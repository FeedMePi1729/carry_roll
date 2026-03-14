import asyncio
from datetime import date
from uuid import UUID

from app.models.bond import BondAnalytics, BondInput
from app.models.portfolio import PortfolioInput
from app.models.treasury import TreasuryCurve, TreasuryCurvePoint

_DEFAULT_TREASURY_POINTS = [
    TreasuryCurvePoint(tenor=0.25, yield_rate=0.0435),
    TreasuryCurvePoint(tenor=0.5,  yield_rate=0.0440),
    TreasuryCurvePoint(tenor=1.0,  yield_rate=0.0445),
    TreasuryCurvePoint(tenor=2.0,  yield_rate=0.0420),
    TreasuryCurvePoint(tenor=3.0,  yield_rate=0.0410),
    TreasuryCurvePoint(tenor=5.0,  yield_rate=0.0400),
    TreasuryCurvePoint(tenor=7.0,  yield_rate=0.0410),
    TreasuryCurvePoint(tenor=10.0, yield_rate=0.0420),
    TreasuryCurvePoint(tenor=20.0, yield_rate=0.0450),
    TreasuryCurvePoint(tenor=30.0, yield_rate=0.0460),
]


class Store:
    def __init__(self):
        self._lock = asyncio.Lock()
        self.treasury_curve: TreasuryCurve | None = TreasuryCurve(
            as_of_date=date.today().isoformat(),
            points=_DEFAULT_TREASURY_POINTS,
        )
        self.bonds: dict[UUID, BondInput] = {}
        self.bond_analytics: dict[UUID, BondAnalytics] = {}
        self.portfolios: dict[UUID, PortfolioInput] = {}

    def get_treasury_points(self) -> list[tuple[float, float]]:
        """Get treasury curve as list of (tenor, yield) tuples."""
        if self.treasury_curve is None:
            return []
        return [(p.tenor, p.yield_rate) for p in self.treasury_curve.points]


store = Store()


def get_store() -> Store:
    """FastAPI dependency that returns the application store.

    Override this in tests to inject a fresh Store instance:
        app.dependency_overrides[get_store] = lambda: Store()
    """
    return store
