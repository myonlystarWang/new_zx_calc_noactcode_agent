# Phase G: 《诛仙3》主题全息战术沙盘 PC 改版开发任务清单

- `[x]` **1. 古典低饱和国风样式重构**
  - `[x]` 修改 [index.css](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/index.css)，更新仙/佛/魔的主题 HSL 变量，使其呈现高雅竹青、沉砂古铜、幽黛紫檀风格，废除高饱和霓虹科技色。
  - `[x]` 优化 `.zx-card` 卡片样式的细线金丝 1px 祥云护角，以及 `.zx-btn` 为高档的金丝镂空边框，hover 实心填充。
  - `[x]` 废除全局彩色文本渐变，使用羊脂玉白、竹青等矿物色彩作为主体字色。

- `[x]` **2. 战力计算器“三栏一屏通”重构**
  - `[x]` 修改 [App.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/App.tsx) 容器宽度至 `w-full max-w-[1760px] mx-auto px-4 xl:px-6`，支持计算器 Tab 页左-中-右三栏大格局平铺。
  - `[x]` 新建 [BuffPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/BuffPanel.tsx)，承载 Buff 勾选、雷达图及副本战力说明 Card。
  - `[x]` 修改 [AttributePanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/AttributePanel.tsx) 移出 Buff/雷达，缩减高度为紧凑的左列属性微调栏。
  - `[x]` 修改 [ResultsSection.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/ResultsSection.tsx) 和 [DungeonDetail.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/DungeonDetail.tsx) 去掉渐变色彩，优化卡片 hover 特效，完美适配右列窄版展示。

- `[x]` **3. 副本模拟训练场 RPG HUD 界面重构**
  - `[x]` 修改 [SimulationArena.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationArena.tsx) 为左（主角）、中（主沙盘+策略编辑器）、右（Boss目标+队友框架）大游戏格栅，同样支持 `max-w-[1760px]`。
  - `[x]` 修改 [TeamConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/TeamConfigPanel.tsx) 中的 `DpsConfigPanel`：上部压缩为面板属性修改，下部重构为正方形 **Action Bar（快捷技能网格栏）**，金/青/灰框标识技能启用度。
  - `[x]` 修改 [TeamConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/TeamConfigPanel.tsx) 中的 `TeamConfigPanel`：重构成 5 行紧凑的 **Party Frames（队友小队列表）**，行内展示头像与血条框，点击行内弹出轻量级 Popover 供属性与技能勾选，不拉伸主布局。
  - `[x]` 修改 [BossConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/BossConfigPanel.tsx) 为 Boss 目标框样式（低饱和暗红大血条），并在内部新增 **Boss 模糊搜索过滤框**，支持拼音与中文。
  - `[x]` 重构 [SimulationReport.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationReport.tsx) 到推演主沙盘；将技能柱状图、Buff 覆盖条、事件流水日志并列平铺展示。
  - `[x]` 调整下层结算大屏为 **3 列并排布局**（技能占比柱状图 | Buff 轴 | 中文流水日志），日志与技能占比同屏分列并排。时光回溯滑块回溯时，血条、Buff/Debuff 倒计时及即时伤害数值同步动态回退。

- `[x]` **4. 自动编译构建与验证**
  - `[x]` 运行 `npm run check:all` 确保改动后 100% 编译通过，并生成静态生产资源。
  - `[x]` 验证更换仙/佛/魔各阵营时的水墨调色盘和 PC 零滚轮体验。
  - `[x]` 撰写 Phase G walkthrough 文档。
