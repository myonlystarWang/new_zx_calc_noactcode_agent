import React, { useEffect, useState } from 'react';
import { CREATOR_SOCIALS, type CreatorSocial } from '../../data/creatorSocials';

/** B 站：电视机轮廓 + 双天线 + 两点眼睛（与 lucide 同线宽风格） */
const BilibiliIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <rect x="2.5" y="7" width="19" height="13" rx="4" />
        <path d="M7.4 3.2 9.9 6M16.6 3.2 14.1 6" />
        <circle cx="8.9" cy="13.2" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="15.1" cy="13.2" r="1.15" fill="currentColor" stroke="none" />
    </svg>
);

/** 抖音：八分音符 + 上扬尾音 */
const DouyinIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M14.6 3.4v9.6a3.7 3.7 0 1 1-3.7-3.7c.42 0 .82.07 1.2.2" />
        <path d="M14.6 3.4c.35 2.35 1.95 3.85 4.4 4.05" />
    </svg>
);

const ICONS: Record<CreatorSocial['id'], React.FC<{ className?: string }>> = {
    bilibili: BilibiliIcon,
    douyin: DouyinIcon,
};

/** 品牌色：图标底色 / 描边 / 文字 */
const SKIN: Record<CreatorSocial['id'], { icon: string; iconBg: string; border: string; hover: string; text: string }> = {
    bilibili: {
        icon: 'text-cyan-300',
        iconBg: 'bg-cyan-500/15 border-cyan-500/30',
        border: 'border-slate-800/80',
        hover: 'hover:border-cyan-500/50 hover:bg-cyan-500/[0.07]',
        text: 'text-cyan-300',
    },
    douyin: {
        icon: 'text-rose-300',
        iconBg: 'bg-rose-500/15 border-rose-500/30',
        border: 'border-slate-800/80',
        hover: 'hover:border-rose-500/50 hover:bg-rose-500/[0.07]',
        text: 'text-rose-300',
    },
};

/**
 * 作者 B 站 / 抖音入口。
 *
 * 为什么桌面端直接摆二维码、而不是藏在悬停里：
 * - 卡片右侧原本是一大片空白，二维码常驻既填满版面，又省掉一次交互。
 * - 手机端自己的屏扫不了自己的码，所以窄屏只留「图标 + 账号名」的跳转 chip。
 *
 * 二维码来源：`qrImage`（自备图）优先，否则用 `url` 现场生成（qrcode 动态引入，不进首屏包）。
 */
export const CreatorSocialLinks: React.FC = () => {
    const [qrMap, setQrMap] = useState<Record<string, string>>({});
    const items = CREATOR_SOCIALS.filter((s) => s.url || s.qrImage);

    useEffect(() => {
        let cancelled = false;
        const pending = items.filter((s) => !s.qrImage && s.url && !qrMap[s.id]);
        if (pending.length === 0) return;

        void (async () => {
            try {
                const QRCode = (await import('qrcode')).default;
                const entries = await Promise.all(
                    pending.map(async (social) => {
                        const dataUrl = await QRCode.toDataURL(social.url, {
                            margin: 1,
                            width: 240,
                            errorCorrectionLevel: 'M',
                            color: { dark: '#0b0f19', light: '#ffffff' },
                        });
                        return [social.id, dataUrl] as const;
                    })
                );
                if (!cancelled) setQrMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
            } catch (err) {
                console.warn('作者二维码生成失败:', err);
            }
        })();

        return () => {
            cancelled = true;
        };
        // qrMap 故意不进依赖：只在「还有待生成项」时跑一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length]);

    if (items.length === 0) return null;

    return (
        <>
            {/* 桌面（≥md）：两个二维码并列，常驻在卡片右侧 */}
            <div className="hidden md:flex items-start gap-2 shrink-0">
                {items.map((social) => {
                    const skin = SKIN[social.id];
                    const qrSrc = social.qrImage || qrMap[social.id];

                    return (
                        <a
                            key={social.id}
                            href={social.url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${social.label}：${social.handle}（扫码或点击关注）`}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border ${skin.border} ${skin.hover} bg-white/[0.03] p-2 w-[112px] transition-all no-underline`}
                        >
                            {qrSrc ? (
                                <img
                                    src={qrSrc}
                                    alt={`${social.label} 二维码`}
                                    className="w-[72px] h-[72px] rounded-md bg-white shrink-0"
                                />
                            ) : (
                                <div className="w-[72px] h-[72px] rounded-md bg-slate-800/70 border border-slate-700 shrink-0 animate-pulse" />
                            )}
                            <div className="text-center leading-tight">
                                <div className={`text-[11px] font-bold ${skin.text}`}>{social.label}</div>
                                <div className="text-[9px] text-slate-500 mt-0.5">{social.handle}</div>
                            </div>
                        </a>
                    );
                })}
            </div>

            {/* 窄屏（<md）：自己的屏扫不了自己的码，只留跳转 chip */}
            <div className="flex md:hidden flex-wrap items-center gap-2">
                {items.map((social) => {
                    const Icon = ICONS[social.id];
                    const skin = SKIN[social.id];

                    return (
                        <a
                            key={social.id}
                            href={social.url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${social.label}：${social.handle}`}
                            className={`flex items-center gap-2 rounded-xl border ${skin.border} ${skin.hover} bg-white/[0.03] px-2.5 py-1.5 transition-all no-underline`}
                        >
                            <span
                                className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${skin.iconBg} ${skin.icon}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="flex flex-col leading-tight">
                                <span className={`text-[11px] font-bold ${skin.text}`}>{social.label}</span>
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">{social.handle}</span>
                            </span>
                        </a>
                    );
                })}
            </div>
        </>
    );
};
