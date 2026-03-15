import { useState, useCallback, useEffect } from 'react';
import { getTreasuryCurve, setTreasuryCurve, refreshTreasuryCurve } from '../api/client';
import type { TreasuryCurvePoint, TreasuryCurve } from '../types/models';

const DEFAULT_POINTS: TreasuryCurvePoint[] = [
  { tenor: 0.25, yield_rate: 0.0435 },
  { tenor: 0.5,  yield_rate: 0.044  },
  { tenor: 1,    yield_rate: 0.0445 },
  { tenor: 2,    yield_rate: 0.042  },
  { tenor: 3,    yield_rate: 0.041  },
  { tenor: 5,    yield_rate: 0.04   },
  { tenor: 7,    yield_rate: 0.041  },
  { tenor: 10,   yield_rate: 0.042  },
  { tenor: 20,   yield_rate: 0.045  },
  { tenor: 30,   yield_rate: 0.046  },
];

export interface UseTreasuryResult {
  points: TreasuryCurvePoint[];
  isSaving: boolean;
  isRefreshing: boolean;
  error: string | null;
  save: (points: TreasuryCurvePoint[]) => Promise<boolean>;
  refreshFromLive: () => Promise<void>;
}

export function useTreasury(): UseTreasuryResult {
  const [points, setPoints] = useState<TreasuryCurvePoint[]>(DEFAULT_POINTS);
  const [isSaving, setSaving] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTreasuryCurve()
      .then(curve => { if (curve?.points.length) setPoints(curve.points); })
      .catch(() => {}); // keep defaults on error
  }, []);

  const save = useCallback(async (pts: TreasuryCurvePoint[]): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const curve: TreasuryCurve = {
        as_of_date: new Date().toISOString().split('T')[0],
        points: [...pts].sort((a, b) => a.tenor - b.tenor),
      };
      await setTreasuryCurve(curve);
      setPoints(curve.points);
      return true;
    } catch {
      setError('Failed to save treasury curve');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const refreshFromLive = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const curve = await refreshTreasuryCurve();
      setPoints(curve.points);
    } catch {
      setError('Failed to refresh live data');
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { points, isSaving, isRefreshing, error, save, refreshFromLive };
}
