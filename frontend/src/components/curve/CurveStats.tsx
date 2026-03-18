import { StatCard } from '../ui/StatCard';
import { fmt } from '../../lib/formatters';
import type { CurveAnalytics } from '../../types/models';

interface Props {
  data: CurveAnalytics;
}

export default function CurveStats({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Avg G-Spread (bps)" value={fmt(data.avg_g_spread_bps, 1)} />
        <StatCard label="Bonds on Curve"     value={String(data.points.length)} />
        <StatCard label="Ticker"             value={data.ticker} />
      </div>

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
