import Plot from '../PlotlyChart';
import { useTheme } from '../../context/ThemeContext';
import type { BondWithAnalytics } from '../../types/models';

interface Props {
  data: BondWithAnalytics;
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v == null) return 'N/A';
  return v.toFixed(decimals);
}

export default function BondResults({ data }: Props) {
  const { theme } = useTheme();
  const { bond, analytics: a } = data;

  const card = "bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3";
  const statLabel = "text-xs text-gray-500 dark:text-gray-400";
  const statValue = "text-sm font-mono font-medium";

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{bond.name} {bond.ticker ? `(${bond.ticker})` : ''}</h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <div className={statLabel}>Dirty Price</div>
          <div className={statValue}>{fmt(a.dirty_price)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Clean Price</div>
          <div className={statValue}>{fmt(a.clean_price)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Accrued Interest</div>
          <div className={statValue}>{fmt(a.accrued_interest)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>YTM</div>
          <div className={statValue}>{(bond.ytm * 100).toFixed(2)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <div className={statLabel}>Carry (daily)</div>
          <div className={statValue}>{fmt(a.carry, 6)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Carry (ann.)</div>
          <div className={statValue}>{fmt(a.carry_annualized)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Roll-Down (3m)</div>
          <div className={statValue}>{fmt(a.roll_down)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Theta (1d)</div>
          <div className={statValue}>{fmt(a.theta, 6)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <div className={statLabel}>G-Spread (bps)</div>
          <div className={statValue}>{fmt(a.g_spread_bps, 1)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Z-Spread (bps)</div>
          <div className={statValue}>{fmt(a.z_spread_bps, 1)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Hazard Rate</div>
          <div className={statValue}>{fmt(a.hazard_rate, 6)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Repo Rate</div>
          <div className={statValue}>{(bond.repo_rate * 100).toFixed(2)}%</div>
        </div>
      </div>

      {a.survival_probabilities.length > 0 && (
        <div className={card}>
          <div className={statLabel + ' mb-2'}>Survival Curve</div>
          <Plot
            data={[{
              x: a.survival_probabilities.map(s => s.t),
              y: a.survival_probabilities.map(s => s.prob * 100),
              type: 'scatter',
              mode: 'lines',
              line: { color: '#6366f1', width: 2 },
              name: 'Survival %',
            }]}
            layout={{
              height: 150,
              margin: { t: 5, b: 30, l: 40, r: 10 },
              xaxis: { title: { text: 'Years', font: { size: 10 } }, gridcolor: theme === 'dark' ? '#374151' : '#e5e7eb' },
              yaxis: { title: { text: '%', font: { size: 10 } }, range: [0, 105], gridcolor: theme === 'dark' ? '#374151' : '#e5e7eb' },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { color: theme === 'dark' ? '#d1d5db' : '#374151', size: 10 },
            }}
            config={{ displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {a.cashflows.length > 0 && (
        <details className={card}>
          <summary className={statLabel + ' cursor-pointer'}>Cashflow Schedule ({a.cashflows.length} flows)</summary>
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="pb-1">Date</th>
                <th className="pb-1">Amount</th>
                <th className="pb-1">Type</th>
              </tr>
            </thead>
            <tbody>
              {a.cashflows.map((cf, i) => (
                <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-1 font-mono">{cf.date}</td>
                  <td className="py-1 font-mono">{cf.amount.toFixed(4)}</td>
                  <td className="py-1">{cf.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
