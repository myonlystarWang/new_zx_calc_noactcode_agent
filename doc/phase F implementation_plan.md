# Phase F: Web 副本模拟训练场 UI 开发设计方案

本方案旨在开发《诛仙3》副本模拟训练场的可视化前端页面，为玩家提供完整的闭环体验：配置队伍（包含主输出与辅助职业）、编排输出技能策略、选择副本 Boss、一键仿真，并在网页端以图表、时间轴（仅展示主输出与 Boss）和日志的形式查看详细战斗报告，同时支持方案 A/B 对比。

---

## User Review Required

> [!IMPORTANT]
> **常驻技能与部分生效技能的 UI 展示**：
> 页面上录入的 14 个在计算中被禁用或部分启用的技能（如大慈悲、净莲生、金蛇狂舞等），将在队伍配置面板（TeamConfigPanel）中完整列出。每个技能除了展示原生的技能描述外，将使用显目的标签标明其在模拟中的生效状态：
> - **大慈悲、摩柯心经、跗骨生灵、天罡伏魔、五行八卦、鸣泉雅韵、云水雅韵II、净莲生、凤求凰**：标有红色的 `【未启用】` 标签，并备注 “该技能在当前版本中暂不参与伤害加成计算”。
> - **龙战于野、枕戈待旦、清啸横朔、金蛇狂舞、秋声雅韵**：标有黄色的 `【部分启用】` 标签，并备注 “当前计算中仅生效专注与施法速度加成部分，其他属性增益已忽略”。
> - 红色 `【未启用】` 技能仍在页面技能栏展示，供查阅技能描述和后续录入状态；默认团队仿真通过 `skillIds` 白名单和装配器默认过滤排除它们，不参与当前阶段结算。
>
> 0 秒 CD 的常驻技能（如金蛇狂舞等），在模拟逻辑中会被处理为“在 0ms 仅施放一次，且效果持续全场”，避免其在循环中被重复施放，符合实际战斗常驻增益的表现。

> [!TIP]
> **Buff/Debuff 覆盖率时间轴的可视化方案**：
> 经与用户确认，我们仅展示 **主输出角色 (DPS)** 与 **Boss 目标** 身上在各个时间段挂载的 Buff/Debuff 状态。这样既能清晰呈现战斗爆发期和大招重叠期的增益分布，又避免了多 Actor 状态混杂导致的界面拥堵。

---

## Proposed Changes

### 1. 扩展数据模型与数据加载

#### [MODIFY] [types.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/types.ts)
- 在 `Skill` 接口中新增可选字段 `Description?: string`，用于承载展示在 UI 中的完整中文技能描述。

#### [MODIFY] [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json)
- 为以下 14 个技能对象添加中文技能描述字段 `Description`：
  1. `TY_FO_SKILL_DCB` (大慈悲): `"令队友增加22%气血上限，持续时间3600秒，冷却时间0秒（常驻常开）。"`
  2. `TY_FO_SKILL_MKXJ` (摩柯心经): `"令队友增加500,000气血固定值，持续时间25秒，冷却时间180秒（受四代品质和最大攻击力缩放影响）。"`
  3. `ZM_FO_SKILL_FGSL` (跗骨生灵): `"昭冥诅诅技能，对目标施加跗骨生灵状态，增加其受到全队的伤害，冷却时间0秒。"`
  4. `YZ_FO_SKILL_TGFM` (天罡伏魔): `"令全队增加25%攻击力，持续时间600秒，冷却时间0秒（常驻常开）。"`
  5. `YZ_FO_SKILL_WXBG` (五行八卦): `"令全队增加防御力百分比，持续时间600秒，冷却时间0秒（常驻常开）。"`
  6. `TH_FO_SKILL_MQYY` (鸣泉雅韵): `"令队友增加18%攻击力（法宝+1则额外+2%，天华每多5万真气额外+1%），持续时间1800秒，冷却时间12秒。"`
  7. `TH_FO_SKILL_JSKW` (金蛇狂舞): `"令全队增加40%攻击力、60点暴击伤害、23%暴击率（法宝+1则额外+2%）、18点专注（法宝+1则额外+2%），常驻技能（冷却时间0秒）。"`
  8. `TH_FO_SKILL_QSYY` (秋声雅韵): `"令主输出增加19%专注（法宝+1则额外+3%，天华每多5000攻击额外+1，最多+20）；防御力增加天华最大攻击的1.5倍；爆伤每多10万真气额外增加1%，冷却时间80秒。"`
  9. `TH_FO_SKILL_YSYY2` (云水雅韵II): `"令主输出增加最大气血、真气和最大攻击力，持续时间30秒，冷却时间60秒。"`
  10. `TH_FO_SKILL_JLS` (净莲生): `"根据技能等级应用云水雅韵II和秋声雅韵的效果，冷却时间240秒。"`
  11. `TH_FO_SKILL_FQH` (凤求凰): `"令主输出增加暴击伤害，持续时间30秒，冷却时间120秒（受品质及阵营变体影响）。"`
  12. `ZS_XIAN_SKILL_LZYY` / `ZS_MO_SKILL_LZYY` (龙战于野): `"逐霜自身爆发增益，增加15%专注与36%施法速度，持续时间60秒，冷却时间40秒。"`
  13. `ZS_XIAN_SKILL_ZGDD` / `ZS_MO_SKILL_ZGDD` (枕戈待旦): `"逐霜自身爆发增益，增加15%暴击率、75%暴击伤害、20%专注与50%施法速度，持续时间24秒，冷却时间60秒。"`
  14. `ZS_XIAN_SKILL_QXHS` / `ZS_MO_SKILL_QXHS` (清啸横朔): `"逐霜自身爆发增益，增加20%暴击率、100%暴击伤害、25%专注与50%施法速度，持续时间24秒，冷却时间60秒。"`

#### [MODIFY] [DataService.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/services/DataService.ts)
- 暴露 `getAllSkills(): AllSkills` 与 `getDungeonsMonsters(): Record<string, Monster[]>`。

---

### 2. 页面与模式切换集成

#### [MODIFY] [App.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/App.tsx)
- 增加 `activeTab` 状态控制，支持在旧版 `calculator` 属性计算器与全新 `arena` 副本模拟训练场之间自由切换。

#### [MODIFY] [Header.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Header.tsx)
- 在右上角实现优雅的高保真微动 Tab 切换按钮，视觉样式与原有毛玻璃暗调统一。

---

### 3. 开发副本模拟训练场 UI 组件

在 [NEW] `web_app/src/components/arena/` 文件夹下开发以下组件：

#### [NEW] `SimulationArena.tsx` (主仿真控制台)
- 维护仿真的所有全局配置（DPS/辅助属性、策略、Boss 目标）与战斗报告。
- 点击“开始仿真”直接调用 `@zx/simulation-engine` 的 `assembleScenario` 与 `runSimulation` 核心引擎，无需任何后端服务，纯前端秒级仿真得出结果。
- 维护 Baseline A 方案以支持与 B 方案运行结果的直观百分比与图表比对。

#### [NEW] `TeamConfigPanel.tsx` (队伍装配与属性覆盖面板)
- 包含主输出（DPS）和辅助成员列表。
- 支持在辅助职业中添加天音、焚香、天华、英招、昭冥，允许设置其最大气血、真气和最大攻击等核心属性以用于动态 Buff 的增幅计算。
- **展示 14 个限制技能的完整描述**，并使用绿色/黄色/红色标签明确其启用/计算过滤情况。

#### [NEW] `StrategyEditor.tsx` (输出循环策略配置器)
- 允许配置主输出的技能释放优先级。支持：
  - **法宝栏 (SKILL_BAR)** 优先级微调（上下移动技能、加入/移出释放队列）。
  - **固定循环 (FIXED_ROTATION)**，支持直接编辑有序技能列表。
  - **手动时间轴 (MANUAL_TIMELINE)**。

#### [NEW] `BossConfigPanel.tsx` (副本 Boss 与免伤属性覆盖面板)
- 从 dungeons 数据中级联选择副本与 Boss。
- 展示 Boss 免伤防御、暴击减免等固有减益，并支持输入自定义的 HP 上限进行极限斩杀测试。

#### [NEW] `SimulationReport.tsx` (炫酷战斗报告与可视化大屏)
- **通关数据大屏**：击杀时长、总伤害、秒级 DPS、总技能数等毛玻璃卡片展示。
- **伤害占比饼图**：通过 Recharts 绘制直观的技能总伤占比。
- **DPS 与 Boss 血量曲线**：双 Y 轴折线图，支持展示 A/B 双方案曲线对比。
- **精细 Buff 泳道时间轴 (Timeline)**：
  - 横轴为战斗时长。
  - 仅绘制 DPS 角色身上的 Buff（如：龙怒、龙战于野、枕戈待旦、大梵般若等）以及 Boss 身上的 Debuff（如：焦土、日月弘光等）的覆盖区间。
- **战斗精细日志**：支持按秒过滤及类型检索的战斗文字流。

---

## Verification Plan

### Automated Tests
- 执行 `npm run check:all` 验证所有新写的 TSX 与 React 组件没有类型和构建错误。

### Manual Verification
1. 在浏览器中访问本地服务 `npm run web:dev`。
2. 切换到“副本模拟训练场”页面。
3. 主输出选择“逐霜（仙）”，辅助选择“天音（大慈悲、摩柯心经）”和“天华（秋声雅韵）”。
4. 在辅助列表中展开秋声雅韵和大慈悲，验证完整技能描述显示正常，且被标上了正确的【未启用】/【部分启用】状态标签。
5. 策略设置为法宝栏，选择 Boss “赤梭”。
6. 点击“一键启动团队仿真”，确认通关时间大约为 20 秒左右，且图表、泳道图与日志分页展示全部渲染正常。
7. 点击“设为基准方案 A”，微调逐霜属性或辅助面板中的最大攻击力，再次点击仿真，验证 A/B 两版 DPS 曲线与击杀时长差异百分比比对精准无误。
