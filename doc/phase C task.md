# 诛仙3团队副本模拟训练场 — Phase C 任务跟踪清单

## [x] C-1：补充离散事件模拟类型

- `[x]` 在 `@zx/simulation-engine` 中补充 `SimEventType`、`SimEvent`、`SimEventLog`。
- `[x]` 补充 `HitDamageRecord`、`SimulationScenario`、`SimulationResult`、`SimulationSummary`。
- `[x]` 补充 DPS 与辅助策略配置类型：`MANUAL_TIMELINE`、`FIXED_ROTATION`、`SKILL_BAR`、`SETUP_PHASE`、`CAST_ON_READY`、`TIMESTAMPED_ACTIONS`。

## [x] C-2：实现 Timeline 优先队列

- `[x]` 新增 `timeline.ts`。
- `[x]` 内部统一使用整数毫秒 `timeMs`。
- `[x]` 支持同毫秒事件优先级和稳定 `sequence` 排序。
- `[x]` 确保同刻 `BUFF_EXPIRE` 早于 `BUFF_APPLY` 和 `HIT`。

## [x] C-3：实现 EffectManager

- `[x]` 新增 `effects.ts`。
- `[x]` 实现 `EffectInstance` 与实例级 `InstanceId`。
- `[x]` 支持效果挂载、自然过期、刷新、叠加、互斥组覆盖。
- `[x]` 支持 `HIGHEST_EFFECT_VALUE`、`MANUAL_PRIORITY`、`NO_OVERWRITE`。
- `[x]` 旧过期事件不会误删后续新状态。

## [x] C-4：扩展 Actor 运行时状态

- `[x]` 扩展 `actor.ts`，保留原有 Profile 覆盖构造方式。
- `[x]` 增加 `CastLockUntilMs`、`GCDLockUntilMs`、`SkillStates`。
- `[x]` 支持技能 CD、充能扣减、充能恢复、刷新充能、减少 CD。
- `[x]` 增加 `getCurrentAttributes`，用于按活性效果聚合实时角色属性。

## [x] C-5：实现策略层

- `[x]` 新增 `strategies.ts`。
- `[x]` 实现手动时间轴由绝对时间调度。
- `[x]` 实现固定技能循环指针扫描。
- `[x]` 实现法宝栏/天人模式扫描，并支持 `FROM_FIRST_EACH_DECISION` 与 `CONTINUE_POINTER`。
- `[x]` 实现辅助自动好了就放的技能选择。

## [x] C-6：实现 SimulationEngine 主循环

- `[x]` 新增 `combat_loop.ts`。
- `[x]` 初始化 Boss 血量、Actor、目标 EffectManager 和初始事件。
- `[x]` 处理 `CAST_START`、`CAST_COMPLETE`、`HIT`、`BUFF_APPLY`、`BUFF_EXPIRE`、`COOLDOWN_READY`、`PHASE_TRANSITION`、`ACTOR_DECISION`、`BOSS_DEAD`。
- `[x]` 技能进入 `CAST_START` 时立即消耗充能并启动 CD。
- `[x]` 多段技能按 `HitTiming` 生成逐段 `HIT`。
- `[x]` 每段 `HIT` 生成 `HitDamageRecord`。
- `[x]` Boss 血量归零后生成 `BOSS_DEAD` 并截断后续模拟。
- `[x]` 缺失 Boss 血量时明确抛错，不静默模拟。
- `[x]` 支持 Boss `DamageCompressionPercent` 伤害压缩。
- `[x]` 支持自动多阶段状态流转。

## [x] C-7：导出共享引擎入口

- `[x]` 在 `index.ts` 导出 `timeline`、`effects`、`strategies`、`combat_loop`。

## [x] C-8：自动化测试

- `[x]` 新增 `test_c.ts`。
- `[x]` 新增根目录 `npm run test:c`。
- `[x]` 覆盖 Timeline 同毫秒优先级。
- `[x]` 覆盖 Buff/Debuff 互斥覆盖与旧过期事件。
- `[x]` 覆盖手动时间轴、多段命中和 Buff 过期卡段。
- `[x]` 覆盖固定循环、法宝栏策略、Boss 死亡截断。
- `[x]` 覆盖伤害压缩、充能恢复、刷新充能、自动多阶段状态。
- `[x]` 覆盖四代动态缩放字段参与运行时结算。
- `[x]` 覆盖缺失 Boss 血量明确报错。

## [x] C-9：回归验证

- `[x]` `npm run test:c`
- `[x]` `npm run test:b`
- `[x]` `npm run agent:test:example`
- `[x]` `npm run check:all`

## [x] C-10：Phase D 交接准备

- `[x]` 明确 Phase D 入口应在 `agent_tool` 新增模拟 CLI，例如 `agent_tool/src/sim_cli.ts`。
- `[x]` 明确 Phase D 应复用 `@zx/simulation-engine` 导出的 `runSimulation`、`SimulationScenario`、`SimulationResult`。
- `[x]` 明确 Phase D 的 CLI 输出应包含 resolved 配置、事件流水、逐段伤害流水、Boss 击杀时间、主输出 DPS 起点、技能占比、Buff/Debuff 覆盖率。
- `[x]` 明确 Phase D 不能破坏旧 `agent_tool/src/cli.ts` 单技能计算入口。

## [x] C-11：四代动态缩放与 validator bugfix

- `[x]` 新增 `field_keys.ts`，集中维护 `CharacterAttributes` 与 `BuffEffects` 可引用字段白名单。
- `[x]` 在 `BUFF_APPLY` 时解析 `DynamicScalingAttribute`、`DynamicScalingMultiplier`、`DynamicTargetField`，把动态值写入真实 `BuffEffects`。
- `[x]` 动态缩放使用来源 Actor 的实时属性；缺少来源属性或动态字段非法时生成失败事件。
- `[x]` 补齐固定气血、固定真气、固定防御和怪物增伤 Buff 在伤害公式中的读取路径。
- `[x]` Boss 侧当前仅把怪物易伤/怪物爆伤字段传入伤害结算，避免“天舞宝轮破防”在 Boss 防御系统完成前被误解释为玩家防御变化。
- `[x]` `FourthGenPresets` 类型改为可选品质映射，允许只声明单个四代品质预设。
- `[x]` validator 覆盖四代品质键、四代效果覆盖引用、动态字段三元组、`BuffEffects` 字段名和值类型。
- `[x]` `test_b.ts` 增加四代/动态字段反例校验。
- `[x]` `test_c.ts` 增加四代动态气血加成影响伤害结算的回归用例。

## 边界说明

- Phase C 当前实现了多阶段技能的自动流转；“手动提前激活下一阶段”可在后续基于 `PHASE_TRANSITION` 事件增加专门的手动触发入口。
- Phase C 测试使用内联 fixture，不依赖你正在录入的真实 `skills.json` 数据。
- 旧静态单技能计算入口仍走 `calculateDamage`，没有被 Boss 伤害压缩逻辑影响。
- `无量真言` 与 `无量真言·禅` 的 15% 易伤效果可以同时生效；本轮不改 `skills.json`，后续数据层不应仅因同为 15% 自动设为互斥。
- `天舞宝轮破防` 暂不接入伤害结算；等 Phase 后续补 Boss 防御属性与破防公式后，再处理多个辅助职业破防叠加/覆盖。
