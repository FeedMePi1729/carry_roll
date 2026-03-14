import type { PortfolioAnalytics } from '../../types/models';

interface Props {
  portfolio: PortfolioAnalytics;
  onDelete: (id: string) => void;
}

function fmt(v: number | null | undefined, d = 4): string {
  if (v == null) return 'N/A';
  return v.toFixed(d);
}

export default function PortfolioResults({ portfolio: p, onDelete }: Props) {
  const card = "bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3";
  const statLabel = "text-xs text-gray-500 dark:text-gray-400";
  const statValue = "text-sm font-mono font-medium";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Portfolio: {p.portfolio_id.slice(0, 8)}...</h4>
        <button onClick={() => onDelete(p.portfolio_id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className={card}>
          <div className={statLabel}>Wtd Carry (daily)</div>
          <div className={statValue}>{fmt(p.weighted_carry, 6)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Wtd Carry (ann.)</div>
          <div className={statValue}>{fmt(p.weighted_carry_annualized)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Wtd Roll-Down</div>
          <div className={statValue}>{fmt(p.weighted_roll_down)}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Wtd Theta</div>
          <div className={statValue}>{fmt(p.weighted_theta, 6)}</div>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400">
            <th className="pb-1">Bond</th>
            <th className="pb-1">Weight</th>
            <th className="pb-1">Carry (ann.)</th>
            <th className="pb-1">Roll-Down</th>
            <th className="pb-1">Theta</th>
          </tr>
        </thead>
        <tbody>
          {p.positions.map(pos => (
            <tr key={pos.bond_id} className="border-t border-gray-200 dark:border-gray-600">
              <td className="py-1">{pos.name || pos.bond_id.slice(0, 8)}</td>
              <td className="py-1 font-mono">{(pos.weight * 100).toFixed(1)}%</td>
              <td className="py-1 font-mono">{fmt(pos.carry_annualized)}</td>
              <td className="py-1 font-mono">{fmt(pos.roll_down)}</td>
              <td className="py-1 font-mono">{fmt(pos.theta, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
