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
    private supportRoles: SupportRoles | null = null;

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
        this.skills = await response.json();
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
        const [guideResponse, sourcesResponse, supportResponse] = await Promise.all([
            fetch(`${DATA_BASE_URL}/attribute_ceiling_guide.json`),
            fetch(`${DATA_BASE_URL}/stat_source_lists.json`),
            fetch(`${DATA_BASE_URL}/support_roles.json`)
        ]);
        this.attributeCeilingGuide = await guideResponse.json();
        this.statSourceLists = await sourcesResponse.json();
        this.supportRoles = await supportResponse.json();
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

    public getSupportRoles(): SupportRoles | null {
        return this.supportRoles;
    }
}
