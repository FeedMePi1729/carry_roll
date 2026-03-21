# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A **Bond Carry/Roll Analytics Dashboard** — a full-stack financial analytics app that decomposes bond P&L into carry (coupon income minus financing cost), roll-down (price change from curve movement), and spread metrics. It uses real-time U.S. Treasury yield curve data from the Massive API.

## Best Practices
- Whenever you can, spin up subagents to keep the main context window clean
- Always ask questions if you have any doubts over the specification of the work.
- Before starting with a prompt, look over the available skills to see what can be applicable.
- After finishing work, try to update CLAUDE.md with what you have learnt.

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
- **Carry**: accrual-based coupon income minus repo financing cost (smooth, not lumpy); shown daily/weekly/annually on the bond card
- **Roll-down**: price change from bond rolling down the issuer Z-spread curve (not the treasury par curve) at each horizon
- **Spreads**: Z-spread (constant spread to bootstrapped zero curve, calibrated via Brent's method to reproduce observed dirty price). Formula: `dirty_price = Σ CF_i · exp(-(z_i + Z) · τ_i)`
- **Issuer Z-Spread Curve**: built from all bonds sharing a ticker in a two-pass process — Pass 1 computes per-bond Z-spreads independently; Pass 2 assembles `[(maturity_yrs, z_spread_decimal)]` pairs and fits a cubic spline. This curve is used for roll-down in both bond analytics and curve-level decompositions.
- **Interpolation**: cubic spline on both the treasury yield curve and the issuer Z-spread curve
- **P&L Decomposition**: exact bond P&L decomposition with two mutually exclusive modes (full repricing, no duration/convexity approximations):

  #### Z-Spread Mode (default for credit bonds)
  Prices off bootstrapped zero curve + Z-spread. Four components that sum exactly to total P&L:
  1. **Carry** = `coupon_income − financing_cost` (accrual-based; matches bond card carry)
  2. **Pull-to-Par** = `(P_ptp − P₀) + CF − coupon_income` (pure price convergence to par, CF-adjusted)
  3. **Roll-Down** = `P_rd − P_ptp` where `z_rd = z_t + (zero(T−dt) − zero(T))` — benefit from the bond rolling along the issuer Z-spread curve; on an upward-sloping curve `zero(T−dt) < zero(T)` so `z_rd < z_t` and price rises
  4. **Spread Change** = `P₂ − P_rd` (pure credit repricing; default = 0, can be overridden for scenarios)

  Intermediate prices surfaced in "Show Working": `P₀` (current), `P_ptp` (aged, same spread), `P_rd` (aged, rolled spread), `P₂` (aged, final spread).

  #### Yield Mode
  Prices at flat YTM (semi-annual compounding). Same Carry and Pull-to-Par definitions; Roll-Down uses the par treasury curve (`y_rd = treasury_at_new_mat + bond_excess`); Spread Change replaced by **Yield Change**.

  - Identity check: `residual = total − (P₂ − P₀ + CF − financing_cost)` ≈ 0
  - Users can override the final Z-spread or YTM for what-if scenarios
  - Multiple horizons supported: 1d, 30d, 365d, etc.
  - Methodology tab (`components/docs/DecompositionDocs.tsx`) documents the math for both modes
