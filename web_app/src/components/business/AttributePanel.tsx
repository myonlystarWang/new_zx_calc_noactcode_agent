import React from 'react';
import type { CharacterAttributes } from '../../types';
import { AttributeCard } from '../ui/AttributeCard';
import { ClassSelector } from './ClassSelector';
import { FactionSelector } from './FactionSelector';
import { PresetManager } from './PresetManager';

interface AttributePanelProps {
    attributes: CharacterAttributes;
    onChange: (attrs: CharacterAttributes) => void;
}

export const AttributePanel: React.FC<AttributePanelProps> = ({ attributes, onChange }) => {
    const handleChange = (key: keyof CharacterAttributes, value: number) => {
        // 处理最小攻击和最大攻击的限制条件
        let actualValue = value;

        if (key === 'CharacterMinAttack') {
            // 如果新的最小攻击大于当前最大攻击，则限制最小攻击为最大攻击的值
            if (value > attributes.CharacterMaxAttack) {
                actualValue = attributes.CharacterMaxAttack;
            }
        } else if (key === 'CharacterMaxAttack') {
            // 如果新的最大攻击小于当前最小攻击，则限制最大攻击为最小攻击的值
            if (value < attributes.CharacterMinAttack) {
                actualValue = attributes.CharacterMinAttack;
            }
        }

        onChange({
            ...attributes,
            [key]: actualValue
        });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Preset Manager */}
            <PresetManager />

            {/* Class & Faction Selectors - 并排半行，节约纵向空间
                两列由 .calc-selector-pair 的容器查询（≥640px）驱动，不用 md: 视口断点：
                分屏面板里视口很宽但面板可能只有 400px，视口断点会误判。 */}
            <div className="calc-selector-pair grid grid-cols-1 gap-3">
                <ClassSelector />
                <FactionSelector />
            </div>

            {/* Character Attributes (第1行4项基础攻击气血，第2行3项核心防御增伤，彻底告别空洞) */}
            <div>
                <h2 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-purple-500 rounded-full"></span>
                    角色属性
                    <span className="text-[11px] font-normal text-slate-400">（建议填写昭冥上身满状态属性）</span>
                </h2>
                <div className="flex flex-col gap-3">
                    {/* Row 1: 4 Cards (Min/Max Atk, HP, MP) */}
                    <div className="calc-attr-grid grid grid-cols-2 gap-3">
                        <AttributeCard
                            label="最小攻击"
                            tag="Min"
                            value={attributes.CharacterMinAttack}
                            onChange={(v) => handleChange('CharacterMinAttack', v)}
                            max={1000000}
                            step={1000}
                            color="cyan"
                        />
                        <AttributeCard
                            label="最大攻击"
                            tag="Max"
                            value={attributes.CharacterMaxAttack}
                            onChange={(v) => handleChange('CharacterMaxAttack', v)}
                            max={1000000}
                            step={1000}
                            color="purple"
                        />
                        <AttributeCard
                            label="气血值"
                            tag="HP"
                            value={attributes.CharacterHealth}
                            onChange={(v) => handleChange('CharacterHealth', v)}
                            max={10000000}
                            step={100000}
                            color="red"
                        />
                        <AttributeCard
                            label="真气值"
                            tag="MP"
                            value={attributes.CharacterMana}
                            onChange={(v) => handleChange('CharacterMana', v)}
                            max={10000000}
                            step={100000}
                            color="blue"
                        />
                    </div>

                    {/* Row 2: 3 Cards (DEF, CRIT, M-DMG) - 与第1行小卡片同宽，末位自然留空 */}
                    <div className="calc-attr-grid grid grid-cols-2 gap-3">
                        <AttributeCard
                            label="防御"
                            tag="DEF"
                            value={attributes.CharacterDefense}
                            onChange={(v) => handleChange('CharacterDefense', v)}
                            max={1000000}
                            step={1000}
                            color="emerald"
                        />
                        <AttributeCard
                            label="暴伤%"
                            tag="CRIT"
                            value={attributes.CharacterCriticalHitDamagePercent}
                            onChange={(v) => handleChange('CharacterCriticalHitDamagePercent', v)}
                            max={4000}
                            step={50}
                            color="yellow"
                        />
                        <AttributeCard
                            label="对怪增伤%"
                            tag="M-DMG"
                            value={attributes.CharacterMonsterDamageIncreasePercent}
                            onChange={(v) => handleChange('CharacterMonsterDamageIncreasePercent', v)}
                            max={100}
                            step={5}
                            color="orange"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
