# Phase H 默认属性收口与昭冥技能 Bug 修复进度报告

为了简化对各职业法宝等默认配置的管理，并解决昭冥辅助在模拟联调时发现的一系列阻碍问题，本项目在 Phase H 阶段开展了统一收口配置重构与昭冥关键逻辑漏洞的修复工作。

---

## 1. 默认属性与技能覆盖收口重构
### 目标与现状
在重构前，主输出的属性参数、起手延迟、四代曦日品质以及各辅助职业的默认法宝/等级覆盖分散在网页 UI（`SimulationArena.tsx`）和多个核心诊断/测试脚本（`diagnose_phase_h.ts`, `print_timeline.ts` 等）中。如果需要修改，需要同时修改多处，极易发生不一致。

### 重构成果
- **新建收口配置文件**：创建了 `web_app/public/game_data/default_overrides.json`，集中管理逐霜 DPS 的起手延迟、基础属性、品质，以及慈航、金蛇、秋声、背水、停云凝风等辅助技能的默认法宝+1或四代配置。
- **网页 UI 适配**：重构了 `SimulationArena.tsx` 初始化钩子，通过静态引入配置，消除了所有硬编码参数。
- **诊断/测试脚本适配**：重构了 `diagnose_phase_h.ts` 等 4 个脚本，统一使用 `default_overrides.json` 作为唯一源，确保了 CLI 诊断环境与 Web 端数值结果完全保持一致。

---

## 2. 昭冥技能逻辑修复

### Bug 1：停云凝风延长 Buff 网页未展示
- **成因**：停云凝风在运行时确实将 Buff 实例的 `EndTimeMs` 延长了 14s。但由于该历史事件在 timeline 里已以 `BUFF_APPLY` 的形式记录并在前端渲染，且没有发生新的更新事件，网页在还原历史状态时因判定 `endTimeMs <= currentTimeMs` 而将已延长的 Buff 隐藏，造成“没有生效”的视觉假象。
- **修复**：重构了 `applyBuffDurationExtensions`。当 Buff 被延长时，不再修改历史事件，而是直接向 `this.events` 列表中投递 `BUFF_EXTEND` 状态事件（在停云凝风释放的 8.0s 触发）。网页 UI 对该事件进行处理，在 8.0s 之后才动态把活跃效果的结束时间调大，从而保证了 8.0s 之前 Buff 维持原本正常的持续时间，而在 8.0s 之后才发生视觉与数值的延长。

### Bug 2：日月弘光 1 段与 2 段共存
- **成因**：在 15s 手动或自动由 1 段转换至 2 段时，底层逻辑确实注销了 1 段，并产生了 `BUFF_EXPIRE` 事件。但生成的事件 Payload 中缺失了 `instanceId` 和 `effectId`，使得前端网页 UI 遍历到该事件时无法定位到具体实例而未能执行 `delete`，导致 1、2 段在视觉上重叠（直到 30s 初始过期点到达时才注销）。
- **修复**：在 `handlePhaseTransition` 产生的 `BUFF_EXPIRE` 事件中补全了 `instanceId` 和 `effectId`。

### Bug 3：日月 CD 时间就绪机制与基础 CD 修正
- **成因**：原引擎中，日月的 CD 在 1 段施放时即把 `1段+2段总持续时间` 加进了 CD 延迟，并在 1 段施放时就开始计时。且业务上日月在 1 段释放时技能不进 CD，只有释放 2 段时才开始 CD 计时。
- **修复**：
  1. 在 1 段释放（`beginCast`）时，将日月弘光状态设为 `Number.POSITIVE_INFINITY`，不在此刻排期就绪事件。
  2. 当自动或手动进入 2 段（`PHASE_TRANSITION` 且 `phaseIndex === 2`）的瞬间，读取 `skill.Cooldown` 并在此时正式走 35s 的 CD 计时，往 timeline 中追加排期 `COOLDOWN_READY`。
  3. 根据批注，日月弘光的基础 CD 维持原设定的 **35秒** 不变，不修改为 28s。

## 3. 前端 UI 对新事件的支持与最终构建
- **事件处理扩展 (SimulationArena.tsx)**：
  - 在 `buildActiveEffectViews` 中增加了对 `'BUFF_EXTEND'` 类型事件的处理：只要遍历到该事件，就获取已有 Buff 并将其 `endTimeMs` 变更为 `newEndTimeMs`，同时**更新 `remainingMs` 为 `Math.max(0, newEndTimeMs - currentTimeMs)`**，以解决进度条不显示延长的 Bug。
  - **移除提前过期过滤**：原先的 `BUFF_APPLY` 逻辑中，如果 `appliedEndTimeMs <= currentTimeMs` 则直接 `return` 忽略。由于存在后续的 `BUFF_EXTEND` 延长，我们在 `BUFF_APPLY` 时**去掉了该提前过滤判定**，统一在最后的 `filter` 列表返回时再根据 `remainingMs > 0` 过滤，确保了历史 Buff 能够被 8s 处的 `BUFF_EXTEND` 成功检索到并延长。
- **报表回溯沙盘支持 (SimulationReport.tsx)**：
  - 在 `swimlanes` 状态视图的解析中补全了对 `BUFF_EXTEND` 的分支处理。遍历到此事件时，同样将对应实例的 `end` 终点更新为 `newEndTimeMs`，使 A/B 方案对比的沙盘和 Buff 持续时间统计获得正确的值。
- **编译构建**：在完成引擎代码（TS）与前端页面（TSX）修改后，重新执行了打包构建 `npm --workspace=@zx/simulation-engine run build`，使最新的仿真库与前端应用成功编译部署。
