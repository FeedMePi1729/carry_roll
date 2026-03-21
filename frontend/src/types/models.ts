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
  z_spread?: number;
}

export interface BondAnalytics {
  bond_id: string;
  dirty_price: number;
  clean_price: number;
  accrued_interest: number;
  carry_1m: number;
  carry_1y: number;
  roll_1m: number | null;
  roll_1y: number | null;
  z_spread_bps: number | null;
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
  name: string;
  weighted_carry_1m: number;
  weighted_carry_1y: number;
  weighted_roll_1m: number | null;
  weighted_roll_1y: number | null;
  positions: Array<{
    bond_id: string;
    name: string;
    weight: number;
    carry_1m: number;
    carry_1y: number;
    roll_1m: number | null;
    roll_1y: number | null;
  }>;
}

export interface CurvePoint {
  maturity: number;
  ytm: number;
  bond_id: string;
  name: string;
  z_spread_bps?: number;
  carry_1m: number;
  carry_1y: number;
  roll_1m?: number;
  roll_1y?: number;
  // Rolled position (populated when horizon_days > 0)
  rolled_maturity?: number | null;
  rolled_ytm?: number | null;
  rolled_z_spread_bps?: number | null;
  // P&L decomposition for the horizon
  decomp_carry?: number | null;
  decomp_pull_to_par?: number | null;
  decomp_roll_down?: number | null;
  decomp_total?: number | null;
}

export interface CurveAnalytics {
  ticker: string;
  points: CurvePoint[];
  avg_z_spread_bps: number | null;
  z_spread_curve_points?: Array<{ maturity: number; z_spread_bps: number }>;
}

export type DecompositionMode = 'z_spread' | 'yield';

export interface PnLDecompositionRequest {
  mode: DecompositionMode;
  horizon_days: number;
  z_spread_override_bps?: number;
  ytm_override?: number;
}

export interface ZSpreadDecompositionResult {
  mode: 'z_spread';
  carry: number;
  pull_to_par: number;
  roll_down: number;
  spread_change: number;
  total: number;
  p0: number;
  p_ptp: number;
  p_rd: number;
  p2: number;
  cf: number;
  coupon_income: number;
  financing_cost: number;
  residual: number;
  z_spread_t_bps: number;
  z_spread_rd_bps: number;  // natural roll z-spread for the given horizon
}

export interface YieldDecompositionResult {
  mode: 'yield';
  carry: number;
  pull_to_par: number;
  roll_down: number;
  yield_change: number;
  total: number;
  p0: number;
  p_ptp: number;
  p_rd: number;
  p2: number;
  cf: number;
  coupon_income: number;
  financing_cost: number;
  residual: number;
  y_rd_pct: number;  // natural roll YTM (%) for the given horizon
}

export type PnLDecompositionResult = ZSpreadDecompositionResult | YieldDecompositionResult;
