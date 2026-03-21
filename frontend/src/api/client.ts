import axios from 'axios';
import type {
  BondInput,
  BondWithAnalytics,
  TreasuryCurve,
  PortfolioInput,
  PortfolioAnalytics,
  CurveAnalytics,
  PnLDecompositionRequest,
  PnLDecompositionResult,
} from '../types/models';

const api = axios.create({ baseURL: '/api' });

// Treasury
export const getTreasuryCurve = () => api.get<TreasuryCurve | null>('/treasury').then(r => r.data);
export const setTreasuryCurve = (curve: TreasuryCurve) => api.put<TreasuryCurve>('/treasury', curve).then(r => r.data);
export const refreshTreasuryCurve = () => api.post<TreasuryCurve>('/treasury/refresh').then(r => r.data);

// Bonds
export const createBond = (bond: BondInput) => api.post<BondWithAnalytics>('/bonds', bond).then(r => r.data);
export const getBonds = () => api.get<BondWithAnalytics[]>('/bonds').then(r => r.data);
export const getBond = (id: string) => api.get<BondWithAnalytics>(`/bonds/${id}`).then(r => r.data);
export const updateBond = (id: string, bond: BondInput) => api.put<BondWithAnalytics>(`/bonds/${id}`, bond).then(r => r.data);
export const deleteBond = (id: string) => api.delete(`/bonds/${id}`).then(r => r.data);
export const recomputeAllBonds = () => api.post('/bonds/recompute-all').then(r => r.data);

// Portfolios
export const createPortfolio = (p: PortfolioInput) => api.post<PortfolioAnalytics>('/portfolios', p).then(r => r.data);
export const getPortfolios = () => api.get<PortfolioAnalytics[]>('/portfolios').then(r => r.data);
export const getPortfolio = (id: string) => api.get<PortfolioAnalytics>(`/portfolios/${id}`).then(r => r.data);
export const deletePortfolio = (id: string) => api.delete(`/portfolios/${id}`).then(r => r.data);

// Curves
export const getTickers = () => api.get<string[]>('/curves/tickers').then(r => r.data);
export const getCurveAnalytics = (ticker: string, horizonDays = 0) =>
  api.get<CurveAnalytics>(`/curves/${ticker}`, { params: { horizon_days: horizonDays } }).then(r => r.data);
export const moveBondOnCurve = (ticker: string, bondId: string, ytm: number, maturityYears?: number) =>
  api.patch<CurveAnalytics>(`/curves/${ticker}/bond/${bondId}`, { ytm, maturity_years: maturityYears }).then(r => r.data);

// P&L Decomposition
export const decomposePnl = (bondId: string, request: PnLDecompositionRequest) =>
  api.post<PnLDecompositionResult>(`/bonds/${bondId}/decompose`, request).then(r => r.data);
