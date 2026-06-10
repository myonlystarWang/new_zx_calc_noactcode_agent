# 天华职业核心技能数据录入与结算逻辑设计方案

本方案旨在录入天华（TIAN_HUA）的 7 个核心 Buff/Debuff 技能，并实现其特有的动态缩放与互斥判定规则。

## Proposed Changes

### 1. 静态技能数据录入

#### [MODIFY] [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json)
- 在 `TIAN_HUA.FO` 列表下录入以下 7 个技能：
  1. `TH_FO_SKILL_MQYY` (鸣泉雅韵):
     - ActionType: `"BUFF"`, Cooldown: `12`, CastTime: `1.0`, Target: `"TEAM"`, Duration: `1800` (30分钟).
     - 挂载 `TH_BUFF_MQYY` 效果，初始 `BuffAttackPercentEffect: 0` (由动态逻辑计算)。
  2. `TH_FO_SKILL_JSKW` (金蛇狂舞):
     - ActionType: `"BUFF"`, Cooldown: `0`, CastTime: `1.0`, Target: `"TEAM"`, Duration: `3600`.
     - 挂载 `TH_BUFF_JSKW` 效果：`BuffAttackPercentEffect: 40`, `BuffCriticalDamagePercentEffect: 60`, `BuffCriticalHitRatePercentPercentEffect: 25` (23基础+2法宝), `BuffFocusPercentEffect: 20` (18基础+2法宝)。
  3. `TH_FO_SKILL_QSYY` (秋声雅韵):
     - ActionType: `"BUFF"`, Cooldown: `80`, CastTime: `1.0`, Target: `"ALLY"`, Duration: `26`.
     - 挂载 `TH_BUFF_QSYY` 效果，初始 `BuffFocusPercentEffect: 0`, `BuffDefenseFixedEffect: 0`, `BuffCriticalDamagePercentEffect: 0`。
     - 支持 `FourthGenPresets` 预设品质（玄烛·听霜雅韵）：
       - `YING_JU`: Duration: `29` (25+3+1), Cooldown: `60` (80-20)
       - `HAO_YUE`: Duration: `32` (25+6+1), Cooldown: `45` (80-35)
       - `XI_RI`: Duration: `35` (25+9+1), Cooldown: `30` (80-50)
  4. `TH_FO_SKILL_YSYY2` (云水雅韵II):
     - ActionType: `"BUFF"`, Cooldown: `60`, CastTime: `1.0`, Target: `"ALLY"`, Duration: `30`.
     - 挂载三个独立效果：
       - `TH_BUFF_YSYY2_HEALTH`: `ExclusiveGroup: "HP_OVERRIDE_GROUP"`, `BuffHealthFixedEffect: 0` (冲突互斥项)。
       - `TH_BUFF_YSYY2_MANA`: `BuffManaFixedEffect: 0`。
       - `TH_BUFF_YSYY2_ATTACK`: `BuffAttackFixedEffect: 0`。
  5. `TH_FO_SKILL_JLS` (净莲生):
     - ActionType: `"BUFF"`, Cooldown: `240`, CastTime: `1.0`, Target: `"ALLY"`, Duration: `30`.
     - 基础 AppliesEffects 挂载 `TH_BUFF_YSYY2_HEALTH`、`TH_BUFF_YSYY2_MANA`、`TH_BUFF_YSYY2_ATTACK`、`TH_BUFF_QSYY`。
     - 该技能非四代技能，不使用 `FourthGenPresets`。由玩家 Profile 中的 `SkillLevel` (0-3) 控制生效效果：
       - 等级 0: 无效果。
       - 等级 1: 仅应用云水雅韵II相关的三个效果，持续时间为 30 秒。
       - 等级 2: 仅应用秋声雅韵效果，持续时间为 26 秒。
       - 等级 3: 同时应用云水雅韵II及秋声雅韵效果，持续时间分别为 30 秒与 26 秒。
  6. `TH_FO_SKILL_FQH` (凤求凰):
     - ActionType: `"BUFF"`, Cooldown: `120`, CastTime: `1.0`, Target: `"ALLY"`, Duration: `30`.
     - 挂载 `TH_BUFF_FQH` 效果，初始 `BuffCriticalDamagePercentEffect: 0`。
     - 该技能非四代技能，不使用 `FourthGenPresets`。由玩家 Profile 中的 `Variant` (HUA, HAO, LIE, OTHER) 来控制效果：
       - `HUA` (凤求凰·华): 持续时间覆盖为 `40` (30+10)，基础爆伤为 `100`。
       - `HAO` (凤求凰·昊): 持续时间覆盖为 `20` (30-10)，基础爆伤为 `150`。
       - `LIE` (凤求凰·烈): 持续时间保持 `30`，基础爆伤为 `130`。
       - `OTHER` (凤求凰·其他): 持续时间保持 `30`，基础爆伤为 `100`。
       - 最终暴击伤害增加值为：`基础爆伤 + Math.floor(天华当前真气 / 30000)`。
  7. `TH_FO_SKILL_YGSD_CHAN` (阳关三叠·禅):
     - ActionType: `"DEBUFF"`, Cooldown: `6`, CastTime: `1.0`, Target: `"ENEMY"`, Duration: `20`.
     - 挂载 `TH_DEBUFF_YGSD_CHAN` 效果：`DynamicScalingAttribute: "CharacterMaxAttack"`, `DynamicScalingMultiplier: -1.0`, `DynamicTargetField: "BuffDefenseFixedEffect"` (天华最大攻击的100%降低Boss防御)。

### 2. 气血增益互斥规则实现

为了满足云水雅韵II与摩柯心经气血效果不叠加、且“数值与持续时间双高才覆盖”的独有判定逻辑：

#### [MODIFY] [effects.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/effects.ts)
- 在 `shouldReplace` 函数首部拦截并实现 `HP_OVERRIDE_GROUP` 互斥逻辑：
  ```typescript
  if (incoming.ExclusiveGroup === 'HP_OVERRIDE_GROUP' && existing.ExclusiveGroup === 'HP_OVERRIDE_GROUP') {
    const incomingHp = incoming.BuffEffects.BuffHealthFixedEffect ?? 0;
    const existingHp = existing.BuffEffects.BuffHealthFixedEffect ?? 0;
    const incomingDuration = (incoming.Duration ?? 0) * 1000;
    const existingDuration = existing.EndTimeMs - existing.AppliedAtMs;
    // 气血数值和持续时间均高过另一方才会覆盖生效
    return incomingHp > existingHp && incomingDuration > existingDuration;
  }
  ```

同时在天音的摩柯心经 HP 效果上标注此互斥组：
- [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json) 中，为 `TY_BUFF_MKXJ_HEALTH` 添加 `"ExclusiveGroup": "HP_OVERRIDE_GROUP"` 字段。

### 3. 动态缩放逻辑支持

#### [MODIFY] [combat_loop.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/combat_loop.ts)
- 修改 `resolveDynamicEffect` 的函数签名，支持传入可选的 `sourceSkillId` 以便查询施法技能的曦日/皓月/莹炬品质：
  ```typescript
  private resolveDynamicEffect(effect: AppliedEffectConfig, sourceActorId: string, sourceSkillId?: string): DynamicEffectResolution
  ```
- 在 `resolveDynamicEffect` 中新增针对天华专属 `EffectId` 的动态处理逻辑：
  - **鸣泉雅韵 (`TH_BUFF_MQYY`)**:
    - `BuffAttackPercentEffect = 20 + Math.floor(sourceMana / 50000)`。
  - **秋声雅韵 (`TH_BUFF_QSYY`)**:
    - `BuffFocusPercentEffect = 22 + Math.min(20, Math.floor(sourceMaxAttack / 5000))`。
    - `BuffDefenseFixedEffect = sourceMaxAttack * 1.5`。
    - `BuffCriticalDamagePercentEffect = Math.floor(sourceMana / 100000)`。
  - **云水雅韵II HP (`TH_BUFF_YSYY2_HEALTH`)**:
    - `BuffHealthFixedEffect = sourceMaxAttack * 2.5`。
  - **云水雅韵II MP (`TH_BUFF_YSYY2_MANA`)**:
    - `BuffManaFixedEffect = sourceMaxAttack * 5`。
  - **云水雅韵II 攻击 (`TH_BUFF_YSYY2_ATTACK`)**:
    - `BuffAttackFixedEffect = 10000 + 25 * sourceMana / 1000`。
  - **凤求凰 (`TH_BUFF_FQH`)**:
    - 读取施法技能的 `FourthGenQuality`：
      - 默认/`XI_RI` (华): 基础爆伤 `100`。
      - `HAO_YUE` (昊): 基础爆伤 `150`。
      - `YING_JU` (烈): 基础爆伤 `130`。
    - `BuffCriticalDamagePercentEffect = 基础爆伤 + Math.floor(sourceMana / 30000)`。

---

## Verification Plan

### Automated Tests
- 在 `test_c.ts` 中针对天华所有技能的属性缩放、曦日预设、互斥覆盖单元测试：
  - 验证云水雅韵II在 HP 较低/时间较短时不会覆盖已经生效的摩柯心经；在 HP 与时间双高时，成功覆盖摩柯心经。
  - 验证净莲生在不同技能等级下释放正确的技能效果。
  - 验证凤求凰在不同变体情况下提供对应的爆伤基准与持续时间。
- 执行 `npm run check:all` 确保构建通过。
