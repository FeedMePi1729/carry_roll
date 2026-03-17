# Bond Time P&L Decomposition — Implementation Plan

## Overview

Implement an exact bond time P&L decomposition engine in Python. The system supports
two **mutually exclusive and conceptually distinct** decomposition modes that the user
can switch between:

- **G-Spread Mode**: 3-component decomposition (carry, roll-down, g-spread change)
- **Yield Mode**: 2-component decomposition (carry, yield change)

These are not the same decomposition with one term zeroed out. They differ in what
"carry" means and what the residual captures. This distinction must be preserved
throughout the codebase and surfaced clearly in outputs.

---

## Mathematical Reference

### Shared Definitions

```
P(t, y)   := dirty price at time t with flat yield y
P(t, yG, g) := dirty price at time t priced off gov curve yG(tau) + g
CF(t, t+dt) := coupon cash flows paid in interval [t, t+dt]
```

Dirty price from cashflows (continuous compounding, can be adapted for ACT/365 or s/a):

```
P = sum_i CF_i * exp(-r_i * (T_i - t))
```

where `r_i = y` (yield mode) or `r_i = yG(T_i - t) + g` (g-spread mode).

---

### G-Spread Mode (3 components)

Define intermediate prices holding gov curve fixed throughout:

```
P0 = P(t;       yG_t, g_t)       # start: current curve, current spread
P1 = P(t+dt;    yG_t, g_t)       # aged:  same curve, same spread
Pf = P(t+dt;    yG_t, g_t, flat) # aged:  flat yield ybar_t, same g (carry reference)
P2 = P(t+dt;    yG_t, g_{t+dt})  # aged:  same curve, new spread
```

where `Pf` prices the bond using the *flat yield* `ybar_t` (YTM at time t) applied
uniformly — this is the carry reference price.

```
dP_carry  = Pf - P(t; flat ybar_t) + CF      # time passage at flat yield
dP_roll   = (P1 - Pf) - (P0 - P(t; flat))   # change in richness vs flat yield
           = P1 - P0 - dP_carry + CF          # equivalently, as residual of carry
dP_spread = P2 - P1                           # pure spread repricing

dP_total  = dP_carry + dP_roll + dP_spread    # exact identity
```

Note: under unchanged gov curve assumption, set `yG_{t+dt} = yG_t`, so P2 = final price.

### Yield Mode (2 components)

```
P0 = P(t;      ybar_t)            # start price
P1 = P(t+dt;   ybar_t)            # aged at same yield
P2 = P(t+dt;   ybar_{t+dt})       # aged at new yield

dP_carry       = P1 - P0 + CF     # full carry incl. roll (no separation)
dP_yield_change = P2 - P1          # pure yield repricing

dP_total = dP_carry + dP_yield_change   # exact identity
```

**Key difference from g-spread mode**: `dP_carry` here equals `dP_carry + dP_roll`
from g-spread mode. Roll-down is not separately visible.

---

## Implementation Notes

- All for the 3 different forms of compounding.
- The gov curve is assumed **unchanged** between t and t+dt in g-spread mode; the
framework can be extended to a 4-component decomposition (adding gov curve shift)
but this is out of scope here
- Avoid approximations — **never use duration or convexity** in the decomposition
functions; always full reprice
- `DecompositionMode` should be clearly documented in all function signatures so
Claude Code does not conflate the two modes
- The report layer must label carry differently per mode:
  - G-spread mode: **"Carry"** (excludes roll)
  - Yield mode: **"Carry (incl. roll-down)"** (includes roll)
  This prevents users from comparing carry across modes and drawing wrong conclusions

