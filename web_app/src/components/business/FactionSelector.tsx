import React from 'react';
import { useApp } from '../../context/AppContext';
import { Swords } from 'lucide-react';
import clsx from 'clsx';

const FACTIONS = [
    { id: 'XIAN', name: '仙', color: 'cyan' },
    { id: 'FO', name: '佛', color: 'yellow' },
    { id: 'MO', name: '魔', color: 'purple' }
] as const;

export const FactionSelector: React.FC = () => {
    const { userCharacter, updateCharacterClass } = useApp();

    return (
        <div>
            <h2 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full"></span>
                阵营选择
            </h2>

            <div className="grid grid-cols-3 gap-2">
                {FACTIONS.map((faction) => {
                    const isActive = userCharacter.Faction === faction.id;

                    const colorClasses = {
                        cyan: {
                            active: 'border-cyan-500/70 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
                            text: 'text-cyan-300',
                            hover: 'hover:border-cyan-500/50',
                            bar: 'bg-cyan-500'
                        },
                        yellow: {
                            active: 'border-yellow-500/70 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
                            text: 'text-yellow-300',
                            hover: 'hover:border-yellow-500/50',
                            bar: 'bg-yellow-500'
                        },
                        purple: {
                            active: 'border-purple-500/70 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]',
                            text: 'text-purple-300',
                            hover: 'hover:border-purple-500/50',
                            bar: 'bg-purple-500'
                        }
                    };

                    const colors = colorClasses[faction.color];

                    return (
                        <div
                            key={faction.id}
                            onClick={() => updateCharacterClass(userCharacter.ClassID, faction.id as any)}
                            className={clsx(
                                'glass-panel p-2.5 h-[102px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 group relative overflow-hidden',
                                isActive ? colors.active : `border-slate-700/80 hover:bg-slate-800/50 ${colors.hover}`
                            )}
                        >
                            <Swords className={clsx("w-4 h-4 transition-colors relative z-10", isActive ? colors.text : "text-slate-400 group-hover:text-slate-300")} />

                            <span className={clsx(
                                'font-black text-xs relative z-10',
                                isActive ? colors.text : 'text-slate-300'
                            )}>
                                {faction.name}
                            </span>

                            {isActive && (
                                <div className={`absolute bottom-0 left-0 w-full h-1 ${colors.bar}`} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
