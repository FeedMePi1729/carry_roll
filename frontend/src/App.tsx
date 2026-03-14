import { useState, useCallback, useEffect } from 'react';
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
import type { BondWithAnalytics, PortfolioAnalytics, CurveAnalytics, TreasuryCurvePoint } from './types/models';
import { getBonds, deleteBond as deleteBondApi, deletePortfolio as deletePortfolioApi, getCurveAnalytics, getTreasuryCurve } from './api/client';

export default function App() {
  const [bonds, setBonds] = useState<BondWithAnalytics[]>([]);
  const [selectedBondId, setSelectedBondId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioAnalytics[]>([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [curveData, setCurveData] = useState<CurveAnalytics | null>(null);
  const [treasuryPoints, setTreasuryPoints] = useState<TreasuryCurvePoint[]>([]);

  const refreshBonds = useCallback(async () => {
    try {
      const data = await getBonds();
      setBonds(data);
    } catch {}
  }, []);

  const refreshTreasury = useCallback(async () => {
    try {
      const curve = await getTreasuryCurve();
      if (curve) setTreasuryPoints(curve.points);
    } catch {}
  }, []);

  useEffect(() => { refreshBonds(); refreshTreasury(); }, [refreshBonds, refreshTreasury]);

  const handleBondCreated = (bwa: BondWithAnalytics) => {
    setBonds(prev => [...prev, bwa]);
    setSelectedBondId(bwa.bond.id!);
  };

  const handleDeleteBond = async (id: string) => {
    try {
      await deleteBondApi(id);
      setBonds(prev => prev.filter(b => b.bond.id !== id));
      if (selectedBondId === id) setSelectedBondId(null);
    } catch {}
  };

  const handlePortfolioCreated = (p: PortfolioAnalytics) => {
    setPortfolios(prev => [...prev, p]);
  };

  const handleDeletePortfolio = async (id: string) => {
    try {
      await deletePortfolioApi(id);
      setPortfolios(prev => prev.filter(p => p.portfolio_id !== id));
    } catch {}
  };

  const handleCurveUpdated = (data: CurveAnalytics) => {
    setCurveData(data);
  };

  useEffect(() => {
    if (selectedTicker) {
      getCurveAnalytics(selectedTicker).then(setCurveData).catch(() => setCurveData(null));
    } else {
      setCurveData(null);
    }
  }, [selectedTicker]);

  const handleTreasuryCurveUpdated = () => {
    refreshBonds();
    refreshTreasury();
    if (selectedTicker) {
      getCurveAnalytics(selectedTicker).then(setCurveData).catch(() => {});
    }
  };

  const selectedBond = bonds.find(b => b.bond.id === selectedBondId);

  const bondPortfolioTab = (
    <div className="space-y-4">
      <BondForm onBondCreated={handleBondCreated} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BondList
          bonds={bonds}
          selectedId={selectedBondId}
          onSelect={setSelectedBondId}
          onDelete={handleDeleteBond}
        />
        {selectedBond && <BondResults data={selectedBond} />}
      </div>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PortfolioBuilder bonds={bonds} onPortfolioCreated={handlePortfolioCreated} />
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
          <CurveChart
            data={curveData}
            treasuryPoints={treasuryPoints}
            onUpdated={handleCurveUpdated}
          />
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
        <TreasuryCurveEditor onCurveUpdated={handleTreasuryCurveUpdated} />
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
