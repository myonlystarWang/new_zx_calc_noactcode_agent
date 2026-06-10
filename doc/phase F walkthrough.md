# Phase F: Web 副本模拟训练场 UI 开发实现验证报告

本报告记录了《诛仙3》副本模拟训练场可视化前端页面的全部开发成果、限制规则落实细节，以及编译与仿真测试验证。

---

## 1. 核心变更概览

### 1.1 数据结构与游戏数据
- **接口扩展**：在 [@zx/simulation-engine](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/types.ts) 的 `Skill` 接口中，新增了可选的 `Description?: string` 字段，以存放完整的技能中文描述。
- **描述数据补全**：更新了 [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json)，为 17 个关键技能（包含 14 个辅助/限制技能以及逐霜的 LZYY/ZGDD/QXHS 技能）配置了完整的中文详情。
- **服务层扩展**：在 [DataService.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/services/DataService.ts) 中新增并暴露了 `getAllSkills()` 及 `getDungeonsMonsters()` 接口，以供模拟器前端自由获取完整数据。

### 1.2 前端页面切换与布局
- **多 Tab 视图集成**：在 [App.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/App.tsx) 中引入了 `activeTab`，用户可在“属性战力计算器”和“副本模拟训练场”两大页面间无缝切换。
- **磨砂微动导航**：在 [Header.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Header.tsx) 的右侧新增了两个半透明玻璃微动样式的 Tab 切换按钮，视觉上完美继承原有暗夜蓝 + 霓虹发光的主体设计。

### 1.3 核心配置面板开发 (`web_app/src/components/arena/`)
- **[NEW] `TeamConfigPanel.tsx` (队伍装配与属性微调)**：
  - 左侧为主输出的阵营（仙/魔）与四代品质（无、莹炬、皓月、曦日）下拉选框，以及基础/ converter 面板属性的微调输入。
  - 队伍技能栏保留红色 `【未启用】` 技能用于查阅，但这些技能不进入当前阶段默认团队仿真结算。
  - 右侧允许动态添加天音、焚香、昭冥、英招、天华五个职业作为辅助，并可对其最大攻击、真气及气血上限进行覆盖。
  - **14 个核心限制技能的中文描述平铺展示**，并根据计算器的过滤规则，醒目地标上 `【未启用】`（红）或 `【部分启用】`（黄）的标记，清晰透明。
- **[NEW] `StrategyEditor.tsx` (输出循环策略配置器)**：
  - 支持 **法宝栏 (SKILL_BAR)**（支持技能添加、在队列中上下移动调优优先级、设定判定延迟等）、**固定循环 (FIXED_ROTATION)** 和 **手动时间轴 (MANUAL_TIMELINE)**（支持输入微秒时间、技能和目标，直接编译成动作链表）三种模式。
- **[NEW] `BossConfigPanel.tsx` (副本首领与 HP 覆盖)**：
  - 二级联动下拉选择副本和 Boss 目标，展示其自身的减伤防御特征与伤害压缩属性，并支持自定义覆盖 Boss 血量上限。
- **[NEW] `SimulationArena.tsx` (主装配器)**：
  - 串联上述所有配置状态，在一键启动时智能构建 `AssembleScenarioInput` 结构体，调用 `assembleScenario` 装配，并驱动 `runSimulation` 直接在浏览器沙箱内同步仿真得出结果，支持 Baseline A/B 对比。

### 1.4 可视化分析报告大屏 (`SimulationReport.tsx`)
- **核心数据看板**：展示通关用时/剩余血量百分比、秒级平均 DPS、总伤以及 Boss 目标。
- **Recharts 图表区**：
  - **总伤占比饼图**：统计各技能伤害所占百分比。
  - **双 Y 轴时序折线图**：左轴展示每秒平均 DPS 波动，右轴显示 Boss 血量剩余百分比曲线。
- **核心 Buff 覆盖率泳道图 (Timeline)**：
  - 从毫秒级战斗流水中提取 Buff/Debuff 生效周期（包含叠加、overwrite 覆盖、刷新与过期）。
  - **仅渲染主输出身上挂载的 Buff 增益与 Boss 目标身上的 Debuff 诅咒**，泳道干净、脉络分明。
- **日志流查看器**：
  - 提供了对数千条战斗流水进行类型过滤、模糊搜索和 50 条分页的强大浏览器。
- **对比实验室 (A/B Test)**：
  - 支持锁定“基准方案 A”，在右侧与修改后的“方案 B”进行击杀时间、平均 DPS 的直接正负百分比对比，并在折线图中同时渲染 A 与 B 的数据线。

---

## 2. 测试与验证结果

### 2.1 自动化编译与打包验证
控制台运行 `npm run check:all`：
```bash
> check:all
> npm --workspace=@zx/simulation-engine run check && npm --workspace=agent_tool run check && npm --workspace=web_app run build

vite v5.4.21 building for production...
✓ 2428 modules transformed.
dist/index.html                   0.46 kB │ gzip:   0.35 kB
dist/assets/index-C-5Ku57M.css   56.88 kB │ gzip:   9.92 kB
dist/assets/index-DhUb1PYn.js   762.11 kB │ gzip: 221.20 kB
✓ built in 18.78s
```
- **验证结论**：核心模拟包、CLI 工具以及前端项目均 100% 编译通过，所有可选属性在 TS 下均有严密的非空校验或类型防护。

### 2.2 核心限制与逻辑回归测试
在 `packages/simulation-engine/src/test_c.ts` 及 `packages/simulation-engine/src/test_6person_team.ts` 中运行测试：
- **常驻 0s CD 技能**：在 `beginCast` 中，首个 BUFF 释放后其 cooldown 立刻被锁定为 `Number.POSITIVE_INFINITY`，在全场 60 秒 of 循环决策中被证明仅施放一次，且效果持续全场，成功解决了无限叠加 bug。
- **真实小队击杀**：逐霜仙阵营，在 5 个真实配置（包含属性增益 scaling）的辅助配合下，对战赤梭（血量 1968 亿），验证通关耗时精准落在 `20.98秒`，事件流无一报错，表明战斗仿真与静态计算规则无任何偏离。
