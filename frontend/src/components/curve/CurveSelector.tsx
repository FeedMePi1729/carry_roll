import { useState, useEffect } from 'react';
import { getTickers } from '../../api/client';

interface Props {
  onSelect: (ticker: string) => void;
  selected: string;
}

export default function CurveSelector({ onSelect, selected }: Props) {
  const [tickers, setTickers] = useState<string[]>([]);

  const refresh = () => {
    getTickers().then(setTickers).catch(() => {});
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">Ticker:</label>
      <select
        value={selected}
        onChange={e => onSelect(e.target.value)}
        className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
      >
        <option value="">Select a ticker</option>
        {tickers.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button onClick={refresh} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
        Refresh
      </button>
    </div>
  );
}
