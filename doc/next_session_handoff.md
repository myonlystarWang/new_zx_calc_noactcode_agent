# Next Session Handoff

## 2026-06-10 最新接续入口

当前应优先读取：

- `doc/phase_h_damage_diagnostics.md`
- `scripts/diagnose_phase_h.ts`
- `packages/simulation-engine/src/types.ts`
- `packages/simulation-engine/src/scenario_assembler.ts`
- `packages/simulation-engine/src/combat_loop.ts`
- `packages/simulation-engine/src/calculator.ts`
- `web_app/src/components/arena/SimulationArena.tsx`
- `web_app/src/components/arena/StrategyEditor.tsx`
- `web_app/public/game_data/skills.json`
- `web_app/public/game_data/dungeons_monsters.json`

## 最新可复现诊断命令

```bash
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=50 --audit-seconds=12
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=0 --audit-seconds=8.2 --ablation=false --hit-output=jsonl --audit-skills=ZS_MO_SKILL_SY2
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=12 --audit-seconds=12 --ablation=false --hit-output=tsv --audit-skills=ZS_MO_SKILL_SY2,ZS_MO_SKILL_CLXS
```

注意：当前主输出默认延迟 `5000ms`，第一段主输出伤害在 `7.264s`，所以 `audit-seconds` 需要大于 7.3 才能看到首段伤害。

## 本轮已完成

- 引擎新增 `initialEffects`，支持场景开场注入 Buff/Debuff。
- `AssembleScenarioInput` 新增 `dpsCommonEffects`、`dungeonEffects`。
- 当前实际启用的通用主输出效果：三碗不过岗，专注 +20。
- 当前实际启用的副本效果：0s 给 Boss 持续绿点 +150。
- `FIXED_ROTATION` 和 `SKILL_BAR` 均支持 `startTimeMs`；默认魔逐霜主输出延迟 `5000ms` 开始。
- Web 右侧上下文栏新增“主输出通用”和“副本效果”开关；九华、神爆、佛尊、家族技能、法宝特效、攻击/爆伤/紫点/易伤副本效果均为预留禁用项。
- 技能策略抽屉新增“主输出开打延迟”，单位为秒。
- 诊断脚本默认同步当前 UI/测试口径：5s 主输出延迟、三碗开启、副本绿点 150 开启。

## 当前基准结论

- 当前默认目标是 T20 赤梭，血量 `124,474,606,860`。
- `196,829,815,000` 对应 T21 赤梭血量，不是 T20。
- 当前 T20 默认团队结果为 `44.202s` 击杀，仍然明显偏快。
- 当前实际伤害技能包括：山雨欲来II、山雨欲来III、苍龙啸、苍龙啸·煞。
- `苍龙啸·煞` 已经能进入实际伤害；`银鳞玄冰` 未进入主要是因为当前 Boss 在 44.202s 死亡，而银鳞玄冰 CD 为 150s。
- 主输出延迟后，辅助 0-5s 已经把增益和 Boss 减益基本铺满，因此首段主输出伤害更适合拿来对表。

当前第一段主输出伤害：

```text
[7.264s] 山雨欲来II hit=1/6 dmg=909,555,396
专注 204 / 巫咒 7.5
绿点 raw 490，炎兵灸魂翻倍后 980，cap 后 900
易伤 raw 180，cap 后 120
总乘区约 234.791x
```

## 必须保留的口径

- 阵营显示使用“仙 / 魔”，不要再写“仙系 / 魔系”。
- 法宝栏自动释放本质是从头扫描：每次决策都从第一个技能重新检查。
- 技能释放条件：技能可用，且该技能配置的过期时间已到。
- 过期时间 `0` 表示不等待过期，技能可用就释放。
- 充能技能只要当前层数大于 0 就可释放；诊断里的 `cdReady` 对充能技能表示下一次自然回层时间，不是释放阻塞。
- JSON 里的 `Cooldown` 单位是秒。
- 魔 `山雨欲来II` 和魔 `临渊敛爪` 只给普通 `苍龙啸` 补一层充能，不影响 `苍龙啸·煞`。
- 清啸横朔 JSON 里可保留多种效果；当前阶段只在引擎过滤使用专注和速度，不应为了“暂不使用攻击”删 JSON 字段。

## 伤害审计怎么用

Web：

- 勾选右侧“伤害审计”。
- 点击“启动仿真”重新计算。
- 打开右侧“分析”，查看逐段审计记录。

脚本：

- 用 `scripts/diagnose_phase_h.ts` 直接输出更完整的时间轴、逐段 TSV/JSONL 和消融表。
- 要对【诛仙副本战力计算器】，优先使用 JSONL：

```bash
npx tsx scripts/diagnose_phase_h.ts --timeline-seconds=0 --audit-seconds=8.2 --ablation=false --hit-output=jsonl --audit-skills=ZS_MO_SKILL_SY2
```

## 当前最可疑的核对点

1. 副本绿点 150 是否应被炎兵灸魂翻倍：当前 `150 + 背水300 + 焦土40 = 490`，炎兵灸魂后变 `980`，再按绿点 cap 900 入公式。
2. `YZ_FO_SKILL_BS` 背水：去掉后 T20 从 `44.202s` 变 `77.237s`。
3. 焚香大易伤：绝情殇 60 + 赤乌 50 + 背水 40 + 无量 15 + 无量禅 15，第一段时易伤 raw 已经 180，按 120 cap 入公式。
4. `ZM_FO_SKILL_RYHG` 日月弘光：一段给专注 45、巫咒 7.5，去掉后从 `44.202s` 变 `61.570s`。
5. 专注公式：当前 `focusMultiplier = 1 + 专注 / 100`，专注 204 即 `3.04x`。

## 验证

- `npm --workspace=@zx/simulation-engine run check`：通过。
- `npm --workspace=@zx/simulation-engine run build`：通过。
- `npm run test:e`：通过。
- `npm run test:f`：通过，当前默认 T20 击杀时间 `44.20s`。
- `npm --workspace=web_app run build`：通过；仅 Vite chunk size 警告。

## 后续优先级

1. 先拿 `[7.264s] 山雨欲来II 第 1/6 段` 去【诛仙副本战力计算器】逐项对表。
2. 若单段伤害不一致，先改公式口径或 Buff/Debuff 入公式方式。
3. 若单段伤害一致但整场仍过快，再逐个核对辅助默认启用、持续时间、CD、释放策略。
4. UI 后续只做支持对表的必要改动，暂时不要再扩大页面重构范围。
