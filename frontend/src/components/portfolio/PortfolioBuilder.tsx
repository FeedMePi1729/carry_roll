import { useState } from 'react';
import type { BondWithAnalytics, PortfolioAnalytics } from '../../types/models';
import { createPortfolio } from '../../api/client';

interface Props {
  bonds: BondWithAnalytics[];
  onPortfolioCreated: (p: PortfolioAnalytics) => void;
}

export default function PortfolioBuilder({ bonds, onPortfolioCreated }: Props) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setSelected(s => {
      const next = { ...s };
      if (id in next) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setWeight = (id: string, w: number) => {
    setSelected(s => ({ ...s, [id]: w }));
  };

  const normalize = () => {
    const total = Object.values(selected).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    setSelected(s => {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(s)) next[k] = v / total;
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name) { setError('Name is required'); return; }
    const ids = Object.keys(selected);
    if (ids.length === 0) { setError('Select at least one bond'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createPortfolio({
        name,
        positions: ids.map(id => ({ bond_id: id, weight: selected[id] })),
      });
      onPortfolioCreated(result);
      setName('');
      setSelected({});
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create portfolio');
    } finally {
      setLoading(false);
    }
  };

  if (bonds.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Create some bonds first to build a portfolio.</p>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold mb-3">Build Portfolio</h3>

      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Portfolio Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
          placeholder="e.g. Short Duration"
        />
      </div>

      <div className="space-y-1 mb-3">
        {bonds.map(bwa => (
          <div key={bwa.bond.id} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={bwa.bond.id! in selected}
              onChange={() => toggle(bwa.bond.id!)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="flex-1 truncate">{bwa.bond.name}</span>
            {bwa.bond.id! in selected && (
              <input
                type="number"
                step="0.01"
                min="0"
                value={selected[bwa.bond.id!]}
                onChange={e => setWeight(bwa.bond.id!, parseFloat(e.target.value) || 0)}
                className="w-20 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      <div className="flex gap-2">
        <button onClick={normalize} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
          Normalize Weights
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Portfolio'}
        </button>
      </div>
    </div>
  );
}
