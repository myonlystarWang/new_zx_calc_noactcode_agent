import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomePage } from './components/home/HomePage';
import { AttributePanel } from './components/business/AttributePanel';
import { BuffPanel } from './components/business/BuffPanel';
import { ResultSection } from './components/business/ResultsSection';
import { SimulationArena } from './components/arena/SimulationArena';
import { CompendiumView } from './components/compendium/CompendiumView';
import type { SearchTarget } from './components/GlobalSearch';

type AppTab = 'home' | 'calculator' | 'arena' | 'compendium';

const MainContent: React.FC = () => {
  const { isLoading, userCharacter, updateCharacterAttributes, updateCharacterClass } = useApp();
  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    const saved = localStorage.getItem('zx_active_tab') as AppTab;
    if (saved && ['home', 'calculator', 'arena', 'compendium'].includes(saved)) {
      return saved;
    }
    return 'home';
  });

  const setActiveTab = (tab: AppTab) => {
    setActiveTabState(tab);
    localStorage.setItem('zx_active_tab', tab);
  };

  const [searchNav, setSearchNav] = useState<SearchTarget | null>(null);
  const handleSearchNav = (t: SearchTarget) => {
    if (t.tab === 'calculator' && t.classId && t.faction) {
      updateCharacterClass(t.classId, t.faction as any);
    }
    if ((t as any).tab === 'skills') {
      setActiveTab('compendium');
      setSearchNav({ tab: 'compendium', sub: 'skills', ...(t as any) });
      return;
    }
    setActiveTab(t.tab as AppTab);
    setSearchNav(t);
  };

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
      className={`bg-slate-950 zx-ink-bg transition-all duration-1000 overflow-x-hidden flex flex-col ${
        activeTab === 'arena' ? 'h-screen overflow-hidden pb-0' : 'min-h-screen'
      }`}
      data-theme={activeTab === 'calculator' ? userCharacter.Faction : undefined}
    >
      <Header activeTab={activeTab} onTabChange={setActiveTab} onSearchNavigate={handleSearchNav} />

      {activeTab === 'home' ? (
        <main className="w-full flex-1">
          <HomePage onNavigateTab={setActiveTab} onSearchNavigate={handleSearchNav} />
        </main>
      ) : activeTab === 'calculator' ? (
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
            <BuffPanel onNavigateToFocus={() => handleSearchNav({ tab: 'compendium', sub: 'support', item: '专注值参考' })} />
          </div>

          {/* Right Column: Results */}
          <div className="xl:col-span-4">
            <div className="xl:sticky xl:top-24">
              <ResultSection searchNav={searchNav} onSearchConsumed={() => setSearchNav(null)} />
            </div>
          </div>
        </main>
      ) : activeTab === 'arena' ? (
        <main className="w-full max-w-none mx-auto px-3 xl:px-4 animate-in fade-in duration-300">
          <SimulationArena />
        </main>
      ) : (
        <main className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 animate-in fade-in duration-300">
          <CompendiumView
            searchNav={searchNav}
            onSearchConsumed={() => setSearchNav(null)}
            onNavigateCalculator={(dungeonId, monsterId) =>
              handleSearchNav({ tab: 'calculator', dungeonId, monsterId })
            }
          />
        </main>
      )}

      {activeTab !== 'arena' && <Footer activeTab={activeTab} />}
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
