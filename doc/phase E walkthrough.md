# Phase E 自动场景装配适配器走查报告

## 1. 本次目标

本次只执行 Phase E 计划中的 **E-1.1 自动场景装配适配器**。核心技能数据录入、Boss 血量核对和真实数值校准仍由数据核对流程继续推进。

适配器目标是把高层配置（主输出 Profile、辅助职业列表、Boss 选择、策略）组装为标准 `SimulationScenario`，供 Phase D 的 `agent:sim`、后续 Web UI 和测试场景复用。

## 2. 新增与修改文件

### 类型

- `packages/simulation-engine/src/types.ts`
  - 新增 `FactionId`。
  - 新增 `AssemblerDpsActorInput`。
  - 新增 `AssemblerSupportActorInput`。
  - 新增 `AssembleScenarioInput`。
  - 新增 `AssembleScenarioGameData`。
  - `SupportStrategyConfig.CAST_ON_READY` 新增 `targetActorId`，用于默认把 `ALLY` 类辅助技能施放给主输出。

### 适配器

- `packages/simulation-engine/src/scenario_assembler.ts`
  - 新增纯函数 `assembleScenario(input, gameData)`。
  - 不读取文件系统，不依赖 Node 专有模块，可供 CLI 与 Web 共用。
  - DPS 默认装配当前阵营与 `COMMON` 的伤害技能。
  - Support 默认装配当前阵营与 `COMMON` 的 `BUFF` / `DEBUFF` / `UTILITY` 技能。
  - 无策略辅助会自动生成 `CAST_ON_READY`。
  - 策略引用技能、显式 `skillIds` 和 `skillOverrides` 引用技能都会做存在性校验。
  - Boss 支持 `dungeonId + bossId` 精确匹配；缺少 `dungeonId` 时可全局匹配，跨副本重名会要求补 `dungeonId`。
  - 动态缩放辅助技能缺少来源 `profileAttributes` 时提前失败，避免运行到 `BUFF_APPLY` 才失败。

### 策略层

- `packages/simulation-engine/src/strategies.ts`
  - `CAST_ON_READY` 决策现在会透传 `targetActorId`。

### 导出与测试

- `packages/simulation-engine/src/index.ts`
  - 导出 `scenario_assembler`。
- `packages/simulation-engine/src/test_assembler.ts`
  - 新增 E-1.1 自动测试。
- `package.json`
  - 新增 `npm run test:e`。

## 3. 测试覆盖

`test_assembler.ts` 覆盖：

- DPS、Support、默认 `CAST_ON_READY` 策略装配，并能直接 `runSimulation`。
- Support 默认只装配辅助类技能，不会把伤害技能塞进辅助循环。
- `CAST_ON_READY.targetActorId` 自动指向主输出。
- Boss ID 跨副本重名时，不提供 `dungeonId` 会提前报错。
- 提供 `dungeonId` 时可精确解析对应 Boss。
- 动态缩放辅助缺少 `profileAttributes` 时提前报错。
- 策略引用未知技能时提前报错。

## 4. 验证命令

已执行：

```powershell
npm run test:e
npm run engine:check
```

结果：

- `test:e` 通过。
- `engine:check` 通过。

后续完整回归仍建议在数据录入稳定后执行：

```powershell
npm run test:b
npm run test:c
npm run test:e
npm run agent:test:sim
npm run agent:test:example
npm run check:all
```

## 5. 后续边界

- 本次没有修改 `web_app/public/game_data/skills.json`。
- 本次没有执行 E-1.2 的八辅助/三输出数据录入。
- 本次没有执行 E-1.3 的真实 Boss 血量与 T21 实例校准。
- 适配器当前输出完整 `SimulationScenario`；Phase D 的 `agent:sim` 仍读取完整 scenario JSON，后续可按需要增加“高层 assemble 输入 -> CLI 内部装配”的入口。
