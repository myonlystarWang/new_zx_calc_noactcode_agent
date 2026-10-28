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
import { trackShareClick } from '../../utils/track';
import type { ShareCardData, ShareSkillRow } from '../share/ShareCard';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { InstallHint } from '../pwa/InstallGuide';
import { pickDefaultDungeon, shortDungeonName, sortDungeons } from '../../data/dungeonMeta';

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

export const TotalPowerCard: React.FC = () => null;

export const ResultSection: React.FC<{ searchNav?: SearchTarget | null; onSearchConsumed?: () => void }> = ({ searchNav, onSearchConsumed }) => {
    const { userCharacter, activeBuffIds, buffs, buffValues, selectedDungeonId: contextDungeonId, selectedMonsterId: contextMonsterId } = useApp();
    const [selectedDungeonId, setSelectedDungeonId] = useState<string | null>(null);
    const [focusMonsterId, setFocusMonsterId] = useState<string | null>(null);
    const [focusSkillName, setFocusSkillName] = useState<string | null>(null);
    const [autoShowAttr, setAutoShowAttr] = useState(false);
    const [activeMonsterId, setActiveMonsterId] = useState<string | null>(null);

    // 同步来自全局上下文或 AI 对话“带入计算器”的副本与 BOSS 定位
    useEffect(() => {
        if (contextDungeonId) {
            setSelectedDungeonId(contextDungeonId);
        }
        if (contextMonsterId) {
            setFocusMonsterId(contextMonsterId);
            setActiveMonsterId(contextMonsterId);
            setAutoShowAttr(true);
        }
    }, [contextDungeonId, contextMonsterId]);

    const results = useMemo(() => {
        const service = DataService.getInstance();
        const skillsMap = service.getSkills(userCharacter.ClassID);
        const skills = skillsMap ? skillsMap[userCharacter.Faction] || [] : [];
        const dungeons = sortDungeons(service.getDungeons());
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

    // 选中项必须存在于当前结果里：AppContext 里的副本 ID 可能不在本轮 dungeonPowers 中，
    // 一旦失配 activeIndex = -1，所有卡片会整体偏移到右侧（第一张不在中间），左右滑也切不动。
    useEffect(() => {
        if (results.dungeonPowers.length === 0) return;
        const exists = results.dungeonPowers.some((d) => d.DungeonID === selectedDungeonId);
        if (!exists) {
            // 默认落在 T17（用户拍板），而不是排序后的第一张（那是 T10）
            const fallback = pickDefaultDungeon(results.dungeonPowers);
            if (fallback) setSelectedDungeonId(fallback.DungeonID);
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

    const [dragOffset, setDragOffset] = useState(0);
    // 手势结束要读「最后一次位移」，不能读 state：快速滑动时 pointerup 可能早于
    // setDragOffset 的提交，读 state 会拿到旧值（0），表现为「滑了但没切换」。
    const dragOffsetRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    // 手机：3D 轮播换成纵向手风琴（一次只展开一个副本，其余只显示摘要行）
    const isMobile = useIsMobile();

    // 统一用 Pointer Events：触摸 / 鼠标 / 触控笔一套逻辑，桌面也能拖。
    // 触摸端由 touch-action: pan-y 保证纵向滚动仍归浏览器、横向位移归这里。
    const pointerStart = useRef<{ x: number; y: number } | null>(null);
    // 拖拽结束后浏览器还会补一个 click，必须抑制，否则「滑一下」会顺带切卡
    const suppressClickRef = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointerStart.current = { x: e.clientX, y: e.clientY };
        dragOffsetRef.current = 0;
        setDragOffset(0);
        setIsDragging(true);
        // 只对触摸/触控笔做指针捕获：鼠标捕获后 pointerup 会把随后的 click 也派发到
        // 捕获元素（容器）上，卡片内部的点击（展开每一段伤害）就全失效了。
        if (e.pointerType !== 'mouse') {
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!pointerStart.current) return;
        const deltaX = e.clientX - pointerStart.current.x;
        const deltaY = e.clientY - pointerStart.current.y;

        // 纵向为主且横向还没起步 → 让位给页面滚动
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 10) {
            pointerStart.current = null;
            setIsDragging(false);
            return;
        }

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            dragOffsetRef.current = deltaX;
            setDragOffset(deltaX);
        }
    };

    const endDrag = () => {
        if (!pointerStart.current) return;
        pointerStart.current = null;
        setIsDragging(false);

        const dx = dragOffsetRef.current;
        dragOffsetRef.current = 0;
        setDragOffset(0);

        // 位移超过 10px 就算拖拽，抑制随后的 click（避免拖完顺带切卡）
        suppressClickRef.current = Math.abs(dx) > 10;
        if (suppressClickRef.current) {
            window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        }

        const threshold = 100; // px to trigger switch
        if (Math.abs(dx) > threshold) {
            const currentIndex = results.dungeonPowers.findIndex(d => d.DungeonID === selectedDungeonId);
            if (dx > 0 && currentIndex > 0) {
                // 右滑 -> 上一张
                setSelectedDungeonId(results.dungeonPowers[currentIndex - 1].DungeonID);
            } else if (dx < 0 && currentIndex >= 0 && currentIndex < results.dungeonPowers.length - 1) {
                // 左滑 -> 下一张
                setSelectedDungeonId(results.dungeonPowers[currentIndex + 1].DungeonID);
            }
        }
    };

    // ---- Step 10：分享数据与动作 ----
    const activeDungeon = useMemo(
        () => results.dungeonPowers.find((d) => d.DungeonID === selectedDungeonId) || results.dungeonPowers[0],
        [results.dungeonPowers, selectedDungeonId],
    );
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
            // 品牌统一：站内、长图、PWA 全用「天书万象 AI」
            siteName: '天书万象 AI',
            siteUrl: 'zxai.raddishlab.com',
            kicker: '诛仙 3 · 伤害模拟',
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
            // 用当前选中副本的「参考战力」（卡片上那个数），不是全局静态战力 —— 两者口径不同
            totalPower: activeDungeon?.TotalDamage,
            // 免责口径：不否认数据来自官方，只说明「AI 模拟可能有误差、以游戏内为准」
            // \n 是排版断行（两行刚好铺满二维码左侧），不是句子分割
            watermark:
                '本图由天书万象 AI 依据官方数据模拟生成，\n可能存在误差，请以游戏内实际为准。',
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
        if (!shareOpen && shareAnchorRef.current) {
            const rect = shareAnchorRef.current.getBoundingClientRect();
            setMenuPos({
                top: rect.bottom + 6,
                right: window.innerWidth - rect.right,
            });
            // 预热：模块 / LOGO / 二维码库先下好，点「分享图片」时只剩画图。
            // navigator.share 要求用户手势，网络请求若发生在点击之后，慢网下可能超出激活窗口。
            void import('../share/ShareCard').then((m) => m.preloadShareLogo()).catch(() => {});
            void import('../../utils/exportImage').catch(() => {});
            void import('qrcode').catch(() => {});
        }
        setShareOpen((prev) => !prev);
    }, [shareOpen]);

    const handleCopyLink = useCallback(async () => {
        setShareOpen(false);
        // 先记意图再复制：剪贴板在无权限环境（含部分内置浏览器）会失败，
        // 但那仍然是「用户想分享」的真实信号，不能因为复制失败就丢掉这条数据
        trackShareClick('link', 'calc');
        const url = await buildShareUrl(shareSnapshot, selectedDungeonId);
        if (await copyToClipboard(url)) {
            setFeedback('link');
            window.setTimeout(() => setFeedback(null), 2000);
        }
    }, [shareSnapshot, selectedDungeonId]);

    const handleCopyText = useCallback(async () => {
        setShareOpen(false);
        trackShareClick('text', 'calc');
        if (await copyToClipboard(buildConfigText(shareSnapshot, buffs))) {
            setFeedback('text');
            window.setTimeout(() => setFeedback(null), 2000);
        }
    }, [shareSnapshot, buffs]);

    /**
     * 能不能「一键分享图片」——只有移动端才给。
     * 桌面 Chrome(Windows) 同样支持 navigator.canShare，一点就弹系统分享框，对桌面用户是噪音；
     * 桌面要的是下载文件，走「导出分享长图」。
     * 判据 = 有触点 + 主指针为粗指针（排除带触摸屏的 Windows 笔记本，那种主指针仍是鼠标）。
     */
    const canShareImage = useMemo(() => {
        try {
            if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
            if ((navigator.maxTouchPoints ?? 0) <= 0) return false;
            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(pointer: coarse)').matches) {
                return false;
            }
            return navigator.canShare({ files: [new File([new Uint8Array(1)], 'p.png', { type: 'image/png' })] });
        } catch {
            return false;
        }
    }, []);

    /**
     * 渲染分享长图（导出 / 分享共用）。
     * 二维码画到 480px 再由 canvas 缩到 240 显示 —— 2x 屏上不糊，扫码才稳。
     */
    const renderShareCanvas = useCallback(async () => {
        const share = await import('../share/ShareCard');
        if (!shareCardData) throw new Error('缺少当前副本/BOSS 数据');

        // 二维码失败不阻塞出图
        let qrDataUrl: string | null = null;
        try {
            // src=qr 只加在二维码里：埋点据此区分「扫码回流」与「点链接回流」，
            // 否则两种来源在数据里都是 share，没法判断长图+二维码这笔投入值不值
            const url = `${await buildShareUrl(shareSnapshot, selectedDungeonId)}&src=qr`;
            const QRCode = (await import('qrcode')).default;
            qrDataUrl = await QRCode.toDataURL(url, {
                margin: 1,
                width: 480,
                errorCorrectionLevel: 'M',
                color: { dark: '#0a0d0c', light: '#ffffff' },
            });
            await share.preloadQrImage(qrDataUrl);
        } catch (err) {
            console.warn('二维码生成失败，改为无码出图:', err);
            qrDataUrl = null;
        }
        await share.preloadShareLogo();

        const { canvas } = share.renderShareCard({ ...shareCardData, qrDataUrl }, share.readShareTheme());
        const filename = share.suggestShareFilename(
            shareCardData.dungeonName,
            shareCardData.bossName,
            shareCardData.dateText,
        );
        return { canvas, filename };
    }, [shareCardData, shareSnapshot, selectedDungeonId]);

    const handleExportImage = useCallback(async () => {
        setShareOpen(false);
        setExportState('working');
        try {
            const [{ canvas, filename }, exporter] = await Promise.all([
                renderShareCanvas(),
                import('../../utils/exportImage'),
            ]);
            const result = await exporter.exportCanvas(canvas, filename);
            if (result.mode === 'preview' && result.dataUrl) setPreviewUrl(result.dataUrl);
            // download=桌面直接下载；preview=微信/iOS 出预览图靠长按保存（用户可能没保存）
            trackShareClick(result.mode === 'preview' ? 'preview' : 'download', 'calc');
            setExportState('idle');
        } catch (err) {
            console.error('导出分享长图失败:', err);
            setExportState('error');
            window.setTimeout(() => setExportState('idle'), 3000);
        }
    }, [renderShareCanvas]);

    /**
     * 一键分享：能调起系统面板就直接发（微信/相册/存文件都走系统面板），
     * 调不起就退回「下载 / 长按保存」。
     */
    const handleShareImage = useCallback(async () => {
        setShareOpen(false);
        setExportState('working');
        try {
            const [{ canvas, filename }, exporter] = await Promise.all([
                renderShareCanvas(),
                import('../../utils/exportImage'),
            ]);
            const result = await exporter.shareImage(canvas, filename, {
                title: shareCardData ? `${shareCardData.dungeonName} · 伤害模拟` : '天书万象 AI',
                text: '天书万象 AI · 诛仙3 伤害模拟',
            });
            trackShareClick(`share-${result.outcome || 'fallback'}`, 'calc');
            if (result.outcome === 'fallback' && result.mode === 'preview' && result.dataUrl) {
                setPreviewUrl(result.dataUrl);
            }
            setExportState('idle');
        } catch (err) {
            console.error('分享图片失败:', err);
            setExportState('error');
            window.setTimeout(() => setExportState('idle'), 3000);
        }
    }, [renderShareCanvas, shareCardData]);

    /**
     * 菜单项做成数组 —— 后续「发布到伤害打卡墙」直接往这里 push 一项即可，
     * 不用再在 JSX 里插一段重复的按钮结构。
     */
    const shareMenuItems = useMemo(() => {
        const items: Array<{ key: string; label: string; icon: React.ElementType; onClick: () => void }> = [];
        if (canShareImage) items.push({ key: 'share', label: '分享图片', icon: Share2, onClick: handleShareImage });
        items.push({ key: 'export', label: '导出分享长图', icon: Download, onClick: handleExportImage });
        items.push({ key: 'link', label: '复制分享链接', icon: Link2, onClick: handleCopyLink });
        items.push({ key: 'text', label: '复制配置文本', icon: FileText, onClick: handleCopyText });
        return items;
    }, [canShareImage, handleShareImage, handleExportImage, handleCopyLink, handleCopyText]);

    const totalPowerRankConfig = useMemo(() => getRankConfig(results.totalPower), [results.totalPower]);
    const [powerCopied, setPowerCopied] = useState(false);
    const handleCopyPowerData = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = `静态战力: ${formatNumber(results.totalPower)} (${totalPowerRankConfig.Rank}级)`;
        if (await copyToClipboard(text)) {
            setPowerCopied(true);
            window.setTimeout(() => setPowerCopied(false), 2000);
        }
    }, [results.totalPower, totalPowerRankConfig]);

    return (
        <div className="relative w-full flex flex-col">
            {/* 顶栏：标题 + 呼吸勋章 + 分享按钮 (h-9 与左侧属性方案 100% 绝对等高平齐) */}
            <div className="w-full h-9 flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full shrink-0"></span>
                    <h2 className="text-sm font-bold text-slate-100 truncate">
                        副本战力分析 (实战输出)
                    </h2>
                </div>

                <div className="relative flex items-center gap-2 shrink-0">
                    {/* 综合战力评分 · 呼吸勋章 */}
                    <div
                        onClick={handleCopyPowerData}
                        title="点击复制战力数据"
                        className="h-8 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 rounded-full border border-cyan-500/40 bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-cyan-950/70 shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:border-cyan-400/80 hover:shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all cursor-pointer group select-none"
                    >
                        <Trophy className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                        <div className="flex items-center gap-1 font-mono">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">战力</span>
                            <span className="text-xs sm:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-300">
                                {formatNumber(results.totalPower)}
                            </span>
                        </div>

                        {/* 等级呼吸胶囊 */}
                        <span className={clsx(
                            "px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black italic tracking-wide border shadow-sm transition-all",
                            totalPowerRankConfig.Color,
                            totalPowerRankConfig.Border,
                            totalPowerRankConfig.TextColor,
                            totalPowerRankConfig.Shadow
                        )}>
                            {totalPowerRankConfig.Rank} 级
                        </span>

                        {/* 复制指示 */}
                        <div className="text-slate-400 group-hover:text-cyan-300 transition-colors ml-0.5">
                            {powerCopied ? (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" />
                                    <span className="hidden md:inline">已复制</span>
                                </span>
                            ) : (
                                <Copy className="w-3 h-3" />
                            )}
                        </div>
                    </div>

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
                        data-compact
                        className="h-8 flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-500/50 transition-all cursor-pointer"
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

            {isMobile && (
                /* 手机：横向滑动仍是主交互，这里给一条可点的副本快捷条（T16/T17…），
                   既解决「不知道能滑」，也兜住手势失灵的情况。 */
                <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                    {results.dungeonPowers.map((d) => {
                        const isActive = d.DungeonID === selectedDungeonId;
                        const tag = shortDungeonName(d.DungeonID, d.DungeonName);
                        return (
                            <button
                                key={d.DungeonID}
                                type="button"
                                onClick={() => {
                                    if (isActive) return;
                                    setSelectedDungeonId(d.DungeonID);
                                    setFocusMonsterId(null);
                                    setFocusSkillName(null);
                                    setAutoShowAttr(false);
                                }}
                                className={clsx(
                                    'shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap transition-colors',
                                    isActive
                                        ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                                        : 'border-slate-700 bg-slate-900/60 text-slate-400'
                                )}
                            >
                                {tag}
                            </button>
                        );
                    })}
                </div>
            )}

            <div
                ref={containerRef}
                className="relative w-full h-[675px] flex items-start justify-center perspective-1000 touch-pan-y overflow-hidden"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
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
                                    // 拖拽结束浏览器补发的 click 要忽略，否则滑完会顺带切卡
                                    if (isDragging || suppressClickRef.current) return;
                                    setSelectedDungeonId(d.DungeonID);
                                    setFocusMonsterId(null);
                                    setFocusSkillName(null);
                                    setAutoShowAttr(false);
                                }}
                                className={clsx(
                                    "absolute ease-out cursor-pointer origin-top",
                                    // 手机 88% 宽（左右各露约 22px，提示可左右滑）；桌面维持原来的 90%，不动
                                    isActive ? "z-50 w-[88%] md:w-[90%] max-w-5xl h-auto" : "carousel-card-inactive w-[85%] md:w-[80%] h-auto"
                                )}
                                style={{
                                    transform: `translateX(${xPercent}%) scale(${scale}) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                                    zIndex: 50 - Math.round(absOffset),
                                    opacity: opacity,
                                    willChange: 'transform',
                                    transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)'
                                }}
                            >
                                {/* 只挂载当前卡与左右各一张：16 份 DungeonDetail 同时渲染在手机上会明显卡顿 */}
                                {Math.abs(baseOffset) <= 1 ? (
                                    /* 非当前卡（模糊那两张）内部一律不可交互：
                                       以前里面的关次 tab / 带入计算器 / BOSS 行仍可点，用户想点
                                       前卡边缘或想滑动时会误触到后卡内部的按钮 —— 表现为"点击穿透"。
                                       现在整卡只保留外层 onClick（点模糊卡=切到该副本），内部控件全部失效。 */
                                    <div
                                        className={isActive ? undefined : 'pointer-events-none select-none'}
                                        aria-hidden={isActive ? undefined : true}
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
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* PWA：结果都算出来了才出现，位置最轻，不打断看数据 */}
            <div className="mt-3 flex items-center justify-center">
                <InstallHint />
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
                        {shareMenuItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={item.onClick}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700/60 transition-colors text-left"
                            >
                                <item.icon className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                                {item.label}
                            </button>
                        ))}
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
                    <p className="text-amber-200/90 text-xs font-medium bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">长按图片：选择「发送给朋友」直达微信，或「存储图像」到相册</p>
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
