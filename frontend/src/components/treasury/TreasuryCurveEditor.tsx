import { useState, useEffect, useRef } from 'react';
import Plot from '../PlotlyChart';
import { useTheme } from '../../context/ThemeContext';
import type { TreasuryCurve, TreasuryCurvePoint } from '../../types/models';
import { getTreasuryCurve, setTreasuryCurve, refreshTreasuryCurve } from '../../api/client';

const DEFAULT_POINTS: TreasuryCurvePoint[] = [
  { tenor: 0.25, yield_rate: 0.0435 },
  { tenor: 0.5, yield_rate: 0.044 },
  { tenor: 1, yield_rate: 0.0445 },
  { tenor: 2, yield_rate: 0.042 },
  { tenor: 3, yield_rate: 0.041 },
  { tenor: 5, yield_rate: 0.04 },
  { tenor: 7, yield_rate: 0.041 },
  { tenor: 10, yield_rate: 0.042 },
  { tenor: 20, yield_rate: 0.045 },
  { tenor: 30, yield_rate: 0.046 },
];

interface Props {
  onCurveUpdated?: () => void;
}

// Store display strings separately so the user can freely type
interface PointRow {
  tenor: string;
  yieldPct: string;
}

function toRows(points: TreasuryCurvePoint[]): PointRow[] {
  return points.map(p => ({
    tenor: String(p.tenor),
    yieldPct: (p.yield_rate * 100).toFixed(2),
  }));
}

function fromRows(rows: PointRow[]): TreasuryCurvePoint[] {
  return rows.map(r => ({
    tenor: parseFloat(r.tenor) || 0,
    yield_rate: (parseFloat(r.yieldPct) || 0) / 100,
  }));
}

export default function TreasuryCurveEditor({ onCurveUpdated }: Props) {
  const { theme } = useTheme();
  const [rows, setRows] = useState<PointRow[]>(toRows(DEFAULT_POINTS));
  const [collapsed, setCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getTreasuryCurve().then(curve => {
      if (curve && curve.points.length > 0) {
        setRows(toRows(curve.points));
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const points = fromRows(rows);
      const curve: TreasuryCurve = {
        as_of_date: new Date().toISOString().split('T')[0],
        points: [...points].sort((a, b) => a.tenor - b.tenor),
      };
      await setTreasuryCurve(curve);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onCurveUpdated?.();
    } catch (e) {
      console.error('Failed to save treasury curve', e);
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (idx: number, field: keyof PointRow, value: string) => {
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows(rs => [...rs, { tenor: '', yieldPct: '' }]);
  const removeRow = (idx: number) => setRows(rs => rs.filter((_, i) => i !== idx));

  // Drag-and-drop reordering
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) {
      dragIdx.current = null;
      setDragOverIdx(null);
      return;
    }
    setRows(rs => {
      const next = [...rs];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const curve = await refreshTreasuryCurve();
      setRows(toRows(curve.points));
      onCurveUpdated?.();
    } catch (e) {
      console.error('Failed to refresh treasury curve from Massive', e);
    } finally {
      setRefreshing(false);
    }
  };

  const sortByTenor = () => {
    setRows(rs => [...rs].sort((a, b) => (parseFloat(a.tenor) || 0) - (parseFloat(b.tenor) || 0)));
  };

  const points = fromRows(rows);
  const sorted = [...points].sort((a, b) => a.tenor - b.tenor);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
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
                      className={`transition-colors ${
                        dragOverIdx === i
                          ? 'border-t-2 border-indigo-500'
                          : ''
                      }`}
                    >
                      <td className="py-0.5 pr-1 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 select-none text-center" title="Drag to reorder">
                        &#8942;&#8942;
                      </td>
                      <td className="pr-2 py-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.tenor}
                          onChange={e => updateRow(i, 'tenor', e.target.value)}
                          className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1 px-2"
                        />
                      </td>
                      <td className="pr-2 py-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.yieldPct}
                          onChange={e => updateRow(i, 'yieldPct', e.target.value)}
                          className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1 px-2"
                        />
                      </td>
                      <td className="py-0.5">
                        <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 text-xs">x</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={addRow} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                + Add Point
              </button>
              <button onClick={sortByTenor} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                Sort by Tenor
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {refreshing ? 'Fetching...' : 'Refresh Live Data'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Curve'}
              </button>
            </div>
          </div>

          <div>
            <Plot
              data={[{
                x: sorted.map(p => p.tenor),
                y: sorted.map(p => p.yield_rate * 100),
                type: 'scatter',
                mode: 'lines+markers',
                marker: { color: '#6366f1', size: 6 },
                line: { color: '#6366f1', width: 2 },
                name: 'Treasury',
              }]}
              layout={{
                height: 200,
                margin: { t: 10, b: 30, l: 40, r: 10 },
                xaxis: { title: { text: 'Tenor (yrs)', font: { size: 10 } }, gridcolor: theme === 'dark' ? '#374151' : '#e5e7eb' },
                yaxis: { title: { text: 'Yield (%)', font: { size: 10 } }, gridcolor: theme === 'dark' ? '#374151' : '#e5e7eb' },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: theme === 'dark' ? '#d1d5db' : '#374151', size: 10 },
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
