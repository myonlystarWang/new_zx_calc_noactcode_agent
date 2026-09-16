import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { SearchTarget } from '../GlobalSearch';
import { Sparkles, Calculator, Swords, Zap, Crosshair, Award } from 'lucide-react';
import { buildSearchIndex, buildSearchStats, matchGrouped } from '../search/searchIndex';
import type { CompiledSearchItem } from '../search/searchIndex';

const HOT_SEARCH_TAGS = [
  '苍龙啸',    // 技能汉字
  '未名斩',    // 技能汉字
  '秋声雅韵',  // 技能汉字
  '流波惊变',  // 副本名字
  '天帝宝库',  // 副本名字
  '赤梭',      // Boss 名字
  '玄铠',      // Boss 名字
  '极致无视',  // 攻略名字
  '专注值参考',// 攻略名字
  '易伤',      // 攻略/增益名字
];
const HOT = HOT_SEARCH_TAGS;
const RECENT_KEY = 'zx_home_recent_searches';

const PH = [
  '搜索 Boss / 技能 / 增益 / 攻略，如 苍龙啸',
  '输入拼音首字母，如 th → 天华、clx → 苍龙啸',
  '搜索怪物首领，如 赤梭',
  '输入战斗增益，如 易伤、专注值参考',
];

interface HomePageProps {
  onNavigateTab: (tab: 'calculator' | 'arena' | 'compendium') => void;
  onSearchNavigate: (target: SearchTarget) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateTab, onSearchNavigate }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placeholder, setPlaceholder] = useState(PH[0]);
  const [recentList, setRecentList] = useState<CompiledSearchItem[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  // 读取本地存储中的最近访问
  const loadRecent = (): CompiledSearchItem[] => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return (Array.isArray(raw) ? raw : []).map((x: any) =>
        x.label
          ? x
          : { label: x.l, group: x.g, category: x.c, keywords: x.k || [], target: x.t, pyInitials: x.i || '', pyFull: x.f || '' },
      );
    } catch {
      return [];
    }
  };

  useEffect(() => {
    setRecentList(loadRecent());
  }, []);

  const saveRecent = (entry: CompiledSearchItem) => {
    const list = loadRecent().filter((x) => x.label !== entry.label);
    list.unshift(entry);
    const updated = list.slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    setRecentList(updated);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentList([]);
  };

  // 搜索索引与统计：统一来自共享搜索层（与右上角 GlobalSearch 同源，改一处即两处生效）
  const searchIndex = useMemo(() => buildSearchIndex(), []);
  const stats = useMemo(() => buildSearchStats(searchIndex), [searchIndex]);

  // 匹配与多分类聚合：统一来自共享搜索层
  const groupedResults = useMemo(() => matchGrouped(searchIndex, query), [searchIndex, query]);

  // 动态出字打字机动画
  useEffect(() => {
    let wordIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timeoutId = 0;

    function step() {
      if (isFocusedRef.current) {
        timeoutId = window.setTimeout(step, 250);
        return;
      }

      const w = PH[wordIdx];
      if (!deleting) {
        charIdx++;
        setPlaceholder(w.slice(0, charIdx));
        if (charIdx === w.length) {
          deleting = true;
          timeoutId = window.setTimeout(step, 1800);
          return;
        }
        timeoutId = window.setTimeout(step, 110);
      } else {
        charIdx--;
        setPlaceholder(w.slice(0, charIdx));
        if (charIdx === 0) {
          wordIdx = (wordIdx + 1) % PH.length;
          deleting = false;
          timeoutId = window.setTimeout(step, 300);
          return;
        }
        timeoutId = window.setTimeout(step, 40);
      }
    }

    timeoutId = window.setTimeout(step, 600);
    return () => clearTimeout(timeoutId);
  }, []);

  // 彗星动画逻辑：测量目标严格限定为 .search-glow（仅包裹输入框，绝不越界至热搜下方）
  useEffect(() => {
    const canvas = canvasRef.current;
    const glowEl = glowRef.current;
    if (!canvas || !glowEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const PAD = 40;
    let w = 0;
    let h = 0;
    const r = 20;
    let arc = 0;
    let P = 0;
    let dist = 0;
    let lastTime = 0;

    function resize() {
      if (!glowEl || !canvas) return;
      const rect = glowEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      arc = Math.PI * r * 0.5;
      P = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 4 * arc;

      canvas.width = (w + 2 * PAD) * dpr;
      canvas.height = (h + 2 * PAD) * dpr;
      canvas.style.width = `${w + 2 * PAD}px`;
      canvas.style.height = `${h + 2 * PAD}px`;
      canvas.style.left = `${-PAD}px`;
      canvas.style.top = `${-PAD}px`;
      ctx?.setTransform(1, 0, 0, 1, 0, 0);
      ctx?.scale(dpr, dpr);
    }

    function getPoint(dVal: number) {
      let d = ((dVal % P) + P) % P;
      const lTop = w - 2 * r;
      if (d < lTop) return { x: r + d, y: 0, isH: true };
      d -= lTop;
      if (d < arc) {
        const th = -Math.PI * 0.5 + d / r;
        return { x: w - r + r * Math.cos(th), y: r + r * Math.sin(th), isH: false };
      }
      d -= arc;
      const lR = h - 2 * r;
      if (d < lR) return { x: w, y: r + d, isH: false };
      d -= lR;
      if (d < arc) {
        const th = d / r;
        return { x: w - r + r * Math.cos(th), y: h - r + r * Math.sin(th), isH: false };
      }
      d -= arc;
      const lBot = w - 2 * r;
      if (d < lBot) return { x: w - r - d, y: h, isH: true };
      d -= lBot;
      if (d < arc) {
        const th = Math.PI * 0.5 + d / r;
        return { x: r + r * Math.cos(th), y: h - r + r * Math.sin(th), isH: false };
      }
      d -= arc;
      const lL = h - 2 * r;
      if (d < lL) return { x: 0, y: h - r - d, isH: false };
      d -= lL;
      const th = Math.PI + d / r;
      return { x: r + r * Math.cos(th), y: r + r * Math.sin(th), isH: false };
    }

    function getColor(x: number) {
      const t = Math.max(0, Math.min(1, x / (w || 1)));
      let rC: number, gC: number, bC: number;
      if (t <= 0.5) {
        const k = t / 0.5;
        rC = Math.round(34 + k * (129 - 34));
        gC = Math.round(211 + k * (140 - 211));
        bC = Math.round(238 + k * (248 - 238));
      } else {
        const k = (t - 0.5) / 0.5;
        rC = Math.round(129 + k * (192 - 129));
        gC = Math.round(140 + k * (132 - 140));
        bC = Math.round(248 + k * (252 - 248));
      }
      return { r: rC, g: gC, b: bC };
    }

    function frame(timestamp: number) {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      // 聚焦时彗星隐藏由 CSS opacity 负责，未聚焦时从容跑圈
      if (w > 0 && P > 0 && !document.hidden && !isFocusedRef.current) {
        const head = getPoint(dist);
        const u = Math.max(0, Math.min(1, head.x / w));
        const speedMult = head.isH ? 0.9 + 0.55 * Math.sin(Math.PI * u) : 0.9;
        const baseSpeed = 160;
        dist += baseSpeed * speedMult * dt;

        ctx?.clearRect(0, 0, w + 2 * PAD, h + 2 * PAD);

        const tailLen = 45 + 55 * ((speedMult - 0.9) / 0.55);
        const steps = 30;
        const stepDist = tailLen / steps;

        ctx?.save();
        ctx?.translate(PAD, PAD);
        ctx!.lineCap = 'round';

        let prevPt = getPoint(dist);
        for (let i = 1; i <= steps; i++) {
          const currPt = getPoint(dist - i * stepDist);
          const p = i / steps;
          const alpha = Math.pow(1 - p, 1.4) * 0.92;
          const col = getColor((prevPt.x + currPt.x) * 0.5);

          ctx!.shadowBlur = 12;
          ctx!.shadowColor = `rgba(${col.r}, ${col.g}, ${col.b}, ${(alpha * 0.8).toFixed(3)})`;
          ctx!.beginPath();
          ctx!.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha.toFixed(3)})`;
          ctx!.lineWidth = 1.4 + 2.4 * (1 - p);
          ctx!.moveTo(prevPt.x, prevPt.y);
          ctx!.lineTo(currPt.x, currPt.y);
          ctx!.stroke();
          prevPt = currPt;
        }

        const headCol = getColor(head.x);
        const bloomR = 32;
        const radGrad = ctx!.createRadialGradient(head.x, head.y, 0, head.x, head.y, bloomR);
        radGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radGrad.addColorStop(0.12, `rgba(${headCol.r}, ${headCol.g}, ${headCol.b}, 0.92)`);
        radGrad.addColorStop(0.35, `rgba(${headCol.r}, ${headCol.g}, ${headCol.b}, 0.55)`);
        radGrad.addColorStop(0.68, `rgba(${headCol.r}, ${headCol.g}, ${headCol.b}, 0.20)`);
        radGrad.addColorStop(1, `rgba(${headCol.r}, ${headCol.g}, ${headCol.b}, 0)`);

        ctx!.fillStyle = radGrad;
        ctx!.beginPath();
        ctx!.arc(head.x, head.y, bloomR, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.shadowBlur = 8;
        ctx!.shadowColor = '#ffffff';
        ctx!.fillStyle = '#ffffff';
        ctx!.beginPath();
        ctx!.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
        ctx!.fill();

        ctx?.restore();
      }

      animId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    animId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // 聚焦时淡出彗星画布
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.opacity = isFocused ? '0' : '1';
    }
  }, [isFocused]);

  // 快捷键 Ctrl+K 与 / 聚焦
  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        inputRef.current?.focus();
      }
      if (ev.code === 'Slash' && document.activeElement !== inputRef.current) {
        ev.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 键盘操作选择
  const handleKeyDown = (ev: React.KeyboardEvent) => {
    const flatList = groupedResults.flatList || [];
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (flatList.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatList.length);
      }
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (flatList.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
      }
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (flatList.length > 0 && flatList[activeIndex]) {
        handleChoose(flatList[activeIndex]);
      }
    } else if (ev.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  // 键盘上下选择时，自动将当前高亮项平滑滚动到可视区域中
  useEffect(() => {
    if (!bodyRef.current) return;
    if (activeIndex === 0) {
      bodyRef.current.scrollTop = 0;
      return;
    }
    const activeEl = bodyRef.current.querySelector('.row.on') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeIndex]);

  // 搜索关键字变化时重置滚动条位置和高亮项
  useEffect(() => {
    setActiveIndex(0);
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [query]);

  const handleChoose = (item: CompiledSearchItem) => {
    saveRecent(item);
    setQuery('');
    setIsFocused(false);
    inputRef.current?.blur();
    onSearchNavigate(item.target);
  };

  // 高亮搜索命中字符（支持精确词及 Token 命中）
  function renderHighlightedText(text: string, q: string) {
    if (!q) return text;
    const qLower = q.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(qLower);
    if (idx >= 0) {
      return (
        <>
          {text.slice(0, idx)}
          <mark>{text.slice(idx, idx + qLower.length)}</mark>
          {text.slice(idx + qLower.length)}
        </>
      );
    }
    const tokens = qLower.split(/[\s·\-_/\\|、]+/).filter(Boolean);
    for (const t of tokens) {
      const tIdx = text.toLowerCase().indexOf(t);
      if (tIdx >= 0) {
        return (
          <>
            {text.slice(0, tIdx)}
            <mark>{text.slice(tIdx, tIdx + t.length)}</mark>
            {text.slice(tIdx + t.length)}
          </>
        );
      }
    }
    return text;
  }

  let flatCounter = -1;

  return (
    <div className="hero">
      {/* 标头区 */}
      <div className="hero-t">
        <h2 className="rise d1">诛仙3 副本战斗实验室</h2>
        <p className="rise d2">属性计算 · 战斗模拟 · 全景资料速查 —— 输入拼音首字母或关键词，一站直达</p>
      </div>

      {/* 搜索框区（方案 A+C：搜索框 + 呼吸渐变 + 彗星跑圈 + 下拉浮层） */}
      <div className="rise d3 search-wrap">
        <div className="search-zone" id="searchZone" ref={zoneRef}>
          {/* 外框轨道层：彗星轨道绑定该元素 */}
          <div className={`search-glow ${isFocused ? 'focus' : ''}`} id="searchGlow" ref={glowRef}>
            <canvas className="comet-canvas" id="cometCanvas" ref={canvasRef} />
            <div className="search-box">
              <svg
                className="ic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                id="q"
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck="false"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setTimeout(() => {
                    if (!zoneRef.current?.contains(document.activeElement)) {
                      setIsFocused(false);
                    }
                  }, 140);
                }}
                onKeyDown={handleKeyDown}
              />
              {query && (
                <button
                  className="clear-btn show"
                  id="clearBtn"
                  title="清空搜索"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
              <span className="kbd-hint" title="支持快捷键 Ctrl+K 聚焦">
                Ctrl K
              </span>
            </div>
          </div>

          {/* 搜索下拉面板（完全对齐 index.html 视觉与交互） */}
          <div className={`panel ${isFocused ? 'open' : ''}`} id="panel">
            <div className="panel-body" id="panelBody" ref={bodyRef}>
              {!query.trim() ? (
                /* 闲置态：热门搜索 + 最近访问 */
                <>
                  <div className="empty-block">
                    <h5>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                      </svg>
                      热门搜索
                    </h5>
                    <div className="chips">
                      {HOT.map((w) => (
                        <button
                          key={w}
                          className="chip"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setQuery(w);
                            inputRef.current?.focus();
                          }}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {recentList.length > 0 && (
                    <div className="empty-block">
                      <div className="recent-row">
                        <h5 style={{ margin: 0 }}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M12 7v5l4 2" />
                          </svg>
                          最近访问
                        </h5>
                        <button className="link" id="clearRecent" onMouseDown={clearRecent}>
                          清空
                        </button>
                      </div>
                      <div className="chips" style={{ marginTop: '9px' }}>
                        {recentList.map((e) => (
                          <button
                            key={e.label}
                            className="chip"
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              handleChoose(e);
                            }}
                          >
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : groupedResults.groupedList && groupedResults.groupedList.length === 0 ? (
                /* 无结果提示 */
                <div className="no-result">
                  没有找到「{query}」，试试中文名或拼音首字母（如 clx、cs、th、ys）
                </div>
              ) : (
                /* 分类聚合搜索结果列表 */
                groupedResults.groupedList.map((grp) => (
                  <div key={grp.cat}>
                    <div className="grp-h">
                      {grp.catName}
                      <span className="tag">{grp.items.length}</span>
                    </div>
                    {grp.items.map((e) => {
                      flatCounter++;
                      const currentIdx = flatCounter;
                      const isEn = /^[a-z0-9]+$/i.test(query.trim());
                      const py = isEn && e.pyInitials ? e.pyInitials.slice(0, 8) : '';
                      const isRowActive = currentIdx === activeIndex;

                      return (
                        <div
                          key={`${e.label}-${e.group}-${currentIdx}`}
                          className={`row ${isRowActive ? 'on' : ''} cursor-pointer`}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            handleChoose(e);
                          }}
                          onMouseEnter={() => setActiveIndex(currentIdx)}
                        >
                          <span className="dot"></span>
                          <span className="main">
                            <div className="nm">{renderHighlightedText(e.label, query)}</div>
                            <div className="gp">{e.group}</div>
                          </span>
                          {py && <span className="py">{py}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* 底部按键指引 */}
            <div className="panel-foot">
              <span>
                <span className="keycap">↑</span>
                <span className="keycap">↓</span> 选择
              </span>
              <span>
                <span className="keycap">Enter</span> 直达
              </span>
              <span>
                <span className="keycap">Esc</span> 关闭
              </span>
              <span style={{ marginLeft: 'auto' }}>
                支持拼音首字母，如 <b>clx → 苍龙啸</b>
              </span>
            </div>
          </div>
        </div>

        {/* 热门搜索快捷标签 (Quick Search Pills) */}
        <div className="quick-tags rise d3">
          <span className="quick-tags-label">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>热门速搜:</span>
          </span>
          <div className="quick-tags-list">
            {HOT_SEARCH_TAGS.map((word) => (
              <button
                key={word}
                type="button"
                className="quick-tag-pill"
                onClick={() => {
                  setQuery(word);
                  setIsFocused(true);
                  inputRef.current?.focus();
                }}
                title={`点击即搜“${word}”`}
              >
                <span>{word}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5 大核心功能卡片（视觉专属色彩微光体系，层次清晰） */}
      <section className="cards">
        {/* 卡片 1: 属性战力计算器 (激光青蓝) */}
        <button className="card card-cyan rise d4 group" onClick={() => onNavigateTab('calculator')}>
          <div className="card-top">
            <div className="card-ic">
              <Calculator className="w-5 h-5 text-cyan-300" />
            </div>
          </div>
          <div className="card-mid">
            <h3>属性战力计算器</h3>
            <p>录入面板属性、勾选战斗增益，实时测算对各副本 Boss 的技能伤害与命中阈值。</p>
          </div>
          <span className="go">
            <span>进入计算器</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* 卡片 2: 副本模拟训练场 (熔火流金 / 燃橙) */}
        <button className="card card-amber rise d5 group" onClick={() => onNavigateTab('arena')}>
          <div className="card-top">
            <div className="card-ic">
              <Swords className="w-5 h-5 text-amber-300" />
            </div>
          </div>
          <div className="card-mid">
            <h3>副本模拟训练场</h3>
            <p>配置队伍与技能策略，逐秒模拟整场实战，输出伤害曲线、技能时序与详尽报表。</p>
          </div>
          <span className="go">
            <span>进入训练场</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* 卡片 3: 职业技能速查 (极光翠青) */}
        <button className="card card-emerald rise d5 group" onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'skills' })}>
          <div className="card-top">
            <div className="card-ic">
              <Zap className="w-5 h-5 text-emerald-300" />
            </div>
          </div>
          <div className="card-mid">
            <h3>职业技能速查</h3>
            <p>全门派技能充能、冷却、命中段数、伤害加成与机制说明一站式分类直达。</p>
          </div>
          <span className="go">
            <span>进入技能库</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* 卡片 4: 副本 BOSS 速查 (暗金 / 渊紫) */}
        <button className="card card-purple rise d6 group" onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'boss' })}>
          <div className="card-top">
            <div className="card-ic">
              <Crosshair className="w-5 h-5 text-purple-300" />
            </div>
          </div>
          <div className="card-mid">
            <h3>副本 BOSS 速查</h3>
            <p>16 大副本 102 位关卡首领抗性速查，包含减爆伤、防御、血量与伤害压缩比。</p>
          </div>
          <span className="go">
            <span>进入BOSS库</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* 卡片 5: 极致属性攻略 (星曜金红) */}
        <button className="card card-rose rise d6 group" onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'ceiling' })}>
          <div className="card-top">
            <div className="card-ic">
              <Award className="w-5 h-5 text-rose-300" />
            </div>
          </div>
          <div className="card-mid">
            <h3>极致属性攻略</h3>
            <p>极致无视/减免/减暴/怪增/躲闪拆解，职业状态评级与战斗增益上限基准。</p>
          </div>
          <span className="go">
            <span>查看极致攻略</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </button>
      </section>

      {/* 底部全站数据统计看板（可交互 Metric Pills，支持点击直达） */}
      <div className="metric-pills-container rise d6" id="stats">
        <div className="metric-pill-header">
          <span className="w-1.5 h-3.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)]"></span>
          <span>全景数据沉淀 · 点击快捷直达</span>
        </div>
        <div className="metric-pills-grid">
          <button
            className="metric-pill group"
            onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'boss' })}
            title="点击前往 副本 BOSS 速查"
          >
            <span className="pill-num text-cyan-300">{stats.dungeons}</span>
            <span className="pill-label">副本收录</span>
          </button>

          <button
            className="metric-pill group"
            onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'boss' })}
            title="点击前往 副本 BOSS 速查"
          >
            <span className="pill-num text-purple-300">{stats.monsters}</span>
            <span className="pill-label">Boss / 怪物</span>
          </button>

          <button
            className="metric-pill group"
            onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'skills' })}
            title="点击前往 职业技能速查"
          >
            <span className="pill-num text-emerald-300">{stats.skills}</span>
            <span className="pill-label">职业技能</span>
          </button>

          <button
            className="metric-pill group"
            onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'support' })}
            title="点击前往 职业状态一览"
          >
            <span className="pill-num text-amber-300">{stats.buffs}</span>
            <span className="pill-label">战斗增益</span>
          </button>

          <button
            className="metric-pill group"
            onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'support' })}
            title="点击前往 职业状态评级"
          >
            <span className="pill-num text-sky-300">{stats.roles}</span>
            <span className="pill-label">职业评级</span>
          </button>

          <button
            className="metric-pill group"
            onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'ceiling' })}
            title="点击前往 极致属性攻略"
          >
            <span className="pill-num text-rose-300">{stats.guides}</span>
            <span className="pill-label">攻略条目</span>
          </button>
        </div>
      </div>
    </div>
  );
};
