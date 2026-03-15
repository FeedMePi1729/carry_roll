// @ts-ignore
import reactPlotly from 'react-plotly.js';

const Plot = reactPlotly.default ?? reactPlotly;

export default function PlotInner(props: any) {
  return <Plot {...props} />;
}
