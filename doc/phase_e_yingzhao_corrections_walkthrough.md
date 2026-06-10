# 英招技能校准与 1% 属性缩放接口任务验收报告

本报告记录了对英招 (Ying Zhao) 技能进行的校准修复，以及 1% 属性映射在数据规范化和模拟器中的集成验收结果。

## 变更详情

### 1. 静态数据修改
- **【攻坚】 (Gong Jian)**:
  - 在 [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json) 中为英招新增技能 `YZ_FO_SKILL_GJ`。
  - 配置 `BuffMonsterCritRateIncreaseEffect` 为 `35` (紫点)。
  - 设置基于 `CharacterMaxAttack` 乘积为 `-1.0` 的 `BuffDefenseFixedEffect` 动态降防效果。
- **【背水】 (Bei Shui)**:
  - 在 [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json) 中为英招技能 `YZ_FO_SKILL_BS` 添加 `FourthGenPresets` 预设。
  - 重载 `YZ_DEBUFF_BS_GREEN_HARMED` 效果的 `BuffMonsterHarmedPercentEffect` 在四代品质（`YING_JU`/`HAO_YUE`/`XI_RI`）下为 `50`（由基础值 40 提升至 50）。

### 2. 模拟引擎与映射逻辑修改
- **被暴击率过滤放行**:
  - 在 [combat_loop.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/combat_loop.ts) 中，将 `BuffMonsterCritRateIncreaseEffect` 字段添加到 `BOSS_DAMAGE_EFFECT_FIELDS` 集合中。
  - 为 `combat_loop.ts` 中解析动态缩放属性的获取处添加了 `?? 0` 的 Nullish Coalescing 默认安全值，修复了严格类型检查下的 TS18048 错误。
- **1% 属性别名注册**:
  - 在 [normalize.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/agent_tool/src/normalize.ts) 中，为 `CharacterOnePercentAttack`, `CharacterOnePercentDefense`, `CharacterOnePercentHealth`, `CharacterOnePercentMana` 注册中文及驼峰属性映射别名。

---

## 验证结果

### 1. 自动化单元测试 (`npm run test:e`)
- 运行通过，场景装配器在包含新英招技能及属性下的初始化与模拟均全部成功。
```
=== 启动 Phase E 自动场景装配测试 ===
- 组装 DPS、辅助、默认策略并运行模拟 [SUCCESS]
- Boss 全局重名时要求 dungeonId 消歧 [SUCCESS]
- Boss 按 dungeonId 精确解析 [SUCCESS]
- 动态缩放辅助缺少 profileAttributes 时提前失败 [SUCCESS]
- 策略引用未知技能时提前失败 [SUCCESS]
=== Phase E 自动场景装配测试通过！ ===
```

### 2. 全局编译与构建校验 (`npm run check:all`)
- 执行通过，`simulation-engine`、`agent_tool` 和 `web_app` 生产环境打包构建 100% 成功，无任何 TypeScript 编译及运行期回归错误。
