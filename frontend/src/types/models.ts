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
}

export interface BondAnalytics {
  bond_id: string;
  dirty_price: number;
  clean_price: number;
  accrued_interest: number;
  carry_daily: number;
  carry_weekly: number;
  carry_annual: number;
  roll_daily: number | null;
  roll_weekly: number | null;
  roll_annual: number | null;
  g_spread_bps: number | null;
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
  weighted_carry_daily: number;
  weighted_carry_annual: number;
  weighted_roll_daily: number | null;
  weighted_roll_annual: number | null;
  positions: Array<{
    bond_id: string;
    name: string;
    weight: number;
    carry_daily: number;
    carry_annual: number;
    roll_daily: number | null;
    roll_annual: number | null;
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
    carry_daily: number;
    carry_annual: number;
    roll_daily?: number;
    roll_annual?: number;
  }>;
  avg_g_spread_bps: number | null;
}

export type DecompositionMode = 'g_spread' | 'yield';

export interface PnLDecompositionRequest {
  mode: DecompositionMode;
  horizon_days: number;
  g_spread_override_bps?: number;
  ytm_override?: number;
}

export interface GSpreadDecompositionResult {
  mode: 'g_spread';
  carry: number;
  roll: number;
  spread_change: number;
  total: number;
  p0: number;
  p_flat: number;
  pf: number;
  p1: number;
  p2: number;
  cf: number;
  residual: number;
}

export interface YieldDecompositionResult {
  mode: 'yield';
  carry_incl_roll: number;
  yield_change: number;
  total: number;
  p0: number;
  p1: number;
  p2: number;
  cf: number;
  residual: number;
}

export type PnLDecompositionResult = GSpreadDecompositionResult | YieldDecompositionResult;
