from fastapi import APIRouter, Depends, HTTPException

from app.api.bonds import recompute_all_bonds
from app.models.treasury import TreasuryCurve, TreasuryCurvePoint
from app.services.massive import fetch_treasury_curve
from app.store.memory import Store, get_store

router = APIRouter(prefix="/treasury", tags=["treasury"])


@router.get("", response_model=TreasuryCurve | None)
async def get_treasury_curve(store: Store = Depends(get_store)):
    return store.treasury_curve


@router.put("", response_model=TreasuryCurve)
async def set_treasury_curve(curve: TreasuryCurve, store: Store = Depends(get_store)):
    curve.points.sort(key=lambda p: p.tenor)
    store.treasury_curve = curve
    await recompute_all_bonds(store)
    return curve


@router.post("/refresh", response_model=TreasuryCurve)
async def refresh_treasury_curve(store: Store = Depends(get_store)):
    """Re-fetch the live treasury curve from Massive and recompute all bonds."""
    try:
        curve = await fetch_treasury_curve()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Massive API error: {exc}")
    store.treasury_curve = curve
    await recompute_all_bonds(store)
    return curve


@router.patch("/{tenor}")
async def update_treasury_point(
    tenor: float, point: TreasuryCurvePoint, store: Store = Depends(get_store)
):
    if store.treasury_curve is None:
        raise HTTPException(status_code=404, detail="No treasury curve set")

    found = False
    for i, p in enumerate(store.treasury_curve.points):
        if abs(p.tenor - tenor) < 0.001:
            store.treasury_curve.points[i] = point
            found = True
            break

    if not found:
        store.treasury_curve.points.append(point)
        store.treasury_curve.points.sort(key=lambda p: p.tenor)

    await recompute_all_bonds(store)
    return store.treasury_curve
