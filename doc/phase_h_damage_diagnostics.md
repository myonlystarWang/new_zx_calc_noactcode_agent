# Phase H 伤害诊断与接续说明

## 目标

当前重点不是继续调 UI，而是确认默认副本仿真为什么击杀过快。诊断要能回答三件事：

- 每次法宝栏从头扫描时，所有技能分别处于什么状态，为什么最终释放某个技能。
- 每段伤害发生时，角色属性、我方增益、Boss 减益和公式乘区分别是多少。
- 伤害过高主要来自属性、我方增益、Boss 减益、Boss 血量，还是技能释放频率。

## 固化脚本

主诊断脚本：

```bash
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=50 --audit-seconds=12
```

常用参数：

```bash
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=12 --audit-seconds=12 --ablation=false
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=0 --audit-seconds=8.2 --ablation=false --hit-output=jsonl --audit-skills=ZS_MO_SKILL_SY2
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=12 --audit-seconds=12 --ablation=false --hit-output=tsv --audit-skills=ZS_MO_SKILL_SY2,ZS_MO_SKILL_CLXS
npx tsx scripts/diagnose_phase_h.ts --dps-start-delay-ms=0 --sanwan=false --dungeon-green150=false --timeline-seconds=8 --audit-seconds=5 --ablation=false
npx tsx scripts/diagnose_phase_h.ts --tier=T21 --timeline-seconds=50 --audit-seconds=12
```

注意：默认主输出有 `5000ms` 开打延迟，所以 `--audit-seconds` 必须大于 7.3 才能看到第一段主输出伤害。

可选开关：

- `--dps-start-delay-ms=5000`：主输出自动策略开始时间，默认 5000。
- `--sanwan=false`：关闭开场三碗专注 +20。
- `--dungeon-green150=false`：关闭开场副本绿点 +150。
- `--hit-output=both|tsv|jsonl|none`：逐段伤害输出格式。
- `--audit-skills=ZS_MO_SKILL_SY2,ZS_MO_SKILL_CLX`：只输出指定技能的逐段审计。

输出分区：

- `INITIAL_EFFECTS`：0s 注入的通用/副本效果。
- `SKILL_CDS`：魔逐霜默认队列中每个技能的 CD、施法、充能、自然回层、过期时间。
- `LOADED_ACTOR_SKILLS`：装配后每个 Actor 实际加载了哪些技能。
- `SUMMARY`：Boss 血量、击杀时间、伤害占比。
- `TIMELINE_FULL_SCAN_FIRST_Xs`：每次决策时完整扫描 10 个法宝栏技能，列出 `READY`、`cd_until`、`expiry_until`、`no_charge_until` 和最终选择。
- `BUFF_APPLY_FIRST_Xs`：前 X 秒内所有 Buff/Debuff 的来源、目标、数值和结束时间。
- `AUDIT_SNAPSHOTS_FIRST_Xs`：前 X 秒首段/末段命中的属性、总增减益、乘区、参与公式的每个效果来源。
- `DAMAGE_HIT_TSV_FIRST_Xs`：前 X 秒内每一段伤害的扁平 TSV 字段，便于粘贴到表格中横向对比。
- `CALCULATOR_INPUT_JSONL_FIRST_Xs`：前 X 秒内每一段伤害的完整 JSONL 输入快照，包含 Boss、cap、角色属性、技能段参数、Buff/Debuff totals、公式 trace、入公式效果来源。
- `ABLATION`：消融测试，逐步去掉部分辅助增益/减益，看击杀时间变化。

## 当前基准

默认脚本配置：

- 主输出：魔逐霜。
- Boss：T20 赤梭。
- 副本：`ZHENHAI_DUANLANG_T20`。
- Boss 血量：`124,474,606,860`。
- 随机种子：`20260609`。
- 主输出延迟：`5000ms`。
- 开场通用效果：三碗不过岗，专注 +20，默认开启。
- 开场副本效果：Boss 绿点 +150，默认开启。
- 默认法宝栏顺序：清啸横朔、龙战于野、山雨欲来II、山雨欲来III、苍龙啸、鹰扬折冲、苍龙啸·煞、银鳞玄冰、鹰扬折冲·煞、临渊敛爪。
- 清啸横朔过期时间：`16000ms`。

当前结果：

```text
T20 赤梭: killed=44.202s, duration=36.938s, avgDps=3,369,825,298
山雨欲来II: 36 段, 25.16%
山雨欲来III: 54 段, 31.46%
苍龙啸: 99 段, 35.87%
苍龙啸·煞: 14 段, 7.51%
```

注意：

- `196,829,815,000` 对应 T21 赤梭血量，不是 T20。
- 旧记录里的 `114.50s` 和 `46.181s` 都不是当前默认诊断基准。
- `苍龙啸·煞` 当前已经能进入实际伤害；`银鳞玄冰` 仍未进入伤害，主要因为当前 Boss 在 44.202s 已死亡，而银鳞玄冰 CD 为 150s。

## 技能栏与充能口径

- 法宝栏自动释放使用 `FROM_FIRST_EACH_DECISION`：每次决策都从第一个技能重新扫描。
- 技能满足两条才释放：一是技能可用，二是配置的过期时间已到。
- 过期时间 `0` 表示不等待过期，技能可用就释放。
- 充能技能只要当前层数大于 0 就可释放；诊断里的 `cdReady` 对充能技能表示下一次自然回层时间，不是有层数时的释放阻塞。
- JSON 里的 `Cooldown` 单位是秒；诊断里的 `ready=21.136s` 是绝对时间点。
- 魔 `山雨欲来II` 和魔 `临渊敛爪` 只给普通 `苍龙啸` 补一层充能，不影响 `苍龙啸·煞`。

## 当前时间轴要点

主输出延迟后，前几次决策如下：

```text
5.000s  清啸横朔
6.400s  龙战于野
7.094s  山雨欲来II
8.115s  山雨欲来III
9.136s  苍龙啸
10.668s 苍龙啸
```

辅助仍从 0s 开始自动铺增益/减益，因此主输出第一段伤害发生时，辅助效果基本已经叠满。

第一段有效主输出伤害：

```text
[7.264s] 山雨欲来II hit=1/6 dmg=909,555,396
baseAtk=300000-352000
effectiveAtk=300000-352000
hp=4000000
mana=5490000
critDmg=2871
focus=204
holyWrath=7.5
greenRaw=490
greenBeforeCap=980
greenAfterCap=900
harmRaw=180
harmAfterCap=120
critMult=22.710
allMult=234.791
```

参与首段公式的主要来源：

```text
三碗不过岗: 专注 20
清啸横朔: 专注 14
龙战于野: 专注 15
慈航法愿: 专注 18
祝融真典2: 专注 30
金蛇狂舞: 专注 20
日月弘光一段: 专注 45 / 巫咒 7.5
秋声雅韵: 专注 42
副本开场绿点: 绿点 150
背水: 绿点 300 / 易伤 40
焦土: 绿点 40
炎兵灸魂: 绿点翻倍开关
绝情殇: 易伤 60
赤乌·三味真火: 易伤 50
无量真言: 易伤 15
无量真言·禅: 易伤 15
```

`CombinedBuffTotals.BuffSpeedPercentEffect=80` 是普通汇总字段的原始相加值；实际施法速度不使用这个字段。逐霜施法速度当前按独立乘区计算：`迅疾 × 龙战`。审计 UI 另行显示等效加速。

## 消融结果

当前默认口径：主输出延迟 5s、三碗开启、副本绿点 150 开启。

```text
A_all_current                 killed=44.202s firstFocus=204 holy=7.5 green=900 harm=120 mult=234.8
B_dps_only                    killed=260.914s firstFocus=49  holy=0   green=150 harm=0   mult=32.6
C_formula_buffs_only          killed=156.727s firstFocus=204 holy=7.5 green=150 harm=0   mult=71.5
D_formula_debuffs_only        killed=89.488s  firstFocus=49  holy=0   green=900 harm=120 mult=107.0
E_no_RYHG                     killed=61.570s  firstFocus=159 holy=0   green=900 harm=120 mult=186.1
F_no_QSYY                     killed=46.755s  firstFocus=162 holy=7.5 green=900 harm=120 mult=202.4
G_no_BS                       killed=77.237s  firstFocus=204 holy=7.5 green=380 harm=120 mult=181.0
H_no_YBJH                     killed=57.316s  firstFocus=204 holy=7.5 green=490 harm=120 mult=192.4
I_no_big_harmed_FX            killed=63.272s  firstFocus=204 holy=7.5 green=900 harm=70  mult=181.4
J_no_support_formula_debuffs  killed=155.187s firstFocus=204 holy=7.5 green=150 harm=0   mult=71.5
K_no_support_formula_buffs    killed=87.778s  firstFocus=49  holy=0   green=900 harm=120 mult=107.0
L_all_current_T21_hp          killed=83.364s  firstFocus=204 holy=7.5 green=900 harm=120 mult=224.5
```

结论：44 秒不是单一 Boss 血量导致。当前默认辅助在 0-5 秒内自动叠满了大量我方增益和 Boss 减益；我方增益和 Boss 减益叠乘后把首段总乘区推到 `234.8x`。

## 当前最可疑的核对点

优先级按影响和不确定性排序：

1. 副本绿点 150 是否应被炎兵灸魂翻倍：当前 `150 + 背水300 + 焦土40 = 490`，炎兵灸魂后变 `980`，再按绿点 cap 900 入公式。
2. `YZ_FO_SKILL_BS` 背水：去掉后 T20 从 `44.202s` 变 `77.237s`。需确认绿点 300、易伤 40、持续 27 秒是否符合当前目标场景。
3. 焚香大易伤：绝情殇 60 + 赤乌 50 + 背水 40 + 无量 15 + 无量禅 15，第一段时易伤 raw 已经 180，按 120 cap 入公式。
4. `ZM_FO_SKILL_RYHG` 日月弘光：一段给专注 45、巫咒 7.5，去掉后从 `44.202s` 变 `61.570s`。需确认默认是否应自动释放，以及巫咒是否是独立乘区。
5. `TH_FO_SKILL_QSYY` 秋声雅韵：当前动态专注 42，去掉后只从 `44.202s` 变 `46.755s`，影响比旧基准小，但仍需确认动态公式、默认释放目标和是否应进入当前阶段。
6. 专注公式：当前 `focusMultiplier = 1 + 专注 / 100`，专注 204 即 `3.04x`。需和【诛仙副本战力计算器】逐项对齐。
7. `BuffMonsterHarmedPercentEffect`：当前所有易伤同字段相加后 cap 120，再作为 `1 + 易伤 / 100` 独立乘区。需确认同类易伤是否全部可叠。

## UI 与开关

- 右侧上下文栏已有“伤害审计”开关；勾选后重新仿真，在分析报告里查看逐段审计记录。
- 右侧上下文栏新增“主输出通用”：当前只有“三碗不过岗 · 专注 +20”可用，默认开启；九华、神爆、佛尊、家族技能、法宝特效为预留禁用项。
- 右侧上下文栏新增“副本效果”：当前只有“开场绿点 +150”可用，默认开启；攻击、爆伤、紫点、易伤为预留禁用项。
- 技能策略抽屉新增“主输出开打延迟”，单位为秒，默认 5s。

## 现阶段“只使用部分效果”的规则

不要直接把 JSON 字段删掉。引擎里 `filterBuffEffects` 已经按现阶段规则过滤：

- 金蛇狂舞只保留专注。
- 枕戈待旦属性效果只保留专注，速度走独立速度效果。
- 清啸横朔属性效果只保留专注，攻击暂不使用，速度走独立速度效果。
- 龙战于野属性效果只保留专注，速度走独立速度效果。
- 部分暂禁用辅助技能由 `scenario_assembler.ts` 的 `CURRENT_PHASE_DISABLED_SUPPORT_SKILL_IDS` 排除。
- Boss 破防、紫点当前只展示，不进入伤害公式；入公式的 Boss 字段只有绿点和易伤。

## 下一步建议

1. 先用 `--audit-skills=ZS_MO_SKILL_SY2 --audit-seconds=8.2 --hit-output=jsonl --ablation=false` 只取 `[7.264s] 山雨欲来II 第 1/6 段`。
2. 将 JSONL 中 `attributes.effective`、`skillBonusAttributesForThisHit`、`buffTotals.bossInFormula`、`formulaInputs`、`multipliers` 拆到【诛仙副本战力计算器】中逐项复刻。
3. 若单段伤害对不上，先改公式口径，不改队列。
4. 若单段伤害对上，但整场仍过快，逐个核对辅助默认释放策略、持续时间、CD、是否应默认启用。
5. 若需要看完整队列，不要只看 `CAST` 行；必须看 `DECISION selected=...` 下 10 个技能状态。
