import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DataService } from '../../services/DataService';
import { User, X, ChevronRight, Lock } from 'lucide-react';
import clsx from 'clsx';

const RACES = ['人族', '神族', '天脉', '苍祇'];

export const ClassSelector: React.FC = () => {
    const { classes, userCharacter, updateCharacterClass } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('人族');

    // Find current class object
    const currentClass = classes.find(c => c.ClassID === userCharacter.ClassID);
    const service = DataService.getInstance();

    const handleClassSelect = (classId: string, isSupported: boolean) => {
        if (!isSupported) return;
        updateCharacterClass(classId, userCharacter.Faction);
        setIsModalOpen(false);
    };

    return (
        <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></span>
                职业选择
            </h2>

            {/* Selected Class Display (Trigger) */}
            <div
                onClick={() => setIsModalOpen(true)}
                className="glass-panel p-4 md:py-4 md:px-6 h-[124px] cursor-pointer transition-all duration-300 hover:border-blue-500/50 group relative overflow-hidden border-blue-500/30 bg-blue-500/5 flex items-center"
            >
                <div className="flex items-center justify-between relative z-10 w-full">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-2.5 md:p-3 rounded-xl bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                            <User className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <div className="text-xs text-blue-400 font-bold mb-0.5 tracking-wide">当前职业</div>
                            <div className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 drop-shadow-lg tracking-wider flex items-center gap-2 md:gap-3">
                                {currentClass?.ClassName || '未选择'}
                                <span className="text-[10px] md:text-xs font-bold text-blue-300 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full bg-blue-500/20 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)] tracking-normal whitespace-nowrap">
                                    {currentClass?.Race || '未知'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 text-slate-400 group-hover:text-blue-300 transition-colors">
                        <span className="text-xs md:text-sm font-bold tracking-wide whitespace-nowrap">切换职业</span>
                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                </div>

                {/* Background Glow */}
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all" />
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsModalOpen(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                            <h3 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-2 tracking-wide">
                                <User className="w-5 h-5 text-blue-500" />
                                选择职业
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-800 bg-slate-900/30 px-2 md:px-4">
                            {RACES.map(race => (
                                <button
                                    key={race}
                                    onClick={() => setActiveTab(race)}
                                    className={clsx(
                                        'flex-1 md:flex-none px-2 md:px-8 py-3 md:py-4 text-sm md:text-base font-black tracking-wider transition-all relative text-center whitespace-nowrap',
                                        activeTab === race
                                            ? 'text-blue-400'
                                            : 'text-slate-500 hover:text-slate-300'
                                    )}
                                >
                                    {race}
                                    {activeTab === race && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Grid Content */}
                        <div className="p-3 md:p-6 overflow-y-auto custom-scrollbar bg-slate-950/50">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                {classes
                                    .filter(cls => cls.Race === activeTab)
                                    .map(cls => {
                                        const isActive = userCharacter.ClassID === cls.ClassID;
                                        const skills = service.getSkills(cls.ClassID);
                                        const isSupported = !!skills && Object.keys(skills).length > 0;

                                        return (
                                            <div
                                                key={cls.ClassID}
                                                onClick={() => handleClassSelect(cls.ClassID, isSupported)}
                                                className={clsx(
                                                    'glass-panel p-3 md:p-4 transition-all duration-300 group relative overflow-hidden flex flex-col items-center gap-2 md:gap-3',
                                                    isSupported ? 'cursor-pointer hover:border-blue-500/50' : 'cursor-not-allowed opacity-50 grayscale',
                                                    isActive
                                                        ? 'border-blue-500/70 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                                        : 'border-slate-700 hover:bg-slate-800/50'
                                                )}
                                            >
                                                <div className={clsx(
                                                    'p-2 md:p-3 rounded-xl transition-all relative z-10',
                                                    isActive
                                                        ? 'bg-blue-500/20 text-blue-400 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                                                        : 'bg-slate-800/50 text-slate-400 group-hover:bg-slate-700/50'
                                                )}>
                                                    {isSupported ? <User className="w-5 h-5 md:w-6 md:h-6" /> : <Lock className="w-5 h-5 md:w-6 md:h-6" />}
                                                </div>

                                                <span className={clsx(
                                                    'font-black text-sm md:text-base tracking-wide relative z-10',
                                                    isActive ? 'text-blue-200 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-slate-300'
                                                )}>
                                                    {cls.ClassName}
                                                </span>

                                                {!isSupported && (
                                                    <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">
                                                        未开放
                                                    </span>
                                                )}

                                                {isActive && (
                                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-80" />
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
