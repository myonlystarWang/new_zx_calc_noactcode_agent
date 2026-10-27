/**
 * PWA 安装引导的环境判定与状态存取
 *
 * 设计前提（见 doc/产品增长与性能优化_评估与执行计划_20261026.md #4）：
 *   本站**不注册 Service Worker**，而 Chrome 的 `beforeinstallprompt` 至今仍要求
 *   「已注册且带 fetch handler 的 SW」才触发 → 正常情况下拿不到该事件，
 *   安装引导只能是**图文教学**，不能一键安装。
 *   仍然监听该事件：万一将来加了 SW、或某些 Chromium 分支放宽了条件，
 *   有事件就走原生安装，没有就退回图文，两条路都不亏。
 *
 * iOS 侧完全没有可编程触发安装的 API，只能教用户点「分享 → 添加到主屏幕」。
 */

export type Platform = 'ios' | 'android' | 'desktop';

/** 内置浏览器（装不了，必须先「用浏览器打开」） */
export type InAppHost =
  | 'wechat'
  | 'qq'
  | 'weibo'
  | 'douyin'
  | 'alipay'
  | 'dingtalk'
  | 'feishu'
  | null;

export interface InstallEnv {
  platform: Platform;
  inApp: InAppHost;
  /** iOS 上非 Safari：只有 Safari 能「添加到主屏幕」 */
  iosNonSafari: boolean;
  /** 已经是独立窗口（已安装） */
  standalone: boolean;
  /** 有可用的原生安装事件 */
  canPrompt: boolean;
}

const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';

/** 已安装判定：Android/桌面走 display-mode，iOS Safari 走 navigator.standalone */
const STANDALONE_QUERY =
  '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen)';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari 的 matchMedia 对 display-mode 支持不完整，靠 navigator.standalone 兜底
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return window.matchMedia(STANDALONE_QUERY).matches;
}

function detectPlatform(): Platform {
  if (/Android/i.test(UA)) return 'android';
  // iPadOS 13+ 的 UA 伪装成 Mac，靠触点数区分
  const iOSUA = /iPad|iPhone|iPod/i.test(UA);
  const iPadOS = /Macintosh/i.test(UA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  if (iOSUA || iPadOS) return 'ios';
  // 兜底：魔改 UA（部分国产 ROM / 内置浏览器）可能既不带 Android 也不带 iPhone，
  // 但只要带 Mobile 就一定是手机 —— 否则会被判成桌面，给出「Chrome/Edge 地址栏安装」的错误步骤。
  if (/Mobile/i.test(UA)) return 'android';
  return 'desktop';
}

function detectInApp(): InAppHost {
  if (/MicroMessenger/i.test(UA)) return 'wechat';
  if (/\bQQ\//i.test(UA) || /QQBrowser/i.test(UA)) return 'qq';
  if (/Weibo/i.test(UA)) return 'weibo';
  if (/aweme|ByteLocale|BytedanceWebview/i.test(UA)) return 'douyin';
  if (/AlipayClient/i.test(UA)) return 'alipay';
  if (/DingTalk/i.test(UA)) return 'dingtalk';
  if (/Lark|Feishu/i.test(UA)) return 'feishu';
  return null;
}

/** iOS 上的第三方浏览器（CriOS/FxiOS/EdgiOS…）都不能添加到主屏幕 */
function isIosNonSafari(): boolean {
  if (detectPlatform() !== 'ios') return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Mercury|GSA/i.test(UA)) return true;
  // 微信/QQ 内也已被 inApp 覆盖，这里只判「独立浏览器但非 Safari」
  return !/Safari/i.test(UA) && !/MicroMessenger/i.test(UA);
}

/* ---------------- 原生安装事件（当前环境通常拿不到，留作能力探测） ---------------- */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // 压住浏览器自带的横幅，改由站内引导决定时机
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
  });
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  promptListeners.add(fn);
  return () => promptListeners.delete(fn);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** 走原生安装；用户取消不算失败。返回是否真的弹出了系统安装框 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    return true;
  } catch {
    return false;
  } finally {
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
  }
}

export function getInstallEnv(): InstallEnv {
  const platform = detectPlatform();
  const inApp = detectInApp();
  return {
    platform,
    inApp,
    iosNonSafari: isIosNonSafari(),
    standalone: isStandalone(),
    // iOS 没有任何可编程安装接口；内置浏览器里 prompt 也调不起来 —— 这两种只给图文，
    // 否则会出现「点了『一键安装』什么都没发生」的死按钮。
    canPrompt: platform !== 'ios' && !inApp && canPromptInstall(),
  };
}

/* ---------------- 顶部横幅的显示策略 ---------------- */

const STREAK_KEY = 'zx_banner_close_streak';

/**
 * 横幅从**第一次访问**就显示，每次访问都显示，直到用户**连续**关掉 3 次才永久收起。
 *
 * 为什么用「连续」而不是「累计」：点「怎么装」说明用户有兴趣，只是暂时不想装，
 * 这种情况会把计数清零，避免「看过说明的人反而被永久屏蔽」。
 */
export const BANNER_CLOSE_LIMIT = 3;

export function getBannerCloseStreak(): number {
  try {
    return Number(localStorage.getItem(STREAK_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}

/** 用户点了 ×：连续关闭次数 +1，返回新值 */
export function recordBannerClose(): number {
  const next = getBannerCloseStreak() + 1;
  try {
    localStorage.setItem(STREAK_KEY, String(next));
  } catch {
    /* 隐私模式写不进去 → 每次都显示，不阻断 */
  }
  return next;
}

/** 用户点了「怎么装」：算作有兴趣，连续计数清零 */
export function resetBannerCloseStreak(): void {
  try {
    localStorage.removeItem(STREAK_KEY);
  } catch {
    /* ignore */
  }
}

/** 横幅当前是否该显示：未安装 + 连续关闭次数还没到上限 */
export function shouldShowBanner(): boolean {
  return !isStandalone() && getBannerCloseStreak() < BANNER_CLOSE_LIMIT;
}
