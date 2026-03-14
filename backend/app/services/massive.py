import os

import httpx
from app.models.treasury import TreasuryCurve, TreasuryCurvePoint

_BASE_URL = "https://api.massive.com"

# Maps API field names to tenor in years
_TENOR_MAP: dict[str, float] = {
    "yield_1_month": 1 / 12,
    "yield_3_month": 0.25,
    "yield_6_month": 0.5,
    "yield_1_year": 1.0,
    "yield_2_year": 2.0,
    "yield_3_year": 3.0,
    "yield_5_year": 5.0,
    "yield_7_year": 7.0,
    "yield_10_year": 10.0,
    "yield_20_year": 20.0,
    "yield_30_year": 30.0,
}


async def fetch_treasury_curve() -> TreasuryCurve:
    """Fetch the most recent daily treasury yield curve from the Massive API."""
    api_key = os.environ["MASSIVE_API_KEY"]
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_BASE_URL}/fed/v1/treasury-yields",
            headers={"Authorization": f"Bearer {api_key}"},
            params={"limit": 1, "order": "desc"},
            timeout=10.0,
        )
        resp.raise_for_status()

    data = resp.json()
    row = data["results"][0]

    points = [
        TreasuryCurvePoint(tenor=tenor, yield_rate=row[field] / 100)
        for field, tenor in _TENOR_MAP.items()
        if row.get(field) is not None
    ]
    points.sort(key=lambda p: p.tenor)

    return TreasuryCurve(as_of_date=row["date"], points=points)
