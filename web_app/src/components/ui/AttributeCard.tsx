import React from 'react';
import clsx from 'clsx';

const colorStyles: Record<string, { bg: string; text: string; accent: string; focus: string; border: string; thumb: string }> = {
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', accent: 'accent-cyan-500', focus: 'focus:text-cyan-400', border: 'hover:border-cyan-500/50', thumb: 'bg-cyan-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', accent: 'accent-purple-500', focus: 'focus:text-purple-400', border: 'hover:border-purple-500/50', thumb: 'bg-purple-400' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400', accent: 'accent-red-500', focus: 'focus:text-red-400', border: 'hover:border-red-500/50', thumb: 'bg-red-400' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', accent: 'accent-blue-500', focus: 'focus:text-blue-400', border: 'hover:border-blue-500/50', thumb: 'bg-blue-400' },
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', accent: 'accent-emerald-500', focus: 'focus:text-emerald-400', border: 'hover:border-emerald-500/50', thumb: 'bg-emerald-400' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', accent: 'accent-yellow-500', focus: 'focus:text-yellow-400', border: 'hover:border-yellow-500/50', thumb: 'bg-yellow-400' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', accent: 'accent-orange-500', focus: 'focus:text-orange-400', border: 'hover:border-orange-500/50', thumb: 'bg-orange-400' },
};

interface AttributeCardProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    icon: React.ReactNode;
    color?: keyof typeof colorStyles;
}

export const AttributeCard: React.FC<AttributeCardProps> = ({
    label,
    value,
    onChange,
    min = 0,
    max = 100000,
    step = 1,
    icon,
    color = 'cyan'
}) => {
    const styles = colorStyles[color] || colorStyles.cyan;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value === '') {
            onChange(min > 0 ? min : 0);
            return;
        }
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= min && val <= max) {
            onChange(val);
        } else if (!isNaN(val) && val > max) {
            onChange(max);
        } else if (!isNaN(val) && val < min) {
            onChange(min);
        }
    };

    return (
        <div className={clsx(
            "glass-panel p-2.5 flex flex-col gap-2 transition-all duration-300 animate-fade-in group",
            styles.border
        )}>
            {/* Header: Icon & Label Centered Row */}
            <div className="flex items-center justify-center gap-3">
                <div className={clsx(
                    'p-2 rounded-lg transition-transform group-hover:scale-110 shadow-sm shrink-0',
                    styles.bg,
                    styles.text
                )}>
                    {icon}
                </div>
                <span className="text-sm font-bold text-slate-300 tracking-wide whitespace-nowrap">{label}</span>
            </div>

            {/* Large Number Display */}
            <input
                type="number"
                value={value}
                onChange={handleChange}
                min={min}
                max={max}
                step={step}
                className={clsx(
                    "bg-transparent text-lg font-black text-white w-full text-center focus:outline-none transition-colors py-1",
                    styles.focus
                )}
                style={{ fontVariantNumeric: 'tabular-nums' }}
            />

            {/* Slider */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                className={clsx(
                    "w-full h-1.5 appearance-none bg-transparent cursor-pointer focus:outline-none",
                    // Track styling
                    "[&::-webkit-slider-runnable-track]:w-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full",
                    // Thumb styling
                    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
                    `[&::-webkit-slider-thumb]:${styles.thumb}`
                )}
            />
        </div>
    );
};
