import type {
    CharacterClass,
    AllSkills,
    Buff,
    Dungeon,
    Monster,
    RankConfig
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

    private constructor() { }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    public async loadAllData(): Promise<void> {
        await Promise.all([
            this.loadClasses(),
            this.loadSkills(),
            this.loadDungeons(),
            this.loadBuffs(),
            this.loadRankConfigs(),
            this.loadCompendiumData()
        ]);
    }

    private async loadClasses(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/classes.json`);
        this.classes = await response.json();
    }

    private async loadSkills(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/skills.json`);
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
        this.dungeonsMetadata = await metaResponse.json();
        this.dungeonsMonsters = await monstersResponse.json();
    }

    private async loadBuffs(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/combat_buffs.json`);
        this.buffs = await response.json();
    }

    private async loadRankConfigs(): Promise<void> {
        const response = await fetch(`${DATA_BASE_URL}/rank_config.json`);
        this.rankConfigs = await response.json();
    }

    private async loadCompendiumData(): Promise<void> {
        const [guideResponse, sourcesResponse] = await Promise.all([
            fetch(`${DATA_BASE_URL}/attribute_ceiling_guide.json`),
            fetch(`${DATA_BASE_URL}/stat_source_lists.json`)
        ]);
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

    public getDungeons(): Dungeon[] {
        if (!this.dungeonsMetadata || !this.dungeonsMonsters) return [];

        return this.dungeonsMetadata.map((meta: any) => {
            const monsters = this.dungeonsMonsters![meta.DungeonID] || [];
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
}
