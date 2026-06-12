import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    BarChart2,
    BookOpen,
    ChevronRight,
    Clock,
    Database,
    Pause,
    Play,
    RotateCcw,
    Search,
    SkipBack,
    SkipForward,
    SlidersHorizontal,
    Swords,
    Target,
    Users,
    X
} from 'lucide-react';
import { assembleScenario, runSimulation } from '@zx/simulation-engine';
import type {
    CharacterAttributes,
    DpsStrategyConfig,
    Dungeon,
    HitDamageRecord,
    Monster,
    SimEventLog,
    SimulationResult,
    Skill
} from '../../types';
import { DataService } from '../../services/DataService';
import defaultOverrides from '../../../public/game_data/default_overrides.json';
import { StrategyEditor } from './StrategyEditor';
import { SimulationReport } from './SimulationReport';
import clsx from 'clsx';

const XIAN_RECOMMENDED_SKILLS = [
    'ZS_XIAN_SKILL_ZGDD',
    'ZS_XIAN_SKILL_QXHS',
    'ZS_XIAN_SKILL_LZYY',
    'ZS_XIAN_SKILL_YZXW',
    'ZS_XIAN_SKILL_CLXX',
    'ZS_XIAN_SKILL_CLX',
    'ZS_XIAN_SKILL_YLXB',
    'ZS_XIAN_SKILL_SY3',
    'ZS_XIAN_SKILL_YYZC_XUAN',
    'ZS_XIAN_SKILL_YYZC',
    'ZS_XIAN_SKILL_LYLZ'
];

const MO_RECOMMENDED_SKILLS = [
    'ZS_MO_SKILL_ZGDD',
    'ZS_MO_SKILL_QXHS',
    'ZS_MO_SKILL_LZYY',
    'ZS_MO_SKILL_SY2',
    'ZS_MO_SKILL_SY3',
    'ZS_MO_SKILL_CLX',
    'ZS_MO_SKILL_YYZC',
    'ZS_MO_SKILL_CLXS',
    'ZS_MO_SKILL_YLXB',
    'ZS_MO_SKILL_YYZC_SHA',
    'ZS_MO_SKILL_LYLZ'
];

const DEFAULT_SKILL_EXPIRY_MS_BY_FACTION: Record<'XIAN' | 'MO', Record<string, number>> = {
    XIAN: {
        ZS_XIAN_SKILL_ZGDD: 0,
        ZS_XIAN_SKILL_QXHS: 16000
    },
    MO: {
        ZS_MO_SKILL_ZGDD: 0,
        ZS_MO_SKILL_QXHS: 16000
    }
};

const DEFAULT_DPS_START_DELAY_MS = defaultOverrides.dpsStartDelayMs;

interface DpsCommonEffectToggles {
    sanwanFocus: boolean;
    jiuhuaCriticalDamage: boolean;
    shenbaoAttack: boolean;
    fozunAttack: boolean;
    familyStats: boolean;
    artifactEffects: boolean;
}

interface DungeonEffectToggles {
    greenPoint150: boolean;
    attack: boolean;
    criticalDamage: boolean;
    purplePoint: boolean;
    harmed: boolean;
}

const defaultDpsCommonEffects: DpsCommonEffectToggles = {
    sanwanFocus: true,
    jiuhuaCriticalDamage: false,
    shenbaoAttack: false,
    fozunAttack: false,
    familyStats: false,
    artifactEffects: false
};

const defaultDungeonEffects: DungeonEffectToggles = {
    greenPoint150: true,
    attack: false,
    criticalDamage: false,
    purplePoint: false,
    harmed: false
};

const DISABLED_SIMULATION_SKILL_IDS = [
    'TY_FO_SKILL_DCB', 'TY_FO_SKILL_MKXJ', 'ZM_FO_SKILL_FGSL',
    'YZ_FO_SKILL_TGFM', 'YZ_FO_SKILL_WXBG', 'TH_FO_SKILL_MQYY',
    'TH_FO_SKILL_YSYY2', 'TH_FO_SKILL_JLS', 'TH_FO_SKILL_FQH'
] as const;

const PARTIAL_SIMULATION_SKILL_IDS = [
    'TH_FO_SKILL_JSKW', 'TH_FO_SKILL_QSYY',
    'ZS_XIAN_SKILL_LZYY', 'ZS_MO_SKILL_LZYY',
    'ZS_XIAN_SKILL_ZGDD', 'ZS_MO_SKILL_ZGDD',
    'ZS_XIAN_SKILL_QXHS', 'ZS_MO_SKILL_QXHS'
] as const;

const SUPPORT_ACTION_TYPES = new Set(['BUFF', 'DEBUFF', 'UTILITY']);
const DISABLED_SIMULATION_SKILL_ID_SET = new Set<string>(DISABLED_SIMULATION_SKILL_IDS);
const PARTIAL_SIMULATION_SKILL_ID_SET = new Set<string>(PARTIAL_SIMULATION_SKILL_IDS);

const FACTION_LABEL: Record<string, string> = {
    XIAN: '仙',
    FO: '佛',
    MO: '魔'
};

const CLASS_LABEL: Record<string, string> = {
    ZHU_SHUANG: '逐霜',
    TIAN_YIN: '天音',
    FEN_XIANG: '焚香',
    ZHAO_MING: '昭冥',
    YING_ZHAO: '英招',
    TIAN_HUA: '天华'
};

const ATTRIBUTE_FIELDS: { key: keyof CharacterAttributes; label: string; suffix?: string }[] = [
    { key: 'CharacterMinAttack', label: '最小攻击' },
    { key: 'CharacterMaxAttack', label: '最大攻击' },
    { key: 'CharacterDefense', label: '防御' },
    { key: 'CharacterHealth', label: '气血' },
    { key: 'CharacterMana', label: '真气' },
    { key: 'CharacterCriticalHitDamagePercent', label: '爆伤', suffix: '%' },
    { key: 'CharacterCriticalHitRatePercent', label: '暴击率', suffix: '%' },
    { key: 'CharacterMonsterDamageIncreasePercent', label: '对怪增伤', suffix: '%' },
    { key: 'CharacterOnePercentAttack', label: '1%攻击折算' },
    { key: 'CharacterOnePercentDefense', label: '1%防御折算' },
    { key: 'CharacterOnePercentHealth', label: '1%气血折算' },
    { key: 'CharacterOnePercentMana', label: '1%真气折算' }
];

const SEARCH_ALIASES: Record<string, string[]> = {
    ZHU_SHUANG: ['zhushuang', 'zs', 'zhushuangxian', 'zhushuangmo'],
    TIAN_YIN: ['tianyin', 'ty'],
    FEN_XIANG: ['fenxiang', 'fx'],
    ZHAO_MING: ['zhaoming', 'zm'],
    YING_ZHAO: ['yingzhao', 'yz'],
    TIAN_HUA: ['tianhua', 'th'],
    ZHENHAI_DUANLANG_T20: ['zhenhai', 'duanlang', 't20'],
    ZHENHAI_DUANLANG_T21: ['zhenhai', 'duanlang', 't21'],
    CHI_SUO_T20: ['chisu', 'chisuo', 't20boss'],
    CHI_SUO_T21: ['chisu', 'chisuo', 't21boss'],
    ZS_XIAN_SKILL_CLX: ['canglongxiao', 'clx'],
    ZS_MO_SKILL_CLX: ['canglongxiao', 'clx'],
    ZS_XIAN_SKILL_YLXB: ['yinlinxuanbing', 'ylxb'],
    ZS_MO_SKILL_YLXB: ['yinlinxuanbing', 'ylxb'],
    ZS_XIAN_SKILL_LZYY: ['longzhanyuye', 'lzyy'],
    ZS_MO_SKILL_LZYY: ['longzhanyuye', 'lzyy'],
    ZS_XIAN_SKILL_ZGDD: ['zhenggedaidan', 'zgdd'],
    ZS_MO_SKILL_ZGDD: ['zhenggedaidan', 'zgdd'],
    ZS_XIAN_SKILL_QXHS: ['qingxiaohengshuo', 'qxhs'],
    ZS_MO_SKILL_QXHS: ['qingxiaohengshuo', 'qxhs'],
    TY_FO_SKILL_WLYZ: ['wuliangzhenyan', 'wlyz'],
    TY_FO_SKILL_WLYZ_CHAN: ['wuliangzhenyanchan', 'wlyzc'],
    ZM_FO_SKILL_FGSL: ['fugushengling', 'fgsl']
};

const initialDpsAttributes: CharacterAttributes = defaultOverrides.dpsAttributes as CharacterAttributes;

const defaultSupportAttributes: CharacterAttributes = {
    CharacterMinAttack: 200000,
    CharacterMaxAttack: 220000,
    CharacterDefense: 300000,
    CharacterHealth: 3000000,
    CharacterMana: 4000000,
    CharacterCriticalHitDamagePercent: 800,
    CharacterMonsterDamageIncreasePercent: 25,
    CharacterOnePercentAttack: 1000,
    CharacterOnePercentDefense: 1500,
    CharacterOnePercentHealth: 20000,
    CharacterOnePercentMana: 30000
};

type FourthGenQuality = 'YING_JU' | 'HAO_YUE' | 'XI_RI' | 'NONE';

interface SkillOverrideConfig {
    FourthGenQuality?: Exclude<FourthGenQuality, 'NONE'>;
    SkillLevel?: number;
    Variant?: string;
    Enabled?: boolean;
    RyhgPhase2DelaySeconds?: number;
}

interface DpsSkillConfig extends SkillOverrideConfig { }

interface SupportConfig {
    actorId: string;
    classId: string;
    faction: 'XIAN' | 'FO' | 'MO';
    profileAttributes: CharacterAttributes;
    skillOverrides?: Record<string, SkillOverrideConfig>;
}

const initialSupports: SupportConfig[] = [
    {
        actorId: 'tianyin_sup',
        classId: 'TIAN_YIN',
        faction: 'FO',
        profileAttributes: { ...defaultSupportAttributes },
        skillOverrides: (defaultOverrides.supportOverrides as any)['tianyin_sup']
    },
    {
        actorId: 'fenxiang_sup',
        classId: 'FEN_XIANG',
        faction: 'FO',
        profileAttributes: { ...defaultSupportAttributes },
        skillOverrides: (defaultOverrides.supportOverrides as any)['fenxiang_sup']
    },
    {
        actorId: 'zhaoming_sup',
        classId: 'ZHAO_MING',
        faction: 'FO',
        profileAttributes: { ...defaultSupportAttributes },
        skillOverrides: (defaultOverrides.supportOverrides as any)['zhaoming_sup']
    },
    {
        actorId: 'yingzhao_sup',
        classId: 'YING_ZHAO',
        faction: 'FO',
        profileAttributes: { ...defaultSupportAttributes },
        skillOverrides: (defaultOverrides.supportOverrides as any)['yingzhao_sup']
    },
    {
        actorId: 'tianhua_sup',
        classId: 'TIAN_HUA',
        faction: 'FO',
        profileAttributes: { ...defaultSupportAttributes },
        skillOverrides: (defaultOverrides.supportOverrides as any)['tianhua_sup']
    }
];

type DrawerMode = 'dps' | 'team' | 'strategy' | 'boss' | 'analysis' | 'data' | 'skill' | 'event' | null;

interface TimelineEvent {
    id: string;
    lane: 'cast' | 'buff' | 'debuff' | 'damage';
    timeMs: number;
    title: string;
    subtitle: string;
    raw?: SimEventLog | HitDamageRecord;
}

interface ActiveEffectView {
    instanceId: string;
    effectId: string;
    name: string;
    targetId: string;
    sourceActorId?: string;
    sourceSkillId?: string;
    sourceSkillName?: string;
    endTimeMs: number;
    remainingMs: number;
    effects: Record<string, number>;
}

const DEFAULT_DPS_FOURTH_GEN_QUALITY: Exclude<FourthGenQuality, 'NONE'> = defaultOverrides.dpsDefaultFourthGenQuality as Exclude<FourthGenQuality, 'NONE'>;
const SIMULATION_MAX_TIME_MS = 300000;
const DAMAGE_AUDIT_RANDOM_SEED = 20260609;
const YBJH_GREEN_MULTIPLIER_FIELD = 'BuffMonsterCriticalDamageMultiplierEffect';

const getRecommendedSkillsForFaction = (faction: 'XIAN' | 'MO') => (
    faction === 'XIAN' ? XIAN_RECOMMENDED_SKILLS : MO_RECOMMENDED_SKILLS
);

const getDefaultSkillExpiryMsForFaction = (faction: 'XIAN' | 'MO') => ({
    ...DEFAULT_SKILL_EXPIRY_MS_BY_FACTION[faction]
});

const createDefaultDpsSkillConfigs = (skillIds: string[]): Record<string, DpsSkillConfig> => (
    Object.fromEntries(skillIds.map(skillId => [skillId, { FourthGenQuality: DEFAULT_DPS_FOURTH_GEN_QUALITY }]))
);

const isDpsSkillEnabled = (skillId: string, configs: Record<string, DpsSkillConfig>) => (
    configs[skillId]?.Enabled !== false
);

const cleanDpsSkillConfig = (config: DpsSkillConfig): DpsSkillConfig => {
    const next: DpsSkillConfig = { ...config };
    if (next.Enabled === true) delete next.Enabled;
    Object.keys(next).forEach(key => {
        const typedKey = key as keyof DpsSkillConfig;
        if (next[typedKey] === undefined || next[typedKey] === '') {
            delete next[typedKey];
        }
    });
    return next;
};

const filterDpsStrategyByEnabled = (strategy: DpsStrategyConfig, enabledSkillIds: Set<string>): DpsStrategyConfig => {
    if (strategy.type === 'MANUAL_TIMELINE') {
        return {
            ...strategy,
            actions: strategy.actions.filter(action => enabledSkillIds.has(action.skillId))
        };
    }

    const nextSkillIds = strategy.skillIds.filter(skillId => enabledSkillIds.has(skillId));
    const nextExpiry = Object.fromEntries(
        Object.entries(strategy.skillExpiryMs || {}).filter(([skillId]) => enabledSkillIds.has(skillId))
    );

    return {
        ...strategy,
        skillIds: nextSkillIds,
        ...(Object.keys(nextExpiry).length > 0 ? { skillExpiryMs: nextExpiry } : { skillExpiryMs: undefined })
    } as DpsStrategyConfig;
};

const buildDpsEngineSkillOverrides = (
    skills: Skill[],
    configs: Record<string, DpsSkillConfig>
): Record<string, SkillOverrideConfig> => {
    const overrides: Record<string, SkillOverrideConfig> = {};
    skills.forEach(skill => {
        if (!isDpsSkillEnabled(skill.SkillID, configs)) return;

        const config = configs[skill.SkillID];
        if (!config) return;

        const override: SkillOverrideConfig = {};
        if (config.FourthGenQuality && skill.FourthGenPresets?.[config.FourthGenQuality]) {
            override.FourthGenQuality = config.FourthGenQuality;
        }
        if (config.SkillLevel) override.SkillLevel = config.SkillLevel;
        if (config.Variant) override.Variant = config.Variant;

        if (Object.keys(override).length > 0) {
            overrides[skill.SkillID] = override;
        }
    });
    return overrides;
};

const isConfiguredSkillEnabled = (skillId: string, overrides?: Record<string, SkillOverrideConfig>) => (
    overrides?.[skillId]?.Enabled !== false
);

const stripUiSkillOverrideFields = (
    overrides?: Record<string, SkillOverrideConfig>
): Record<string, SkillOverrideConfig> | undefined => {
    if (!overrides) return undefined;

    const engineOverrides: Record<string, SkillOverrideConfig> = {};
    Object.entries(overrides).forEach(([skillId, override]) => {
        const engineOverride: SkillOverrideConfig = { ...override };
        delete engineOverride.Enabled;
        if (Object.keys(engineOverride).length > 0) {
            engineOverrides[skillId] = engineOverride;
        }
    });

    return Object.keys(engineOverrides).length > 0 ? engineOverrides : undefined;
};

interface ExplorerItem {
    id: string;
    type: 'skill' | 'boss' | 'class';
    title: string;
    subtitle: string;
    tokens: string[];
    skill?: Skill;
    boss?: Monster;
    dungeon?: Dungeon;
}

type SelectedEntity =
    | { type: 'dps' }
    | { type: 'support'; index: number }
    | { type: 'boss'; boss?: Monster; dungeon?: Dungeon }
    | { type: 'skill'; skill: Skill }
    | { type: 'event'; event: TimelineEvent }
    | { type: 'explorer'; item: ExplorerItem }
    | null;

const drawerTitle: Record<Exclude<DrawerMode, null>, string> = {
    dps: '主输出配置',
    team: '队伍与技能',
    strategy: '技能栏与时间轴',
    boss: 'Boss 与副本',
    analysis: '战斗分析',
    data: '资料查询',
    skill: '技能详情',
    event: '时间轴事件'
};

const normalizeSearch = (value: string) =>
    value.toLowerCase().replace(/[\s_\-·.()（）【】[\]]/g, '');

const formatLargeNumber = (num: number): string => {
    if (num >= 100000000) return `${(num / 100000000).toFixed(2)} 亿`;
    if (num >= 10000) return `${(num / 10000).toFixed(2)} 万`;
    return Math.round(num).toLocaleString();
};

const formatMs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export const SimulationArena: React.FC = () => {
    const service = DataService.getInstance();
    const allSkills = service.getAllSkills();
    const dungeonsMonsters = service.getDungeonsMonsters();
    const dungeons = service.getDungeons();

    const [activeDrawer, setActiveDrawer] = useState<DrawerMode>(null);
    const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [dpsFaction, setDpsFaction] = useState<'XIAN' | 'MO'>('MO');
    const [dpsAttributes, setDpsAttributes] = useState<CharacterAttributes>(initialDpsAttributes);
    const [dpsSkillConfigs, setDpsSkillConfigs] = useState<Record<string, DpsSkillConfig>>(
        () => createDefaultDpsSkillConfigs(MO_RECOMMENDED_SKILLS)
    );
    const [strategy, setStrategy] = useState<DpsStrategyConfig>({
        type: 'SKILL_BAR',
        skillIds: MO_RECOMMENDED_SKILLS,
        startTimeMs: DEFAULT_DPS_START_DELAY_MS,
        scanMode: 'FROM_FIRST_EACH_DECISION',
        skillExpiryMs: getDefaultSkillExpiryMsForFaction('MO'),
        waitMs: 0
    });
    const [supports, setSupports] = useState<SupportConfig[]>(initialSupports);
    const [dpsCommonEffects, setDpsCommonEffects] = useState<DpsCommonEffectToggles>(defaultDpsCommonEffects);
    const [dungeonEffects, setDungeonEffects] = useState<DungeonEffectToggles>(defaultDungeonEffects);
    const [selectedDungeonId, setSelectedDungeonId] = useState<string>('ZHENHAI_DUANLANG_T20');
    const [selectedBossId, setSelectedBossId] = useState<string>('CHI_SUO_T20');
    const [customBossHp, setCustomBossHp] = useState<string>('');
    const [damageAuditEnabled, setDamageAuditEnabled] = useState<boolean>(true);

    const [simulationResult, setSimulationResult] = useState<SimulationResult | undefined>(undefined);
    const [baselineResult, setBaselineResult] = useState<SimulationResult | undefined>(undefined);
    const [isResultStale, setIsResultStale] = useState<boolean>(false);
    const [isSimulating, setIsSimulating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

    const dpsSkillsPool = useMemo(() => {
        return allSkills?.ZHU_SHUANG?.[dpsFaction] || [];
    }, [allSkills, dpsFaction]);

    const explorerItems = useMemo<ExplorerItem[]>(() => {
        const items: ExplorerItem[] = [];

        Object.entries(CLASS_LABEL).forEach(([classId, className]) => {
            const classSkills = allSkills?.[classId] || {};
            const skillCount = Object.values(classSkills).reduce((sum, skills) => sum + skills.length, 0);
            items.push({
                id: `class:${classId}`,
                type: 'class',
                title: className,
                subtitle: `${classId} · 已录入 ${skillCount} 个技能`,
                tokens: [classId, className, ...(SEARCH_ALIASES[classId] || [])]
            });
        });

        if (allSkills) {
            Object.entries(allSkills).forEach(([classId, factionMap]) => {
                Object.entries(factionMap).forEach(([faction, skills]) => {
                    skills.forEach(skill => {
                        items.push({
                            id: `skill:${skill.SkillID}`,
                            type: 'skill',
                            title: skill.SkillName,
                            subtitle: `${CLASS_LABEL[classId] || classId} · ${FACTION_LABEL[faction] || faction} · ${skill.SkillID}`,
                            tokens: [
                                skill.SkillID,
                                skill.SkillID.replace(/_/g, ''),
                                skill.SkillName,
                                skill.RequiredClass,
                                skill.Faction,
                                ...(SEARCH_ALIASES[skill.SkillID] || []),
                                ...(SEARCH_ALIASES[skill.RequiredClass] || [])
                            ],
                            skill
                        });
                    });
                });
            });
        }

        dungeons.forEach(dungeon => {
            dungeon.Monsters.forEach(boss => {
                items.push({
                    id: `boss:${boss.MonsterID}`,
                    type: 'boss',
                    title: boss.MonsterName,
                    subtitle: `${dungeon.DungeonName} · ${boss.MonsterID}`,
                    tokens: [
                        dungeon.DungeonID,
                        dungeon.DungeonName,
                        boss.MonsterID,
                        boss.MonsterID.replace(/_/g, ''),
                        boss.MonsterName,
                        ...(SEARCH_ALIASES[dungeon.DungeonID] || []),
                        ...(SEARCH_ALIASES[boss.MonsterID] || [])
                    ],
                    boss,
                    dungeon
                });
            });
        });

        return items;
    }, [allSkills, dungeons]);

    const filteredExplorerItems = useMemo(() => {
        const query = normalizeSearch(searchQuery);
        if (!query) return explorerItems.slice(0, 80);
        return explorerItems.filter(item =>
            item.tokens.some(token => normalizeSearch(String(token)).includes(query))
        ).slice(0, 120);
    }, [explorerItems, searchQuery]);

    useEffect(() => {
        if (!isPlaying || !simulationResult) return;
        const replayDurationMs = getResultReplayDurationMs(simulationResult);
        const intervalTime = 50;
        const timer = setInterval(() => {
            setCurrentTimeMs(prev => {
                const next = prev + intervalTime * playbackSpeed;
                if (next >= replayDurationMs) {
                    setIsPlaying(false);
                    return replayDurationMs;
                }
                return next;
            });
        }, intervalTime);
        return () => clearInterval(timer);
    }, [isPlaying, playbackSpeed, simulationResult]);

    const markResultStale = () => {
        if (simulationResult) {
            setIsResultStale(true);
            setIsPlaying(false);
        }
    };

    const updateDpsSkillConfig = (skillId: string, patch: DpsSkillConfig) => {
        markResultStale();
        setDpsSkillConfigs(prev => {
            const nextConfig = cleanDpsSkillConfig({ ...(prev[skillId] || {}), ...patch });
            const next = { ...prev };
            if (Object.keys(nextConfig).length > 0) {
                next[skillId] = nextConfig;
            } else {
                delete next[skillId];
            }
            return next;
        });
    };

    const openDrawer = (drawer: Exclude<DrawerMode, null>, entity: SelectedEntity = null) => {
        setSelectedEntity(entity);
        setActiveDrawer(drawer);
    };

    const getSkillStatus = (skillId: string) => {
        if (DISABLED_SIMULATION_SKILL_ID_SET.has(skillId)) {
            return {
                label: '未启用',
                tone: 'text-red-300 border-red-500/30 bg-red-500/10',
                dot: 'bg-red-500',
                explanation: '该技能当前仅供页面查阅，不参与本阶段默认仿真结算。'
            };
        }
        if (PARTIAL_SIMULATION_SKILL_ID_SET.has(skillId)) {
            return {
                label: '部分启用',
                tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
                dot: 'bg-amber-500',
                explanation: '该技能已有部分字段参与计算，未覆盖字段仍按当前阶段范围处理。'
            };
        }
        return {
            label: '参与结算',
            tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
            dot: 'bg-emerald-500',
            explanation: '该技能当前会按已录入字段参与模拟计算。'
        };
    };

    const getEnabledSupportSkillIds = (support: SupportConfig) => {
        if (!allSkills) return [];
        const factionSkills = allSkills[support.classId]?.[support.faction] || [];
        return factionSkills
            .filter(skill =>
                skill.ActionType !== undefined &&
                SUPPORT_ACTION_TYPES.has(skill.ActionType) &&
                !DISABLED_SIMULATION_SKILL_ID_SET.has(skill.SkillID) &&
                isConfiguredSkillEnabled(skill.SkillID, support.skillOverrides)
            )
            .map(skill => skill.SkillID);
    };

    const getSupportSkills = (classId: string, faction: 'XIAN' | 'FO' | 'MO') => {
        return allSkills?.[classId]?.[faction] || [];
    };

    if (!allSkills || !dungeonsMonsters || dungeons.length === 0) {
        return (
            <div className="py-12 text-center text-slate-400 font-medium">
                加载副本训练场数据源中...
            </div>
        );
    }

    const currentDungeon = dungeons.find(d => d.DungeonID === selectedDungeonId) || dungeons[0];
    const currentBoss = currentDungeon?.Monsters.find(m => m.MonsterID === selectedBossId) || currentDungeon?.Monsters[0];
    const bossHealthValue = customBossHp.trim() !== ''
        ? (parseFloat(customBossHp) || 0)
        : (currentBoss?.MonsterAttributeModifiers.MonsterHealth || 0);
    const resultDurationMs = simulationResult ? getResultReplayDurationMs(simulationResult) : 60000;
    const bossMaxHp = simulationResult?.boss.startingHealth || bossHealthValue || 1;
    const hitsBeforeCurrent = simulationResult?.hitRecords.filter(h => h.TimeMs <= currentTimeMs) || [];
    const latestHit = hitsBeforeCurrent[hitsBeforeCurrent.length - 1];
    const currentElapsedSeconds = simulationResult
        ? Math.max(0.001, (currentTimeMs - (simulationResult.summary.DpsStartMs || 0)) / 1000)
        : 0;
    const currentBossHp = simulationResult
        ? (simulationResult.boss.killedAtMs !== undefined && currentTimeMs >= simulationResult.boss.killedAtMs
            ? 0
            : Math.max(0, latestHit?.BossHpAfter ?? simulationResult.boss.startingHealth))
        : bossHealthValue;
    const currentBossHpPercent = Math.max(0, Math.min(100, (currentBossHp / bossMaxHp) * 100));
    const inspectBossHp = simulationResult ? currentBossHp : undefined;
    const isBossDead = Boolean(simulationResult?.boss.killedAtMs !== undefined && currentTimeMs >= simulationResult.boss.killedAtMs);
    const actorNameById: Record<string, string> = {
        zhushuang_dps: `逐霜 · ${FACTION_LABEL[dpsFaction]}`
    };
    supports.forEach(support => {
        actorNameById[support.actorId] = `${CLASS_LABEL[support.classId] || support.classId} · ${FACTION_LABEL[support.faction] || support.faction}`;
    });
    const skillDamageRanks = buildSkillDamageRanks(hitsBeforeCurrent);
    const actorDpsRanks = buildActorDpsRanks(hitsBeforeCurrent, currentElapsedSeconds || 1, actorNameById);
    const dpsDamageFeed = hitsBeforeCurrent
        .filter(hit => hit.ActorId === 'zhushuang_dps')
        .slice(-8)
        .reverse();

    const skillNameLookup = buildSkillNameLookup(allSkills);
    const activeEffects = buildActiveEffectViews(simulationResult, currentTimeMs, skillNameLookup);
    const dpsActiveEffects = activeEffects.filter(effect => effect.targetId === 'zhushuang_dps');
    const bossActiveEffects = activeEffects.filter(effect => effect.targetId === 'boss');
    const timelineEvents = buildTimelineEvents(simulationResult, resultDurationMs, skillNameLookup, actorNameById);
    const groupedTimeline = {
        cast: timelineEvents.filter(event => event.lane === 'cast').slice(0, 80),
        buff: timelineEvents.filter(event => event.lane === 'buff').slice(0, 80),
        debuff: timelineEvents.filter(event => event.lane === 'debuff').slice(0, 80),
        damage: timelineEvents.filter(event => event.lane === 'damage').slice(0, 100)
    };

    const handleRunSimulation = () => {
        setIsSimulating(true);
        setError(null);

        setTimeout(() => {
            try {
                let bossHealthOverride: number | undefined = undefined;
                if (customBossHp.trim() !== '') {
                    const parsed = parseFloat(customBossHp);
                    if (!isNaN(parsed) && parsed > 0) {
                        bossHealthOverride = parsed;
                    }
                }

                const enabledDpsSkillIds = new Set(
                    dpsSkillsPool
                        .filter(skill => isDpsSkillEnabled(skill.SkillID, dpsSkillConfigs))
                        .map(skill => skill.SkillID)
                );
                const simulationStrategy = filterDpsStrategyByEnabled(strategy, enabledDpsSkillIds);
                const skillOverrides = buildDpsEngineSkillOverrides(dpsSkillsPool, dpsSkillConfigs);

                const simInput = {
                    scenarioId: `web-sim-${Date.now()}`,
                    maxTimeMs: SIMULATION_MAX_TIME_MS,
                    dungeonId: selectedDungeonId,
                    bossId: selectedBossId,
                    bossHealthOverride,
                    dpsActor: {
                        actorId: 'zhushuang_dps',
                        classId: 'ZHU_SHUANG',
                        faction: dpsFaction,
                        profileAttributes: dpsAttributes,
                        skillOverrides,
                        strategy: simulationStrategy
                    },
                    supports: supports.map(s => ({
                        actorId: s.actorId,
                        classId: s.classId,
                        faction: s.faction,
                        profileAttributes: s.profileAttributes,
                        skillOverrides: stripUiSkillOverrideFields(s.skillOverrides),
                        skillIds: getEnabledSupportSkillIds(s)
                    })),
                    damageAudit: damageAuditEnabled
                        ? { enabled: true, actorId: 'zhushuang_dps', maxRecords: 600 }
                        : undefined,
                    dpsCommonEffects,
                    dungeonEffects,
                    randomSeed: damageAuditEnabled ? DAMAGE_AUDIT_RANDOM_SEED : undefined
                };

                const scenario = assembleScenario(simInput, {
                    skills: allSkills,
                    monstersByDungeon: dungeonsMonsters
                });

                const result = runSimulation(scenario);
                setSimulationResult(result);
                setCurrentTimeMs(0);
                setIsPlaying(false);
                setIsResultStale(false);
            } catch (err: any) {
                console.error(err);
                setError(err.message || '仿真装配或计算出错，请检查输入配置。');
            } finally {
                setIsSimulating(false);
            }
        }, 50);
    };

    const handleSetBaseline = () => {
        if (simulationResult) {
            setBaselineResult(simulationResult);
        }
    };

    const handleClearBaseline = () => {
        setBaselineResult(undefined);
    };

    const handleResetAll = () => {
        setDpsFaction('MO');
        setDpsAttributes(initialDpsAttributes);
        setDpsSkillConfigs(createDefaultDpsSkillConfigs(MO_RECOMMENDED_SKILLS));
        setStrategy({
            type: 'SKILL_BAR',
            skillIds: MO_RECOMMENDED_SKILLS,
            startTimeMs: DEFAULT_DPS_START_DELAY_MS,
            scanMode: 'FROM_FIRST_EACH_DECISION',
            skillExpiryMs: getDefaultSkillExpiryMsForFaction('MO'),
            waitMs: 0
        });
        setSupports(initialSupports);
        setDpsCommonEffects(defaultDpsCommonEffects);
        setDungeonEffects(defaultDungeonEffects);
        setSelectedDungeonId('ZHENHAI_DUANLANG_T20');
        setSelectedBossId('CHI_SUO_T20');
        setCustomBossHp('');
        setDamageAuditEnabled(false);
        setSimulationResult(undefined);
        setBaselineResult(undefined);
        setIsResultStale(false);
        setCurrentTimeMs(0);
        setIsPlaying(false);
        setError(null);
    };

    const handleDpsFactionChange = (faction: 'XIAN' | 'FO' | 'MO') => {
        if (faction !== 'XIAN' && faction !== 'MO') return;
        markResultStale();
        const nextSkillIds = getRecommendedSkillsForFaction(faction);
        setDpsFaction(faction);
        setDpsSkillConfigs(createDefaultDpsSkillConfigs(nextSkillIds));
        setStrategy({
            type: 'SKILL_BAR',
            skillIds: nextSkillIds,
            startTimeMs: DEFAULT_DPS_START_DELAY_MS,
            scanMode: 'FROM_FIRST_EACH_DECISION',
            skillExpiryMs: getDefaultSkillExpiryMsForFaction(faction),
            waitMs: 0
        });
    };

    const renderDrawerContent = () => {
        if (activeDrawer === 'dps') {
            return (
                <DpsDrawerPanel
                    dpsFaction={dpsFaction}
                    dpsAttributes={dpsAttributes}
                    dpsSkillConfigs={dpsSkillConfigs}
                    onDpsFactionChange={handleDpsFactionChange}
                    onDpsAttributesChange={(next) => {
                        markResultStale();
                        setDpsAttributes(next);
                    }}
                    onDpsSkillConfigChange={updateDpsSkillConfig}
                    dpsSkills={dpsSkillsPool}
                    getSkillStatus={getSkillStatus}
                    onOpenSkill={(skill) => openDrawer('skill', { type: 'skill', skill })}
                />
            );
        }

        if (activeDrawer === 'team') {
            return (
                <TeamDrawerPanel
                    supports={supports}
                    onSupportsChange={(next) => {
                        markResultStale();
                        setSupports(next);
                    }}
                    allSkills={allSkills}
                    getSkillStatus={getSkillStatus}
                    onOpenSkill={(skill) => openDrawer('skill', { type: 'skill', skill })}
                />
            );
        }

        if (activeDrawer === 'strategy') {
            return (
                <StrategyEditor
                    dpsSkills={dpsSkillsPool}
                    strategy={strategy}
                    onStrategyChange={(next) => {
                        markResultStale();
                        setStrategy(next);
                    }}
                />
            );
        }

        if (activeDrawer === 'boss') {
            return (
                <BossDrawerPanel
                    selectedDungeonId={selectedDungeonId}
                    selectedBossId={selectedBossId}
                    customBossHp={customBossHp}
                    onDungeonChange={(nextDungeonId) => {
                        markResultStale();
                        setSelectedDungeonId(nextDungeonId);
                        const nextDungeon = dungeons.find(dungeon => dungeon.DungeonID === nextDungeonId);
                        const nextBoss = nextDungeon?.Monsters[0];
                        if (nextBoss) setSelectedBossId(nextBoss.MonsterID);
                    }}
                    onBossChange={(nextBossId) => {
                        markResultStale();
                        setSelectedBossId(nextBossId);
                    }}
                    onHpChange={(nextHp) => {
                        markResultStale();
                        setCustomBossHp(nextHp);
                    }}
                    inspectBossHp={inspectBossHp}
                    startingHp={simulationResult?.boss.startingHealth}
                    dungeons={dungeons}
                />
            );
        }

        if (activeDrawer === 'analysis') {
            if (!simulationResult) {
                return <EmptyDrawerMessage icon={<BarChart2 className="w-5 h-5" />} title="暂无战斗报告" message="启动仿真后，DPS 曲线、Boss 血线、技能占比、覆盖率、事件日志和 A/B 对比会出现在这里。" />;
            }
            return (
                <SimulationReport
                    result={simulationResult}
                    baselineResult={baselineResult}
                    onSetBaseline={handleSetBaseline}
                    onClearBaseline={handleClearBaseline}
                    currentTimeMs={currentTimeMs}
                    setCurrentTimeMs={setCurrentTimeMs}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    playbackSpeed={playbackSpeed}
                    setPlaybackSpeed={setPlaybackSpeed}
                />
            );
        }

        if (activeDrawer === 'data') {
            const activeItem = selectedEntity?.type === 'explorer' ? selectedEntity.item : filteredExplorerItems[0];
            return (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 min-h-[560px]">
                    <div className="space-y-3">
                        <label className="relative block">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索中文名、JSON ID、常用拼音别名"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
                            />
                        </label>
                        <div className="max-h-[590px] overflow-y-auto pr-1 space-y-2">
                            {filteredExplorerItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedEntity({ type: 'explorer', item })}
                                    className={clsx(
                                        'w-full text-left p-3 rounded-xl border transition-colors',
                                        activeItem?.id === item.id
                                            ? 'bg-cyan-500/10 border-cyan-500/30'
                                            : 'bg-slate-950/45 border-slate-800 hover:border-slate-700'
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-slate-100 truncate">{item.title}</span>
                                        <span className="text-[10px] uppercase text-slate-500">{item.type}</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <ExplorerDetail
                        item={activeItem}
                        getSkillStatus={getSkillStatus}
                        onOpenSkill={(skill) => openDrawer('skill', { type: 'skill', skill })}
                    />
                </div>
            );
        }

        if (activeDrawer === 'skill') {
            const skill = selectedEntity?.type === 'skill' ? selectedEntity.skill : undefined;
            return skill
                ? <SkillDetail skill={skill} getSkillStatus={getSkillStatus} />
                : <EmptyDrawerMessage icon={<BookOpen className="w-5 h-5" />} title="未选择技能" message="点击技能格或资料查询结果后，会在这里显示技能详情。" />;
        }

        if (activeDrawer === 'event') {
            const event = selectedEntity?.type === 'event' ? selectedEntity.event : undefined;
            return event
                ? <TimelineEventDetail event={event} />
                : <EmptyDrawerMessage icon={<Clock className="w-5 h-5" />} title="未选择时间轴节点" message="点击底部轨道中的节点查看事件详情。" />;
        }

        return null;
    };

    return (
        <div className="w-full max-w-[1800px] mx-auto" data-theme={dpsFaction}>
            {error && (
                <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-red-300">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold block mb-0.5 text-sm">战斗装配失败</span>
                        {error}
                    </div>
                </div>
            )}

            <div className="min-h-[760px] xl:h-[calc(100vh-122px)] grid grid-rows-[minmax(0,1fr)_188px] gap-3">
                <div className="grid grid-cols-1 xl:grid-cols-[286px_minmax(0,1fr)_314px] gap-3 min-h-0">
                    <PartyRail
                        dpsFaction={dpsFaction}
                        supports={supports}
                        allSkills={allSkills}
                        getSupportSkills={getSupportSkills}
                        getSkillStatus={getSkillStatus}
                        onOpenDps={() => openDrawer('dps', { type: 'dps' })}
                        onOpenSupport={(index) => openDrawer('team', { type: 'support', index })}
                        onOpenSkill={(skill) => openDrawer('skill', { type: 'skill', skill })}
                    />

                    <main
                        className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl h-full min-h-0"
                        style={{
                            backgroundImage: "linear-gradient(180deg, rgba(15,23,42,0.04), rgba(2,6,23,0.58)), url('/arena/arena-bg.svg')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.05),transparent_42%)] pointer-events-none" />
                        <div className="relative h-full min-h-0 p-4 lg:p-5 flex flex-col">
                            <div className="flex items-start justify-between gap-4">
                                <button
                                    type="button"
                                    onClick={() => openDrawer('boss', { type: 'boss', boss: currentBoss, dungeon: currentDungeon })}
                                    className="text-left flex-1 group"
                                >
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <div>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.24em]">{currentDungeon?.DungeonName || '未选择副本'}</p>
                                            <h2 className="mt-1 text-2xl lg:text-3xl font-black text-slate-50 tracking-wide">{currentBoss?.MonsterName || '未选择 Boss'}</h2>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                                    </div>
                                    <div className="h-5 rounded-full bg-slate-950/80 border border-slate-800 overflow-hidden">
                                        <div
                                            className={clsx(
                                                'h-full transition-all duration-300',
                                                currentBossHpPercent < 20 ? 'bg-red-500' : 'bg-gradient-to-r from-red-700 via-red-500 to-amber-300'
                                            )}
                                            style={{ width: `${currentBossHpPercent}%` }}
                                        />
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-300 font-mono">
                                        <span>{formatLargeNumber(currentBossHp)} / {formatLargeNumber(bossMaxHp)}</span>
                                        <span>{currentBossHpPercent.toFixed(1)}%</span>
                                    </div>
                                </button>

                                <div className="flex gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleResetAll}
                                        className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors"
                                        title="重置训练场"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSimulating}
                                        onClick={handleRunSimulation}
                                        className="h-10 px-4 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-300 disabled:opacity-60 font-black text-xs flex items-center gap-2 transition-colors"
                                    >
                                        {isSimulating ? (
                                            <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Play className="w-4 h-4 fill-current" />
                                        )}
                                        启动仿真
                                    </button>
                                </div>
                            </div>

                            <EffectStatusHud
                                hasResult={Boolean(simulationResult)}
                                dpsEffects={dpsActiveEffects}
                                bossEffects={bossActiveEffects}
                            />

                            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_250px] gap-3 py-3">
                                <DamageFeedPanel hits={dpsDamageFeed} hasResult={Boolean(simulationResult)} />

                                <div className="relative min-h-[210px] flex items-center justify-center">
                                    <div className="absolute bottom-5 w-[82%] h-14 rounded-full border border-cyan-500/15 bg-cyan-500/[0.025]" />
                                    <div className="absolute bottom-8 w-[54%] h-8 rounded-full border border-amber-300/10" />
                                    <button
                                        type="button"
                                        onClick={() => openDrawer('boss', { type: 'boss', boss: currentBoss, dungeon: currentDungeon })}
                                        className="relative w-48 h-48 lg:w-56 lg:h-56 rounded-full border border-red-400/20 bg-slate-950/25 backdrop-blur-[2px] shadow-[0_0_70px_rgba(127,29,29,0.28)] grid place-items-center group"
                                    >
                                        <div className="absolute inset-7 rounded-full border border-red-300/10" />
                                        <Swords className="w-20 h-20 lg:w-24 lg:h-24 text-red-200/75 group-hover:text-red-100 transition-colors" />
                                        {isBossDead && (
                                            <span className="absolute bottom-7 px-3 py-1 rounded-full bg-red-500/20 border border-red-300/30 text-red-100 text-xs font-black">
                                                已击杀
                                            </span>
                                        )}
                                    </button>
                                </div>

                                <BattleRankPanel
                                    skillDamageRanks={skillDamageRanks}
                                    actorDpsRanks={actorDpsRanks}
                                    hasResult={Boolean(simulationResult)}
                                />
                            </div>

                            {isResultStale && (
                                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    配置已修改，当前战报已过期。点击“启动仿真”后会重新计算。
                                </div>
                            )}
                        </div>
                    </main>

                    <CommandRail
                        simulationResult={simulationResult}
                        isResultStale={isResultStale}
                        currentBoss={currentBoss}
                        currentDungeon={currentDungeon}
                        strategy={strategy}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        damageAuditEnabled={damageAuditEnabled}
                        setDamageAuditEnabled={(enabled) => {
                            markResultStale();
                            setDamageAuditEnabled(enabled);
                        }}
                        dpsCommonEffects={dpsCommonEffects}
                        setDpsCommonEffects={(next) => {
                            markResultStale();
                            setDpsCommonEffects(next);
                        }}
                        dungeonEffects={dungeonEffects}
                        setDungeonEffects={(next) => {
                            markResultStale();
                            setDungeonEffects(next);
                        }}
                        onOpenBoss={() => openDrawer('boss', { type: 'boss', boss: currentBoss, dungeon: currentDungeon })}
                        onOpenStrategy={() => openDrawer('strategy')}
                        onOpenData={() => openDrawer('data')}
                        onOpenAnalysis={() => openDrawer('analysis')}
                    />
                </div>

                <TimelineDock
                    currentTimeMs={currentTimeMs}
                    durationMs={resultDurationMs}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    groupedTimeline={groupedTimeline}
                    onTimeChange={setCurrentTimeMs}
                    onPlayToggle={() => simulationResult && setIsPlaying(!isPlaying)}
                    onSpeedChange={setPlaybackSpeed}
                    onOpenStrategy={() => openDrawer('strategy')}
                    onOpenEvent={(event) => {
                        setCurrentTimeMs(event.timeMs);
                        openDrawer('event', { type: 'event', event });
                    }}
                />
            </div>

            {activeDrawer && createPortal(
                <div className="fixed inset-0 z-[9000] flex justify-end bg-slate-950/50 backdrop-blur-sm">
                    <button
                        type="button"
                        aria-label="关闭抽屉背景"
                        className="absolute inset-0"
                        onClick={() => setActiveDrawer(null)}
                    />
                    <aside className="relative h-full w-full max-w-[760px] border-l border-slate-700 bg-slate-950 shadow-2xl flex flex-col">
                        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/65">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400">训练场抽屉</p>
                                <h3 className="text-sm font-black text-slate-100">{drawerTitle[activeDrawer]}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveDrawer(null)}
                                className="w-9 h-9 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors"
                                title="关闭"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {renderDrawerContent()}
                        </div>
                    </aside>
                </div>,
                document.body
            )}

        </div>
    );
};

function buildSkillNameLookup(allSkills: Record<string, Record<string, Skill[]>>) {
    const lookup: Record<string, string> = {};
    Object.values(allSkills).forEach(factionMap => {
        Object.values(factionMap).forEach(skills => {
            skills.forEach(skill => {
                lookup[skill.SkillID] = skill.SkillName;
            });
        });
    });
    return lookup;
}

function buildSkillDamageRanks(hits: HitDamageRecord[]) {
    const totalDamage = hits.reduce((sum, hit) => sum + hit.DamageApplied, 0);
    const bySkill = new Map<string, { skillId: string; skillName: string; totalDamage: number; hitCount: number }>();
    hits.forEach(hit => {
        const existing = bySkill.get(hit.SkillId) || {
            skillId: hit.SkillId,
            skillName: hit.SkillName,
            totalDamage: 0,
            hitCount: 0
        };
        existing.totalDamage += hit.DamageApplied;
        existing.hitCount += 1;
        bySkill.set(hit.SkillId, existing);
    });
    return Array.from(bySkill.values())
        .map(item => ({
            ...item,
            percent: totalDamage > 0 ? (item.totalDamage / totalDamage) * 100 : 0
        }))
        .sort((a, b) => b.totalDamage - a.totalDamage)
        .slice(0, 5);
}

function buildActorDpsRanks(
    hits: HitDamageRecord[],
    elapsedSeconds: number,
    actorNameById: Record<string, string>
) {
    const byActor = new Map<string, { actorId: string; actorName: string; totalDamage: number }>();
    hits.forEach(hit => {
        const existing = byActor.get(hit.ActorId) || {
            actorId: hit.ActorId,
            actorName: actorNameById[hit.ActorId] || hit.ActorId,
            totalDamage: 0
        };
        existing.totalDamage += hit.DamageApplied;
        byActor.set(hit.ActorId, existing);
    });
    return Array.from(byActor.values())
        .map(item => ({
            ...item,
            dps: item.totalDamage / Math.max(elapsedSeconds, 0.001)
        }))
        .sort((a, b) => b.dps - a.dps)
        .slice(0, 5);
}

function getResultReplayDurationMs(result: SimulationResult) {
    const lastEventMs = result.events.reduce((max, event) => Math.max(max, event.timeMs), 0);
    const lastHitMs = result.hitRecords.reduce((max, hit) => Math.max(max, hit.TimeMs), 0);
    return Math.max(
        1000,
        result.summary.DpsDurationMs || 0,
        result.boss.killedAtMs || 0,
        lastEventMs,
        lastHitMs
    );
}

function buildActiveEffectViews(
    result: SimulationResult | undefined,
    currentTimeMs: number,
    skillNameLookup: Record<string, string>
): ActiveEffectView[] {
    if (!result) return [];

    const active = new Map<string, ActiveEffectView>();
    const events = result.events
        .filter(event => event.timeMs <= currentTimeMs)
        .sort((a, b) => a.timeMs === b.timeMs ? (a.sequence ?? 0) - (b.sequence ?? 0) : a.timeMs - b.timeMs);

    events.forEach(event => {
        const data = event.data || {};

        if (event.type === 'BUFF_EXPIRE') {
            const instanceId = String(data.instanceId || data.appliedInstanceId || '');
            if (instanceId) active.delete(instanceId);
            return;
        }

        if (event.type === 'BUFF_EXTEND') {
            const instanceId = String(data.instanceId || '');
            const newEndTimeMs = Number(data.newEndTimeMs || 0);
            const existing = active.get(instanceId);
            if (existing && newEndTimeMs > 0) {
                existing.endTimeMs = newEndTimeMs;
                existing.remainingMs = Math.max(0, newEndTimeMs - currentTimeMs);
            }
            return;
        }

        if (event.type !== 'BUFF_APPLY') return;

        const replacedInstanceIds = Array.isArray(data.replacedInstanceIds)
            ? data.replacedInstanceIds.map(String)
            : [];
        replacedInstanceIds.forEach(instanceId => active.delete(instanceId));

        if (event.status !== 'PROCESSED' || data.ignored) return;

        const effect = data.effect as {
            EffectId?: string;
            EffectID?: string;
            EffectName?: string;
            BuffEffects?: Record<string, number>;
        } | undefined;
        const instanceId = String(data.appliedInstanceId || '');
        const endTimeMs = Number(data.appliedEndTimeMs || 0);
        if (!effect || !instanceId) return;

        const sourceSkillId = String(data.sourceSkillId || event.skillId || '');
        const effectId = String(effect.EffectId || effect.EffectID || data.appliedEffectId || instanceId);
        const effectName = String(effect.EffectName || effectId);
        const displayEffects = Object.fromEntries(
            Object.entries(effect.BuffEffects || {})
                .filter(([, value]) => typeof value === 'number' && value !== 0)
        );
        if (effectId === 'FX_DEBUFF_YBJH_GREEN') {
            displayEffects[YBJH_GREEN_MULTIPLIER_FIELD] = 2;
        }
        active.set(instanceId, {
            instanceId,
            effectId,
            name: translateEffectName(effectName),
            targetId: event.targetId || 'boss',
            sourceActorId: String(data.sourceActorId || event.actorId || ''),
            sourceSkillId,
            sourceSkillName: sourceSkillId ? skillNameLookup[sourceSkillId] || sourceSkillId : undefined,
            endTimeMs,
            remainingMs: Math.max(0, endTimeMs - currentTimeMs),
            effects: displayEffects
        });
    });

    return Array.from(active.values())
        .filter(effect => effect.remainingMs > 0 && Object.keys(effect.effects).length > 0)
        .sort((a, b) => a.remainingMs - b.remainingMs);
}

function translateEventType(type: string) {
    const map: Record<string, string> = {
        ACTOR_DECISION: '行动判定',
        CAST_START: '开始施法',
        CAST_COMPLETE: '施法完成',
        HIT: '命中结算',
        BUFF_APPLY: '状态生效',
        BUFF_EXPIRE: '状态结束',
        COOLDOWN_READY: '冷却就绪',
        PHASE_TRANSITION: '阶段变化',
        BOSS_DEAD: 'Boss 死亡'
    };
    return map[type] || type;
}

function formatActorName(actorId: string | undefined, actorNameById: Record<string, string>) {
    if (!actorId) return '系统';
    if (actorId === 'boss') return 'Boss';
    return actorNameById[actorId] || actorId;
}

function getEventEffectName(event: SimEventLog) {
    const data = event.data || {};
    const effect = data.effect as { EffectName?: string; EffectId?: string; EffectID?: string } | undefined;
    const rawName = effect?.EffectName
        || effect?.EffectId
        || effect?.EffectID
        || String(data.effectName || data.effectId || data.appliedEffectId || '状态');
    return translateEffectName(rawName);
}

function translateEffectName(name: string) {
    const cleaned = name.replace(/_/g, ' ');
    const map: Record<string, string> = {
        BuffAttackPercentEffect: '攻击百分比提升',
        BuffAttackFixedEffect: '攻击固定值提升',
        BuffDefensePercentEffect: '防御百分比提升',
        BuffHealthPercentEffect: '气血百分比提升',
        BuffHealthFixedEffect: '气血固定值提升',
        BuffManaPercentEffect: '真气百分比提升',
        BuffManaFixedEffect: '真气固定值提升',
        BuffCriticalDamagePercentEffect: '暴击伤害提升',
        BuffCriticalHitRatePercentEffect: '暴击率提升',
        BuffFocusPercentEffect: '专注',
        BuffMonsterDamageIncreasePercentEffect: '对怪伤害提升',
        BuffMonsterDamageIncreaseEffect: '对怪伤害提升',
        BuffHolyWrathPercentEffect: '巫咒',
        BuffMonsterCriticalDamagePercentEffect: '绿点',
        BuffMonsterHarmedPercentEffect: '易伤',
        BuffMonsterCritRateIncreaseEffect: '紫点',
        BuffDefenseFixedEffect: '固定破防',
        BuffSpeedPercentEffect: '施法速度提升',
        DebuffMonsterHarmedIncreasePercentEffect: 'Boss 受到伤害增加',
        DebuffDefensePercentEffect: 'Boss 防御降低',
        DebuffCriticalDamagePercentReductionEffect: 'Boss 御爆伤降低'
    };
    return map[name] || map[cleaned] || cleaned;
}

function translateFieldName(name: string) {
    const map: Record<string, string> = {
        SkillAttackPercentBonus: '技能攻击百分比',
        SkillAttackFixedBonus: '技能攻击固定值',
        SkillDefensePercentBonus: '技能防御百分比',
        SkillHealthPercentBonus: '技能气血百分比',
        SkillManaPercentBonus: '技能真气百分比',
        SkillCriticalDamagePercentBonus: '技能暴击伤害',
        SkillDamageBonus: '技能伤害倍率',
        MultiHitConfig: '多段命中配置',
        EffectType: '效果类型',
        EffectName: '效果名称',
        EffectId: '效果 ID',
        EffectID: '效果 ID',
        DurationMs: '持续时间(ms)',
        DurationSeconds: '持续时间(s)',
        BuffAttackPercentEffect: '攻击百分比提升',
        BuffAttackFixedEffect: '攻击固定值提升',
        BuffDefensePercentEffect: '防御百分比提升',
        BuffDefenseFixedEffect: '固定破防',
        BuffHealthPercentEffect: '气血百分比提升',
        BuffHealthFixedEffect: '气血固定值提升',
        BuffManaPercentEffect: '真气百分比提升',
        BuffManaFixedEffect: '真气固定值提升',
        BuffCriticalDamagePercentEffect: '暴击伤害提升',
        BuffCriticalHitRatePercentEffect: '暴击率提升',
        BuffFocusPercentEffect: '专注',
        BuffMonsterDamageIncreaseEffect: '对怪伤害提升',
        BuffHolyWrathPercentEffect: '巫咒',
        BuffMonsterCriticalDamagePercentEffect: '绿点',
        BuffMonsterHarmedPercentEffect: '易伤',
        BuffMonsterCritRateIncreaseEffect: '紫点',
        BuffSpeedPercentEffect: '施法速度提升'
    };
    return map[name] || translateEffectName(name);
}

function formatConfigValue(value: unknown): string {
    if (value === null || value === undefined) return '未配置';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `${value.length} 项配置`;
    return Object.entries(value as Record<string, unknown>)
        .map(([key, nestedValue]) => `${translateFieldName(key)}=${formatConfigValue(nestedValue)}`)
        .join('，');
}

function formatEffectDetail(effect: Record<string, unknown>): string {
    const effectName = String(effect.EffectName || effect.EffectId || effect.EffectID || effect.EffectType || '状态效果');
    const effectType = String(effect.EffectType || '');
    const duration = effect.DurationMs !== undefined
        ? `${Number(effect.DurationMs) / 1000}s`
        : effect.DurationSeconds !== undefined
            ? `${effect.DurationSeconds}s`
            : '未配置持续时间';
    const powerFields = Object.entries(effect)
        .filter(([key]) => key.includes('Effect') && key !== 'EffectType' && key !== 'EffectName' && key !== 'EffectId' && key !== 'EffectID')
        .map(([key, value]) => `${translateFieldName(key)} ${formatConfigValue(value)}`);
    return [
        translateEffectName(effectName),
        effectType ? translateEffectName(effectType) : '',
        duration,
        ...powerFields
    ].filter(Boolean).join(' · ');
}

function buildTimelineEvents(
    result: SimulationResult | undefined,
    durationMs: number,
    skillNameLookup: Record<string, string>,
    actorNameById: Record<string, string>
): TimelineEvent[] {
    if (!result) return [];

    const events: TimelineEvent[] = result.events
        .filter(event => ['CAST_COMPLETE', 'BUFF_APPLY', 'BUFF_EXPIRE'].includes(event.type))
        .map(event => {
            const isBossTarget = event.targetId === 'boss';
            const lane: TimelineEvent['lane'] = event.type === 'CAST_COMPLETE'
                ? 'cast'
                : isBossTarget
                    ? 'debuff'
                    : 'buff';
            const actorName = formatActorName(event.actorId, actorNameById);
            const targetName = formatActorName(event.targetId, actorNameById);
            const skillName = event.skillId ? (skillNameLookup[event.skillId] || event.skillId) : '';
            const effectName = getEventEffectName(event);
            const title = event.type === 'CAST_COMPLETE'
                ? `${actorName} 施放 ${skillName || '技能'}`
                : event.type === 'BUFF_APPLY'
                    ? `${targetName} 获得 ${effectName}`
                    : `${targetName} 的 ${effectName} 结束`;
            return {
                id: `event:${event.sequence}:${event.timeMs}`,
                lane,
                timeMs: event.timeMs,
                title,
                subtitle: `${translateEventType(event.type)} · ${formatMs(event.timeMs)}`,
                raw: event
            };
        });

    const damageEvents: TimelineEvent[] = result.hitRecords.map((hit, index) => ({
        id: `hit:${index}:${hit.TimeMs}`,
        lane: 'damage',
        timeMs: hit.TimeMs,
        title: hit.SkillName,
        subtitle: formatLargeNumber(hit.DamageApplied),
        raw: hit
    }));

    return [...events, ...damageEvents]
        .filter(event => event.timeMs <= durationMs)
        .sort((a, b) => a.timeMs - b.timeMs);
}

function EffectStatusHud({
    hasResult,
    dpsEffects,
    bossEffects
}: {
    hasResult: boolean;
    dpsEffects: ActiveEffectView[];
    bossEffects: ActiveEffectView[];
}) {
    return (
        <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-2">
            <EffectStatusPanel
                title="主输出增益"
                tone="dps"
                hasResult={hasResult}
                effects={dpsEffects}
                summaryFields={[
                    'BuffFocusPercentEffect',
                    'BuffHolyWrathPercentEffect',
                    'BuffSpeedPercentEffect',
                    'BuffCriticalDamagePercentEffect'
                ]}
            />
            <EffectStatusPanel
                title="Boss 减益"
                tone="boss"
                hasResult={hasResult}
                effects={bossEffects}
                summaryFields={[
                    'BuffMonsterHarmedPercentEffect',
                    'BuffMonsterCriticalDamagePercentEffect',
                    YBJH_GREEN_MULTIPLIER_FIELD,
                    'BuffMonsterCritRateIncreaseEffect',
                    'BuffDefenseFixedEffect'
                ]}
            />
        </div>
    );
}

function EffectStatusPanel({
    title,
    tone,
    hasResult,
    effects,
    summaryFields
}: {
    title: string;
    tone: 'dps' | 'boss';
    hasResult: boolean;
    effects: ActiveEffectView[];
    summaryFields: string[];
}) {
    const summaries = buildEffectSummaryChips(effects, summaryFields);
    const toneClass = tone === 'boss'
        ? {
            panel: 'border-amber-400/20 bg-amber-950/10',
            title: 'text-amber-200',
            chip: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
            cell: 'border-amber-300/25 bg-slate-950/78',
            mark: 'bg-amber-300',
            value: 'text-amber-100'
        }
        : {
            panel: 'border-cyan-400/20 bg-cyan-950/10',
            title: 'text-cyan-200',
            chip: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
            cell: 'border-cyan-300/25 bg-slate-950/78',
            mark: 'bg-cyan-300',
            value: 'text-cyan-100'
        };

    return (
        <section className={clsx('min-h-[78px] rounded-xl border p-2 backdrop-blur-sm overflow-hidden', toneClass.panel)}>
            <div className="flex items-center justify-between gap-2">
                <p className={clsx('text-[10px] font-black uppercase tracking-[0.2em]', toneClass.title)}>{title}</p>
                <div className="min-w-0 flex flex-wrap justify-end gap-1">
                    {summaries.length > 0 ? summaries.map(summary => (
                        <span key={summary.field} className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-black', toneClass.chip)}>
                            {summary.label}{summary.value}
                        </span>
                    )) : (
                        <span className="text-[10px] font-bold text-slate-500">{hasResult ? '当前无状态' : '未开始'}</span>
                    )}
                </div>
            </div>
            <div className="mt-1.5 flex gap-1 overflow-x-auto pb-1">
                {effects.length > 0 ? effects.slice(0, 14).map(effect => (
                    <EffectIconCell key={effect.instanceId} effect={effect} toneClass={toneClass} />
                )) : (
                    <div className="h-[36px] flex-1 rounded-lg border border-slate-800 bg-slate-950/50 grid place-items-center text-[11px] font-bold text-slate-600">
                        {hasResult ? '无活跃效果' : '等待仿真'}
                    </div>
                )}
            </div>
        </section>
    );
}

function EffectIconCell({
    effect,
    toneClass
}: {
    effect: ActiveEffectView;
    toneClass: { cell: string };
}) {
    const displayName = getEffectDisplayName(effect);
    const isEndingSoon = effect.remainingMs < 5000;
    return (
        <div
            className={clsx('relative h-[36px] min-w-[46px] rounded-md border px-1 py-1 text-center shadow-lg', toneClass.cell)}
            title={`${effect.sourceSkillName || effect.name} · ${effect.name} · ${formatEffectValues(effect.effects)} · 剩余 ${formatMs(effect.remainingMs)}`}
        >
            <span className={clsx('absolute right-0.5 top-0.5 h-2 w-2 rounded-full', getEffectMarkerClass(effect))} />
            <p className="truncate text-[10px] font-black text-slate-100">{displayName}</p>
            <p className={clsx('mt-0.5 text-[10px] font-black', isEndingSoon ? 'text-red-300' : 'text-slate-500')}>
                {formatDurationCompact(effect.remainingMs)}
            </p>
        </div>
    );
}

function getEffectMarkerClass(effect: ActiveEffectView) {
    const field = getPrimaryEffectField(effect);
    if (field === 'BuffMonsterCriticalDamagePercentEffect' || field === YBJH_GREEN_MULTIPLIER_FIELD) return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
    if (field === 'BuffMonsterCritRateIncreaseEffect') return 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]';
    if (field === 'BuffDefenseFixedEffect' || field === 'BuffDefensePercentEffect') return 'bg-blue-900 shadow-[0_0_8px_rgba(30,64,175,0.85)]';
    if (field === 'BuffMonsterHarmedPercentEffect') return 'bg-sky-100 shadow-[0_0_8px_rgba(186,230,253,0.95)]';
    if (field === 'BuffFocusPercentEffect' || field === 'BuffHolyWrathPercentEffect') return 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]';
    if (field === 'BuffSpeedPercentEffect') return 'bg-gradient-to-br from-red-400 via-fuchsia-400 to-blue-400';
    if (field === 'BuffCriticalDamagePercentEffect') return 'bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.85)]';
    if (field === 'BuffManaPercentEffect' || field === 'BuffManaFixedEffect') return 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]';
    if (field === 'BuffHealthPercentEffect' || field === 'BuffHealthFixedEffect') return 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]';
    if (field === 'BuffAttackPercentEffect' || field === 'BuffAttackFixedEffect') return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]';
    return 'bg-slate-400';
}

function getPrimaryEffectField(effect: ActiveEffectView) {
    const priority = [
        'BuffMonsterCriticalDamagePercentEffect',
        YBJH_GREEN_MULTIPLIER_FIELD,
        'BuffMonsterCritRateIncreaseEffect',
        'BuffDefenseFixedEffect',
        'BuffDefensePercentEffect',
        'BuffMonsterHarmedPercentEffect',
        'BuffFocusPercentEffect',
        'BuffHolyWrathPercentEffect',
        'BuffSpeedPercentEffect',
        'BuffCriticalDamagePercentEffect',
        'BuffManaPercentEffect',
        'BuffManaFixedEffect',
        'BuffHealthPercentEffect',
        'BuffHealthFixedEffect',
        'BuffAttackPercentEffect',
        'BuffAttackFixedEffect'
    ];
    return priority.find(field => effect.effects[field] !== undefined) || Object.keys(effect.effects)[0] || '';
}

function buildEffectSummaryChips(effects: ActiveEffectView[], fields: string[]) {
    const totals = new Map<string, number>();
    effects.forEach(effect => {
        Object.entries(effect.effects).forEach(([field, value]) => {
            totals.set(field, (totals.get(field) || 0) + value);
        });
    });

    return fields
        .map(field => ({ field, value: totals.get(field) || 0 }))
        .filter(item => item.value !== 0)
        .map(item => ({
            ...item,
            label: getEffectFieldLabel(item.field, item.value),
            value: formatEffectFieldValue(item.field, item.value)
        }))
        .slice(0, 6);
}

function getEffectDisplayName(effect: ActiveEffectView) {
    if (effect.effectId === 'ZM_BUFF_RYHG_PHASE_1') return '日月1';
    if (effect.effectId === 'ZM_BUFF_RYHG_PHASE_2') return '日月2';
    const name = effect.sourceSkillName && !effect.sourceSkillName.includes('_')
        ? effect.sourceSkillName
        : effect.name;
    return getShortSkillName(name);
}

function getShortSkillName(name: string) {
    const withoutQualityPrefix = name.replace(/^(赤乌|玄烛|皓月|莹炬|曦日)[·.]/, '');
    const withoutVariantPrefix = withoutQualityPrefix.replace(/^[^·.]{1,4}[·.]/, '');
    return withoutVariantPrefix.length > 2 ? withoutVariantPrefix.slice(0, 2) : withoutVariantPrefix;
}

function formatEffectValues(effects: Record<string, number>) {
    const entries = Object.entries(effects)
        .filter(([, value]) => value !== 0)
        .slice(0, 2);
    if (entries.length === 0) return '无';
    return entries
        .map(([field, value]) => `${getEffectFieldLabel(field, value)}${formatEffectFieldValue(field, value)}`)
        .join('/');
}

function getEffectFieldLabel(field: string, value: number) {
    if (field === 'BuffDefenseFixedEffect') return value < 0 ? '破防' : '防御';
    if (field === 'BuffDefensePercentEffect') return value < 0 ? '破防%' : '防御';
    if (field === YBJH_GREEN_MULTIPLIER_FIELD) return '绿点';
    const map: Record<string, string> = {
        BuffFocusPercentEffect: '专注',
        BuffHolyWrathPercentEffect: '巫咒',
        BuffMonsterHarmedPercentEffect: '易伤',
        BuffMonsterCriticalDamagePercentEffect: '绿点',
        BuffMonsterCritRateIncreaseEffect: '紫点',
        BuffSpeedPercentEffect: '加速',
        BuffCriticalDamagePercentEffect: '爆伤',
        BuffCriticalHitRatePercentEffect: '暴击',
        BuffMonsterDamageIncreaseEffect: '对怪',
        BuffAttackPercentEffect: '攻击',
        BuffAttackFixedEffect: '攻击',
        BuffHealthPercentEffect: '气血',
        BuffHealthFixedEffect: '气血',
        BuffManaPercentEffect: '真气',
        BuffManaFixedEffect: '真气'
    };
    return map[field] || translateFieldName(field);
}

function formatEffectFieldValue(field: string, value: number) {
    if (field === YBJH_GREEN_MULTIPLIER_FIELD) return `×${trimNumber(value)}`;
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const absValue = Math.abs(value);
    const prettyValue = formatCompactNumber(absValue);
    if (field.includes('Percent') || field.includes('Rate') || field === 'BuffMonsterDamageIncreaseEffect') {
        return `${sign}${trimNumber(absValue)}%`;
    }
    return `${sign}${prettyValue}`;
}

function formatCompactNumber(value: number) {
    if (value >= 100000000) return `${trimNumber(value / 100000000)}亿`;
    if (value >= 10000) return `${trimNumber(value / 10000)}万`;
    return trimNumber(value);
}

function trimNumber(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function formatDurationCompact(ms: number) {
    if (ms >= 3600000) return `${Math.ceil(ms / 3600000)}H`;
    if (ms >= 60000) return `${Math.ceil(ms / 60000)}M`;
    return `${Math.max(0, Math.ceil(ms / 1000))}S`;
}

function DamageFeedPanel({
    hits,
    hasResult
}: {
    hits: HitDamageRecord[];
    hasResult: boolean;
}) {
    return (
        <section className="min-h-0 rounded-xl border border-red-300/20 bg-slate-950/72 p-2.5 shadow-xl backdrop-blur-sm overflow-hidden">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-red-100 tracking-[0.18em]">逐段伤害</p>
                <span className="text-[10px] font-bold text-red-200/80">{hits.length > 0 ? '最新在上' : ''}</span>
            </div>
            {hits.length === 0 ? (
                <div className="h-[180px] rounded-lg border border-slate-800 bg-slate-950/50 grid place-items-center text-[11px] font-bold text-slate-600">
                    {hasResult ? '当前无命中' : '启动后显示'}
                </div>
            ) : (
                <div className="max-h-[208px] overflow-y-auto pr-1 space-y-1.5">
                    {hits.map((hit, index) => (
                        <div key={`${hit.TimeMs}-${hit.SkillId}-${hit.HitIndex}-${index}`} className="rounded-lg border border-slate-700/70 bg-slate-900/72 px-2 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-[11px] font-black text-slate-100">{hit.SkillName}</span>
                                <span className="shrink-0 text-[10px] font-mono text-red-200">{formatMs(hit.TimeMs)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                                <span className="text-slate-500">第 {hit.HitIndex}/{hit.HitCount} 段</span>
                                <span className="font-black text-red-100">{formatLargeNumber(hit.DamageApplied)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function BattleRankPanel({
    skillDamageRanks,
    actorDpsRanks,
    hasResult
}: {
    skillDamageRanks: ReturnType<typeof buildSkillDamageRanks>;
    actorDpsRanks: ReturnType<typeof buildActorDpsRanks>;
    hasResult: boolean;
}) {
    return (
        <div className="min-h-0 space-y-2">
            <RankCard title="技能总伤害" empty={!hasResult || skillDamageRanks.length === 0} emptyText="启动后显示技能伤害占比">
                {skillDamageRanks.map((item, index) => (
                    <RankRow
                        key={item.skillId}
                        rank={index + 1}
                        name={item.skillName}
                        value={`${formatLargeNumber(item.totalDamage)} (${item.percent.toFixed(1)}%)`}
                        percent={item.percent}
                    />
                ))}
            </RankCard>
            <RankCard title="角色秒伤" empty={!hasResult || actorDpsRanks.length === 0} emptyText="启动后显示角色 DPS">
                {actorDpsRanks.map((item, index) => (
                    <RankRow
                        key={item.actorId}
                        rank={index + 1}
                        name={item.actorName}
                        value={`${formatLargeNumber(item.dps)}/秒`}
                        percent={actorDpsRanks[0]?.dps ? (item.dps / actorDpsRanks[0].dps) * 100 : 0}
                    />
                ))}
            </RankCard>
        </div>
    );
}

function RankCard({
    title,
    empty,
    emptyText,
    children
}: {
    title: string;
    empty: boolean;
    emptyText: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-amber-300/25 bg-slate-950/78 p-3 shadow-xl backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black text-amber-100 tracking-[0.18em]">{title}</p>
                <span className="text-[10px] text-amber-200">▲</span>
            </div>
            {empty ? (
                <p className="py-4 text-center text-[11px] text-slate-500">{emptyText}</p>
            ) : (
                <div className="space-y-1.5">{children}</div>
            )}
        </div>
    );
}

function RankRow({
    rank,
    name,
    value,
    percent
}: {
    rank: number;
    name: string;
    value: string;
    percent: number;
}) {
    return (
        <div className="relative overflow-hidden rounded-lg border border-slate-700/70 bg-slate-800/70">
            <div className="absolute inset-y-0 left-0 bg-amber-400/30" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
            <div className="relative flex items-center gap-2 px-2 py-1.5">
                <span className="w-5 shrink-0 text-center text-xs font-black text-amber-100">{rank}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-50">{name}</span>
                <span className="shrink-0 text-[11px] font-black text-slate-50">{value}</span>
            </div>
        </div>
    );
}

function AttributeInputGrid({
    attributes,
    onChange
}: {
    attributes: CharacterAttributes;
    onChange: (attributes: CharacterAttributes) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {ATTRIBUTE_FIELDS.map(field => (
                <label key={String(field.key)} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2">
                    <span className="shrink-0 text-[10px] font-black text-slate-500 uppercase tracking-wider">{field.label}</span>
                    <input
                        type="number"
                        value={Number(attributes[field.key] ?? 0)}
                        onChange={(event) => onChange({
                            ...attributes,
                            [field.key]: parseFloat(event.target.value) || 0
                        })}
                        className="min-w-0 flex-1 bg-transparent text-right text-sm font-black text-slate-100 outline-none"
                    />
                    {field.suffix && <span className="shrink-0 text-xs font-bold text-slate-500">{field.suffix}</span>}
                </label>
            ))}
        </div>
    );
}

function DpsDrawerPanel({
    dpsFaction,
    dpsAttributes,
    dpsSkillConfigs,
    dpsSkills,
    onDpsFactionChange,
    onDpsAttributesChange,
    onDpsSkillConfigChange,
    getSkillStatus,
    onOpenSkill
}: {
    dpsFaction: 'XIAN' | 'MO';
    dpsAttributes: CharacterAttributes;
    dpsSkillConfigs: Record<string, DpsSkillConfig>;
    dpsSkills: Skill[];
    onDpsFactionChange: (faction: 'XIAN' | 'FO' | 'MO') => void;
    onDpsAttributesChange: (attributes: CharacterAttributes) => void;
    onDpsSkillConfigChange: (skillId: string, patch: DpsSkillConfig) => void;
    getSkillStatus: (skillId: string) => { label: string; tone: string; dot: string; explanation: string };
    onOpenSkill: (skill: Skill) => void;
}) {
    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">主输出</p>
                        <h4 className="mt-1 text-xl font-black text-slate-100">逐霜 · {FACTION_LABEL[dpsFaction]}</h4>
                        <p className="mt-1 text-xs text-slate-500">技能启用与四代品质按单个技能配置。</p>
                    </div>
                    <div className="flex gap-2">
                        {(['XIAN', 'MO'] as const).map(faction => (
                            <button
                                key={faction}
                                type="button"
                                onClick={() => onDpsFactionChange(faction)}
                                className={clsx(
                                    'rounded-xl border px-4 py-2 text-sm font-black',
                                    dpsFaction === faction
                                        ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                                        : 'border-slate-800 bg-slate-950/60 text-slate-500'
                                )}
                            >
                                {FACTION_LABEL[faction]}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <p className="mb-3 text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">角色属性</p>
                <AttributeInputGrid attributes={dpsAttributes} onChange={onDpsAttributesChange} />
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">技能资料</p>
                        <p className="mt-1 text-xs text-slate-500">点击技能查看详情；释放顺序在“技能策略”抽屉编辑。</p>
                    </div>
                    <BookOpen className="w-4 h-4 text-slate-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {dpsSkills.map(skill => (
                        <DpsSkillConfigCard
                            key={skill.SkillID}
                            skill={skill}
                            config={dpsSkillConfigs[skill.SkillID] || {}}
                            getSkillStatus={getSkillStatus}
                            onOpenSkill={onOpenSkill}
                            onConfigChange={onDpsSkillConfigChange}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

function DpsSkillConfigCard({
    skill,
    config,
    getSkillStatus,
    onOpenSkill,
    onConfigChange
}: {
    skill: Skill;
    config: DpsSkillConfig;
    getSkillStatus: (skillId: string) => { label: string; tone: string; dot: string; explanation: string };
    onOpenSkill: (skill: Skill) => void;
    onConfigChange: (skillId: string, patch: DpsSkillConfig) => void;
}) {
    const status = getSkillStatus(skill.SkillID);
    const enabled = config.Enabled !== false;
    const hasFourthGen = Boolean(skill.FourthGenPresets);
    const quality = config.FourthGenQuality || 'NONE';

    return (
        <div className={clsx(
            'rounded-xl border p-2.5 transition-colors',
            enabled ? 'border-slate-800 bg-slate-950/55' : 'border-slate-800/70 bg-slate-950/25 opacity-70'
        )}>
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={() => onConfigChange(skill.SkillID, { Enabled: !enabled })}
                    className={clsx(
                        'mt-0.5 h-5 w-9 rounded-full border p-0.5 transition-colors',
                        enabled ? 'border-emerald-400/40 bg-emerald-400/20' : 'border-slate-700 bg-slate-900'
                    )}
                    title={enabled ? '点击后不参与结算' : '点击后参与结算'}
                >
                    <span className={clsx(
                        'block h-3.5 w-3.5 rounded-full transition-transform',
                        enabled ? 'translate-x-4 bg-emerald-300' : 'translate-x-0 bg-slate-600'
                    )} />
                </button>
                <button type="button" onClick={() => onOpenSkill(skill)} className="min-w-0 flex-1 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className={clsx('h-2 w-2 shrink-0 rounded-full', enabled ? status.dot : 'bg-slate-600')} />
                        <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-100">{skill.SkillName}</span>
                        <span className={clsx('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black', enabled ? status.tone : 'border-slate-700 bg-slate-900 text-slate-500')}>
                            {enabled ? status.label : '不参与'}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">{skill.Description || '暂无描述'}</p>
                </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2 text-[10px] font-bold text-slate-500">
                    <span>CD {skill.Cooldown}s</span>
                    <span>释放 {skill.CastTime}s</span>
                    <span>{translateActionType(skill.ActionType)}</span>
                </div>
                {hasFourthGen && (
                    <select
                        value={quality}
                        onChange={(event) => onConfigChange(skill.SkillID, {
                            FourthGenQuality: event.target.value === 'NONE'
                                ? undefined
                                : event.target.value as Exclude<FourthGenQuality, 'NONE'>
                        })}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-200 outline-none"
                        title="该技能的四代品质"
                    >
                        <option value="NONE">常规</option>
                        <option value="YING_JU">莹炬</option>
                        <option value="HAO_YUE">皓月</option>
                        <option value="XI_RI">曦日</option>
                    </select>
                )}
            </div>
        </div>
    );
}

function TeamDrawerPanel({
    supports,
    onSupportsChange,
    allSkills,
    getSkillStatus,
    onOpenSkill
}: {
    supports: SupportConfig[];
    onSupportsChange: (supports: SupportConfig[]) => void;
    allSkills: Record<string, Record<string, Skill[]>>;
    getSkillStatus: (skillId: string) => { label: string; tone: string; dot: string; explanation: string };
    onOpenSkill: (skill: Skill) => void;
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeSupport = supports[activeIndex] || supports[0];
    const classOptions = Object.keys(allSkills)
        .filter(classId => classId !== 'ZHU_SHUANG')
        .map(classId => ({ id: classId, label: CLASS_LABEL[classId] || classId }));
    const factionOptions = Object.keys(allSkills[activeSupport.classId] || {}) as Array<'XIAN' | 'FO' | 'MO'>;
    const supportSkills = allSkills[activeSupport.classId]?.[activeSupport.faction] || [];

    const updateSupport = (index: number, next: Partial<SupportConfig>) => {
        onSupportsChange(supports.map((support, supportIndex) => (
            supportIndex === index ? { ...support, ...next } : support
        )));
    };

    const updateSkillOverride = (skillId: string, patch: SkillOverrideConfig) => {
        const currentOverrides = activeSupport.skillOverrides || {};
        const current = currentOverrides[skillId] || {};
        const nextOverride: SkillOverrideConfig = { ...current, ...patch };
        if (nextOverride.Enabled === true) {
            delete nextOverride.Enabled;
        }
        Object.keys(nextOverride).forEach(key => {
            const typedKey = key as keyof SkillOverrideConfig;
            if (nextOverride[typedKey] === undefined || nextOverride[typedKey] === '' || (nextOverride[typedKey] === 0 && typedKey !== 'RyhgPhase2DelaySeconds')) {
                delete nextOverride[typedKey];
            }
        });
        const nextOverrides = { ...currentOverrides };
        if (Object.keys(nextOverride).length > 0) {
            nextOverrides[skillId] = nextOverride;
        } else {
            delete nextOverrides[skillId];
        }
        updateSupport(activeIndex, {
            skillOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined
        });
    };

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">队伍槽位</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {supports.map((support, index) => (
                        <button
                            key={support.actorId}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            className={clsx(
                                'rounded-xl border p-3 text-left transition-colors',
                                activeIndex === index
                                    ? 'border-cyan-400/50 bg-cyan-400/10'
                                    : 'border-slate-800 bg-slate-950/55 hover:border-slate-600'
                            )}
                        >
                            <p className="text-[10px] text-slate-500 font-bold">S{index + 1}</p>
                            <p className="mt-1 text-sm font-black text-slate-100">{CLASS_LABEL[support.classId] || support.classId}</p>
                            <p className="text-xs text-slate-500">{FACTION_LABEL[support.faction] || support.faction}</p>
                        </button>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label>
                        <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">职业</span>
                        <select
                            value={activeSupport.classId}
                            onChange={(event) => {
                                const nextClassId = event.target.value;
                                const nextFaction = Object.keys(allSkills[nextClassId] || {})[0] as 'XIAN' | 'FO' | 'MO' | undefined;
                                updateSupport(activeIndex, {
                                    classId: nextClassId,
                                    faction: nextFaction || 'FO',
                                    skillOverrides: undefined
                                });
                            }}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 outline-none"
                        >
                            {classOptions.map(option => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">阵营</span>
                        <select
                            value={activeSupport.faction}
                            onChange={(event) => updateSupport(activeIndex, {
                                faction: event.target.value as 'XIAN' | 'FO' | 'MO',
                                skillOverrides: undefined
                            })}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 outline-none"
                        >
                            {factionOptions.map(faction => (
                                <option key={faction} value={faction}>{FACTION_LABEL[faction] || faction}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <p className="mb-3 text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">辅助属性</p>
                <AttributeInputGrid
                    attributes={activeSupport.profileAttributes}
                    onChange={(attributes) => updateSupport(activeIndex, { profileAttributes: attributes })}
                />
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="mb-3">
                    <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">技能与覆盖</p>
                    <p className="mt-1 text-xs text-slate-500">未启用技能仅供查阅；法宝+1 会作为 `SkillLevel=1` 进入技能覆盖。</p>
                </div>
                <div className="space-y-2">
                    {supportSkills.map(skill => {
                        const override = activeSupport.skillOverrides?.[skill.SkillID] || {};
                        const quality = override.FourthGenQuality || 'NONE';
                        const hasFourthGen = Boolean(skill.FourthGenPresets);
                        const hasPlusOne = (override.SkillLevel || 0) > 0;
                        const enabled = override.Enabled !== false;
                        const status = getSkillStatus(skill.SkillID);
                        return (
                            <div
                                key={skill.SkillID}
                                className={clsx(
                                    'rounded-xl border p-3 transition-colors',
                                    enabled ? 'border-slate-800 bg-slate-950/50' : 'border-slate-800/70 bg-slate-950/25 opacity-70'
                                )}
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex min-w-0 items-start gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateSkillOverride(skill.SkillID, { Enabled: !enabled })}
                                            className={clsx(
                                                'mt-0.5 h-5 w-9 rounded-full border p-0.5 transition-colors',
                                                enabled ? 'border-emerald-400/40 bg-emerald-400/20' : 'border-slate-700 bg-slate-900'
                                            )}
                                            title={enabled ? '点击后不参与结算' : '点击后参与结算'}
                                        >
                                            <span className={clsx(
                                                'block h-3.5 w-3.5 rounded-full transition-transform',
                                                enabled ? 'translate-x-4 bg-emerald-300' : 'translate-x-0 bg-slate-600'
                                            )} />
                                        </button>
                                        <button type="button" onClick={() => onOpenSkill(skill)} className="min-w-0 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className={clsx('w-2 h-2 rounded-full', enabled ? status.dot : 'bg-slate-600')} />
                                                <span className="text-sm font-black text-slate-100">{skill.SkillName}</span>
                                                <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-black', enabled ? status.tone : 'border-slate-700 bg-slate-900 text-slate-500')}>
                                                    {enabled ? status.label : '不参与'}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{skill.Description || '暂无描述'}</p>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateSkillOverride(skill.SkillID, { SkillLevel: hasPlusOne ? undefined : 1 })}
                                            className={clsx(
                                                'rounded-lg border px-3 py-1.5 text-xs font-black',
                                                hasPlusOne
                                                    ? 'border-amber-300/50 bg-amber-300/15 text-amber-100'
                                                    : 'border-slate-800 bg-slate-900 text-slate-500'
                                            )}
                                        >
                                            法宝+1
                                        </button>
                                        {hasFourthGen && (
                                            <select
                                                value={quality}
                                                onChange={(event) => updateSkillOverride(skill.SkillID, {
                                                    FourthGenQuality: event.target.value === 'NONE'
                                                        ? undefined
                                                        : event.target.value as Exclude<FourthGenQuality, 'NONE'>
                                                })}
                                                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-200 outline-none"
                                            >
                                                <option value="NONE">四代常规</option>
                                                <option value="YING_JU">莹炬</option>
                                                <option value="HAO_YUE">皓月</option>
                                                <option value="XI_RI">曦日</option>
                                            </select>
                                        )}
                                        {skill.SkillID === 'TH_FO_SKILL_FQH' && (
                                            <select
                                                value={override.Variant || ''}
                                                onChange={(event) => updateSkillOverride(skill.SkillID, { Variant: event.target.value || undefined })}
                                                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-200 outline-none"
                                            >
                                                <option value="">凤求凰默认</option>
                                                <option value="HAO">凤求凰·浩</option>
                                                <option value="HUA">凤求凰·华</option>
                                            </select>
                                        )}
                                        {skill.SkillID === 'ZM_FO_SKILL_RYHG' && (
                                            <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-200">
                                                <span className="text-slate-400">二段延迟:</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="45"
                                                    value={override.RyhgPhase2DelaySeconds !== undefined ? override.RyhgPhase2DelaySeconds : ''}
                                                    placeholder="30"
                                                    onChange={(event) => {
                                                        const val = event.target.value === '' ? undefined : Math.max(0, parseInt(event.target.value) || 0);
                                                        updateSkillOverride(skill.SkillID, { RyhgPhase2DelaySeconds: val });
                                                    }}
                                                    className="w-10 bg-transparent text-center font-bold text-cyan-400 outline-none placeholder:text-slate-600"
                                                />
                                                <span className="text-slate-500">秒</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

function BossDrawerPanel({
    selectedDungeonId,
    selectedBossId,
    customBossHp,
    onDungeonChange,
    onBossChange,
    onHpChange,
    inspectBossHp,
    startingHp,
    dungeons
}: {
    selectedDungeonId: string;
    selectedBossId: string;
    customBossHp: string;
    onDungeonChange: (id: string) => void;
    onBossChange: (id: string) => void;
    onHpChange: (hp: string) => void;
    inspectBossHp?: number;
    startingHp?: number;
    dungeons: Dungeon[];
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const currentDungeon = dungeons.find(dungeon => dungeon.DungeonID === selectedDungeonId) || dungeons[0];
    const currentBoss = currentDungeon?.Monsters.find(boss => boss.MonsterID === selectedBossId) || currentDungeon?.Monsters[0];
    const allBosses = dungeons.flatMap(dungeon => dungeon.Monsters.map(boss => ({ boss, dungeon })));
    const normalizedQuery = normalizeSearch(searchQuery);
    const filteredBosses = normalizedQuery
        ? allBosses.filter(({ boss, dungeon }) => [
            boss.MonsterName,
            boss.MonsterID,
            dungeon.DungeonName,
            dungeon.DungeonID,
            ...(SEARCH_ALIASES[boss.MonsterID] || []),
            ...(SEARCH_ALIASES[dungeon.DungeonID] || [])
        ].some(token => normalizeSearch(token).includes(normalizedQuery))).slice(0, 12)
        : [];
    const nativeHp = currentBoss?.MonsterAttributeModifiers.MonsterHealth || 0;
    const maxHp = startingHp || (customBossHp ? parseFloat(customBossHp) || nativeHp : nativeHp);
    const hp = inspectBossHp ?? maxHp;
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 100;

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">Boss 目标</p>
                        <h4 className="mt-1 text-xl font-black text-slate-100">{currentBoss?.MonsterName || '未选择 Boss'}</h4>
                        <p className="mt-1 text-xs text-slate-500">{currentDungeon?.DungeonName || '未选择副本'} · {currentBoss?.MonsterID}</p>
                    </div>
                    <Target className="w-5 h-5 text-red-300" />
                </div>
                <div className="mt-4 h-5 overflow-hidden rounded-full border border-red-900/70 bg-slate-950">
                    <div className="h-full bg-gradient-to-r from-red-700 via-red-500 to-amber-300" style={{ width: `${hpPercent}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] font-mono text-slate-300">
                    <span>{formatLargeNumber(hp)} / {formatLargeNumber(maxHp)}</span>
                    <span>{hpPercent.toFixed(1)}%</span>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <p className="mb-3 text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">快速搜索</p>
                <label className="relative block">
                    <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-500" />
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="搜索 Boss 中文名、JSON ID、常用拼音别名"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm font-bold text-slate-100 outline-none focus:border-cyan-500/50"
                    />
                </label>
                {filteredBosses.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredBosses.map(({ boss, dungeon }) => (
                            <button
                                key={`${dungeon.DungeonID}:${boss.MonsterID}`}
                                type="button"
                                onClick={() => {
                                    onDungeonChange(dungeon.DungeonID);
                                    onBossChange(boss.MonsterID);
                                    setSearchQuery('');
                                }}
                                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left hover:border-cyan-400/40"
                            >
                                <p className="text-sm font-black text-slate-100">{boss.MonsterName}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{dungeon.DungeonName}</p>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label>
                        <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">副本</span>
                        <select
                            value={selectedDungeonId}
                            onChange={(event) => onDungeonChange(event.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 outline-none"
                        >
                            {dungeons.map(dungeon => (
                                <option key={dungeon.DungeonID} value={dungeon.DungeonID}>{dungeon.DungeonName}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">Boss</span>
                        <select
                            value={selectedBossId}
                            onChange={(event) => onBossChange(event.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 outline-none"
                        >
                            {currentDungeon?.Monsters.map(boss => (
                                <option key={boss.MonsterID} value={boss.MonsterID}>第{boss.DungeonLevel}关：{boss.MonsterName}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <label className="mt-3 block">
                    <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">血量覆盖</span>
                    <input
                        value={customBossHp}
                        onChange={(event) => onHpChange(event.target.value)}
                        placeholder="如果不填，将采用副本原生属性值"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 outline-none"
                    />
                </label>
            </section>

            {currentBoss && <BossDetail boss={currentBoss} dungeon={currentDungeon} />}
        </div>
    );
}

function PartyRail({
    dpsFaction,
    supports,
    allSkills,
    getSupportSkills,
    getSkillStatus,
    onOpenDps,
    onOpenSupport,
    onOpenSkill
}: {
    dpsFaction: 'XIAN' | 'MO';
    supports: SupportConfig[];
    allSkills: Record<string, Record<string, Skill[]>>;
    getSupportSkills: (classId: string, faction: 'XIAN' | 'FO' | 'MO') => Skill[];
    getSkillStatus: (skillId: string) => { label: string; tone: string; dot: string; explanation: string };
    onOpenDps: () => void;
    onOpenSupport: (index: number) => void;
    onOpenSkill: (skill: Skill) => void;
}) {
    const dpsSkills = allSkills.ZHU_SHUANG?.[dpsFaction] || [];

    return (
        <aside className="rounded-2xl border border-slate-800 bg-slate-950/92 min-h-0 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">六人队伍</p>
                    <h3 className="text-sm font-black text-slate-100">1 主输出 + 5 辅助</h3>
                </div>
                <Users className="w-5 h-5 text-slate-500" />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <button
                    type="button"
                    onClick={onOpenDps}
                    className="w-full text-left rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 hover:border-cyan-400/60 transition-colors"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-100">逐霜 · {FACTION_LABEL[dpsFaction]}</span>
                        <span className="text-[10px] font-black text-cyan-200 border border-cyan-400/30 rounded-full px-2 py-0.5">主输出</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">四代品质与输出技能栏可编辑</p>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                        {dpsSkills.slice(0, 10).map(skill => {
                            const status = getSkillStatus(skill.SkillID);
                            return (
                                <button
                                    key={skill.SkillID}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenSkill(skill);
                                    }}
                                    className="h-8 rounded-lg border border-slate-700 bg-slate-950/70 text-[10px] font-bold text-slate-300 hover:border-cyan-400/50 truncate px-1 relative"
                                    title={skill.SkillName}
                                >
                                    <span className={clsx('absolute right-1 top-1 w-1.5 h-1.5 rounded-full', status.dot)} />
                                    {skill.SkillName.slice(0, 2)}
                                </button>
                            );
                        })}
                    </div>
                </button>

                {supports.map((support, index) => {
                    const skills = getSupportSkills(support.classId, support.faction);
                    const enabledCount = skills.filter(skill =>
                        !DISABLED_SIMULATION_SKILL_ID_SET.has(skill.SkillID) &&
                        isConfiguredSkillEnabled(skill.SkillID, support.skillOverrides)
                    ).length;
                    return (
                        <button
                            key={support.actorId}
                            type="button"
                            onClick={() => onOpenSupport(index)}
                            className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/45 p-3 hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-slate-100">{CLASS_LABEL[support.classId] || support.classId} · {FACTION_LABEL[support.faction]}</span>
                                <span className="text-[10px] text-slate-500">S{index + 1}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span>{enabledCount}/{skills.length} 技能参与默认仿真</span>
                                <span>{support.profileAttributes.CharacterMonsterDamageIncreasePercent}% 对怪增伤</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {skills.slice(0, 6).map(skill => {
                                    const status = getSkillStatus(skill.SkillID);
                                    const enabled = isConfiguredSkillEnabled(skill.SkillID, support.skillOverrides);
                                    return (
                                        <span
                                            key={skill.SkillID}
                                            className={clsx(
                                                'px-2 py-1 rounded-md border text-[10px] font-bold',
                                                enabled ? status.tone : 'border-slate-700 bg-slate-900 text-slate-500'
                                            )}
                                        >
                                            {skill.SkillName.slice(0, 4)}
                                        </span>
                                    );
                                })}
                            </div>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}

function CommandRail({
    simulationResult,
    isResultStale,
    currentBoss,
    currentDungeon,
    strategy,
    searchQuery,
    setSearchQuery,
    damageAuditEnabled,
    setDamageAuditEnabled,
    dpsCommonEffects,
    setDpsCommonEffects,
    dungeonEffects,
    setDungeonEffects,
    onOpenBoss,
    onOpenStrategy,
    onOpenData,
    onOpenAnalysis
}: {
    simulationResult?: SimulationResult;
    isResultStale: boolean;
    currentBoss?: Monster;
    currentDungeon?: Dungeon;
    strategy: DpsStrategyConfig;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    damageAuditEnabled: boolean;
    setDamageAuditEnabled: (enabled: boolean) => void;
    dpsCommonEffects: DpsCommonEffectToggles;
    setDpsCommonEffects: (value: DpsCommonEffectToggles) => void;
    dungeonEffects: DungeonEffectToggles;
    setDungeonEffects: (value: DungeonEffectToggles) => void;
    onOpenBoss: () => void;
    onOpenStrategy: () => void;
    onOpenData: () => void;
    onOpenAnalysis: () => void;
}) {
    return (
        <aside className="rounded-2xl border border-slate-800 bg-slate-950/92 min-h-0 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">上下文入口</p>
                <h3 className="text-sm font-black text-slate-100">查询 / 编辑 / 分析</h3>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto">
                <button type="button" onClick={onOpenBoss} className="w-full rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-left hover:border-red-300/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-100 flex items-center gap-2"><Target className="w-4 h-4 text-red-300" />Boss</span>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-200 truncate">{currentBoss?.MonsterName || '未选择'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentDungeon?.DungeonName || '未选择副本'}</p>
                </button>

                <button type="button" onClick={onOpenStrategy} className="w-full rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-left hover:border-cyan-300/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-100 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-cyan-300" />技能策略</span>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-200">
                        {strategy.type === 'SKILL_BAR' ? '法宝技能栏' : strategy.type === 'FIXED_ROTATION' ? '固定循环' : '手动时间轴'}
                    </p>
                    <p className="text-[11px] text-slate-500">点击编辑技能格与时间轴表格</p>
                </button>

                <button type="button" onClick={onOpenAnalysis} className="w-full rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-left hover:border-emerald-300/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-100 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-emerald-300" />分析</span>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-200">{simulationResult ? '查看完整报告' : '等待仿真结果'}</p>
                    <p className="text-[11px] text-slate-500">{isResultStale ? '当前报告已过期' : '曲线、占比、日志、A/B 对比'}</p>
                </button>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <div className="min-w-0">
                        <span className="text-xs font-black text-slate-100">伤害审计</span>
                        <p className="mt-1 text-[11px] text-slate-500">逐段记录属性、增益、减益与公式口径</p>
                    </div>
                    <input
                        type="checkbox"
                        checked={damageAuditEnabled}
                        onChange={(event) => setDamageAuditEnabled(event.target.checked)}
                        className="h-4 w-4 shrink-0 accent-cyan-400"
                    />
                </label>

                <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-100 flex items-center gap-2"><Swords className="w-4 h-4 text-cyan-300" />主输出通用</span>
                        <span className="text-[10px] font-bold text-slate-500">开场效果</span>
                    </div>
                    <label className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-200">
                        <span>三碗不过岗 · 专注 +20</span>
                        <input
                            type="checkbox"
                            checked={dpsCommonEffects.sanwanFocus}
                            onChange={(event) => setDpsCommonEffects({
                                ...dpsCommonEffects,
                                sanwanFocus: event.target.checked
                            })}
                            className="h-4 w-4 shrink-0 accent-cyan-400"
                        />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        {['九华 +150爆伤', '神爆 +20%攻击', '佛尊 +50%攻击', '家族技能', '法宝特效'].map(label => (
                            <label key={label} className="flex items-center gap-2">
                                <input type="checkbox" disabled className="h-3.5 w-3.5 accent-slate-600" />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-100 flex items-center gap-2"><Target className="w-4 h-4 text-amber-300" />副本效果</span>
                        <span className="text-[10px] font-bold text-slate-500">Boss Debuff</span>
                    </div>
                    <label className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-200">
                        <span>开场绿点 +150</span>
                        <input
                            type="checkbox"
                            checked={dungeonEffects.greenPoint150}
                            onChange={(event) => setDungeonEffects({
                                ...dungeonEffects,
                                greenPoint150: event.target.checked
                            })}
                            className="h-4 w-4 shrink-0 accent-amber-400"
                        />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        {['攻击增益', '爆伤增益', '紫点增益', '易伤增益'].map(label => (
                            <label key={label} className="flex items-center gap-2">
                                <input type="checkbox" disabled className="h-3.5 w-3.5 accent-slate-600" />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-100 flex items-center gap-2"><Database className="w-4 h-4 text-amber-300" />资料查询</span>
                        <button type="button" onClick={onOpenData} className="text-[11px] font-bold text-cyan-300 hover:text-cyan-100">打开</button>
                    </div>
                    <label className="relative block">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onFocus={onOpenData}
                            placeholder="技能 / Boss / ID / pinyin"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none"
                        />
                    </label>
                </div>
            </div>
        </aside>
    );
}

function TimelineDock({
    currentTimeMs,
    durationMs,
    isPlaying,
    playbackSpeed,
    groupedTimeline,
    onTimeChange,
    onPlayToggle,
    onSpeedChange,
    onOpenStrategy,
    onOpenEvent
}: {
    currentTimeMs: number;
    durationMs: number;
    isPlaying: boolean;
    playbackSpeed: number;
    groupedTimeline: Record<TimelineEvent['lane'], TimelineEvent[]>;
    onTimeChange: (timeMs: number) => void;
    onPlayToggle: () => void;
    onSpeedChange: (speed: number) => void;
    onOpenStrategy: () => void;
    onOpenEvent: (event: TimelineEvent) => void;
}) {
    const lanes: { id: TimelineEvent['lane']; label: string; tone: string }[] = [
        { id: 'cast', label: '主输出施法', tone: 'bg-cyan-300' },
        { id: 'buff', label: '我方 Buff', tone: 'bg-emerald-300' },
        { id: 'debuff', label: 'Boss Debuff', tone: 'bg-amber-300' },
        { id: 'damage', label: '伤害命中', tone: 'bg-red-300' }
    ];

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/95 overflow-hidden grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-b xl:border-b-0 xl:border-r border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">回放时间轴</p>
                        <h3 className="text-sm font-black text-slate-100">{formatMs(currentTimeMs)} / {formatMs(durationMs)}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onPlayToggle}
                        className="w-9 h-9 rounded-xl bg-cyan-500 text-slate-950 grid place-items-center hover:bg-cyan-300 transition-colors"
                        title={isPlaying ? '暂停' : '播放'}
                    >
                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => onTimeChange(Math.max(0, currentTimeMs - 1000))} className="w-8 h-8 rounded-lg border border-slate-800 text-slate-300 grid place-items-center hover:border-slate-600">
                        <SkipBack className="w-4 h-4" />
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={durationMs}
                        step={50}
                        value={Math.min(currentTimeMs, durationMs)}
                        onChange={(event) => onTimeChange(Number(event.target.value))}
                        className="flex-1 accent-cyan-400"
                    />
                    <button type="button" onClick={() => onTimeChange(Math.min(durationMs, currentTimeMs + 1000))} className="w-8 h-8 rounded-lg border border-slate-800 text-slate-300 grid place-items-center hover:border-slate-600">
                        <SkipForward className="w-4 h-4" />
                    </button>
                </div>
                <div className="mt-2 flex gap-1.5">
                    {[0.5, 1, 2, 4].map(speed => (
                        <button
                            key={speed}
                            type="button"
                            onClick={() => onSpeedChange(speed)}
                            className={clsx(
                                'flex-1 rounded-lg border py-1 text-[10px] font-black',
                                playbackSpeed === speed ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-slate-800 text-slate-500'
                            )}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={onOpenStrategy}
                    className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-bold text-slate-200 hover:border-cyan-400/40 transition-colors"
                >
                    编辑手动时间轴表格
                </button>
            </div>

            <div className="min-w-0 p-3 overflow-hidden">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.22em]">所有事件点</p>
                        <p className="text-[11px] text-slate-500">施法、Buff、Debuff 与伤害按轨道显示</p>
                    </div>
                    <div className="hidden lg:flex items-center gap-3">
                        {lanes.map(lane => (
                            <span key={lane.id} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                <span className={clsx('w-2 h-2 rounded-full', lane.tone)} />
                                {lane.label}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="min-w-0 overflow-y-auto space-y-1.5">
                    {lanes.map(lane => (
                        <div key={lane.id} className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold text-right">{lane.label}</span>
                            <div className="relative h-6 rounded-lg bg-slate-900/85 border border-slate-800 overflow-hidden">
                                {lane.id === 'damage' && (
                                    <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(248,113,113,0.04),transparent)]" />
                                )}
                                {groupedTimeline[lane.id].map(event => {
                                    const left = Math.max(0, Math.min(100, (event.timeMs / Math.max(durationMs, 1)) * 100));
                                    return (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => onOpenEvent(event)}
                                            className={clsx('absolute top-1/2 -translate-y-1/2 w-2.5 h-4 rounded-full border border-slate-950 hover:h-5 transition-all', lane.tone)}
                                            style={{ left: `${left}%` }}
                                            title={`${event.title} · ${formatMs(event.timeMs)}`}
                                        />
                                    );
                                })}
                                <div
                                    className="absolute top-0 bottom-0 w-px bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.9)]"
                                    style={{ left: `${Math.max(0, Math.min(100, (currentTimeMs / Math.max(durationMs, 1)) * 100))}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function StatPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
            <p className="mt-1 text-sm font-black text-slate-100">{value}</p>
        </div>
    );
}

function EmptyDrawerMessage({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
    return (
        <div className="min-h-[320px] grid place-items-center text-center">
            <div>
                <div className="mx-auto w-12 h-12 rounded-xl border border-slate-800 bg-slate-900 grid place-items-center text-cyan-300">
                    {icon}
                </div>
                <h4 className="mt-4 text-sm font-black text-slate-100">{title}</h4>
                <p className="mt-2 max-w-sm text-xs text-slate-500 leading-relaxed">{message}</p>
            </div>
        </div>
    );
}

function ExplorerDetail({
    item,
    getSkillStatus,
    onOpenSkill
}: {
    item?: ExplorerItem;
    getSkillStatus: (skillId: string) => { label: string; tone: string; dot: string; explanation: string };
    onOpenSkill: (skill: Skill) => void;
}) {
    if (!item) {
        return <EmptyDrawerMessage icon={<Database className="w-5 h-5" />} title="没有匹配资料" message="尝试输入中文名、JSON ID 或常用拼音别名。" />;
    }

    if (item.skill) {
        return (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">技能</p>
                        <h4 className="mt-1 text-lg font-black text-slate-100">{item.skill.SkillName}</h4>
                        <p className="mt-1 text-[11px] text-slate-500 font-mono">{item.skill.SkillID}</p>
                    </div>
                    <button type="button" onClick={() => onOpenSkill(item.skill!)} className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-xs font-bold">
                        详情
                    </button>
                </div>
                <div className="mt-4">
                    <SkillDetail skill={item.skill} getSkillStatus={getSkillStatus} compact />
                </div>
            </div>
        );
    }

    if (item.boss) {
        return <BossDetail boss={item.boss} dungeon={item.dungeon} />;
    }

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">职业</p>
            <h4 className="mt-1 text-lg font-black text-slate-100">{item.title}</h4>
            <p className="mt-2 text-xs text-slate-400">{item.subtitle}</p>
        </div>
    );
}

function SkillDetail({
    skill,
    getSkillStatus,
    compact = false
}: {
    skill: Skill;
    getSkillStatus: (skillId: string) => { label: string; tone: string; dot: string; explanation: string };
    compact?: boolean;
}) {
    const status = getSkillStatus(skill.SkillID);
    const bonusEntries = Object.entries(skill.SkillBonusAttributes || {});
    const effectEntries = (skill.AppliesEffects || []) as any[];

    return (
        <div className={clsx('space-y-4', compact ? '' : 'rounded-xl border border-slate-800 bg-slate-900/40 p-4')}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    {!compact && <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">技能详情</p>}
                    {!compact && <h4 className="mt-1 text-xl font-black text-slate-100">{skill.SkillName}</h4>}
                    <p className="mt-1 text-[11px] text-slate-500 font-mono">{skill.SkillID}</p>
                </div>
                <span className={clsx('px-2.5 py-1 rounded-full border text-[11px] font-black shrink-0', status.tone)}>
                    {status.label}
                </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{skill.Description || '暂无描述'}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <StatPill label="职业/阵营" value={`${CLASS_LABEL[skill.RequiredClass] || skill.RequiredClass} · ${FACTION_LABEL[skill.Faction] || skill.Faction}`} />
                <StatPill label="类型" value={translateActionType(skill.ActionType)} />
                <StatPill label="冷却" value={`${skill.Cooldown}s`} />
                <StatPill label="持续/释放" value={`${skill.CastTime}s`} />
            </div>
            <InfoBlock title="结算状态" rows={[status.explanation]} />
            <InfoBlock
                title="属性加成字段"
                rows={bonusEntries.length > 0 ? bonusEntries.map(([key, value]) => `${translateFieldName(key)}: ${formatConfigValue(value)}`) : ['无直接属性加成字段']}
            />
            <InfoBlock
                title="Buff / Debuff / 效果"
                rows={effectEntries.length > 0 ? effectEntries.map((effect, index) => `${index + 1}. ${formatEffectDetail(effect)}`) : ['无效果配置']}
            />
        </div>
    );
}

function BossDetail({ boss, dungeon }: { boss: Monster; dungeon?: Dungeon }) {
    const attrs = boss.MonsterAttributeModifiers;
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Boss 属性</p>
                <h4 className="mt-1 text-xl font-black text-slate-100">{boss.MonsterName}</h4>
                <p className="mt-1 text-[11px] text-slate-500">{dungeon?.DungeonName || '未知副本'} · {boss.MonsterID}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <StatPill label="基础血量" value={formatLargeNumber(attrs.MonsterHealth || 0)} />
                <StatPill label="副本等级" value={String(boss.DungeonLevel)} />
                <StatPill label="减爆伤" value={`${attrs.MonsterCriticalDamagePercentReduction || 0}%`} />
                <StatPill label="伤害压缩" value={attrs.DamageCompressionPercent !== undefined ? `${attrs.DamageCompressionPercent}%` : '未配置'} />
                <StatPill label="防御" value={attrs.MonsterDefense ? formatLargeNumber(attrs.MonsterDefense) : '未配置'} />
                <StatPill label="减暴击" value={attrs.MonsterCriticalHitRateReduction !== undefined ? `${attrs.MonsterCriticalHitRateReduction}%` : '未配置'} />
            </div>
        </div>
    );
}

function TimelineEventDetail({ event }: { event: TimelineEvent }) {
    const detailRows = buildTimelineDetailRows(event);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">时间轴节点</p>
                <h4 className="mt-1 text-xl font-black text-slate-100">{event.title}</h4>
                <p className="mt-1 text-[11px] text-slate-500">{event.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <StatPill label="时间" value={formatMs(event.timeMs)} />
                <StatPill label="轨道" value={translateLaneName(event.lane)} />
            </div>
            <InfoBlock title="事件详情" rows={detailRows} />
        </div>
    );
}

function translateLaneName(lane: TimelineEvent['lane']) {
    const map: Record<TimelineEvent['lane'], string> = {
        cast: '主输出施法',
        buff: '我方 Buff',
        debuff: 'Boss Debuff',
        damage: '伤害命中'
    };
    return map[lane];
}

function buildTimelineDetailRows(event: TimelineEvent) {
    if (!event.raw) return ['无更多事件数据'];
    if ('DamageApplied' in event.raw) {
        const hit = event.raw as HitDamageRecord;
        return [
            `施法角色: ${hit.ActorId}`,
            `技能: ${hit.SkillName}`,
            `命中段数: ${hit.HitIndex}/${hit.HitCount}`,
            `造成伤害: ${formatLargeNumber(hit.DamageApplied)}`,
            `Boss 血量: ${formatLargeNumber(hit.BossHpBefore)} -> ${formatLargeNumber(hit.BossHpAfter)}`,
            `生效状态: ${hit.ActiveEffectIds.length > 0 ? `${hit.ActiveEffectIds.length} 个活跃效果` : '无'}`
        ];
    }
    const simEvent = event.raw as SimEventLog;
    return [
        `事件类型: ${translateEventType(simEvent.type)}`,
        `处理状态: ${translateEventStatus(simEvent.status)}`,
        `施法角色: ${simEvent.actorId || '系统'}`,
        `目标: ${simEvent.targetId || '无'}`,
        simEvent.skillId ? `技能 ID: ${simEvent.skillId}` : '',
        `效果: ${getEventEffectName(simEvent)}`
    ].filter(Boolean);
}

function translateEventStatus(status: string) {
    const map: Record<string, string> = {
        PROCESSED: '已处理',
        SKIPPED: '已跳过',
        FAILED: '失败'
    };
    return map[status] || status;
}

function translateActionType(type: string | undefined) {
    const map: Record<string, string> = {
        DAMAGE: '输出',
        BUFF: '增益',
        DEBUFF: '减益',
        UTILITY: '功能'
    };
    return map[type || 'DAMAGE'] || type || '输出';
}

function InfoBlock({ title, rows }: { title: string; rows: string[] }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">{title}</p>
            <div className="space-y-1.5">
                {rows.map((row, index) => (
                    <p key={`${title}-${index}`} className="text-[11px] text-slate-300 leading-relaxed break-words">
                        {row}
                    </p>
                ))}
            </div>
        </div>
    );
}
