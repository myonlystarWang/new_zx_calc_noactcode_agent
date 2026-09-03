import type {
  AgentCalcInput,
  AttributeCapsConfig,
  Buff,
  CharacterAttributes,
  CharacterClass,
  DungeonMeta,
  GameData,
  Monster,
  Skill,
  ValidationIssue
} from './types.js';

export interface NormalizedRequest {
  classInfo: CharacterClass;
  faction: 'XIAN' | 'FO' | 'MO';
  factionName: string;
  attributes: CharacterAttributes;
  activeBuffs: Buff[];
  buffValues: Record<string, number>;
  dungeon: DungeonMeta;
  monsters: Monster[];
  selectedMonsters: Monster[];
  skills: Skill[];
  /** 属性上限覆盖（可选，来自 profile.attributeCaps） */
  attributeCaps?: AttributeCapsConfig;
}

const factionAliases: Record<string, 'XIAN' | 'FO' | 'MO'> = {
  XIAN: 'XIAN',
  FO: 'FO',
  MO: 'MO',
  xian: 'XIAN',
  fo: 'FO',
  mo: 'MO',
  仙: 'XIAN',
  佛: 'FO',
  魔: 'MO'
};

const factionNames: Record<'XIAN' | 'FO' | 'MO', string> = {
  XIAN: '仙',
  FO: '佛',
  MO: '魔'
};

const attrAliases: Record<keyof CharacterAttributes, string[]> = {
  CharacterMinAttack: ['CharacterMinAttack', 'minAttack', 'min_attack', '最小攻击'],
  CharacterMaxAttack: ['CharacterMaxAttack', 'maxAttack', 'max_attack', '最大攻击'],
  CharacterDefense: ['CharacterDefense', 'defense', '防御'],
  CharacterHealth: ['CharacterHealth', 'health', 'hp', '气血'],
  CharacterMana: ['CharacterMana', 'mana', 'mp', '真气'],
  CharacterCriticalHitDamagePercent: [
    'CharacterCriticalHitDamagePercent',
    'critDamage',
    'criticalDamage',
    '爆伤'
  ],
  CharacterCriticalHitRatePercent: [
    'CharacterCriticalHitRatePercent',
    'critRate',
    'criticalRate',
    '暴击率',
    '暴击'
  ],
  CharacterMonsterDamageIncreasePercent: [
    'CharacterMonsterDamageIncreasePercent',
    'monsterDamageIncrease',
    'monsterDamage',
    '对怪增伤'
  ],
  CharacterOnePercentAttack: ['CharacterOnePercentAttack', 'onePercentAttack', '1%攻击', '一分攻击'],
  CharacterOnePercentDefense: ['CharacterOnePercentDefense', 'onePercentDefense', '1%防御', '一分防御'],
  CharacterOnePercentHealth: ['CharacterOnePercentHealth', 'onePercentHealth', '1%气血', '一分气血'],
  CharacterOnePercentMana: ['CharacterOnePercentMana', 'onePercentMana', '1%真气', '一分真气']
};

const requiredAttributes: Array<keyof CharacterAttributes> = [
  'CharacterMinAttack',
  'CharacterMaxAttack',
  'CharacterHealth',
  'CharacterMana',
  'CharacterCriticalHitDamagePercent',
  'CharacterMonsterDamageIncreasePercent'
];

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const readFirstNumber = (source: Record<string, unknown>, aliases: string[]): number | undefined => {
  for (const alias of aliases) {
    const value = getNumber(source[alias]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const normalizeToken = (value: string): string => {
  return value.trim().toLowerCase().replace(/[\s_（）()！!·.-]/g, '');
};

const resolveClass = (input: AgentCalcInput, classes: CharacterClass[], issues: ValidationIssue[]) => {
  const rawClassId = getString(input.classId);
  const rawClassName = getString(input.className);
  const matched =
    (rawClassId && classes.find((item) => item.ClassID.toLowerCase() === rawClassId.toLowerCase())) ||
    (rawClassName &&
      classes.find(
        (item) =>
          item.ClassName === rawClassName ||
          normalizeToken(item.ClassName) === normalizeToken(rawClassName) ||
          normalizeToken(item.ClassID) === normalizeToken(rawClassName)
      ));

  if (!matched) {
    issues.push({
      field: 'classId/className',
      message: `未知职业: ${rawClassId || rawClassName || '(未提供)'}`
    });
  }
  return matched;
};

const resolveFaction = (input: AgentCalcInput, issues: ValidationIssue[]) => {
  const raw = getString(input.faction) || getString(input.factionName);
  const faction = raw ? factionAliases[raw] : undefined;
  if (!faction) {
    issues.push({ field: 'faction/factionName', message: `未知阵营: ${raw || '(未提供)'}` });
  }
  return faction;
};

const normalizeAttributes = (source: unknown, issues: ValidationIssue[]): CharacterAttributes | undefined => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    issues.push({ field: 'attributes', message: '缺少 attributes 对象' });
    return undefined;
  }

  const attrs = source as Record<string, unknown>;
  const result: Partial<CharacterAttributes> = {};
  for (const key of Object.keys(attrAliases) as Array<keyof CharacterAttributes>) {
    const value = readFirstNumber(attrs, attrAliases[key]);
    if (value !== undefined) result[key] = value;
  }

  if (result.CharacterDefense === undefined) {
    result.CharacterDefense = 5000;
  }

  for (const key of requiredAttributes) {
    if (result[key] === undefined) {
      issues.push({ field: `attributes.${key}`, message: `缺少角色属性 ${key}` });
    }
  }

  if (issues.some((issue) => issue.field.startsWith('attributes.'))) return undefined;
  return result as CharacterAttributes;
};

const resolveDungeon = (input: AgentCalcInput, dungeons: DungeonMeta[], issues: ValidationIssue[]) => {
  const target = input.target && typeof input.target === 'object' && !Array.isArray(input.target)
    ? (input.target as Record<string, unknown>)
    : undefined;
  const raw =
    getString(target?.dungeonId) ||
    getString(target?.dungeonName) ||
    getString(target?.dungeonAlias) ||
    getString(target?.dungeon);

  if (!raw) {
    issues.push({ field: 'target.dungeon', message: '缺少目标副本' });
    return undefined;
  }

  const tMatch = /^t(\d+)$/i.exec(raw.trim());
  const matched = dungeons.find((item) => {
    if (item.DungeonID.toLowerCase() === raw.toLowerCase()) return true;
    if (item.DungeonName === raw || item.DungeonName.includes(raw)) return true;
    if (tMatch && item.DungeonID.endsWith(`_T${tMatch[1]}`)) return true;
    return normalizeToken(item.DungeonName).includes(normalizeToken(raw));
  });

  if (!matched) {
    issues.push({ field: 'target.dungeon', message: `未知副本: ${raw}` });
  }
  return matched;
};

const resolveSelectedMonsters = (
  input: AgentCalcInput,
  monsters: Monster[],
  issues: ValidationIssue[]
): Monster[] => {
  const target = input.target && typeof input.target === 'object' && !Array.isArray(input.target)
    ? (input.target as Record<string, unknown>)
    : {};

  const rawBossId = getString(target.bossId);
  const rawBossName = getString(target.bossName);
  const rawBossIndex = getNumber(target.bossIndex);

  if (rawBossId) {
    const monster = monsters.find((item) => item.MonsterID.toLowerCase() === rawBossId.toLowerCase());
    if (!monster) issues.push({ field: 'target.bossId', message: `未知 bossId: ${rawBossId}` });
    return monster ? [monster] : [];
  }

  if (rawBossName) {
    const monster = monsters.find(
      (item) => item.MonsterName === rawBossName || normalizeToken(item.MonsterName).includes(normalizeToken(rawBossName))
    );
    if (!monster) issues.push({ field: 'target.bossName', message: `未知 bossName: ${rawBossName}` });
    return monster ? [monster] : [];
  }

  if (rawBossIndex !== undefined) {
    const index = Math.trunc(rawBossIndex);
    const monster = monsters[index - 1];
    if (!monster) issues.push({ field: 'target.bossIndex', message: `bossIndex 越界: ${rawBossIndex}` });
    return monster ? [monster] : [];
  }

  return monsters;
};

const resolveBuffByName = (raw: string, buffs: Buff[]) => {
  return buffs.find(
    (buff) =>
      buff.BuffID.toLowerCase() === raw.toLowerCase() ||
      buff.BuffName === raw ||
      normalizeToken(buff.BuffName).includes(normalizeToken(raw)) ||
      normalizeToken(raw).includes(normalizeToken(buff.BuffName).replace('增益', ''))
  );
};

const normalizeBuffs = (input: AgentCalcInput, allBuffs: Buff[], issues: ValidationIssue[]) => {
  const raw = input.buffs;
  let useDefaults = true;
  let activeBuffIds = allBuffs.filter((buff) => buff.IsDefaultActive).map((buff) => buff.BuffID);
  const buffValues: Record<string, number> = {};

  for (const buff of allBuffs) {
    if (buff.DefaultEffectValue !== undefined) buffValues[buff.BuffID] = buff.DefaultEffectValue;
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.useDefaults === 'boolean') {
      useDefaults = obj.useDefaults;
      if (!useDefaults) activeBuffIds = [];
    }

    const explicitActive = obj.activeBuffIds;
    if (Array.isArray(explicitActive)) {
      activeBuffIds = [];
      for (const item of explicitActive) {
        const idOrName = getString(item);
        if (!idOrName) continue;
        const buff = resolveBuffByName(idOrName, allBuffs);
        if (buff) activeBuffIds.push(buff.BuffID);
        else issues.push({ field: 'buffs.activeBuffIds', message: `未知增益: ${idOrName}` });
      }
    }

    const overrides = obj.overrides && typeof obj.overrides === 'object' && !Array.isArray(obj.overrides)
      ? (obj.overrides as Record<string, unknown>)
      : {};
    const hermesProfileAliases: Record<string, string> = {
      focus: '专注',
      greenPoint: '绿点',
      monsterDamageTaken: '易伤',
      witchCurse: '巫咒'
    };
    for (const [profileKey, buffName] of Object.entries(hermesProfileAliases)) {
      if (obj[profileKey] !== undefined && overrides[buffName] === undefined) {
        overrides[buffName] = obj[profileKey];
      }
    }
    for (const [key, value] of Object.entries(overrides)) {
      const numberValue = getNumber(value);
      const buff = resolveBuffByName(key, allBuffs);
      if (!buff) {
        issues.push({ field: 'buffs.overrides', message: `未知增益覆盖项: ${key}` });
      } else if (numberValue === undefined) {
        issues.push({ field: 'buffs.overrides', message: `增益 ${key} 的值不是数字` });
      } else {
        buffValues[buff.BuffID] = numberValue;
        if (!activeBuffIds.includes(buff.BuffID)) activeBuffIds.push(buff.BuffID);
      }
    }
  }

  if (!useDefaults && activeBuffIds.length === 0) {
    activeBuffIds = [];
  }

  return {
    activeBuffs: allBuffs.filter((buff) => activeBuffIds.includes(buff.BuffID)),
    buffValues
  };
};

export const normalizeRequest = (input: AgentCalcInput, data: GameData): NormalizedRequest | { issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const classInfo = resolveClass(input, data.classes, issues);
  const faction = resolveFaction(input, issues);
  const attributes = normalizeAttributes(input.attributes, issues);
  const dungeon = resolveDungeon(input, data.dungeons, issues);
  const monsters = dungeon ? data.monstersByDungeon[dungeon.DungeonID] || [] : [];
  if (dungeon && monsters.length === 0) {
    issues.push({ field: 'target.dungeon', message: `副本没有 boss 数据: ${dungeon.DungeonID}` });
  }
  const selectedMonsters = resolveSelectedMonsters(input, monsters, issues);
  const { activeBuffs, buffValues } = normalizeBuffs(input, data.buffs, issues);
  const skills = classInfo && faction ? data.skills[classInfo.ClassID]?.[faction] || [] : [];
  if (classInfo && faction && skills.length === 0) {
    issues.push({ field: 'classId/faction', message: `${classInfo.ClassName}/${factionNames[faction]} 没有技能配置` });
  }

  if (issues.length > 0 || !classInfo || !faction || !attributes || !dungeon) {
    return { issues };
  }

  return {
    classInfo,
    faction,
    factionName: factionNames[faction],
    attributes,
    activeBuffs,
    buffValues,
    dungeon,
    monsters,
    selectedMonsters,
    skills,
    attributeCaps: input.attributeCaps
  };
};
