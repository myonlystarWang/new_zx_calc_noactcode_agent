# Phase C 离散事件模拟核心走查报告

## 1. 本次目标

本阶段完成不依赖 UI 的战斗时间轴核心：事件优先队列、Actor 运行时状态、Buff/Debuff 状态机、主输出与辅助策略、逐段命中结算、Boss 血量与死亡截断，并输出可追溯的事件流水和伤害流水。

实现使用内联测试 fixture，不依赖正在录入中的真实 `skills.json` 辅助职业数据。

## 2. 新增与修改文件

### 共享类型

- `packages/simulation-engine/src/types.ts`
  - 新增 `SimEventType`、`SimEvent`、`SimEventLog`。
  - 新增 `HitDamageRecord`、`SimulationScenario`、`SimulationResult`。
  - 新增手动时间轴、固定循环、法宝栏、起手铺垫、好了就放、绝对时间释放等策略配置类型。
  - 将 `FourthGenPresets` 调整为可选品质映射，支持只录入某个四代品质预设。

### 字段白名单

- `packages/simulation-engine/src/field_keys.ts`
  - 集中维护 `CharacterAttributes` 与 `BuffEffects` 字段白名单。
  - 为运行时动态缩放解析和 validator 复用同一套字段判断。

### Timeline

- `packages/simulation-engine/src/timeline.ts`
  - 实现整数毫秒时间轴。
  - 使用二分插入保持队列有序。
  - 相同时间下使用事件优先级和稳定 `sequence` 排序。
  - `BUFF_EXPIRE` 优先于 `BUFF_APPLY` 与 `HIT`，保证 Buff 到期点的命中不再享受该 Buff。

### EffectManager

- `packages/simulation-engine/src/effects.ts`
  - 实现 `EffectInstance`。
  - 支持挂载、刷新、叠加、过期、互斥覆盖。
  - 使用 `InstanceId` 处理旧过期事件，避免旧 Buff 被顶替后误删新 Buff。
  - 可把活性效果转换为 `Buff[]`，复用现有 `resolveHitDamage`。

### Actor 运行时状态

- `packages/simulation-engine/src/actor.ts`
  - 保留原有构造器兼容性。
  - 增加施法锁、GCD、技能 CD、充能状态。
  - 支持充能扣减、充能恢复、刷新充能、减少 CD。
  - 增加实时属性聚合方法 `getCurrentAttributes`。

### 策略层

- `packages/simulation-engine/src/strategies.ts`
  - 实现固定循环和法宝栏扫描策略。
  - 支持法宝栏 `FROM_FIRST_EACH_DECISION` 与 `CONTINUE_POINTER`。
  - 辅助 `CAST_ON_READY` 可选择当前可用技能。
  - 手动时间轴、起手铺垫、绝对时间释放由 `SimulationEngine` 按时间直接调度。

### 主循环

- `packages/simulation-engine/src/combat_loop.ts`
  - 新增 `SimulationEngine` 与 `runSimulation`。
  - 处理全部 Phase C 事件类型。
  - `CAST_START` 即启动 CD/消耗充能。
  - `HIT` 逐段调用 `resolveHitDamage`，再应用 Boss 伤害压缩。
  - 每段生成 `HitDamageRecord`，包含时间、技能、段数、伤害、活性效果、Boss HP 前后值。
  - Boss 死亡后生成 `BOSS_DEAD` 并截断后续模拟。
  - 缺失 Boss 血量时抛出明确错误。
  - `BUFF_APPLY` 会解析 `DynamicScalingAttribute`、`DynamicScalingMultiplier`、`DynamicTargetField`，并把动态值写入真实 `BuffEffects`。
  - 动态缩放使用来源 Actor 的实时属性；来源 Actor 缺少基础属性时事件失败。
  - Boss 侧当前只把怪物易伤/怪物爆伤字段传入伤害结算，避免 Boss 防御系统完成前误用“破防”字段。

### 伤害公式

- `packages/simulation-engine/src/calculator.ts`
  - 固定气血、固定真气、固定防御字段现在会参与对应属性结算。
  - `BuffMonsterDamageIncreaseEffect` 会并入角色对怪物增伤。

### 导出与测试

- `packages/simulation-engine/src/index.ts`
  - 导出 Phase C 新模块。
- `packages/simulation-engine/src/test_c.ts`
  - 新增 Phase C 自动化测试。
- `packages/simulation-engine/src/test_b.ts`
  - 增加四代/动态字段 validator 反例测试。
- `package.json`
  - 新增 `npm run test:c`。

## 3. 关键行为验证

`test_c.ts` 覆盖以下场景：

- Timeline 同毫秒事件优先级：`BUFF_EXPIRE` -> `BUFF_APPLY` -> `HIT`。
- EffectManager 互斥覆盖：高效果顶替低效果，低效果不能覆盖高效果。
- 旧过期事件校验：被顶替的旧效果过期事件不会误删新效果。
- 手动时间轴：按绝对时间释放技能。
- 多段命中：3 秒 9 段生成 9 条 `HitDamageRecord`，时间为 333/667/1000/.../3000ms。
- Buff 过期卡段：1 秒 Buff 在 1000ms 先过期，因此第 3 段不再吃 Buff。
- 固定循环：按循环指针稳定输出技能。
- 法宝栏：从第 1 格开始扫描，CD 中则跳过。
- Boss 死亡截断：血量归零后不再计入后续命中。
- 伤害压缩：`DamageCompressionPercent: 97` 时，100 点理论伤害压缩为约 3 点。
- 充能恢复：双充能技能消耗后按恢复时间补充。
- 功能技能刷新充能：`CooldownResets` 的 `REFRESH_CHARGES` 可以恢复目标技能充能。
- 自动多阶段状态：一段 Buff 到期后自动流转到二段 Buff。
- 四代动态缩放：四代预设把来源 Actor 最大攻击按倍数写入固定气血 Buff，并影响一次气血加成伤害。
- 缺 Boss 血量：没有 `MonsterHealth` 且没有场景覆盖时明确报错。

## 4. 验证命令与结果

执行命令：

```powershell
npm run test:c
npm run test:b
npm run agent:test:example
npm run check:all
```

结果：

- `test:c` 通过。
- `test:b` 通过。
- `agent:test:example` 通过，旧单技能 CLI 仍输出 `ok: true`。
- `check:all` 通过：共享引擎类型检查、Agent CLI 类型检查、Web 构建均成功。

Web 构建仍有 Vite chunk 大于 500 kB 的既有提示，不影响本阶段验收。

## 5. 实现边界

- 当前多阶段技能支持自动流转；手动提前激活下一阶段尚未单独开放场景入口。
- 当前 `HIT` 记录中的 `DamageApplied` 会按 Boss 剩余血量截断，`AvgDamage` 保留本段理论压缩后伤害。
- 当前 `HIT` 记录中的 `ActiveEffectIds` 是效果实例 ID，不是数据层 `EffectId`。
- `无量真言` 与 `无量真言·禅` 的 15% 易伤效果可以同时生效；本轮不改 `skills.json`，后续由数据层调整互斥配置。
- `天舞宝轮破防` 暂不接入伤害结算；后续补 Boss 防御属性与破防公式后再处理。
- Phase C 尚未接入 `agent_tool` 的模拟 CLI，这属于后续 Phase D。
- Phase C 尚未做 Web UI，这属于后续 Phase F。

## 6. Phase D 交接说明

新会话继续 Phase D 时，建议从以下入口开始：

1. 读取本文件、`doc/phase C task.md`、`doc/phase C implementation_plan.md` 和总方案 `doc/诛仙3团队副本模拟训练场方案v1.1.md` 的 10.5 阶段 D。
2. 从 `packages/simulation-engine/src/combat_loop.ts` 使用 `runSimulation(scenario)`，输入类型为 `SimulationScenario`，输出类型为 `SimulationResult`。
3. 在 `agent_tool` 中新增模拟 CLI，建议文件名为 `agent_tool/src/sim_cli.ts`，不要替换现有 `agent_tool/src/cli.ts`。
4. 在 `agent_tool/package.json` 增加独立脚本，例如 `sim`，根目录再增加 `agent:sim` 透传脚本。
5. CLI 第一版可以直接读取完整 `SimulationScenario` JSON；后续再做从已有 profile/game_data 组装 scenario 的适配层。
6. 输出 JSON 至少包含：
   - `resolved`：场景、Boss、Actor、技能策略的解析结果。
   - `events`：`SimulationResult.events`。
   - `hitRecords`：`SimulationResult.hitRecords`。
   - `boss`：起始血量、剩余血量、`killedAtMs`。
   - `summary`：总伤、DPS 起点、DPS 时长、平均 DPS、技能占比。
   - `coverage`：Buff/Debuff 覆盖率，Phase D 可先从事件流水按效果实例聚合。
7. Phase D 测试建议新增 `agent_tool/examples/simulation_minimal.json` 和 `npm run agent:sim -- --input examples/simulation_minimal.json`，同时保留 `npm run agent:test:example` 旧单技能回归。

当前 Phase C 的验证入口：

```powershell
npm run test:c
npm run test:b
npm run agent:test:example
npm run check:all
```

注意：`web_app/public/game_data/skills.json` 目前正在进行真实职业技能/Buff/Debuff 数据录入，Phase D 不应假设该文件已经完整。第一版 CLI 应优先使用独立的最小 scenario fixture，避免和数据录入互相阻塞。
