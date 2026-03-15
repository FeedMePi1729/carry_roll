export const chartColors = {
  accent: '#6366f1',
  muted:  '#94a3b8',
  danger: '#ef4444',
} as const;

export function chartTheme(isDark: boolean) {
  return {
    gridcolor:  isDark ? '#374151' : '#e5e7eb',
    fontColor:  isDark ? '#d1d5db' : '#374151',
    bgColor:    'rgba(0,0,0,0)',
  };
}
