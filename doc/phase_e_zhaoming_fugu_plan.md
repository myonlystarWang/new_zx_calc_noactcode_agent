# 昭冥【跗骨生灵】技能校准与玩家暴击率接口设计方案

本方案旨在丰富玩家属性系统，增加“暴击率”相关接口，并为昭冥技能【跗骨生灵】预留“被附身目标增加暴击率（值为昭冥自身暴击率的 5%）”的规则入口。

> 当前阶段口径：跗骨生灵暂不参与仿真结算，仅保留数据占位与页面查阅。等后续暴击概率模型进入结算后，再恢复 `CharacterCriticalHitRatePercent * 0.05` 的动态效果。

## Proposed Changes

### 1. 模拟引擎类型与键值扩展

#### [MODIFY] [types.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/types.ts)
- 在 `CharacterAttributes` 接口中新增可选字段 `CharacterCriticalHitRatePercent?: number;`（玩家暴击率，百分比形式，如 260 代表 260%）。
- 在 `BuffEffects` 接口中新增可选字段 `BuffCriticalHitRatePercentEffect?: number;`（玩家暴击率增益效果）。

#### [MODIFY] [field_keys.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/field_keys.ts)
- 在 `CHARACTER_ATTRIBUTE_KEYS` 数组中添加 `'CharacterCriticalHitRatePercent'`。
- 在 `BUFF_EFFECT_KEYS` 数组中添加 `'BuffCriticalHitRatePercentEffect'`。

#### [MODIFY] [attributes.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/attributes.ts)
- 在共享属性聚合 helper 中累加暴击率效果，确保 `Actor.getCurrentAttributes`、动态缩放来源属性和后续公式入口使用同一套属性聚合逻辑：
  - `CharacterCriticalHitRatePercent: (base.CharacterCriticalHitRatePercent ?? 0) + (totals.BuffCriticalHitRatePercentEffect ?? 0)`。

### 2. 模拟器运行时逻辑（附身增益逻辑，暂缓启用）

#### [MODIFY] [combat_loop.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/combat_loop.ts)
- 当前 `resolveDynamicEffect` 针对 `'ZM_BUFF_FGSL'` 返回空 `BuffEffects`，表示该技能只作为占位状态，不提供仿真加成。
- 未来恢复启用时，再读取昭冥暴击率并写入 `BuffCriticalHitRatePercentEffect`。

#### [MODIFY] [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json)
- 在 `ZM_BUFF_FGSL` 的静态 `BuffEffects` 中补充 `BuffCriticalHitRatePercentEffect: 0` 占位，便于数据查询 UI 展示跗骨包含暴击率维度。

### 3. 请求数据规范化别名

#### [MODIFY] [normalize.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/agent_tool/src/normalize.ts)
- 在 `attrAliases` 字典中，注册 `CharacterCriticalHitRatePercent` 的别名配置：`['CharacterCriticalHitRatePercent', 'critRate', 'criticalRate', '暴击率', '暴击']`。不加入必填验证，保持完全向下兼容。

---

## Verification Plan

### Automated Tests
- 执行 `npm run test:c` 验证跗骨当前保持暂禁用占位，不生成目标暴击率增益。
- 执行 `npm run test:e` 验证场景装配器在包含昭冥新附身效果下能正常通过测试。
- 执行 `npm run check:all` 保证整个工程无任何类型与构建 Regression。
