import { StatCard } from '../ui/StatCard';
import { fmt } from '../../lib/formatters';
import PnLDecomposition from './PnLDecomposition';
import type { BondWithAnalytics } from '../../types/models';

interface Props {
  data: BondWithAnalytics;
}

export default function BondResults({ data }: Props) {
  const { bond, analytics: a } = data;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{bond.name} {bond.ticker ? `(${bond.ticker})` : ''}</h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Dirty Price"      value={fmt(a.dirty_price)} />
        <StatCard label="Clean Price"      value={fmt(a.clean_price)} />
        <StatCard label="Accrued Interest" value={fmt(a.accrued_interest)} />
        <StatCard label="YTM"              value={`${(bond.ytm * 100).toFixed(2)}%`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Carry (1d)" value={fmt(a.carry_daily, 6)} />
        <StatCard label="Carry (1w)" value={fmt(a.carry_weekly, 5)} />
        <StatCard label="Carry (1y)" value={fmt(a.carry_annual)} />
        <StatCard label="C+R (1y)"   value={a.roll_annual != null ? fmt(a.carry_annual + a.roll_annual) : 'N/A'} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Roll (1d)" value={fmt(a.roll_daily, 6)} />
        <StatCard label="Roll (1w)" value={fmt(a.roll_weekly, 5)} />
        <StatCard label="Roll (1y)" value={fmt(a.roll_annual)} />
        <StatCard label="C+R (1d)"  value={a.roll_daily != null ? fmt(a.carry_daily + a.roll_daily, 6) : 'N/A'} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="G-Spread (bps)" value={fmt(a.g_spread_bps, 1)} />
        <StatCard label="Repo Rate"      value={`${(bond.repo_rate * 100).toFixed(2)}%`} />
      </div>

      <PnLDecomposition bondId={bond.id!} bond={bond} analytics={a} />

      {a.cashflows.length > 0 && (
        <details className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            Cashflow Schedule ({a.cashflows.length} flows)
          </summary>
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
