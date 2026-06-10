import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { validateMonstersData, validateSkillsData } from './validator.js';
import { Actor } from './actor.js';
import type { AllSkills, AppliedEffectConfig, BuffEffects, Monster, PlayerSkillOverride, Skill } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("=== 启动 阶段B 自动测试走查 ===");
  
  // 1. 读取技能配置文件（使用文件绝对路径，保证不论在哪个工作目录下运行均能正确解析）
  const skillsPath = resolve(__dirname, "../../../web_app/public/game_data/skills.json");
  const text = await readFile(skillsPath, 'utf8');
  const allSkills = JSON.parse(text) as AllSkills;
  const monstersPath = resolve(__dirname, "../../../web_app/public/game_data/dungeons_monsters.json");
  const monstersText = await readFile(monstersPath, 'utf8');
  const monstersByDungeon = JSON.parse(monstersText) as Record<string, Monster[]>;
  
  // 2. 运行数据校验器
  console.log("\n[测试 B-4] 运行 Skills Schema 数据验证工具...");
  const issues = validateSkillsData(allSkills);
  console.log(`[验证结论] 共发现 ${issues.length} 个潜在配置问题 (如有)：`);
  issues.forEach(issue => {
    console.log(`- [${issue.severity}] 字段: ${issue.field} -> ${issue.message}`);
  });
  const errorIssues = issues.filter(issue => issue.severity === 'ERROR');
  assert.equal(
    errorIssues.length,
    0,
    `Skills Schema 存在 ${errorIssues.length} 个 ERROR 级配置问题，请先修复数据结构。`
  );

  console.log("\n[测试 B-4c] 运行 Boss Schema 数据验证工具...");
  const monsterIssues = validateMonstersData(monstersByDungeon);
  console.log(`[验证结论] 共发现 ${monsterIssues.length} 个 Boss 配置问题 (如有)：`);
  monsterIssues.forEach(issue => {
    console.log(`- [${issue.severity}] 字段: ${issue.field} -> ${issue.message}`);
  });
  const monsterErrorIssues = monsterIssues.filter(issue => issue.severity === 'ERROR');
  assert.equal(
    monsterErrorIssues.length,
    0,
    `Boss Schema 存在 ${monsterErrorIssues.length} 个 ERROR 级配置问题，请先修复数据结构。`
  );

  for (const dungeonId of ['ZHENHAI_DUANLANG_T19', 'ZHENHAI_DUANLANG_T20', 'ZHENHAI_DUANLANG_T21']) {
    const monsters = monstersByDungeon[dungeonId] ?? [];
    assert.equal(monsters.length, 6, `${dungeonId} 应包含 6 个 Boss。`);
    assert.equal(
      monsters.filter(monster => monster.MonsterAttributeModifiers.MonsterCriticalHitRateReduction !== undefined).length,
      6,
      `${dungeonId} 的 6 个 Boss 均应配置 MonsterCriticalHitRateReduction。`
    );
  }

  const invalidMonsterIssues = validateMonstersData({
    BAD_DUNGEON: [
      {
        MonsterID: 'BAD_BOSS',
        MonsterName: '错误 Boss',
        DungeonLevel: 1,
        MonsterAttributeModifiers: {
          MonsterCriticalDamagePercentReduction: -1,
          MonsterHealth: 0,
          DamageCompressionPercent: 101,
          MonsterCriticalHitRateReduction: 'bad' as unknown as number
        }
      }
    ]
  });
  assert.ok(
    invalidMonsterIssues.some(issue => issue.field.includes('MonsterCriticalDamagePercentReduction') && issue.severity === 'ERROR'),
    'validator 未拦截非法 Boss 爆伤减免。'
  );
  assert.ok(
    invalidMonsterIssues.some(issue => issue.field.includes('MonsterHealth') && issue.severity === 'ERROR'),
    'validator 未拦截非法 Boss 血量。'
  );
  assert.ok(
    invalidMonsterIssues.some(issue => issue.field.includes('DamageCompressionPercent') && issue.severity === 'ERROR'),
    'validator 未拦截非法 Boss 伤害压缩。'
  );
  assert.ok(
    invalidMonsterIssues.some(issue => issue.field.includes('MonsterCriticalHitRateReduction') && issue.severity === 'ERROR'),
    'validator 未拦截非法 Boss 减暴击。'
  );
  console.log("- Boss Schema、T19-T21 减暴击数量与反例校验均通过 [SUCCESS]");
  
  // 3. 测试 Actor 属性运行时动态覆写
  console.log("\n[测试 B-2] 运行 Player Profile 运行时覆盖混入检测...");
  
  // 提取逐霜职业仙阵营基础技能
  const baseSkills = allSkills.ZHU_SHUANG?.XIAN || [];
  assert.ok(baseSkills.length > 0, "未读取到 ZHU_SHUANG.XIAN 基础技能，无法校验运行时覆盖。");
  
  // 构造玩家特定的定制CD与施法时间（例如点天书或穿戴减CD护符）
  const customizations: Record<string, PlayerSkillOverride> = {
    "ZS_XIAN_SKILL_CLXX": {
      "Cooldown": 14,
      "CastTime": 2.2,
      "SkillBonusAttributes": {
        "SkillCriticalDamagePercentBonus": 120 // 爆伤加成提升从 100 覆盖为 120
      }
    }
  };
  
  // 实例化 Actor 并注入覆盖表
  const actor = new Actor("dps-player-1", "ZHU_SHUANG", baseSkills, customizations);
  
  const clxx = actor.Skills["ZS_XIAN_SKILL_CLXX"];
  if (!clxx) {
    throw new Error("未能在 Actor 中检索到 '苍龙啸·玄' 技能运行时实例，测试失败！");
  }

  const baseClxx = baseSkills.find(skill => skill.SkillID === "ZS_XIAN_SKILL_CLXX");
  assert.ok(baseClxx, "基础技能库中缺少 'ZS_XIAN_SKILL_CLXX'，无法校验覆盖不污染全局数据。");
  
  console.log(`- 校验技能名称: ${clxx.SkillName}`);
  assert.equal(clxx.Cooldown, 14, "Cooldown 覆写失败。");
  assert.equal(clxx.CastTime, 2.2, "CastTime 覆写失败。");
  assert.equal(clxx.SkillBonusAttributes.SkillCriticalDamagePercentBonus, 120, "SkillBonusAttributes 覆写失败。");
  assert.equal(baseClxx.Cooldown, 18, "运行时覆盖污染了全局 skills.json 的 Cooldown。");
  assert.equal(baseClxx.CastTime, 3, "运行时覆盖污染了全局 skills.json 的 CastTime。");
  assert.equal(
    baseClxx.SkillBonusAttributes.SkillCriticalDamagePercentBonus,
    100,
    "运行时覆盖污染了全局 skills.json 的 SkillBonusAttributes。"
  );
  console.log(`- Cooldown CD 覆写: 预期 14s -> 实际 ${clxx.Cooldown}s [SUCCESS]`);
  console.log(`- CastTime 施法覆写: 预期 2.2s -> 实际 ${clxx.CastTime}s [SUCCESS]`);
  console.log(`- 爆伤百分比加成覆写: 预期 120 -> 实际 ${clxx.SkillBonusAttributes.SkillCriticalDamagePercentBonus} [SUCCESS]`);
  console.log("- 全局白板技能未被运行时覆盖污染 [SUCCESS]");

  console.log("\n[测试 B-2b] 运行 AppliedEffect 按 EffectId 覆盖检测...");
  const supportSkill: Skill = {
    SkillID: "TEST_SUPPORT_BUFF",
    SkillName: "测试辅助增益",
    RequiredClass: "TEST_SUPPORT",
    Faction: "COMMON",
    SkillImportanceWeight: 0,
    SkillFrequency: 0,
    Cooldown: 30,
    CastTime: 1,
    IsAOE: false,
    ActionType: "BUFF",
    SkillBonusAttributes: {
      SkillDamageBonus: 1
    },
    AppliesEffects: [
      {
        EffectId: "TEST_ATTACK_BUFF",
        EffectName: "测试攻击增益",
        Target: "TEAM",
        Duration: 10,
        RefreshOnReapply: true,
        BuffEffects: {
          BuffAttackPercentEffect: 10
        }
      }
    ]
  };
  const supportActor = new Actor("support-1", "TEST_SUPPORT", [supportSkill], {
    TEST_SUPPORT_BUFF: {
      AppliesEffects: {
        TEST_ATTACK_BUFF: {
          Duration: 15,
          BuffEffects: {
            BuffAttackPercentEffect: 25
          }
        }
      }
    }
  });
  const runtimeEffect = supportActor.Skills.TEST_SUPPORT_BUFF.AppliesEffects?.[0];
  assert.ok(runtimeEffect, "运行时辅助技能缺少 AppliedEffect。");
  assert.equal(runtimeEffect.Duration, 15, "AppliedEffect.Duration 覆写失败。");
  assert.equal(runtimeEffect.BuffEffects.BuffAttackPercentEffect, 25, "AppliedEffect.BuffEffects 覆写失败。");
  assert.equal(supportSkill.AppliesEffects?.[0]?.Duration, 10, "AppliedEffect 覆写污染了原始白板技能。");
  assert.equal(
    supportSkill.AppliesEffects?.[0]?.BuffEffects.BuffAttackPercentEffect,
    10,
    "AppliedEffect.BuffEffects 覆写污染了原始白板技能。"
  );
  console.log("- AppliedEffect Duration 与 BuffEffects 覆写成功，且未污染白板技能 [SUCCESS]");
  
  console.log("\n[测试 B-2c] 运行 4代技能品质 (FourthGenQuality) 自动预设融合检测...");
  const tianyinSkills = allSkills.TIAN_YIN?.FO || [];
  assert.ok(tianyinSkills.length > 0, "未读取到 TIAN_YIN.FO 技能，无法进行四代预设融合测试。");
  
  // 实例化具有 "XI_RI" 曦日品质摩柯心经的天音 Actor
  const tyActor = new Actor("tianyin-player-1", "TIAN_YIN", tianyinSkills, {
    "TY_FO_SKILL_MKXJ": {
      "FourthGenQuality": "XI_RI"
    }
  });
  
  const mkxj = tyActor.Skills["TY_FO_SKILL_MKXJ"];
  assert.ok(mkxj, "天音 Actor 中缺少 'TY_FO_SKILL_MKXJ' 技能实例");
  assert.equal(mkxj.Cooldown, 90, "曦日品质 CD 自动缩短失败（应当为 90s）");
  const mkxjEffect = mkxj.AppliesEffects?.[0];
  assert.ok(mkxjEffect, "摩柯心经缺少 AppliedEffect。");
  assert.equal(mkxjEffect.DynamicScalingMultiplier, 8.0, "曦日品质气血加成倍数自动应用失败（应当为 8.0）");
  console.log(`- 校验技能名称: ${mkxj.SkillName}`);
  console.log(`- Cooldown CD 自动应用曦日预设: 预期 90s -> 实际 ${mkxj.Cooldown}s [SUCCESS]`);
  console.log(`- 气血加成系数自动应用曦日预设: 预期 8.0 -> 实际 ${mkxjEffect.DynamicScalingMultiplier} [SUCCESS]`);
  console.log("- 4代技能品质 (FourthGenQuality) 自动预设融合成功 [SUCCESS]");

  console.log("\n[测试 B-4b] 运行 4代/动态字段 Schema 反例校验...");
  const invalidDynamicEffect: AppliedEffectConfig = {
    EffectId: "BAD_DYNAMIC_EFFECT",
    EffectName: "错误动态字段",
    Target: "TEAM",
    Duration: 10,
    BuffEffects: {
      BuffAttackFixedEffect: 1
    },
    DynamicScalingAttribute: "NotACharacterAttribute",
    DynamicScalingMultiplier: "bad" as unknown as number,
    DynamicTargetField: "NotABuffEffectField" as unknown as keyof BuffEffects
  };
  const invalidDynamicData: AllSkills = {
    TEST_DYNAMIC: {
      COMMON: [
        {
          SkillID: "BAD_DYNAMIC_SKILL",
          SkillName: "错误动态技能",
          RequiredClass: "TEST_DYNAMIC",
          Faction: "COMMON",
          SkillImportanceWeight: 0,
          SkillFrequency: 0,
          Cooldown: 1,
          CastTime: 0,
          IsAOE: false,
          ActionType: "BUFF",
          SkillBonusAttributes: {},
          AppliesEffects: [invalidDynamicEffect],
          FourthGenPresets: {
            XI_RI: {
              AppliesEffects: {
                MISSING_EFFECT_ID: {
                  DynamicScalingAttribute: "CharacterMaxAttack",
                  DynamicScalingMultiplier: 8,
                  DynamicTargetField: "BuffHealthFixedEffect"
                }
              }
            }
          }
        }
      ]
    }
  };
  const invalidDynamicIssues = validateSkillsData(invalidDynamicData);
  assert.ok(
    invalidDynamicIssues.some(issue => issue.field.includes("DynamicScalingAttribute") && issue.severity === "ERROR"),
    "validator 未拦截非法 DynamicScalingAttribute。"
  );
  assert.ok(
    invalidDynamicIssues.some(issue => issue.field.includes("DynamicScalingMultiplier") && issue.severity === "ERROR"),
    "validator 未拦截非法 DynamicScalingMultiplier。"
  );
  assert.ok(
    invalidDynamicIssues.some(issue => issue.field.includes("DynamicTargetField") && issue.severity === "ERROR"),
    "validator 未拦截非法 DynamicTargetField。"
  );
  assert.ok(
    invalidDynamicIssues.some(issue => issue.message.includes("MISSING_EFFECT_ID") && issue.severity === "ERROR"),
    "validator 未拦截四代预设引用不存在的基础 EffectId。"
  );
  console.log("- 4代预设引用与 DynamicScaling 三元组反例均被 validator 拦截 [SUCCESS]");
  
  console.log("\n=== 阶段B 所有测试项目均顺利通过验证！ ===");
}

main().catch(err => {
  console.error("测试运行失败，错误详情:", err);
  process.exit(1);
});
