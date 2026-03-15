interface ChartSkeletonProps {
  height?: number;
}

export function ChartSkeleton({ height = 200 }: ChartSkeletonProps) {
  return (
    <div
      style={{ height }}
      className="w-full rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
      aria-hidden="true"
    />
  );
}
