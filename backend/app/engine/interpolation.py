import numpy as np
from scipy.interpolate import CubicSpline


def interpolate_curve(points: list[tuple[float, float]], target_tenor: float) -> float:
    """Interpolate a yield curve at a target tenor using cubic spline.

    Args:
        points: list of (tenor, rate) tuples, sorted by tenor
        target_tenor: the tenor to interpolate at

    Returns:
        Interpolated rate
    """
    if not points:
        raise ValueError("No curve points provided")

    points = sorted(points, key=lambda p: p[0])
    tenors = np.array([p[0] for p in points])
    rates = np.array([p[1] for p in points])

    if len(points) == 1:
        return float(rates[0])

    # Clamp to curve boundaries
    if target_tenor <= tenors[0]:
        return float(rates[0])
    if target_tenor >= tenors[-1]:
        return float(rates[-1])

    if len(points) == 2:
        # Linear interpolation
        slope = (rates[1] - rates[0]) / (tenors[1] - tenors[0])
        return float(rates[0] + slope * (target_tenor - tenors[0]))

    cs = CubicSpline(tenors, rates, bc_type="natural")
    return float(cs(target_tenor))


def bootstrap_zero_curve(
    par_points: list[tuple[float, float]], frequency: int = 2
) -> list[tuple[float, float]]:
    """Bootstrap zero rates from par treasury yields.

    Args:
        par_points: list of (tenor, par_yield) sorted by tenor
        frequency: coupon frequency (default semi-annual)

    Returns:
        list of (tenor, zero_rate) tuples
    """
    par_points = sorted(par_points, key=lambda p: p[0])
    zero_rates = []

    for i, (tenor, par_yield) in enumerate(par_points):
        if tenor <= 1.0 / frequency:
            # For short tenors, par yield ≈ zero rate
            zero_rates.append((tenor, par_yield))
        else:
            # Bootstrap: solve for zero rate at this tenor
            coupon = par_yield / frequency
            n_periods = int(round(tenor * frequency))

            # Sum of discounted coupons using previously bootstrapped zeros
            pv_coupons = 0.0
            for j in range(1, n_periods):
                t_j = j / frequency
                # Interpolate zero rate at t_j
                z_j = _interp_zero(zero_rates, t_j)
                pv_coupons += coupon * np.exp(-z_j * t_j)

            # Solve: 1 = pv_coupons + (1 + coupon) * exp(-z_n * T)
            remaining = 1.0 - pv_coupons
            if remaining <= 0:
                # Fallback: use par yield as zero rate
                zero_rates.append((tenor, par_yield))
            else:
                z_n = -np.log(remaining / (1.0 + coupon)) / tenor
                zero_rates.append((tenor, float(z_n)))

    return zero_rates


def _interp_zero(zero_rates: list[tuple[float, float]], target: float) -> float:
    if not zero_rates:
        return 0.0
    if len(zero_rates) == 1:
        return zero_rates[0][1]
    tenors = [z[0] for z in zero_rates]
    rates = [z[1] for z in zero_rates]
    if target <= tenors[0]:
        return rates[0]
    if target >= tenors[-1]:
        return rates[-1]
    # Linear interpolation for bootstrapping
    for i in range(len(tenors) - 1):
        if tenors[i] <= target <= tenors[i + 1]:
            w = (target - tenors[i]) / (tenors[i + 1] - tenors[i])
            return rates[i] + w * (rates[i + 1] - rates[i])
    return rates[-1]
