import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useDragReorder } from '../../hooks/useDragReorder';
import { LazyPlot } from '../charts/LazyPlot';
import { chartColors, chartTheme } from '../../lib/chartTheme';
import type { TreasuryCurvePoint } from '../../types/models';

interface PointRow { tenor: string; yieldPct: string; }

function toRows(points: TreasuryCurvePoint[]): PointRow[] {
  return points.map(p => ({ tenor: String(p.tenor), yieldPct: (p.yield_rate * 100).toFixed(2) }));
}
function fromRows(rows: PointRow[]): TreasuryCurvePoint[] {
  return rows.map(r => ({ tenor: parseFloat(r.tenor) || 0, yield_rate: (parseFloat(r.yieldPct) || 0) / 100 }));
}

interface Props {
  points: TreasuryCurvePoint[];
  isSaving: boolean;
  isRefreshing: boolean;
  onSave: (points: TreasuryCurvePoint[]) => Promise<boolean>;
  onRefreshFromLive: () => Promise<void>;
  onCurveUpdated?: () => void;
}

export default function TreasuryCurveEditor({ points, isSaving, isRefreshing, onSave, onRefreshFromLive, onCurveUpdated }: Props) {
  const { theme } = useTheme();
  const ct = chartTheme(theme === 'dark');
  const [rows, setRows] = useState<PointRow[]>(toRows(points));
  const [collapsed, setCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sync local rows when the parent's authoritative points change (initial load, live refresh)
  useEffect(() => {
    if (points.length > 0) setRows(toRows(points));
  }, [points]);

  const { dragOverIdx, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useDragReorder(rows, setRows);

  const handleSave = async () => {
    setSaveError('');
    const success = await onSave(fromRows(rows));
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onCurveUpdated?.();
    } else {
      setSaveError('Failed to save');
    }
  };

  const handleRefresh = async () => {
    await onRefreshFromLive();
    onCurveUpdated?.();
  };

  const updateRow = (idx: number, field: keyof PointRow, value: string) =>
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const addRow    = () => setRows(rs => [...rs, { tenor: '', yieldPct: '' }]);
  const removeRow = (idx: number) => setRows(rs => rs.filter((_, i) => i !== idx));
  const sortByTenor = () => setRows(rs => [...rs].sort((a, b) => (parseFloat(a.tenor) || 0) - (parseFloat(b.tenor) || 0)));

  const sorted = [...fromRows(rows)].sort((a, b) => a.tenor - b.tenor);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <span className="font-medium text-sm">Treasury Yield Curve</span>
        <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-1 w-8"></th>
                    <th className="pb-1 pr-2">Tenor (yrs)</th>
                    <th className="pb-1 pr-2">Yield (%)</th>
                    <th className="pb-1 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={e => handleDragOver(e, i)}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={handleDragEnd}
                      className={`transition-colors ${dragOverIdx === i ? 'border-t-2 border-indigo-500' : ''}`}
                    >
                      <td className="py-0.5 pr-1 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 select-none text-center" title="Drag to reorder">
                        &#8942;&#8942;
                      </td>
                      <td className="pr-2 py-0.5">
                        <input type="text" inputMode="decimal" value={r.tenor}
                          onChange={e => updateRow(i, 'tenor', e.target.value)}
                          className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1 px-2" />
                      </td>
                      <td className="pr-2 py-0.5">
                        <input type="text" inputMode="decimal" value={r.yieldPct}
                          onChange={e => updateRow(i, 'yieldPct', e.target.value)}
                          className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1 px-2" />
                      </td>
                      <td className="py-0.5">
                        <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 text-xs">x</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {saveError && <p className="text-red-500 text-xs mt-1">{saveError}</p>}
            <div className="flex gap-2 mt-2 flex-wrap">
              <button onClick={addRow} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">+ Add Point</button>
              <button onClick={sortByTenor} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">Sort by Tenor</button>
              <button onClick={handleRefresh} disabled={isRefreshing}
                className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {isRefreshing ? 'Fetching...' : 'Refresh Live Data'}
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Curve'}
              </button>
            </div>
          </div>

          <LazyPlot
            data={[{
              x: sorted.map(p => p.tenor),
              y: sorted.map(p => p.yield_rate * 100),
              type: 'scatter', mode: 'lines+markers',
              marker: { color: chartColors.accent, size: 6 },
              line:   { color: chartColors.accent, width: 2 },
              name: 'Treasury',
            }]}
            layout={{
              height: 200,
              margin: { t: 10, b: 30, l: 40, r: 10 },
              xaxis: { title: { text: 'Tenor (yrs)', font: { size: 10 } }, gridcolor: ct.gridcolor },
              yaxis: { title: { text: 'Yield (%)',   font: { size: 10 } }, gridcolor: ct.gridcolor },
              paper_bgcolor: ct.bgColor, plot_bgcolor: ct.bgColor,
              font: { color: ct.fontColor, size: 10 },
            }}
            config={{ displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
