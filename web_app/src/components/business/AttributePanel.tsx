import React from 'react';
import type { CharacterAttributes } from '../../types';
import { AttributeCard } from '../ui/AttributeCard';
import { ClassSelector } from './ClassSelector';
import { FactionSelector } from './FactionSelector';
import { Shield, Sword, Heart, Zap, Crosshair, Skull } from 'lucide-react';

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
        <div className="flex flex-col gap-6">
            {/* Class Selector */}
            <ClassSelector />

            {/* Faction Selector */}
            <FactionSelector />

            {/* Character Attributes Grid */}
            <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-purple-500 rounded-full"></span>
                    角色属性
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <AttributeCard
                        label="最小攻击"
                        value={attributes.CharacterMinAttack}
                        onChange={(v) => handleChange('CharacterMinAttack', v)}
                        max={750000}
                        icon={<Sword className="w-4 h-4" />}
                        color="cyan"
                    />
                    <AttributeCard
                        label="最大攻击"
                        value={attributes.CharacterMaxAttack}
                        onChange={(v) => handleChange('CharacterMaxAttack', v)}
                        max={750000}
                        icon={<Sword className="w-4 h-4" />}
                        color="purple"
                    />
                    <AttributeCard
                        label="气血"
                        value={attributes.CharacterHealth}
                        onChange={(v) => handleChange('CharacterHealth', v)}
                        max={4000000}
                        step={100}
                        icon={<Heart className="w-4 h-4" />}
                        color="red"
                    />
                    <AttributeCard
                        label="真气"
                        value={attributes.CharacterMana}
                        onChange={(v) => handleChange('CharacterMana', v)}
                        max={6000000}
                        step={100}
                        icon={<Zap className="w-4 h-4" />}
                        color="blue"
                    />
                    <AttributeCard
                        label="防御"
                        value={attributes.CharacterDefense}
                        onChange={(v) => handleChange('CharacterDefense', v)}
                        max={500000}
                        icon={<Shield className="w-4 h-4" />}
                        color="emerald"
                    />
                    <AttributeCard
                        label="暴击伤害 (%)"
                        value={attributes.CharacterCriticalHitDamagePercent}
                        onChange={(v) => handleChange('CharacterCriticalHitDamagePercent', v)}
                        max={3000}
                        icon={<Crosshair className="w-4 h-4" />}
                        color="yellow"
                    />
                    <AttributeCard
                        label="对怪增伤 (%)"
                        value={attributes.CharacterMonsterDamageIncreasePercent}
                        onChange={(v) => handleChange('CharacterMonsterDamageIncreasePercent', v)}
                        max={60}
                        icon={<Skull className="w-4 h-4" />}
                        color="orange"
                    />
                </div>
            </div>
        </div>
    );
};
