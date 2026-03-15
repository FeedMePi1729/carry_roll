import { useTheme } from '../../context/ThemeContext';
import { LazyPlot } from '../charts/LazyPlot';
import { StatCard } from '../ui/StatCard';
import { fmt } from '../../lib/formatters';
import { chartColors, chartTheme } from '../../lib/chartTheme';
import type { CurveAnalytics } from '../../types/models';

interface Props {
  data: CurveAnalytics;
}

export default function CurveStats({ data }: Props) {
  const { theme } = useTheme();
  const ct = chartTheme(theme === 'dark');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Avg G-Spread (bps)" value={fmt(data.avg_g_spread_bps, 1)} />
        <StatCard label="Avg Z-Spread (bps)" value={fmt(data.avg_z_spread_bps, 1)} />
        <StatCard label="Bonds on Curve"     value={String(data.points.length)} />
        <StatCard label="Ticker"             value={data.ticker} />
      </div>

      {data.survival_curve.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Survival Curve</div>
          <LazyPlot
            data={[{
              x: data.survival_curve.map(s => s.t),
              y: data.survival_curve.map(s => s.prob * 100),
              type: 'scatter', mode: 'lines',
              line: { color: chartColors.danger, width: 2 },
              name: 'Survival %',
            }]}
            layout={{
              height: 180,
              margin: { t: 5, b: 30, l: 40, r: 10 },
              xaxis: { title: { text: 'Years', font: { size: 10 } }, gridcolor: ct.gridcolor },
              yaxis: { title: { text: '%',     font: { size: 10 } }, range: [0, 105], gridcolor: ct.gridcolor },
              paper_bgcolor: ct.bgColor, plot_bgcolor: ct.bgColor,
              font: { color: ct.fontColor, size: 10 },
            }}
            config={{ displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Bond Details</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="pb-1 pr-3">Name</th>
                <th className="pb-1 pr-3">Mat (yrs)</th>
                <th className="pb-1 pr-3">YTM (%)</th>
                <th className="pb-1 pr-3">G-Sprd (bps)</th>
                <th className="pb-1 pr-3">Z-Sprd (bps)</th>
                <th className="pb-1 pr-3">Carry (1y)</th>
                <th className="pb-1">Roll (1y)</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map(p => (
                <tr key={p.bond_id} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-1 pr-3">{p.name}</td>
                  <td className="py-1 pr-3 font-mono">{p.maturity.toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{(p.ytm * 100).toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.g_spread_bps, 1)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.z_spread_bps, 1)}</td>
                  <td className="py-1 pr-3 font-mono">{p.carry_annual.toFixed(4)}</td>
                  <td className="py-1 font-mono">{fmt(p.roll_annual ?? null, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
