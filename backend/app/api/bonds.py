import asyncio
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.engine.carry import compute_carry
from app.engine.decomposition import decompose_g_spread, decompose_yield
from app.engine.pricing import price_bond
from app.engine.spreads import compute_g_spread
from app.models.bond import BondAnalytics, BondInput, BondWithAnalytics
from app.models.decomposition import (
    DecompositionMode,
    GSpreadDecompositionResult,
    PnLDecompositionRequest,
    YieldDecompositionResult,
)
from app.store.memory import Store, get_store

router = APIRouter(prefix="/bonds", tags=["bonds"])


def compute_bond_analytics(
    bond: BondInput, treasury_pts: list[tuple[float, float]]
) -> BondAnalytics:
    """Pure function: compute full analytics for a bond given a treasury curve snapshot.

    Accepts treasury points explicitly so the function has no side effects and is
    straightforward to unit-test without a running Store.
    """
    settle = date.fromisoformat(bond.settlement_date)
    mat = date.fromisoformat(bond.maturity_date)

    pricing = price_bond(
        settle, mat, bond.coupon, bond.face_value, bond.ytm, bond.frequency, bond.day_count
    )

    carry_result = compute_carry(
        pricing["dirty_price"], bond.coupon, bond.face_value, bond.repo_rate, settle, bond.day_count
    )
    carry_annual = carry_result["carry_annualized"]
    carry_daily = carry_annual / 365
    carry_weekly = carry_annual * 7 / 365

    g_spread_bps = compute_g_spread(bond.ytm, settle, mat, bond.day_count, treasury_pts)

    if treasury_pts:
        decomp = decompose_g_spread(
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, treasury_pts, horizon_days=1,
        )
        roll_daily = decomp["roll"]
        roll_weekly = roll_daily * 7
        roll_annual = roll_daily * 365
    else:
        roll_daily = roll_weekly = roll_annual = None

    return BondAnalytics(
        bond_id=bond.id,
        dirty_price=pricing["dirty_price"],
        clean_price=pricing["clean_price"],
        accrued_interest=pricing["accrued_interest"],
        carry_daily=carry_daily,
        carry_weekly=carry_weekly,
        carry_annual=carry_annual,
        roll_daily=roll_daily,
        roll_weekly=roll_weekly,
        roll_annual=roll_annual,
        g_spread_bps=g_spread_bps,
        cashflows=pricing["cashflows"],
    )


async def recompute_all_bonds(store: Store) -> None:
    """Recompute analytics for all bonds in parallel using the thread pool.

    Snapshots the bonds dict before launching work so concurrent mutations
    during a long recompute don't cause iteration errors.
    """
    # Snapshot under cooperative exclusion (no await, so atomic w.r.t. other coroutines)
    bonds_snapshot = list(store.bonds.items())
    treasury_pts = store.get_treasury_points()

    async def _one(bond_id: UUID, bond: BondInput):
        analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts)
        return bond_id, analytics

    results = await asyncio.gather(*[_one(bid, b) for bid, b in bonds_snapshot])

    async with store._lock:
        for bond_id, analytics in results:
            store.bond_analytics[bond_id] = analytics


@router.post("", response_model=BondWithAnalytics)
async def create_bond(bond: BondInput, store: Store = Depends(get_store)):
    store.bonds[bond.id] = bond
    treasury_pts = store.get_treasury_points()
    analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts)
    store.bond_analytics[bond.id] = analytics
    return BondWithAnalytics(bond=bond, analytics=analytics)


@router.get("", response_model=list[BondWithAnalytics])
async def list_bonds(store: Store = Depends(get_store)):
    bonds_snapshot = list(store.bonds.items())
    treasury_pts = store.get_treasury_points()
    result = []
    for bond_id, bond in bonds_snapshot:
        analytics = store.bond_analytics.get(bond_id)
        if analytics is None:
            analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts)
            store.bond_analytics[bond_id] = analytics
        result.append(BondWithAnalytics(bond=bond, analytics=analytics))
    return result


@router.get("/{bond_id}", response_model=BondWithAnalytics)
async def get_bond(bond_id: UUID, store: Store = Depends(get_store)):
    bond = store.bonds.get(bond_id)
    if bond is None:
        raise HTTPException(status_code=404, detail="Bond not found")
    analytics = store.bond_analytics.get(bond_id)
    if analytics is None:
        analytics = await asyncio.to_thread(
            compute_bond_analytics, bond, store.get_treasury_points()
        )
        store.bond_analytics[bond_id] = analytics
    return BondWithAnalytics(bond=bond, analytics=analytics)


@router.put("/{bond_id}", response_model=BondWithAnalytics)
async def update_bond(bond_id: UUID, bond: BondInput, store: Store = Depends(get_store)):
    if bond_id not in store.bonds:
        raise HTTPException(status_code=404, detail="Bond not found")
    bond.id = bond_id
    store.bonds[bond_id] = bond
    analytics = await asyncio.to_thread(
        compute_bond_analytics, bond, store.get_treasury_points()
    )
    store.bond_analytics[bond_id] = analytics
    return BondWithAnalytics(bond=bond, analytics=analytics)


@router.delete("/{bond_id}")
async def delete_bond(bond_id: UUID, store: Store = Depends(get_store)):
    if bond_id not in store.bonds:
        raise HTTPException(status_code=404, detail="Bond not found")
    del store.bonds[bond_id]
    store.bond_analytics.pop(bond_id, None)
    return {"status": "deleted"}


@router.post("/{bond_id}/decompose")
async def decompose_bond_pnl(
    bond_id: UUID,
    request: PnLDecompositionRequest,
    store: Store = Depends(get_store),
):
    """Decompose bond P&L into carry, roll, and spread/yield change components."""
    bond = store.bonds.get(bond_id)
    if bond is None:
        raise HTTPException(status_code=404, detail="Bond not found")

    treasury_pts = store.get_treasury_points()
    settle = date.fromisoformat(bond.settlement_date)
    mat = date.fromisoformat(bond.maturity_date)

    if request.mode == DecompositionMode.G_SPREAD:
        g_override = (
            (request.g_spread_override_bps / 10000)
            if request.g_spread_override_bps is not None
            else None
        )
        result = await asyncio.to_thread(
            decompose_g_spread,
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, treasury_pts, request.horizon_days, g_override,
        )
        return GSpreadDecompositionResult(**result)
    else:
        result = await asyncio.to_thread(
            decompose_yield,
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, request.horizon_days, request.ytm_override,
        )
        return YieldDecompositionResult(**result)


@router.post("/recompute-all")
async def recompute_all(store: Store = Depends(get_store)):
    await recompute_all_bonds(store)
    return {"status": "recomputed", "count": len(store.bonds)}
