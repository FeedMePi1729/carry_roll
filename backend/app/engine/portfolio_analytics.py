from uuid import UUID
from app.models.bond import BondAnalytics


def compute_portfolio_analytics(
    positions: list[dict],  # [{bond_id, weight, analytics: BondAnalytics}]
) -> dict:
    """Compute weighted portfolio analytics."""
    weighted_carry = 0.0
    weighted_carry_ann = 0.0
    weighted_theta = 0.0
    roll_down_values = []
    has_roll_down = False
    position_details = []

    for pos in positions:
        w = pos["weight"]
        a: BondAnalytics = pos["analytics"]
        name = pos.get("name", "")

        weighted_carry += w * a.carry
        weighted_carry_ann += w * a.carry_annualized
        weighted_theta += w * a.theta

        rd = None
        if a.roll_down is not None:
            rd = w * a.roll_down
            roll_down_values.append(rd)
            has_roll_down = True

        position_details.append({
            "bond_id": str(a.bond_id),
            "name": name,
            "weight": w,
            "carry": a.carry,
            "carry_annualized": a.carry_annualized,
            "roll_down": a.roll_down,
            "theta": a.theta,
        })

    weighted_roll_down = sum(roll_down_values) if has_roll_down else None

    return {
        "weighted_carry": weighted_carry,
        "weighted_carry_annualized": weighted_carry_ann,
        "weighted_roll_down": weighted_roll_down,
        "weighted_theta": weighted_theta,
        "positions": position_details,
    }
