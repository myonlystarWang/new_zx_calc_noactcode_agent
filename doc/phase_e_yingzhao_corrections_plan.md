# 英招技能校准与 1% 属性缩放接口设计方案

本方案旨在解决英招（Ying Zhao）的技能数据校准问题，并完善 1% 属性增益（攻击、防御、气血、真气）在请求规范化（Normalization）及模拟引擎中的闭环接口设计。

## User Review Required

> [!NOTE]
> 1. 新增的 **【攻坚】 (Gong Jian)** 技能为 Debuff 技能，其防御降低值动态缩放于英招的 `CharacterMaxAttack`，乘数为 `-1.0`。
> 2. 新增的被暴击概率增加（紫点）将作为 `BuffMonsterCritRateIncreaseEffect` 效果项挂载于 Boss (ENEMY Target) 上。由于当前平均伤害计算假定 100% 暴击率，该值目前在伤害数值上暂不改变暴击概率，但已经完全支持在状态机和事件流中流转与展示。
> 3. **【背水】 (Bei Shui)** 的 4th Gen preset (`YING_JU`/`HAO_YUE`/`XI_RI`) 会统一将 `BuffMonsterHarmedPercentEffect` 覆盖为 `50`，代表四代技能5级效果对受到伤害增加属性的提升（从 40 提高到 50）。

## Proposed Changes

### 1. 静态技能数据库

#### [MODIFY] [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json)
- 在 `YING_ZHAO.FO` 列表下新增技能 `YZ_FO_SKILL_GJ` (攻坚)：
  - ActionType: `"DEBUFF"`, CD: `2`, CastTime: `1.0`, Target: `"ENEMY"`, Duration: `20`.
  - 挂载 `BuffDefenseFixedEffect`，且设定动态缩放：`DynamicScalingAttribute: "CharacterMaxAttack"`, `DynamicScalingMultiplier: -1.0`, `DynamicTargetField: "BuffDefenseFixedEffect"`.
  - 挂载被暴击概率增加效果：`BuffMonsterCritRateIncreaseEffect: 35`.
- 修改 `YZ_FO_SKILL_BS` (背水)：
  - 增加 `FourthGenPresets` 属性，为 `YING_JU`, `HAO_YUE`, `XI_RI` 品质配置重载项：重载 `YZ_DEBUFF_BS_GREEN_HARMED` 效果的 `BuffMonsterHarmedPercentEffect` 为 `50`。

### 2. 模拟仿真引擎

#### [MODIFY] [combat_loop.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/combat_loop.ts)
- 将 `'BuffMonsterCritRateIncreaseEffect'` 加入到 `BOSS_DAMAGE_EFFECT_FIELDS` 白名单中，确保 Boss 身上的紫点 Debuff 不会被过滤。

### 3. 数据规范化适配器

#### [MODIFY] [normalize.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/agent_tool/src/normalize.ts)
- 在 `attrAliases` 中注册 4 个全新的一分属性键，避免在 CLI 入参解析 and Profile 读取时这些 1% 的接口字段被过滤删除：
  - `CharacterOnePercentAttack` -> `['CharacterOnePercentAttack', 'onePercentAttack', '1%攻击', '一分攻击']`
  - `CharacterOnePercentDefense` -> `['CharacterOnePercentDefense', 'onePercentDefense', '1%防御', '一分防御']`
  - `CharacterOnePercentHealth` -> `['CharacterOnePercentHealth', 'onePercentHealth', '1%气血', '一分气血']`
  - `CharacterOnePercentMana` -> `['CharacterOnePercentMana', 'onePercentMana', '1%真气', '一分真气']`

---

## Verification Plan

### Automated Tests
- 执行 `npm run test:e` 验证场景装配器在包含新技能与预设下的运行正确性。
- 执行 `npm run check:all` 保证整个工程（类型系统、Web App、CLI）无任何编译及类型 Regression。
