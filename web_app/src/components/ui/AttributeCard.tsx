import React, { useRef } from 'react';
import clsx from 'clsx';

const colorStyles: Record<string, { text: string; focus: string; border: string; thumb: string; tagBg: string }> = {
    cyan: { text: 'text-cyan-400', focus: 'focus:text-cyan-400', border: 'hover:border-cyan-500/50', thumb: 'bg-cyan-400', tagBg: 'text-cyan-400' },
    purple: { text: 'text-purple-400', focus: 'focus:text-purple-400', border: 'hover:border-purple-500/50', thumb: 'bg-purple-400', tagBg: 'text-purple-400' },
    red: { text: 'text-red-400', focus: 'focus:text-red-400', border: 'hover:border-red-500/50', thumb: 'bg-red-400', tagBg: 'text-red-400' },
    blue: { text: 'text-blue-400', focus: 'focus:text-blue-400', border: 'hover:border-blue-500/50', thumb: 'bg-blue-400', tagBg: 'text-blue-400' },
    emerald: { text: 'text-emerald-400', focus: 'focus:text-emerald-400', border: 'hover:border-emerald-500/50', thumb: 'bg-emerald-400', tagBg: 'text-emerald-400' },
    yellow: { text: 'text-yellow-400', focus: 'focus:text-yellow-400', border: 'hover:border-yellow-500/50', thumb: 'bg-yellow-400', tagBg: 'text-yellow-400' },
    orange: { text: 'text-orange-400', focus: 'focus:text-orange-400', border: 'hover:border-orange-500/50', thumb: 'bg-orange-400', tagBg: 'text-orange-400' },
};

interface AttributeCardProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    icon?: React.ReactNode;
    color?: keyof typeof colorStyles;
    tag?: string;
    /** 识图没识别到、且当前还是默认基线值 → 显示空（占位 —）+ 琥珀虚线边框 + 待填徽章 */
    unset?: boolean;
}

export const AttributeCard: React.FC<AttributeCardProps> = ({
    label,
    value,
    onChange,
    min = 0,
    max = 100000,
    step = 1,
    color = 'cyan',
    tag,
    unset = false,
}) => {
    const styles = colorStyles[color] || colorStyles.cyan;
    const inputRef = useRef<HTMLInputElement>(null);

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
        <div
            data-unset={unset ? '1' : '0'}
            className={clsx(
                "glass-panel h-[110px] p-2.5 sm:p-3.5 flex flex-col justify-between transition-all duration-300 animate-fade-in group",
                unset ? "border border-dashed border-amber-500/45" : styles.border
            )}
        >
            {/* Header: Label & Tag (Aligned with BuffSelector font style) */}
            <div className="w-full flex items-center justify-between text-xs font-bold mb-0.5">
                <span className={clsx(
                    "truncate transition-colors group-hover:text-white",
                    unset ? "text-amber-200/90" : "text-slate-300"
                )}>
                    {label}
                </span>
                {/* 未识别时让出右上角给标签，标签才能完整显示（「对怪增伤%」放不下会被截断） */}
                {tag && !unset && (
                    <span className={clsx("text-[10px] font-mono font-bold tracking-tight shrink-0 ml-auto", styles.tagBg)}>
                        {tag}
                    </span>
                )}
            </div>

            {/* Monospace Number Display */}
            <input
                type="number"
                size={1}
                inputMode="numeric"
                ref={inputRef}
                value={unset ? '' : value}
                onChange={handleChange}
                min={min}
                max={max}
                step={step}
                placeholder="—"
                title={unset ? `没识别到这一项，当前按默认值 ${value} 参与计算；点这里填一次` : undefined}
                className={clsx(
                    "w-full min-w-0 bg-transparent text-xl font-black text-center font-mono focus:outline-none transition-colors py-1",
                    unset ? "text-amber-300/80 placeholder:text-amber-400/50 placeholder:text-lg" : "text-white",
                    styles.focus
                )}
                style={{ fontVariantNumeric: 'tabular-nums' }}
            />

            {/* Slim Range Slider：按 step 跳变，精确值用上面的输入框改尾部。
                未识别（unset）时滑块没有意义（停在 0 会误导），换成一行明确提示。 */}
            {unset ? (
                <button
                    type="button"
                    onClick={() => inputRef.current?.focus()}
                    className="w-full text-[10px] leading-none mb-0.5 text-amber-400/85 hover:text-amber-300 transition-colors text-center"
                    title="这一项识图没识别到，点这里手动填一次"
                >
                    点此填写
                </button>
            ) : (
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    className={clsx(
                        "w-full h-1 appearance-none bg-transparent cursor-pointer focus:outline-none mb-0.5",
                        // Track styling
                        "[&::-webkit-slider-runnable-track]:w-full [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-slate-700/80 [&::-webkit-slider-runnable-track]:rounded-full",
                        // Thumb styling
                        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125",
                        `[&::-webkit-slider-thumb]:${styles.thumb}`
                    )}
                />
            )}
        </div>
    );
};
