/**
 * 识图校对卡的数据契约。
 * 设计依据：doc/识图校对与功能路由设计_20261021.md §3 / §4 / §12
 * 只建模「下一步功能真正消费」的字段；面板其余项只计数，不建模。
 */

export type PanelKind =
    | 'character_panel'
    | 'xyc'
    | 'tianyuan'
    | 'equip'
    | 'fabao'
    | 'skill'
    | 'boss'
    | 'combat_log'
    | 'unknown';

export type FieldStatus = 'ok' | 'low_confidence' | 'unreadable' | 'absent' | 'invalid';

/** percent 一律 0-100 刻度：面板 1889.6% → 1889.6 */
export type FieldUnit = 'point' | 'percent' | 'text';

export interface FieldCell {
    key: string;
    label: string;
    unit: FieldUnit;
    value: number | string | null;
    /** 面板原文，必须能在 textLines 里找到 */
    raw: string | null;
    status: FieldStatus;
    confidence: number;
    source: 'vision' | 'user' | 'none';
    /** 是否参与伤害计算（由注册表决定，UI 不写 if） */
    engine: boolean;
    /** ok 但引擎不用的项，用于灰显 */
    reason?: string;
}

export interface EngineSnapshot {
    /** 只含 status==='ok' 且有值、且注册表标了 engine 的字段 */
    attrs: Record<string, number>;
    missingRequired: string[];
    mappedFrom: Record<string, string>;
}

export interface RecognizedPanel {
    kind: PanelKind;
    kindConfidence: number;
    kindEvidence: string[];
    provider: string | null;
    degraded: boolean;
    degradedReason?: string;
    quality: 'full' | 'partial' | 'degraded';
    /** 识别到但不进卡的项数量（面板 30 项 vs 卡上 7 项） */
    extraCount: number;
    character?: { classRaw?: string; factionRaw?: string; levelRaw?: string };
    /** character_panel 资源条：气血 / 真气 / 第三槽 */
    bars?: { hpCur?: number; hpMax?: number; mpCur?: number; mpMax?: number; thirdCur?: number; thirdMax?: number };
    /** 按展示顺序排列的字段（注册表顺序） */
    fields: FieldCell[];
    /** 轩辕策 / 天缘的词条行（仅展示，不参与计算） */
    attrs?: { name: string; value: string; wash?: string; extra?: string; tianming?: number }[];
    /** 轩辕策标题信息 */
    xyc?: { beast?: string; bookName?: string; heroVersion?: boolean; tier?: string; stars?: number; washUsed?: number; level?: number };
    /** 天缘标题信息：仅部位 / 天缘等级 / 括号后缀 */
    tianyuan?: { name?: string; part?: string; suffix?: string; tianyuanLevel?: number };
    advSkill?: { name?: string; variant?: string; level?: number };
    textLines: { label: string; raw: string }[];
    issues: string[];
    engine: EngineSnapshot;
    imageRef: string | null;
}

/** /api/copilot/vision 的原始返回（新协议） */
export interface VisionEnvelope {
    ok: boolean;
    provider?: string | null;
    degraded?: boolean;
    degradedReason?: string;
    lastError?: string;
    quality?: 'full' | 'partial';
    issues?: string[];
    panel?: any;
    result?: any;
}
