# Phase G: 《诛仙3》古典“全息战术沙盘”PC端全面改版 Walkthrough

本阶段我们针对“属性战力计算器”与“副本模拟训练场”两大 Tab 页进行了深度的古典国风化重构。通过双视窗指挥大屏、折叠配置 Tabs、卡片等高平行对齐以及量子待命大屏，让玩家在 PC 宽屏上获得最极致、最沉浸、最直观的战斗沙盘推演体验。

---

## 核心改进点一览

### 1. 副本模拟训练场双视窗战备沙盘重构
- **修改文件**：
  - [SimulationArena.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationArena.tsx)
  - [TeamConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/TeamConfigPanel.tsx)
  - [BossConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/BossConfigPanel.tsx)
  - [StrategyEditor.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/StrategyEditor.tsx)
  - [SimulationReport.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationReport.tsx)
- **改进内容**：
  - **双视窗指挥布局**：在宽屏下一屏排开，左侧为**战战筹备中心**，右侧为**全息指挥投影屏**，符合“左操作、右大屏”的高端指挥大屏逻辑，页面高度极大压缩，再无纵向滚动条。
  - **左侧折叠选项卡配置**：将主角配置 `DpsConfigPanel`、队友配置 `TeamConfigPanel`、释放策略 `StrategyEditor` 及首领配置 `BossConfigPanel` 移除了各自多余的 `zx-card` 外部背景和重叠边框，以折叠选项卡页签的形式无缝收折进大的战前配置容器中。卡片底端常驻仿真和重置按键。
  - **右侧“全息待命与清单简报”**：在未运行仿真前，展示一个纯 CSS 旋转量子核心环，底下提供详细的 **装配清单简报 (Briefing Checklist)**，清晰汇总当前战前就绪度（主角派系、支援队友数、技能排序模式、对抗首领及 starting HP），指引一键开启仿真。
  - **全息大屏四合一**：将折线图内置进 SimulationReport 中，以四个高档选项卡切换折线图、柱状图、回溯沙盘和流水日志，数据流不再在页面中四分五裂。

### 2. 职业卡片与增益卡片等高优化（消除左侧列底空）
- **修改文件**：
  - [ClassSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/ClassSelector.tsx)
  - [BuffSelector.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/BuffSelector.tsx)
- **改进内容**：
  - **ClassSelector**：统一卡片高度限制为 `h-[124px]`，将 padding 调整为 `md:py-4 md:px-6`，缩小了 User 图标尺寸和当前职业文字大小，结合 `flex items-center` 实现完美的垂直方向垂直居中对齐。
  - **BuffSelector**：将每个增益属性卡片的高度限制为 `h-[124px]` 并采用 `justify-center`，在排版上与“职业选择”横向完美平行对齐。
  - **效果**：在电脑大屏下，彻底消除了由于左右内容高度不齐导致的左下角大范围空白突兀感。

### 3. 双Tab全局阵营主题级联与背景水墨
- **修改文件**：[App.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/App.tsx)
- **改进内容**：
  - 在“属性战力计算器”Tab激活时，外层容器根据当前主角的阵营（`XIAN` 仙、`FO` 佛、`MO` 魔）自动赋予页面的 `data-theme` 属性。
  - 配合水墨晕染动画样式 `.zx-ink-bg`，使页面背景在翡翠水墨（仙）、佛光普照（佛）、幽冥魔焰（魔）之间柔和渐变过渡。

### 4. 属性战力计算器全盘古典化
- **修改文件**：
  - [ResultsSection.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/ResultsSection.tsx)
  - [DungeonDetail.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/DungeonDetail.tsx)
  - [AttributePanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/business/AttributePanel.tsx)
- **改进内容**：
  - **总分大看板**：综合评分大字报的玻璃面板替换为 `.zx-card`，并引入主题自适应的光晕，发光大字直接使用主题定义的渐变 and 文本色。
  - **副本分析列表**：卡片全面套用 `.zx-card`，使其具备纯 CSS 祥云折角边饰与 hover 流光扫边动画。
  - **流金操作按钮**：“复制战力数据”按钮直接应用 `.zx-btn`，变为黄金比例流光溢彩的国风按键。

---

## 验证与构建结果

### 1. 自动编译构建
在控制台根目录执行 `npm run check:all`，所有子模块的 TypeScript 类型校验及 Vite 生产包构建全部成功通过：
- **检查项**：
  - `@zx/simulation-engine` 编译成功。
  - `agent_tool` 编译成功。
  - `web_app` 生产包构建成功，生成了无报错 of `dist/` 静态文件夹。

### 2. 手动效果验证
- **计算器视觉**：更换仙、佛、魔阵营时，整个计算器（总分、属性框、副本卡片、按钮）的外饰立刻与背景一起变化，流光溢彩。
- **训练场布局**：PC 宽屏下一屏排布，左操作右投影双视窗，操作顺畅且完全不产生页面纵向滚动。
