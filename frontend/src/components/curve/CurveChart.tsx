import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useDebounce } from '../../hooks/useDebounce';
import { LazyPlot } from '../charts/LazyPlot';
import { chartColors, chartTheme } from '../../lib/chartTheme';
import type { CurveAnalytics } from '../../types/models';
import { moveBondOnCurve } from '../../api/client';

type ChartMode = 'yield' | 'zspread';

interface Props {
  data: CurveAnalytics;
  treasuryPoints?: Array<{ tenor: number; yield_rate: number }>;
  horizonDays?: number;
  onUpdated: (data: CurveAnalytics) => void;
}

export default function CurveChart({ data, treasuryPoints, horizonDays = 0, onUpdated }: Props) {
  const { theme } = useTheme();
  const ct = chartTheme(theme === 'dark');
  const [chartMode, setChartMode] = useState<ChartMode>('yield');

  const debouncedMove = useDebounce(async (bondId: string, ytm: number, maturity: number) => {
    try {
      const updated = await moveBondOnCurve(data.ticker, bondId, ytm, maturity);
      onUpdated(updated);
    } catch (err) {
      console.error('Failed to move bond', err);
    }
  }, 300);

  const isZSpread = chartMode === 'zspread';

  const traces: any[] = [];

  // Treasury curve — only meaningful in yield space
  if (!isZSpread && treasuryPoints && treasuryPoints.length > 0) {
    const sorted = [...treasuryPoints].sort((a, b) => a.tenor - b.tenor);
    traces.push({
      x: sorted.map(p => p.tenor),
      y: sorted.map(p => p.yield_rate * 100),
      type: 'scatter', mode: 'lines',
      line: { color: chartColors.muted, width: 1.5, dash: 'dash' },
      name: 'Treasury',
    });
  }

  // Issuer Z-spread curve — only in Z-spread mode (analogous to treasury in yield mode)
  if (isZSpread && data.z_spread_curve_points && data.z_spread_curve_points.length >= 2) {
    const sorted = [...data.z_spread_curve_points].sort((a, b) => a.maturity - b.maturity);
    traces.push({
      x: sorted.map(p => p.maturity),
      y: sorted.map(p => p.z_spread_bps),
      type: 'scatter', mode: 'lines',
      line: { color: chartColors.muted, width: 1.5, dash: 'dash' },
      name: 'Z-Spread Curve',
    });
  }

  // Current bond positions
  const visiblePoints = isZSpread
    ? data.points.filter(p => p.z_spread_bps != null)
    : data.points;

  traces.push({
    x: visiblePoints.map(p => p.maturity),
    y: isZSpread
      ? visiblePoints.map(p => p.z_spread_bps!)
      : visiblePoints.map(p => p.ytm * 100),
    text: visiblePoints.map(p => p.name),
    type: 'scatter', mode: 'markers+text',
    textposition: 'top center',
    textfont: { size: 10 },
    marker: { color: chartColors.accent, size: 10, symbol: 'circle' },
    name: 'Current',
  });

  // When a horizon is active, add arrow lines and ghost markers
  if (horizonDays > 0) {
    const rolledPoints = isZSpread
      ? data.points.filter(p => p.rolled_maturity != null && p.rolled_z_spread_bps != null)
      : data.points.filter(p => p.rolled_maturity != null && p.rolled_ytm != null);

    // Arrow lines: one per bond from current → rolled position
    rolledPoints.forEach(p => {
      const rollDown = p.decomp_roll_down ?? 0;
      const arrowColor = rollDown >= 0 ? '#22c55e' : '#ef4444';
      traces.push({
        x: [p.maturity, p.rolled_maturity],
        y: isZSpread
          ? [p.z_spread_bps!, p.rolled_z_spread_bps!]
          : [p.ytm * 100, p.rolled_ytm! * 100],
        type: 'scatter',
        mode: 'lines',
        line: { color: arrowColor, width: 1.5, dash: 'dot' },
        showlegend: false,
        hoverinfo: 'skip',
      });
    });

    // Horizon label for legend entry
    const horizonLabel = horizonDays >= 365
      ? `${(horizonDays / 365).toFixed(0)}y`
      : horizonDays >= 30
      ? `${Math.round(horizonDays / 30)}mo`
      : `${horizonDays}d`;

    // Ghost markers at rolled positions
    if (rolledPoints.length > 0) {
      const yCurrent = isZSpread
        ? rolledPoints.map(p => p.z_spread_bps!)
        : rolledPoints.map(p => p.ytm * 100);
      const yRolled = isZSpread
        ? rolledPoints.map(p => p.rolled_z_spread_bps!)
        : rolledPoints.map(p => p.rolled_ytm! * 100);

      traces.push({
        x: rolledPoints.map(p => p.rolled_maturity),
        y: yRolled,
        text: rolledPoints.map(p => p.name + ' (rolled)'),
        customdata: rolledPoints.map((p, i) => [
          p.name,
          p.maturity.toFixed(2),
          p.rolled_maturity?.toFixed(2) ?? '-',
          yCurrent[i].toFixed(isZSpread ? 1 : 3),
          yRolled[i].toFixed(isZSpread ? 1 : 3),
          (p.decomp_carry ?? 0).toFixed(4),
          (p.decomp_pull_to_par ?? 0).toFixed(4),
          (p.decomp_roll_down ?? 0).toFixed(4),
          (p.decomp_total ?? 0).toFixed(4),
        ]),
        type: 'scatter',
        mode: 'markers+text',
        textposition: 'bottom center',
        textfont: { size: 9, color: ct.fontColor },
        marker: {
          color: 'rgba(0,0,0,0)',
          size: 10,
          symbol: 'circle-open',
          line: { color: chartColors.accent, width: 1.5 },
        },
        name: `Rolled (${horizonLabel})`,
        hovertemplate:
          '<b>%{customdata[0]} (rolled)</b><br>' +
          'Maturity: %{customdata[1]}yr → %{customdata[2]}yr<br>' +
          (isZSpread
            ? 'Z-Spread: %{customdata[3]}bps → %{customdata[4]}bps<br>'
            : 'YTM: %{customdata[3]}% → %{customdata[4]}%<br>') +
          '<span style="color:#aaa">─────────────────</span><br>' +
          'Carry:       %{customdata[5]}<br>' +
          'Pull to Par: %{customdata[6]}<br>' +
          'Roll-Down:   %{customdata[7]}<br>' +
          '<b>Total:       %{customdata[8]}</b>' +
          '<extra></extra>',
      });
    }
  }

  const modeButtonClass = (mode: ChartMode) =>
    `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
      chartMode === mode
        ? 'bg-indigo-600 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
    }`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">View:</span>
        <button className={modeButtonClass('yield')} onClick={() => setChartMode('yield')}>
          Yield
        </button>
        <button className={modeButtonClass('zspread')} onClick={() => setChartMode('zspread')}>
          Z-Spread
        </button>
      </div>

      <LazyPlot
        data={traces}
        layout={{
          height: 350,
          margin: { t: 30, b: 40, l: 50, r: 20 },
          xaxis: { title: { text: 'Maturity (years)', font: { size: 11 } }, gridcolor: ct.gridcolor },
          yaxis: {
            title: { text: isZSpread ? 'Z-Spread (bps)' : 'YTM (%)', font: { size: 11 } },
            gridcolor: ct.gridcolor,
          },
          paper_bgcolor: ct.bgColor, plot_bgcolor: ct.bgColor,
          font: { color: ct.fontColor, size: 11 },
          legend: { orientation: 'h', y: 1.1 },
          dragmode: 'pan',
        }}
        config={{
          editable: !isZSpread,
          displayModeBar: true,
          modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
        }}
        onRelayout={() => {}}
        onRestyle={(eventData: any) => {
          if (isZSpread) return;
          if (!eventData || !eventData[0]) return;
          const changes = eventData[0];
          const bondTraceIdx = treasuryPoints && treasuryPoints.length > 0 ? 1 : 0;
          const traceIdx = eventData[1]?.[0] ?? bondTraceIdx;
          if (traceIdx !== bondTraceIdx) return;

          if (changes['x'] || changes['y']) {
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
        {isZSpread
          ? 'Z-Spread view: drag disabled. Switch to Yield view to reposition bonds.'
          : `Drag points on the chart to move bonds. Stats update automatically.${horizonDays > 0 ? ' Hollow markers show rolled positions. Hover for P&L breakdown.' : ''}`
        }
      </p>
    </div>
  );
}
