// 安全读取 localStorage：解析失败时清除损坏数据并回退到默认值，避免白屏崩溃（原 AppContext 私有函数，Step 9 抽为公共工具）
export function safeParseLocalStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        localStorage.removeItem(key);
        return fallback;
    }
}
