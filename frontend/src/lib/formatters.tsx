export function fmt(v: number | null | undefined, decimals = 4): string {
  if (v == null) return 'N/A';
  return v.toFixed(decimals);
}

export function fmtPct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}
