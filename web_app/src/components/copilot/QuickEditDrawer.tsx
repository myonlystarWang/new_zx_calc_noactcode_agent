import React, { useState, useEffect } from 'react';
import {
    X,
    Check,
    Copy,
    ArrowRight,
    Shield,
    Swords,
    Sliders,
    Flame
} from 'lucide-react';
import { CopilotService } from '../../services/CopilotService';
import type { ExtractedCPanel } from '../../services/CopilotService';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

interface QuickEditDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: ExtractedCPanel;
    onApplyToArena?: (data: ExtractedCPanel) => void;
}

export const QuickEditDrawer: React.FC<QuickEditDrawerProps> = ({
    isOpen,
    onClose,
    initialData,
    onApplyToArena
}) => {
    const { updateCharacterAttributes, updateCharacterClass } = useApp();
    const navigate = useNavigate();

    const [cPanel, setCPanel] = useState<ExtractedCPanel>({
        characterClass: '青云',
        faction: 'XIAN',
        attack: 185000,
        defense: 95000,
        hp: 3500000,
        mp: 1200000,
        critRate: 145.0,
        critDamage: 880.0,
        ignoreReduction: 135.0,
        damageReduction: 160.0,
        critReduction: 130.0,
        monsterDamageBonus: 78.0
    });

    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (initialData) {
            setCPanel(prev => ({
                ...prev,
                ...initialData
            }));
        }
    }, [initialData]);

    // 实时计算对 T20 Boss 的实战伤害
    const damageCalc = React.useMemo(() => {
        return CopilotService.getInstance().calculateT20Damage(cPanel);
    }, [cPanel]);

    if (!isOpen) return null;

    const handleNumberChange = (field: keyof ExtractedCPanel, val: number) => {
        setCPanel(prev => ({
            ...prev,
            [field]: isNaN(val) ? 0 : val
        }));
    };

    const handleStepChange = (field: keyof ExtractedCPanel, delta: number) => {
        setCPanel(prev => ({
            ...prev,
            [field]: Math.max(0, Number(((Number(prev[field] || 0)) + delta).toFixed(2)))
        }));
    };

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(JSON.stringify(cPanel, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleImportToSimulator = () => {
        if (onApplyToArena) {
            onApplyToArena(cPanel);
        } else {
            // 同步到 AppContext
            if (cPanel.characterClass) {
                updateCharacterClass(cPanel.characterClass, cPanel.faction || 'XIAN');
            }
            updateCharacterAttributes({
                CharacterMaxAttack: cPanel.attack || 180000,
                CharacterMinAttack: (cPanel.attack || 180000) * 0.9,
                CharacterDefense: cPanel.defense || 90000,
                CharacterHealth: cPanel.hp || 3000000,
                CharacterMana: cPanel.mp || 1000000,
                CharacterCriticalHitRatePercent: cPanel.critRate || 140,
                CharacterCriticalHitDamagePercent: cPanel.critDamage || 850,
                CharacterMonsterDamageIncreasePercent: cPanel.monsterDamageBonus || 70,
            });
            navigate('/');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg h-full bg-[#12161f] border-l border-cyan-500/30 flex flex-col shadow-2xl shadow-cyan-950/50">
                {/* 顶栏 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-[#161c28]/90">
                    <div className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-cyan-400" />
                        <div>
                            <h3 className="font-semibold text-gray-100 text-base">识图属性微调与校对</h3>
                            <p className="text-xs text-gray-400">核对 OCR 提取数值，支持 1 键带入战斗模拟室</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 实时伤害测算卡片 */}
                <div className="px-6 py-3.5 bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border-b border-cyan-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-medium text-cyan-300">
                                测算首领：{damageCalc.dungeonName}
                            </span>
                        </div>
                        <div className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                            T20 爆发秒伤估算
                        </div>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-amber-100">
                            {damageCalc.estimatedTotalDamage}
                        </span>
                        <span className="text-xs text-gray-400">（基于纯破防与真伤引擎测算）</span>
                    </div>
                </div>

                {/* 数值编辑滚动区 */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                    {/* 职业与阵营 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">职业</label>
                            <input
                                type="text"
                                value={cPanel.characterClass || ''}
                                onChange={e => setCPanel(prev => ({ ...prev, characterClass: e.target.value }))}
                                className="w-full px-3 py-1.5 text-sm bg-black/40 border border-cyan-500/30 rounded text-gray-200 focus:outline-none focus:border-cyan-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">阵营 (仙/佛/魔)</label>
                            <select
                                value={cPanel.faction || 'XIAN'}
                                onChange={e => setCPanel(prev => ({ ...prev, faction: e.target.value as any }))}
                                className="w-full px-3 py-1.5 text-sm bg-black/40 border border-cyan-500/30 rounded text-gray-200 focus:outline-none focus:border-cyan-400"
                            >
                                <option value="XIAN">仙</option>
                                <option value="FO">佛</option>
                                <option value="MO">魔</option>
                            </select>
                        </div>
                    </div>

                    {/* 基础攻防 */}
                    <div className="space-y-3 pt-2">
                        <div className="text-xs font-medium text-cyan-400 flex items-center gap-1.5">
                            <Swords className="w-3.5 h-3.5" />
                            核心攻防面板
                        </div>

                        {/* 攻击力 */}
                        <AttributeRow
                            label="攻击力 (大攻)"
                            value={cPanel.attack || 0}
                            step={5000}
                            unit="点"
                            onChange={v => handleNumberChange('attack', v)}
                            onStep={d => handleStepChange('attack', d)}
                        />

                        {/* 防御力 */}
                        <AttributeRow
                            label="防御力"
                            value={cPanel.defense || 0}
                            step={2000}
                            unit="点"
                            onChange={v => handleNumberChange('defense', v)}
                            onStep={d => handleStepChange('defense', d)}
                        />

                        {/* 气血 */}
                        <AttributeRow
                            label="气血总量 (HP)"
                            value={cPanel.hp || 0}
                            step={100000}
                            unit="点"
                            onChange={v => handleNumberChange('hp', v)}
                            onStep={d => handleStepChange('hp', d)}
                        />
                    </div>

                    {/* 核心百分比 (三大件) */}
                    <div className="space-y-3 pt-2">
                        <div className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" />
                            破防与增减免核心（三大件）
                        </div>

                        {/* 无视减免 */}
                        <AttributeRow
                            label="无视伤害减免"
                            value={cPanel.ignoreReduction || 0}
                            step={0.5}
                            unit="%"
                            highlight="text-amber-300"
                            onChange={v => handleNumberChange('ignoreReduction', v)}
                            onStep={d => handleStepChange('ignoreReduction', d)}
                        />

                        {/* 减免伤害 */}
                        <AttributeRow
                            label="减免伤害"
                            value={cPanel.damageReduction || 0}
                            step={0.5}
                            unit="%"
                            highlight="text-emerald-300"
                            onChange={v => handleNumberChange('damageReduction', v)}
                            onStep={d => handleStepChange('damageReduction', d)}
                        />

                        {/* 怪增 */}
                        <AttributeRow
                            label="对怪物增伤"
                            value={cPanel.monsterDamageBonus || 0}
                            step={1.0}
                            unit="%"
                            highlight="text-rose-300"
                            onChange={v => handleNumberChange('monsterDamageBonus', v)}
                            onStep={d => handleStepChange('monsterDamageBonus', d)}
                        />

                        {/* 暴击率 */}
                        <AttributeRow
                            label="暴击率"
                            value={cPanel.critRate || 0}
                            step={1.0}
                            unit="%"
                            onChange={v => handleNumberChange('critRate', v)}
                            onStep={d => handleStepChange('critRate', d)}
                        />

                        {/* 暴击伤害 */}
                        <AttributeRow
                            label="暴击伤害"
                            value={cPanel.critDamage || 0}
                            step={5.0}
                            unit="%"
                            onChange={v => handleNumberChange('critDamage', v)}
                            onStep={d => handleStepChange('critDamage', d)}
                        />

                        {/* 减暴击 */}
                        <AttributeRow
                            label="减暴击率"
                            value={cPanel.critReduction || 0}
                            step={1.0}
                            unit="%"
                            onChange={v => handleNumberChange('critReduction', v)}
                            onStep={d => handleStepChange('critReduction', d)}
                        />
                    </div>
                </div>

                {/* 底栏操作 */}
                <div className="p-4 border-t border-cyan-500/20 bg-[#161c28] flex items-center justify-between gap-3">
                    <button
                        onClick={handleCopyToClipboard}
                        className="px-3 py-2 text-xs rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 flex items-center gap-1.5 transition-colors"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? '已复制' : '复制 JSON'}
                    </button>

                    <button
                        onClick={handleImportToSimulator}
                        className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 transition-all"
                    >
                        <span>带入主战斗模拟室</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface AttributeRowProps {
    label: string;
    value: number;
    step: number;
    unit: string;
    highlight?: string;
    onChange: (val: number) => void;
    onStep: (delta: number) => void;
}

const AttributeRow: React.FC<AttributeRowProps> = ({
    label,
    value,
    step,
    unit,
    highlight,
    onChange,
    onStep
}) => {
    return (
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20 border border-white/5 hover:border-cyan-500/20 transition-colors">
            <span className={`text-xs ${highlight || 'text-gray-300'}`}>{label}</span>
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onStep(-step)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                >
                    -
                </button>
                <div className="relative">
                    <input
                        type="number"
                        value={value}
                        onChange={e => onChange(parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 text-xs text-right bg-black/50 border border-white/10 rounded text-cyan-200 focus:outline-none focus:border-cyan-400 pr-5"
                    />
                    <span className="absolute right-1.5 top-1 text-[10px] text-gray-500 pointer-events-none">
                        {unit}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => onStep(step)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                >
                    +
                </button>
            </div>
        </div>
    );
};
