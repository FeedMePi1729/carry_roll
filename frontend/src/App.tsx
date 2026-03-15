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
import { useBonds } from './hooks/useBonds';
import { useTreasury } from './hooks/useTreasury';
import { useCurve } from './hooks/useCurve';
import { deletePortfolio as deletePortfolioApi } from './api/client';
import type { BondWithAnalytics, PortfolioAnalytics } from './types/models';

export default function App() {
  const { bonds, error: bondsError, addBond, removeBond, refresh: refreshBonds } = useBonds();
  const treasury = useTreasury();
  const [selectedBondId, setSelectedBondId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioAnalytics[]>([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const { data: curveData, updateCurve, refresh: refreshCurve } = useCurve(selectedTicker);

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

  const curveTab = (
    <div className="space-y-4">
      <CurveSelector selected={selectedTicker} onSelect={setSelectedTicker} />
      {curveData && (
        <>
          <CurveChart data={curveData} treasuryPoints={treasury.points} onUpdated={updateCurve} />
          <CurveStats data={curveData} />
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
          ]}
        />
      </div>
    </div>
  );
}
