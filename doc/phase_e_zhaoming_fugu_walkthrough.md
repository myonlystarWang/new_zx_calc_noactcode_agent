# 昭冥跗骨生灵暴击率接口 Walkthrough

## 背景

[phase_e_zhaoming_fugu_plan.md](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/doc/phase_e_zhaoming_fugu_plan.md) 为玩家属性系统增加暴击率接口，并为昭冥【跗骨生灵】预留昭冥自身暴击率 5% 的增益规则入口。当前阶段该技能暂不参与仿真结算。

## 实施

### 1. Schema 扩展

- [types.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/types.ts)
  - `CharacterAttributes.CharacterCriticalHitRatePercent?: number`
  - `BuffEffects.BuffCriticalHitRatePercentEffect?: number`
- [field_keys.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/field_keys.ts)
  - 新字段纳入 `CHARACTER_ATTRIBUTE_KEYS` 和 `BUFF_EFFECT_KEYS`。

### 2. 属性聚合

- [attributes.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/attributes.ts) 中累加：
  - `(base.CharacterCriticalHitRatePercent ?? 0) + (totals.BuffCriticalHitRatePercentEffect ?? 0)`。
- 这样昭冥后续作为动态缩放来源时，可以读取当前暴击率。

### 3. 跗骨当前占位结算

- [combat_loop.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/combat_loop.ts) 的 `ZM_BUFF_FGSL` 分支当前返回空 `BuffEffects`。
- 该状态仅用于数据查阅和后续恢复入口，不进入默认团队仿真加成。

### 4. 数据与输入别名

- [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json) 中 `ZM_BUFF_FGSL` 增加 `BuffCriticalHitRatePercentEffect: 0` 占位。
- [normalize.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/agent_tool/src/normalize.ts) 中新增暴击率别名。

## 测试

- `test:c` 验证 `ZM_BUFF_FGSL` 当前不生成 `BuffCriticalHitRatePercentEffect`。
- 默认团队仿真通过装配器排除 `ZM_FO_SKILL_FGSL`。

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

- 当前平均伤害仍按 100% 暴击处理，跗骨只保留数据占位。
- 等后续实现暴击概率模型时，再统一接入 `CharacterCriticalHitRatePercent`、`BuffCriticalHitRatePercentEffect`、`MonsterCriticalHitRateReduction`、`BuffMonsterCritRateIncreaseEffect`。
