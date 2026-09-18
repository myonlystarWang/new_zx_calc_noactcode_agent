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
    const parsed = useMemo(() => parsePresetText(text, buffs, classes), [text, buffs, classes]);

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
                <div className="flex items-start justify-between gap-3 mb-4">
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

                <textarea
                    autoFocus
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    spellCheck={false}
                    placeholder={
                        '职业 涅羽 阵营 佛\n最小攻击 210000  最大攻击 230000\n气血：3,200,000  真气 2800000  爆伤 1980\n专注 241  绿点 22.5  易伤 900'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400 mb-2 font-mono leading-relaxed resize-y"
                />
                <p className="text-[11px] text-slate-500 mb-4">
                    每行「字段名 + 数值」即可，顺序与换行随意；支持中英文字段名、千分位逗号与 JSON。职业/阵营可省略（沿用当前选择）。
                </p>

                {text.trim() !== '' && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 mb-4 flex flex-col gap-2">
                        <div className="text-xs text-slate-400">
                            <span className="text-slate-500">职业阵营：</span>
                            {className || factionName
                                ? `${className ?? '（沿用当前）'} · ${factionName ?? '（沿用当前）'}`
                                : '未指定（沿用当前职业与阵营）'}
                        </div>
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
