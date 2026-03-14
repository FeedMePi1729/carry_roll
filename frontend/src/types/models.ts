export type DayCountConvention = 'ACT/360' | 'ACT/365' | '30/360';

export interface BondInput {
  id?: string;
  name: string;
  ticker?: string;
  coupon: number;
  face_value: number;
  settlement_date: string;
  maturity_date: string;
  day_count: DayCountConvention;
  frequency: number;
  ytm: number;
  repo_rate: number;
  g_spread?: number;
  z_spread?: number;
  recovery_rate: number;
  market_price?: number;
}

export interface BondAnalytics {
  bond_id: string;
  dirty_price: number;
  clean_price: number;
  accrued_interest: number;
  carry: number;
  carry_annualized: number;
  roll_down: number | null;
  theta: number;
  g_spread_bps: number | null;
  z_spread_bps: number | null;
  hazard_rate: number | null;
  survival_probabilities: Array<{ t: number; prob: number }>;
  cashflows: Array<{ date: string; amount: number; type: string }>;
}

export interface BondWithAnalytics {
  bond: BondInput;
  analytics: BondAnalytics;
}

export interface TreasuryCurvePoint {
  tenor: number;
  yield_rate: number;
}

export interface TreasuryCurve {
  as_of_date: string;
  points: TreasuryCurvePoint[];
}

export interface PortfolioPosition {
  bond_id: string;
  weight: number;
}

export interface PortfolioInput {
  id?: string;
  name: string;
  positions: PortfolioPosition[];
}

export interface PortfolioAnalytics {
  portfolio_id: string;
  weighted_carry: number;
  weighted_carry_annualized: number;
  weighted_roll_down: number | null;
  weighted_theta: number;
  positions: Array<{
    bond_id: string;
    name: string;
    weight: number;
    carry: number;
    carry_annualized: number;
    roll_down: number | null;
    theta: number;
  }>;
}

export interface CurveAnalytics {
  ticker: string;
  points: Array<{
    maturity: number;
    ytm: number;
    bond_id: string;
    name: string;
    g_spread_bps?: number;
    z_spread_bps?: number;
    carry: number;
    carry_annualized: number;
    roll_down?: number;
    theta: number;
  }>;
  avg_g_spread_bps: number | null;
  avg_z_spread_bps: number | null;
  survival_curve: Array<{ t: number; prob: number }>;
}
