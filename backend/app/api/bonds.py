import asyncio
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.engine.carry import compute_carry
from app.engine.day_count import year_fraction
from app.engine.decomposition import decompose_z_spread, decompose_yield
from app.engine.interpolation import interpolate_curve
from app.engine.pricing import price_bond
from app.engine.spreads import compute_z_spread
from app.models.bond import BondAnalytics, BondInput, BondWithAnalytics
from app.models.decomposition import (
    DecompositionMode,
    ZSpreadDecompositionResult,
    PnLDecompositionRequest,
    YieldDecompositionResult,
)
from app.store.memory import Store, get_store

router = APIRouter(prefix="/bonds", tags=["bonds"])


def _build_z_spread_curve(
    bond: BondInput, store: "Store"
) -> list[tuple[float, float]] | None:
    """Build issuer Z-spread curve (in decimal) from same-ticker bonds in the store.

    Returns None if the bond has no ticker or fewer than 2 bonds have Z-spread data.
    """
    if not bond.ticker:
        return None

    raw: list[tuple[float, float]] = []
    for other_id, other_bond in store.bonds.items():
        if other_bond.ticker and other_bond.ticker.upper() == bond.ticker.upper():
            other_analytics = store.bond_analytics.get(other_id)
            if other_analytics and other_analytics.z_spread_bps is not None:
                other_settle = date.fromisoformat(other_bond.settlement_date)
                other_mat = date.fromisoformat(other_bond.maturity_date)
                other_mat_yrs = year_fraction(other_settle, other_mat, other_bond.day_count)
                raw.append((other_mat_yrs, other_analytics.z_spread_bps / 10_000.0))

    if len(raw) < 2:
        return None
    raw.sort(key=lambda p: p[0])
    return raw


def compute_bond_analytics(
    bond: BondInput,
    treasury_pts: list[tuple[float, float]],
    z_spread_curve_pts: list[tuple[float, float]] | None = None,
) -> BondAnalytics:
    """Pure function: compute full analytics for a bond given a treasury curve snapshot.

    z_spread_curve_pts: optional issuer Z-spread curve [(maturity_yrs, z_spread_decimal), ...].
    When provided, roll-down uses the issuer curve (matching the decompose endpoint and
    curves tab). When absent, falls back to the treasury-zero-curve slope method.
    """
    settle = date.fromisoformat(bond.settlement_date)
    mat = date.fromisoformat(bond.maturity_date)
    maturity_yrs = year_fraction(settle, mat, bond.day_count)

    pricing = price_bond(
        settle, mat, bond.coupon, bond.face_value, bond.ytm, bond.frequency, bond.day_count
    )

    carry_result = compute_carry(
        pricing["dirty_price"], bond.coupon, bond.face_value, bond.repo_rate, settle, bond.day_count
    )
    carry_annual = carry_result["carry_annualized"]
    carry_1m = carry_annual / 12
    carry_1y = carry_annual

    z_spread_bps = compute_z_spread(
        settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
        pricing["dirty_price"], treasury_pts,
    )

    if treasury_pts:
        # 1-month (30-day) horizon
        rolled_mat_30 = max(0.01, maturity_yrs - 30 / 365.25)
        z_rd_30 = (
            interpolate_curve(z_spread_curve_pts, rolled_mat_30)
            if z_spread_curve_pts else None
        )
        decomp_1m = decompose_z_spread(
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, treasury_pts, horizon_days=30,
            z_spread_rd_override=z_rd_30, repo_rate=bond.repo_rate,
        )
        roll_1m = decomp_1m["pull_to_par"] + decomp_1m["roll_down"] + decomp_1m["coupon_income"]

        # 1-year (365-day) horizon
        rolled_mat_365 = max(0.01, maturity_yrs - 1.0)
        z_rd_365 = (
            interpolate_curve(z_spread_curve_pts, rolled_mat_365)
            if z_spread_curve_pts else None
        )
        decomp_1y = decompose_z_spread(
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, treasury_pts, horizon_days=365,
            z_spread_rd_override=z_rd_365, repo_rate=bond.repo_rate,
        )
        roll_1y = decomp_1y["pull_to_par"] + decomp_1y["roll_down"] + decomp_1y["coupon_income"]
    else:
        roll_1m = roll_1y = None

    return BondAnalytics(
        bond_id=bond.id,
        dirty_price=pricing["dirty_price"],
        clean_price=pricing["clean_price"],
        accrued_interest=pricing["accrued_interest"],
        carry_1m=carry_1m,
        carry_1y=carry_1y,
        roll_1m=roll_1m,
        roll_1y=roll_1y,
        z_spread_bps=z_spread_bps,
        cashflows=pricing["cashflows"],
    )


async def recompute_all_bonds(store: Store) -> None:
    """Recompute analytics for all bonds using the issuer Z-spread curve.

    Two-pass: Pass 1 gets Z-spreads (needed to build the curve), Pass 2 uses the curve
    for consistent roll-down across bond card, decomposition panel, and curves tab.
    """
    bonds_snapshot = list(store.bonds.items())
    treasury_pts = store.get_treasury_points()

    # --- Pass 1: compute basic analytics (no curve) to obtain Z-spreads ---
    async def _pass1(bond_id: UUID, bond: BondInput):
        analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts)
        return bond_id, analytics

    results1 = await asyncio.gather(*[_pass1(bid, b) for bid, b in bonds_snapshot])

    async with store._lock:
        for bond_id, analytics in results1:
            store.bond_analytics[bond_id] = analytics

    # --- Build Z-spread curves per ticker from Pass 1 results ---
    ticker_curve: dict[str, list[tuple[float, float]]] = {}
    for bond_id, analytics in results1:
        bond = store.bonds.get(bond_id)
        if bond and bond.ticker and analytics.z_spread_bps is not None:
            settle = date.fromisoformat(bond.settlement_date)
            mat = date.fromisoformat(bond.maturity_date)
            mat_yrs = year_fraction(settle, mat, bond.day_count)
            ticker = bond.ticker.upper()
            ticker_curve.setdefault(ticker, []).append((mat_yrs, analytics.z_spread_bps / 10_000.0))

    for ticker in ticker_curve:
        ticker_curve[ticker].sort(key=lambda p: p[0])

    # --- Pass 2: recompute with curve so roll metrics use issuer curve ---
    async def _pass2(bond_id: UUID, bond: BondInput):
        curve_pts = None
        if bond.ticker:
            raw = ticker_curve.get(bond.ticker.upper(), [])
            if len(raw) >= 2:
                curve_pts = raw
        analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts, curve_pts)
        return bond_id, analytics

    results2 = await asyncio.gather(*[_pass2(bid, b) for bid, b in bonds_snapshot])

    async with store._lock:
        for bond_id, analytics in results2:
            store.bond_analytics[bond_id] = analytics


@router.post("", response_model=BondWithAnalytics)
async def create_bond(bond: BondInput, store: Store = Depends(get_store)):
    store.bonds[bond.id] = bond
    treasury_pts = store.get_treasury_points()
    curve_pts = _build_z_spread_curve(bond, store)
    analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts, curve_pts)
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
            curve_pts = _build_z_spread_curve(bond, store)
            analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts, curve_pts)
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
        curve_pts = _build_z_spread_curve(bond, store)
        analytics = await asyncio.to_thread(
            compute_bond_analytics, bond, store.get_treasury_points(), curve_pts
        )
        store.bond_analytics[bond_id] = analytics
    return BondWithAnalytics(bond=bond, analytics=analytics)


@router.put("/{bond_id}", response_model=BondWithAnalytics)
async def update_bond(bond_id: UUID, bond: BondInput, store: Store = Depends(get_store)):
    if bond_id not in store.bonds:
        raise HTTPException(status_code=404, detail="Bond not found")
    bond.id = bond_id
    store.bonds[bond_id] = bond
    curve_pts = _build_z_spread_curve(bond, store)
    analytics = await asyncio.to_thread(
        compute_bond_analytics, bond, store.get_treasury_points(), curve_pts
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

    if request.mode == DecompositionMode.Z_SPREAD:
        # Build issuer Z-spread curve for consistent roll-down with bond card and curves tab
        z_spread_rd_override: float | None = None
        curve_pts = _build_z_spread_curve(bond, store)
        if curve_pts:
            maturity_yrs = year_fraction(settle, mat, bond.day_count)
            horizon_yrs = request.horizon_days / 365.25
            rolled_mat_yrs = max(0.01, maturity_yrs - horizon_yrs)
            z_spread_rd_override = interpolate_curve(curve_pts, rolled_mat_yrs)

        z_override = (
            (request.z_spread_override_bps / 10000)
            if request.z_spread_override_bps is not None
            else None
        )
        result = await asyncio.to_thread(
            decompose_z_spread,
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, treasury_pts, request.horizon_days, z_override, z_spread_rd_override,
            bond.repo_rate,
        )
        return ZSpreadDecompositionResult(**result)
    else:
        result = await asyncio.to_thread(
            decompose_yield,
            settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
            bond.ytm, treasury_pts, request.horizon_days, request.ytm_override, bond.repo_rate,
        )
        return YieldDecompositionResult(**result)


@router.post("/recompute-all")
async def recompute_all(store: Store = Depends(get_store)):
    await recompute_all_bonds(store)
    return {"status": "recomputed", "count": len(store.bonds)}
