import type {
    CharacterClass,
    AllSkills,
    Buff,
    Dungeon,
    Monster,
    RankConfig
} from '../types';

const DATA_BASE_URL = '/game_data';

export class DataService {
    private static instance: DataService;

    private classes: CharacterClass[] | null = null;
    private skills: AllSkills | null = null;
    private dungeonsMetadata: any[] | null = null; // Raw dungeons.json
    private dungeonsMonsters: Record<string, Monster[]> | null = null;
    private buffs: Buff[] | null = null;
    private rankConfigs: RankConfig[] | null = null;

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
            this.loadRankConfigs()
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
}
