# Phase G: 《诛仙3》古典“全息战术沙盘”界面重构设计方案

为了让本系统在 PC 宽屏下达到极致的视觉与操作体验，并跳出平庸、俗气的霓虹科技风，我们将对**属性战力计算器**与**副本模拟训练场**进行彻底的重构。本方案采用低饱和国风调色盘，解锁全屏宽度，并在 PC 端实现“零纵向滚动”的游戏界面化布局，全新设计了副本模拟训练场的双视窗战术指挥排版。

---

## 针对用户新增需求的方案响应

> [!IMPORTANT]
> **1. 双视窗战前筹备与全息投影大屏（PC 宽屏一屏通）**
> - **重构前**：平铺混乱的三栏大网格排版，页面从上到下非常拉长，玩家需要在主角、队友、首领配置间频繁上下滚动，且高度不齐，左侧底部常出现巨大留白。
> - **重构后**：重构为 **左侧战前筹备中心 (Setup Control Center)** 与 **右侧全息指挥大屏 (Holographic Simulation HUD)** 的左右黄金比例分栏。

> [!IMPORTANT]
> **2. 左侧折叠页签化配置面板**
> - 整合了主角属性 `DpsConfigPanel`、队友协同 `TeamConfigPanel`、技能循环 `StrategyEditor` 与首领战场 `BossConfigPanel` 四个组件，收纳在一个高档卡片的大 Tabs 选项卡下（角色 👤、队友 👥、策略 ⚙️、首领 👹）。
> - 移除了四个子组件各自多余的 `zx-card` 外部背景和边框，避免多重嵌套框线，使其完美融入战前筹备容器中。
> - 卡片底端常驻微发光的“启动全息推演仿真”主按键与“重置沙盘”按钮，在任何配置页签都可以一键触发展开推演。

> [!IMPORTANT]
> **3. 右侧“全息待命与清单简报”设计 (Standby HUD)**
> - 在未运行模拟或正在运行模拟时，右侧投影屏展示高度游戏化的 **待命面板**：
>   - 正中央为纯 CSS 自转的“量子核心环”自转粒子云，悬浮“Standby”发光指示。
>   - 环下投射一份清晰的 **仿真筹备清单摘要 (Briefing Checklist)**，清晰核对当前已就绪的：主角流派（仙/魔系及品质）、战术协同（已上阵队友数）、技能序列策略模式、首领目标与 starting HP。
>   - 指引点击“激活推演矩阵”按键，开启战斗推演。

> [!IMPORTANT]
> **4. 筹备与增益卡片等高对齐设计**
> - 针对左侧职业选择触发面板因内边距（p-6）和 User 大图标（w-8）撑高导致的排版错落，我们对 [ClassSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/ClassSelector.tsx) 与 [BuffSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/BuffSelector.tsx) 进行了**高度与间距统一**。
> - 统一两者的卡片高度限制为 `h-[124px]`，微调减小了职业选择大图标及职业字号，采用 `flex items-center` 垂直方向完美居中对齐，消除了左侧底部的突兀留白。

---

## 视觉与主题色彩设计

- **仙（XIAN） - 青鸾竹影**：竹青色（`#5c8a75`）、淡青玉色（`#5897a8`）配合羊脂玉白（`#f1f5f3`），卡片底色为深黛绿（`rgba(13, 20, 18, 0.85)`）。
- **佛 (FO) - 古铜沉砂**：沉砂古铜金（`#a3855c`）、淡琥珀金（`#c5a67c`）配合暖白（`#f7f5f2`），卡片底色为玄木檀黑（`rgba(20, 18, 15, 0.85)`）。
- **魔 (MO) - 幽黛魔焰**：偏暗的紫檀红（`#8a4f6e`）、铁锈暗红（`#b55151`）配合粉黛白（`#fcf1f5`），卡片底色为冷玄铁黑（`rgba(20, 13, 17, 0.88)`）。
- **金边镂空按钮**：`.zx-btn` 抛弃刺眼的霓虹渐变，改为细腻精致的金丝/银丝镂空框。Hover 时平滑填充为实色主题色，呈现白玉雕琢字迹。

---

## 待修改/新建文件及改动设计

### 1. 配色与古典样式
#### [MODIFY] [index.css](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/index.css)
- 覆盖定义三阵营的低饱和 HSL 配色方案。
- 升级 `.zx-card` 和 `.zx-btn` 样式，实现精细镂空描金与 hover 缓动。

### 2. 战力计算器与卡片等高优化
#### [MODIFY] [App.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/App.tsx)
- 解放 Tab 容器宽度至 `w-full max-w-[1760px] mx-auto px-4 xl:px-6`。
- 将计算器拆分为左（AttributePanel）、中（BuffPanel）、右（ResultsSection）三栏平铺，实现一屏看齐。
#### [MODIFY] [ClassSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/ClassSelector.tsx)
- 统一卡片高度为 `h-[124px]`，改用 `md:py-4 md:px-6`，缩小 User 图标及职业字体大小，使用 `flex items-center` 垂直居中。
#### [MODIFY] [BuffSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/BuffSelector.tsx)
- 统一单个增益卡片高度为 `h-[124px]`，并加上 `justify-center`，使其与“职业选择”在排版上完全平行对齐，彻底消除左侧列底部的留余空白。

### 3. 模拟训练场重构为双视窗战备沙盘
#### [MODIFY] [SimulationArena.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationArena.tsx)
- 重构主布局为 `grid grid-cols-1 xl:grid-cols-12 gap-6 items-start` 黄金双视窗：
  - **左侧筹备中心**：Tabs 选项卡挂载主角、队友、策略及首领。底端常驻仿真与重置大按键。
  - **右侧全息指挥屏**：空闲展示自转量子核心环与 briefing 战筹清单；仿真结束展示 `SimulationReport` 聚合大屏。
- 剥离折线图外部组件，交由 `SimulationReport` 统一在右侧大屏中以页签形式挂载与切换。
#### [MODIFY] [TeamConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/TeamConfigPanel.tsx)
- 去除 `DpsConfigPanel` 与 `TeamConfigPanel` 最外层的 `zx-card` 结构。
#### [MODIFY] [StrategyEditor.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/StrategyEditor.tsx)
- 去除组件最外层卡片背景及 glow 元素。
#### [MODIFY] [BossConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/BossConfigPanel.tsx)
- 去除组件最外层卡片背景及 glow 元素。
#### [MODIFY] [SimulationReport.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationReport.tsx)
- 重新设计为“四合一页签报告大屏”，将秒伤折线图内置入 Tab 中；精炼战斗日志只拉取 25 条里程碑，提供搜索与过滤。
