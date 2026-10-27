import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  Ellipsis,
  EllipsisVertical,
  SquareArrowUp,
  Download,
  Plus,
  Smartphone,
  Monitor,
  CircleCheck,
  X,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import {
  getInstallEnv,
  promptInstall,
  subscribeInstallPrompt,
  shouldShowBanner,
  recordBannerClose,
  resetBannerCloseStreak,
  type InstallEnv,
} from '../../utils/pwaInstall';

/* ------------------------------------------------------------------ *
 * 引导内容
 *
 * 三套（实际四套）文案，按环境分流。核心事实：
 *   · 微信/QQ/微博等内置浏览器**没有**「添加到主屏幕」，必须先「用浏览器打开」
 *   · iOS 只有 Safari 能加主屏，第三方浏览器（Chrome iOS 等）不行
 *   · Android 菜单里叫「安装应用」或「添加到主屏幕」，不同厂商 ROM 措辞不同，两个都提
 *   · 桌面 Chrome/Edge 是地址栏右侧的安装图标
 * ------------------------------------------------------------------ */

type StepIcon = 'menu-v' | 'menu-h' | 'share' | 'plus' | 'browser' | 'check' | 'install';

interface GuideStep {
  icon: StepIcon;
  text: string;
  sub?: string;
}

interface Guide {
  title: string;
  lead: string;
  steps: GuideStep[];
  /** 结尾提示（可选） */
  note?: string;
}

const STEP_ICON: Record<StepIcon, React.ReactNode> = {
  'menu-v': <EllipsisVertical className="w-4 h-4" />,
  'menu-h': <Ellipsis className="w-4 h-4" />,
  share: <SquareArrowUp className="w-4 h-4" />,
  plus: <Plus className="w-4 h-4" />,
  browser: <ArrowUpRight className="w-4 h-4" />,
  check: <CircleCheck className="w-4 h-4" />,
  install: <Download className="w-4 h-4" />,
};

const IN_APP_NAME: Record<string, string> = {
  wechat: '微信',
  qq: 'QQ',
  weibo: '微博',
  douyin: '抖音',
  alipay: '支付宝',
  dingtalk: '钉钉',
  feishu: '飞书',
};

function buildGuide(env: InstallEnv): Guide {
  const { platform, inApp, iosNonSafari } = env;

  // ---- 第一段：内置浏览器逃逸 ----
  // 微信 Android / iOS 的右上角菜单都是**横向**三个点（⋯），不是 Android Chrome 的竖点 ⋮，
  // 所以这里一律用 menu-h；竖点只出现在下方「浏览器菜单」那一步。
  const escapeSteps: GuideStep[] = inApp
    ? platform === 'ios'
      ? [
          { icon: 'menu-h', text: `点微信右上角的 ⋯`, sub: `${IN_APP_NAME[inApp] ?? '当前'}内置浏览器装不了，先换个浏览器` },
          { icon: 'browser', text: '选择「在 Safari 中打开」' },
        ]
      : [
          { icon: 'menu-h', text: '点右上角的 ⋯', sub: `${IN_APP_NAME[inApp] ?? '当前'}内置浏览器装不了，先换个浏览器` },
          { icon: 'browser', text: '选择「在浏览器打开」' },
        ]
    : [];

  // ---- 第二段：目标平台步骤 ----
  // ⚠️ 每个分支都必须拼上 escapeSteps：PC 微信 / 钉钉 / 飞书 的内置浏览器 platform 判成 desktop，
  //    早期桌面分支漏了这一段，结果是「在微信里只看到 Chrome/Edge 的安装步骤，完全没提用浏览器打开」。
  if (platform === 'ios') {
    return {
      // 微信里第一眼就得知道「要先换浏览器」，所以标题直接说这件事；
      // 只有已经用 Safari 打开时才提「添加到主屏幕」。
      title: inApp ? '先在浏览器中打开' : '添加到 iPhone 主屏幕',
      lead: iosNonSafari && !inApp ? '当前浏览器不支持添加主屏，请先用 Safari 打开本页' : '装好后从桌面图标直接进入，全屏无地址栏',
      steps: [
        ...escapeSteps,
        {
          icon: 'menu-h',
          text: inApp ? '在 Safari 里，点底部工具栏的「⋯」' : '点底部工具栏的「⋯」',
          sub: '部分系统版本这里是「分享」图标，点它可直接跳到下一步',
        },
        { icon: 'share', text: '点「共享」' },
        { icon: 'plus', text: '在列表里找到「添加到主屏幕」', sub: '需要往下滑一段才看得到' },
        { icon: 'check', text: '在弹出的页面点右上角「添加」' },
      ],
    };
  }

  if (platform === 'android') {
    return {
      title: inApp ? '先在浏览器中打开' : '添加到 Android 主屏幕',
      lead: '装好后从桌面图标直接进入，全屏无地址栏',
      steps: [
        ...escapeSteps,
        { icon: 'menu-v', text: '点浏览器右上角的 ⋮ 菜单' },
        {
          icon: 'install',
          text: '选择「安装应用」或「添加到主屏幕」',
          sub: '不同手机叫法不同，两个都可能是它',
        },
        { icon: 'check', text: '确认「安装」/「添加」' },
      ],
      note: '如果没看到这两项，说明当前浏览器不支持，换 Chrome 或系统自带浏览器再试。',
    };
  }

  return {
    title: inApp ? '先在浏览器中打开' : '把天书万象装到桌面',
    // lead 不再重复「内置浏览器装不了」—— 那句已经在第 1 步的副标题里
    lead: '桌面版 Chrome / Edge 可直接安装成独立窗口，像本地程序一样启动',
    steps: [
      ...escapeSteps,
      { icon: 'install', text: '看地址栏右侧有没有安装图标', sub: '一个带加号或屏幕形状的小图标' },
      { icon: 'menu-v', text: '没有的话，点 ⋮ 菜单 →「安装天书万象 AI」' },
      { icon: 'check', text: '确认「安装」，之后从开始菜单/程序坞启动' },
    ],
    note: inApp ? undefined : 'Safari 桌面版（macOS 14+）走「文件 → 添加到程序坞」。',
  };
}

/* ------------------------------------------------------------------ *
 * 弹窗
 * ------------------------------------------------------------------ */

interface InstallGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export const InstallGuideDialog: React.FC<InstallGuideDialogProps> = ({ open, onClose }) => {
  // 每次打开重新求值：用户可能刚从微信切到浏览器，UA 不会变但 canPrompt 可能变
  const [env, setEnv] = useState<InstallEnv>(() => getInstallEnv());

  useEffect(() => {
    if (!open) return;
    setEnv(getInstallEnv());
    return subscribeInstallPrompt(() => setEnv(getInstallEnv()));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const guide = buildGuide(env);
  const PlatformIcon = env.platform === 'desktop' ? Monitor : Smartphone;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="添加到桌面">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />

      <div
        className={clsx(
          'relative w-full sm:max-w-md mx-auto flex flex-col overflow-hidden',
          'bg-[#0d1219] border border-white/10 rounded-t-2xl sm:rounded-2xl',
          'shadow-[0_-8px_40px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200',
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/25 via-indigo-500/15 to-amber-500/25 border border-cyan-400/30 text-cyan-300">
            <PlatformIcon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-slate-100 leading-tight">{guide.title}</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{guide.lead}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="px-5 py-4 flex flex-col gap-3">
          {guide.steps.map((s, i) => (
            // 有副标题时图标对齐首行（items-start），没有副标题时整行居中对齐（items-center）——
            // 否则单行文案会贴在 28px 图标框的顶部，看着像「提前预留了第二行」。
            <li key={`${s.text}-${i}`} className={clsx('flex gap-3', s.sub ? 'items-start' : 'items-center')}>
              <span className="shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 text-cyan-300">
                {STEP_ICON[s.icon]}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-slate-200 leading-snug">
                  <span className="text-slate-500 mr-1.5 font-mono text-[11px]">{i + 1}</span>
                  {s.text}
                </p>
                {s.sub && <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{s.sub}</p>}
              </div>
            </li>
          ))}
        </ol>

        {guide.note && (
          <p className="px-5 pb-4 text-[11px] text-slate-500 leading-relaxed">{guide.note}</p>
        )}

        <div className="px-5 pb-5 pt-1 flex gap-2">
          {env.canPrompt && (
            <button
              type="button"
              onClick={() => void promptInstall().then((ok) => ok && onClose())}
              className="flex-1 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors"
            >
              一键安装
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              'h-10 rounded-xl text-sm font-medium transition-colors',
              env.canPrompt
                ? 'px-4 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                : 'flex-1 bg-white/[0.07] hover:bg-white/[0.12] text-slate-200 border border-white/10',
            )}
          >
            {env.canPrompt ? '稍后' : '知道了'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 上下文：任意位置都能唤起引导弹窗
 *
 * 用 context 而不是层层传 props —— Footer 在 App 的 6 条路由里各渲染一次，
 * 逐个加 onOpenGuide 会把无关参数串一路。
 * ------------------------------------------------------------------ */

const InstallGuideCtx = React.createContext<() => void>(() => {});

export const useOpenInstallGuide = (): (() => void) => React.useContext(InstallGuideCtx);

export const InstallGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const openGuide = React.useCallback(() => setOpen(true), []);
  const closeGuide = React.useCallback(() => setOpen(false), []);

  return (
    <InstallGuideCtx.Provider value={openGuide}>
      {children}
      <InstallGuideDialog open={open} onClose={closeGuide} />
    </InstallGuideCtx.Provider>
  );
};

/* ------------------------------------------------------------------ *
 * 结果区底部一行（最低干扰位）
 * ------------------------------------------------------------------ */

/** 只出现在「算出结果之后」，文案克制、不做按钮样式，避免打断看数据 */
export const InstallHint: React.FC = () => {
  const openGuide = useOpenInstallGuide();
  const [standalone, setStandalone] = useState(() => getInstallEnv().standalone);

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const onChange = () => setStandalone(getInstallEnv().standalone);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  if (standalone) return null;

  return (
    <button
      type="button"
      onClick={openGuide}
      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-300 transition-colors cursor-pointer select-none"
    >
      加到桌面，下次一秒打开
      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
    </button>
  );
};

/* ------------------------------------------------------------------ *
 * 入口（Footer 常驻）
 * ------------------------------------------------------------------ */

interface InstallEntryProps {
  className?: string;
  /** 前面是否带一个「·」分隔符（Footer 里用）。分隔符必须和按钮一起消失，否则已安装时会留个孤零零的点 */
  separator?: boolean;
}

/** 已安装时返回 null —— 调用方无需自己判断 */
export const InstallEntry: React.FC<InstallEntryProps> = ({ className, separator }) => {
  const openGuide = useOpenInstallGuide();
  const [standalone, setStandalone] = useState(() => getInstallEnv().standalone);

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const onChange = () => setStandalone(getInstallEnv().standalone);
    mql.addEventListener('change', onChange);
    window.addEventListener('appinstalled', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('appinstalled', onChange);
    };
  }, []);

  if (standalone) return null;

  return (
    <>
      {separator && (
        <span className="text-slate-700 select-none" aria-hidden="true">
          ·
        </span>
      )}
      <button
        type="button"
        data-pwa-entry
        onClick={openGuide}
        className={clsx('transition-colors cursor-pointer whitespace-nowrap', className)}
      >
        添加到桌面
      </button>
    </>
  );
};

/* ------------------------------------------------------------------ *
 * 顶部细横幅
 *   第 1 次访问就显示，之后每次访问都显示；
 *   连续关掉 3 次 → 永久收起；点「怎么装」算有兴趣，计数清零；已安装则完全不出现。
 * ------------------------------------------------------------------ */

export const InstallBanner: React.FC = () => {
  const openGuide = useOpenInstallGuide();
  const [visible, setVisible] = useState(() => shouldShowBanner());

  // 从主屏图标启动（standalone）后立刻收起；同一标签页里 display-mode 不会变，但监听一下更稳
  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const onChange = () => setVisible(shouldShowBanner());
    mql.addEventListener('change', onChange);
    window.addEventListener('appinstalled', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('appinstalled', onChange);
    };
  }, []);

  if (!visible) return null;

  const open = () => {
    resetBannerCloseStreak();
    openGuide();
  };

  const close = () => {
    // 关掉立刻收起（本次浏览不再出现），下次打开页面按连续关闭次数决定还出不出现
    recordBannerClose();
    setVisible(false);
  };

  return (
    // 收进 Header 那条 max-w-5xl 的内容列里，不做通栏 —— 通栏会和上方未通栏的 LOGO/导航打架
    <div className="w-full shrink-0 px-4 sm:px-6 pt-2">
      <div
        data-pwa-banner
        className="group w-full max-w-5xl mx-auto h-8 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] pl-2.5 pr-1 flex items-center gap-1 text-xs transition-colors hover:border-cyan-400/40"
      >
        {/* 整条就是入口：点任意位置（× 除外）都能打开引导，不再单独放一个按钮 */}
        <button
          type="button"
          onClick={open}
          aria-label="查看如何把天书万象装到桌面"
          className="min-w-0 flex-1 h-full flex items-center gap-2 text-left cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-300 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-slate-300">
            加到桌面，下次一秒打开
          </span>
          <span className="shrink-0 flex items-center gap-0.5 text-cyan-300 font-medium">
            点我查看
            <ChevronRight
              className="w-3 h-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="不再提示"
          className="shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
