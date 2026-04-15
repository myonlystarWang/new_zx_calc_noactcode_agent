// Character & Class
export interface CharacterClass {
  ClassID: string;
  ClassName: string;
  Description: string;
  Race: string;
}

export interface CharacterAttributes {
  CharacterMinAttack: number;
  CharacterMaxAttack: number;
  CharacterDefense: number;
  CharacterHealth: number;
  CharacterMana: number;
  CharacterCriticalHitDamagePercent: number;
  CharacterMonsterDamageIncreasePercent: number;
  // Add other attributes as needed
}

export interface UserCharacter {
  UserID: string;
  CharacterID: string;
  CharacterName: string;
  ClassID: string;
  Faction: 'XIAN' | 'FO' | 'MO'; // 阵营
  Level: number;
  BaseAttributes: CharacterAttributes;
}

// Skills
export interface MultiHitConfig {
  HitCount: number;
  DamageMultiplierPerHit?: number; // 每段伤害的倍增系数（基于第1段），例如1.3代表1.3^n
  DamageCap?: number; // 每段伤害的最高上限
  ScalingAttribute?: keyof SkillBonusAttributes; // 随段数线性递增的属性名
  ScalingStartValue?: number; // 第1段的属性值
  ScalingEndValue?: number; // 最后1段的属性值
}

export interface SkillBonusAttributes {
  SkillAttackPercentBonus?: number;
  SkillAttackFixedBonus?: number;
  SkillDefensePercentBonus?: number;
  SkillHealthPercentBonus?: number;
  SkillManaPercentBonus?: number;
  SkillCriticalDamagePercentBonus?: number;
  SkillDamageBonus?: number; // 伤害增加倍数
  MultiHitConfig?: MultiHitConfig; // 多段伤害配置
  // Add others as needed
}

export interface Skill {
  SkillID: string;
  SkillName: string;
  RequiredClass: string;
  Faction: string; // 'XIAN' | 'FO' | 'MO'
  SkillImportanceWeight: number;
  SkillFrequency: number;
  Cooldown: number;
  CastTime: number;
  IsAOE: boolean;
  SkillBonusAttributes: SkillBonusAttributes;
}

export interface ClassSkills {
  [faction: string]: Skill[]; // Key is Faction ID (XIAN, FO, MO)
}

export interface AllSkills {
  [classID: string]: ClassSkills;
}

// Monsters & Dungeons
export interface MonsterAttributeModifiers {
  MonsterCriticalDamagePercentReduction: number;
  DamageCompressionPercent?: number;
  MonsterAttack?: number;
  MonsterDefense?: number;
  MonsterHealth?: number;
}

export interface Monster {
  MonsterID: string;
  MonsterName: string;
  DungeonLevel: number;
  MonsterAttributeModifiers: MonsterAttributeModifiers;
}

export interface Dungeon {
  DungeonID: string;
  DungeonName: string; // Derived or separate metadata
  Description?: string;
  difficulty?: string;
  Monsters: Monster[];
}

// Buffs
export interface BuffEffects {
  BuffAttackPercentEffect?: number;
  BuffAttackFixedEffect?: number;
  BuffDefensePercentEffect?: number;
  BuffDefenseFixedEffect?: number;
  BuffHealthPercentEffect?: number;
  BuffHealthFixedEffect?: number;
  BuffManaPercentEffect?: number;
  BuffManaFixedEffect?: number;
  BuffCriticalDamagePercentEffect?: number;
  BuffFocusPercentEffect?: number;
  BuffMonsterDamageIncreaseEffect?: number;
  BuffHolyWrathPercentEffect?: number;
  BuffMonsterCriticalDamagePercentEffect?: number;
  BuffMonsterHarmedPercentEffect?: number;
}

export interface Buff {
  BuffID: string;
  BuffName: string;
  IsDefaultActive: boolean;
  IsEditable?: boolean;
  DefaultEffectValue?: number;
  BuffEffects: BuffEffects;
}

export interface RankConfig {
  Rank: string;
  Threshold: number;
  Color: string;
  Shadow: string;
  Border: string;
  TextColor: string;
  Glow: string;
}
