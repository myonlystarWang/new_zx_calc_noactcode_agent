# Phase F: 诛仙3副本模拟训练场 UI/UX 交互优化开发任务清单

- `[x]` **1. 技能配置面板磁贴重构与悬浮 Tooltip 实现**
  - `[x]` 在 [TeamConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/TeamConfigPanel.tsx) 中重构辅助技能和主输出特殊技能区域为 Badge 样式。
  - `[x]` 实现 Hover 绑定 Portal Tooltip，浮窗采用毛玻璃特效，解决 `overflow-y-auto` 截断问题。
- `[x]` **2. 最终结果大屏“时光回溯器”播放时间轴开发**
  - `[x]` 在 [SimulationReport.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationReport.tsx) 顶部引入播放轴，含滑块、播放、倍率及单步前进/后退。
  - `[x]` 联动计算 `currentTimeMs` 时刻主角累计伤害、Boss 剩余血量，以及二人激活 Buff/Debuff（含倒计时）。
  - `[x]` 将折线图与播放点联动，用垂线（ReferenceLine）标出当前时刻。
- `[x]` **3. Recharts 图表数据量化与千分位/汉化**
  - `[x]` 配置 Recharts 折线图与柱状图 Y 轴、Tooltip 数据格式为“万/亿”汉化。
- `[x]` **4. 战斗日志流水线中英汉化与伤害计算呈现**
  - `[x]` 开发 `translateLogEvent` 中文解析器，将 CAST_START、HIT 等动作翻译为直观的中文流水日志。
- `[x]` **5. 编译与前端效果验证**
  - `[x]` 运行 `npm run check:all` 或 `npm run web:build` 验证没有 TypeScript 或构建错误。
