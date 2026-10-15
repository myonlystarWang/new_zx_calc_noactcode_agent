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
                            message: `已开服！响应延迟 ${content.ping}ms，官方通道通畅！`
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

    // 选择服务器响应（强化双向联动：自动定位并切换对应战区）
    const handleSelectServer = (srv: ServerInfo) => {
        setSelectedServer(srv);
        // 自动计算该服务器真实所属战区，并同步激活左侧大区选中态
        const targetZqIndex = SERVER_CONFIG.findIndex(zq => zq.servers.some(s => s.serverId === srv.serverId));
        if (targetZqIndex !== -1 && targetZqIndex !== selectedZhanQuIndex) {
            setSelectedZhanQuIndex(targetZqIndex);
        }
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
    // 获取当前聚焦服务器的真实战区名称，杜绝跨战区异步错位
    const currentServerZhanQu = SERVER_CONFIG.find(zq => zq.servers.some(s => s.serverId === selectedServer.serverId))?.zhanQu || activeZhanQu.zhanQu;

    return (
        <div className="flex flex-col gap-4 max-w-[1560px] mx-auto w-full">
            {/* 顶栏标题与控制栏 */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 sm:p-4.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                        <Radio className="w-5 h-5 animate-pulse text-cyan-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-100 tracking-wide">
                                诛仙3开服雷达监测
                            </h2>
                            {/* <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
                                <span>官方29000网关直连</span>
                            </span> */}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            全区状态扫描 · 秒级独占雷达 · 开服声光提醒
                        </p>
                    </div>
                </div>

                {/* 快捷操作控件 */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none',
                            soundEnabled
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        )}
                        title="开服时播放提示音"
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                        <span>{soundEnabled ? '提示音开' : '提示音关'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleProbing}
                        className={clsx(
                            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-lg cursor-pointer select-none',
                            isProbing
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-rose-500/20 animate-pulse'
                                : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 text-cyan-300 shadow-cyan-500/15 hover:from-cyan-500/30 hover:to-blue-500/30'
                        )}
                    >
                        {isProbing ? <Pause className="w-4 h-4 text-rose-400" /> : <Play className="w-4 h-4 text-cyan-400" />}
                        <span>{isProbing ? '停止监测' : '启动监测'}</span>
                    </button>

                    {/* 分屏工作区原生视窗控制按钮 */}
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

            {/* 我的常驻关注快捷栏（带多层深度联动指示） */}
            {favorites.length > 0 && (
                <div className="flex items-center gap-2.5 bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-slate-800/80 text-xs shadow-md backdrop-blur-sm">
                    <span className="text-amber-400 font-bold flex items-center gap-1.5 pl-0.5 shrink-0 select-none">
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
                                        type="button"
                                        onClick={() => handleSelectServer(favSrv)}
                                        className={clsx(
                                            'px-3 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer whitespace-nowrap select-none',
                                            isSelected
                                                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40'
                                                : 'bg-slate-800/80 border-slate-700/70 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100'
                                        )}
                                    >
                                        <span>{favSrv.name}</span>
                                        {favStatus ? (
                                            <span className={clsx(
                                                'w-1.5 h-1.5 rounded-full',
                                                favStatus.status === 1 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-500'
                                            )} />
                                        ) : null}
                                        {isSelected && isProbing && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* 核心等高战备仪表板：左(战区)、中(矩阵+雷达)、右(实时遥测)，严格底平齐等高 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-[580px] lg:h-[calc(100vh-235px)] lg:max-h-[760px]">
                {/* 左侧：战区选择导航轨 (3列，撑满等高) */}
                <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-xl backdrop-blur-sm h-full">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-800/80">
                            <span className="text-xs text-slate-400 font-bold tracking-wide">战区选择</span>
                            <span className="text-[11px] text-slate-500 font-mono">共 9 大战区</span>
                        </div>

                        <div className="flex flex-col gap-1.5 flex-1 justify-between">
                            {SERVER_CONFIG.map((zq, idx) => {
                                const isActive = selectedZhanQuIndex === idx;
                                const onlineCount = zq.servers.filter(s => serverStatusMap[s.server]?.status === 1).length;
                                const probedCount = zq.servers.filter(s => !!serverStatusMap[s.server]).length;

                                return (
                                    <button
                                        key={zq.zhanQu}
                                        type="button"
                                        onClick={() => setSelectedZhanQuIndex(idx)}
                                        className={clsx(
                                            'px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer select-none border',
                                            isActive
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                                                : 'bg-slate-950/40 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                                        )}
                                    >
                                        <span className="tracking-wide">{zq.zhanQu}</span>
                                        <div className="flex items-center gap-1.5">
                                            {probedCount > 0 && (
                                                <span className={clsx(
                                                    'text-[10px] font-mono px-1.5 py-0.5 rounded font-bold',
                                                    onlineCount > 0
                                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                                                )}>
                                                    {onlineCount > 0 ? `${onlineCount}服在线` : '维护中'}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-mono opacity-50">
                                                {zq.servers.length}服
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 底部全服统计微栏 */}
                    <div className="pt-3 mt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between px-1">
                        <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            <span>战区监控雷达</span>
                        </span>
                        <span className="font-mono text-cyan-400/80 font-bold">33组服务器在线</span>
                    </div>
                </div>

                {/* 中间：区服选择矩阵 + 雷达中控台 (6列，整齐上下撑满) */}
                <div className="lg:col-span-6 flex flex-col justify-between gap-4 h-full">
                    {/* 上部：战区服务器矩阵 */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl flex-1 flex flex-col backdrop-blur-sm min-h-[300px]">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-200 tracking-wide">
                                    {activeZhanQu.zhanQu} · 服务器列表
                                </span>
                                {isBatchProbing && (
                                    <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-mono font-bold">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span>全区探测中...</span>
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => probeZoneBatch(activeZhanQu.servers, true)}
                                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30"
                                title="立即手动刷新当前战区全部服务器状态"
                            >
                                <RefreshCw className={clsx("w-3.5 h-3.5", isBatchProbing && "animate-spin")} />
                                <span>刷新本区状态</span>
                            </button>
                        </div>

                        {/* 规格化网格排版：固定规范卡片，自适应充满 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 content-start">
                            {activeZhanQu.servers.map(srv => {
                                const isSelected = selectedServer.serverId === srv.serverId;
                                const isFav = favorites.includes(srv.serverId);
                                const statusItem = serverStatusMap[srv.server];

                                return (
                                    <div
                                        key={srv.serverId}
                                        onClick={() => handleSelectServer(srv)}
                                        className={clsx(
                                            'p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 select-none relative group h-[88px]',
                                            isSelected
                                                ? 'bg-gradient-to-br from-cyan-950/60 to-slate-900 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-2 ring-cyan-500/50'
                                                : 'bg-slate-950/50 border-slate-800/90 hover:bg-slate-800/50 hover:border-slate-700'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={clsx(
                                                'font-black text-xs sm:text-sm tracking-wide',
                                                isSelected ? 'text-cyan-300 font-bold' : 'text-slate-200'
                                            )}>
                                                {srv.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(srv.serverId);
                                                }}
                                                className="text-slate-600 hover:text-amber-400 p-0.5 cursor-pointer transition-colors"
                                                title={isFav ? '取消关注' : '加入常驻关注'}
                                            >
                                                <Star className={clsx(
                                                    'w-4 h-4',
                                                    isFav ? 'fill-amber-400 text-amber-400' : 'hover:text-slate-400'
                                                )} />
                                            </button>
                                        </div>

                                        {/* 状态徽标与延迟 */}
                                        <div className="flex items-center justify-between text-[11px]">
                                            {statusItem ? (
                                                statusItem.status === 1 ? (
                                                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        <span>已开服 {statusItem.ping}ms</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                                        <span>维护中</span>
                                                    </span>
                                                )
                                            ) : isBatchProbing ? (
                                                <span className="inline-flex items-center gap-1 text-cyan-400 font-mono text-[10px]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                                    <span>检测中...</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-500 text-[10px]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                                    <span>待置状态</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 下部：聚焦雷达中枢主控台 (固定高度，极具质感) */}
                    <div className="bg-gradient-to-r from-slate-900/95 via-slate-900 to-slate-950 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between shrink-0 h-[148px]">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[11px] text-slate-400 font-medium">当前锁定监测目标:</span>
                                <div className="flex items-center gap-2.5 mt-1">
                                    <h3 className="text-xl font-black text-slate-100 tracking-wide">
                                        {selectedServer.name}
                                    </h3>
                                    <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded-lg border border-cyan-800/60 shadow-sm">
                                        {currentServerZhanQu}
                                    </span>
                                </div>
                            </div>

                            {/* 状态主徽章 */}
                            <div className="flex items-center gap-2">
                                {currentStatus === 'online' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-xs sm:text-sm shadow-[0_0_15px_rgba(16,185,129,0.35)]">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span>已开服 (可正常登录)</span>
                                    </div>
                                )}
                                {currentStatus === 'offline' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300 font-bold text-xs sm:text-sm">
                                        <AlertCircle className="w-4 h-4 text-slate-400" />
                                        <span>维护中 / 未开服</span>
                                    </div>
                                )}
                                {currentStatus === 'error' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-xs sm:text-sm shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                                        <Activity className="w-4 h-4 text-rose-400 animate-spin" />
                                        <span>探测超时 / 重试中</span>
                                    </div>
                                )}
                                {currentStatus === 'unknown' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-400 text-xs font-medium">
                                        <span>点击开始雷达监测</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 控制工具条 */}
                        <div className="pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                                <span>完美官方网关 29000 端口心跳</span>
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => probeSelectedServer(false)}
                                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>立即单次检测</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右侧：实时日志流 (3列，撑满等高，与左/中底边绝对平齐) */}
                <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl backdrop-blur-sm h-full">
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800/80">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            <span>雷达探测日志</span>
                        </span>
                        {logs.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setLogs([])}
                                className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                                清空
                            </button>
                        )}
                    </div>

                    {/* 滚动容器 */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {logs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-16 text-slate-500 text-xs gap-3">
                                <div className="relative flex items-center justify-center w-14 h-14">
                                    <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping opacity-75" />
                                    <div className="absolute inset-2 rounded-full border border-cyan-500/40" />
                                    <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
                                </div>
                                <span className="text-slate-400 font-medium">雷达站就绪待命</span>
                                <span className="text-[11px] text-slate-600 text-center max-w-[200px]">
                                    开启监测或单次检测后，毫秒心跳结果将在此实时滚屏播报
                                </span>
                            </div>
                        ) : (
                            logs.map(log => (
                                <div
                                    key={log.id}
                                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs font-mono flex flex-col gap-1 shadow-sm"
                                >
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                        <span className="font-mono">{log.time}</span>
                                        <span className={clsx(
                                            'font-bold px-1.5 py-0.2 rounded',
                                            log.status === 'online' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                                log.status === 'offline' ? 'bg-slate-800 text-slate-400' :
                                                    log.status === 'unstable' ? 'bg-purple-500/20 text-purple-400' : 'bg-rose-500/20 text-rose-400'
                                        )}>
                                            {log.serverName}
                                        </span>
                                    </div>
                                    <div className={clsx(
                                        'text-xs font-sans font-medium leading-relaxed',
                                        log.status === 'online' ? 'text-emerald-300' : 'text-slate-300'
                                    )}>
                                        {log.message}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* 底部雷达状态微指示灯 */}
                    <div className="pt-2.5 mt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-mono">
                            <span className={clsx("w-2 h-2 rounded-full", isProbing ? "bg-cyan-400 animate-ping" : "bg-slate-600")} />
                            <span>{isProbing ? '4s 高频轮询中' : '心跳待命'}</span>
                        </span>
                        <span className="font-mono text-slate-500">{logs.length} 条记录</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
