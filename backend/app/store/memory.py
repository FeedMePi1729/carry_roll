import asyncio
from datetime import date
from uuid import UUID

from app.models.bond import BondAnalytics, BondInput, DayCountConvention
from app.models.portfolio import PortfolioInput
from app.models.treasury import TreasuryCurve, TreasuryCurvePoint

# Fixed UUIDs for seed bonds so they are stable across restarts
_SEED_BOND_IDS = [
    UUID("00000000-0000-0000-0000-000000000001"),
    UUID("00000000-0000-0000-0000-000000000002"),
    UUID("00000000-0000-0000-0000-000000000003"),
    UUID("00000000-0000-0000-0000-000000000004"),
]

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


def _make_seed_bonds() -> dict[UUID, BondInput]:
    """Build the four ADGB demo bonds at startup.

    YTMs are set to interpolated default treasury yield + target z-spread:
      2Y:  4.20% + 30 bps = 4.50%
      5Y:  4.00% + 50 bps = 4.50%
      10Y: 4.20% + 70 bps = 4.90%
      30Y: 4.60% + 150 bps = 6.10%
    Coupons equal YTMs so bonds price at par on the default curve.
    """
    today = date.today()
    repo_rate = 0.0435  # ~3-month treasury rate

    def mat(years: int) -> str:
        try:
            return today.replace(year=today.year + years).isoformat()
        except ValueError:  # Feb-29 edge case
            return today.replace(year=today.year + years, day=28).isoformat()

    specs = [
        dict(id=_SEED_BOND_IDS[0], name="ADGB 2Y",  coupon=0.0450, ytm=0.0450, years=2),
        dict(id=_SEED_BOND_IDS[1], name="ADGB 5Y",  coupon=0.0450, ytm=0.0450, years=5),
        dict(id=_SEED_BOND_IDS[2], name="ADGB 10Y", coupon=0.0490, ytm=0.0490, years=10),
        dict(id=_SEED_BOND_IDS[3], name="ADGB 30Y", coupon=0.0610, ytm=0.0610, years=30),
    ]
    bonds = [
        BondInput(
            id=s["id"],
            name=s["name"],
            ticker="ADGB",
            coupon=s["coupon"],
            face_value=100.0,
            settlement_date=today.isoformat(),
            maturity_date=mat(s["years"]),
            day_count=DayCountConvention.ACT_365,
            frequency=2,
            ytm=s["ytm"],
            repo_rate=repo_rate,
        )
        for s in specs
    ]
    return {b.id: b for b in bonds}


class Store:
    def __init__(self):
        self._lock = asyncio.Lock()
        self.treasury_curve: TreasuryCurve | None = TreasuryCurve(
            as_of_date=date.today().isoformat(),
            points=_DEFAULT_TREASURY_POINTS,
        )
        self.bonds: dict[UUID, BondInput] = _make_seed_bonds()
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
