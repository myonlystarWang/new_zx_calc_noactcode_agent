// agent_tool/src/mcp_server.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve as resolve2, dirname as dirname2, basename } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// agent_tool/src/data.ts
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var toolDir = dirname(dirname(fileURLToPath(import.meta.url)));
var defaultDataDir = resolve(toolDir, "..", "web_app", "public", "game_data");
var readJson = async (path) => {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
};
var loadGameData = async (dataDir = defaultDataDir) => {
  const [classes, skills, dungeons, monstersByDungeon, buffs] = await Promise.all([
    readJson(resolve(dataDir, "classes.json")),
    readJson(resolve(dataDir, "skills.json")),
    readJson(resolve(dataDir, "dungeons.json")),
    readJson(resolve(dataDir, "dungeons_monsters.json")),
    readJson(resolve(dataDir, "combat_buffs.json"))
  ]);
  return {
    classes,
    skills,
    dungeons,
    monstersByDungeon,
    buffs
  };
};

// packages/simulation-engine/dist/attributes.js
var sumBuffEffectsFromBuffs = (buffs, buffValues = {}) => {
  const totals = {};
  for (const buff of buffs) {
    const overrideValue = buffValues[buff.BuffID];
    for (const [key, value] of Object.entries(buff.BuffEffects)) {
      if (value !== void 0) {
        totals[key] = (totals[key] ?? 0) + (overrideValue !== void 0 ? overrideValue : value);
      }
    }
  }
  return totals;
};
var resolveEffectiveCharacterAttributes = (base, totals) => ({
  CharacterMinAttack: base.CharacterMinAttack + resolvePercentBonus(base.CharacterMinAttack, totals.BuffAttackPercentEffect, base.CharacterOnePercentAttack) + (totals.BuffAttackFixedEffect ?? 0),
  CharacterMaxAttack: base.CharacterMaxAttack + resolvePercentBonus(base.CharacterMaxAttack, totals.BuffAttackPercentEffect, base.CharacterOnePercentAttack) + (totals.BuffAttackFixedEffect ?? 0),
  CharacterDefense: base.CharacterDefense + resolvePercentBonus(base.CharacterDefense, totals.BuffDefensePercentEffect, base.CharacterOnePercentDefense) + (totals.BuffDefenseFixedEffect ?? 0),
  CharacterHealth: base.CharacterHealth + resolvePercentBonus(base.CharacterHealth, totals.BuffHealthPercentEffect, base.CharacterOnePercentHealth) + (totals.BuffHealthFixedEffect ?? 0),
  CharacterMana: base.CharacterMana + resolvePercentBonus(base.CharacterMana, totals.BuffManaPercentEffect, base.CharacterOnePercentMana) + (totals.BuffManaFixedEffect ?? 0),
  CharacterCriticalHitDamagePercent: base.CharacterCriticalHitDamagePercent + (totals.BuffCriticalDamagePercentEffect ?? 0),
  CharacterCriticalHitRatePercent: (base.CharacterCriticalHitRatePercent ?? 0) + (totals.BuffCriticalHitRatePercentEffect ?? 0),
  CharacterMonsterDamageIncreasePercent: base.CharacterMonsterDamageIncreasePercent + (totals.BuffMonsterDamageIncreaseEffect ?? 0),
  CharacterOnePercentAttack: base.CharacterOnePercentAttack,
  CharacterOnePercentDefense: base.CharacterOnePercentDefense,
  CharacterOnePercentHealth: base.CharacterOnePercentHealth,
  CharacterOnePercentMana: base.CharacterOnePercentMana
});
var resolvePercentBonus = (baseValue, percent, onePercentValue) => {
  const pct = percent ?? 0;
  if (onePercentValue !== void 0 && onePercentValue > 0) {
    return pct * onePercentValue;
  }
  return baseValue * (pct / 100);
};

// packages/simulation-engine/dist/calculator.js
var DEFAULT_ATTRIBUTE_CAPS = {
  EnableCaps: true,
  CapHealth: 1e7,
  CapMana: 1e7,
  CapAttack: 1e6,
  CapDefense: 1e6,
  CapCriticalDamage: 4e3,
  CapGreenPoints: 900,
  CapMonsterHarmed: 120
};
var resolveHitDamage = (character, skill, monster, activeBuffs, hitIndex, buffValues = {}, caps) => {
  return resolveHitDamageWithTrace(character, skill, monster, activeBuffs, hitIndex, buffValues, caps).damage;
};
var resolveHitDamageWithTrace = (character, skill, monster, activeBuffs, hitIndex, buffValues = {}, caps) => {
  const effectiveCaps = resolveAttributeCaps(caps);
  const context = resolveDamageContext(character, activeBuffs, buffValues, caps);
  const { effectiveAttributes, buffTotals } = context;
  const effMinAttack = effectiveAttributes.CharacterMinAttack;
  const effMaxAttack = effectiveAttributes.CharacterMaxAttack;
  const effHealth = effectiveAttributes.CharacterHealth;
  const effMana = effectiveAttributes.CharacterMana;
  const effDefense = effectiveAttributes.CharacterDefense;
  const buffMonCritDmg = context.buffMonsterCriticalDamagePercent;
  const buffMonHarmed = context.buffMonsterHarmedPercent;
  const buffFocus = buffTotals.BuffFocusPercentEffect ?? 0;
  const buffHolyWrath = buffTotals.BuffHolyWrathPercentEffect ?? 0;
  const baseSkillBonus = skill.SkillBonusAttributes;
  const multiHit = baseSkillBonus.MultiHitConfig;
  const hitCount = multiHit ? multiHit.HitCount : 1;
  const currentSkillBonus = { ...baseSkillBonus };
  if (multiHit && multiHit.ScalingAttribute && multiHit.ScalingStartValue !== void 0 && multiHit.ScalingEndValue !== void 0) {
    const start = multiHit.ScalingStartValue;
    const end = multiHit.ScalingEndValue;
    const step = hitCount > 1 ? (end - start) / (hitCount - 1) : 0;
    currentSkillBonus[multiHit.ScalingAttribute] = start + step * (hitIndex - 1);
  }
  let minBaseDamage = effMinAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) + (currentSkillBonus.SkillAttackFixedBonus || 0) + effHealth * (currentSkillBonus.SkillHealthPercentBonus || 0) / 100 + effMana * (currentSkillBonus.SkillManaPercentBonus || 0) / 100 + effDefense * (currentSkillBonus.SkillDefensePercentBonus || 0) / 100;
  let maxBaseDamage = effMaxAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) + (currentSkillBonus.SkillAttackFixedBonus || 0) + effHealth * (currentSkillBonus.SkillHealthPercentBonus || 0) / 100 + effMana * (currentSkillBonus.SkillManaPercentBonus || 0) / 100 + effDefense * (currentSkillBonus.SkillDefensePercentBonus || 0) / 100;
  if (multiHit && multiHit.PerHitCharacterBonus && hitIndex > 1) {
    const ph = multiHit.PerHitCharacterBonus;
    const steps = hitIndex - 1;
    minBaseDamage += (ph.CharacterMaxAttackPercent || 0) / 100 * effMinAttack * steps + (ph.CharacterHealthPercent || 0) / 100 * effHealth * steps + (ph.CharacterManaPercent || 0) / 100 * effMana * steps;
    maxBaseDamage += (ph.CharacterMaxAttackPercent || 0) / 100 * effMaxAttack * steps + (ph.CharacterHealthPercent || 0) / 100 * effHealth * steps + (ph.CharacterManaPercent || 0) / 100 * effMana * steps;
  }
  const baseCritDmgBeforeCap = effectiveAttributes.CharacterCriticalHitDamagePercent + (currentSkillBonus.SkillCriticalDamagePercentBonus || 0);
  let baseCritDmg = baseCritDmgBeforeCap;
  if (effectiveCaps) {
    baseCritDmg = Math.min(baseCritDmg, effectiveCaps.CapCriticalDamage);
  }
  const monsterCriticalDamageReduction = monster.MonsterAttributeModifiers.MonsterCriticalDamagePercentReduction;
  const critDmgTotal = baseCritDmg + buffMonCritDmg - monsterCriticalDamageReduction;
  const critMultiplier = Math.max(1, critDmgTotal / 100);
  const damageBonusMultiplier = currentSkillBonus.SkillDamageBonus !== void 0 ? currentSkillBonus.SkillDamageBonus : 1;
  const charMonDmgInc = 1 + effectiveAttributes.CharacterMonsterDamageIncreasePercent / 100;
  const monHarmedMultiplier = 1 + buffMonHarmed / 100;
  const focusMultiplier = 1 + buffFocus / 100;
  const holyWrathMultiplier = 1 + buffHolyWrath / 100;
  const finalMultipliers = critMultiplier * damageBonusMultiplier * charMonDmgInc * monHarmedMultiplier * focusMultiplier * holyWrathMultiplier;
  let minFinal = minBaseDamage * finalMultipliers;
  let maxFinal = maxBaseDamage * finalMultipliers;
  if (multiHit && multiHit.DamageMultiplierPerHit) {
    const multiplier = Math.pow(multiHit.DamageMultiplierPerHit, hitIndex - 1);
    minFinal *= multiplier;
    maxFinal *= multiplier;
  }
  if (multiHit && multiHit.DamageCap) {
    minFinal = Math.min(minFinal, multiHit.DamageCap);
    maxFinal = Math.min(maxFinal, multiHit.DamageCap);
  }
  const avgFinal = (minFinal + maxFinal) / 2;
  const damage = {
    hitIndex,
    minFinalDamage: minFinal,
    maxFinalDamage: maxFinal,
    avgFinalDamage: avgFinal
  };
  return {
    damage,
    trace: {
      hitIndex,
      skillBonusAttributes: currentSkillBonus,
      uncappedAttributes: { ...context.uncappedAttributes },
      effectiveAttributes: { ...effectiveAttributes },
      combinedBuffTotals: { ...buffTotals },
      ybjhGreenMultiplierActive: context.ybjhGreenMultiplierActive,
      buffMonsterCriticalDamagePercentBeforeCap: context.buffMonsterCriticalDamagePercentBeforeCap,
      buffMonsterCriticalDamagePercentAfterCap: buffMonCritDmg,
      buffMonsterHarmedPercentBeforeCap: context.buffMonsterHarmedPercentBeforeCap,
      buffMonsterHarmedPercentAfterCap: buffMonHarmed,
      baseCriticalDamageBeforeCap: baseCritDmgBeforeCap,
      baseCriticalDamageAfterCap: baseCritDmg,
      monsterCriticalDamageReduction,
      criticalDamageTotal: critDmgTotal,
      minBaseDamage,
      maxBaseDamage,
      minFinalDamageBeforeCompression: minFinal,
      maxFinalDamageBeforeCompression: maxFinal,
      avgFinalDamageBeforeCompression: avgFinal,
      multipliers: {
        critMultiplier,
        skillDamageBonusMultiplier: damageBonusMultiplier,
        characterMonsterDamageIncreaseMultiplier: charMonDmgInc,
        monsterHarmedMultiplier: monHarmedMultiplier,
        focusMultiplier,
        holyWrathMultiplier,
        combinedBeforeCompression: finalMultipliers
      }
    }
  };
};
var calculateDamage = (character, skill, monster, activeBuffs, buffValues = {}, caps) => {
  const baseSkillBonus = skill.SkillBonusAttributes;
  const multiHit = baseSkillBonus.MultiHitConfig;
  const hitCount = multiHit ? multiHit.HitCount : 1;
  const context = resolveDamageContext(character, activeBuffs, buffValues, caps);
  let totalMinFinalDamage = 0;
  let totalMaxFinalDamage = 0;
  let totalAvgFinalDamage = 0;
  const hits = [];
  let firstHitMinBaseDamage = 0;
  let firstHitMaxBaseDamage = 0;
  for (let i = 1; i <= hitCount; i += 1) {
    const hitRes = resolveHitDamage(character, skill, monster, activeBuffs, i, buffValues, caps);
    if (i === 1) {
      const currentSkillBonus = { ...baseSkillBonus };
      if (multiHit && multiHit.ScalingAttribute && multiHit.ScalingStartValue !== void 0 && multiHit.ScalingEndValue !== void 0) {
        currentSkillBonus[multiHit.ScalingAttribute] = multiHit.ScalingStartValue;
      }
      firstHitMinBaseDamage = context.effectiveAttributes.CharacterMinAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) + (currentSkillBonus.SkillAttackFixedBonus || 0) + context.effectiveAttributes.CharacterHealth * (currentSkillBonus.SkillHealthPercentBonus || 0) / 100 + context.effectiveAttributes.CharacterMana * (currentSkillBonus.SkillManaPercentBonus || 0) / 100 + context.effectiveAttributes.CharacterDefense * (currentSkillBonus.SkillDefensePercentBonus || 0) / 100;
      firstHitMaxBaseDamage = context.effectiveAttributes.CharacterMaxAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) + (currentSkillBonus.SkillAttackFixedBonus || 0) + context.effectiveAttributes.CharacterHealth * (currentSkillBonus.SkillHealthPercentBonus || 0) / 100 + context.effectiveAttributes.CharacterMana * (currentSkillBonus.SkillManaPercentBonus || 0) / 100 + context.effectiveAttributes.CharacterDefense * (currentSkillBonus.SkillDefensePercentBonus || 0) / 100;
    }
    totalMinFinalDamage += hitRes.minFinalDamage;
    totalMaxFinalDamage += hitRes.maxFinalDamage;
    totalAvgFinalDamage += hitRes.avgFinalDamage;
    hits.push(hitRes);
  }
  return {
    minBaseDamage: firstHitMinBaseDamage,
    maxBaseDamage: firstHitMaxBaseDamage,
    minFinalDamage: totalMinFinalDamage,
    maxFinalDamage: totalMaxFinalDamage,
    avgFinalDamage: totalAvgFinalDamage,
    hits: multiHit ? hits : void 0
  };
};
var resolveDamageContext = (character, activeBuffs, buffValues, caps) => {
  const buffTotals = sumBuffEffectsFromBuffs(activeBuffs, buffValues);
  const uncappedAttributes = resolveEffectiveCharacterAttributes(character, buffTotals);
  const effectiveAttributes = { ...uncappedAttributes };
  let buffMonsterCriticalDamagePercent = buffTotals.BuffMonsterCriticalDamagePercentEffect ?? 0;
  let buffMonsterHarmedPercent = buffTotals.BuffMonsterHarmedPercentEffect ?? 0;
  const ybjhGreenMultiplierActive = activeBuffs.some((buff) => buff.EffectId === "FX_DEBUFF_YBJH_GREEN");
  if (ybjhGreenMultiplierActive) {
    buffMonsterCriticalDamagePercent *= 2;
  }
  const buffMonsterCriticalDamagePercentBeforeCap = buffMonsterCriticalDamagePercent;
  const buffMonsterHarmedPercentBeforeCap = buffMonsterHarmedPercent;
  const effectiveCaps = resolveAttributeCaps(caps);
  if (effectiveCaps) {
    effectiveAttributes.CharacterMinAttack = Math.min(effectiveAttributes.CharacterMinAttack, effectiveCaps.CapAttack);
    effectiveAttributes.CharacterMaxAttack = Math.min(effectiveAttributes.CharacterMaxAttack, effectiveCaps.CapAttack);
    effectiveAttributes.CharacterHealth = Math.min(effectiveAttributes.CharacterHealth, effectiveCaps.CapHealth);
    effectiveAttributes.CharacterMana = Math.min(effectiveAttributes.CharacterMana, effectiveCaps.CapMana);
    effectiveAttributes.CharacterDefense = Math.min(effectiveAttributes.CharacterDefense, effectiveCaps.CapDefense);
    buffMonsterCriticalDamagePercent = Math.min(buffMonsterCriticalDamagePercent, effectiveCaps.CapGreenPoints);
    buffMonsterHarmedPercent = Math.min(buffMonsterHarmedPercent, effectiveCaps.CapMonsterHarmed);
  }
  return {
    uncappedAttributes,
    effectiveAttributes,
    buffTotals,
    ybjhGreenMultiplierActive,
    buffMonsterCriticalDamagePercentBeforeCap,
    buffMonsterCriticalDamagePercent,
    buffMonsterHarmedPercentBeforeCap,
    buffMonsterHarmedPercent
  };
};
var resolveAttributeCaps = (caps) => {
  if (caps?.EnableCaps === false)
    return void 0;
  return {
    ...DEFAULT_ATTRIBUTE_CAPS,
    ...caps,
    EnableCaps: true
  };
};

// packages/simulation-engine/dist/fourth_gen.js
var ADDITIVE_BONUS_FIELDS = [
  "SkillAttackPercentBonus",
  "SkillAttackFixedBonus",
  "SkillDefensePercentBonus",
  "SkillHealthPercentBonus",
  "SkillManaPercentBonus",
  "SkillCriticalDamagePercentBonus",
  "SkillDamageBonus"
];
function mergeEffectOverridesLocal(skill, overrides) {
  if (!skill.AppliesEffects)
    return;
  skill.AppliesEffects = skill.AppliesEffects.map((effect) => {
    const override = overrides[effect.EffectId];
    if (!override)
      return effect;
    return {
      ...effect,
      ...override,
      BuffEffects: {
        ...effect.BuffEffects,
        ...override.BuffEffects || {}
      }
    };
  });
}
function applyOverrideCover(skill, ovr) {
  const { AppliesEffects, SkillBonusAttributes: bonusAttrs, ...topLevel } = ovr;
  Object.assign(skill, topLevel);
  if (bonusAttrs) {
    skill.SkillBonusAttributes = { ...skill.SkillBonusAttributes, ...bonusAttrs };
  }
  if (AppliesEffects)
    mergeEffectOverridesLocal(skill, AppliesEffects);
}
function applyOverrideAdditive(skill, ovr) {
  const { AppliesEffects, SkillBonusAttributes: bonusAttrs, ...topLevel } = ovr;
  Object.assign(skill, topLevel);
  if (bonusAttrs) {
    const merged = { ...skill.SkillBonusAttributes };
    for (const key of ADDITIVE_BONUS_FIELDS) {
      const inc = bonusAttrs[key];
      if (typeof inc === "number") {
        const current = merged[key];
        const base = typeof current === "number" ? current : 0;
        merged[key] = base + inc;
      }
    }
    if (bonusAttrs.MultiHitConfig !== void 0) {
      merged.MultiHitConfig = bonusAttrs.MultiHitConfig;
    }
    skill.SkillBonusAttributes = merged;
  }
  if (AppliesEffects)
    mergeEffectOverridesLocal(skill, AppliesEffects);
}

// packages/simulation-engine/dist/zhu_shuang.js
var ZS_LONGNU_PEAK_YYZC_LEVEL = 10;
var getZhuShuangLongNuBonus = (skillId, yyzcLevel) => {
  const perLevelBonus = 20 * yyzcLevel;
  const isXianCangLong = skillId === "ZS_XIAN_SKILL_CLX" || skillId === "ZS_XIAN_SKILL_CLXX";
  return isXianCangLong ? perLevelBonus + 100 : perLevelBonus;
};
var ZS_LONGNU_PEAK_SKILL_IDS = [
  "ZS_XIAN_SKILL_CLX",
  "ZS_XIAN_SKILL_CLXX",
  "ZS_MO_SKILL_CLX",
  "ZS_MO_SKILL_CLXS",
  "ZS_FO_SKILL_CLXC"
];

// packages/simulation-engine/dist/single_calc.js
var PEAK_QUALITY = "XI_RI";
var cloneSkill = (skill) => JSON.parse(JSON.stringify(skill));
var PEAK_VARIANT_RULES = [
  {
    variantTag: "LONGNU",
    suffix: "\xB7\u9F99\u6012",
    match: (id) => ZS_LONGNU_PEAK_SKILL_IDS.includes(id),
    // 龙怒按法宝+1 的 10 级鹰扬、满层（9 段全附加）取峰值：仙 +300、魔/佛 +200
    buildIncrement: (source) => ({
      SkillAttackPercentBonus: getZhuShuangLongNuBonus(source.SkillID, ZS_LONGNU_PEAK_YYZC_LEVEL)
    })
  }
];
var isDamageSkill = (skill) => !skill.ActionType || skill.ActionType === "DAMAGE";
var applyPeakFourthGen = (skillMap, pool) => {
  for (const fg of pool) {
    if (fg.ActionType !== "FOURTH_GEN_PASSIVE" || !fg.FourthGenSlot)
      continue;
    const fgInMap = skillMap[fg.SkillID];
    if (!fgInMap)
      continue;
    const selfPreset = fgInMap.FourthGenPresets?.[PEAK_QUALITY];
    if (selfPreset)
      applyOverrideCover(fgInMap, selfPreset);
    const grants = fgInMap.FourthGenGrants?.[PEAK_QUALITY];
    if (grants) {
      for (const grant of grants) {
        for (const targetId of grant.TargetSkillIds) {
          const target = skillMap[targetId];
          if (!target)
            continue;
          applyOverrideAdditive(target, grant.Override);
        }
      }
    }
  }
};
var buildPeakVariant = (source, rule) => {
  const variant = cloneSkill(source);
  variant.SkillID = `${source.SkillID}__PEAK_${rule.variantTag}`;
  variant.SkillName = `${source.SkillName}${rule.suffix}`;
  variant.Variant = rule.variantTag;
  const increment = rule.buildIncrement(source);
  const merged = { ...variant.SkillBonusAttributes ?? {} };
  for (const [key, value] of Object.entries(increment)) {
    if (typeof value !== "number")
      continue;
    merged[key] = (typeof merged[key] === "number" ? merged[key] : 0) + value;
  }
  variant.SkillBonusAttributes = merged;
  return variant;
};
var buildSingleCalcSkills = (classFactionSkills, faction) => {
  if (!classFactionSkills)
    return [];
  const own = classFactionSkills[faction] ?? [];
  const common = classFactionSkills["COMMON"] ?? [];
  const pool = [...own, ...common];
  if (own.length === 0)
    return [];
  const skillMap = {};
  for (const item of pool)
    skillMap[item.SkillID] = cloneSkill(item);
  applyPeakFourthGen(skillMap, pool);
  const result = [];
  for (const raw of own) {
    const full = skillMap[raw.SkillID];
    if (!full || !isDamageSkill(full))
      continue;
    result.push(full);
    const rule = PEAK_VARIANT_RULES.find((r) => r.match(full.SkillID));
    if (rule)
      result.push(buildPeakVariant(full, rule));
  }
  return result;
};

// packages/simulation-engine/dist/field_keys.js
var CHARACTER_ATTRIBUTE_KEYS = [
  "CharacterMinAttack",
  "CharacterMaxAttack",
  "CharacterDefense",
  "CharacterHealth",
  "CharacterMana",
  "CharacterCriticalHitDamagePercent",
  "CharacterCriticalHitRatePercent",
  "CharacterMonsterDamageIncreasePercent",
  "CharacterOnePercentAttack",
  "CharacterOnePercentDefense",
  "CharacterOnePercentHealth",
  "CharacterOnePercentMana"
];
var BUFF_EFFECT_KEYS = [
  "BuffAttackPercentEffect",
  "BuffAttackFixedEffect",
  "BuffDefensePercentEffect",
  "BuffDefenseFixedEffect",
  "BuffHealthPercentEffect",
  "BuffHealthFixedEffect",
  "BuffManaPercentEffect",
  "BuffManaFixedEffect",
  "BuffCriticalDamagePercentEffect",
  "BuffCriticalHitRatePercentEffect",
  "BuffFocusPercentEffect",
  "BuffMonsterDamageIncreaseEffect",
  "BuffHolyWrathPercentEffect",
  "BuffMonsterCriticalDamagePercentEffect",
  "BuffMonsterHarmedPercentEffect",
  "BuffMonsterCritRateIncreaseEffect",
  "BuffSpeedPercentEffect"
];
var CHARACTER_ATTRIBUTE_KEY_SET = new Set(CHARACTER_ATTRIBUTE_KEYS);
var BUFF_EFFECT_KEY_SET = new Set(BUFF_EFFECT_KEYS);

// agent_tool/src/normalize.ts
var factionAliases = {
  XIAN: "XIAN",
  FO: "FO",
  MO: "MO",
  xian: "XIAN",
  fo: "FO",
  mo: "MO",
  \u4ED9: "XIAN",
  \u4F5B: "FO",
  \u9B54: "MO"
};
var factionNames = {
  XIAN: "\u4ED9",
  FO: "\u4F5B",
  MO: "\u9B54"
};
var attrAliases = {
  CharacterMinAttack: ["CharacterMinAttack", "minAttack", "min_attack", "\u6700\u5C0F\u653B\u51FB"],
  CharacterMaxAttack: ["CharacterMaxAttack", "maxAttack", "max_attack", "\u6700\u5927\u653B\u51FB"],
  CharacterDefense: ["CharacterDefense", "defense", "\u9632\u5FA1"],
  CharacterHealth: ["CharacterHealth", "health", "hp", "\u6C14\u8840"],
  CharacterMana: ["CharacterMana", "mana", "mp", "\u771F\u6C14"],
  CharacterCriticalHitDamagePercent: [
    "CharacterCriticalHitDamagePercent",
    "critDamage",
    "criticalDamage",
    "\u7206\u4F24"
  ],
  CharacterCriticalHitRatePercent: [
    "CharacterCriticalHitRatePercent",
    "critRate",
    "criticalRate",
    "\u66B4\u51FB\u7387",
    "\u66B4\u51FB"
  ],
  CharacterMonsterDamageIncreasePercent: [
    "CharacterMonsterDamageIncreasePercent",
    "monsterDamageIncrease",
    "monsterDamage",
    "\u5BF9\u602A\u589E\u4F24"
  ],
  CharacterOnePercentAttack: ["CharacterOnePercentAttack", "onePercentAttack", "1%\u653B\u51FB", "\u4E00\u5206\u653B\u51FB"],
  CharacterOnePercentDefense: ["CharacterOnePercentDefense", "onePercentDefense", "1%\u9632\u5FA1", "\u4E00\u5206\u9632\u5FA1"],
  CharacterOnePercentHealth: ["CharacterOnePercentHealth", "onePercentHealth", "1%\u6C14\u8840", "\u4E00\u5206\u6C14\u8840"],
  CharacterOnePercentMana: ["CharacterOnePercentMana", "onePercentMana", "1%\u771F\u6C14", "\u4E00\u5206\u771F\u6C14"]
};
var requiredAttributes = [
  "CharacterMinAttack",
  "CharacterMaxAttack",
  "CharacterHealth",
  "CharacterMana",
  "CharacterCriticalHitDamagePercent",
  "CharacterMonsterDamageIncreasePercent"
];
var getString = (value) => {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
};
var getNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return void 0;
};
var readFirstNumber = (source, aliases) => {
  for (const alias of aliases) {
    const value = getNumber(source[alias]);
    if (value !== void 0) return value;
  }
  return void 0;
};
var normalizeToken = (value) => {
  return value.trim().toLowerCase().replace(/[\s_（）()！!·.-]/g, "");
};
var resolveClass = (input, classes, issues) => {
  const rawClassId = getString(input.classId);
  const rawClassName = getString(input.className);
  const matched = rawClassId && classes.find((item) => item.ClassID.toLowerCase() === rawClassId.toLowerCase()) || rawClassName && classes.find(
    (item) => item.ClassName === rawClassName || normalizeToken(item.ClassName) === normalizeToken(rawClassName) || normalizeToken(item.ClassID) === normalizeToken(rawClassName)
  );
  if (!matched) {
    issues.push({
      field: "classId/className",
      message: `\u672A\u77E5\u804C\u4E1A: ${rawClassId || rawClassName || "(\u672A\u63D0\u4F9B)"}`
    });
  }
  return matched;
};
var resolveFaction = (input, issues) => {
  const raw = getString(input.faction) || getString(input.factionName);
  const faction = raw ? factionAliases[raw] : void 0;
  if (!faction) {
    issues.push({ field: "faction/factionName", message: `\u672A\u77E5\u9635\u8425: ${raw || "(\u672A\u63D0\u4F9B)"}` });
  }
  return faction;
};
var normalizeAttributes = (source, issues) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    issues.push({ field: "attributes", message: "\u7F3A\u5C11 attributes \u5BF9\u8C61" });
    return void 0;
  }
  const attrs = source;
  const result = {};
  for (const key of Object.keys(attrAliases)) {
    const value = readFirstNumber(attrs, attrAliases[key]);
    if (value !== void 0) result[key] = value;
  }
  if (result.CharacterDefense === void 0) {
    result.CharacterDefense = 5e3;
  }
  for (const key of requiredAttributes) {
    if (result[key] === void 0) {
      issues.push({ field: `attributes.${key}`, message: `\u7F3A\u5C11\u89D2\u8272\u5C5E\u6027 ${key}` });
    }
  }
  if (issues.some((issue) => issue.field.startsWith("attributes."))) return void 0;
  return result;
};
var resolveDungeon = (input, dungeons, issues) => {
  const target = input.target && typeof input.target === "object" && !Array.isArray(input.target) ? input.target : void 0;
  const raw = getString(target?.dungeonId) || getString(target?.dungeonName) || getString(target?.dungeonAlias) || getString(target?.dungeon);
  if (!raw) {
    issues.push({ field: "target.dungeon", message: "\u7F3A\u5C11\u76EE\u6807\u526F\u672C" });
    return void 0;
  }
  const tMatch = /^t(\d+)$/i.exec(raw.trim());
  const matched = dungeons.find((item) => {
    if (item.DungeonID.toLowerCase() === raw.toLowerCase()) return true;
    if (item.DungeonName === raw || item.DungeonName.includes(raw)) return true;
    if (tMatch && item.DungeonID.endsWith(`_T${tMatch[1]}`)) return true;
    return normalizeToken(item.DungeonName).includes(normalizeToken(raw));
  });
  if (!matched) {
    issues.push({ field: "target.dungeon", message: `\u672A\u77E5\u526F\u672C: ${raw}` });
  }
  return matched;
};
var resolveSelectedMonsters = (input, monsters, issues) => {
  const target = input.target && typeof input.target === "object" && !Array.isArray(input.target) ? input.target : {};
  const rawBossId = getString(target.bossId);
  const rawBossName = getString(target.bossName);
  const rawBossIndex = getNumber(target.bossIndex);
  if (rawBossId) {
    const monster = monsters.find((item) => item.MonsterID.toLowerCase() === rawBossId.toLowerCase());
    if (!monster) issues.push({ field: "target.bossId", message: `\u672A\u77E5 bossId: ${rawBossId}` });
    return monster ? [monster] : [];
  }
  if (rawBossName) {
    const monster = monsters.find(
      (item) => item.MonsterName === rawBossName || normalizeToken(item.MonsterName).includes(normalizeToken(rawBossName))
    );
    if (!monster) issues.push({ field: "target.bossName", message: `\u672A\u77E5 bossName: ${rawBossName}` });
    return monster ? [monster] : [];
  }
  if (rawBossIndex !== void 0) {
    const index = Math.trunc(rawBossIndex);
    const monster = monsters[index - 1];
    if (!monster) issues.push({ field: "target.bossIndex", message: `bossIndex \u8D8A\u754C: ${rawBossIndex}` });
    return monster ? [monster] : [];
  }
  return monsters;
};
var resolveBuffByName = (raw, buffs) => {
  return buffs.find(
    (buff) => buff.BuffID.toLowerCase() === raw.toLowerCase() || buff.BuffName === raw || normalizeToken(buff.BuffName).includes(normalizeToken(raw)) || normalizeToken(raw).includes(normalizeToken(buff.BuffName).replace("\u589E\u76CA", ""))
  );
};
var normalizeBuffs = (input, allBuffs, issues) => {
  const raw = input.buffs;
  let useDefaults = true;
  let activeBuffIds = allBuffs.filter((buff) => buff.IsDefaultActive).map((buff) => buff.BuffID);
  const buffValues = {};
  for (const buff of allBuffs) {
    if (buff.DefaultEffectValue !== void 0) buffValues[buff.BuffID] = buff.DefaultEffectValue;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw;
    if (typeof obj.useDefaults === "boolean") {
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
        else issues.push({ field: "buffs.activeBuffIds", message: `\u672A\u77E5\u589E\u76CA: ${idOrName}` });
      }
    }
    const overrides = obj.overrides && typeof obj.overrides === "object" && !Array.isArray(obj.overrides) ? obj.overrides : {};
    const hermesProfileAliases = {
      focus: "\u4E13\u6CE8",
      greenPoint: "\u7EFF\u70B9",
      monsterDamageTaken: "\u6613\u4F24",
      witchCurse: "\u5DEB\u5492"
    };
    for (const [profileKey, buffName] of Object.entries(hermesProfileAliases)) {
      if (obj[profileKey] !== void 0 && overrides[buffName] === void 0) {
        overrides[buffName] = obj[profileKey];
      }
    }
    for (const [key, value] of Object.entries(overrides)) {
      const numberValue = getNumber(value);
      const buff = resolveBuffByName(key, allBuffs);
      if (!buff) {
        issues.push({ field: "buffs.overrides", message: `\u672A\u77E5\u589E\u76CA\u8986\u76D6\u9879: ${key}` });
      } else if (numberValue === void 0) {
        issues.push({ field: "buffs.overrides", message: `\u589E\u76CA ${key} \u7684\u503C\u4E0D\u662F\u6570\u5B57` });
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
var normalizeRequest = (input, data) => {
  const issues = [];
  const classInfo = resolveClass(input, data.classes, issues);
  const faction = resolveFaction(input, issues);
  const attributes = normalizeAttributes(input.attributes, issues);
  const dungeon = resolveDungeon(input, data.dungeons, issues);
  const monsters = dungeon ? data.monstersByDungeon[dungeon.DungeonID] || [] : [];
  if (dungeon && monsters.length === 0) {
    issues.push({ field: "target.dungeon", message: `\u526F\u672C\u6CA1\u6709 boss \u6570\u636E: ${dungeon.DungeonID}` });
  }
  const selectedMonsters = resolveSelectedMonsters(input, monsters, issues);
  const { activeBuffs, buffValues } = normalizeBuffs(input, data.buffs, issues);
  const rawFactionSkills = classInfo ? data.skills[classInfo.ClassID] : void 0;
  const skills = classInfo && faction ? buildSingleCalcSkills(rawFactionSkills, faction) : [];
  if (classInfo && faction && skills.length === 0) {
    issues.push({ field: "classId/faction", message: `${classInfo.ClassName}/${factionNames[faction]} \u6CA1\u6709\u6280\u80FD\u914D\u7F6E` });
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

// agent_tool/src/engine.ts
var round = (value) => Math.round(value);
var formatWanYi = (value) => {
  if (value >= 1e8) return `${(value / 1e8).toFixed(3)}\u4EBF`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(3)}\u4E07`;
  return `${Math.round(value)}`;
};
var serializeDamage = (skill, damage) => ({
  skillId: skill.SkillID,
  skillName: skill.SkillName,
  minBaseDamage: round(damage.minBaseDamage),
  maxBaseDamage: round(damage.maxBaseDamage),
  minFinalDamage: round(damage.minFinalDamage),
  maxFinalDamage: round(damage.maxFinalDamage),
  avgFinalDamage: round(damage.avgFinalDamage),
  hits: damage.hits?.map((hit) => ({
    hitIndex: hit.hitIndex,
    minFinalDamage: round(hit.minFinalDamage),
    maxFinalDamage: round(hit.maxFinalDamage),
    avgFinalDamage: round(hit.avgFinalDamage)
  }))
});
var calculateFromInput = async (input, dataDir) => {
  const data = await loadGameData(dataDir);
  const normalized = normalizeRequest(input, data);
  if ("issues" in normalized) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        issues: normalized.issues
      }
    };
  }
  const effectiveCaps = {
    EnableCaps: true,
    ...normalized.classInfo?.CapHealth != null ? { CapHealth: normalized.classInfo.CapHealth } : {},
    ...normalized.classInfo?.CapMana != null ? { CapMana: normalized.classInfo.CapMana } : {},
    ...normalized.attributeCaps || {}
  };
  const damageSkills = normalized.skills.filter(
    (skill) => !skill.ActionType || skill.ActionType === "DAMAGE"
  );
  const bossResults = normalized.selectedMonsters.map((monster) => {
    const skills = damageSkills.map((skill) => {
      const damage = calculateDamage(
        normalized.attributes,
        skill,
        monster,
        normalized.activeBuffs,
        normalized.buffValues,
        effectiveCaps
      );
      return serializeDamage(skill, damage);
    });
    return {
      bossId: monster.MonsterID,
      bossName: monster.MonsterName,
      dungeonLevel: monster.DungeonLevel,
      monsterAttributeModifiers: monster.MonsterAttributeModifiers,
      skills
    };
  });
  const firstBoss = bossResults[0];
  const summaryLines = firstBoss ? firstBoss.skills.map((skill) => `${skill.skillName}: \u5E73\u5747 ${formatWanYi(skill.avgFinalDamage)}`) : [];
  return {
    ok: true,
    resolved: {
      classId: normalized.classInfo.ClassID,
      className: normalized.classInfo.ClassName,
      faction: normalized.faction,
      factionName: normalized.factionName,
      dungeonId: normalized.dungeon.DungeonID,
      dungeonName: normalized.dungeon.DungeonName,
      attributes: normalized.attributes,
      activeBuffs: normalized.activeBuffs.map((buff) => ({
        buffId: buff.BuffID,
        buffName: buff.BuffName,
        value: normalized.buffValues[buff.BuffID]
      }))
    },
    bosses: bossResults,
    wechatSummary: firstBoss ? `${normalized.classInfo.ClassName}/${normalized.factionName}/${normalized.dungeon.DungeonName}/${firstBoss.bossName}\uFF0C\u5404\u6280\u80FD\u5E73\u5747\u4F24\u5BB3\u5982\u4E0B\uFF1A
${summaryLines.join("\n")}` : `${normalized.classInfo.ClassName}/${normalized.factionName}/${normalized.dungeon.DungeonName} \u6CA1\u6709\u5339\u914D\u5230 boss\u3002`
  };
};

// agent_tool/src/mcp_server.ts
var here = dirname2(fileURLToPath2(import.meta.url));
var KNOWN_DATA_DIR = "D:/\u5DE5\u4F5C/ww/personal_work/new_zx_calc_noactcode_agent/web_app/public/game_data";
var DATA_DIR = process.env.ZX_DATA_DIR || resolve2(here, "..", "..", "web_app", "public", "game_data");
var RESOLVED_DATA_DIR = existsSync(DATA_DIR) ? DATA_DIR : KNOWN_DATA_DIR;
var PROFILES_DIR = resolve2(here, "..", "profiles");
var PROFILES_FILE = resolve2(PROFILES_DIR, "player_profiles.json");
var token = (s) => s.trim().toLowerCase().replace(/[\s_（）()！!·.\-]/g, "");
var TOOLS = [
  {
    name: "zx_calc",
    description: '\u8BA1\u7B97\u67D0\u804C\u4E1A\u5BF9\u67D0\u526F\u672C boss \u7684\u5404\u6280\u80FD\u4F24\u5BB3\uFF0C\u4E00\u6B21\u8C03\u7528\u5373\u8FD4\u56DE\u5168\u90E8\u7ED3\u679C\u3002\u5165\u53C2\uFF1A{ className:"\u9010\u971C", factionName:"\u9B54", attributes:{...}, target:{ dungeon:"\u5929\u5E1D\u5B9D\u5E93", bossIndex:1 } }\u3002attributes \u7528\u4E2D\u6587\u952E\uFF1A\u653B\u51FB/\u6C14\u8840/\u771F\u6C14/\u9632\u5FA1/\u7206\u4F24/\u66B4\u51FB\u7387/\u5BF9\u602A\u589E\u4F24\u3002\u53EF\u9009 buffs:{ useDefaults:true }\u3002\u8C03\u7528\u524D\u82E5\u7528\u6237\u7ED9\u4E86\u622A\u56FE\uFF0C\u5148\u590D\u8FF0\u5C5E\u6027\u5F85\u786E\u8BA4\u3002\u5931\u8D25\u65F6\u8FD4\u56DE\u5177\u4F53\u9519\u8BEF\u539F\u56E0\uFF1B\u4E0D\u8981\u4E3A\u4E86\u4E00\u6B21\u8BA1\u7B97\u53CD\u590D\u68C0\u7D22\u5DE5\u5177\uFF0C\u76F4\u63A5\u8C03\u7528\u5373\u53EF\u3002',
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        className: { type: "string", description: "\u804C\u4E1A\u540D\uFF0C\u5982 \u9010\u971C/\u5F52\u4E91/\u6D85\u7FBD/\u9752\u4E91/\u9B3C\u738B/\u9752\u7F57" },
        classId: { type: "string" },
        factionName: { type: "string", description: "\u9635\u8425\uFF1A\u4ED9/\u4F5B/\u9B54" },
        faction: { type: "string" },
        attributes: { type: "object", description: "\u89D2\u8272\u5C5E\u6027\uFF0C\u4E2D\u6587\u952E\uFF1A\u653B\u51FB/\u6C14\u8840/\u771F\u6C14/\u9632\u5FA1/\u7206\u4F24/\u66B4\u51FB\u7387/\u5BF9\u602A\u589E\u4F24/1%\u653B\u51FB\u7B49" },
        buffs: { type: "object", description: "\u6218\u6597\u589E\u76CA\uFF1AuseDefaults(\u9ED8\u8BA4true)\u3001overrides(\u6309\u540D\u8986\u76D6\u503C)\u3001focus/greenPoint/monsterDamageTaken/witchCurse \u7B80\u5199" },
        target: { type: "object", description: "\u76EE\u6807\uFF1Adungeon(\u526F\u672C\u540D\u6216T21)\u3001bossId/bossName/bossIndex" },
        attributeCaps: { type: "object", description: "\u53EF\u9009\u5C5E\u6027\u4E0A\u9650\u8986\u76D6" }
      }
    }
  },
  {
    name: "zx_calc_profile",
    description: '\u7528\u5DF2\u4FDD\u5B58\u7684\u89D2\u8272\u6863\u6848\u4E00\u952E\u7B97\u4F24\u5BB3\uFF08\u6700\u7B80\u5355\u7684\u8BA1\u7B97\u5165\u53E3\uFF09\u3002\u5165\u53C2\u4EC5 { profileName:"\u6D25\u5A01", dungeon:"\u5929\u5E1D\u5B9D\u5E93", bossIndex:1 }\uFF0C\u5C5E\u6027\u4ECE\u6863\u6848\u81EA\u52A8\u8BFB\u53D6\u3002\u82E5\u4E0D\u786E\u5B9A\u6863\u6848\u540D\uFF0C\u5148\u8C03 zx_record {action:"list"}\u3002dungeon/bossIndex \u4E0D\u4F20\u5219\u7528\u6863\u6848\u91CC\u7684\u9ED8\u8BA4\u503C\u3002',
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        profileName: { type: "string", description: "\u6863\u6848\u540D\uFF0C\u5982 \u6D25\u5A01" },
        dungeon: { type: "string", description: "\u53EF\u9009\uFF1A\u526F\u672C\u540D\u6216 T21 \u7B49\uFF0C\u8986\u76D6\u6863\u6848\u9ED8\u8BA4" },
        bossIndex: { type: "number", description: "\u53EF\u9009\uFF1A\u7B2C\u51E0\u4E2A boss\uFF081 \u8D77\uFF09" },
        bossName: { type: "string", description: "\u53EF\u9009\uFF1Aboss \u540D" }
      }
    }
  },
  {
    name: "zx_lookup_boss",
    description: "\u67E5\u8BE2\u526F\u672C\u4E0E\u5176 boss \u4FE1\u606F\uFF08\u602A\u7269\u51CF\u4F24\u3001\u7B49\u7EA7\u7B49\uFF09\u3002\u8F93\u5165 { dungeonId|dungeonName|dungeon, bossId|bossName? }\u3002\u4E0D\u4F20 boss \u5219\u8FD4\u56DE\u8BE5\u526F\u672C\u5168\u90E8 boss \u6458\u8981\u3002",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        dungeonId: { type: "string" },
        dungeonName: { type: "string" },
        dungeon: { type: "string" },
        bossId: { type: "string" },
        bossName: { type: "string" }
      }
    }
  },
  {
    name: "zx_lookup_class",
    description: "\u67E5\u8BE2\u804C\u4E1A\u4FE1\u606F\uFF1A\u9635\u8425\u3001\u5C5E\u6027\u4E0A\u9650\u3001\u6280\u80FD\u5217\u8868\u3002\u8F93\u5165 { classId|className, faction? }\u3002",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        classId: { type: "string" },
        className: { type: "string" },
        faction: { type: "string", description: "\u53EF\u9009\uFF1A\u4ED9/\u4F5B/\u9B54\uFF0C\u9650\u5B9A\u6280\u80FD\u8868" }
      }
    }
  },
  {
    name: "zx_list_dungeons",
    description: "\u679A\u4E3E\u5168\u90E8\u526F\u672C\uFF08DungeonID / \u540D\u79F0\uFF09\uFF0C\u5E2E agent \u5B9A\u4F4D\u526F\u672C\u540D\u79F0\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "zx_list_classes",
    description: "\u679A\u4E3E\u5168\u90E8\u804C\u4E1A\uFF08ClassID / \u540D\u79F0 / \u5B9A\u4F4D\u7C7B\u578B\uFF09\uFF0C\u5E2E agent \u5B9A\u4F4D\u804C\u4E1A\u540D\u79F0\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "zx_record",
    description: '\u5F55\u5165/\u8BFB\u53D6\u547D\u540D\u89D2\u8272\u6863\u6848\uFF08\u4FDD\u5B58\u540E\u53EF\u88AB zx_calc \u590D\u7528\uFF0C\u65E0\u9700\u6BCF\u6B21\u8D34\u5C5E\u6027\uFF09\u3002\u8F93\u5165 { action: "save"|"get"|"list"|"delete", name, profile? }\u3002save \u65F6 profile \u81F3\u5C11\u542B className + attributes\uFF1B\u53EF\u542B factionName/buffs/target \u4F5C\u4E3A\u9ED8\u8BA4\u3002\u6863\u6848\u5B58\u4E8E agent_tool/profiles/player_profiles.json\u3002',
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        action: { type: "string", description: "save | get | list | delete" },
        name: { type: "string", description: "\u6863\u6848\u540D\uFF0C\u5982 \u6D25\u5A01" },
        profile: { type: "object", description: "save \u65F6\u7684\u89D2\u8272\u6570\u636E\uFF08AgentCalcInput \u5B50\u96C6\uFF09" }
      }
    }
  },
  {
    name: "zx_edit_data",
    description: "\u7F16\u8F91\u6E38\u620F\u6570\u636E JSON\uFF08\u4F5C\u8005\u5411\u7EF4\u62A4\uFF09\u3002\u8F93\u5165 { dataType, key, subKey?, patch }\u3002dataType \u2208 classes|skills|dungeons|dungeons_monsters|combat_buffs\u3002key \u5B9A\u4F4D\u6761\u76EE\uFF08ClassID/ClassName/DungeonID/SkillID/MonsterID/BuffID\uFF09\uFF0CsubKey \u7528\u4E8E skills/dungeons_monsters \u7684\u4E8C\u7EA7\u5B9A\u4F4D\uFF08\u5148 key \u627E\u526F\u672C/\u804C\u4E1A\uFF0C\u518D subKey \u627E\u6280\u80FD/boss\uFF09\u3002patch \u4E3A\u6D45\u5408\u5E76\u5230\u8BE5\u6761\u76EE\u7684\u5B57\u6BB5\u5BF9\u8C61\u3002\u5199\u5165\u524D\u81EA\u52A8\u65F6\u95F4\u6233\u5907\u4EFD\u539F\u6587\u4EF6\u3002",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        dataType: { type: "string", description: "classes | skills | dungeons | dungeons_monsters | combat_buffs" },
        key: { type: "string", description: "\u4E00\u7EA7\u5B9A\u4F4D\u952E\uFF08ID \u6216\u540D\u79F0\uFF09" },
        subKey: { type: "string", description: "\u53EF\u9009\u4E8C\u7EA7\u5B9A\u4F4D\u952E\uFF08skills/dungeons_monsters \u7528\uFF09" },
        patch: { type: "object", description: "\u8981\u5408\u5E76\u8FDB\u76EE\u6807\u6761\u76EE\u7684\u5B57\u6BB5" }
      }
    }
  }
];
var readJson2 = (p) => JSON.parse(readFileSync(p, "utf8"));
async function handleTool(name, args) {
  try {
    switch (name) {
      case "zx_calc": {
        const result = await calculateFromInput(args, RESOLVED_DATA_DIR);
        return { text: JSON.stringify(result, null, 2), isError: !result.ok };
      }
      case "zx_calc_profile": {
        const profileName = args.profileName;
        if (!profileName) return { text: JSON.stringify({ ok: false, error: "\u9700\u8981 profileName" }), isError: true };
        const store = existsSync(PROFILES_FILE) ? readJson2(PROFILES_FILE) : {};
        const profile = store[profileName];
        if (!profile) {
          return {
            text: JSON.stringify({ ok: false, error: "\u6863\u6848\u4E0D\u5B58\u5728: " + profileName, available: Object.keys(store), hint: '\u5148\u7528 zx_record {action:"save"} \u4FDD\u5B58\u6863\u6848' }),
            isError: true
          };
        }
        const targetOverride = { ...profile.target || {} };
        if (args.dungeon) targetOverride.dungeon = args.dungeon;
        if (args.bossIndex != null) targetOverride.bossIndex = args.bossIndex;
        if (args.bossName) targetOverride.bossName = args.bossName;
        const input = { ...profile, target: targetOverride };
        const result = await calculateFromInput(input, RESOLVED_DATA_DIR);
        return { text: JSON.stringify(result, null, 2), isError: !result.ok };
      }
      case "zx_lookup_boss": {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        const raw = args.dungeonId || args.dungeonName || args.dungeon;
        const dungeon = data.dungeons.find(
          (d) => token(d.DungeonID) === token(raw ?? "") || token(d.DungeonName).includes(token(raw ?? "")) || token(raw ?? "").includes(token(d.DungeonName))
        );
        if (!dungeon) return { text: JSON.stringify({ ok: false, error: "\u672A\u77E5\u526F\u672C: " + raw }), isError: true };
        const monsters = data.monstersByDungeon[dungeon.DungeonID] || [];
        const bossRaw = args.bossId || args.bossName;
        const list = bossRaw ? monsters.filter((m) => token(m.MonsterID) === token(bossRaw) || token(m.MonsterName).includes(token(bossRaw))) : monsters;
        const summary = list.map((m) => ({
          monsterId: m.MonsterID,
          monsterName: m.MonsterName,
          dungeonLevel: m.DungeonLevel,
          monsterAttributeModifiers: m.MonsterAttributeModifiers
        }));
        return { text: JSON.stringify({ ok: true, dungeonId: dungeon.DungeonID, dungeonName: dungeon.DungeonName, bossCount: monsters.length, bosses: summary }, null, 2), isError: false };
      }
      case "zx_lookup_class": {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        const raw = args.classId || args.className;
        const cls = data.classes.find(
          (c) => token(c.ClassID) === token(raw ?? "") || token(c.ClassName) === token(raw ?? "") || token(c.ClassName).includes(token(raw ?? ""))
        );
        if (!cls) return { text: JSON.stringify({ ok: false, error: "\u672A\u77E5\u804C\u4E1A: " + raw }), isError: true };
        const skills = (data.skills[cls.ClassID] || []).map((s) => ({ skillId: s.SkillID, skillName: s.SkillName, actionType: s.ActionType }));
        return {
          text: JSON.stringify(
            { ok: true, classId: cls.ClassID, className: cls.ClassName, roleType: cls.RoleType, capHealth: cls.CapHealth, capMana: cls.CapMana, skillCount: skills.length, skills },
            null,
            2
          ),
          isError: false
        };
      }
      case "zx_list_dungeons": {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        return { text: JSON.stringify({ ok: true, dungeons: data.dungeons.map((d) => ({ dungeonId: d.DungeonID, dungeonName: d.DungeonName })) }, null, 2), isError: false };
      }
      case "zx_list_classes": {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        return { text: JSON.stringify({ ok: true, classes: data.classes.map((c) => ({ classId: c.ClassID, className: c.ClassName, roleType: c.RoleType })) }, null, 2), isError: false };
      }
      case "zx_record": {
        const action = args.action;
        const name2 = args.name;
        let store = {};
        if (existsSync(PROFILES_FILE)) store = readJson2(PROFILES_FILE);
        if (action === "list") return { text: JSON.stringify({ ok: true, names: Object.keys(store) }, null, 2), isError: false };
        if (!name2) return { text: JSON.stringify({ ok: false, error: "zx_record \u9700\u8981 name" }), isError: true };
        if (action === "get") {
          if (!(name2 in store)) return { text: JSON.stringify({ ok: false, error: "\u6863\u6848\u4E0D\u5B58\u5728: " + name2 }), isError: true };
          return { text: JSON.stringify({ ok: true, name: name2, profile: store[name2] }, null, 2), isError: false };
        }
        if (action === "delete") {
          delete store[name2];
          if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
          writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), "utf8");
          return { text: JSON.stringify({ ok: true, deleted: name2, remaining: Object.keys(store) }, null, 2), isError: false };
        }
        if (action === "save") {
          const profile = args.profile;
          if (!profile || !profile.className || !profile.attributes) {
            return { text: JSON.stringify({ ok: false, error: "save \u9700\u8981 profile{ className, attributes }" }), isError: true };
          }
          store[name2] = profile;
          if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
          writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), "utf8");
          return { text: JSON.stringify({ ok: true, saved: name2, profile }), isError: false };
        }
        return { text: JSON.stringify({ ok: false, error: "\u672A\u77E5 action: " + action }), isError: true };
      }
      case "zx_edit_data": {
        const dataType = args.dataType;
        const key = args.key;
        const subKey = args.subKey;
        const patch = args.patch;
        const fileMap = {
          classes: "classes.json",
          skills: "skills.json",
          dungeons: "dungeons.json",
          dungeons_monsters: "dungeons_monsters.json",
          combat_buffs: "combat_buffs.json"
        };
        const fname = fileMap[dataType];
        if (!fname) return { text: JSON.stringify({ ok: false, error: "\u672A\u77E5 dataType: " + dataType }), isError: true };
        if (!key) return { text: JSON.stringify({ ok: false, error: "zx_edit_data \u9700\u8981 key" }), isError: true };
        if (!patch || typeof patch !== "object") return { text: JSON.stringify({ ok: false, error: "zx_edit_data \u9700\u8981 patch \u5BF9\u8C61" }), isError: true };
        const filePath = resolve2(RESOLVED_DATA_DIR, fname);
        const raw = readJson2(filePath);
        let entry;
        if (Array.isArray(raw)) {
          entry = raw.find((e) => token(e.ID ?? e.ClassID ?? e.DungeonID ?? e.BuffID ?? e.MonsterID ?? "") === token(key) || token(e.Name ?? e.ClassName ?? e.DungeonName ?? e.BuffName ?? e.MonsterName ?? "").includes(token(key)));
        } else {
          const parent = raw[key] ?? raw[Object.keys(raw).find((k) => token(k) === token(key)) || ""];
          if (parent == null) return { text: JSON.stringify({ ok: false, error: "\u672A\u627E\u5230 key: " + key + " \u4E8E " + fname }), isError: true };
          if (subKey && Array.isArray(parent)) {
            entry = parent.find((e) => token(e.ID ?? e.SkillID ?? e.MonsterID ?? "") === token(subKey) || token(e.Name ?? e.SkillName ?? e.MonsterName ?? "").includes(token(subKey)));
          } else {
            entry = parent;
          }
        }
        if (!entry) return { text: JSON.stringify({ ok: false, error: "\u672A\u627E\u5230\u5339\u914D\u6761\u76EE key=" + key + (subKey ? " subKey=" + subKey : "") }), isError: true };
        Object.assign(entry, patch);
        const backup = resolve2(RESOLVED_DATA_DIR, fname + ".bak." + Date.now());
        copyFileSync(filePath, backup);
        writeFileSync(filePath, JSON.stringify(raw, null, 2), "utf8");
        return { text: JSON.stringify({ ok: true, file: fname, backup: basename(backup), changed: entry }, null, 2), isError: false };
      }
      default:
        return { text: JSON.stringify({ ok: false, error: "\u672A\u77E5\u5DE5\u5177: " + name }), isError: true };
    }
  } catch (err) {
    return { text: JSON.stringify({ ok: false, error: "RUNTIME_ERROR", message: err instanceof Error ? err.message : String(err) }), isError: true };
  }
}
var send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
var buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) void dispatch(line);
  }
});
process.stdin.on("end", () => process.exit(0));
async function dispatch(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method } = msg;
  if (!method) return;
  if (method === "notifications/initialized" || method.startsWith("notifications/")) return;
  if (method === "initialize") {
    const clientVersion = msg.params && msg.params.protocolVersion;
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: clientVersion || "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "zx-damage-mcp", version: "1.0.0" }
      }
    });
    return;
  }
  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }
  if (method === "tools/call") {
    const { name, arguments: args } = msg.params || {};
    const { text, isError } = await handleTool(name, args || {});
    send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError } });
    return;
  }
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } });
}
