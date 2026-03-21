import { StatCard } from '../ui/StatCard';
import { fmt } from '../../lib/formatters';
import type { CurveAnalytics } from '../../types/models';

interface Props {
  data: CurveAnalytics;
  horizonDays?: number;
}

export default function CurveStats({ data, horizonDays = 0 }: Props) {
  const hasRolled = horizonDays > 0 && data.points.some(p => p.rolled_maturity != null);

  const horizonLabel = horizonDays >= 365
    ? `${(horizonDays / 365).toFixed(0)}y`
    : horizonDays >= 30
    ? `${Math.round(horizonDays / 30)}mo`
    : `${horizonDays}d`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Avg Z-Spread (bps)" value={fmt(data.avg_z_spread_bps, 1)} />
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
                <th className="pb-1 pr-3">Z-Sprd (bps)</th>
                <th className="pb-1 pr-3">Carry (1y)</th>
                <th className="pb-1 pr-3">Roll (1y)</th>

                {hasRolled && <th className="pb-1 pr-3">Rolled Mat</th>}
                {hasRolled && <th className="pb-1 pr-3">Rolled YTM</th>}
                {hasRolled && <th className="pb-1 pr-3">Carry ({horizonLabel})</th>}
                {hasRolled && <th className="pb-1 pr-3">Pull to Par ({horizonLabel})</th>}
                {hasRolled && <th className="pb-1 pr-3">Roll-Down ({horizonLabel})</th>}
                {hasRolled && <th className="pb-1">Total ({horizonLabel})</th>}
              </tr>
            </thead>
            <tbody>
              {data.points.map(p => (
                <tr key={p.bond_id} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-1 pr-3">{p.name}</td>
                  <td className="py-1 pr-3 font-mono">{p.maturity.toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{(p.ytm * 100).toFixed(2)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.z_spread_bps, 1)}</td>
                  <td className="py-1 pr-3 font-mono">{p.carry_1y.toFixed(4)}</td>
                  <td className="py-1 pr-3 font-mono">{fmt(p.roll_1y ?? null, 4)}</td>
                  {hasRolled && (
                    <td className="py-1 pr-3 font-mono">
                      {p.rolled_maturity != null ? p.rolled_maturity.toFixed(2) : '-'}
                    </td>
                  )}
                  {hasRolled && (
                    <td className="py-1 pr-3 font-mono">
                      {p.rolled_ytm != null ? (p.rolled_ytm * 100).toFixed(3) : '-'}
                    </td>
                  )}
                  {hasRolled && (
                    <td className={`py-1 pr-3 font-mono ${(p.decomp_carry ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {p.decomp_carry != null ? p.decomp_carry.toFixed(4) : '-'}
                    </td>
                  )}
                  {hasRolled && (
                    <td className={`py-1 pr-3 font-mono ${(p.decomp_pull_to_par ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {p.decomp_pull_to_par != null ? p.decomp_pull_to_par.toFixed(4) : '-'}
                    </td>
                  )}
                  {hasRolled && (
                    <td className={`py-1 pr-3 font-mono ${(p.decomp_roll_down ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {p.decomp_roll_down != null ? p.decomp_roll_down.toFixed(4) : '-'}
                    </td>
                  )}
                  {hasRolled && (
                    <td className={`py-1 font-mono font-semibold ${(p.decomp_total ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {p.decomp_total != null ? p.decomp_total.toFixed(4) : '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
