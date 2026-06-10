# 诛仙3团队副本模拟训练场 — Phase E 任务跟踪清单

## E-1.1：自动场景装配适配器 (`scenario_assembler.ts`)
- `[x]` 新增 `packages/simulation-engine/src/scenario_assembler.ts`。
- `[x]` 实现纯函数 `assembleScenario`，解析 DPS Actor，支持混入 Profile 白板属性、合并 `skillOverrides`。
- `[x]` 实现解析 Support Actors，扫描其职业/阵营下所有 Buff/Debuff/Utility 技能，无策略时自动生成默认 `CAST_ON_READY`。
- `[x]` 默认辅助 `CAST_ON_READY` 会把 `targetActorId` 指向主输出，保证 `ALLY` 类技能可自动给主输出。
- `[x]` 支持 DPS/辅助显式 `skillIds` 白名单，策略引用和覆盖引用会自动补入并做存在性校验。
- `[x]` 支持 Support `profileAttributes`，并在动态缩放技能缺少来源属性时提前抛错。
- `[x]` 实现 Boss（Monster）检索，支持 `dungeons_monsters.json` 全局匹配，并对跨副本重名冲突抛出校验错误。
- `[x]` 编写 `packages/simulation-engine/src/test_assembler.ts`，验证装配出的 Scenario 可通过技能校验并稳定运行。
- `[x]` 新增根目录脚本 `npm run test:e`。

## E-1.2：核心技能数据录入与核对 (`skills.json`)
- `[x]` 校验并补齐**天音**与**焚香**的佛阵营核心技能与破防、绿点结算。
- `[ ]` 录入**天华**（鸣泉雅音/济世清音、九雅/行云流水、镜花水月等属性/爆伤增益）。
- `[x]` 录入**昭冥**（停云凝风、日月弘光一段/二段自动流转及时间延长、跗骨生灵当前暂禁用占位）。
- `[x]` 校准**昭冥跗骨生灵**暴击率接口：支持玩家暴击率字段、跗骨按昭冥自身暴击率 5% 生成目标暴击率增益，并进入事件流水。
- `[x]` 录入**英招**（背水、天罡伏魔、焦土、五行八卦）。
- `[ ]` 录入**画影**（惊神引、浩渺无极、云生画影等受伤增加与属性增益）。
- `[ ]` 录入**鬼王**（猛火咒/冷嘲热讽、指天骂地降低防御等特效）。
- `[ ]` 录入**青罗**（彤云扫天/扇底风提供极速 Haste 压缩施法、绿水摇飏等）。
- `[x]` 运行 `npm run check:all` 与静态校验脚本，确保数据 100% 正确且字段完整。
- `[x]` 补全 `dungeons_monsters.json` 怪物属性。
- `[x]` 新增 Boss 数据 validator，覆盖 Boss 必填字段、血量、伤害压缩、减暴击字段和 T19-T21 减暴击数量校验。
- `[x]` 修复 `CharacterOnePercentAttack/Defense/Health/Mana` 在静态公式与时间轴命中中的折算链路。
- `[ ]` 基于真实技能库，使用 `assembleScenario` 装配首个“逐霜 T21 炽素”真实 6人/12人 队伍仿真实例。
- `[ ]` 使用 `npm run agent:sim` 运行真实场景，检查事件流、技能覆盖率、击杀时间以及 DPS 收益表现。
- `[ ]` 对照《诛仙3》经典伤害结算对乘区和百分比数值进行精细校准，确保无数值溢出和突变。
