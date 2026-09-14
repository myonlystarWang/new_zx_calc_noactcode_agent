import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DataService } from '../../services/DataService';
import type { SearchTarget } from '../GlobalSearch';
import { pinyin } from 'pinyin-pro';

interface SearchEntry {
  l: string;          // label
  g: string;          // group
  c: 'page' | 'dungeon' | 'monster' | 'skill' | 'role' | 'guide'; // category
  i: string;          // pinyin initials
  f: string;          // pinyin full
  k: string[];        // keywords
  t: SearchTarget;    // target
}

function toPinyin(text: string): { i: string; f: string } {
  const arr = pinyin(text, { toneType: 'none', type: 'array' }) as string[];
  const syllables = arr.filter((t) => /^[a-z0-9]+$/i.test(t));
  return {
    i: syllables.map((s) => s[0]).join('').toLowerCase(),
    f: syllables.join('').toLowerCase(),
  };
}

const CAT_ORDER: Array<SearchEntry['c']> = ['page', 'dungeon', 'monster', 'skill', 'role', 'guide'];
const CAT_NAME: Record<SearchEntry['c'], string> = {
  page: '功能入口',
  dungeon: '副本',
  monster: 'Boss / 怪物',
  skill: '职业技能',
  role: '职业评级',
  guide: '攻略与增益',
};

const HOT = ['天华', '赤梭', '苍龙啸', '易伤', '专注', '流波惊变'];
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
  const [recentList, setRecentList] = useState<SearchEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  // 读取本地存储中的最近访问
  const loadRecent = (): SearchEntry[] => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  };

  useEffect(() => {
    setRecentList(loadRecent());
  }, []);

  const saveRecent = (entry: SearchEntry) => {
    const list = loadRecent().filter((x) => x.l !== entry.l);
    list.unshift(entry);
    const updated = list.slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    setRecentList(updated);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentList([]);
  };

  // 构建完整且精准的搜索索引（与 build_demo.cjs 完全对齐）
  const { searchIndex, stats } = useMemo(() => {
    const service = DataService.getInstance();
    const list: SearchEntry[] = [];

    function add(label: string, group: string, cat: SearchEntry['c'], kw: string[], target: SearchTarget) {
      const py = toPinyin(label + ' ' + kw.join(' '));
      list.push({
        l: label,
        g: group,
        c: cat,
        i: py.i,
        f: py.f,
        k: kw,
        t: target,
      });
    }

    // 1. 核心功能入口
    add('属性战力计算器', '功能入口', 'page', ['战力', '计算器', '属性计算'], { tab: 'calculator' });
    add('副本模拟训练场', '功能入口', 'page', ['模拟', '训练场', '战斗模拟', 'arena'], { tab: 'arena' });
    add('资料图鉴', '功能入口', 'page', ['图鉴', '攻略', '资料', '专注值', '增益'], { tab: 'compendium', sub: 'ceiling' });
    add('极致属性攻略', '功能入口', 'page', ['极致属性', '天花板', '无视', '减免', '怪增', '躲闪'], { tab: 'compendium', sub: 'ceiling' });
    add('职业技能速查', '功能入口', 'page', ['技能', '速查', '技能库', '门派技能'], { tab: 'compendium', sub: 'skills' });
    add('职业状态一览', '功能入口', 'page', ['职业状态', '辅助', '增益', '状态评级'], { tab: 'compendium', sub: 'support' });
    add('副本 BOSS 速查', '功能入口', 'page', ['boss', '首领', '抗性', '副本boss', '减爆伤'], { tab: 'compendium', sub: 'boss' });

    // 2. 副本与Boss
    const dungeons = service.getDungeons();
    const monstersByDungeon = service.getDungeonsMonsters() || {};
    const skillMeta = service.getSkillMeta();
    const aliases = skillMeta?.searchAliases || {};

    for (const d of dungeons) {
      add(d.DungeonName, '副本入口 · 属性战力计算器', 'dungeon', aliases[d.DungeonID] || [], {
        tab: 'calculator',
        dungeonId: d.DungeonID,
      });

      const mList = monstersByDungeon[d.DungeonID] || [];
      for (const m of mList) {
        const name = (m as any).MonsterName || (m as any).name;
        const id = (m as any).MonsterID || (m as any).MonsterId;
        if (!name || !id) continue;
        const role = (m as any).role === 'add' ? '小怪' : 'Boss';
        add(name, `${d.DungeonName} · ${role}`, 'monster', [d.DungeonName, ...(aliases[id] || [])], {
          tab: 'calculator',
          dungeonId: d.DungeonID,
          monsterId: id,
        });
      }
    }

    // 3. 75个核心技能
    const allSkills = service.getAllSkills() || {};
    const classLabels: Record<string, string> = skillMeta?.classLabels || {
      ZHU_SHUANG: '逐霜',
      NIE_YU: '涅羽',
      TAI_HAO: '太昊',
      GUI_WANG: '鬼王',
      TIAN_YIN: '天音',
      FEN_XIANG: '焚香',
      ZHAO_MING: '昭冥',
      YING_ZHAO: '英招',
      TIAN_HUA: '天华',
      SHI_LUO: '释罗',
    };
    const factionLabels: Record<string, string> = { XIAN: '仙', FO: '佛', MO: '魔' };

    for (const [classId, factions] of Object.entries(allSkills)) {
      const className = classLabels[classId] || classId;
      for (const [factionId, skillArr] of Object.entries(factions as Record<string, any[]>)) {
        if (!Array.isArray(skillArr)) continue;
        const fName = factionLabels[factionId] || factionId;
        for (const sk of skillArr) {
          // 条目 1：跳转技能速查
          add(sk.SkillName, `${className}·${fName} · 技能速查`, 'skill', [className, fName, ...(aliases[sk.SkillID] || [])], {
            tab: 'skills',
            classId,
            faction: factionId,
            skillName: sk.SkillName,
            skillId: sk.SkillID,
          } as any);

          // 条目 2：跳转属性战力计算器并展示技能属性详情
          add(`${sk.SkillName} (战力测算)`, `属性战力计算器 · ${className}·${fName} · 属性与实战`, 'page', [className, fName, '计算器', '测算', '属性', '伤害', ...(aliases[sk.SkillID] || [])], {
            tab: 'calculator',
            classId,
            faction: factionId,
            skillName: sk.SkillName,
            skillId: sk.SkillID,
          } as any);
        }
      }
    }

    // 4. 战斗增益 Buff
    const buffs = service.getBuffs();
    const buffAliases: Record<string, string[]> = {
      BUFF_FOCUS_EFFECT: ['专注', 'zhuanzhu', 'zz', '增益', '专注增益'],
      BUFF_HOLYWRATH_EFFECT: ['巫咒', 'wuzhou', 'wz', '增益', '巫咒增益'],
      BUFF_MON_CRITDAMAGE_EFFECT: ['绿点', 'lvdian', 'ld', '暴伤', '增益', '绿点增益'],
      BUFF_MON_HARMED_EFFECT: ['易伤', 'yishang', 'ys', '增益', '易伤增益'],
      BUFF_ATT_PERCENT_EFFECT: ['攻击比', 'gongjibi', 'gjb', '增益', '攻击比增益'],
    };
    for (const b of buffs) {
      add(b.BuffName, '各职业状态 · 专注值与战斗增益参考', 'guide', buffAliases[b.BuffID] || [], {
        tab: 'compendium',
        sub: 'support',
        item: b.BuffName,
      });
    }

    // 5. 攻略子页
    const subPages: Array<{ label: string; sub: any; kw: string[] }> = [
      { label: '极致无视攻略', sub: 'ignore', kw: ['无视', '易伤', '无视减免'] },
      { label: '极致减免伤害攻略', sub: 'reduction', kw: ['减免', '减伤'] },
      { label: '极致减暴击攻略', sub: 'critReduction', kw: ['减暴', '暴击减免', '减暴击'] },
      { label: '极致怪增攻略', sub: 'monsterDamageBonus', kw: ['怪增', '怪物增伤', '增伤'] },
      { label: '极致躲闪攻略', sub: 'dodge', kw: ['躲闪', '闪避'] },
      { label: '各职业状态', sub: 'support', kw: ['职业', '辅助', '专注值', '专注'] },
    ];
    for (const sp of subPages) {
      add(sp.label, '资料图鉴 · 攻略', 'guide', sp.kw, { tab: 'compendium', sub: sp.sub });
    }

    // 6. 各职业状态评级
    const roles = service.getSupportRoles();
    if (roles) {
      const seen = new Set<string>();
      for (const r of roles.roles) {
        const key = `${r.name}-${r.faction}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const isDps = r.rating === '输出';
        add(r.name, `各职业状态 · ${r.faction} · ${isDps ? '输出' : '辅助'}`, 'role', [r.name, r.faction], {
          tab: 'compendium',
          sub: 'support',
          item: r.name,
        });
      }
    }

    // 7. 专注值通用参考
    const focusRef = skillMeta?.focusReference;
    if (focusRef) {
      for (const g of focusRef.general || []) {
        add(g.name, '各职业状态 · 专注值参考', 'guide', ['专注', '通用'], {
          tab: 'compendium',
          sub: 'support',
          item: '专注值参考',
        });
      }
    }

    // 8. 极致属性明细行
    const guide = service.getAttributeCeilingGuide();
    if (guide) {
      const gMap: Record<string, { name: string; sub: any }> = {
        ignore: { name: '极致无视攻略', sub: 'ignore' },
        reduction: { name: '极致减免攻略', sub: 'reduction' },
        critReduction: { name: '极致减暴击攻略', sub: 'critReduction' },
      };
      for (const [k, sec] of Object.entries(guide.sections)) {
        const info = gMap[k];
        if (!info) continue;
        for (const row of sec.rows) {
          add(row.item, `${info.name} · 明细`, 'guide', [], {
            tab: 'compendium',
            sub: info.sub,
            item: row.item,
          });
        }
      }
    }

    // 9. 属性来源明细行
    const lists = service.getStatSourceLists();
    if (lists) {
      const lMap: Record<string, { name: string; sub: any }> = {
        monsterDamageBonus: { name: '极致怪增攻略', sub: 'monsterDamageBonus' },
        dodge: { name: '极致躲闪攻略', sub: 'dodge' },
      };
      for (const [k, sec] of Object.entries(lists.sections)) {
        const info = lMap[k];
        if (!info) continue;
        for (const row of sec.sources || []) {
          add(row.item, `${info.name} · 属性来源`, 'guide', [], {
            tab: 'compendium',
            sub: info.sub,
            item: row.item,
          });
        }
        for (const row of sec.conditionals || []) {
          add(row.item, `${info.name} · 条件来源`, 'guide', [], {
            tab: 'compendium',
            sub: info.sub,
            item: row.item,
          });
        }
      }
    }

    const calculatedStats = {
      dungeons: dungeons.length,
      monsters: list.filter((x) => x.c === 'monster').length,
      skills: list.filter((x) => x.c === 'skill').length,
      buffs: buffs.length,
      roles: roles ? roles.roles.length : 0,
      guides: list.filter((x) => x.c === 'guide').length,
    };

    return { searchIndex: list, stats: calculatedStats };
  }, []);

  // 匹配与多分类聚合（与 index.html 的 match 算法完全一致）
  const groupedResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { groupedList: [], flatList: [] };

    const scored: Array<{ e: SearchEntry; s: number }> = [];
    for (const e of searchIndex) {
      const hay = (e.l + ' ' + e.g + ' ' + e.k.join(' ')).toLowerCase();
      const idx = hay.indexOf(q);
      if (idx >= 0) {
        scored.push({ e, s: 100 - idx });
        continue;
      }
      if (e.i && e.i.indexOf(q) >= 0) {
        scored.push({ e, s: 60 - e.i.indexOf(q) });
      } else if (e.f && e.f.indexOf(q) >= 0) {
        scored.push({ e, s: 50 - e.f.indexOf(q) });
      }
    }

    scored.sort((a, b) => b.s - a.s);
    const topResults = scored.slice(0, 25);

    // 按分类聚合
    const groups: Record<string, Array<{ e: SearchEntry; s: number }>> = {};
    for (const item of topResults) {
      (groups[item.e.c] = groups[item.e.c] || []).push(item);
    }

    const order = CAT_ORDER.filter((c) => groups[c]);
    order.sort((a, b) => {
      const ma = Math.max(...groups[a].map((x) => x.s));
      const mb = Math.max(...groups[b].map((x) => x.s));
      return mb - ma;
    });

    const flatList: SearchEntry[] = [];
    const groupedList: Array<{ cat: SearchEntry['c']; catName: string; items: SearchEntry[] }> = [];

    for (const c of order) {
      const items = groups[c].map((x) => x.e);
      groupedList.push({
        cat: c,
        catName: CAT_NAME[c] || c,
        items,
      });
      flatList.push(...items);
    }

    return { groupedList, flatList };
  }, [query, searchIndex]);

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

  const handleChoose = (item: SearchEntry) => {
    saveRecent(item);
    setQuery('');
    setIsFocused(false);
    inputRef.current?.blur();
    onSearchNavigate(item.t);
  };

  // 高亮搜索命中字符
  function renderHighlightedText(text: string, q: string) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  let flatCounter = -1;

  return (
    <div className="hero">
      {/* 标头区（严格对齐 index.html 文案与样式） */}
      <div className="hero-t">
        <h2 className="rise d1">诛仙3副本战斗实验室</h2>
        <p className="rise d2">属性计算 · 战斗模拟 · 资料速查 —— 输入名称或拼音首字母，一站直达</p>
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
                            key={e.l}
                            className="chip"
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              handleChoose(e);
                            }}
                          >
                            {e.l}
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
                      const py = isEn && e.i ? e.i.slice(0, 8) : '';
                      const isRowActive = currentIdx === activeIndex;

                      return (
                        <div
                          key={`${e.l}-${e.g}-${currentIdx}`}
                          className={`row ${isRowActive ? 'on' : ''} cursor-pointer`}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            handleChoose(e);
                          }}
                          onMouseEnter={() => setActiveIndex(currentIdx)}
                        >
                          <span className="dot"></span>
                          <span className="main">
                            <div className="nm">{renderHighlightedText(e.l, query)}</div>
                            <div className="gp">{e.g}</div>
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
      </div>

      {/* 5 大核心功能卡片（视觉完全统一，光泽流动悬停） */}
      <section className="cards">
        <button className="card rise d4" onClick={() => onNavigateTab('calculator')}>
          <div className="card-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="16" height="20" x="4" y="2" rx="2" />
              <line x1="8" x2="16" y1="6" y2="6" />
              <line x1="16" x2="16" y1="14" y2="18" />
              <path d="M16 10h.01" />
              <path d="M12 10h.01" />
              <path d="M8 10h.01" />
              <path d="M12 14h.01" />
              <path d="M8 14h.01" />
            </svg>
          </div>
          <h3>属性战力计算器</h3>
          <p>录入面板属性、勾选战斗增益，实时测算对各副本 Boss 的技能伤害与命中阈值。</p>
          <span className="go">
            进入计算器{' '}
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

        <button className="card rise d5" onClick={() => onNavigateTab('arena')}>
          <div className="card-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
              <line x1="13" x2="19" y1="19" y2="13" />
              <line x1="16" x2="20" y1="16" y2="20" />
              <line x1="19" x2="21" y1="21" y2="19" />
              <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
              <line x1="5" x2="9" y1="14" y2="18" />
              <line x1="7" x2="4" y1="17" y2="20" />
              <line x1="3" x2="5" y1="19" y2="21" />
            </svg>
          </div>
          <h3>副本模拟训练场</h3>
          <p>配置队伍与技能策略，逐秒模拟整场实战，输出伤害曲线、技能时序与详尽报表。</p>
          <span className="go">
            进入训练场{' '}
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

        <button className="card rise d5" onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'skills' })}>
          <div className="card-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="m10 13-2 2 2 2" />
              <path d="m14 17 2-2-2-2" />
            </svg>
          </div>
          <h3>职业技能速查</h3>
          <p>全门派技能充能、冷却、命中段数、伤害加成与机制说明一站式分类直达。</p>
          <span className="go">
            进入技能库{' '}
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

        <button className="card rise d6" onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'boss' })}>
          <div className="card-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="22" x2="18" y1="12" y2="12" />
              <line x1="6" x2="2" y1="12" y2="12" />
              <line x1="12" x2="12" y1="6" y2="2" />
              <line x1="12" x2="12" y1="22" y2="18" />
            </svg>
          </div>
          <h3>副本 BOSS 速查</h3>
          <p>16 大副本 102 位关卡首领抗性速查，包含减爆伤、防御、血量与伤害压缩比。</p>
          <span className="go">
            进入BOSS库{' '}
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

        <button className="card rise d6" onClick={() => onSearchNavigate({ tab: 'compendium', sub: 'ceiling' })}>
          <div className="card-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h3>极致属性攻略</h3>
          <p>极致无视/减免/减暴/怪增/躲闪拆解，职业状态评级与战斗增益上限基准。</p>
          <span className="go">
            进入图鉴{' '}
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

      {/* 底部全站数据统计（严格按照要求展示对应数字与单位） */}
      <div className="stats rise d6" id="stats">
        <span className="si">
          本站收录 <b>{stats.dungeons}</b> 副本
        </span>
        <span className="si">
          <b>{stats.monsters}</b> Boss / 怪物
        </span>
        <span className="si">
          <b>{stats.skills}</b> 职业技能
        </span>
        <span className="si">
          <b>{stats.buffs}</b> 战斗增益
        </span>
        <span className="si">
          <b>{stats.roles}</b> 职业评级
        </span>
        <span className="si">
          <b>{stats.guides}</b> 攻略条目
        </span>
      </div>
    </div>
  );
};
