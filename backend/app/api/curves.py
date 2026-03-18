import asyncio
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.bonds import compute_bond_analytics
from app.engine.day_count import year_fraction
from app.models.curve import BondMoveInput, CurveAnalytics
from app.store.memory import Store, get_store

router = APIRouter(prefix="/curves", tags=["curves"])


@router.get("/tickers")
async def list_tickers(store: Store = Depends(get_store)):
    """List all tickers that have bonds."""
    tickers = {b.ticker for b in store.bonds.values() if b.ticker}
    return sorted(tickers)


@router.get("/{ticker}", response_model=CurveAnalytics)
async def get_curve(ticker: str, store: Store = Depends(get_store)):
    """Get YTM curve and aggregate stats for a ticker."""
    bonds_on_curve = [
        (bid, b)
        for bid, b in store.bonds.items()
        if b.ticker and b.ticker.upper() == ticker.upper()
    ]
    if not bonds_on_curve:
        raise HTTPException(status_code=404, detail=f"No bonds found for ticker {ticker}")

    treasury_pts = store.get_treasury_points()
    points = []
    g_spreads = []

    for bond_id, bond in bonds_on_curve:
        analytics = store.bond_analytics.get(bond_id)
        if analytics is None:
            analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts)
            store.bond_analytics[bond_id] = analytics

        settle = date.fromisoformat(bond.settlement_date)
        mat = date.fromisoformat(bond.maturity_date)
        maturity_yrs = year_fraction(settle, mat, bond.day_count)

        points.append({
            "maturity": maturity_yrs,
            "ytm": bond.ytm,
            "bond_id": str(bond_id),
            "name": bond.name,
            "g_spread_bps": analytics.g_spread_bps,
            "carry_daily": analytics.carry_daily,
            "carry_annual": analytics.carry_annual,
            "roll_daily": analytics.roll_daily,
            "roll_annual": analytics.roll_annual,
        })

        if analytics.g_spread_bps is not None:
            g_spreads.append(analytics.g_spread_bps)

    points.sort(key=lambda p: p["maturity"])
    avg_g = sum(g_spreads) / len(g_spreads) if g_spreads else None

    return CurveAnalytics(
        ticker=ticker,
        points=points,
        avg_g_spread_bps=avg_g,
    )


@router.patch("/{ticker}/bond/{bond_id}", response_model=CurveAnalytics)
async def move_bond_on_curve(
    ticker: str, bond_id: UUID, move: BondMoveInput, store: Store = Depends(get_store)
):
    """Move a bond on the curve (drag interaction). Updates YTM and optionally maturity."""
    bond = store.bonds.get(bond_id)
    if bond is None:
        raise HTTPException(status_code=404, detail="Bond not found")

    bond.ytm = move.ytm
    if move.maturity_years is not None:
        settle = date.fromisoformat(bond.settlement_date)
        bond.maturity_date = (settle + timedelta(days=int(move.maturity_years * 365.25))).isoformat()

    store.bonds[bond_id] = bond
    analytics = await asyncio.to_thread(compute_bond_analytics, bond, store.get_treasury_points())
    store.bond_analytics[bond_id] = analytics

    return await get_curve(ticker, store)
