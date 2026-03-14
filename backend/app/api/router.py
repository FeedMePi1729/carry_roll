from fastapi import APIRouter

from app.api.bonds import router as bonds_router
from app.api.curves import router as curves_router
from app.api.portfolio import router as portfolio_router
from app.api.treasury import router as treasury_router

api_router = APIRouter(prefix="/api")
api_router.include_router(bonds_router)
api_router.include_router(treasury_router)
api_router.include_router(portfolio_router)
api_router.include_router(curves_router)
