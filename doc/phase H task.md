# Phase H Task: 副本模拟训练场 UI/UX 重设计实现

## 目标

将【副本模拟训练场】从配置表单页重构为 PC 优先的“战斗中复盘 cockpit”：左侧六人队伍、中间 Boss 战场、右侧上下文入口、底部常驻回放时间轴，配置、资料查询与分析均通过抽屉展开。

## 已完成

- `[x]` 重构 `web_app/src/components/arena/SimulationArena.tsx`：
  - 三段战斗 HUD：六人队伍框、Boss 战场、上下文入口、底部时间轴。
  - 新增 `activeDrawer`、`selectedEntity`、`isResultStale`、`searchQuery` 等 Arena 层状态。
  - 点击队伍槽、Boss、技能、资料查询、时间轴节点打开对应抽屉。
  - 资料查询支持中文名、JSON ID、手工维护的常用拼音别名。
  - 暂禁用/部分启用/参与结算技能有明确状态标记。
  - 配置变更后只标记结果过期，不自动重新仿真。

- `[x]` 调整 `web_app/src/App.tsx`：
  - 训练场页使用固定一屏容器。
  - 训练场页隐藏 Footer，避免破坏 cockpit 首屏。
  - 计算器页保持原有布局。

- `[x]` 调整 `web_app/src/components/arena/SimulationReport.tsx`：
  - 清理旧的“量子/全息”等可见 UI 文案。

- `[x]` 新增 `web_app/public/arena/arena-bg.svg`：
  - 原创抽象暗色副本战场背景。
  - 不使用官方游戏素材。

- `[x]` Phase H follow-up 修补：
  - 提高 `arena-bg.svg` 与 Boss 战场背景可见度，降低遮罩强度。
  - 收紧 Boss 战场高度约束，避免底部指标卡被裁切。
  - 将主战场“最新命中”替换为技能总伤害/占比榜与角色秒伤榜。
  - 将“平均 DPS”改为随 `currentTimeMs` 变化的当前均秒。
  - 重设计主输出、队伍与技能、Boss 与副本三个抽屉，统一为训练场 cockpit 风格。
  - 队伍抽屉新增辅助技能四代品质、法宝+1（`SkillLevel=1`）与凤求凰 variant 配置入口。
  - 底部时间轴右侧改为“所有事件点”，移除重复技能栏，并补充蓝色标题与颜色图例。
  - 技能详情、时间轴节点和事件标题增加中文化展示，减少直接暴露英文事件名/字段名。
  - 移除计算器卡片 hover 时出现的角标装饰，保留轻量边框/阴影反馈。
  - “所有事件点”暂时隐藏死亡点轨道与死亡点节点。
  - 回放终点改为取 summary、Boss 击杀点、最后事件、最后命中的最大时间，避免 18.66s summary 截断导致 Boss 血量和击杀状态显示错误。
  - Boss 战场新增主输出增益与 Boss 减益 HUD，随 `currentTimeMs` 展示专注、巫咒、易伤、绿点、紫点、破防等当前数值和剩余时间。
  - 技能类型与命中事件详情继续中文化，减少配置/日志中直接出现英文枚举或效果实例 ID。

- `[x]` 关联修补：
  - `DungeonDetail.tsx` 的副本伤害详情仅展示输出技能，过滤 `ActionType` 非 `DAMAGE` 的 Buff/Debuff/Utility 技能。
  - 用户可见项目名从“诛仙3副本战力计算器”改为“诛仙3副本战斗实验室”。

## 验收

- `[x]` `npm run check:all`
- `[x]` `npm run test:f`
- `[x]` `npm --workspace=web_app run build`
- `[x]` 默认场景回放时长校验：summary 为 18.66s，实际击杀点与最后命中为 22.126s，UI 使用 22.126s 作为回放终点。
- `[x]` Browser 1440x900 验证：页面级滚动差值为 0。
- `[x]` Browser 验证：首屏包含六人队伍、Boss 战场、上下文入口、回放时间轴。
- `[x]` Browser 验证：`chisu` 可搜到赤梭与 `CHI_SUO_T21`。
- `[x]` Browser 验证：`fgsl` 可搜到跗骨生灵，并显示未启用/不参与默认仿真结算。
- `[x]` Browser 验证：启动仿真后修改 Boss 血量，结果标记已过期且不会自动重跑。
- `[x]` Browser 验证：队友槽与时间轴节点可打开对应抽屉。
- `[ ]` follow-up 视觉复测：用户已关闭 Browser 功能，本轮仅做构建与代码级验证。

## 后续接续点

- 12 人训练场仍只预留扩展点，本阶段不实现。
- 移动端只做基础可用，不作为 Phase H 核心验收目标。
- 详细分析抽屉继续复用 `SimulationReport`，后续可再单独做 Phase I 的分析抽屉精简与图表分层优化。
