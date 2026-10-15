import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Radio,
    Star,
    RefreshCw,
    Activity,
    CheckCircle2,
    AlertCircle,
    Volume2,
    VolumeX,
    Play,
    Pause,
    Wifi,
    Maximize2,
    Minimize2,
    X
} from 'lucide-react';
import clsx from 'clsx';

interface ServerInfo {
    name: string;
    server: string;
    serverId: string;
}

interface ZhanQu {
    zhanQu: string;
    servers: ServerInfo[];
}

const SERVER_CONFIG: ZhanQu[] = [
    {
        zhanQu: "体验服",
        servers: [
            { name: "先知", server: "xianzhi", serverId: "10086" },
            // { name: "不通", server: "butong", serverId: "10087" }
        ]
    },
    {
        zhanQu: "昊天战区",
        servers: [
            { name: "创世绮梦", server: "chuangshiqimeng", serverId: "517" },
            { name: "龙腾碧霄", server: "longtengbixiao", serverId: "519" },
            { name: "碧瑶(网通)", server: "biyaowangtong", serverId: "821" },
            { name: "雪琪(网通)", server: "xueqiwangtong", serverId: "2079" }
        ]
    },
    {
        zhanQu: "炎天战区",
        servers: [
            { name: "瑶梦故城", server: "yaomenggucheng", serverId: "525" },
            { name: "沧海琼音", server: "canghaiqiongyin", serverId: "2060" },
            { name: "夜羽凰踪", server: "yeyuhuangzong", serverId: "2027" },
            { name: "幻月冰心", server: "huanyuebingxin", serverId: "531" },
            { name: "皓月长生", server: "haoyuechangsheng", serverId: "545" }
        ]
    },
    {
        zhanQu: "阳天战区",
        servers: [
            { name: "决胜风云", server: "jueshengfengyun", serverId: "2064" },
            { name: "月舞江南", server: "yuewujiangnan", serverId: "2065" },
            { name: "独霸天关", server: "dubatianguan", serverId: "554" }
        ]
    },
    {
        zhanQu: "朱天战区",
        servers: [
            { name: "万毒行疆", server: "wanduxingjiang", serverId: "583" },
            { name: "瀚海潮歌", server: "hanhaichaoge", serverId: "811" },
            { name: "掣马凌霄", server: "chemalingxiao", serverId: "514" },
            { name: "剑啸青锋", server: "jianxiaoqingfeng", serverId: "2088" }
        ]
    },
    {
        zhanQu: "幽天战区",
        servers: [
            { name: "云龙剑影", server: "yunlongjianying", serverId: "990" },
            { name: "龙战乾坤", server: "longzhanqiankun", serverId: "947" },
            { name: "十载仙梦", server: "shizaixianmeng", serverId: "2051" },
            { name: "九天奇缘", server: "jiutianqiyuan", serverId: "2008" },
            { name: "万里河山", server: "wanliheshan", serverId: "968" }
        ]
    },
    {
        zhanQu: "变天战区",
        servers: [
            { name: "星耀至尊", server: "xingyaozhizun", serverId: "581" },
            { name: "剑尊鸿威", server: "jianzunhongwei", serverId: "822" },
            { name: "雷龙耀世", server: "leilongyaoshi", serverId: "513" },
            { name: "烽火流年", server: "fenghuoliunian", serverId: "804" },
            { name: "金龙碧海", server: "jinlongbihai", serverId: "541" },
            { name: "碧瑶(电信)", server: "biyao", serverId: "847" }
        ]
    },
    {
        zhanQu: "苍天战区",
        servers: [
            { name: "紫电荣光", server: "zidianrongguang", serverId: "527" },
            { name: "霜雪玉龙", server: "shuangxueyulong", serverId: "507" },
            { name: "承天问影", server: "chengtianwenying", serverId: "550" },
            { name: "幻月御风", server: "huanyueyufeng", serverId: "502" }
        ]
    },
    {
        zhanQu: "扶风战区",
        servers: [
            { name: "大竹峰", server: "dazhufeng", serverId: "819" },
            { name: "小竹峰", server: "xiaozhufeng", serverId: "546" },
            { name: "滴血洞", server: "dixuedong", serverId: "2089" }
        ]
    }
];

const FAVORITES_KEY = 'zx_server_radar_favorites';
const STATUS_CACHE_KEY = 'zx_server_radar_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟缓存置状态

export interface ServerStatusItem {
    status: number; // 1: 在线, 0: 维护中
    ping: number;   // 延迟 (ms)
    msg: string;
    updatedAt: number; // 探测时间戳 (ms)
}

interface ProbeLog {
    id: string;
    time: string;
    serverName: string;
    status: 'online' | 'offline' | 'unstable' | 'error';
    ping?: number;
    message: string;
}

const loadStatusCache = (): Record<string, ServerStatusItem> => {
    try {
        const raw = localStorage.getItem(STATUS_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const saveStatusCache = (map: Record<string, ServerStatusItem>) => {
    try {
        localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(map));
    } catch (e) {
        console.warn('Failed to save radar cache:', e);
    }
};

export interface ServerRadarViewProps {
    isSplitScreen?: boolean;
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    onClose?: () => void;
}

export const ServerRadarView: React.FC<ServerRadarViewProps> = ({
    isSplitScreen = false,
    isMaximized = false,
    onToggleMaximize,
    onClose,
}) => {
    const [selectedZhanQuIndex, setSelectedZhanQuIndex] = useState<number>(1); // 默认昊天战区
    const [selectedServer, setSelectedServer] = useState<ServerInfo>(SERVER_CONFIG[1].servers[1]); // 默认龙腾碧霄
    const [isProbing, setIsProbing] = useState<boolean>(false);
    const [isBatchProbing, setIsBatchProbing] = useState<boolean>(false);
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '["519", "517"]');
        } catch {
            return ['519', '517'];
        }
    });

    // 记录各服务器状态与探测缓存（30分钟单次探测持久化）
    const [serverStatusMap, setServerStatusMap] = useState<Record<string, ServerStatusItem>>(() => loadStatusCache());

    const [currentStatus, setCurrentStatus] = useState<'unknown' | 'online' | 'offline' | 'unstable' | 'error'>('unknown');
    const [logs, setLogs] = useState<ProbeLog[]>([]);

    const timerRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // 收藏切换
    const toggleFavorite = (serverId: string) => {
        setFavorites(prev => {
            const next = prev.includes(serverId)
                ? prev.filter(id => id !== serverId)
                : [...prev, serverId];
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
            return next;
        });
    };

    // 原生 Web Audio 提示音（开服清脆三音阶）
    const playSuccessChime = () => {
        if (!soundEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = audioCtxRef.current || new AudioContextClass();
            audioCtxRef.current = ctx;

            const now = ctx.currentTime;
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                gain.gain.setValueAtTime(0.3, now + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 0.4);
            });
        } catch (e) {
            console.warn('Audio chime error:', e);
        }
    };

    // 战区单次批量探测并缓存（30分钟或1小时置状态）
    const probeZoneBatch = useCallback(async (servers: ServerInfo[], force = false) => {
        const now = Date.now();
        const targetsToProbe = force
            ? servers
            : servers.filter(s => {
                const cached = serverStatusMap[s.server];
                return !cached || (now - cached.updatedAt > CACHE_TTL_MS);
            });

        if (targetsToProbe.length === 0) return;

        setIsBatchProbing(true);
        try {
            const serverQuery = targetsToProbe.map(s => s.server).join(',');
            const res = await fetch(`/api/jiance?servers=${encodeURIComponent(serverQuery)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.results && Array.isArray(data.results)) {
                setServerStatusMap(prev => {
                    const next = { ...prev };
                    data.results.forEach((item: { server: string; status: number; ping: number; msg: string }) => {
                        next[item.server] = {
                            status: item.status,
                            ping: item.ping,
                            msg: item.msg,
                            updatedAt: now
                        };
                    });
                    saveStatusCache(next);
                    return next;
                });
            }
        } catch (e) {
            console.warn('Batch probe error:', e);
        } finally {
            setIsBatchProbing(false);
        }
    }, [serverStatusMap]);

    // 切换战区时自动批量探测未缓存或过期的服务器
    useEffect(() => {
        const activeServers = SERVER_CONFIG[selectedZhanQuIndex].servers;
        probeZoneBatch(activeServers, false);
    }, [selectedZhanQuIndex, probeZoneBatch]);

    // 单独针对选定区服的高频探测
    const probeSelectedServer = useCallback(async (silent = false) => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const logId = `${Date.now()}-${Math.random()}`;

        try {
            const res = await fetch(`/api/jiance?server=${encodeURIComponent(selectedServer.server)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const content = data.content;

            if (content) {
                const isOnline = content.status === 1;
                setCurrentStatus(isOnline ? 'online' : 'offline');

                // 同步刷新本地缓存
                setServerStatusMap(prev => {
                    const next = {
                        ...prev,
                        [selectedServer.server]: {
                            status: content.status,
                            ping: content.ping,
                            msg: content.msg,
                            updatedAt: Date.now()
                        }
                    };
                    saveStatusCache(next);
                    return next;
                });

                if (isOnline) {
                    if (!silent) playSuccessChime();
                    setLogs(prev => [
                        {
                            id: logId,
                            time: timeStr,
                            serverName: selectedServer.name,
                            status: 'online',
                            ping: content.ping,
                            message: `已开服！响应延迟 ${content.ping}ms，官方通道通畅 (已完成监测)`
                        },
                        ...prev.slice(0, 49)
                    ]);
                    // 服务器状态正常/已开服，立即自动停止持续轮询监测（与小木匠开服即止逻辑一致）
                    setIsProbing(false);
                } else {
                    setLogs(prev => [
                        {
                            id: logId,
                            time: timeStr,
                            serverName: selectedServer.name,
                            status: 'offline',
                            ping: content.ping,
                            message: '维护中（官方网关端口 29000 未放行）'
                        },
                        ...prev.slice(0, 49)
                    ]);
                }
            }
        } catch (err) {
            setCurrentStatus('error');
            setLogs(prev => [
                {
                    id: logId,
                    time: timeStr,
                    serverName: selectedServer.name,
                    status: 'error',
                    message: '探测超时，正在持续轮询重连...'
                },
                ...prev.slice(0, 49)
            ]);
        }
    }, [selectedServer, soundEnabled]);

    // 选定服务器高频雷达轮询控制（每 4 秒单次心跳）
    useEffect(() => {
        if (!isProbing) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        // 立即执行一次
        probeSelectedServer(false);

        // 持续探测选定服务器
        timerRef.current = window.setInterval(() => {
            probeSelectedServer(false);
        }, 4000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isProbing, probeSelectedServer]);

    // 选择服务器响应
    const handleSelectServer = (srv: ServerInfo) => {
        setSelectedServer(srv);
        const cached = serverStatusMap[srv.server];
        if (cached) {
            setCurrentStatus(cached.status === 1 ? 'online' : 'offline');
        } else {
            setCurrentStatus('unknown');
        }
    };

    const handleToggleProbing = () => {
        if (isProbing) {
            setIsProbing(false);
            return;
        }

        const cached = serverStatusMap[selectedServer.server];
        if (cached && cached.status === 1) {
            // 已开服状态：仅执行一次单次探测校验，无需启动持续轮询
            probeSelectedServer(false);
            return;
        }

        setIsProbing(true);
    };

    const activeZhanQu = SERVER_CONFIG[selectedZhanQuIndex];

    return (
        <div className="flex flex-col gap-5 max-w-[1500px] mx-auto w-full">
            {/* 顶栏标题与控制栏 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                        <Radio className="w-6 h-6 animate-pulse text-cyan-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-100 tracking-wide">
                                诛仙3开服雷达监测
                            </h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
                                {/* <Zap className="w-3 h-3 text-cyan-400" /> */}
                                <span>直连</span>
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            全区状态扫描 · 秒级雷达监测 · 开服声音提醒
                        </p>
                    </div>
                </div>

                {/* 快捷操作控件 */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer',
                            soundEnabled
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                        )}
                        title="开服时播放提示音"
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        <span>{soundEnabled ? '提示音开' : '提示音关'}</span>
                    </button>

                    <button
                        onClick={handleToggleProbing}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-lg cursor-pointer',
                            isProbing
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-rose-500/20 animate-pulse'
                                : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-cyan-500/20 hover:bg-cyan-500/30'
                        )}
                    >
                        {isProbing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isProbing ? '停止监测' : '启动监测'}</span>
                    </button>

                    {/* 分屏工作区原生视窗控制按钮（零遮挡、零垂直空间浪费） */}
                    {isSplitScreen && (
                        <div className="flex items-center gap-1.5 pl-2.5 ml-1 border-l border-slate-700/80">
                            {onToggleMaximize && (
                                <button
                                    type="button"
                                    onClick={onToggleMaximize}
                                    className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors border border-slate-700/80 shadow-sm cursor-pointer"
                                    title={isMaximized ? '还原分屏' : '最大化工作区'}
                                    aria-label={isMaximized ? '还原分屏' : '最大化工作区'}
                                >
                                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                            )}
                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors border border-slate-700/80 shadow-sm cursor-pointer"
                                    title="关闭右侧工作区"
                                    aria-label="关闭工作区"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 我的常驻关注快捷栏 */}
            {favorites.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                    <span className="text-amber-400 font-bold flex items-center gap-1 pl-1 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>常驻关注:</span>
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {SERVER_CONFIG.flatMap(zq => zq.servers)
                            .filter(s => favorites.includes(s.serverId))
                            .map(favSrv => {
                                const isSelected = selectedServer.serverId === favSrv.serverId;
                                const favStatus = serverStatusMap[favSrv.server];

                                return (
                                    <button
                                        key={favSrv.serverId}
                                        onClick={() => handleSelectServer(favSrv)}
                                        className={clsx(
                                            'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                                            isSelected
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                                : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                                        )}
                                    >
                                        <span>{favSrv.name}</span>
                                        {favStatus ? (
                                            <span className={clsx(
                                                'w-1.5 h-1.5 rounded-full',
                                                favStatus.status === 1 ? 'bg-emerald-400' : 'bg-slate-500'
                                            )} />
                                        ) : null}
                                        {isSelected && isProbing && (
                                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* 核心面板：1:1 游戏原生战区与服务器布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 左侧：战区列表 (3列) */}
                <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-3 py-1">
                        <span className="text-xs text-slate-400 font-bold">选择战区</span>
                        <span className="text-[10px] text-slate-500 font-mono">共 9 大战区</span>
                    </div>

                    {SERVER_CONFIG.map((zq, idx) => {
                        const isActive = selectedZhanQuIndex === idx;
                        const onlineCount = zq.servers.filter(s => serverStatusMap[s.server]?.status === 1).length;
                        const probedCount = zq.servers.filter(s => !!serverStatusMap[s.server]).length;

                        return (
                            <button
                                key={zq.zhanQu}
                                onClick={() => setSelectedZhanQuIndex(idx)}
                                className={clsx(
                                    'px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer',
                                    isActive
                                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-md'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                )}
                            >
                                <span>{zq.zhanQu}</span>
                                <div className="flex items-center gap-1.5">
                                    {probedCount > 0 && (
                                        <span className={clsx(
                                            'text-[10px] font-mono px-1.5 py-0.2 rounded',
                                            onlineCount > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                                        )}>
                                            {onlineCount > 0 ? `${onlineCount}开服` : '维护'}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-mono opacity-60">
                                        {zq.servers.length} 个服务器
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* 中间：区服选择网格与当前监测状态卡片 (6列) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                    {/* 区服选择网格 */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-200">
                                    {activeZhanQu.zhanQu} · 服务器列表
                                </span>
                                {isBatchProbing && (
                                    <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-mono">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span>检测本区中...</span>
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => probeZoneBatch(activeZhanQu.servers, true)}
                                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="手动刷新当前战区所有服务器状态"
                            >
                                <RefreshCw className={clsx("w-3 h-3", isBatchProbing && "animate-spin")} />
                                <span>刷新本区状态</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {activeZhanQu.servers.map(srv => {
                                const isSelected = selectedServer.serverId === srv.serverId;
                                const isFav = favorites.includes(srv.serverId);
                                const statusItem = serverStatusMap[srv.server];

                                return (
                                    <div
                                        key={srv.serverId}
                                        onClick={() => handleSelectServer(srv)}
                                        className={clsx(
                                            'p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2 select-none relative group',
                                            isSelected
                                                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/40'
                                                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={clsx(
                                                'font-black text-xs sm:text-sm',
                                                isSelected ? 'text-cyan-300' : 'text-slate-200'
                                            )}>
                                                {srv.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(srv.serverId);
                                                }}
                                                className="text-slate-600 hover:text-amber-400 cursor-pointer"
                                            >
                                                <Star className={clsx(
                                                    'w-3.5 h-3.5',
                                                    isFav ? 'fill-amber-400 text-amber-400' : ''
                                                )} />
                                            </button>
                                        </div>

                                        {/* 状态徽标与延迟 */}
                                        <div className="flex items-center justify-between text-[10px]">
                                            {statusItem ? (
                                                statusItem.status === 1 ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        <span>已开服 {statusItem.ping}ms</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                                        <span>维护中</span>
                                                    </span>
                                                )
                                            ) : isBatchProbing ? (
                                                <span className="inline-flex items-center gap-1 text-cyan-400 font-mono">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                                    <span>检测中...</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-600">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                                    <span>待置状态</span>
                                                </span>
                                            )}

                                            {/* <span className="text-slate-500 font-mono text-[9px]">
                                                {srv.server}
                                            </span> */}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 聚焦监测大卡片 */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs text-slate-400">雷达监测目标:</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <h3 className="text-xl font-black text-slate-100">
                                        {selectedServer.name}
                                    </h3>
                                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                        {activeZhanQu.zhanQu}
                                    </span>
                                    {/* <span className="text-xs font-mono text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                                        {selectedServer.server}.link.zhuxian.com.cn:29000
                                    </span> */}
                                </div>
                            </div>

                            {/* 状态大徽章 */}
                            <div className="flex items-center gap-2">
                                {currentStatus === 'online' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-sm shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>已开服 (可登录)</span>
                                    </div>
                                )}
                                {currentStatus === 'offline' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>维护中 / 未开服</span>
                                    </div>
                                )}
                                {currentStatus === 'error' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-sm">
                                        <Activity className="w-4 h-4" />
                                        <span>探测超时 / 重试中</span>
                                    </div>
                                )}
                                {currentStatus === 'unknown' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs">
                                        <span>点击开始雷达监测</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                                <span>探测完美世界官方心跳</span>
                            </span>
                            <button
                                onClick={() => probeSelectedServer(false)}
                                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>立即单次检测</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧：实时日志流 (3列) */}
                <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 max-h-[640px]">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            <span>雷达探测日志</span>
                        </span>
                        {logs.length > 0 && (
                            <button
                                onClick={() => setLogs([])}
                                className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                                清空
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar min-h-[300px]">
                        {logs.length === 0 ? (
                            <div className="text-center py-16 text-slate-600 text-xs flex flex-col items-center gap-2">
                                <Radio className="w-6 h-6 text-slate-700 animate-pulse" />
                                <span>雷达待命，开启监测后将在此实时显示结果</span>
                            </div>
                        ) : (
                            logs.map(log => (
                                <div
                                    key={log.id}
                                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono flex flex-col gap-0.5"
                                >
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                        <span>{log.time}</span>
                                        <span className={clsx(
                                            'font-bold',
                                            log.status === 'online' ? 'text-emerald-400' :
                                                log.status === 'offline' ? 'text-slate-400' :
                                                    log.status === 'unstable' ? 'text-purple-400' : 'text-rose-400'
                                        )}>
                                            {log.serverName}
                                        </span>
                                    </div>
                                    <div className={clsx(
                                        'text-xs font-sans font-medium',
                                        log.status === 'online' ? 'text-emerald-300' : 'text-slate-300'
                                    )}>
                                        {log.message}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 底部信息标注 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                    {/* <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>心跳探测源自完美世界官方网络链路 · 协议数据参考 诛仙3 官方网关 · 界面与体验设计：星耀-萝卜</span> */}
                </div>
                <div className="flex items-center gap-3">
                    {/* <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>30分钟轮巡置状态</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-cyan-400">
                        <Zap className="w-3 h-3" />
                        <span>4秒高频独占雷达</span>
                    </span> */}
                </div>
            </div>
        </div>
    );
};
