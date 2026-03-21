from app.models.bond import BondAnalytics


def compute_portfolio_analytics(
    positions: list[dict],  # [{bond_id, weight, analytics: BondAnalytics}]
) -> dict:
    """Compute weighted portfolio analytics."""
    weighted_carry_1m = 0.0
    weighted_carry_1y = 0.0
    roll_1m_values = []
    roll_1y_values = []
    position_details = []

    for pos in positions:
        w = pos["weight"]
        a: BondAnalytics = pos["analytics"]
        name = pos.get("name", "")

        weighted_carry_1m += w * a.carry_1m
        weighted_carry_1y += w * a.carry_1y

        if a.roll_1m is not None:
            roll_1m_values.append(w * a.roll_1m)
        if a.roll_1y is not None:
            roll_1y_values.append(w * a.roll_1y)

        position_details.append({
            "bond_id": str(a.bond_id),
            "name": name,
            "weight": w,
            "carry_1m": a.carry_1m,
            "carry_1y": a.carry_1y,
            "roll_1m": a.roll_1m,
            "roll_1y": a.roll_1y,
        })

    return {
        "weighted_carry_1m": weighted_carry_1m,
        "weighted_carry_1y": weighted_carry_1y,
        "weighted_roll_1m": sum(roll_1m_values) if roll_1m_values else None,
        "weighted_roll_1y": sum(roll_1y_values) if roll_1y_values else None,
        "positions": position_details,
    }
