import type { BondWithAnalytics } from '../../types/models';

interface Props {
  bonds: BondWithAnalytics[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function BondList({ bonds, selectedId, onSelect, onDelete }: Props) {
  if (bonds.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No bonds created yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Bonds ({bonds.length})</h3>
      {bonds.map(bwa => (
        <div
          key={bwa.bond.id}
          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedId === bwa.bond.id
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
          onClick={() => onSelect(bwa.bond.id!)}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{bwa.bond.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {bwa.bond.ticker ? `${bwa.bond.ticker} | ` : ''}
              Cpn {(bwa.bond.coupon * 100).toFixed(1)}% | YTM {(bwa.bond.ytm * 100).toFixed(2)}% | Mat {bwa.bond.maturity_date}
            </div>
          </div>
          <div className="flex items-center gap-3 ml-3">
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Carry (1y)</div>
              <div className="text-sm font-mono">{bwa.analytics.carry_annual.toFixed(4)}</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(bwa.bond.id!); }}
              className="text-red-500 hover:text-red-700 text-xs p-1"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
