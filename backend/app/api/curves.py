import asyncio
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.bonds import compute_bond_analytics
from app.engine.day_count import year_fraction
from app.engine.decomposition import decompose_z_spread
from app.engine.interpolation import interpolate_curve
from app.models.curve import BondMoveInput, CurveAnalytics
from app.store.memory import Store, get_store

router = APIRouter(prefix="/curves", tags=["curves"])


@router.get("/tickers")
async def list_tickers(store: Store = Depends(get_store)):
    """List all tickers that have bonds."""
    tickers = {b.ticker for b in store.bonds.values() if b.ticker}
    return sorted(tickers)


@router.get("/{ticker}", response_model=CurveAnalytics)
async def get_curve(
    ticker: str,
    horizon_days: int = Query(0, ge=0),
    store: Store = Depends(get_store),
):
    """Get YTM curve and aggregate stats for a ticker.

    When horizon_days > 0, each point includes rolled position and P&L decomposition
    (carry, pull_to_par, roll_down, total) for the given horizon.
    Roll-down in Z-spread space uses the issuer's fitted Z-spread curve so that the
    natural rolled Z-spread is the curve's prediction at the shorter maturity.
    """
    bonds_on_curve = [
        (bid, b)
        for bid, b in store.bonds.items()
        if b.ticker and b.ticker.upper() == ticker.upper()
    ]
    if not bonds_on_curve:
        raise HTTPException(status_code=404, detail=f"No bonds found for ticker {ticker}")

    treasury_pts = store.get_treasury_points()

    # --- Pass 1: compute analytics (including Z-spreads) for all bonds ---
    bond_data = []  # (bond_id, bond, analytics, maturity_yrs, settle, mat)
    z_spreads = []

    for bond_id, bond in bonds_on_curve:
        analytics = store.bond_analytics.get(bond_id)
        if analytics is None:
            analytics = await asyncio.to_thread(compute_bond_analytics, bond, treasury_pts)
            store.bond_analytics[bond_id] = analytics

        settle = date.fromisoformat(bond.settlement_date)
        mat = date.fromisoformat(bond.maturity_date)
        maturity_yrs = year_fraction(settle, mat, bond.day_count)

        bond_data.append((bond_id, bond, analytics, maturity_yrs, settle, mat))

        if analytics.z_spread_bps is not None:
            z_spreads.append(analytics.z_spread_bps)

    # --- Build the issuer Z-spread curve from all bond Z-spreads ---
    # Stored in decimal for the interpolation engine (same units as treasury_pts)
    z_spread_curve_raw: list[tuple[float, float]] = sorted(
        [
            (mat_yrs, analytics.z_spread_bps / 10_000.0)
            for _, _, analytics, mat_yrs, _, _ in bond_data
            if analytics.z_spread_bps is not None
        ],
        key=lambda p: p[0],
    )

    # Dense grid (50 pts) for smooth chart rendering on the frontend
    z_spread_curve_points: list[dict] = []
    if len(z_spread_curve_raw) >= 2:
        mat_min = z_spread_curve_raw[0][0]
        mat_max = z_spread_curve_raw[-1][0]
        n_pts = 50
        for i in range(n_pts):
            t = mat_min + (mat_max - mat_min) * i / (n_pts - 1)
            z_bps = interpolate_curve(z_spread_curve_raw, t) * 10_000.0
            z_spread_curve_points.append({"maturity": t, "z_spread_bps": z_bps})
    elif len(z_spread_curve_raw) == 1:
        t, z_dec = z_spread_curve_raw[0]
        z_spread_curve_points = [{"maturity": t, "z_spread_bps": z_dec * 10_000.0}]

    # --- Pass 2: compute horizon decompositions using Z-spread curve roll-down ---
    points = []

    for bond_id, bond, analytics, maturity_yrs, settle, mat in bond_data:
        point: dict = {
            "maturity": maturity_yrs,
            "ytm": bond.ytm,
            "bond_id": str(bond_id),
            "name": bond.name,
            "z_spread_bps": analytics.z_spread_bps,
            "carry_1m": analytics.carry_1m,
            "carry_1y": analytics.carry_1y,
            "roll_1m": analytics.roll_1m,
            "roll_1y": analytics.roll_1y,
            "rolled_maturity": None,
            "rolled_ytm": None,
            "rolled_z_spread_bps": None,
            "decomp_carry": None,
            "decomp_pull_to_par": None,
            "decomp_roll_down": None,
            "decomp_total": None,
        }

        if horizon_days > 0 and treasury_pts:
            horizon_yrs = horizon_days / 365.25
            rolled_mat_yrs = max(0.01, maturity_yrs - horizon_yrs)

            # Z-spread curve roll-down: interpolate issuer Z-spread curve at rolled maturity.
            # Falls back to treasury-zero-curve method (z_spread_rd_override=None) if no curve.
            z_spread_rd_override: float | None = None
            if z_spread_curve_raw:
                z_spread_rd_override = interpolate_curve(z_spread_curve_raw, rolled_mat_yrs)

            decomp = await asyncio.to_thread(
                decompose_z_spread,
                settle, mat, bond.coupon, bond.face_value, bond.frequency, bond.day_count,
                bond.ytm, treasury_pts, horizon_days,
                None,                  # z_spread_override (scenario — not used in curve view)
                z_spread_rd_override,  # z_spread_rd_override (issuer curve roll-down)
            )

            rolled_ytm = interpolate_curve(treasury_pts, rolled_mat_yrs) + (
                bond.ytm - interpolate_curve(treasury_pts, maturity_yrs)
            )
            rolled_z_spread_bps = (
                z_spread_rd_override * 10_000.0
                if z_spread_rd_override is not None
                else analytics.z_spread_bps
            )

            point["rolled_maturity"] = rolled_mat_yrs
            point["rolled_ytm"] = rolled_ytm
            point["rolled_z_spread_bps"] = rolled_z_spread_bps
            point["decomp_carry"] = decomp["carry"]
            point["decomp_pull_to_par"] = decomp["pull_to_par"]
            point["decomp_roll_down"] = decomp["roll_down"]
            point["decomp_total"] = decomp["carry"] + decomp["pull_to_par"] + decomp["roll_down"]

        points.append(point)

    points.sort(key=lambda p: p["maturity"])
    avg_z = sum(z_spreads) / len(z_spreads) if z_spreads else None

    return CurveAnalytics(
        ticker=ticker,
        points=points,
        avg_z_spread_bps=avg_z,
        z_spread_curve_points=z_spread_curve_points,
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

    return await get_curve(ticker, store=store)
