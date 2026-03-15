import { lazy, Suspense } from 'react';
import { ChartSkeleton } from '../ui/ChartSkeleton';

const PlotInner = lazy(() => import('./PlotInner'));

export interface PlotParams {
  data: any[];
  layout?: { height?: number; [key: string]: any };
  config?: Record<string, any>;
  style?: React.CSSProperties;
  onRelayout?: (event: any) => void;
  onRestyle?: (event: any) => void;
  [key: string]: any;
}

export function LazyPlot({ layout, ...props }: PlotParams) {
  return (
    <Suspense fallback={<ChartSkeleton height={layout?.height ?? 200} />}>
      <PlotInner layout={layout} {...props} />
    </Suspense>
  );
}
