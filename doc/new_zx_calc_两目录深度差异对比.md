# new_zx_calc_noactcode_agent vs new_zx_calc_noactcode — 深度差异对比

> 对比对象：本地两个目录
> - **agent** = `E:\ww\personal work\new_zx_calc_noactcode_agent`（带副本模拟/时间轴的完整版）
> - **noactcode** = `E:\ww\personal work\new_zx_calc_noactcode`（原 bak，纯计算器快照，本地落后其远程 1 个提交）
> 说明：本对比里 `REMOVED/AGENT_ONLY` 指「仅 agent 有、noactcode 没有」；`ADDED/NOACTCODE_ONLY` 指「仅 noactcode 有」。

---

## 1. Web 伤害计算逻辑差异 —— **有显著差异**

| | noactcode（web） | agent（web） |
|---|---|---|
| 文件 | `web_app/src/utils/calculator.ts`（内联 233 行） | `web_app/src/utils/calculator.ts` 仅 1 行 `export * from '@zx/simulation-engine'` |
| 真实逻辑所在 | 自身内联 | `packages/simulation-engine/src/calculator.ts`（356 行） |
| 属性封顶 | ❌ 无 | ✅ 有 `DEFAULT_ATTRIBUTE_CAPS` |
| 暴击伤害封顶 | ❌ | ✅ `CapCriticalDamage=3000` |
| 易伤/怪物暴伤 buff 封顶 | ❌ | ✅ `CapMonsterHarmed=120` / `CapGreenPoints=900` |
| YBJH 绿字 debuff | ❌ | ✅ `FX_DEBUFF_YBJH_GREEN` → 怪物暴伤 buff ×2（封顶前） |
| 增益叠加模型 | 简单 `base×(1+pct/100)+固定攻击` | `resolveEffectiveCharacterAttributes`：支持**一分属性(绿字)**模式 + 防御/气血/真气**固定 buff** |
| 调试信息 | 仅数值 | 返回完整 `HitDamageFormulaTrace` 轨迹 |

**公式本体结构一致**（基础伤害 = 攻击×(1+技能攻击%) + 固定 + 气血% + 真气% + 防御%；最终倍率 = 暴击 × 技能伤害 × 怪物增伤 × 易伤 × 专注 × 圣怒），但 agent 引擎在以下点会算出**不同数值**：

1. **属性封顶**：agent 把攻击/气血/真气/防御/暴伤/绿字/易伤都按上限截断（如血量 400 万、攻击 75 万、暴伤 3000）；noactcode 不截断。
2. **暴击伤害上限 3000**、**易伤上限 120 / 绿字上限 900**：agent 有，noactcode 无。
3. **YBJH 绿字 debuff 翻倍**：agent 在角色带 `FX_DEBUFF_YBJH_GREEN` 时把怪物暴伤 buff 翻倍（封顶前），noactcode 完全没有这条。
4. **增益模型差异**：agent 经 `attributes.ts` 的 `resolvePercentBonus`，当角色设了 `CharacterOnePercentAttack` 等「一分属性」时，增益按 `pct × 一分值` 计（绿字机制），且对防御/气血/真气也加**固定 buff**；noactcode 仅攻击有固定 buff，且无绿字模式。

> **结论**：两者会得出不同的伤害/战力数字；agent 引擎更贴近游戏（含官方属性上限与绿字机制）。

---

## 2. 副本 / 怪物 / 技能属性差异

### 2.1 副本属性 `dungeons.json` —— **完全一致**
14 个副本、`DungeonImportanceWeight` 等字段 0 差异。

### 2.2 怪物属性 `dungeons_monsters.json` —— **结构同、字段缺**
15 个副本、各副本怪物数量完全相同，但 agent 怪物携带完整 `MonsterAttributeModifiers`，**noactcode 高难怪物缺失防御/血量字段**：

| 副本 | noactcode 缺少的字段（agent 有） |
|---|---|
| `TIANDI_BAOKU_HARD`（金瓶儿/陆雪琪/石仁花/萧惠/玄蛇 5 只） | `MonsterHealth`（1.2亿–2.5亿） |
| `ZHENHAI_DUANLANG_T19`（6 只） | `MonsterCriticalHitRateReduction`、`MonsterDefense`、`MonsterHealth` |
| `ZHENHAI_DUANLANG_T20`（6 只） | 同上 3 字段 |
| `ZHENHAI_DUANLANG_T20/CANAG_YUAN_T20` | `MonsterCriticalDamagePercentReduction` **2200(agent) vs 1650(noactcode)** |
| `ZHENHAI_DUANLANG_T21`（6 只） | `MonsterCriticalHitRateReduction`、`MonsterDefense`、`MonsterHealth` |

> 影响：noactcode 高难怪物的暴击减免/防御/血量=0 → 计算器对 T19–T21、天地宝库困难本会**算得偏高**（实际怪有减免）。低难副本（节气空桑、守神降临等）两者一致。

### 2.3 技能属性 `skills.json` —— **职业数与内容都差很多**
- **职业数**：agent **9** 个，noactcode **4** 个。agent 新增 `FEN_XIANG`(焚香) / `TIAN_HUA`(天华) / `TIAN_YIN`(天音) / `YING_ZHAO` / `ZHAO_MING`(昭明)。
- 共有 4 职业内差异：
  - **SkillImportanceWeight 大幅重平衡**：`ZHU_SHUANG.FO` 4.0↔0.9；`GUI_WANG.FO` 1.5↔0.9；`ZHU_SHUANG.MO[1]` Cooldown 150↔60；`XIAN[3]` CastTime 0.5↔3。
  - **agent 新增战斗时序字段**：`ActionType` / `ChargeReplenishTime` / `HitTiming` / `MaxCharges` / `FourthGenPresets` / `CooldownResets`。
  - **变体数量不同**：`ZHU_SHUANG.MO` 12↔6；`XIAN` 11↔5；`NIE_YU.FO` 3↔0。
  - 个别技能 noactcode 独有 `MultiHitConfig`（如 `MO[4]`/`XIAN[3]`）。

### 2.4 其他 game_data
- `combat_buffs.json`：仅 1 处——`BUFF_MON_HARMED_EFFECT.BuffName` agent `'易伤'` vs noactcode `'怪物受到伤害'`，其余一致。
- `classes.json` / `rank_config.json`：0 差异。
- `default_overrides.json`：**仅 agent 有**（1140B）—— 内置 DPS 参考面板（`dpsAttributes` 满配属性+绿字、`dpsStartDelayMs=2000`、`dpsDefaultFourthGenQuality='XI_RI'`、`supportOverrides`），noactcode 无此文件。

---

## 3. agent_tool 差异

| 项 | noactcode | agent |
|---|---|---|
| `src/calculator.ts` | 完整内联实现 5652B | 39B 的 re-export → `@zx/simulation-engine` |
| `src/types.ts` | 完整定义 3409B | 39B 的 re-export |
| `src/normalize.ts` | 基准 | 差 20 行：agent 增 **暴击率**别名 + **一分属性(绿字)**别名 + `'易伤'`改名 |
| `src/cli.ts` `data.ts` `engine.ts` | — | **完全相同（0 diff）** |
| `src/sim_cli.ts` | 无 | **独有 15KB**：调用 `engine.runSimulation` 跑副本时间轴模拟（events/hitRecords/boss/summary） |
| `package.json` | 基准 | 增 `sim`/`check(带engine build)`/`test:sim` 脚本 + 依赖 `@zx/simulation-engine` |
| `examples/` | 无 | **5 个示例**（simulation_minimal / simulation_compare_order / test_diagnose_sy2(_profile) / zhu_shuang_mo_t21_boss1） |
| `README.md` | 基准 | 仅 1 处（`'易伤'` vs `'怪物受到伤害'`） |

> 结论：agent 的 agent_tool 与 web 端**共用同一引擎**（数值一致、自动同步、不会漂移）；noactcode 的 agent_tool 是独立内联副本。agent 还多出 `sim_cli.ts` 这条「副本模拟 + 时间轴」的命令行入口。

---

## 4. 玩家 profile 差异

- **agent_tool 顶层 16 个 `temp_profile_*` / `profile_test_tiandi3` / `tsconfig.json`**：与 noactcode **逐字节一致**。
- **`zx_analysis_results` 玩家档案**：
  - 仅 agent 有：**小贝贝、枫、独白_魔**（3 个新分析档案）
  - 仅 noactcode 有：**myonlystar**
  - 共有且内容一致：小五(profile/profile_test)、霜华(profile)、独白(profile_test/profile_tiandi3)
  - 共有但内容差：**独白/profile.json** —— 仅 5 处 `skillUsage.*.note` 注释不同（关于「实战占比」与「计算器按 N 段总和/单段输出」的备注，**数值属性一致**）。

> 结论：玩家档案的**数值属性两目录基本一致**；差异只在「收录了哪些玩家」和独白档案的 5 条分析备注。

---

## 速览总结

| 维度 | 是否一致 | 关键差异 |
|---|---|---|
| Web 伤害公式 | ❌ 不同 | agent 有属性/暴伤/易伤封顶 + YBJH 绿字翻倍 + 绿字增益模型；noactcode 无 |
| 副本属性 | ✅ 一致 | — |
| 怪物属性 | ❌ 字段缺 | noactcode 高难怪缺 MonsterHealth/Defense/CritReduction |
| 技能属性 | ❌ 大不同 | agent 多 5 职业 + 战斗时序字段 + 权重重平衡 |
| combat_buffs | ≈ 仅 1 处 | BuffName 改名（易伤） |
| default_overrides | 仅 agent | 内置 DPS 参考面板 |
| agent_tool 源码 | 部分 | 共享引擎 re-export + agent 独增 sim_cli + examples |
| 玩家 profile | ✅ 数值一致 | 收录玩家不同；独白 5 条备注不同 |

**一句话**：`noactcode` 是 `agent` 的早期、数据更稀疏的快照——它的伤害公式更“裸”（无封顶/无绿字）、怪物数据缺高难防御字段、技能只覆盖 4 职业；`agent` 才是数值完整、且与 web 共用引擎的版本。
