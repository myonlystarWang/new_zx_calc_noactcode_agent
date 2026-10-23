import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    Radio,
    Star,
    RefreshCw,
    Activity,
    Volume2,
    VolumeX,
    Play,
    Pause,
    Maximize2,
    Minimize2,
    X,
    Sparkles,
    Heart,
} from 'lucide-react';
import clsx from 'clsx';
import { SERVER_ZONES, type RadarServer } from '../../data/serverList.generated';

type ViewKey = { kind: 'new' } | { kind: 'fav' } | { kind: 'zone'; zhanQu: string };

interface ServerEntry extends RadarServer {
    zhanQu: string;
}

const FAVORITES_KEY = 'zx_server_radar_favorites_v2';
const STATUS_CACHE_KEY = 'zx_server_radar_cache_v2';
const CACHE_TTL_MS = 30 * 60 * 1000;
const PROBE_INTERVAL_MS = 4000;
const NEW_BADGE_DAYS = 90;

const ALL_SERVERS: ServerEntry[] = SERVER_ZONES.flatMap(z =>
    z.servers.map(s => ({ ...s, zhanQu: z.zhanQu }))
);

const DEFAULT_SERVER = 'longtengbixiao';

export interface ServerStatusItem {
    status: number; // 1: 已开服, 0: 维护中
    ping: number;
    msg: string;
    updatedAt: number;
}

interface ProbeLog {
    id: string;
    time: string;
    serverName: string;
    status: 'online' | 'offline' | 'error';
    message: string;
}

const loadCache = (): Record<string, ServerStatusItem> => {
    try {
        const raw = localStorage.getItem(STATUS_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const saveCache = (map: Record<string, ServerStatusItem>) => {
    try {
        localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(map));
    } catch {
        /* 隐私模式下写入失败，忽略 */
    }
};

const loadFavorites = (): string[] => {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        /* ignore */
    }
    // 老版本按 serverId 存收藏，迁移成新的 server 键
    try {
        const legacy = localStorage.getItem('zx_server_radar_favorites');
        if (legacy) {
            const ids: string[] = JSON.parse(legacy);
            const mapped = ALL_SERVERS.filter(s => ids.includes(s.serverId)).map(s => s.server);
            if (mapped.length > 0) return mapped;
        }
    } catch {
        /* ignore */
    }
    return ['longtengbixiao', 'chuangshiqimeng'];
};

/** 延迟分档：只呈现时延，不臆造官方负载值 */
const pingTier = (ping: number) => {
    if (ping < 60) return { label: '流畅', cls: 'text-emerald-400' };
    if (ping < 120) return { label: '良好', cls: 'text-emerald-300' };
    if (ping < 200) return { label: '一般', cls: 'text-amber-300' };
    return { label: '较高', cls: 'text-rose-400' };
};

/** 开服时间描述 */
const openInfo = (openAt: string | null) => {
    if (!openAt) return null;
    const ts = new Date(openAt).getTime();
    const diff = ts - Date.now();
    if (diff > 0) {
        const hours = Math.floor(diff / 3600000);
        if (hours < 24) return { text: `今日 ${openAt.slice(11, 16)} 开服`, pending: true };
        return { text: `${Math.ceil(hours / 24)} 天后开服`, pending: true };
    }
    const days = Math.floor(-diff / 86400000);
    return { text: days === 0 ? '今日开服' : `开服 ${days} 天`, pending: false };
};

const showNewBadge = (openAt: string | null) => {
    if (!openAt) return false;
    const days = (Date.now() - new Date(openAt).getTime()) / 86400000;
    return days <= NEW_BADGE_DAYS;
};

const matchServer = (srv: RadarServer, query: { name?: string; id?: string }) => {
    const name = query.name || '';
    const id = query.id || '';
    return (
        (!!name && (srv.name === name || srv.server === name || srv.aliases.includes(name))) ||
        (!!id && srv.serverId === String(id))
    );
};

export interface ServerRadarViewProps {
    isSplitScreen?: boolean;
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    onClose?: () => void;
    initialZhanQu?: string;
    initialServerName?: string;
    initialServerId?: string;
}

export const ServerRadarView: React.FC<ServerRadarViewProps> = ({
    isSplitScreen = false,
    isMaximized = false,
    onToggleMaximize,
    onClose,
    initialZhanQu,
    initialServerName,
    initialServerId,
}) => {
    const resolvedInitial = useMemo(() => {
        const hit = ALL_SERVERS.find(s => matchServer(s, { name: initialServerName, id: initialServerId }));
        if (hit) return hit;
        const zone = initialZhanQu
            ? SERVER_ZONES.find(z => z.zhanQu === initialZhanQu || z.zhanQu.includes(initialZhanQu.replace('战区', '')))
            : undefined;
        if (zone?.servers[0]) return { ...zone.servers[0], zhanQu: zone.zhanQu };
        return ALL_SERVERS.find(s => s.server === DEFAULT_SERVER) || ALL_SERVERS[0];
    }, [initialZhanQu, initialServerName, initialServerId]);

    const [view, setView] = useState<ViewKey>({ kind: 'zone', zhanQu: resolvedInitial.zhanQu });
    const [selected, setSelected] = useState<ServerEntry>(resolvedInitial);
    const [isProbing, setIsProbing] = useState(false);
    const [isBatchProbing, setIsBatchProbing] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [favorites, setFavorites] = useState<string[]>(loadFavorites);

    const cacheRef = useRef<Record<string, ServerStatusItem>>(loadCache());
    const [statusMap, setStatusMap] = useState<Record<string, ServerStatusItem>>(cacheRef.current);
    const [pingHistory, setPingHistory] = useState<Record<string, number[]>>({});
    const [logs, setLogs] = useState<ProbeLog[]>([]);

    const timerRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // 外部传入区服变化时联动
    useEffect(() => {
        if (!initialZhanQu && !initialServerName && !initialServerId) return;
        const hit = ALL_SERVERS.find(s => matchServer(s, { name: initialServerName, id: initialServerId }));
        if (hit) {
            setSelected(hit);
            setView({ kind: 'zone', zhanQu: hit.zhanQu });
            return;
        }
        if (initialZhanQu) {
            const zone = SERVER_ZONES.find(z => z.zhanQu.includes(initialZhanQu.replace('战区', '')));
            if (zone) {
                setView({ kind: 'zone', zhanQu: zone.zhanQu });
                if (zone.servers[0]) setSelected({ ...zone.servers[0], zhanQu: zone.zhanQu });
            }
        }
    }, [initialZhanQu, initialServerName, initialServerId]);

    const commitStatus = useCallback((updates: Array<{ server: string; item: ServerStatusItem }>) => {
        const next = { ...cacheRef.current };
        for (const u of updates) next[u.server] = u.item;
        cacheRef.current = next;
        saveCache(next);
        setStatusMap(next);
        setPingHistory(prev => {
            const hist = { ...prev };
            for (const u of updates) {
                const arr = (hist[u.server] || []).slice(-27);
                arr.push(u.item.status === 1 ? u.item.ping : 0);
                hist[u.server] = arr;
            }
            return hist;
        });
    }, []);

    const playSuccessChime = useCallback(() => {
        if (!soundEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = audioCtxRef.current || new AudioContextClass();
            audioCtxRef.current = ctx;
            const now = ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((freq, idx) => {
                const start = now + idx * 0.14;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.3, start);
                gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.45);
            });
        } catch {
            /* 浏览器策略拦截时静默 */
        }
    }, [soundEnabled]);

    const pushLog = useCallback((serverName: string, status: ProbeLog['status'], message: string) => {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setLogs(prev => [{ id: `${Date.now()}-${Math.random()}`, time, serverName, status, message }, ...prev].slice(0, 60));
    }, []);

    /** 批量探测（30 分钟缓存；force 强制刷新） */
    const probeBatch = useCallback(async (servers: ServerEntry[], force = false) => {
        const now = Date.now();
        const targets = force
            ? servers
            : servers.filter(s => {
                const cached = cacheRef.current[s.server];
                return !cached || now - cached.updatedAt > CACHE_TTL_MS;
            });
        if (targets.length === 0) return;

        setIsBatchProbing(true);
        try {
            const query = targets.map(s => s.server).join(',');
            const res = await fetch(`/api/jiance?servers=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (Array.isArray(data.results)) {
                commitStatus(
                    data.results.map((item: { server: string; status: number; ping: number; msg: string }) => ({
                        server: item.server,
                        item: { status: item.status, ping: item.ping, msg: item.msg, updatedAt: Date.now() },
                    }))
                );
            }
        } catch (e) {
            console.warn('批量探测失败', e);
        } finally {
            setIsBatchProbing(false);
        }
    }, [commitStatus]);

    /** 选定服的高频轮询探测 */
    const probeSelected = useCallback(async (target: ServerEntry, opts: { silent?: boolean } = {}) => {
        try {
            const res = await fetch(`/api/jiance?server=${encodeURIComponent(target.server)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const content = data.content;
            if (!content) return;

            commitStatus([
                { server: target.server, item: { status: content.status, ping: content.ping, msg: content.msg, updatedAt: Date.now() } },
            ]);

            if (content.status === 1) {
                if (!opts.silent) playSuccessChime();
                pushLog(target.name, 'online', `已开服 · 响应 ${content.ping}ms`);
                setIsProbing(false);
            } else {
                pushLog(target.name, 'offline', '维护中 · 29000 网关未放行');
            }
        } catch {
            pushLog(target.name, 'error', '探测超时，继续轮询重试');
        }
    }, [commitStatus, playSuccessChime, pushLog]);

    const visibleServers = useMemo(() => {
        if (view.kind === 'new') {
            return ALL_SERVERS
                .filter(s => s.isNew)
                .sort((a, b) => new Date(b.openAt || 0).getTime() - new Date(a.openAt || 0).getTime());
        }
        if (view.kind === 'fav') {
            return ALL_SERVERS.filter(s => favorites.includes(s.server));
        }
        const zone = SERVER_ZONES.find(z => z.zhanQu === view.zhanQu);
        return zone ? zone.servers.map(s => ({ ...s, zhanQu: zone.zhanQu })) : [];
    }, [view, favorites]);

    // 切换视图自动补齐未探测的服
    useEffect(() => {
        if (visibleServers.length === 0) return;
        probeBatch(visibleServers, false);
    }, [visibleServers, probeBatch]);

    // 选定服轮询
    useEffect(() => {
        if (!isProbing) {
            if (timerRef.current) window.clearInterval(timerRef.current);
            return;
        }
        probeSelected(selected, { silent: false });
        timerRef.current = window.setInterval(() => probeSelected(selected, { silent: false }), PROBE_INTERVAL_MS);
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, [isProbing, selected, probeSelected]);

    const toggleFavorite = (server: string) => {
        setFavorites(prev => {
            const next = prev.includes(server) ? prev.filter(s => s !== server) : [...prev, server];
            try {
                localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });
    };

    const handleSelect = (srv: ServerEntry) => {
        setSelected(srv);
        if (statusMap[srv.server]?.status === 1) setIsProbing(false);
    };

    const handleToggleProbing = () => {
        if (isProbing) {
            setIsProbing(false);
            return;
        }
        if (statusMap[selected.server]?.status === 1) {
            probeSelected(selected, { silent: false });
            return;
        }
        setIsProbing(true);
    };

    const onlineCount = ALL_SERVERS.filter(s => statusMap[s.server]?.status === 1).length;
    const offlineCount = ALL_SERVERS.filter(s => statusMap[s.server]?.status === 0).length;
    const newCount = ALL_SERVERS.filter(s => s.isNew).length;
    const activeLabel = view.kind === 'new' ? '新服推荐' : view.kind === 'fav' ? '常驻关注' : view.zhanQu;
    const selectedStatus = statusMap[selected.server];
    const selectedOpen = openInfo(selected.openAt);
    const selectedHistory = (pingHistory[selected.server] || []).slice(-28);

    const railItemCls = (active: boolean, extra?: string) =>
        clsx(
            'text-left px-2.5 py-[7px] rounded-md text-[13px] transition-colors flex items-center justify-between gap-2 border',
            active
                ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 font-bold'
                : 'border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200',
            extra ?? 'w-full'
        );

    const renderCard = (srv: ServerEntry) => {
        const isSelected = selected.server === srv.server;
        const isFav = favorites.includes(srv.server);
        const st = statusMap[srv.server];
        const tier = st && st.status === 1 ? pingTier(st.ping) : null;
        const open = openInfo(srv.openAt);
        // 已能连上就别再显示「今日 12:00 开服」，避免同一张卡自相矛盾
        const openText = open && !(st?.status === 1 && open.pending) ? open : null;
        // 状态条：条越长＝延迟越低（100ms 以上开始明显变短），维护中/未探测给保底短条
        const barPct = st && st.status === 1
            ? Math.round(Math.max(16, 100 - (Math.min(st.ping, 220) / 220) * 100))
            : 8;
        const barCls = !st
            ? 'bg-slate-700'
            : st.status === 0
                ? 'bg-slate-600'
                : st.ping < 60 ? 'bg-emerald-500' : st.ping < 120 ? 'bg-emerald-400' : st.ping < 200 ? 'bg-amber-400' : 'bg-rose-500';

        return (
            <button
                key={`${srv.zhanQu}-${srv.server}`}
                type="button"
                onClick={() => handleSelect(srv)}
                onDoubleClick={() => {
                    handleSelect(srv);
                    setIsProbing(true);
                }}
                className={clsx(
                    'group relative text-left rounded-[4px] border px-3 pt-2.5 pb-[16px] pr-8 transition-colors h-full flex flex-col justify-between overflow-hidden select-none cursor-pointer',
                    isSelected
                        ? 'bg-cyan-500/12 border-cyan-500/70'
                        : 'bg-slate-950/60 border-slate-700/80 hover:bg-slate-900/80 hover:border-slate-500'
                )}
                title={srv.aliases.length > 1 ? srv.aliases.join(' / ') : srv.name}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={clsx('text-[13px] font-bold truncate', isSelected ? 'text-cyan-200' : 'text-slate-100')}>
                        {srv.name}
                    </span>
                    {srv.aliases.length > 1 && (
                        <span className="shrink-0 text-[10px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700/80">
                            合{srv.aliases.length}
                        </span>
                    )}
                </div>

                <div className="flex items-baseline gap-2 leading-none min-w-0">
                    {st && st.status === 1 && tier ? (
                        <>
                            <span className={clsx('font-mono font-bold text-[12px] shrink-0', tier.cls)}>{st.ping}ms</span>
                            <span className={clsx('text-[11px] shrink-0', tier.cls)}>{tier.label}</span>
                        </>
                    ) : st && st.status === 0 ? (
                        <span className="text-[11px] text-slate-400 shrink-0">维护中</span>
                    ) : (
                        <span className="text-[11px] text-slate-500 shrink-0">{isBatchProbing ? '检测中…' : '待检测'}</span>
                    )}
                    {openText && (
                        <span className={clsx('text-[11px] truncate', openText.pending ? 'text-rose-300/90' : 'text-slate-500')}>
                            {openText.pending ? openText.text : `· ${openText.text}`}
                        </span>
                    )}
                </div>

                {/* 底部状态条：长度＝延迟表现 */}
                <span className="absolute left-3 right-3 bottom-[7px] h-[4px] rounded-full bg-slate-800/90 overflow-hidden">
                    <span
                        className={clsx('block h-full rounded-full transition-[width] duration-500', barCls)}
                        style={{ width: `${barPct}%` }}
                    />
                </span>

                {showNewBadge(srv.openAt) && (
                    <span className="absolute top-0 right-0 w-[22px] h-[15px] bg-rose-600/90 text-[10px] leading-[15px] text-center text-white font-bold">
                        新
                    </span>
                )}

                <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(srv.server);
                    }}
                    className={clsx(
                        'absolute right-1.5 bottom-[16px] p-0.5 transition-opacity cursor-pointer',
                        isFav ? 'text-amber-400' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                    )}
                    title={isFav ? '取消关注' : '加入常驻关注'}
                >
                    <Star className={clsx('w-3.5 h-3.5', isFav && 'fill-amber-400')} />
                </span>
            </button>
        );
    };

    return (
        <div className="@container w-full max-w-[1560px] mx-auto flex flex-col gap-3 h-full min-h-[calc(100vh-200px)]">
            {/* 顶栏 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3.5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                        <Radio className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-100 leading-tight">诛仙3开服雷达监测</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {SERVER_ZONES.length} 大战区 · {ALL_SERVERS.length} 台服务器 · {onlineCount} 台已开服
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setSoundEnabled(v => !v)}
                        className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer',
                            soundEnabled
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        )}
                    >
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                        <span>提示音</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleProbing}
                        className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer',
                            isProbing
                                ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                                : 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/25'
                        )}
                    >
                        {isProbing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isProbing ? '停止监测' : '启动监测'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => probeBatch(visibleServers, true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                    >
                        <RefreshCw className={clsx('w-3.5 h-3.5', isBatchProbing && 'animate-spin')} />
                        <span>刷新</span>
                    </button>

                    {isSplitScreen && (
                        <div className="flex items-center gap-1 pl-2 border-l border-slate-700/80">
                            {onToggleMaximize && (
                                <button
                                    type="button"
                                    onClick={onToggleMaximize}
                                    className="p-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/80 cursor-pointer"
                                    title={isMaximized ? '还原分屏' : '最大化'}
                                >
                                    {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                </button>
                            )}
                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 rounded-md bg-slate-800/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/80 cursor-pointer"
                                    title="关闭工作区"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col @[880px]:flex-row gap-3 items-stretch flex-1 min-h-0">
                {/* 左栏：区服导航 */}
                <div className="self-stretch bg-slate-900/80 border border-slate-800/80 rounded-xl p-2 @[880px]:w-[178px] shrink-0 flex flex-col gap-1">
                    <div className="text-[11px] text-slate-500 px-2 pt-1 pb-1.5 tracking-wider">区服导航</div>

                    <button type="button" onClick={() => setView({ kind: 'new' })} className={railItemCls(view.kind === 'new')}>
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            新服推荐
                        </span>
                        <span className="text-[13px] font-mono text-rose-300/90">{newCount}</span>
                    </button>

                    <button type="button" onClick={() => setView({ kind: 'fav' })} className={railItemCls(view.kind === 'fav')}>
                        <span className="flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5" />
                            常驻关注
                        </span>
                        <span className="text-[13px] font-mono text-amber-300/90">{favorites.length}</span>
                    </button>

                    <div className="h-px bg-slate-800 my-1" />

                    <div className="flex flex-wrap @[880px]:flex-col gap-1">
                        {SERVER_ZONES.map(z => {
                            const active = view.kind === 'zone' && view.zhanQu === z.zhanQu;
                            const online = z.servers.filter(s => statusMap[s.server]?.status === 1).length;
                            const probed = z.servers.some(s => !!statusMap[s.server]);
                            return (
                                <button
                                    key={z.zhanQu}
                                    type="button"
                                    onClick={() => {
                                        setView({ kind: 'zone', zhanQu: z.zhanQu });
                                        if (z.servers[0]) setSelected({ ...z.servers[0], zhanQu: z.zhanQu });
                                    }}
                                    className={railItemCls(active, 'flex-1 min-w-[88px] @[880px]:flex-none @[880px]:w-full')}
                                >
                                    <span className="whitespace-nowrap">{z.zhanQu}</span>
                                    <span className={clsx('text-[13px] font-mono', !probed ? 'text-slate-500' : online > 0 ? 'text-emerald-400' : 'text-slate-400')}>
                                        {probed ? `${online}/${z.servers.length}` : z.servers.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 全服概览：撑住左栏底部的空白 */}
                    <div className="hidden @[880px]:flex mt-auto pt-2.5 border-t border-slate-800/80 flex-col gap-1 text-[12px]">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-slate-500">服务器总数</span>
                            <span className="font-mono text-slate-300">{ALL_SERVERS.length}</span>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-slate-500">已开服</span>
                            <span className="font-mono text-emerald-400">{onlineCount}</span>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-slate-500">维护中</span>
                            <span className="font-mono text-slate-400">{offlineCount}</span>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-slate-500">新服</span>
                            <span className="font-mono text-rose-300/90">{newCount}</span>
                        </div>
                    </div>
                </div>

                {/* 右侧主体 */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 shrink-0 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                            <div className="flex items-baseline gap-2 min-w-0">
                                <span className="text-[12px] font-bold text-slate-100">{activeLabel}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{visibleServers.length} 台</span>
                            </div>
                            <span className="text-[11px] text-slate-500">单击选中 · 双击监测 · 底部条越长延迟越低</span>
                        </div>

                        {visibleServers.length === 0 ? (
                            <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center gap-2 text-slate-500 text-[12px]">
                                <Heart className="w-5 h-5 text-slate-600" />
                                <span>{view.kind === 'fav' ? '还没有常驻关注，鼠标悬停卡片点星标添加' : '暂无数据'}</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 @[430px]:grid-cols-2 @[760px]:grid-cols-3 @[1180px]:grid-cols-4 auto-rows-[76px] gap-3 content-start">
                                {visibleServers.map(renderCard)}
                            </div>
                        )}
                    </div>

                    {/* 选中服详情：吃掉剩余高度，同时承载操作入口 */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shrink-0 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[17px] font-bold text-slate-100 leading-tight truncate">{selected.name}</span>
                                    {showNewBadge(selected.openAt) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600/90 text-white font-bold">新服</span>
                                    )}
                                    {selected.aliases.length > 1 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-slate-400">
                                            合 {selected.aliases.length} 服
                                        </span>
                                    )}
                                    {favorites.includes(selected.server) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300">
                                            常驻关注
                                        </span>
                                    )}
                                </div>
                                <div className="text-[12px] text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="text-slate-300">{selected.zhanQu}</span>
                                    {selectedOpen && (
                                        <span className={clsx(selectedOpen.pending ? 'text-rose-300/90' : 'text-slate-500')}>
                                            {selectedOpen.text}
                                        </span>
                                    )}
                                </div>
                                {selected.aliases.length > 1 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {selected.aliases.slice(1).map(alias => (
                                            <span
                                                key={alias}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-800 text-slate-400"
                                            >
                                                {alias}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="text-right shrink-0 whitespace-nowrap">
                                {selectedStatus?.status === 1 ? (
                                    <>
                                        <div className={clsx('text-[24px] font-black font-mono leading-none', pingTier(selectedStatus.ping).cls)}>
                                            {selectedStatus.ping}
                                            <span className="text-[12px] font-normal ml-0.5">ms</span>
                                        </div>
                                        <div className={clsx('text-[12px] mt-1.5', pingTier(selectedStatus.ping).cls)}>
                                            {pingTier(selectedStatus.ping).label}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-[24px] font-black font-mono leading-none text-slate-600">--</div>
                                        <div className="text-[12px] mt-1.5 text-slate-500">
                                            {selectedStatus ? '维护中' : '待检测'}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 心跳时序 */}
                        <div className="min-h-[40px] flex flex-col justify-end">
                            <div className="flex items-end gap-[3px] h-[36px]">
                                {selectedHistory.length === 0 ? (
                                    <span className="text-[12px] text-slate-500 self-center">开始监测后在此绘制延迟曲线</span>
                                ) : (
                                    selectedHistory.map((ping, idx) => {
                                        const h = ping === 0 ? 4 : Math.min(36, Math.max(6, Math.round((ping / 200) * 36)));
                                        const cls = ping === 0
                                            ? 'bg-slate-700'
                                            : ping < 60 ? 'bg-emerald-500/80' : ping < 120 ? 'bg-emerald-400/60' : ping < 200 ? 'bg-amber-400/80' : 'bg-rose-500/80';
                                        return <span key={idx} className={clsx('w-[5px] rounded-sm', cls)} style={{ height: `${h}px` }} />;
                                    })
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/80">
                            <button
                                type="button"
                                onClick={handleToggleProbing}
                                className={clsx(
                                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-bold border transition-colors cursor-pointer',
                                    isProbing
                                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                                        : 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/25'
                                )}
                            >
                                {isProbing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                {isProbing ? '停止监测' : '开始监测'}
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleFavorite(selected.server)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                            >
                                <Star className={clsx('w-3.5 h-3.5', favorites.includes(selected.server) && 'fill-amber-400 text-amber-400')} />
                                {favorites.includes(selected.server) ? '已关注' : '加关注'}
                            </button>
                        </div>
                    </div>

                    {/* 日志 */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 flex flex-col flex-1 min-h-[112px]">
                        <div className="flex items-center justify-between pb-1.5">
                            <span className="text-[12px] font-bold text-slate-300 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                                探测日志
                            </span>
                            {logs.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setLogs([])}
                                    className="text-[11px] px-2 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    清空
                                </button>
                            )}
                        </div>
                        <div className="flex-1 min-h-[64px] overflow-y-auto no-scrollbar flex flex-col gap-0.5">
                            {logs.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-[12px] text-slate-500">
                                    待命中 · 启动监测后心跳结果在此滚动
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="flex items-center gap-2 text-[12px] font-mono leading-5">
                                        <span className="text-slate-500 shrink-0">{log.time}</span>
                                        <span className="text-cyan-400 shrink-0 truncate max-w-[170px]">{log.serverName}</span>
                                        <span
                                            className={clsx(
                                                'truncate',
                                                log.status === 'online'
                                                    ? 'text-emerald-400'
                                                    : log.status === 'offline'
                                                        ? 'text-slate-400'
                                                        : 'text-rose-400'
                                            )}
                                        >
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
