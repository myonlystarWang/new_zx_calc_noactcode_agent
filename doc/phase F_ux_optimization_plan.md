# Phase F: 诛仙3副本模拟训练场 UI/UX 交互体验深度优化设计方案

针对普通玩家在使用计算器与模拟器时遇到的难点（技能描述冗余、日志混合英文代码、大额数字难以阅读、Buff 覆盖无法回溯、数据流堆积臃肿等），本项目将对模拟结果页面和配置面板进行深度的交互体验重构，并统一专业术语命名。

## 用户评审要点

> [!IMPORTANT]
> **1. 技能面板磁贴化与 Tooltip 悬浮化**
> - **重构前**：全平铺的 14 个核心辅助技能说明文字，大幅拉长页面，导致玩家必须频繁滚动。
> - **重构后**：收缩为紧凑的 Flex 磁贴（Badge Style）。使用绿色、黄色、红色小圆点清晰区分其启用状态。
> - **Hover 效果**：鼠标悬停在磁贴上，基于 React Portal 将半透明毛玻璃 Tooltip 直接挂载在 `document.body` 顶层，彻底杜绝因为父级滚动容器（`overflow-y-auto`）引发的截断问题。

> [!IMPORTANT]
> **2. 引入“时空回溯页签化大屏” (Simulation Report Tabs)**
> - **页签划分**：将原本堆叠庞杂的折线图、柱状图、回溯滑块、覆盖率、日志全部收纳在右侧大屏的四个高档选项卡下：
>   - **⚔️ 秒伤血线曲线**：渲染实时战斗秒级 DPS 与 Boss 状态曲线 Recharts 折线图。
>   - **📊 输出技能占比**：渲染各输出技能伤害占比 Recharts 柱状图。
>   - **⏱️ 时空回溯沙盘**：时光回溯机 (Scrubber)、Buff/Debuff 物理覆盖率 timeline、主角及首领活性 Buff/Debuff 精确倒计时卡片。
>   - **📜 全息战报流水**：纯中文战斗流水日志。
> - **时空回溯**：回溯展示该毫秒时刻主角的累计伤害、激活中的 Buff/Debuff 列表及其精确剩余秒数倒计时。
> - **图表联动**：在 Recharts 折线图中引入动态 ReferenceLine（垂直参考线），指示当前播放点在时间轴上的对应位置。

> [!IMPORTANT]
> **3. 消除“数据泥石流”与日志 Ticker 精简**
> - 战斗流水日志默认仅拉取最新的 25 条阶段高亮里程碑，屏蔽冗长琐碎的事件流，底端提供“查看全部详细日志”的折叠开关，避免在大日志下引发页面卡顿。

> [!IMPORTANT]
> **4. 统一更名“怪物受到伤害”为【易伤】**
> - 为了让游戏战力系统的属性称呼更贴近玩家习惯，将核心战斗 Buff `BUFF_MON_HARMED_EFFECT` 的名字以及所有关联文案统一更改为【易伤】（上限 120）。
> - 涉及代码映射（`normalize.ts`）、配置数据（`combat_buffs.json`、`skills.json`）、示例（`simulation_minimal.json`）、页面组件（`BuffSelector.tsx`）及相关文档设计方案的同步修改。

## 待修改文件及具体设计

### 1. 团队装配与主输出配置面板优化
#### [MODIFY] [TeamConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/TeamConfigPanel.tsx)
- 重构 `renderSupportSkills` 与主输出特殊技能区域，移除大段文字描述，以极简磁贴 Badge 形式排布技能。
- 引入 Portal 浮窗 `tooltip` 状态和 `createPortal` 逻辑。

### 2. 模拟报告大屏、图表量化与时光回溯器
#### [MODIFY] [SimulationReport.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationReport.tsx)
- **回溯逻辑**：
  - 定义 `currentTimeMs`（播放时间）和播放循环 `useEffect` 定时器。
  - 通过过滤在 `currentTimeMs` 之前的 `hitRecords` 计算出此时累积总伤、Boss 剩余血量。
  - 从 `swimlanes` 中过滤出覆盖了 `currentTimeMs` 时间段的区间，作为激活 Buff/Debuff。其剩余时长为 `(interval.end - currentTimeMs) / 1000` 秒。
- **数据量化**：
  - 封装 `formatLargeNumber`（支持“万”和“亿”转换），并作为 Recharts 的 `tickFormatter` 及 Tooltip 的 formatter 传入。
- **中文日志解析器 (`formatEventToChinese`)**：
  - 新增翻译函数，将 CAST_START、HIT、BUFF_APPLY 等所有后台英文代码事件翻译成了流利的纯中文动作。

### 3. 全局“怪物受到伤害”字段汉化重命名
#### [MODIFY] [combat_buffs.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/combat_buffs.json)
- 将 `BuffName` 从 `"怪物受到伤害"` 修改为 `"易伤"`。
#### [MODIFY] [normalize.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/agent_tool/src/normalize.ts)
- 将 `monsterDamageTaken` 别名映射修改为 `"易伤"`。
#### [MODIFY] [BuffSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/BuffSelector.tsx)
- 修改动态数值描述，将 `"怪物受伤"` 替换为 `"易伤"`。

## 验证与发布方案

### 自动化验证
- 运行 `npm run check:all` 确保前端构建正常，无 TS 及 Lint 错误。

### 手动交互测试
- 启动本地开发服务，在“副本模拟训练场”中配置角色，并悬浮 hover 各种技能 Badge，验证 Portal Tooltip 的毛玻璃悬停效果。
- 运行仿真，在生成的结果页签中，使用滑块和播放按钮回溯整场战斗，比对实时数据变动。
- 确认系统所有“怪物受到伤害/受伤”均已变更为“易伤”。
