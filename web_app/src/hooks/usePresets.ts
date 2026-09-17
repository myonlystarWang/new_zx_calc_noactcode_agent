import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CharacterAttributes } from '../types';
import { useApp } from '../context/AppContext';
import { safeParseLocalStorage } from '../utils/storage';

export interface Preset {
    id: string;
    name: string;
    classId: string;
    faction: 'XIAN' | 'FO' | 'MO';
    attributes: CharacterAttributes;
    activeBuffIds: string[];
    buffValues: Record<string, number>;
    createdAt: number;
    updatedAt: number;
}

interface PresetSnapshot {
    classId: string;
    faction: 'XIAN' | 'FO' | 'MO';
    attributes: CharacterAttributes;
    activeBuffIds: string[];
    buffValues: Record<string, number>;
}

const STORAGE_KEY = 'zx_presets';
const ACTIVE_PRESET_KEY = 'zx_active_preset_id';

function generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sameStringArray(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
}

function sameRecord(a: Record<string, number>, b: Record<string, number>): boolean {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => a[k] === b[k]);
}

function isSameSnapshot(a: PresetSnapshot, b: PresetSnapshot): boolean {
    if (a.classId !== b.classId || a.faction !== b.faction) return false;
    if (JSON.stringify(a.attributes) !== JSON.stringify(b.attributes)) return false;
    if (!sameStringArray(a.activeBuffIds, b.activeBuffIds)) return false;
    return sameRecord(a.buffValues, b.buffValues);
}

export const usePresets = () => {
    const {
        userCharacter,
        activeBuffIds,
        buffValues,
        updateCharacterAttributes,
        updateCharacterClass,
        restoreBuffState
    } = useApp();

    const [presets, setPresets] = useState<Preset[]>(() =>
        safeParseLocalStorage<Preset[]>(STORAGE_KEY, [])
    );
    const [activePresetId, setActivePresetId] = useState<string | null>(() => {
        const savedId = safeParseLocalStorage<string | null>(ACTIVE_PRESET_KEY, null);
        const list = safeParseLocalStorage<Preset[]>(STORAGE_KEY, []);
        return list.some(p => p.id === savedId) ? savedId : null;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    }, [presets]);

    useEffect(() => {
        if (activePresetId) {
            localStorage.setItem(ACTIVE_PRESET_KEY, JSON.stringify(activePresetId));
        } else {
            localStorage.removeItem(ACTIVE_PRESET_KEY);
        }
    }, [activePresetId]);

    const activePreset = useMemo(
        () => presets.find(p => p.id === activePresetId) ?? null,
        [presets, activePresetId]
    );

    // 当前配置快照
    const currentSnapshot = useMemo<PresetSnapshot>(() => ({
        classId: userCharacter.ClassID,
        faction: userCharacter.Faction,
        attributes: userCharacter.BaseAttributes,
        activeBuffIds,
        buffValues
    }), [userCharacter, activeBuffIds, buffValues]);

    // 是否有未保存的修改
    const isDirty = useMemo(() => {
        if (!activePreset) return false;
        return !isSameSnapshot(currentSnapshot, {
            classId: activePreset.classId,
            faction: activePreset.faction,
            attributes: activePreset.attributes,
            activeBuffIds: activePreset.activeBuffIds,
            buffValues: activePreset.buffValues
        });
    }, [activePreset, currentSnapshot]);

    // 保存：已选中方案 -> 覆盖更新；未选中 -> 新建并选中
    const savePreset = useCallback((name: string) => {
        const now = Date.now();
        if (activePreset) {
            setPresets(prev => prev.map(p =>
                p.id === activePreset.id ? { ...p, name, ...currentSnapshot, updatedAt: now } : p
            ));
            return;
        }
        const preset: Preset = {
            id: generateId(),
            name,
            ...currentSnapshot,
            createdAt: now,
            updatedAt: now
        };
        setPresets(prev => [...prev, preset]);
        setActivePresetId(preset.id);
    }, [activePreset, currentSnapshot]);

    // 另存为：总是新建一份
    const saveAsPreset = useCallback((name: string) => {
        const now = Date.now();
        const preset: Preset = {
            id: generateId(),
            name,
            ...currentSnapshot,
            createdAt: now,
            updatedAt: now
        };
        setPresets(prev => [...prev, preset]);
        setActivePresetId(preset.id);
    }, [currentSnapshot]);

    // 加载方案：职业/阵营/属性/buff 一次性恢复
    const loadPreset = useCallback((id: string) => {
        const preset = presets.find(p => p.id === id);
        if (!preset) return;
        updateCharacterClass(preset.classId, preset.faction);
        updateCharacterAttributes(preset.attributes);
        restoreBuffState(preset.activeBuffIds, preset.buffValues);
        setActivePresetId(id);
    }, [presets, updateCharacterClass, updateCharacterAttributes, restoreBuffState]);

    // 删除方案
    const deletePreset = useCallback((id: string) => {
        setPresets(prev => prev.filter(p => p.id !== id));
        setActivePresetId(prev => (prev === id ? null : prev));
    }, []);

    return {
        presets,
        activePresetId,
        activePreset,
        isDirty,
        savePreset,
        saveAsPreset,
        loadPreset,
        deletePreset
    };
};
