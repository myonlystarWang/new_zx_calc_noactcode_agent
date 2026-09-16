# new_zx_calc_noactcode vs new_zx_calc_noactcode_agent 详细差异对比

> 生成时间：2026-08-28  
> 对比对象（均为本地目录）：
> - `E:\ww\personal work\new_zx_calc_noactcode`（= 原 `…_agent bak`，远程 `new_zx_calc_noactcode.git`）
> - `E:\ww\personal work\new_zx_calc_noactcode_agent`（远程 `new_zx_calc_noactcode_agent.git`）

---

## 0. 一句话结论

**`noactcode_agent` = `noactcode` + ①独立战斗模拟引擎 `packages/simulation-engine`（含 `timeline.ts` 时间轴）+ ②前端副本训练场 `web_app/src/components/arena` + ③npm workspaces monorepo 根 + ④phase A–H 全套研究与调优文档 + ⑤`scratch/` `.learnings/` 等开发辅助目录。**

`noactcode` 只是一个**纯伤害计算器**（前端 web_app + Hermes agent_tool），**没有**副本模拟、没有时间轴、没有模拟引擎。

---

## 1. 整体规模

| 指标 | noactcode_agent | noactcode | 差异 |
|---|---|---|---|
| 文件总数（排除 node_modules/.git/dist） | 19,340 | 800 | agent 多 ~24× |
| agent_tool | 358 | 352 | 几乎一致（agent 略多 6） |
| doc | 63 | 7 | agent 远更全 |
| packages | 87 | 0 | **仅 agent 有** |
| scratch | 2,496 | 0 | **仅 agent 有** |
| scripts | 1 | 0 | **仅 agent 有** |
| video | 2 | 0 | 仅 agent 有 |
| web_app | 67 | 45 | agent 多 arena 相关 |
| zx_analysis_results | 25 | 10 | agent 多玩家档案+研究报告 |

> 注：`scratch/` 2,496 个文件为开发期临时调试产物，非功能代码。

---

## 2. 顶层结构差异

**agent 独有（noactcode 没有）：**
`.learnings/` `node_modules/`(根) `package.json` `package-lock.json` `packages/` `scratch/` `scripts/` `timeline_debug.log` `video/` `web_app_dev_5174.err.log` `web_app_dev_5174.out.log`

**noactcode 独有：** 无（它是 agent 的子集）

**两者共有：** `.git` `.gitignore` `agent_tool/` `doc/` `extract_gw_skills.py` `search_gw_excel.py` `web_app/` `zx_analysis_results/`

---

## 3. 各子目录逐项对比

### 3.1 web_app/（67 vs 45）—— 前端功能分水岭
- **components 目录：**
  - agent：`arena` `business` `layout` `ui`
  - noactcode：`business` `layout` `ui`
- **关键差异：agent 多出整个 `components/arena/`**（`SimulationArena` `SimulationReport` `BossConfigPanel` `TeamConfigPanel` `StrategyEditor`），即「副本模拟（带时间轴）」页。
- 结论：noactcode 的 web_app = 纯计算器 UI；agent 的 web_app = 计算器 + 副本训练场（双 Tab）。

### 3.2 packages/（仅 agent 有，87 文件）—— 模拟引擎核心
`packages/simulation-engine/src/` 含 17 个源文件，关键是：
`timeline.ts`（时间轴）`combat_loop.ts`（战斗循环）`scenario_assembler.ts`（场景装配）`strategies.ts`（策略）`actor.ts` `attributes.ts` `calculator.ts` `effects.ts` `types.ts` `validator.ts` `read_dps_logs.ts` 及多个 `test_*.ts`。
**这正是“带时间轴的副本模拟”的引擎实现，noactcode 完全没有。**

### 3.3 agent_tool/（358 vs 352）—— 几乎一致
两者都是给 Hermes/AI Agent 用的无 UI 计算入口，内容高度重合，agent 仅多约 6 个文件（工作区/示例差异），非功能分水岭。

### 3.4 doc/（63 vs 7）—— 研究文档量差巨大
- **agent**：完整 `phase A`–`phase H` 的 `task.md` / `walkthrough.md` / `implementation_plan.md` 共约 50 篇开发记录，外加多篇优化研究报告（`optimization_*.md`、`phase_h_*.md` 等）。
- **noactcode**：仅 7 篇核心文档——`诛仙3战力计算系统设计文档.md`、`诛仙3战力计算系统调试与部署运行文档.md`、`太昊职业添加功能设计方案_20260314_V1.0.md`、`技能附加信息悬浮显示与UI优化设计方案_20260314_V1.0.md`、`诛仙3团队副本模拟训练场方案.md`、`change_log.md`、`伤害计算 - 鬼王 - 北辰 - 副本.xlsx`。
- ⚠️ 注意：noactcode 也带《诛仙3团队副本模拟训练场方案.md》，但那只是**方案文档**，不是实现；真正的 arena 实现只在 agent。

### 3.5 zx_analysis_results/（25 vs 10）—— 分析产物
- **agent 独有：** `zhushuang_grid_research_report.html`、`逐霜全景伤害边际与属性逆转研究报告.md`，以及更多玩家档案目录（`小贝贝` `枫` `独白_魔` 等）。
- **两者共有玩家档案：** `小五` `独白` `霜华`（noactcode 另含 `myonlystar`）。
- 即 agent 的多场景/网格化伤害分析更丰富。

### 3.6 scripts/（仅 agent）—— `diagnose_phase_h.ts` 诊断脚本

### 3.7 scratch/（仅 agent，2,496 文件）—— 开发期临时调试产物

### 3.8 video/（仅 agent，2 文件）—— 演示视频相关

### 3.9 根 package.json
- **agent**：是 npm workspaces monorepo（`name: new-zx-calc-root`），`workspaces: [agent_tool, web_app, packages/*]`，含脚本 `web:dev` `web:build` `agent:calc` `agent:sim` `agent:check` `engine:check` `check:all` `test:b/c/e/f`。
- **noactcode**：**无根 package.json**，各子目录（agent_tool / web_app）各自独立管理依赖。

### 3.10 .gitignore
- **agent**：丰富，忽略 `node_modules/` `**/node_modules/` `dist/` `agent_tool/node_modules_win/` `agent_tool/profile_test_*.json` `agent_tool/temp_profile_*.json` `*.log` `scratch/` `.learnings/` `*.mp4` 等。
- **noactcode**：极简（仅 70 字节的基础忽略）。

---

## 4. Git 状态对比

| 项 | noactcode_agent | noactcode |
|---|---|---|
| 远程仓库 | `new_zx_calc_noactcode_agent.git` | `new_zx_calc_noactcode.git` |
| 本地 HEAD | `64584ce`（2026-08-21） | `72b0fe0`（2026-05-19） |
| 远程最新提交 | `64584ce`（2026-08-21，已同步） | `60b9cf9`（2026-08-27，落后 1 个提交） |
| 本地未提交改动 | 无 | 删 `agent_tool/examples/zhu_shuang_mo_t21_boss1.json`、改 `agent_tool/package.json`+`package-lock.json`、新增 `temp_profile_*.json` 与 `node_modules_win/` |

> noactcode 落后远程的 1 个提交 `60b9cf9` 仅改动 `web_app/public/game_data/skills.json`（3 个技能 `SkillCriticalDamagePercentBonus` 100→0），与本地未提交改动（都在 `agent_tool/` 下）不冲突，可干净 `git pull`。

---

## 5. 功能对齐总结

| 能力 | noactcode | noactcode_agent |
|---|---|---|
| 伤害计算器（前端 UI） | ✅ | ✅ |
| Hermes/AI Agent 无 UI 计算入口 | ✅ | ✅ |
| 战斗模拟引擎（packages/simulation-engine） | ❌ | ✅ |
| 副本模拟 + 时间轴（arena 组件） | ❌ | ✅ |
| 全套 phase A–H 研究/调优文档 | ❌ | ✅ |
| npm workspaces monorepo | ❌ | ✅ |
| 线上 Cloudflare 站点来源（去激活码） | 否 | **是** |

**结论：带 "Agent" 名字的目录才是功能完整版（含你开发的带时间轴副本模拟页）；`noactcode` 只是它的“纯计算器”子集。后续维护/部署应以 `noactcode_agent` 为主干。**
