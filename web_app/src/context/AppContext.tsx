import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CharacterAttributes, UserCharacter, CharacterClass, Buff } from '../types';
import { DataService } from '../services/DataService';
import { safeParseLocalStorage } from '../utils/storage';

interface AppState {
    isLoading: boolean;
    loadError: string | null;
    classes: CharacterClass[];
    buffs: Buff[];
    userCharacter: UserCharacter;
    activeBuffIds: string[];
    buffValues: Record<string, number>;
    selectedDungeonId: string | null;
}

interface AppContextType extends AppState {
    updateCharacterAttributes: (attrs: CharacterAttributes) => void;
    updateCharacterClass: (classId: string, faction: 'XIAN' | 'FO' | 'MO') => void;
    toggleBuff: (buffId: string) => void;
    updateBuffValue: (buffId: string, value: number) => void;
    selectDungeon: (dungeonId: string) => void;
    restoreBuffState: (activeIds: string[], values: Record<string, number>) => void;
}

/** 属性基线：分享编码（shareSnapshot.ts）依赖此常量做差分，改动需同步考虑旧链接兼容 */
export const defaultAttributes: CharacterAttributes = {
    CharacterMinAttack: 100000,
    CharacterMaxAttack: 120000,
    CharacterDefense: 5000,
    CharacterHealth: 1500000,
    CharacterMana: 1500000,
    CharacterCriticalHitDamagePercent: 1600,
    CharacterMonsterDamageIncreasePercent: 10
};

const defaultCharacter: UserCharacter = {
    UserID: 'guest',
    CharacterID: 'char_01',
    CharacterName: '道友',
    ClassID: 'ZHU_SHUANG',
    Faction: 'MO',
    Level: 170,
    BaseAttributes: defaultAttributes
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [classes, setClasses] = useState<CharacterClass[]>([]);
    const [buffs, setBuffs] = useState<Buff[]>([]);

    const [userCharacter, setUserCharacter] = useState<UserCharacter>(() =>
        safeParseLocalStorage<UserCharacter>('zx_user_character', defaultCharacter)
    );

    const [activeBuffIds, setActiveBuffIds] = useState<string[]>(() =>
        safeParseLocalStorage<string[]>('zx_active_buffs', [])
    );

    const [buffValues, setBuffValues] = useState<Record<string, number>>(() =>
        safeParseLocalStorage<Record<string, number>>('zx_buff_values', {})
    );

    const [selectedDungeonId, setSelectedDungeonId] = useState<string | null>(null);

    useEffect(() => {
        const initData = async () => {
            try {
                const service = DataService.getInstance();
                const errors = await service.loadAllData();
                if (errors.length > 0) {
                    setLoadError(`部分数据加载失败: ${errors.join(', ')}`);
                }
                const loadedBuffs = service.getBuffs();
                setClasses(service.getClasses());
                setBuffs(loadedBuffs);

                // Set default buffs if empty
                if (activeBuffIds.length === 0) {
                    const defaults = loadedBuffs.filter(b => b.IsDefaultActive).map(b => b.BuffID);
                    setActiveBuffIds(defaults);
                }

                // Initialize buff values if empty
                if (Object.keys(buffValues).length === 0) {
                    const initialValues: Record<string, number> = {};
                    loadedBuffs.forEach(b => {
                        initialValues[b.BuffID] = b.DefaultEffectValue ?? 0;
                    });
                    setBuffValues(initialValues);
                }
            } catch (err) {
                setLoadError(`数据加载异常: ${err instanceof Error ? err.message : String(err)}`);
            } finally {
                setIsLoading(false);
            }
        };
        initData();
    }, []);

    useEffect(() => {
        localStorage.setItem('zx_user_character', JSON.stringify(userCharacter));
    }, [userCharacter]);

    useEffect(() => {
        localStorage.setItem('zx_active_buffs', JSON.stringify(activeBuffIds));
    }, [activeBuffIds]);

    useEffect(() => {
        localStorage.setItem('zx_buff_values', JSON.stringify(buffValues));
    }, [buffValues]);

    const updateCharacterAttributes = (attrs: CharacterAttributes) => {
        setUserCharacter(prev => ({
            ...prev,
            BaseAttributes: attrs
        }));
    };

    const updateCharacterClass = (classId: string, faction: 'XIAN' | 'FO' | 'MO') => {
        setUserCharacter(prev => ({
            ...prev,
            ClassID: classId,
            Faction: faction
        }));
    };

    const toggleBuff = (buffId: string) => {
        setActiveBuffIds(prev =>
            prev.includes(buffId) ? prev.filter(id => id !== buffId) : [...prev, buffId]
        );
    };

    const updateBuffValue = (buffId: string, value: number) => {
        setBuffValues(prev => ({
            ...prev,
            [buffId]: value
        }));
    };

    const selectDungeon = (dungeonId: string) => {
        setSelectedDungeonId(dungeonId);
    };

    // 批量恢复 buff 状态（方案切换用）
    const restoreBuffState = (activeIds: string[], values: Record<string, number>) => {
        setActiveBuffIds(activeIds);
        setBuffValues(values);
    };

    return (
        <AppContext.Provider value={{
            isLoading,
            loadError,
            classes,
            buffs,
            userCharacter,
            activeBuffIds,
            buffValues,
            selectedDungeonId,
            updateCharacterAttributes,
            updateCharacterClass,
            toggleBuff,
            updateBuffValue,
            selectDungeon,
            restoreBuffState
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
};
