# 诛仙3团队副本模拟训练场 — Phase C0 前置整理任务清单

## [x] C0-1：恢复旧 CLI 示例入口

- `[x]` 恢复 `agent_tool/examples/zhu_shuang_mo_t21_boss1.json`，作为稳定的单技能计算回归样例。
- `[x]` 保持 `agent_tool` 的 `test:example` 脚本可直接运行，不依赖根目录临时 profile 文件。

## [x] C0-2：修正根目录 npm 脚本

- `[x]` 修正 `agent:calc` 参数透传，使 `npm run agent:calc -- --input ...` 可以正确调用 `agent_tool`。
- `[x]` 新增 `agent:test:example`，方便从根目录验证旧 CLI 示例入口。
- `[x]` 扩展 `check:all`，把 `@zx/simulation-engine` 的类型检查纳入全量验证。

## [x] C0-3：强化 Phase B 回归测试

- `[x]` 将 `test_b.ts` 从打印式走查改为 `node:assert/strict` 硬断言。
- `[x]` 校验数据 validator 不存在 ERROR 级问题。
- `[x]` 校验玩家技能覆盖只影响 Actor 运行时实例，不污染全局白板技能。
- `[x]` 增加内联辅助技能 fixture，校验 `AppliedEffect` 的持续时间与 `BuffEffects` 可按 `EffectId` 覆盖。

## [x] C0-4：整理本地产物忽略规则

- `[x]` 忽略 `node_modules/`、工作区 `dist/`、`agent_tool/node_modules_win/`。
- `[x]` 忽略本地临时 profile：`agent_tool/profile_test_*.json`、`agent_tool/temp_profile_*.json`。

## [x] C0-5：更新 Phase C 与总方案文档

- `[x]` 修正 Phase C 时间口径：内部统一整数毫秒，不使用浮点秒排序。
- `[x]` 修正 Phase C 策略范围：明确支持手动时间轴、固定循环、法宝栏三种主输出策略。
- `[x]` 修正辅助起手口径：不使用负时间轴，统一从 `t = 0` 开始。
- `[x]` 将“战斗数据查询库”需求加入总方案，并归入 Phase 3 / 阶段 F 的 Web UI 范围。

## [x] C0-6：验证

- `[x]` `npm run test:b`
- `[x]` `npm run agent:test:example`
- `[x]` `npm run agent:calc -- --input examples/zhu_shuang_mo_t21_boss1.json`
- `[x]` `npm run check:all`

## 边界说明

- 本阶段不接管你正在录入的 `skills.json` 辅助职业 Buff/Debuff 数据。
- Boss 血量继续按你的计划拿到实测数据后录入 `dungeons_monsters.json`。
- Phase C 引擎测试应优先使用内联 fixture 或最小场景 JSON，避免和正在录入的真实技能库互相阻塞。
