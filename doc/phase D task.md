# 诛仙3团队副本模拟训练场 — Phase D 任务跟踪清单

## [x] D-1：新增 Agent 模拟 CLI

- `[x]` 新增 `agent_tool/src/sim_cli.ts`。
- `[x]` CLI 读取完整 `SimulationScenario` JSON。
- `[x]` CLI 支持直接传入单个场景对象。
- `[x]` CLI 支持 `{ "scenario": ... }` 包装格式。
- `[x]` CLI 支持 `{ "scenarios": [...] }` 或 `{ "scenarios": { "label": scenario } }` 多方案批量格式。
- `[x]` CLI 支持 `{ "baseline": ..., "variants": [...] }` 对比格式。
- `[x]` 输入路径支持相对当前工作目录、相对 `agent_tool`、相对仓库根目录。

## [x] D-2：输出结构化模拟结果

- `[x]` 输出 `ok`、`label`、`resolved`、`events`、`hitRecords`、`boss`、`summary`。
- `[x]` `resolved` 包含 Boss、Actor、技能、策略、技能覆盖表等解析信息。
- `[x]` `events` 保留 Phase C `SimEventLog[]` 完整事件流水。
- `[x]` `hitRecords` 保留逐段伤害流水。
- `[x]` `summary.SkillBreakdown` 增加 `DamageSharePercent` 技能伤害占比。
- `[x]` `diagnostics` 汇总事件总数、跳过事件数、失败事件数和失败事件列表。

## [x] D-3：覆盖率聚合

- `[x]` `BUFF_APPLY` 事件日志补充 `appliedInstanceId`、`appliedEffectId`、`appliedEndTimeMs`。
- `[x]` `BUFF_APPLY` 事件日志补充 `replacedInstanceIds`、`replacedEffectIds`。
- `[x]` CLI 从事件流水聚合 Buff/Debuff 覆盖率。
- `[x]` 覆盖率输出包含实例级 `intervals`。
- `[x]` 覆盖率输出包含按 `effectId + targetId + sourceActorId + sourceSkillId` 聚合的 `byEffect`。
- `[x]` 覆盖率会处理自然过期、被替换、Boss 提前死亡导致的模拟结束截断。

## [x] D-4：A/B 方案对比

- `[x]` 多方案输入时输出 `runs`。
- `[x]` 从第一组方案作为 baseline，后续方案作为 variant。
- `[x]` 输出 `bossKilledAtDeltaMs`。
- `[x]` 输出 `totalDamageDelta`。
- `[x]` 输出 `averageDpsDelta`。
- `[x]` 输出 `dpsDurationDeltaMs`。
- `[x]` 输出各技能总伤、占比、命中数差值。

## [x] D-5：脚本接入

- `[x]` `agent_tool/package.json` 新增 `sim`。
- `[x]` `agent_tool/package.json` 新增 `test:sim`。
- `[x]` 根目录 `package.json` 新增 `agent:sim`。
- `[x]` 根目录 `package.json` 新增 `agent:test:sim`。
- `[x]` `agent_tool` 的 `sim` 和 `check` 会先构建 `@zx/simulation-engine`，避免读取过期 `dist`。
- `[x]` 保留旧 `agent_tool/src/cli.ts` 与 `agent:calc` 单技能入口。

## [x] D-6：示例输入

- `[x]` 新增 `agent_tool/examples/simulation_minimal.json`。
- `[x]` 最小示例包含 1 个 Boss、1 个 DPS、1 个辅助、团队 Buff、Boss Debuff。
- `[x]` 最小示例可输出击杀时间、逐段伤害、技能占比、Buff/Debuff 覆盖率。
- `[x]` 新增 `agent_tool/examples/simulation_compare_order.json`。
- `[x]` 对比示例只调整技能顺序，输出击杀时间差与 DPS 差。

## [x] D-7：验证

- `[x]` `npm run agent:test:sim`
- `[x]` `npm run agent:sim -- --input agent_tool/examples/simulation_compare_order.json`
- `[x]` `npm run test:b`
- `[x]` `npm run test:c`
- `[x]` `npm run agent:test:example`
- `[x]` `npm run check:all`

## 边界说明

- Phase D 不依赖真实 `skills.json` 完整度，示例使用独立最小 `SimulationScenario`。
- 本阶段没有修改 `web_app/public/game_data/skills.json`。
- 当前 CLI 第一版只负责读取完整 scenario；从职业、Boss、profile、技能库自动组装 scenario 留到 Phase E/F 或专门适配层。
- 当前 A/B 对比基于整场 `SimulationResult` 聚合，不做策略自动搜索。
- 覆盖率分母使用 `boss.killedAtMs ?? scenario.maxTimeMs`。
- `ActiveEffectIds` 仍为运行时效果实例 ID；数据层 `EffectId` 可从 `events[].data.appliedEffectId` 或覆盖率输出读取。
