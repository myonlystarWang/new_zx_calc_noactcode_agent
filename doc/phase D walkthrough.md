# Phase D CLI 与 Agent Skill 接入走查报告

## 1. 本次目标

Phase D 在 Web UI 前提供一个可批量验证的无浏览器模拟入口。入口位于 `agent_tool`，读取完整 `SimulationScenario` JSON，调用共享包 `@zx/simulation-engine` 的 `runSimulation`，输出结构化 JSON，供后续 Python runner、skill 脚本和手工回归使用。

本阶段不依赖正在录入的真实 `skills.json`，也不修改该文件。

## 2. 新增与修改文件

### 模拟 CLI

- `agent_tool/src/sim_cli.ts`
  - 新增模拟 CLI。
  - 支持 `--input <json>`。
  - 输入可以是单个 `SimulationScenario`，也可以是 `{ "scenario": ... }`。
  - 输入可以是多方案 `{ "scenarios": [...] }` / `{ "scenarios": { "label": scenario } }`。
  - 输入可以是 `{ "baseline": ..., "variants": [...] }`。
  - 运行后输出标准 JSON，失败时输出 `{ ok: false, error }`。

### 事件流水增强

- `packages/simulation-engine/src/combat_loop.ts`
  - `BUFF_APPLY` 的事件日志新增：
    - `appliedInstanceId`
    - `appliedEffectId`
    - `appliedEndTimeMs`
    - `replacedInstanceIds`
    - `replacedEffectIds`
    - `ignored`
  - 这些字段让覆盖率可以从事件流水还原，不需要猜测 EffectManager 内部状态。

### 脚本

- `agent_tool/package.json`
  - 新增 `sim`：先构建 `@zx/simulation-engine`，再执行 `tsx src/sim_cli.ts`。
  - 新增 `test:sim`：运行最小模拟示例。
  - `check` 也会先构建共享引擎，避免读取过期 `dist` 类型。
- `package.json`
  - 新增 `agent:sim`。
  - 新增 `agent:test:sim`。

### 示例

- `agent_tool/examples/simulation_minimal.json`
  - 单 Boss、单 DPS、单辅助的最小闭环。
  - 辅助提供团队攻击 Buff 和 Boss 易伤 Debuff。
  - 输出可验证击杀时间、逐段伤害、技能占比、覆盖率。
- `agent_tool/examples/simulation_compare_order.json`
  - 两个方案只调整固定循环技能顺序。
  - 用于验证 A/B 对比输出。

## 3. 输出结构

单方案输出：

```json
{
  "ok": true,
  "label": "phase-d-minimal",
  "resolved": {},
  "events": [],
  "hitRecords": [],
  "boss": {},
  "summary": {},
  "coverage": {},
  "diagnostics": {}
}
```

多方案输出：

```json
{
  "ok": true,
  "runs": [],
  "comparisons": []
}
```

关键字段：

- `resolved`：场景解析后的 Boss、Actor、技能、策略。
- `events`：完整 `SimEventLog[]`。
- `hitRecords`：完整逐段伤害流水。
- `boss`：起始血量、剩余血量、击杀时间。
- `summary`：总伤、DPS 起点、DPS 时长、平均 DPS、技能占比。
- `coverage.intervals`：实例级 Buff/Debuff 覆盖区间。
- `coverage.byEffect`：按效果、目标、来源聚合后的覆盖率。
- `comparisons`：多方案对比的击杀时间差、总伤差、DPS 差、技能占比差。
- `diagnostics`：事件总数、跳过事件数、失败事件数。

## 4. 验证命令与结果

执行命令：

```powershell
npm run agent:test:sim
npm run agent:sim -- --input agent_tool/examples/simulation_compare_order.json
npm run test:b
npm run test:c
npm run agent:test:example
npm run check:all
```

结果：

- `agent:test:sim` 通过，最小模拟输出 `ok: true`，Boss 在 5000ms 击杀。
- A/B 对比示例通过，方案 B 相对方案 A `bossKilledAtDeltaMs` 为 500ms。
- `test:b` 通过。
- `test:c` 通过。
- `agent:test:example` 通过，旧单技能 CLI 未被破坏。
- `check:all` 通过。

Web 构建仍有 Vite chunk 大于 500 kB 的既有提示，不影响本阶段验收。

## 5. Phase E 接续说明

下一阶段可以继续做核心数据录入与校准：

1. 继续补全 `web_app/public/game_data/skills.json` 中主输出和辅助职业技能。
2. 为真实 Boss 补齐血量，放入 `dungeons_monsters.json` 或 scenario 覆盖。
3. 基于真实技能数据手工组装 1-2 个 `SimulationScenario`，先不急着做自动组装器。
4. 使用 `npm run agent:sim -- --input <scenario.json>` 校验事件流水、逐段伤害、覆盖率。
5. 等最小真实场景稳定后，再做从职业/阵营/profile 自动生成 scenario 的适配层。

注意：`无量真言` 与 `无量真言·禅` 的 15% 易伤效果允许同时生效，数据层不要仅因为数值相同就放入同一互斥覆盖组。`天舞宝轮破防` 仍等待 Boss 防御属性与破防公式完成后接入。
