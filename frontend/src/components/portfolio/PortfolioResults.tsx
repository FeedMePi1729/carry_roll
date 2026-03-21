import { StatCard } from '../ui/StatCard';
import { fmt } from '../../lib/formatters';
import type { PortfolioAnalytics } from '../../types/models';

interface Props {
  portfolio: PortfolioAnalytics;
  onDelete: (id: string) => void;
}

export default function PortfolioResults({ portfolio: p, onDelete }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">{p.name || `Portfolio: ${p.portfolio_id.slice(0, 8)}…`}</h4>
        <button onClick={() => onDelete(p.portfolio_id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatCard label="Wtd Carry (1m)" value={fmt(p.weighted_carry_1m, 4)} />
        <StatCard label="Wtd Carry (1y)" value={fmt(p.weighted_carry_1y)} />
        <StatCard label="Wtd Roll (1m)"  value={fmt(p.weighted_roll_1m, 4)} />
        <StatCard label="Wtd Roll (1y)"  value={fmt(p.weighted_roll_1y)} />
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400">
            <th className="pb-1">Bond</th>
            <th className="pb-1">Weight</th>
            <th className="pb-1">Carry (1y)</th>
            <th className="pb-1">Roll (1y)</th>
          </tr>
        </thead>
        <tbody>
          {p.positions.map(pos => (
            <tr key={pos.bond_id} className="border-t border-gray-200 dark:border-gray-600">
              <td className="py-1">{pos.name || pos.bond_id.slice(0, 8)}</td>
              <td className="py-1 font-mono">{(pos.weight * 100).toFixed(1)}%</td>
              <td className="py-1 font-mono">{fmt(pos.carry_1y)}</td>
              <td className="py-1 font-mono">{fmt(pos.roll_1y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
