import React, { useEffect, useState, useRef } from 'react';
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
    Pause
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
            { name: "不通", server: "butong", serverId: "10087" }
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

interface ProbeLog {
    id: string;
    time: string;
    serverName: string;
    status: 'online' | 'offline' | 'unstable' | 'error';
    message: string;
}

export const ServerRadarView: React.FC = () => {
    const [selectedZhanQuIndex, setSelectedZhanQuIndex] = useState<number>(1); // 默认昊天战区
    const [selectedServer, setSelectedServer] = useState<ServerInfo>(SERVER_CONFIG[1].servers[1]); // 默认龙腾碧霄
    const [isProbing, setIsProbing] = useState<boolean>(false);
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '["519", "517"]');
        } catch {
            return ['519', '517'];
        }
    });

    const [currentStatus, setCurrentStatus] = useState<'unknown' | 'online' | 'offline' | 'unstable'>('unknown');
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

    // 原生 Web Audio 提示音（无需外置资源，高可靠）
    const playSuccessChime = () => {
        if (!soundEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = audioCtxRef.current || new AudioContextClass();
            audioCtxRef.current = ctx;

            const now = ctx.currentTime;
            // 播放和谐的清脆三音符开服提示 (C5 -> E5 -> G5)
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

    // 探测单个服务器状态
    const probeOnce = async (srv: ServerInfo) => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const logId = `${Date.now()}-${Math.random()}`;

        try {
            // 通过直连或代理探测
            const url = `https://www.mujiston.com/zhuxian/jiance?type=jiance&server=${encodeURIComponent(srv.server)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const status = data.content?.status;

            if (status === 1) {
                setCurrentStatus('online');
                playSuccessChime();
                setLogs(prev => [
                    { id: logId, time: timeStr, serverName: srv.name, status: 'online', message: '已开服！速冲' },
                    ...prev.slice(0, 49)
                ]);
            } else if (status === 2) {
                setCurrentStatus('unstable');
                setLogs(prev => [
                    { id: logId, time: timeStr, serverName: srv.name, status: 'unstable', message: '状态波动中 (薛定谔状态)' },
                    ...prev.slice(0, 49)
                ]);
            } else {
                setCurrentStatus('offline');
                setLogs(prev => [
                    { id: logId, time: timeStr, serverName: srv.name, status: 'offline', message: '维护中 / 未开服' },
                    ...prev.slice(0, 49)
                ]);
            }
        } catch (err) {
            setLogs(prev => [
                { id: logId, time: timeStr, serverName: srv.name, status: 'error', message: '网络探测超时，正在持续轮询' },
                ...prev.slice(0, 49)
            ]);
        }
    };

    // 轮询控制
    useEffect(() => {
        if (!isProbing) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        // 立即执行一次
        probeOnce(selectedServer);

        // 每 5 秒轮询一次
        timerRef.current = window.setInterval(() => {
            probeOnce(selectedServer);
        }, 5000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isProbing, selectedServer]);

    const activeZhanQu = SERVER_CONFIG[selectedZhanQuIndex];

    return (
        <div className="flex flex-col gap-5 max-w-[1500px] mx-auto w-full">
            {/* 顶栏标题栏 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 md:pr-24">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                        <Radio className="w-6 h-6 animate-pulse text-cyan-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-100 tracking-wide">
                                诛仙3 开服雷达监测
                            </h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                                实时高频
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            维护日开服毫秒级声光提醒 · 支持关注订阅 · 1:1 原生选服界面体验
                        </p>
                    </div>
                </div>

                {/* 快捷操作控件 */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                            soundEnabled
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                        )}
                        title="开服时播放提示音"
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        <span>{soundEnabled ? '提示音开启' : '提示音静音'}</span>
                    </button>

                    <button
                        onClick={() => setIsProbing(!isProbing)}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black transition-all border shadow-lg',
                            isProbing
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-rose-500/20 animate-pulse'
                                : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-cyan-500/20 hover:bg-cyan-500/30'
                        )}
                    >
                        {isProbing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isProbing ? '停止监测' : '开始雷达监测'}</span>
                    </button>
                </div>
            </div>

            {/* 我的关注快捷栏 */}
            {favorites.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                    <span className="text-amber-400 font-bold flex items-center gap-1 pl-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>我的常驻关注:</span>
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {SERVER_CONFIG.flatMap(zq => zq.servers)
                            .filter(s => favorites.includes(s.serverId))
                            .map(favSrv => {
                                const isSelected = selectedServer.serverId === favSrv.serverId;
                                return (
                                    <button
                                        key={favSrv.serverId}
                                        onClick={() => {
                                            setSelectedServer(favSrv);
                                            setCurrentStatus('unknown');
                                        }}
                                        className={clsx(
                                            'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5',
                                            isSelected
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                                : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                                        )}
                                    >
                                        <span>{favSrv.name}</span>
                                        {isSelected && isProbing && (
                                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* 核心面板：1:1 游戏原生选服界面框架 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 左侧：战区列表 (3列) */}
                <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-1.5">
                    <span className="text-xs text-slate-400 font-bold px-3 py-1">选择战区</span>
                    {SERVER_CONFIG.map((zq, idx) => {
                        const isActive = selectedZhanQuIndex === idx;
                        return (
                            <button
                                key={zq.zhanQu}
                                onClick={() => setSelectedZhanQuIndex(idx)}
                                className={clsx(
                                    'px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between',
                                    isActive
                                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-md'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                )}
                            >
                                <span>{zq.zhanQu}</span>
                                <span className="text-[10px] font-mono opacity-60">
                                    {zq.servers.length} 服
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* 中间：区服选择网格与当前监测状态卡片 (6列) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                    {/* 区服选择网格 */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-sm font-black text-slate-200">
                                {activeZhanQu.zhanQu} · 服务器列表
                            </span>
                            <span className="text-xs text-slate-500">点击选中目标服务器</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {activeZhanQu.servers.map(srv => {
                                const isSelected = selectedServer.serverId === srv.serverId;
                                const isFav = favorites.includes(srv.serverId);

                                return (
                                    <div
                                        key={srv.serverId}
                                        onClick={() => {
                                            setSelectedServer(srv);
                                            setCurrentStatus('unknown');
                                        }}
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
                                                className="text-slate-600 hover:text-amber-400"
                                            >
                                                <Star className={clsx(
                                                    'w-3.5 h-3.5',
                                                    isFav ? 'fill-amber-400 text-amber-400' : ''
                                                )} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                            <span>ID: {srv.serverId}</span>
                                            {isSelected && isProbing && (
                                                <span className="text-cyan-400 font-bold">探测中...</span>
                                            )}
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
                                <span className="text-xs text-slate-400">当前监测目标:</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <h3 className="text-xl font-black text-slate-100">
                                        {selectedServer.name}
                                    </h3>
                                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                        {activeZhanQu.zhanQu}
                                    </span>
                                </div>
                            </div>

                            {/* 状态大徽章 */}
                            <div className="flex items-center gap-2">
                                {currentStatus === 'online' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-sm shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>已开服 (可登录)</span>
                                    </div>
                                )}
                                {currentStatus === 'offline' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>维护中 / 未开服</span>
                                    </div>
                                )}
                                {currentStatus === 'unstable' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300 font-bold text-sm">
                                        <Activity className="w-4 h-4" />
                                        <span>薛定谔波动中</span>
                                    </div>
                                )}
                                {currentStatus === 'unknown' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-slate-400 text-xs">
                                        <span>等待雷达启动</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                            <span>探测协议: 完美世界官方网关链路 (心跳探测)</span>
                            <button
                                onClick={() => probeOnce(selectedServer)}
                                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>立即刷新一次</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧：实时日志流 (3列) */}
                <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 max-h-[640px]">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            <span>探测日志流水</span>
                        </span>
                        {logs.length > 0 && (
                            <button
                                onClick={() => setLogs([])}
                                className="text-[10px] text-slate-500 hover:text-slate-300"
                            >
                                清空
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {logs.length === 0 ? (
                            <div className="text-center py-12 text-slate-600 text-xs">
                                暂无探测流水，启动雷达后将在此实时打印心跳
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
        </div>
    );
};
