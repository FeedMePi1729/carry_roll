import { useState, useCallback } from 'react';
import Header from './components/layout/Header';
import TabContainer from './components/layout/TabContainer';
import TreasuryCurveEditor from './components/treasury/TreasuryCurveEditor';
import BondForm from './components/bond/BondForm';
import BondList from './components/bond/BondList';
import BondResults from './components/bond/BondResults';
import PortfolioBuilder from './components/portfolio/PortfolioBuilder';
import PortfolioResults from './components/portfolio/PortfolioResults';
import CurveSelector from './components/curve/CurveSelector';
import CurveChart from './components/curve/CurveChart';
import CurveStats from './components/curve/CurveStats';
import DecompositionDocs from './components/docs/DecompositionDocs';
import { useBonds } from './hooks/useBonds';
import { useTreasury } from './hooks/useTreasury';
import { useCurve } from './hooks/useCurve';
import { deletePortfolio as deletePortfolioApi } from './api/client';
import type { BondWithAnalytics, PortfolioAnalytics } from './types/models';

const HORIZON_OPTIONS = [
  { label: 'None', days: 0 },
  { label: '1d',   days: 1 },
  { label: '7d',   days: 7 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
  { label: '180d', days: 180 },
  { label: '1y',   days: 365 },
];

export default function App() {
  const { bonds, error: bondsError, addBond, removeBond, refresh: refreshBonds } = useBonds();
  const treasury = useTreasury();
  const [selectedBondId, setSelectedBondId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioAnalytics[]>([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [horizonDays, setHorizonDays] = useState(0);
  const { data: curveData, updateCurve, refresh: refreshCurve } = useCurve(selectedTicker, horizonDays);

  const handleTreasuryCurveUpdated = useCallback(() => {
    refreshBonds();
    if (selectedTicker) refreshCurve();
  }, [refreshBonds, refreshCurve, selectedTicker]);

  const handleBondCreated = (bwa: BondWithAnalytics) => {
    addBond(bwa);
    setSelectedBondId(bwa.bond.id!);
  };

  const handleDeletePortfolio = async (id: string) => {
    try {
      await deletePortfolioApi(id);
      setPortfolios(prev => prev.filter(p => p.portfolio_id !== id));
    } catch {}
  };

  const selectedBond = bonds.find(b => b.bond.id === selectedBondId);

  const bondPortfolioTab = (
    <div className="space-y-4">
      {bondsError && <p className="text-red-500 text-sm">{bondsError}</p>}
      <BondForm onBondCreated={handleBondCreated} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BondList
          bonds={bonds}
          selectedId={selectedBondId}
          onSelect={setSelectedBondId}
          onDelete={removeBond}
        />
        {selectedBond && <BondResults data={selectedBond} />}
      </div>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PortfolioBuilder bonds={bonds} onPortfolioCreated={p => setPortfolios(prev => [...prev, p])} />
        <div className="space-y-3">
          {portfolios.map(p => (
            <PortfolioResults key={p.portfolio_id} portfolio={p} onDelete={handleDeletePortfolio} />
          ))}
        </div>
      </div>
    </div>
  );

  const methodologyTab = (
    <DecompositionDocs />
  );

  const curveTab = (
    <div className="space-y-4">
      <CurveSelector selected={selectedTicker} onSelect={setSelectedTicker} />

      {/* Horizon selector */}
      {selectedTicker && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Roll horizon:</span>
          {HORIZON_OPTIONS.map(opt => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setHorizonDays(opt.days)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                horizonDays === opt.days
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {curveData && (
        <>
          <CurveChart
            data={curveData}
            treasuryPoints={treasury.points}
            horizonDays={horizonDays}
            onUpdated={updateCurve}
          />
          <CurveStats data={curveData} horizonDays={horizonDays} />
        </>
      )}
      {selectedTicker && !curveData && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No bonds found for ticker "{selectedTicker}". Create bonds with this ticker first.
        </p>
      )}
      {!selectedTicker && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a ticker to view its yield curve. Bonds must share the same ticker to appear on a curve.
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-4">
        <TreasuryCurveEditor
          points={treasury.points}
          isSaving={treasury.isSaving}
          isRefreshing={treasury.isRefreshing}
          onSave={treasury.save}
          onRefreshFromLive={treasury.refreshFromLive}
          onCurveUpdated={handleTreasuryCurveUpdated}
        />
        <TabContainer
          tabs={[
            { label: 'Bond / Portfolio', content: bondPortfolioTab },
            { label: 'Curves', content: curveTab },
            { label: 'Methodology', content: methodologyTab },
          ]}
        />
      </div>
    </div>
  );
}
