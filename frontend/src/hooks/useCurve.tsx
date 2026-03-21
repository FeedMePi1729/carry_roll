import { useState, useCallback, useEffect } from 'react';
import { getCurveAnalytics } from '../api/client';
import type { CurveAnalytics } from '../types/models';

interface UseCurveResult {
  data: CurveAnalytics | null;
  isLoading: boolean;
  error: string | null;
  updateCurve: (data: CurveAnalytics) => void;
  refresh: () => void;
}

export function useCurve(ticker: string, horizonDays = 0): UseCurveResult {
  const [data, setData] = useState<CurveAnalytics | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!ticker) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCurveAnalytics(ticker, horizonDays)
      .then(d  => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setError('Failed to load curve'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [ticker, horizonDays, refreshTick]);

  const updateCurve = useCallback((updated: CurveAnalytics) => setData(updated), []);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  return { data, isLoading, error, updateCurve, refresh };
}
