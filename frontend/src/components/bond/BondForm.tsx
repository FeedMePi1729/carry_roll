import { useState } from 'react';
import type { BondInput, DayCountConvention } from '../../types/models';
import { createBond } from '../../api/client';
import type { BondWithAnalytics } from '../../types/models';

const today = () => new Date().toISOString().split('T')[0];
const twoYearsLater = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().split('T')[0];
};

interface Props {
  onBondCreated: (bwa: BondWithAnalytics) => void;
}

interface PctDisplay {
  coupon: string;
  ytm: string;
  repo_rate: string;
  recovery_rate: string;
}

export default function BondForm({ onBondCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<BondInput>({
    name: '',
    ticker: '',
    coupon: 0.05,
    face_value: 100,
    settlement_date: today(),
    maturity_date: twoYearsLater(),
    day_count: 'ACT/365',
    frequency: 2,
    ytm: 0.045,
    repo_rate: 0.03,
    recovery_rate: 0.4,
  });
  const [pct, setPct] = useState<PctDisplay>({
    coupon: (0.05 * 100).toFixed(2),
    ytm: (0.045 * 100).toFixed(2),
    repo_rate: (0.03 * 100).toFixed(2),
    recovery_rate: (0.4 * 100).toFixed(0),
  });

  const set = (field: keyof BondInput, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const updatePct = (field: keyof PctDisplay, raw: string) => {
    setPct(p => ({ ...p, [field]: raw }));
    set(field as keyof BondInput, (parseFloat(raw) || 0) / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createBond(form);
      onBondCreated(result);
      setForm(f => ({ ...f, name: '' }));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create bond');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500";
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold mb-3">Create Bond</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Name</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="e.g. UST 5Y" />
        </div>
        <div>
          <label className={labelCls}>Ticker</label>
          <input type="text" value={form.ticker || ''} onChange={e => set('ticker', e.target.value)} className={inputCls} placeholder="e.g. AAPL" />
        </div>
        <div>
          <label className={labelCls}>Coupon (%)</label>
          <input type="text" inputMode="decimal" value={pct.coupon} onChange={e => updatePct('coupon', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Face Value</label>
          <input type="number" step="1" value={form.face_value} onChange={e => set('face_value', parseFloat(e.target.value) || 100)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Settlement Date</label>
          <input type="date" value={form.settlement_date} onChange={e => set('settlement_date', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Maturity Date</label>
          <input type="date" value={form.maturity_date} onChange={e => set('maturity_date', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>YTM (%)</label>
          <input type="text" inputMode="decimal" value={pct.ytm} onChange={e => updatePct('ytm', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Repo Rate (%)</label>
          <input type="text" inputMode="decimal" value={pct.repo_rate} onChange={e => updatePct('repo_rate', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Day Count</label>
          <select value={form.day_count} onChange={e => set('day_count', e.target.value as DayCountConvention)} className={inputCls}>
            <option value="ACT/365">ACT/365</option>
            <option value="ACT/360">ACT/360</option>
            <option value="30/360">30/360</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Frequency</label>
          <select value={form.frequency} onChange={e => set('frequency', parseInt(e.target.value))} className={inputCls}>
            <option value={1}>Annual</option>
            <option value={2}>Semi-Annual</option>
            <option value={4}>Quarterly</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Recovery Rate (%)</label>
          <input type="text" inputMode="decimal" value={pct.recovery_rate} onChange={e => updatePct('recovery_rate', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Market Price (opt)</label>
          <input type="number" step="0.01" value={form.market_price ?? ''} onChange={e => set('market_price', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} placeholder="Auto from YTM" />
        </div>
      </div>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Computing...' : 'Create Bond'}
      </button>
    </form>
  );
}
