import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AttributePanel } from './components/business/AttributePanel';
import { BuffPanel } from './components/business/BuffPanel';
import { ResultSection } from './components/business/ResultsSection';
import { SimulationArena } from './components/arena/SimulationArena';

const MainContent: React.FC = () => {
  const { isLoading, userCharacter, updateCharacterAttributes } = useApp();
  const [activeTab, setActiveTab] = useState<'calculator' | 'arena'>('calculator');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-cyan-500 font-medium">加载游戏数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-950 zx-ink-bg transition-all duration-1000 overflow-x-hidden ${
        activeTab === 'arena' ? 'h-screen overflow-hidden pb-0' : 'min-h-screen pb-4'
      }`}
      data-theme={activeTab === 'calculator' ? userCharacter.Faction : undefined}
    >
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'calculator' ? (
        <main className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in duration-300">
          {/* Left Column: Attribute Inputs */}
          <div className="xl:col-span-4">
            <AttributePanel
              attributes={userCharacter.BaseAttributes}
              onChange={updateCharacterAttributes}
            />
          </div>

          {/* Middle Column: Buff Selector & Radar */}
          <div className="xl:col-span-4">
            <BuffPanel />
          </div>

          {/* Right Column: Results */}
          <div className="xl:col-span-4">
            <div className="xl:sticky xl:top-24">
              <ResultSection />
            </div>
          </div>
        </main>
      ) : (
        <main className="w-full max-w-none mx-auto px-3 xl:px-4 animate-in fade-in duration-300">
          <SimulationArena />
        </main>
      )}

      {activeTab === 'calculator' && <Footer />}
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
