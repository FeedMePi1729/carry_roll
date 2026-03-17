import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { LazyPlot } from '../charts/LazyPlot';
import { StatCard } from '../ui/StatCard';
import { fmt } from '../../lib/formatters';
import { chartColors, chartTheme } from '../../lib/chartTheme';
import { decomposePnl } from '../../api/client';
import type {
  BondInput,
  BondAnalytics,
  DecompositionMode,
  PnLDecompositionRequest,
  PnLDecompositionResult,
  GSpreadDecompositionResult,
  YieldDecompositionResult,
} from '../../types/models';

interface Props {
  bondId: string;
  bond: BondInput;
  analytics: BondAnalytics;
}

export default function PnLDecomposition({ bondId, bond, analytics }: Props) {
  const { theme } = useTheme();
  const ct = chartTheme(theme === 'dark');

  const [mode, setMode] = useState<DecompositionMode>('g_spread');
  const [horizonDays, setHorizonDays] = useState(1);
  const [gSpreadOverride, setGSpreadOverride] = useState(
    analytics.g_spread_bps != null ? analytics.g_spread_bps.toFixed(1) : ''
  );
  const [ytmOverride, setYtmOverride] = useState(
    (bond.ytm * 100).toFixed(4)
  );
  const [result, setResult] = useState<PnLDecompositionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeEvolution, setTimeEvolution] = useState<PnLDecompositionResult[] | null>(null);
  const [timeLoading, setTimeLoading] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(true);

  const inputCls = "w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500";
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  const buildRequest = (horizon: number): PnLDecompositionRequest => {
    const request: PnLDecompositionRequest = {
      mode,
      horizon_days: horizon,
    };
    if (mode === 'g_spread' && gSpreadOverride !== '') {
      request.g_spread_override_bps = parseFloat(gSpreadOverride);
    }
    if (mode === 'yield' && ytmOverride !== '') {
      request.ytm_override = parseFloat(ytmOverride) / 100;
    }
    return request;
  };

  const handleDecompose = async () => {
    setLoading(true);
    try {
      const res = await decomposePnl(bondId, buildRequest(horizonDays));
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeEvolution = async () => {
    setTimeLoading(true);
    try {
      const horizons = [1, 7, 30, 90, 180, 365];
      const results = await Promise.all(
        horizons.map(h => decomposePnl(bondId, buildRequest(h)))
      );
      setTimeEvolution(results);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeLoading(false);
    }
  };

  const isGSpread = (r: PnLDecompositionResult): r is GSpreadDecompositionResult =>
    r.mode === 'g_spread';

  const isYield = (r: PnLDecompositionResult): r is YieldDecompositionResult =>
    r.mode === 'yield';

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">P&L Decomposition</h4>
        <span
          className="text-gray-400 dark:text-gray-500 cursor-help"
          title="Decompose bond P&L into carry, roll-down, and spread/yield change components"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 w-fit">
        <button
          type="button"
          onClick={() => setMode('g_spread')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'g_spread'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          G-Spread (3 components)
        </button>
        <button
          type="button"
          onClick={() => setMode('yield')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'yield'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          Yield (2 components)
        </button>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>Horizon (days)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={horizonDays}
            onChange={e => setHorizonDays(parseInt(e.target.value) || 1)}
            className={inputCls}
            style={{ width: '100px' }}
          />
        </div>
        {mode === 'g_spread' && (
          <div>
            <label className={labelCls}>New G-Spread (bps)</label>
            <input
              type="number"
              step="0.1"
              value={gSpreadOverride}
              onChange={e => setGSpreadOverride(e.target.value)}
              placeholder={analytics.g_spread_bps != null ? analytics.g_spread_bps.toFixed(1) : ''}
              className={inputCls}
              style={{ width: '140px' }}
            />
          </div>
        )}
        {mode === 'yield' && (
          <div>
            <label className={labelCls}>New YTM (%)</label>
            <input
              type="number"
              step="0.01"
              value={ytmOverride}
              onChange={e => setYtmOverride(e.target.value)}
              placeholder={(bond.ytm * 100).toFixed(4)}
              className={inputCls}
              style={{ width: '140px' }}
            />
          </div>
        )}
        <button
          type="button"
          onClick={handleDecompose}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? 'Computing...' : 'Decompose'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <details open={resultsOpen} onToggle={e => setResultsOpen((e.target as HTMLDetailsElement).open)} className="group">
          <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 list-none flex items-center gap-1">
            <svg className={`h-3.5 w-3.5 transition-transform ${resultsOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Decomposition Results
          </summary>
        <div className="space-y-3">
          {/* Stat cards */}
          {isGSpread(result) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Carry" value={fmt(result.carry, 4)} />
              <StatCard label="Roll-Down" value={fmt(result.roll, 4)} />
              <StatCard label="Spread Δ" value={fmt(result.spread_change, 4)} />
              <StatCard
                label="Total"
                value={fmt(result.total, 4)}
                className={result.total > 0 ? 'bg-green-50 dark:bg-green-900/30' : result.total < 0 ? 'bg-red-50 dark:bg-red-900/30' : ''}
              />
            </div>
          )}
          {isYield(result) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Carry (incl. roll)" value={fmt(result.carry_incl_roll, 4)} />
              <StatCard label="Yield Δ" value={fmt(result.yield_change, 4)} />
              <StatCard
                label="Total"
                value={fmt(result.total, 4)}
                className={result.total > 0 ? 'bg-green-50 dark:bg-green-900/30' : result.total < 0 ? 'bg-red-50 dark:bg-red-900/30' : ''}
              />
            </div>
          )}

          {/* Waterfall chart */}
          <LazyPlot
            data={[
              {
                type: 'waterfall',
                x: isGSpread(result)
                  ? ['Carry', 'Roll-Down', 'Spread Δ', 'Total']
                  : ['Carry (incl. roll)', 'Yield Δ', 'Total'],
                y: isGSpread(result)
                  ? [result.carry, result.roll, result.spread_change, result.total]
                  : [result.carry_incl_roll, result.yield_change, result.total],
                measure: isGSpread(result)
                  ? ['relative', 'relative', 'relative', 'total']
                  : ['relative', 'relative', 'total'],
                connector: { line: { color: 'rgb(63,63,63)' } },
                increasing: { marker: { color: chartColors.accent } },
                decreasing: { marker: { color: chartColors.danger } },
                totals: { marker: { color: '#22c55e' } },
                textposition: 'outside',
                text: isGSpread(result)
                  ? [result.carry.toFixed(4), result.roll.toFixed(4), result.spread_change.toFixed(4), result.total.toFixed(4)]
                  : [result.carry_incl_roll.toFixed(4), result.yield_change.toFixed(4), result.total.toFixed(4)],
                textfont: { size: 9, color: ct.fontColor },
              },
            ]}
            layout={{
              height: 200,
              margin: { t: 20, b: 30, l: 50, r: 20 },
              paper_bgcolor: ct.bgColor,
              plot_bgcolor: ct.bgColor,
              font: { color: ct.fontColor, size: 10 },
              yaxis: { gridcolor: ct.gridcolor },
              xaxis: { gridcolor: ct.gridcolor },
            }}
            config={{ displayModeBar: false }}
            style={{ width: '100%' }}
          />

          {/* Show Working */}
          <details className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              Show intermediate prices
            </summary>
            <div className="mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-1">Symbol</th>
                    <th className="pb-1">Value</th>
                    <th className="pb-1">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {isGSpread(result) && (
                    <>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P&#8320;</td>
                        <td className="py-1 font-mono">{result.p0.toFixed(4)}</td>
                        <td className="py-1">Current dirty price (gov curve + spread)</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P_flat</td>
                        <td className="py-1 font-mono">{result.p_flat.toFixed(4)}</td>
                        <td className="py-1">Current dirty price at flat YTM</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P_f</td>
                        <td className="py-1 font-mono">{result.pf.toFixed(4)}</td>
                        <td className="py-1">Aged dirty price at flat YTM (carry ref)</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P&#8321;</td>
                        <td className="py-1 font-mono">{result.p1.toFixed(4)}</td>
                        <td className="py-1">Aged at same curve + same spread</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P&#8322;</td>
                        <td className="py-1 font-mono">{result.p2.toFixed(4)}</td>
                        <td className="py-1">Aged at same curve + new spread</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">CF</td>
                        <td className="py-1 font-mono">{result.cf.toFixed(4)}</td>
                        <td className="py-1">Cash flows in [t, t+dt]</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50">
                        <td className="py-1 font-mono">Carry</td>
                        <td className="py-1 font-mono">P_f - P_flat + CF = {result.carry.toFixed(4)}</td>
                        <td className="py-1">Time passage at flat yield</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50">
                        <td className="py-1 font-mono">Roll</td>
                        <td className="py-1 font-mono">(P&#8321; - P&#8320;) - (P_f - P_flat) = {result.roll.toFixed(4)}</td>
                        <td className="py-1">Richness vs flat yield</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50">
                        <td className="py-1 font-mono">Spread {'\u0394'}</td>
                        <td className="py-1 font-mono">P&#8322; - P&#8321; = {result.spread_change.toFixed(4)}</td>
                        <td className="py-1">Pure spread repricing</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50 font-semibold">
                        <td className="py-1 font-mono">Total</td>
                        <td className="py-1 font-mono">Carry + Roll + Spread {'\u0394'} = {result.total.toFixed(4)}</td>
                        <td className="py-1">Exact identity</td>
                      </tr>
                    </>
                  )}
                  {isYield(result) && (
                    <>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P&#8320;</td>
                        <td className="py-1 font-mono">{result.p0.toFixed(4)}</td>
                        <td className="py-1">Current dirty price at current YTM</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P&#8321;</td>
                        <td className="py-1 font-mono">{result.p1.toFixed(4)}</td>
                        <td className="py-1">Aged dirty price at current YTM</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">P&#8322;</td>
                        <td className="py-1 font-mono">{result.p2.toFixed(4)}</td>
                        <td className="py-1">Aged dirty price at new YTM</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 font-mono">CF</td>
                        <td className="py-1 font-mono">{result.cf.toFixed(4)}</td>
                        <td className="py-1">Cash flows in [t, t+dt]</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50">
                        <td className="py-1 font-mono">Carry (incl. roll)</td>
                        <td className="py-1 font-mono">P&#8321; - P&#8320; + CF = {result.carry_incl_roll.toFixed(4)}</td>
                        <td className="py-1">Time passage at flat YTM</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50">
                        <td className="py-1 font-mono">Yield {'\u0394'}</td>
                        <td className="py-1 font-mono">P&#8322; - P&#8321; = {result.yield_change.toFixed(4)}</td>
                        <td className="py-1">Yield change repricing</td>
                      </tr>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600/50 font-semibold">
                        <td className="py-1 font-mono">Total</td>
                        <td className="py-1 font-mono">Carry (incl. roll) + Yield {'\u0394'} = {result.total.toFixed(4)}</td>
                        <td className="py-1">Exact identity</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <div className="mt-2">
                {Math.abs(result.residual) < 0.001 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                    Identity holds
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300">
                    Residual: {result.residual.toFixed(6)}
                  </span>
                )}
              </div>
            </div>
          </details>

          {/* Time Evolution */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">P&L Time Evolution</div>
              <button
                type="button"
                onClick={handleTimeEvolution}
                disabled={timeLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1 text-xs disabled:opacity-50 transition-colors"
              >
                {timeLoading ? 'Computing...' : 'Generate'}
              </button>
            </div>
            {timeEvolution && (
              <LazyPlot
                data={
                  timeEvolution[0].mode === 'g_spread'
                    ? [
                        {
                          type: 'bar',
                          x: ['1d', '7d', '30d', '90d', '180d', '1y'],
                          y: (timeEvolution as GSpreadDecompositionResult[]).map(r => r.carry),
                          name: 'Carry',
                          marker: { color: chartColors.accent },
                        },
                        {
                          type: 'bar',
                          x: ['1d', '7d', '30d', '90d', '180d', '1y'],
                          y: (timeEvolution as GSpreadDecompositionResult[]).map(r => r.roll),
                          name: 'Roll',
                          marker: { color: chartColors.muted },
                        },
                        {
                          type: 'bar',
                          x: ['1d', '7d', '30d', '90d', '180d', '1y'],
                          y: (timeEvolution as GSpreadDecompositionResult[]).map(r => r.spread_change),
                          name: 'Spread Δ',
                          marker: { color: '#f59e0b' },
                        },
                      ]
                    : [
                        {
                          type: 'bar',
                          x: ['1d', '7d', '30d', '90d', '180d', '1y'],
                          y: (timeEvolution as YieldDecompositionResult[]).map(r => r.carry_incl_roll),
                          name: 'Carry (incl. roll)',
                          marker: { color: chartColors.accent },
                        },
                        {
                          type: 'bar',
                          x: ['1d', '7d', '30d', '90d', '180d', '1y'],
                          y: (timeEvolution as YieldDecompositionResult[]).map(r => r.yield_change),
                          name: 'Yield Δ',
                          marker: { color: '#f59e0b' },
                        },
                      ]
                }
                layout={{
                  height: 250,
                  barmode: 'relative',
                  margin: { t: 20, b: 30, l: 50, r: 20 },
                  paper_bgcolor: ct.bgColor,
                  plot_bgcolor: ct.bgColor,
                  font: { color: ct.fontColor, size: 10 },
                  yaxis: { gridcolor: ct.gridcolor },
                  xaxis: { gridcolor: ct.gridcolor },
                  legend: { orientation: 'h', y: -0.15, font: { size: 9 } },
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%' }}
              />
            )}
          </div>
        </div>
        </details>
      )}
    </div>
  );
}
