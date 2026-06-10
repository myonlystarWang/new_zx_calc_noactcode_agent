# 诛仙3团队副本模拟训练场 — 阶段 C 设计方案与实施计划

## 方案目标

完成 **阶段 C：离散事件模拟核心 (Discrete Event Simulation Core)**。在 `@zx/simulation-engine` 共享包中构建一个精确到毫秒级、非 UI 依赖的战斗仿真时间轴引擎。该引擎将作为整个系统的核心算力，支持多角色协作、技能 CD/GCD 锁定、极速缩短施法时间、Buff/Debuff 动态重叠互斥判定、多段技能命中结算、Boss 伤害压缩与死亡处理，并输出完整的战斗流水。

---

## 核心设计要点

### 1. 事件驱动时间轴 (`Timeline`)
引擎采用 **离散事件模拟 (Discrete Event Simulation, DES)** 机制。所有战斗事件按时间先后顺序排序组成队列，引擎从小到大依次消费事件，并在此过程中动态生成新事件。
- **时间精度**：内部统一使用整数毫秒 (`timeMs`)；UI 和报告层再格式化为秒，避免浮点时间排序误差。
- **同毫秒事件顺序**：相同 `timeMs` 下使用稳定自增 `sequence` 作为二级排序键，必要时再按事件优先级处理，例如 `BUFF_EXPIRE` / `BUFF_APPLY` 与 `HIT` 的同刻结算必须在测试中明确。
- **主要事件类型** (`SimEventType`)：
  - `CAST_START`：开始施法。扣减技能层数/触发CD、设置施法锁、调度首段/多段命中事件。
  - `CAST_COMPLETE`：施法动作结束。解除施法锁（如果存在动作后摇等）。
  - `HIT`：伤害命中段。调用伤害公式 `resolveHitDamage`、计算 Buff 加成、对 Boss 扣血并记录到伤害流水中。
  - `BUFF_APPLY`：Buff/Debuff 生效。由 `EffectManager` 判定是否成功挂载，并动态生成属性加成。
  - `BUFF_EXPIRE`：Buff/Debuff 自然过期。验证 `InstanceId` 是否失效，如未失效则撤销属性。
  - `COOLDOWN_READY`：技能 CD 恢复或充能层数 +1。
  - `ACTOR_DECISION`：角色决策点。当角色处于非锁定状态时，触发其出招策略（AI/法宝栏）选择下一个技能施放。
  - `BOSS_DEAD`：Boss 击杀事件。截断所有后续命中，提前宣告仿真结束。

### 2. 状态机与锁定 (`ActorState`)
每个 `Actor`（无论是玩家还是 Boss）都有其实时状态：
- **`CastLockUntil`**：当前施法动作锁定截止时间。在该时间前，玩家无法开始施法新技能（处于施法僵直）。
- **`GCDLockUntil`**：全局冷却截止时间（一般 0.3s - 0.5s）。
- **`SkillCooldowns`**：每个技能的剩余 CD 或充能层数 (`Charges` / `MaxCharges`) 状态。
- **`Buffs`**：当前 Actor 挂载的活性效果列表。

### 3. Buff/Debuff 互斥组与重叠规则 (`EffectManager`)
这是方案中解决 **“同职业/不同职业同类 buff 互斥与覆盖”** 的核心逻辑：
- 采用 **`ExclusiveGroup`** 识别同类效果。
- 策略模式 `ExclusivePolicy`：
  - `HIGHEST_EFFECT_VALUE`：比较 `EffectPower`（如伤害百分比、攻击百分比），只有新 Buff 的 `EffectPower` 大于当前已存在 Buff 的 `EffectPower` 时才覆盖。如果新 Buff 较弱或等强但不是同实例刷新，则直接**忽略**。
  - `MANUAL_PRIORITY`：比较 `Priority` 数值，高优先级顶替低优先级。
  - `NO_OVERWRITE`：只要已有同组 Buff，新 Buff 绝不覆盖，必须等待其过期。
- **防止误删 Bug (Stale Expiry Eviction)**：
  当旧 Buff 被新 Buff 覆盖顶替时，旧 Buff 已经失效，但它先前排队在 `Timeline` 中的 `BUFF_EXPIRE` 事件依然存在。我们通过为每个 Buff 实例分配一个全局唯一的 **`InstanceId` (UUID)**。在执行 `BUFF_EXPIRE` 事件时，若发现事件中的 `InstanceId` 与当前 Actor 身上挂载的该 `EffectId` 的实际 `InstanceId` 不一致，则直接**静默忽略**，避免误删新挂载的强力效果。

### 4. 主输出与辅助出招策略
- **主输出 (DPS) 策略**：
  - `MANUAL_TIMELINE` (手动时间轴)：按绝对时间执行玩家排轴指令；到点技能不可用时，根据场景配置选择跳过、等待到可用或记录失败。
  - `FIXED_ROTATION` (固定循环)：维护循环指针；每次决策从当前位置扫描，释放成功后移动到下一个技能，整轮不可用时进入等待或填充策略。
  - `SKILL_BAR` (法宝/天人模式)：每当 `ACTOR_DECISION` 触发时，自左向右（1-8号位）扫描技能栏。遇到第一个可用（CD已好、能量足够）的技能即施放，并进入 GCD 和施法锁定。若全部在 CD，则等待极短时间（如 0.05s）后再次调度 `ACTOR_DECISION`。
- **辅助职业策略**：
  - `SETUP_PHASE` (起手铺垫)：整场模拟从 `t = 0` 开始，不使用负时间轴。辅助按严格的绝对时间或顺序间隔施放 Buff/Debuff，所有持续时间和 CD 均从实际施放/生效时刻开始计算。
  - `CAST_ON_READY` (好了就放)：一旦 CD 恢复，只要不在施法锁中就自动施放。
  - `TIMESTAMPED_ACTIONS` (绝对时间释放)：按场景配置的时间点投放辅助技能，用于对齐主输出爆发窗口。

### 5. Phase C0 前置整理结论
阶段 C 正式编码前，需要确保工程脚手架可重复验证：旧 CLI 示例入口可运行，`test_b` 使用硬断言，根目录脚本能正确透传参数，`.gitignore` 排除本地依赖与临时 profile。`skills.json` 的辅助职业和主输出技能扩展由数据录入工作继续推进；Phase C 引擎测试应优先使用内联 fixture 或最小场景 JSON，避免阻塞正在录入的真实技能库。

---

## 拟做的代码修改 (Proposed Changes)

### `@zx/simulation-engine` 模块

#### [MODIFY] [types.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/types.ts)
- 引入 `SimEvent`、`SimEventType`、`SimEventLog`、`HitDamageRecord`、`SimulationScenario` 和 `SimulationResult` 结构。

#### [NEW] [timeline.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/timeline.ts)
- 实现毫秒精度、支持二分搜索插入（Binary Search Insertion）的顺序优先队列 `Timeline`。

#### [NEW] [effects.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/effects.ts)
- 实现运行时 `EffectInstance` 包装，提供 `EffectManager` 管理 Buff 的挂载、属性实时增益聚合计算、覆盖顶替算法与实例过期校验。

#### [NEW] [strategies.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/strategies.ts)
- 实现 `MANUAL_TIMELINE`、`FIXED_ROTATION`、`SKILL_BAR` 三种主输出策略，以及 `SETUP_PHASE`、`CAST_ON_READY`、`TIMESTAMPED_ACTIONS` 三种辅助策略。
- 策略层只返回下一步意图，不直接修改 Actor 或 Boss 状态；实际状态变更统一由 `SimulationEngine` 处理，保证事件流水可追踪。

#### [NEW] [combat_loop.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/combat_loop.ts)
- 实现主力协调器 `SimulationEngine`：
  - 初始化：设置 Boss 血量、载入所有 `Actor`、处理 `SETUP_PHASE` 起手事件。
  - 核心 Loop：从小到大消费事件，针对不同事件类型驱动状态更新与新事件调度。
  - 结算器：聚合输出 `HitDamageRecord`、计算 DPS 起点（首段进攻伤害命中时）、计算各项覆盖率与占比。

#### [MODIFY] [actor.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/actor.ts)
- 扩展 `Actor` 类，维护 `CastLockUntil`、`GCDLockUntil`、充能层数等运行时状态。
- 实现 `getCurrentAttributes` 方法：将 BaseAttributes 与当前挂载的所有活性 Buff/Debuff 的 `BuffEffects` 进行动态累加，输出供伤害公式调用的实时属性。

#### [NEW] [test_c.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/test_c.ts)
- 创建完整的单元测试与集成测试，覆盖：
  1. 技能施法锁与 GCD 锁定，验证连续施法不会重叠。
  2. 极速 Haste 施法缩短公式校验。
  3. Buff 互斥组与优先级覆盖：同职业/跨职业 buff 顶替，低强度被忽略，过期 `InstanceId` 误避校验。
  4. 多段技能均匀命中出段。
  5. 手动时间轴、固定循环、法宝栏三种主输出策略输出稳定可复现。
  6. Boss 血量扣减、伤害压缩（DamageCompressionPercent 97%）以及 Boss 死亡提前截断。
  7. CLI 运行 `npm run test:c` 无报错通过。

---

## 验证计划 (Verification Plan)

### 自动化集成测试
- **执行命令**：在项目根目录下运行 `npm run test:c`。
- **校验指标**：
  - 所有 assertion 全通过。
  - 证明离散事件引擎在确定性输入下运行结果 100% 稳定可复现。
  - 模拟产生的伤害值符合之前 `test_b.ts` 及 `agent_tool` 跑出的理论预期。
