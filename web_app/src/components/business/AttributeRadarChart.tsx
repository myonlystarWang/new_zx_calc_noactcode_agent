import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { CharacterAttributes } from '../../types';

interface AttributeRadarChartProps {
    attributes: CharacterAttributes;
}

export const AttributeRadarChart: React.FC<AttributeRadarChartProps> = ({ attributes }) => {
    // 定义每个属性的颜色
    const attributeColors = {
        // '攻击': '#06b6d4', // cyan 
        '攻击': '#a855f7', // purple
        '防御': '#10b981', // emerald
        '气血': '#ef4444', // red
        '真气': '#3b82f6', // blue
        '暴伤': '#f59e0b', // amber
        '对怪': '#f97316'  // orange
    };

    // Normalize data for the chart (scale to 0-100)
    const data = [
        {
            subject: '攻击',
            value: (attributes.CharacterMaxAttack / 750000) * 100,
            fullMark: 100
        },
        {
            subject: '防御',
            value: (attributes.CharacterDefense / 500000) * 100,
            fullMark: 100
        },
        {
            subject: '气血',
            value: (attributes.CharacterHealth / 4000000) * 100,
            fullMark: 100
        },
        {
            subject: '真气',
            value: (attributes.CharacterMana / 6000000) * 100,
            fullMark: 100
        },
        {
            subject: '暴伤',
            value: (attributes.CharacterCriticalHitDamagePercent / 3000) * 100,
            fullMark: 100
        },
        {
            subject: '对怪',
            value: (attributes.CharacterMonsterDamageIncreasePercent / 60) * 100,
            fullMark: 100
        },
    ];

    // 自定义标签渲染函数 - 用不同颜色显示标签
    const CustomLabel = (props: any) => {
        const { x, y, payload } = props;
        const label = payload.value as string;
        const color = attributeColors[label as keyof typeof attributeColors] || '#94a3b8';

        let textAnchor: "middle" | "start" | "end" = 'middle';
        if (['防御', '气血'].includes(label)) {
            textAnchor = 'start';
        } else if (['暴伤', '对怪'].includes(label)) {
            textAnchor = 'end';
        }

        // 微调垂直位置
        let dy = 0;
        if (label === '攻击') dy = -5;
        if (label === '真气') dy = 5;

        return (
            <text
                x={x}
                y={y}
                dy={dy}
                fill={color}
                fontSize={16}
                fontWeight="600"
                textAnchor={textAnchor}
                dominantBaseline="middle"
            >
                {label}
            </text>
        );
    };

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid
                        stroke="#334155"
                        strokeWidth={1}
                        gridType="polygon"
                    />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={CustomLabel}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                    />
                    <Radar
                        name="属性值"
                        dataKey="value"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        fill="url(#radarGradient)"
                        fillOpacity={0.6}
                    />
                    <defs>
                        <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.3} />
                        </linearGradient>
                    </defs>
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};
