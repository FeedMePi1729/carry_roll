import logging
from contextlib import asynccontextmanager

from app.api.bonds import recompute_all_bonds
from app.api.router import api_router
from app.services.massive import fetch_treasury_curve
from app.store.memory import store
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        store.treasury_curve = await fetch_treasury_curve()
        logger.info("Treasury curve loaded from Massive (%s)", store.treasury_curve.as_of_date)
    except Exception as exc:
        logger.warning("Massive fetch failed (%s) — using default curve", exc)
    await recompute_all_bonds(store)
    logger.info("Seeded %d default bonds", len(store.bonds))
    yield


app = FastAPI(title="Bond Carry/Roll Analytics", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
