import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DataService } from '../../services/DataService';
import { buildSingleCalcSkills, calculateDamage, calculateDungeonPower, calculateTotalPower } from '../../utils/calculator';
import { formatNumber } from '../../utils/format';
import { Trophy, Copy, Check, Share2, Download, Link2, FileText, Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { DungeonDetail } from './DungeonDetail';
import type { SearchTarget } from '../GlobalSearch';
import type { Skill } from '../../types';
import { buildConfigText, buildShareUrl, FACTION_LABELS, type ShareSnapshot } from '../../utils/shareSnapshot';
import type { ShareCardData, ShareSkillRow } from '../share/ShareCard';

/** 剪贴板：优先 Clipboard API，非安全上下文回退 execCommand（与 TotalPowerCard 同一策略） */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        area.style.top = '0';
        area.setAttribute('readonly', '');
        document.body.appendChild(area);
        area.focus();
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
}

interface RankStyleConfig {
    Color: string;
    Shadow: string;
    Border: string;
    TextColor: string;
    Glow: string;
}

const RANK_STYLES: Record<string, RankStyleConfig> = {
    'SSS': {
        Color: 'bg-yellow-500/10',
        Shadow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]',
        Border: 'border border-yellow-400',
        TextColor: 'text-yellow-400',
        Glow: 'drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]'
    },
    'SS': {
        Color: 'bg-purple-500/10',
        Shadow: 'shadow-[0_0_15px_rgba(168,85,24,0.4)]',
        Border: 'border border-purple-400',
        TextColor: 'text-purple-400',
        Glow: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]'
    },
    'S': {
        Color: 'bg-blue-500/10',
        Shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
        Border: 'border border-blue-400',
        TextColor: 'text-blue-400',
        Glow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
    },
    'A': {
        Color: 'bg-cyan-500/10',
        Shadow: 'shadow-[0_0_15px_rgba(34,211,238,0.4)]',
        Border: 'border border-cyan-400',
        TextColor: 'text-cyan-400',
        Glow: ''
    },
    'B': {
        Color: 'bg-emerald-500/10',
        Shadow: 'shadow-[0_0_10px_rgba(52,211,153,0.4)]',
        Border: 'border border-emerald-400',
        TextColor: 'text-emerald-400',
        Glow: ''
    },
    'C': {
        Color: 'bg-slate-500/10',
        Shadow: 'shadow-none',
        Border: 'border border-slate-500',
        TextColor: 'text-slate-400',
        Glow: ''
    }
};

const getRankConfig = (power: number) => {
    const rankConfigs = DataService.getInstance().getRankConfigs();
    if (!rankConfigs || rankConfigs.length === 0) {
        return {
            Rank: 'C',
            Threshold: 0,
            ...RANK_STYLES['C']
        };
    }
    const config = rankConfigs.find(c => power >= c.Threshold) || rankConfigs[rankConfigs.length - 1];
    const style = RANK_STYLES[config.Rank] || RANK_STYLES['C'];
    return { ...config, ...style };
};

export const TotalPowerCard: React.FC = () => {
    const { userCharacter, activeBuffIds, buffs, buffValues } = useApp();
    const [copied, setCopied] = useState(false);

    const totalPower = useMemo(() => {
        const service = DataService.getInstance();
        const skillsMap = service.getSkills(userCharacter.ClassID);
        const skills = skillsMap ? skillsMap[userCharacter.Faction] || [] : [];
        const dungeons = service.getDungeons();
        const activeBuffs = buffs.filter(b => activeBuffIds.includes(b.BuffID));

        const dungeonPowers = dungeons.map(dungeon => {
            const power = calculateDungeonPower(
                userCharacter.BaseAttributes,
                skills,
                dungeon.Monsters,
                activeBuffs,
                buffValues
            );
            return power;
        });

        return calculateTotalPower(
            dungeonPowers,
            dungeonPowers.map(() => 1)
        );
    }, [userCharacter, activeBuffIds, buffs, buffValues]);

    const currentRankConfig = getRankConfig(totalPower);

    const copyData = async () => {
        const text = `静态战力: ${formatNumber(totalPower)} (${currentRankConfig.Rank}级)`;
        if (await copyToClipboard(text)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="zx-card p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-24 bg-[var(--theme-primary)] opacity-15 blur-[40px] rounded-full pointer-events-none animate-glow"></div>

            <div className="relative flex flex-col items-center text-center z-10">
                {/* Header - Compact */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-[var(--theme-glow)] border border-[var(--theme-primary)]/30 shadow-[0_0_8px_var(--theme-glow)]">
                        <Trophy className="w-4 h-4 text-[var(--theme-accent)]" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-base font-black text-white tracking-wide italic" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                            综合战力评分
                        </h2>
                        <p className="text-[8px] font-medium text-slate-400 tracking-widest uppercase leading-none">Total Power Score</p>
                    </div>
                </div>

                {/* Main Power Number - Enhanced Gradient */}
                <div className="relative mb-2">
                    <div className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-[var(--theme-text)] to-[var(--theme-primary)] tracking-tighter drop-shadow-2xl"
                        style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}>
                        {formatNumber(totalPower)}
                    </div>
                </div>

                {/* Rank Badge - Dynamic Styles */}
                <div className="mb-3">
                    <div className={clsx(
                        'px-4 py-0.5 rounded-full backdrop-blur-md transition-all duration-500 animate-pulse-slow',
                        currentRankConfig.Color,
                        currentRankConfig.Shadow,
                        currentRankConfig.Border,
                        currentRankConfig.Glow
                    )}>
                        <span className={clsx(
                            'text-xs font-black italic tracking-wider',
                            currentRankConfig.TextColor
                        )} style={{ textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}>
                            {currentRankConfig.Rank} 级
                        </span>
                    </div>
                </div>

                {/* Footer Actions - Compact */}
                <div className="flex flex-col sm:flex-row items-center gap-2 text-[10px] w-full justify-center border-t border-slate-700/50 pt-3">
                    <button
                        onClick={copyData}
                        className={clsx(
                            "flex items-center gap-1 px-3 py-1 rounded-full transition-all group border text-[10px]",
                            copied
                                ? "bg-green-500/20 border-green-500/30 text-green-400 font-bold"
                                : "zx-btn"
                        )}
                    >
                        {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 group-hover:scale-110 transition-transform" />}
                        <span>{copied ? "已复制" : "复制战力数据"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ResultSection: React.FC<{ searchNav?: SearchTarget | null; onSearchConsumed?: () => void }> = ({ searchNav, onSearchConsumed }) => {
    const { userCharacter, activeBuffIds, buffs, buffValues } = useApp();
    const [selectedDungeonId, setSelectedDungeonId] = useState<string | null>(null);
    const [focusMonsterId, setFocusMonsterId] = useState<string | null>(null);
    const [focusSkillName, setFocusSkillName] = useState<string | null>(null);
    const [autoShowAttr, setAutoShowAttr] = useState(false);

    const results = useMemo(() => {
        const service = DataService.getInstance();
        const skillsMap = service.getSkills(userCharacter.ClassID);
        const skills = skillsMap ? skillsMap[userCharacter.Faction] || [] : [];
        const dungeons = service.getDungeons();
        const activeBuffs = buffs.filter(b => activeBuffIds.includes(b.BuffID));

        const dungeonPowers = dungeons.map(dungeon => {
            const power = calculateDungeonPower(
                userCharacter.BaseAttributes,
                skills,
                dungeon.Monsters,
                activeBuffs,
                buffValues
            );
            return {
                ...dungeon,
                TotalDamage: power // Ensure TotalDamage is set for compatibility
            };
        });

        const totalPower = calculateTotalPower(
            dungeonPowers.map(d => d.TotalDamage),
            dungeonPowers.map(() => 1)
        );

        return {
            totalPower,
            dungeonPowers
        };
    }, [userCharacter, activeBuffIds, buffs, buffValues]);

    // Initialize selected dungeon
    useEffect(() => {
        if (!selectedDungeonId && results.dungeonPowers.length > 0) {
            setSelectedDungeonId(results.dungeonPowers[0].DungeonID);
        }
    }, [results.dungeonPowers, selectedDungeonId]);

    // Search-driven jump: bring the target dungeon card to front and focus its Boss or Skill.
    // Persist focus in local state (searchNav is cleared by onSearchConsumed immediately,
    // so we must capture the monster or skill before it disappears).
    useEffect(() => {
        if (searchNav && searchNav.tab === 'calculator') {
            if (searchNav.dungeonId) {
                setSelectedDungeonId(searchNav.dungeonId);
            }
            // 临时开关（2026-09-16）：搜索直达是否自动展开「BOSS 属性卡」与「技能附加属性卡」。
            // 暂时关闭：仅切到对应副本/职业，不自动选中 Boss、不 pin 技能附加卡；恢复时改为 true。
            const ENABLE_SEARCH_AUTO_FOCUS = false;
            setFocusMonsterId(ENABLE_SEARCH_AUTO_FOCUS ? (searchNav.monsterId ?? null) : null);
            setFocusSkillName(ENABLE_SEARCH_AUTO_FOCUS ? (searchNav.skillName ?? null) : null);
            setAutoShowAttr(ENABLE_SEARCH_AUTO_FOCUS);
            onSearchConsumed?.();
        }
    }, [searchNav, onSearchConsumed]);

    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        setIsDragging(true);
        setDragOffset(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX.current;
        const deltaY = currentY - touchStartY.current;

        // Locking direction: if vertical scroll is dominant, stop tracking drag
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 10) {
            setIsDragging(false);
            return;
        }

        // If we are dragging horizontally
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            setDragOffset(deltaX);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        const threshold = 100; // px to trigger switch

        if (Math.abs(dragOffset) > threshold) {
            const currentIndex = results.dungeonPowers.findIndex(d => d.DungeonID === selectedDungeonId);
            if (dragOffset > 0 && currentIndex > 0) {
                // Swipe Right -> Prev
                setSelectedDungeonId(results.dungeonPowers[currentIndex - 1].DungeonID);
            } else if (dragOffset < 0 && currentIndex < results.dungeonPowers.length - 1) {
                // Swipe Left -> Next
                setSelectedDungeonId(results.dungeonPowers[currentIndex + 1].DungeonID);
            }
        }

        setDragOffset(0);
    };

    // ---- Step 10：分享数据与动作 ----
    const activeDungeon = useMemo(
        () => results.dungeonPowers.find((d) => d.DungeonID === selectedDungeonId) || results.dungeonPowers[0],
        [results.dungeonPowers, selectedDungeonId],
    );
    const [activeMonsterId, setActiveMonsterId] = useState<string | null>(null);
    const activeBoss = useMemo(() => {
        if (!activeDungeon) return undefined;
        return activeDungeon.Monsters.find((m) => m.MonsterID === activeMonsterId) || activeDungeon.Monsters[0];
    }, [activeDungeon, activeMonsterId]);

    const shareSnapshot: ShareSnapshot = useMemo(() => ({
        classId: userCharacter.ClassID,
        faction: userCharacter.Faction,
        attributes: userCharacter.BaseAttributes,
        activeBuffIds,
        buffValues,
    }), [userCharacter.ClassID, userCharacter.Faction, userCharacter.BaseAttributes, activeBuffIds, buffValues]);

    const shareCardData: ShareCardData | null = useMemo(() => {
        if (!activeDungeon || !activeBoss) return null;
        const service = DataService.getInstance();
        const skillsMap = service.getSkills(userCharacter.ClassID);
        const outputSkills = skillsMap
            ? buildSingleCalcSkills(skillsMap as Record<string, Skill[]>, userCharacter.Faction)
            : [];
        const activeShareBuffs = buffs.filter((b) => activeBuffIds.includes(b.BuffID));

        const rows: ShareSkillRow[] = outputSkills
            .map((skill) => {
                const dmg = calculateDamage(userCharacter.BaseAttributes, skill, activeBoss, activeShareBuffs, buffValues);
                const multiHit = skill.SkillBonusAttributes?.MultiHitConfig;
                const hits = dmg.hits || [];
                return {
                    row: {
                        name: skill.SkillName,
                        avg: dmg.avgFinalDamage,
                        min: dmg.minFinalDamage,
                        max: dmg.maxFinalDamage,
                        hitCount: multiHit?.HitCount || 1,
                        isMultiHit: !!multiHit && hits.length > 1,
                        hits: hits.map((h) => ({
                            hitIndex: h.hitIndex,
                            min: h.minFinalDamage,
                            max: h.maxFinalDamage,
                            avg: h.avgFinalDamage,
                        })),
                    } satisfies ShareSkillRow,
                    weight: skill.SkillImportanceWeight,
                };
            })
            .sort((a, b) => b.weight - a.weight)
            .map((item) => item.row);

        const today = new Date();
        const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const classLabel = service.getClasses()?.find((c) => c.ClassID === userCharacter.ClassID)?.ClassName || userCharacter.ClassID;

        return {
            siteName: '诛仙3战力模拟器',
            dateText,
            className: classLabel,
            factionLabel: FACTION_LABELS[userCharacter.Faction] || userCharacter.Faction,
            attributes: userCharacter.BaseAttributes,
            buffs: activeShareBuffs.map((b) => ({
                name: b.BuffName,
                value: buffValues[b.BuffID] ?? b.DefaultEffectValue ?? 0,
            })),
            dungeonName: activeDungeon.DungeonName,
            bossName: activeBoss.MonsterName,
            skills: rows,
        };
    }, [activeDungeon, activeBoss, userCharacter, buffs, activeBuffIds, buffValues]);

    const [shareOpen, setShareOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
    const [feedback, setFeedback] = useState<'link' | 'text' | null>(null);
    const [exportState, setExportState] = useState<'idle' | 'working' | 'error'>('idle');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const shareAnchorRef = useRef<HTMLButtonElement>(null);

    const handleMonsterChange = useCallback((monsterId: string) => {
        setActiveMonsterId(monsterId);
    }, []);

    const handleToggleShareMenu = useCallback(() => {
        setShareOpen((prev) => {
            if (!prev && shareAnchorRef.current) {
                const rect = shareAnchorRef.current.getBoundingClientRect();
                setMenuPos({
                    top: rect.bottom + 6,
                    right: window.innerWidth - rect.right,
                });
            }
            return !prev;
        });
    }, []);

    const handleCopyLink = useCallback(async () => {
        setShareOpen(false);
        const url = await buildShareUrl(shareSnapshot, selectedDungeonId);
        if (await copyToClipboard(url)) {
            setFeedback('link');
            window.setTimeout(() => setFeedback(null), 2000);
        }
    }, [shareSnapshot, selectedDungeonId]);

    const handleCopyText = useCallback(async () => {
        setShareOpen(false);
        if (await copyToClipboard(buildConfigText(shareSnapshot, buffs))) {
            setFeedback('text');
            window.setTimeout(() => setFeedback(null), 2000);
        }
    }, [shareSnapshot, buffs]);

    const handleExportImage = useCallback(async () => {
        setShareOpen(false);
        setExportState('working');
        try {
            const [share, exporter] = await Promise.all([
                import('../share/ShareCard'),
                import('../../utils/exportImage'),
            ]);
            if (!shareCardData) throw new Error('缺少当前副本/BOSS 数据');

            // 二维码失败不阻塞出图
            let qrDataUrl: string | null = null;
            try {
                const url = await buildShareUrl(shareSnapshot, selectedDungeonId);
                const QRCode = (await import('qrcode')).default;
                qrDataUrl = await QRCode.toDataURL(url, {
                    margin: 1,
                    width: 336,
                    errorCorrectionLevel: 'M',
                    color: { dark: '#0a0d0c', light: '#ffffff' },
                });
                await share.preloadQrImage(qrDataUrl);
            } catch (err) {
                console.warn('二维码生成失败，改为无码出图:', err);
                qrDataUrl = null;
            }

            const { canvas } = share.renderShareCard({ ...shareCardData, qrDataUrl }, share.readShareTheme());
            const result = await exporter.exportCanvas(
                canvas,
                share.suggestShareFilename(shareCardData.dungeonName, shareCardData.bossName, shareCardData.dateText),
            );
            if (result.mode === 'preview' && result.dataUrl) setPreviewUrl(result.dataUrl);
            setExportState('idle');
        } catch (err) {
            console.error('导出分享长图失败:', err);
            setExportState('error');
            window.setTimeout(() => setExportState('idle'), 3000);
        }
    }, [shareCardData, shareSnapshot, selectedDungeonId]);

    return (
        <div className="relative w-full flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></span>
                    副本战力分析
                </h2>

                <div className="relative flex items-center gap-2">
                    {feedback && (
                        <span className="text-[10px] text-green-400 font-bold whitespace-nowrap">
                            {feedback === 'link' ? '✓ 链接已复制' : '✓ 文本已复制'}
                        </span>
                    )}
                    {exportState === 'error' && (
                        <span className="text-[10px] text-red-400 font-bold whitespace-nowrap">导出失败，请重试</span>
                    )}
                    <button
                        type="button"
                        ref={shareAnchorRef}
                        onClick={handleToggleShareMenu}
                        aria-label="分享"
                        aria-expanded={shareOpen}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-500/50 transition-all cursor-pointer"
                    >
                        {exportState === 'working' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Share2 className="w-3.5 h-3.5" />
                        )}
                        <span>{exportState === 'working' ? '导出中' : '分享'}</span>
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="relative w-full h-[720px] md:h-[720px] flex items-start justify-center perspective-1000 touch-pan-y overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Cards Container */}
                <div className="relative w-full h-full flex items-start justify-center transform-style-3d">
                    {results.dungeonPowers.map((d, index) => {
                        const activeIndex = results.dungeonPowers.findIndex(dp => dp.DungeonID === selectedDungeonId);
                        const baseOffset = index - activeIndex;

                        // Calculate effective offset including drag
                        // Assume card width ~350px for drag sensitivity
                        const dragInfluence = dragOffset / 350;
                        const effectiveOffset = baseOffset + dragInfluence;

                        const absOffset = Math.abs(effectiveOffset);
                        const direction = Math.sign(effectiveOffset) || (baseOffset > 0 ? 1 : -1);

                        const rankConfig = getRankConfig(d.TotalDamage);
                        const powerRaw = d.TotalDamage;

                        // Continuous Transform Logic
                        // X Position: 0 -> 60% -> +15% per step
                        const xPercent = direction * (60 * Math.min(1, absOffset) + Math.max(0, absOffset - 1) * 15);

                        // Z Position: 0 -> -150 -> -50 per step
                        const translateZ = -150 * Math.min(1, absOffset) - (Math.max(0, absOffset - 1) * 50);

                        // Rotation: 0 -> -15 deg
                        const rotateY = -15 * Math.min(1, absOffset) * direction;

                        // Scale: 1 -> 0.8 -> -0.05 per step
                        const scale = 1 - 0.2 * Math.min(1, absOffset) - 0.05 * Math.max(0, absOffset - 1);

                        // Opacity: 1 -> 0.85 -> -0.15 per step
                        const opacity = Math.max(0, 1 - 0.15 * absOffset);

                        const isActive = d.DungeonID === selectedDungeonId;

                        return (
                            <div
                                key={d.DungeonID}
                                onClick={() => {
                                    if (isDragging) return;
                                    setSelectedDungeonId(d.DungeonID);
                                    setFocusMonsterId(null);
                                    setFocusSkillName(null);
                                    setAutoShowAttr(false);
                                }}
                                className={clsx(
                                    "absolute ease-out cursor-pointer origin-top",
                                    isActive ? "z-50 w-full md:w-[90%] max-w-5xl h-auto" : "w-[85%] md:w-[80%] h-auto"
                                )}
                                style={{
                                    transform: `translateX(${xPercent}%) scale(${scale}) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                                    zIndex: 50 - Math.round(absOffset),
                                    opacity: opacity,
                                    willChange: 'transform',
                                    transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)'
                                }}
                            >
                                <DungeonDetail
                                    dungeon={d}
                                    isExpanded={isActive}
                                    standalone={true}
                                    rankConfig={rankConfig}
                                    power={powerRaw}
                                    focusMonsterId={focusMonsterId}
                                    focusSkillName={focusSkillName}
                                    autoShowAttr={autoShowAttr}
                                    onMonsterChange={isActive ? handleMonsterChange : undefined}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
            {shareOpen && menuPos && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShareOpen(false)} aria-hidden />
                    <div
                        role="menu"
                        aria-label="分享"
                        className="fixed z-[9999] w-44 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/70 flex flex-col gap-1"
                        style={{ top: menuPos.top, right: menuPos.right }}
                    >
                        <button type="button" onClick={handleExportImage} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700/60 transition-colors text-left">
                            <Download className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                            导出分享长图
                        </button>
                        <button type="button" onClick={handleCopyLink} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700/60 transition-colors text-left">
                            <Link2 className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                            复制分享链接
                        </button>
                        <button type="button" onClick={handleCopyText} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700/60 transition-colors text-left">
                            <FileText className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                            复制配置文本
                        </button>
                    </div>
                </>,
                document.body,
            )}

            {previewUrl && (
                <div className="fixed inset-0 z-[9999] bg-black/85 flex flex-col items-center justify-center gap-4 p-4">
                    <img
                        src={previewUrl}
                        alt="分享长图（长按保存）"
                        className="max-h-[78vh] max-w-full rounded-xl shadow-2xl"
                    />
                    <p className="text-slate-300 text-xs">长按图片保存到相册，或直接分享给好友</p>
                    <button
                        type="button"
                        onClick={() => setPreviewUrl(null)}
                        className="zx-btn flex items-center gap-1.5 px-4 py-2 rounded-full text-xs"
                    >
                        <X className="w-3.5 h-3.5" />
                        关闭
                    </button>
                </div>
            )}
        </div>
    );
};
