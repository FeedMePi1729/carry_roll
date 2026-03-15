interface StatCardProps {
  label: string;
  value: string;
  className?: string;
}

export function StatCard({ label, value, className = '' }: StatCardProps) {
  return (
    <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 ${className}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-mono font-medium">{value}</div>
    </div>
  );
}
