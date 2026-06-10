# Phase E 公式与 Boss 校验修复任务跟踪

- `[x]` **1. 修复 1% 属性折算链路**
  - `[x]` 新增 `attributes.ts` 共享属性聚合 helper
  - `[x]` `Actor.getCurrentAttributes` 改用共享 helper
  - `[x]` `resolveHitDamage` 与 `calculateDamage` 改用共享 helper，确保静态公式与时间轴命中均支持 `CharacterOnePercentAttack/Defense/Health/Mana`
- `[x]` **2. 补充 Boss 数据 validator**
  - `[x]` 新增 `validateMonstersData`
  - `[x]` 校验 Boss 基础字段、同副本重复 ID、血量、伤害压缩、减暴击等字段
  - `[x]` `test:b` 接入真实 `dungeons_monsters.json` 与非法 Boss 反例
- `[x]` **3. 验证**
  - `[x]` 执行 `npm run test:b`
  - `[x]` 执行 `npm run test:c`
  - `[x]` 执行 `npm run test:e`
  - `[x]` 执行 `npm run agent:test:example`
  - `[x]` 执行 `npm run agent:test:sim`
  - `[x]` 执行 `npm run check:all`

## 注意

- `MonsterCriticalHitRateReduction` 当前仍是数据和校验字段，不参与平均伤害结算。
- 暴击率公式将在后续引入非 100% 暴击概率模型时统一接入。
