import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { DataService } from '../../services/DataService';
import type { SimTarget } from '../../services/vision/runPanelSimulation';

export interface DungeonBossPickerProps {
    value: SimTarget | null;
    onChange: (t: SimTarget | null) => void;
    disabled?: boolean;
}

const LAST_KEY = 'zx_vision_last_target';

/** 副本 + BOSS 选择。不预选（删除历史硬编码 T20 的行为），只记忆上次选择。 */
export const DungeonBossPicker: React.FC<DungeonBossPickerProps> = ({ value, onChange, disabled }) => {
    const dungeons = useMemo(() => {
        try {
            return DataService.getInstance().getDungeons() || [];
        } catch {
            return [];
        }
    }, []);

    const monstersByDungeon = useMemo(() => {
        try {
            return DataService.getInstance().getDungeonsMonsters() || {};
        } catch {
            return {} as Record<string, any[]>;
        }
    }, []);

    const [dungeonId, setDungeonId] = useState<string>(value?.dungeonId || '');
    const [bossId, setBossId] = useState<string>(value?.bossId || '');
    const [lastLabel, setLastLabel] = useState<string>('');

    // 首次挂载：显示"上次选择"提示，但不自动套用
    useEffect(() => {
        try {
            const last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
            if (last?.dungeonName && last?.bossName) setLastLabel(`${last.dungeonName} · ${last.bossName}`);
        } catch { /* ignore */ }
    }, []);

    const bosses = dungeonId ? (monstersByDungeon[dungeonId] || []) : [];

    const emit = (dId: string, bId: string) => {
        if (!dId || !bId) { onChange(null); return; }
        const d = dungeons.find(x => x.DungeonID === dId);
        const b = (monstersByDungeon[dId] || []).find((m: any) => m.MonsterID === bId);
        if (!d || !b) { onChange(null); return; }
        const target: SimTarget = {
            dungeonId: dId,
            dungeonName: d.DungeonName,
            bossId: bId,
            bossName: (b as any).MonsterName || bId
        };
        onChange(target);
        try { localStorage.setItem(LAST_KEY, JSON.stringify(target)); } catch { /* ignore */ }
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <select
                data-testid="dungeon-select"
                disabled={disabled}
                value={dungeonId}
                onChange={e => {
                    const v = e.target.value;
                    setDungeonId(v);
                    setBossId('');
                    emit(v, '');
                }}
                className="text-[11px] bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-slate-300 outline-none focus:border-cyan-500/40 max-w-[190px]"
            >
                <option value="">副本：请选择</option>
                {dungeons.map(d => (
                    <option key={d.DungeonID} value={d.DungeonID}>{d.DungeonName}</option>
                ))}
            </select>

            <select
                data-testid="boss-select"
                disabled={disabled || !dungeonId}
                value={bossId}
                onChange={e => {
                    const v = e.target.value;
                    setBossId(v);
                    emit(dungeonId, v);
                }}
                className={clsx(
                    'text-[11px] bg-black/40 border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-cyan-500/40 max-w-[190px]',
                    dungeonId ? 'text-slate-300' : 'text-slate-500'
                )}
            >
                <option value="">{dungeonId ? 'BOSS：请选择' : 'BOSS：先选副本'}</option>
                {(bosses as any[]).map((m: any) => (
                    <option key={m.MonsterID} value={m.MonsterID}>
                        {m.MonsterName}{m.role === 'add' ? '（小怪）' : ''}
                    </option>
                ))}
            </select>

            {lastLabel && !dungeonId && (
                <span className="text-[10px] text-slate-500 whitespace-nowrap">上次：{lastLabel}</span>
            )}
        </div>
    );
};
