import type {
    CharacterClass,
    AllSkills,
    Buff,
    Dungeon,
    Monster,
    RankConfig,
    FabaoItem,
    CuratedEquipItem,
    CuratedSkillItem
} from '../types';

const DATA_BASE_URL = '/game_data';

export interface AttributeCeilingRow {
    category: string;
    item: string;
    theoryMax: number;
    floor: number | string;
    top: number | string;
    graduation: number | string;
    nameConfidence?: string;
}

export interface AttributeCeilingSection {
    title: string;
    total: number;
    verified: boolean;
    rows: AttributeCeilingRow[];
}

export interface AttributeCeilingGuide {
    asOf: string;
    tierLabels: Record<string, string>;
    sections: Record<string, AttributeCeilingSection>;
}

export interface StatSourceSection {
    title: string;
    total?: number;
    subtotal?: number;
    grandTotal?: number;
    totalLabel?: string;
    verified: boolean;
    sources: { category?: string; item: string; value: number; note?: string }[];
    conditionals?: { category?: string; item: string; value: number; note?: string }[];
}

export interface StatSourceLists {
    sections: Record<string, StatSourceSection>;
}

export interface SupportRole {
    name: string;
    faction: string;
    damageBoost: number | string;
    greenPoint: number | string;
    purplePoint: number | string;
    defenseBreak: number | string;
    focus?: number | string;
    focusType?: ('group' | 'self')[];   // 群体专注 | 自身专注；可同时具备两者，分别归入两个分组
    critDamage?: number | string;       // 加爆伤（如 200 / 280）
    atkUp?: number | string;            // 加攻击
    healUp?: number | string;           // 加血
    manaUp?: number | string;           // 加蓝
    defUp?: number | string;            // 加防御
    monsterDmgUp?: number | string;     // 加怪增
    roleType: 'dps' | 'support';        // 输出职业完全没有团队增益；辅助职业提供团队增益
    abilities: string[];
    rating: string;
}

export interface SupportRoles {
    tableTitle: string;
    metrics: string[];
    roles: SupportRole[];
    notes: string[];
}

export class DataService {
    private static instance: DataService;

    private classes: CharacterClass[] | null = null;
    private skills: AllSkills | null = null;
    private dungeonsMetadata: any[] | null = null; // Raw dungeons.json
    private dungeonsMonsters: Record<string, Monster[]> | null = null;
    private buffs: Buff[] | null = null;
    private rankConfigs: RankConfig[] | null = null;
    private attributeCeilingGuide: AttributeCeilingGuide | null = null;
    private statSourceLists: StatSourceLists | null = null;
    private skillMeta: any = null;
    private fabaoList: FabaoItem[] | null = null;
    private equipList: CuratedEquipItem[] | null = null;
    private xycRules: any = null;
    private tianyuanData: any = null;
    private serverList: any[] | null = null;

    private constructor() { }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    public async loadAllData(): Promise<string[]> {
        const tasks = [
            { name: 'classes', fn: () => this.loadClasses() },
            { name: 'skills', fn: () => this.loadSkills() },
            { name: 'dungeons', fn: () => this.loadDungeons() },
            { name: 'buffs', fn: () => this.loadBuffs() },
            { name: 'rankConfigs', fn: () => this.loadRankConfigs() },
            { name: 'compendium', fn: () => this.loadCompendiumData() },
        ];
        const results = await Promise.allSettled(tasks.map(t => t.fn()));
        const errors: string[] = [];
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                errors.push(`${tasks[i].name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
            }
        });
        return errors; // 返回失败列表，调用方决定如何提示
    }

    private async loadClasses(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/classes.json`);
        if (!response.ok) throw new Error(`加载 classes.json 失败: ${response.status}`);
        this.classes = await response.json();
    }

    private async loadSkills(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/skills.json`);
        if (!response.ok) throw new Error(`加载 skills.json 失败: ${response.status}`);
        const raw = await response.json();
        this.skillMeta = (raw as any)?._meta ?? null;
        // Strip the top-level _meta key so allSkills/getSkills expose a clean class-keyed map.
        // (The _meta block would otherwise be iterated by consumers doing Object.entries(allSkills).)
        if (raw && typeof raw === 'object' && '_meta' in raw) {
            const { _meta, ...classMap } = raw as Record<string, unknown> & { _meta?: unknown };
            this.skills = classMap as AllSkills;
        } else {
            this.skills = raw as AllSkills;
        }
    }

    private async loadDungeons(): Promise<void> {
        const [metaResponse, monstersResponse] = await Promise.all([
            fetch(`${DATA_BASE_URL}/dungeons.json`),
            fetch(`${DATA_BASE_URL}/dungeons_monsters.json`)
        ]);
        if (!metaResponse.ok) throw new Error(`加载 dungeons.json 失败: ${metaResponse.status}`);
        if (!monstersResponse.ok) throw new Error(`加载 dungeons_monsters.json 失败: ${monstersResponse.status}`);
        this.dungeonsMetadata = await metaResponse.json();
        this.dungeonsMonsters = await monstersResponse.json();
    }

    private async loadBuffs(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/combat_buffs.json`);
        if (!response.ok) throw new Error(`加载 combat_buffs.json 失败: ${response.status}`);
        this.buffs = await response.json();
    }

    private async loadRankConfigs(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/rank_config.json`);
        if (!response.ok) throw new Error(`加载 rank_config.json 失败: ${response.status}`);
        this.rankConfigs = await response.json();
    }

    private async loadCompendiumData(): Promise<void> {
        const [guideResponse, sourcesResponse] = await Promise.all([
            fetch(`${DATA_BASE_URL}/attribute_ceiling_guide.json`),
            fetch(`${DATA_BASE_URL}/stat_source_lists.json`)
        ]);
        if (!guideResponse.ok) throw new Error(`加载 attribute_ceiling_guide.json 失败: ${guideResponse.status}`);
        if (!sourcesResponse.ok) throw new Error(`加载 stat_source_lists.json 失败: ${sourcesResponse.status}`);
        this.attributeCeilingGuide = await guideResponse.json();
        this.statSourceLists = await sourcesResponse.json();
    }

    public getClasses(): CharacterClass[] {
        return this.classes || [];
    }

    public getSkills(classId: string): Record<string, any[]> | null {
        return this.skills ? this.skills[classId] : null;
    }

    public getAllSkills(): AllSkills | null {
        return this.skills;
    }

    public getDungeonsMonsters(): Record<string, Monster[]> | null {
        return this.dungeonsMonsters;
    }

    /**
     * 将战斗用的 MonsterAttributeModifiers 转换为前端展示用的 displayAttributes。
     * 减爆伤/减暴击直接使用原始数值（与游戏内面板显示一致，如 1920）；伤害压缩为百分比。
     */
    private buildDisplayAttributes(monster: Monster): Monster['displayAttributes'] {
        const mods = monster.MonsterAttributeModifiers;
        if (!mods) return undefined;
        const attrs: Record<string, number> = {};
        if (mods.MonsterHealth !== undefined) attrs.health = mods.MonsterHealth;
        if (mods.MonsterDefense !== undefined) attrs.defense = mods.MonsterDefense;
        if (mods.MonsterAttack !== undefined) attrs.attack = mods.MonsterAttack;
        if (mods.MonsterCriticalDamagePercentReduction !== undefined) {
            attrs.critDamageReduction = mods.MonsterCriticalDamagePercentReduction;
        }
        if (mods.MonsterCriticalHitRateReduction !== undefined) {
            attrs.critRateReduction = mods.MonsterCriticalHitRateReduction;
        }
        if (mods.DamageCompressionPercent !== undefined) {
            attrs.damageCompression = mods.DamageCompressionPercent;
        }
        return Object.keys(attrs).length > 0 ? (attrs as Monster['displayAttributes']) : undefined;
    }

    public getDungeons(): Dungeon[] {
        if (!this.dungeonsMetadata || !this.dungeonsMonsters) return [];

        return this.dungeonsMetadata.map((meta: any) => {
            const monsters = (this.dungeonsMonsters![meta.DungeonID] || []).map(m => ({
                ...m,
                displayAttributes: m.displayAttributes ?? this.buildDisplayAttributes(m)
            }));
            return {
                ...meta,
                Monsters: monsters
            };
        });
    }

    public getBuffs(): Buff[] {
        return this.buffs || [];
    }

    public getRankConfigs(): RankConfig[] {
        return this.rankConfigs || [];
    }

    public getAttributeCeilingGuide(): AttributeCeilingGuide | null {
        return this.attributeCeilingGuide;
    }

    public getStatSourceLists(): StatSourceLists | null {
        return this.statSourceLists;
    }

    public getSkillMeta(): any | null {
        return this.skillMeta;
    }

    public getSupportClasses(): { id: string; name: string; defaultFaction: string }[] {
        return this.skillMeta?.supportClasses ?? [];
    }

    public getSupportRoles(): SupportRoles | null {
        return this.skillMeta?.supportRoles ?? null;
    }

    private fabaoListPromise: Promise<FabaoItem[]> | null = null;
    private equipListPromise: Promise<CuratedEquipItem[]> | null = null;
    private allCuratedSkillsPromise: Promise<CuratedSkillItem[]> | null = null;

    public async getFabaoList(): Promise<FabaoItem[]> {
        if (this.fabaoList) return this.fabaoList;
        if (!this.fabaoListPromise) {
            this.fabaoListPromise = (async () => {
                const res = await fetch(`${DATA_BASE_URL}/fabao_curated.json`);
                if (!res.ok) throw new Error(`加载 fabao_curated.json 失败: ${res.status}`);
                this.fabaoList = await res.json();
                return this.fabaoList!;
            })();
        }
        return this.fabaoListPromise;
    }

    public async getEquipList(): Promise<CuratedEquipItem[]> {
        if (this.equipList) return this.equipList;
        if (!this.equipListPromise) {
            this.equipListPromise = (async () => {
                const res = await fetch(`${DATA_BASE_URL}/equip_curated.json`);
                if (!res.ok) throw new Error(`加载 equip_curated.json 失败: ${res.status}`);
                const raw: CuratedEquipItem[] = await res.json();
                this.equipList = Array.isArray(raw) ? raw.filter(isValidEquip) : [];
                return this.equipList;
            })();
        }
        return this.equipListPromise;
    }

    public async getXycRules(): Promise<any> {
        if (this.xycRules) return this.xycRules;
        const res = await fetch(`${DATA_BASE_URL}/xyc_rules.json`);
        if (!res.ok) throw new Error(`加载 xyc_rules.json 失败: ${res.status}`);
        this.xycRules = await res.json();
        return this.xycRules;
    }

    public async getNewTianYuanData(): Promise<any> {
        if (this.tianyuanData) return this.tianyuanData;
        const res = await fetch(`${DATA_BASE_URL}/new_tianyuan_data.json`);
        if (!res.ok) throw new Error(`加载 new_tianyuan_data.json 失败: ${res.status}`);
        this.tianyuanData = await res.json();
        return this.tianyuanData;
    }

    public async getServerList(): Promise<any[]> {
        if (this.serverList) return this.serverList;
        const res = await fetch(`${DATA_BASE_URL}/server_list.json`);
        if (!res.ok) throw new Error(`加载 server_list.json 失败: ${res.status}`);
        this.serverList = await res.json();
        return this.serverList!;
    }

    private allCuratedSkills: CuratedSkillItem[] | null = null;

    public async getAllCuratedSkills(): Promise<CuratedSkillItem[]> {
        if (this.allCuratedSkills) return this.allCuratedSkills;
        if (!this.allCuratedSkillsPromise) {
            this.allCuratedSkillsPromise = (async () => {
                const res = await fetch(`${DATA_BASE_URL}/all_skills_curated.json`);
                if (!res.ok) throw new Error(`加载 all_skills_curated.json 失败: ${res.status}`);
                const raw: CuratedSkillItem[] = await res.json();
                this.allCuratedSkills = Array.isArray(raw) ? raw.filter(isValidSkill) : [];
                return this.allCuratedSkills;
            })();
        }
        return this.allCuratedSkillsPromise;
    }

    /**
     * 在打开主页时异步静默提取并预热所有 Copilot 意图识别与图鉴核心数据
     * 避免首次对话查询时产生网络与解析等待
     */
    public preloadCopilotData(): void {
        Promise.allSettled([
            this.getEquipList(),
            this.getFabaoList(),
            this.getAllCuratedSkills(),
            this.getServerList(),
            this.getXycRules()
        ]).catch(() => {});
    }
}

/**
 * 校验技能是否具备完整有效的描述说明与正文，排除开发测试占位符与脏数据
 */
export function isValidSkill(s: CuratedSkillItem): boolean {
    if (!s || !s.name) return false;
    const name = s.name.trim();
    if (!name) return false;
    // 屏蔽纯数字技能名（开发测试占位符，如 "2"、"111"、"5239" 等）
    if (/^\d+$/.test(name)) return false;
    // 屏蔽废弃、作废、测试等脏数据
    if (/^(废弃|作废|测试|temp|test)/i.test(name) || name.includes('大逃杀')) return false;

    // 屏蔽所有没有技能描述的技能
    if (!s.el_descs || !Array.isArray(s.el_descs) || s.el_descs.length === 0) return false;

    // 检查是否存在实质性的技能描述文本（不仅是学习条件）
    return s.el_descs.some(desc => {
        if (!desc || typeof desc !== 'string') return false;
        const clean = desc.replace(/\r/g, '').replace(/\^[0-9a-fA-F]{6}/g, '').trim();
        if (!clean) return false;
        const withoutReq = clean.replace(/学习条件[：:][\s\S]*$/, '').trim();
        return withoutReq.length > 0;
    });
}

/**
 * 校验装备是否具备实质性属性与词条，排除无属性测试道具与脏数据
 */
export function isValidEquip(e: CuratedEquipItem): boolean {
    if (!e || !e.name) return false;
    const name = e.name.trim();
    if (!name) return false;
    // 屏蔽纯数字装备名
    if (/^\d+$/.test(name)) return false;
    // 屏蔽测试废弃数据与大逃杀活动道具
    if (/^(不用|废弃|作废|测试|temp|test)/i.test(name) || name.includes('（不用）') || name.includes('(不用)') || name.includes('大逃杀')) return false;

    // 屏蔽单独以大阶品质名（如“昭武”、“修武”、“彰武”、“神隐”）命名的低等级入门装或测试占位条目
    const qualityNames = ['修武', '昭武', '彰武', '神隐'];
    if (qualityNames.includes(name) || e.id === 93997) return false;
    if (qualityNames.includes(e.q || '') && (e.lv || 0) < 100) return false;

    // 装备必须具备实质性属性或描述（基础属性、附加属性、套装/洗炼池或蕴灵成长）
    const hasBasic = Boolean(e.atk || e.def || e.hp || e.mp || e.hit || e.dod || e.rng);
    const hasAd = Boolean(e.ad && Array.isArray(e.ad) && e.ad.length > 0);
    const hasSj = Boolean(e.sj && typeof e.sj === 'object' && Object.keys(e.sj).length > 0);
    const hasRef = Boolean(e.ref && Array.isArray(e.ref) && e.ref.length > 0);

    return hasBasic || hasAd || hasSj || hasRef;
}

