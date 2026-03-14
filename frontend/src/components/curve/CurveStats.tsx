import Plot from '../PlotlyChart';
import { useTheme } from '../../context/ThemeContext';
import type { CurveAnalytics } from '../../types/models';

interface Props {
  data: CurveAnalytics;
}

function fmt(v: number | null | undefined, d = 1): string {
  if (v == null) return 'N/A';
  return v.toFixed(d);
}

export default function CurveStats({ data }: Props) {
  const { theme } = useTheme();
  const card = "bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3";
  const statLabel = "text-xs text-gray-500 dark:text-gray-400";
  const statValue = "text-sm font-mono font-medium";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <div className={statLabel}>Avg G-Spread (bps)</div>
          <div className={statValue}>{fmt(data.avg_g_spread_bps)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Avg Z-Spread (bps)</div>
          <div className={statValue}>{fmt(data.avg_z_spread_bps)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Bonds on Curve</div>
          <div className={statValue}>{data.points.length}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Ticker</div>
          <div className={statValue}>{data.ticker}</div>
        </div>
      </div>

      {data.survival_curve.length > 0 && (
        <div className={card}>
          <div className={statLabel + ' mb-2'}>Survival Curve</div>
          <Plot
            data={[{
              x: data.survival_curve.map(s => s.t),
              y: data.survival_curve.map(s => s.prob * 100),
              type: 'scatter',
              mode: 'lines',
              line: { color: '#ef4444', width: 2 },
              name: 'Survival %',
            }]}
            layout={{
              height: 180,
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

      <div className={card}>
        <div className={statLabel + ' mb-2'}>Bond Details</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="pb-1 pr-3">Name</th>
                <th className="pb-1 pr-3">Mat (yrs)</th>
                <th className="pb-1 pr-3">YTM (%)</th>
                <th className="pb-1 pr-3">G-Sprd (bps)</th>
                <th className="pb-1 pr-3">Z-Sprd (bps)</th>
                <th className="pb-1 pr-3">Carry (ann.)</th>
                <th className="pb-1 pr-3">Roll-Down</th>
                <th className="pb-1">Theta</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map(p => (
                <tr key={p.bond_id} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-1 pr-3">{p.name}</td>
                  <td className="py-1 pr-3 font-mono">{p.maturity.toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{(p.ytm * 100).toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.g_spread_bps)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.z_spread_bps)}</td>
                  <td className="py-1 pr-3 font-mono">{p.carry_annualized.toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.roll_down, 4)}</td>
                  <td className="py-1 font-mono">{p.theta.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
