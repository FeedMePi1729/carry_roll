from app.models.bond import BondAnalytics


def compute_portfolio_analytics(
    positions: list[dict],  # [{bond_id, weight, analytics: BondAnalytics}]
) -> dict:
    """Compute weighted portfolio analytics."""
    weighted_carry_daily = 0.0
    weighted_carry_annual = 0.0
    roll_daily_values = []
    roll_annual_values = []
    position_details = []

    for pos in positions:
        w = pos["weight"]
        a: BondAnalytics = pos["analytics"]
        name = pos.get("name", "")

        weighted_carry_daily += w * a.carry_daily
        weighted_carry_annual += w * a.carry_annual

        if a.roll_daily is not None:
            roll_daily_values.append(w * a.roll_daily)
        if a.roll_annual is not None:
            roll_annual_values.append(w * a.roll_annual)

        position_details.append({
            "bond_id": str(a.bond_id),
            "name": name,
            "weight": w,
            "carry_daily": a.carry_daily,
            "carry_annual": a.carry_annual,
            "roll_daily": a.roll_daily,
            "roll_annual": a.roll_annual,
        })

    return {
        "weighted_carry_daily": weighted_carry_daily,
        "weighted_carry_annual": weighted_carry_annual,
        "weighted_roll_daily": sum(roll_daily_values) if roll_daily_values else None,
        "weighted_roll_annual": sum(roll_annual_values) if roll_annual_values else None,
        "positions": position_details,
    }
