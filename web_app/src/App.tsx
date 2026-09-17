import React, { useEffect, useRef, useState } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomePage } from './components/home/HomePage';
import { AttributePanel } from './components/business/AttributePanel';
import { BuffPanel } from './components/business/BuffPanel';
import { ResultSection } from './components/business/ResultsSection';
import { SimulationArena } from './components/arena/SimulationArena';
import { CompendiumView } from './components/compendium/CompendiumView';
import { ChangelogPage } from './components/changelog/ChangelogPage';
import { decodeSharePayload } from './utils/shareSnapshot';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { SearchTarget } from './components/GlobalSearch';
import type { SubTab } from './components/compendium/CompendiumView';
import {
  ROUTE,
  buildPathFromTarget,
  compendiumSegmentToSub,
  compendiumSubFromLocation,
  isValidDungeonId,
  parseLocationToTarget,
  primaryTabFromPath,
  titleForPath,
} from './routes';

/** 资料库路由（/compendium/:seg）——非法子页段自动回落到极致属性攻略 */
/** 资料库路由透传给 CompendiumView 的全部回调。
 *  抽成命名类型并用于 compendiumRouteProps 的显式标注——否则中间层漏透传某个回调时
 *  TS 对 JSX spread 的多余属性不报错，会出现「回调静默丢失」这类难查的 bug。 */
type CompendiumRouteProps = {
  searchNav: SearchTarget | null;
  onSearchConsumed: () => void;
  onSubChange: (sub: SubTab) => void;
  onNavigateCalculator: (dungeonId: string, monsterId: string) => void;
  onBossDungeonChange: (dungeonId: string) => void;
  onSkillsFilterChange: (classId: string, faction: string) => void;
};

const CompendiumRoute: React.FC<CompendiumRouteProps> = ({
  searchNav,
  onSearchConsumed,
  onSubChange,
  onNavigateCalculator,
  onBossDungeonChange,
  onSkillsFilterChange,
}) => {
  const { seg } = useParams<{ seg: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // 规范化 URL：#/compendium（缺省子页）与非法子页段都回落到 #/compendium/ceiling
  if (!seg || compendiumSegmentToSub(seg) === undefined) {
    return <Navigate to={ROUTE.ceiling} replace />;
  }

  return (
    <main className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 pt-4 pb-8 animate-in fade-in duration-300">
      <CompendiumView
        sub={compendiumSubFromLocation(location.pathname, searchParams)}
        onSubChange={onSubChange}
        searchNav={searchNav}
        onSearchConsumed={onSearchConsumed}
        onNavigateCalculator={onNavigateCalculator}
        onBossDungeonChange={onBossDungeonChange}
        onSkillsFilterChange={onSkillsFilterChange}
      />
    </main>
  );
};

const MainContent: React.FC = () => {
  const { isLoading, loadError, userCharacter, activeBuffIds, updateCharacterAttributes, updateCharacterClass, restoreBuffState } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = primaryTabFromPath(location.pathname);

  // URL 是导航状态的唯一来源：刷新 / 直达链接 / 前进后退 均可复现定位
  const [searchNav, setSearchNav] = useState<SearchTarget | null>(null);

  // AppContext 中的函数未 memo，放进依赖会导致 effect 每次渲染重跑，故用 ref 持有
  const updateCharacterClassRef = useRef(updateCharacterClass);
  updateCharacterClassRef.current = updateCharacterClass;
  const updateCharacterAttributesRef = useRef(updateCharacterAttributes);
  updateCharacterAttributesRef.current = updateCharacterAttributes;
  const restoreBuffStateRef = useRef(restoreBuffState);
  restoreBuffStateRef.current = restoreBuffState;
  // effect 依赖里没有 activeBuffIds，用 ref 拿最新值（只带 bv 的链接需要保留当前勾选集）
  const activeBuffIdsRef = useRef(activeBuffIds);
  activeBuffIdsRef.current = activeBuffIds;

  // 分享链接（?p=）只应用一次：同一 payload 重复进入不覆盖用户后续手动改动
  const appliedShareRef = useRef<string | null>(null);

  // 分享链接恢复结果的提示。此前解析失败是静默的：只有职业/阵营/副本落地，
  // 属性与增益原封不动，用户会以为「分享链接没带配置」，实际是配置串损坏了。
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    // 数据未就绪时不做解析：resolveSkill / isValidDungeonId 依赖 DataService 已加载，
    // 否则会把合法的 ?skill=/?d= 误判为非法。
    if (isLoading) return;

    const params = new URLSearchParams(location.search);

    // 非法 ?d=（手改 URL、副本改名）→ 剔除参数并规范化地址栏，避免筛成空列表 / 地址栏与列表不一致
    const rawDungeonId = params.get('d');
    if (rawDungeonId && !isValidDungeonId(rawDungeonId)) {
      params.delete('d');
      params.delete('m');
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
      return;
    }

    const target = parseLocationToTarget(location.pathname, params);
    if (!target) {
      setSearchNav(null);
      return;
    }
    // 直达链接 / 刷新时也要把 URL 里的职业阵营落到角色数据上
    if (target.tab === 'calculator' && target.classId && target.faction) {
      updateCharacterClassRef.current(target.classId, target.faction as 'XIAN' | 'FO' | 'MO');
    }

    // 分享链接恢复（Step 10）：属性与增益复用同一条 URL→state 通道，不新增 restore 组件。
    // 幂等：同一 ?p= 只应用一次，避免 effect 重跑覆盖用户后续手动改动。
    const sharePayload = params.get('p');
    if (!sharePayload) setShareNotice(null);
    if (sharePayload && target.tab === 'calculator' && appliedShareRef.current !== sharePayload) {
      appliedShareRef.current = sharePayload;
      void (async () => {
        const decoded = await decodeSharePayload(sharePayload);
        if (!decoded) {
          setShareNotice(
            '这条分享链接的配置串已损坏（复制时被截断、或被聊天工具二次转义），' +
            '角色属性与战斗增益未能恢复——当前显示的仍是你本地的配置。请让对方重新复制一次完整链接。'
          );
          return;
        }
        if (decoded.attributes) updateCharacterAttributesRef.current(decoded.attributes);
        // 链接只带 bv（改了增益数值但没动勾选集）时 activeBuffIds 为 null：
        // 沿用当前勾选集，否则 buffValues 会被整块丢弃（Step 10 遗漏分支）
        if (decoded.activeBuffIds || decoded.buffValues) {
          restoreBuffStateRef.current(
            decoded.activeBuffIds || activeBuffIdsRef.current,
            decoded.buffValues || {}
          );
        }
        setShareNotice(
          decoded.buffsSkipped
            ? '角色属性已按分享链接恢复；但战斗增益未能还原（增益映射校验未通过），已沿用你本地的增益设置。'
            : null
        );
      })();
    }

    setSearchNav(target);
  }, [isLoading, location.pathname, location.search]);

  // 页面身份变化（路径切换）后回到顶部；页面内 query 变化（如资料库二级分类、副本筛选）不重置
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // 浏览器标签页 / 收藏夹标题
  useEffect(() => {
    document.title = titleForPath(location.pathname);
  }, [location.pathname]);

  // 站内搜索跳转：统一折算为 URL；URL 完全一致时补发一次定位意图
  const handleSearchNav = (t: SearchTarget) => {
    const path = buildPathFromTarget(t);
    if (path === `${location.pathname}${location.search}`) {
      setSearchNav({ ...t });
      return;
    }
    navigate(path);
  };

  const compendiumRouteProps: CompendiumRouteProps = {
    searchNav,
    onSearchConsumed: () => setSearchNav(null),
    onSubChange: (sub: SubTab) => navigate(buildPathFromTarget({ tab: 'compendium', sub })),
    onNavigateCalculator: (dungeonId: string, monsterId: string) =>
      navigate(buildPathFromTarget({ tab: 'calculator', dungeonId, monsterId })),
    // 副本选择回写 URL（Step 8 验收：选择副本后地址栏有变化）；选「全部」时清空 ?d= 与 ?m=
    onBossDungeonChange: (dungeonId: string) =>
      navigate(
        buildPathFromTarget({
          tab: 'compendium',
          sub: 'boss',
          dungeonId: dungeonId === 'all' ? undefined : dungeonId,
        }),
        { replace: true },
      ),
    // 技能速查内切换门派/阵营 → 回写 URL（同样用 replace）。
    // 一并写入当前阵营，保证 URL 回灌时状态幂等（切门派不会把阵营重置成 ALL）；
    // 阵营为 ALL 时省略该参数（toFaction 只认 XIAN/FO/MO），回灌后仍默认 ALL。
    onSkillsFilterChange: (classId: string, faction: string) =>
      navigate(
        buildPathFromTarget({
          tab: 'compendium',
          sub: 'skills',
          classId,
          faction: faction === 'ALL' ? undefined : faction,
        }),
        { replace: true },
      ),
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
      {loadError && (
        <div className="w-full bg-red-950/60 border-b border-red-500/40 px-4 py-2 text-sm text-red-200 flex items-center gap-2">
          <span aria-hidden>⚠️</span>
          <span className="flex-1">{loadError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 text-xs"
          >
            重试
          </button>
        </div>
      )}
      {shareNotice && (
        <div className="w-full bg-amber-950/60 border-b border-amber-500/40 px-4 py-2 text-sm text-amber-100 flex items-center gap-2">
          <span aria-hidden>⚠️</span>
          <span className="flex-1">{shareNotice}</span>
          <button
            type="button"
            onClick={() => setShareNotice(null)}
            className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100 text-xs"
          >
            知道了
          </button>
        </div>
      )}
      <Header />

      <Routes>
        <Route
          path={ROUTE.home}
          element={
            <main className="w-full flex-1 flex flex-col justify-center">
              <HomePage onSearchNavigate={handleSearchNav} />
            </main>
          }
        />

        <Route
          path={ROUTE.calculator}
          element={
            <main className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 pt-2 pb-2 grid grid-cols-1 xl:grid-cols-12 gap-4 xl:gap-5 animate-in fade-in duration-300">
              {/* 左栏：属性录入 */}
              <div className="xl:col-span-4 flex flex-col">
                <AttributePanel
                  attributes={userCharacter.BaseAttributes}
                  onChange={updateCharacterAttributes}
                />
              </div>

              {/* 中栏：增益勾选与雷达图 */}
              <div className="xl:col-span-4 flex flex-col">
                <BuffPanel
                  onNavigateToFocus={() =>
                    handleSearchNav({ tab: 'compendium', sub: 'support', item: '专注值参考' })
                  }
                />
              </div>

              {/* 右栏：测算结果 */}
              <div className="xl:col-span-4 flex flex-col">
                <div className="xl:sticky xl:top-20 flex-1">
                  <ResultSection searchNav={searchNav} onSearchConsumed={() => setSearchNav(null)} />
                </div>
              </div>
            </main>
          }
        />

        <Route
          path={ROUTE.arena}
          element={
            <main className="w-full flex-1 min-h-0 max-w-none mx-auto px-3 xl:px-4 animate-in fade-in duration-300 flex flex-col overflow-hidden">
              <SimulationArena />
            </main>
          }
        />

        <Route path={ROUTE.compendium} element={<CompendiumRoute {...compendiumRouteProps} />} />
        <Route path={`${ROUTE.compendium}/:seg`} element={<CompendiumRoute {...compendiumRouteProps} />} />

        <Route
          path={ROUTE.changelog}
          element={
            <main className="w-full flex-1">
              <ChangelogPage />
            </main>
          }
        />

        <Route path="*" element={<Navigate to={ROUTE.home} replace />} />
      </Routes>

      {activeTab !== 'arena' && <Footer activeTab={activeTab} />}
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppProvider>
          <MainContent />
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
