import Plot from '../PlotlyChart';
import { useTheme } from '../../context/ThemeContext';
import { useDebounce } from '../../hooks/useDebounce';
import type { CurveAnalytics } from '../../types/models';
import { moveBondOnCurve } from '../../api/client';

interface Props {
  data: CurveAnalytics;
  treasuryPoints?: Array<{ tenor: number; yield_rate: number }>;
  onUpdated: (data: CurveAnalytics) => void;
}

export default function CurveChart({ data, treasuryPoints, onUpdated }: Props) {
  const { theme } = useTheme();

  const debouncedMove = useDebounce(async (bondId: string, ytm: number, maturity: number) => {
    try {
      const updated = await moveBondOnCurve(data.ticker, bondId, ytm, maturity);
      onUpdated(updated);
    } catch (err) {
      console.error('Failed to move bond', err);
    }
  }, 300);

  const traces: any[] = [];

  // Treasury curve reference line
  if (treasuryPoints && treasuryPoints.length > 0) {
    const sorted = [...treasuryPoints].sort((a, b) => a.tenor - b.tenor);
    traces.push({
      x: sorted.map(p => p.tenor),
      y: sorted.map(p => p.yield_rate * 100),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#94a3b8', width: 1.5, dash: 'dash' },
      name: 'Treasury',
    });
  }

  // Bond points on the curve
  traces.push({
    x: data.points.map(p => p.maturity),
    y: data.points.map(p => p.ytm * 100),
    text: data.points.map(p => p.name),
    type: 'scatter',
    mode: 'markers+text',
    textposition: 'top center',
    textfont: { size: 10 },
    marker: { color: '#6366f1', size: 10, symbol: 'circle' },
    name: data.ticker,
  });

  return (
    <div>
      <Plot
        data={traces}
        layout={{
          height: 350,
          margin: { t: 30, b: 40, l: 50, r: 20 },
          xaxis: {
            title: { text: 'Maturity (years)', font: { size: 11 } },
            gridcolor: theme === 'dark' ? '#374151' : '#e5e7eb',
          },
          yaxis: {
            title: { text: 'YTM (%)', font: { size: 11 } },
            gridcolor: theme === 'dark' ? '#374151' : '#e5e7eb',
          },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: theme === 'dark' ? '#d1d5db' : '#374151', size: 11 },
          legend: { orientation: 'h', y: 1.1 },
          dragmode: 'pan',
        }}
        config={{
          editable: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
        }}
        onRelayout={() => {
          // When points are dragged via editable mode, Plotly fires restyle-like events
        }}
        onRestyle={(eventData: any) => {
          // Capture edits to trace data (drag events)
          if (!eventData || !eventData[0]) return;
          const changes = eventData[0];
          const traceIdx = eventData[1]?.[0] ?? (traces.length - 1);
          // Only handle bond trace (last one)
          if (traceIdx !== traces.length - 1) return;

          if (changes['x'] || changes['y']) {
            // Full array update
            const newX = changes['x'] || data.points.map(p => p.maturity);
            const newY = changes['y'] || data.points.map(p => p.ytm * 100);
            data.points.forEach((p, i) => {
              if (newX[i] !== undefined && newY[i] !== undefined) {
                const newYtm = newY[i] / 100;
                const newMat = newX[i];
                if (Math.abs(newYtm - p.ytm) > 0.0001 || Math.abs(newMat - p.maturity) > 0.01) {
                  debouncedMove(p.bond_id, newYtm, newMat);
                }
              }
            });
          }
        }}
        style={{ width: '100%' }}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Drag points on the chart to move bonds. Stats update automatically.
      </p>
    </div>
  );
}
