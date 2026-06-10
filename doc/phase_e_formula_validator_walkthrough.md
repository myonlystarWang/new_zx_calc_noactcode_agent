# Phase E 公式与 Boss 校验修复 Walkthrough

## 背景

审查 Phase E 进度时发现两个需要先修的链路问题：

- `CharacterOnePercentAttack/Defense/Health/Mana` 只在部分实时属性聚合路径中生效，静态公式与时间轴命中仍按基础属性百分比计算。
- T19/T20/T21 已录入 Boss 减暴击字段，但没有专门的 Boss 数据 validator。

## 实施

### 1. 共享属性聚合

- 新增 [attributes.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/attributes.ts)。
- 提供 `resolveEffectiveCharacterAttributes`、`resolveEffectiveCharacterAttributesFromEffects`、`resolveEffectiveCharacterAttributesFromBuffs`。
- 1% 属性折算规则：
  - 存在 `CharacterOnePercentAttack` 时，攻击百分比 Buff 按 `BuffAttackPercentEffect * CharacterOnePercentAttack` 折算。
  - 防御、气血、真气同理。
  - 未提供 1% 属性时，保持旧的 `基础属性 * 百分比 / 100` 行为。

### 2. 伤害公式接入

- [actor.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/actor.ts) 改用共享 helper。
- [calculator.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/calculator.ts) 的 `resolveHitDamage` 与 `calculateDamage` 改用共享 helper。
- 静态 `calculateDamage` 的 `minBaseDamage/maxBaseDamage` 也使用同一套有效属性，避免展示值和最终伤害来源不一致。

### 3. Boss 数据 validator

- [validator.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/validator.ts) 新增 `validateMonstersData`。
- 覆盖：
  - Boss 条目必须是对象。
  - 同一副本内 `MonsterID` 不重复。
  - `MonsterCriticalDamagePercentReduction` 必须是非负数。
  - `DamageCompressionPercent` 必须在 0 到 100。
  - `MonsterHealth` 如存在必须大于 0。
  - `MonsterCriticalHitRateReduction` 如存在必须是非负数。

### 4. 测试

- `test:b` 读取真实 `dungeons_monsters.json`，确认 Boss 数据无 ERROR。
- `test:b` 校验 T19/T20/T21 各 6 个 Boss 均存在 `MonsterCriticalHitRateReduction`。
- `test:b` 增加非法 Boss 数据反例。
- `test:c` 增加 1% 属性静态公式与时间轴命中回归：
  - 基础攻击 1000、`CharacterOnePercentAttack = 50`、10% 攻击 Buff。
  - 期望平均伤害为 1500，而不是旧算法的 1100。

## 已执行验证

```powershell
npm run test:b
npm run test:c
npm run test:e
npm run agent:test:example
npm run agent:test:sim
npm run check:all
```

全部通过。`npm run check:all` 中 Web build 仍有 Vite chunk size warning，不影响本轮类型与构建通过。

## 后续边界

- Boss 减暴击字段暂不影响伤害结果。
- 暴击率概率模型完成前，当前平均伤害仍沿用 100% 暴击假设。
