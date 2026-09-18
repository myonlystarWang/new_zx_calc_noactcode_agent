import React, { useMemo, useState } from 'react';
import { FileInput, X } from 'lucide-react';
import type { Buff, CharacterAttributes, CharacterClass } from '../../types';
import { defaultAttributes } from '../../context/AppContext';
import { parsePresetText, type ParsedImport } from '../../utils/parsePresetText';

const FACTION_NAMES: Record<string, string> = { XIAN: '仙', FO: '佛', MO: '魔' };

/** 与计算器页 AttributePanel 的展示顺序一致 */
const ATTR_ROWS: Array<[keyof CharacterAttributes, string]> = [
    ['CharacterMinAttack', '最小攻击'],
    ['CharacterMaxAttack', '最大攻击'],
    ['CharacterHealth', '气血'],
    ['CharacterMana', '真气'],
    ['CharacterDefense', '防御'],
    ['CharacterCriticalHitDamagePercent', '暴击伤害'],
    ['CharacterMonsterDamageIncreasePercent', '对怪增伤'],
];

export interface ImportPayload {
    name: string;
    parsed: ParsedImport;
}

interface ImportPresetDialogProps {
    buffs: Buff[];
    classes: CharacterClass[];
    suggestName: string;
    onClose: () => void;
    onConfirm: (payload: ImportPayload) => void;
}

/**
 * 粘贴导入（Step 13）：把一段自由格式的属性/增益数据解析成方案预览，
 * 确认后由父组件落成新方案并应用。本组件只负责解析与预览，不做任何状态写入。
 */
export const ImportPresetDialog: React.FC<ImportPresetDialogProps> = ({
    buffs,
    classes,
    suggestName,
    onClose,
    onConfirm,
}) => {
    const [text, setText] = useState('');
    const [name, setName] = useState(suggestName);
    const [showGuide, setShowGuide] = useState(false);
    const parsed = useMemo(() => parsePresetText(text, buffs, classes), [text, buffs, classes]);

    const EXAMPLE_TEMPLATE = [
        '涅羽 · 仙',
        '攻 120000-150000 · 气血 2500000 · 真气 800000 · 防御 180000 · 爆伤 1250% · 对怪增伤 35%',
        '增益：专注 +261、巫咒 +22.5'
    ].join('\n');

    const handlePasteFromClipboard = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                const clipText = await navigator.clipboard.readText();
                if (clipText) setText(clipText.trim());
            }
        } catch {
            // 剪贴板权限受限时静默
        }
    };

    const handleFillExample = () => {
        setText(EXAMPLE_TEMPLATE);
    };

    const className = parsed.classId
        ? classes.find((c) => c.ClassID === parsed.classId)?.ClassName ?? parsed.classId
        : null;
    const factionName = parsed.faction ? FACTION_NAMES[parsed.faction] : null;
    const parsedBuffs = Object.entries(parsed.buffValues)
        .map(([id, value]) => {
            const b = buffs.find((x) => x.BuffID === id);
            return { id, name: b?.BuffName ?? id, value };
        });

    const canConfirm = parsed.hasContent && !!name.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                        <FileInput className="w-4 h-4 text-cyan-400" />
                        粘贴导入方案
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 快捷操作栏：直接读取剪贴板 / 一键填入标准示例 */}
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">输入或粘贴配置文本：</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePasteFromClipboard}
                            className="text-xs text-slate-300 hover:text-cyan-400 transition-colors"
                        >
                            粘贴剪贴板
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                            type="button"
                            onClick={handleFillExample}
                            className="text-xs text-slate-300 hover:text-cyan-400 transition-colors"
                        >
                            填入示例
                        </button>
                        {text && (
                            <>
                                <span className="text-slate-700">|</span>
                                <button
                                    type="button"
                                    onClick={() => setText('')}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    清空
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <textarea
                    autoFocus
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    spellCheck={false}
                    placeholder="可直接粘贴「分享 → 复制配置文本」生成的内容，或输入属性数值与增益..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/60 mb-2 font-mono leading-relaxed resize-y"
                />

                {text.trim() === '' ? (
                    /* 1. 空输入状态：展示格式参考指引，帮助初次使用或手写的用户 */
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 mb-4 text-xs text-slate-400">
                        <div className="text-slate-300 font-medium mb-1.5">
                            格式参考（支持自由换行，或直接使用顶部的「填入示例」）：
                        </div>
                        <div className="space-y-1.5 text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60 leading-normal">
                            <div>• <span className="text-slate-300">职业 · 阵营</span>：如 <span className="text-slate-200 font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800">涅羽 · 仙</span>（可省略，默认沿用当前）</div>
                            <div>• <span className="text-slate-300">攻击区间</span>：如 <span className="text-slate-200 font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800">攻 120000-150000</span> 或 <span className="text-slate-200 font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800">最小攻击 120000 最大攻击 150000</span></div>
                            <div>• <span className="text-slate-300">面板属性</span>：气血、真气、防御、爆伤（%、会心伤害）、对怪增伤（%）</div>
                            <div>• <span className="text-slate-300">增益状态</span>：如 <span className="text-slate-200 font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800">增益：专注 +261、巫咒 +22.5</span>（支持加号与千分位）</div>
                        </div>
                    </div>
                ) : (
                    /* 2. 已输入状态：无缝切换为实时识别结果预览，消灭双重冗余展示 */
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 mb-4 flex flex-col gap-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <div>
                                <span className="text-slate-500">职业阵营：</span>
                                <span className="text-slate-200 font-medium">
                                    {className || factionName
                                        ? `${className ?? '（沿用当前）'} · ${factionName ?? '（沿用当前）'}`
                                        : '未指定（沿用当前职业与阵营）'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGuide(g => !g)}
                                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showGuide ? '收起格式说明' : '格式说明'}
                            </button>
                        </div>
                        {showGuide && (
                            <div className="text-[11px] text-slate-400 py-1.5 px-2 bg-slate-900/60 rounded border border-slate-800/80 space-y-1">
                                <div>• 支持直接粘贴「复制配置文本」；支持职业·阵营、攻区间、带符号增益及千分位。</div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {ATTR_ROWS.map(([key, label]) => {
                                const changed = parsed.attributes[key] !== defaultAttributes[key];
                                return (
                                    <div key={key} className="flex justify-between gap-2">
                                        <span className="text-slate-500">{label}</span>
                                        <span className={changed ? 'text-slate-200' : 'text-slate-600'}>
                                            {Math.round(parsed.attributes[key] ?? 0).toLocaleString('en-US')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        {parsedBuffs.length > 0 && (
                            <div className="text-xs text-slate-400">
                                <span className="text-slate-500">增益（将勾选并覆盖数值）：</span>
                                {parsedBuffs.map((b) => `${b.name} ${b.value}`).join('、')}
                            </div>
                        )}
                        {parsed.warnings.length > 0 && (
                            <div className="text-xs text-amber-300/90 leading-relaxed">
                                未识别：{parsed.warnings.join('；')}
                            </div>
                        )}
                    </div>
                )}

                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="方案名"
                    className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400 mb-4"
                />

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={() => canConfirm && onConfirm({ name: name.trim(), parsed })}
                        disabled={!canConfirm}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        导入并存为方案
                    </button>
                </div>
            </div>
        </div>
    );
};
