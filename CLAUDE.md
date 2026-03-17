# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A **Bond Carry/Roll Analytics Dashboard** — a full-stack financial analytics app that decomposes bond P&L into carry (coupon income minus financing cost), roll-down (price change from curve movement), and spread metrics. It uses real-time U.S. Treasury yield curve data from the Massive API.

## Commands

### Frontend (run from `frontend/`)
```bash
npm run dev        # Dev server on http://localhost:5173
npm run build      # Production build (runs tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend (run from `backend/`)
```bash
pip install -r requirements.txt   # Install deps
python main.py                    # Dev server on http://0.0.0.0:8000 with --reload
```

Copy `backend/.env.example` to `backend/.env` and set `MASSIVE_API_KEY`.

The Vite dev server proxies `/api/*` → `http://localhost:8000`, so the frontend always calls `/api/...`.

## Architecture

### Monorepo Layout
- `frontend/` — React 19 + TypeScript + Vite + TailwindCSS + Plotly.js
- `backend/` — Python FastAPI + Uvicorn + Pydantic + NumPy/SciPy

### Backend Structure

**`backend/app/`**
- `api/` — FastAPI routers: `bonds.py`, `treasury.py`, `portfolio.py`, `curves.py`; aggregated in `router.py` under `/api` prefix
- `engine/` — Pure analytical functions (no I/O): `pricing.py`, `carry.py`, `roll_down.py`, `spreads.py`, `hazard.py`, `interpolation.py`, `cashflows.py`, `theta.py`, `day_count.py`, `portfolio_analytics.py`, `decomposition.py`
- `models/` — Pydantic models: `bond.py`, `treasury.py`, `portfolio.py`, `curve.py`, `decomposition.py`
- `services/massive.py` — Async httpx client for live treasury yields from Massive API
- `store/memory.py` — Single in-memory `Store` with `asyncio.Lock`, holding treasury curve, bonds, bond analytics, and portfolios (no database)

**Data flow:** On startup, `main.py` fetches the treasury curve via `services/massive.py`. Bond creation/update triggers full recomputation via the engine layer. All state lives in the in-memory store.

### Frontend Structure

**`frontend/src/`**
- `api/client.ts` — Axios instance (base URL `/api`) with typed methods for all endpoints
- `hooks/` — `useBonds`, `useTreasury`, `useCurve` handle server state; `useDragReorder`, `useDebounce` are UI utilities
- `components/` — Organized by domain: `bond/`, `portfolio/`, `curve/`, `treasury/`, `charts/`, `layout/`, `ui/`
- `types/models.ts` — TypeScript interfaces mirroring backend Pydantic models
- `lib/` — `chartTheme.tsx` (Plotly theme), `formatters.tsx` (number/date formatting)
- `context/ThemeContext.tsx` — Light/dark theme

`App.tsx` owns top-level state and wires hooks to components across three tabs: **Bond/Portfolio**, **Curves**, and **Methodology**.

### Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST/GET/PUT/DELETE | `/api/bonds[/{id}]` | Bond CRUD |
| POST | `/api/bonds/recompute-all` | Recompute all bond analytics |
| GET/PUT | `/api/treasury` | Get/set yield curve |
| POST | `/api/treasury/refresh` | Fetch live curve from Massive |
| POST/GET/DELETE | `/api/portfolios[/{id}]` | Portfolio CRUD |
| GET | `/api/curves/tickers` | List all bond tickers |
| GET | `/api/curves/{ticker}` | Curve analytics for a ticker |
| PATCH | `/api/curves/{ticker}/bond/{bondId}` | Move bond on curve |
| POST | `/api/bonds/{id}/decompose` | P&L decomposition (G-spread or Yield mode) |

### Analytics Engine Summary
- **Pricing**: dirty price, clean price, accrued interest; supports ACT/360, ACT/365, 30/360
- **Carry**: coupon income minus repo financing cost (daily/weekly/annual)
- **Roll-down**: price change from bond rolling down the curve (90-day and 365-day)
- **Spreads**: G-spread (to interpolated gov curve), Z-spread (OAS-like)
- **Credit**: hazard rate and survival probability from Z-spread
- **Interpolation**: cubic spline on the treasury curve
- **P&L Decomposition**: exact bond P&L decomposition with two mutually exclusive modes:
  - **G-Spread Mode** (3 components): carry (time passage at flat yield), roll-down (curve shape benefit), g-spread change (credit repricing). Prices off bootstrapped zero curve + g-spread.
  - **Yield Mode** (2 components): carry incl. roll-down (time passage), yield change (YTM repricing). Prices at flat YTM.
  - Both modes use full repricing (no duration/convexity approximations) and return exact identities with a residual sanity check.
  - Users can override the new g-spread or YTM to see scenario P&L, and view time evolution across multiple horizons (1d–1y).
  - Frontend shows intermediate prices (P₀, P_flat, P_f, P₁, P₂) in a "Show Working" section so users can trace the math.
  - Methodology tab (`components/docs/DecompositionDocs.tsx`) documents the math for both modes.
