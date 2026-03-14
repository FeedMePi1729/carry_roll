declare module 'react-plotly.js/factory' {
  import { Component } from 'react';

  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    className?: string;
    onRelayout?: (event: any) => void;
    onRestyle?: (event: any) => void;
    onClick?: (event: any) => void;
    onHover?: (event: any) => void;
    [key: string]: any;
  }

  function createPlotlyComponent(plotly: any): new (props: PlotParams) => Component<PlotParams>;
  export default createPlotlyComponent;
}

declare module 'plotly.js/dist/plotly' {
  const Plotly: any;
  export default Plotly;
}
