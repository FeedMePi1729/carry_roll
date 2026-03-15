from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.engine.portfolio_analytics import compute_portfolio_analytics
from app.models.portfolio import PortfolioAnalytics, PortfolioInput
from app.store.memory import Store, get_store

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def _compute_portfolio(portfolio: PortfolioInput, store: Store) -> PortfolioAnalytics:
    positions = []
    for pos in portfolio.positions:
        bond = store.bonds.get(pos.bond_id)
        analytics = store.bond_analytics.get(pos.bond_id)
        if bond is None or analytics is None:
            raise HTTPException(status_code=404, detail=f"Bond {pos.bond_id} not found")
        positions.append(
            {
                "bond_id": pos.bond_id,
                "weight": pos.weight,
                "name": bond.name,
                "analytics": analytics,
            }
        )
    result = compute_portfolio_analytics(positions)
    return PortfolioAnalytics(portfolio_id=portfolio.id, name=portfolio.name, **result)


@router.post("", response_model=PortfolioAnalytics)
async def create_portfolio(portfolio: PortfolioInput, store: Store = Depends(get_store)):
    store.portfolios[portfolio.id] = portfolio
    return _compute_portfolio(portfolio, store)


@router.get("", response_model=list[PortfolioAnalytics])
async def list_portfolios(store: Store = Depends(get_store)):
    results = []
    for portfolio in list(store.portfolios.values()):
        try:
            results.append(_compute_portfolio(portfolio, store))
        except HTTPException:
            continue
    return results


@router.get("/{portfolio_id}", response_model=PortfolioAnalytics)
async def get_portfolio(portfolio_id: UUID, store: Store = Depends(get_store)):
    portfolio = store.portfolios.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return _compute_portfolio(portfolio, store)


@router.put("/{portfolio_id}", response_model=PortfolioAnalytics)
async def update_portfolio(
    portfolio_id: UUID, portfolio: PortfolioInput, store: Store = Depends(get_store)
):
    if portfolio_id not in store.portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    portfolio.id = portfolio_id
    store.portfolios[portfolio_id] = portfolio
    return _compute_portfolio(portfolio, store)


@router.delete("/{portfolio_id}")
async def delete_portfolio(portfolio_id: UUID, store: Store = Depends(get_store)):
    if portfolio_id not in store.portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    del store.portfolios[portfolio_id]
    return {"status": "deleted"}
