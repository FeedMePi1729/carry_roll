import { useState, useCallback, useEffect } from 'react';
import { getBonds, deleteBond } from '../api/client';
import type { BondWithAnalytics } from '../types/models';

interface UseBondsResult {
  bonds: BondWithAnalytics[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addBond: (bwa: BondWithAnalytics) => void;
  removeBond: (id: string) => void;
}

export function useBonds(): UseBondsResult {
  const [bonds, setBonds] = useState<BondWithAnalytics[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBonds(await getBonds());
    } catch {
      setError('Failed to load bonds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addBond = useCallback((bwa: BondWithAnalytics) => {
    setBonds(prev => [...prev, bwa]);
  }, []);

  const removeBond = useCallback(async (id: string) => {
    setBonds(prev => prev.filter(b => b.bond.id !== id));
    try {
      await deleteBond(id);
    } catch {
      refresh(); // revert on failure
    }
  }, [refresh]);

  return { bonds, isLoading, error, refresh, addBond, removeBond };
}
