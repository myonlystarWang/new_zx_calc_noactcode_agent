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
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></span>
                阵营选择
            </h2>

            <div className="grid grid-cols-3 gap-2 md:gap-4">
                {FACTIONS.map((faction) => {
                    const isActive = userCharacter.Faction === faction.id;

                    const colorClasses = {
                        cyan: {
                            active: 'border-cyan-500/70 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
                            icon: 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]',
                            text: 'text-cyan-300',
                            hover: 'hover:border-cyan-500/50',
                            bar: 'via-cyan-500'
                        },
                        yellow: {
                            active: 'border-yellow-500/70 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
                            icon: 'bg-yellow-500/20 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)]',
                            text: 'text-yellow-300',
                            hover: 'hover:border-yellow-500/50',
                            bar: 'via-yellow-500'
                        },
                        purple: {
                            active: 'border-purple-500/70 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
                            icon: 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]',
                            text: 'text-purple-300',
                            hover: 'hover:border-purple-500/50',
                            bar: 'via-purple-500'
                        }
                    };

                    const colors = colorClasses[faction.color];

                    return (
                        <div
                            key={faction.id}
                            onClick={() => updateCharacterClass(userCharacter.ClassID, faction.id as any)}
                            className={clsx(
                                'glass-panel p-3 md:p-3 h-[124px] flex items-center justify-center cursor-pointer transition-all duration-300 group relative overflow-hidden',
                                isActive ? colors.active : `border-slate-700 hover:bg-slate-800/50 ${colors.hover}`
                            )}
                        >
                            <div className="flex flex-col items-center justify-center gap-1 md:gap-2 text-center relative z-10">
                                <div className={clsx(
                                    'p-2 md:p-2.5 rounded-xl transition-all duration-300',
                                    isActive
                                        ? `${colors.icon} scale-110`
                                        : 'bg-slate-800/50 text-slate-400 group-hover:bg-slate-700/50'
                                )}>
                                    <Swords className="w-4 h-4 md:w-5 md:h-5" />
                                </div>

                                <span className={clsx(
                                    'font-bold text-sm md:text-lg',
                                    isActive ? colors.text : 'text-slate-300'
                                )}>
                                    {faction.name}
                                </span>
                            </div>

                            {isActive && (
                                <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${colors.bar} to-transparent opacity-80`} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
