# Phase C0 前置整理走查报告

## 1. 本次修改范围

Phase C0 的目标是清理进入离散事件模拟核心前的工程问题，保证旧 CLI、回归测试、文档口径和本地产物管理都处于可重复验证状态。本次没有修改 `web_app/public/game_data/skills.json`，避免与你正在录入的辅助职业 Buff/Debuff 和主输出技能字段产生冲突。

## 2. CLI 与 npm 脚本整理

- 恢复了 `agent_tool/examples/zhu_shuang_mo_t21_boss1.json`，用于 `agent_tool` 的旧单技能计算回归。
- 修正根目录 `agent:calc` 脚本，现在可以正确透传 `--input`。
- 新增根目录 `agent:test:example`，用于直接运行 `agent_tool` 的示例回归。
- 扩展 `check:all`，现在会依次检查共享引擎、Agent CLI 和 Web 构建。

验证命令：

```powershell
npm run agent:test:example
npm run agent:calc -- --input examples/zhu_shuang_mo_t21_boss1.json
```

结果：两个命令均返回 `ok: true`，示例 Boss 为天帝宝库困难噬人花，`苍龙啸·玄` 9 段平均总伤仍为 `8508464657`。

## 3. Phase B 测试强化

`packages/simulation-engine/src/test_b.ts` 已从打印式走查改为硬断言测试：

- validator 出现 ERROR 级问题会直接失败。
- `Cooldown`、`CastTime`、`SkillBonusAttributes` 覆盖失败会直接失败。
- 覆盖污染原始白板技能会直接失败。
- 新增内联辅助技能 fixture，校验 `AppliedEffect.Duration` 与 `BuffEffects` 覆盖，并确认不会污染原始白板技能。

验证命令：

```powershell
npm run test:b
```

结果：通过。输出包含全局白板技能未污染、AppliedEffect 覆盖成功等检查项。

## 4. 文档口径修正

### 总方案 v1.1

在 `doc/诛仙3团队副本模拟训练场方案v1.1.md` 中新增 **8.3 战斗数据查询库（Data Explorer）**：

- 支持职业与阵营查询。
- 支持技能详情查询，包括附加、段数、CD、施法、充能、重置、命中时间等。
- 支持 Buff/Debuff 查询，包括目标、持续时间、互斥组、覆盖策略、优先级和具体数值。
- 支持 Boss 数据查询，包括血量、爆伤减免、伤害压缩等。
- 将该 UI 能力归入 Phase 3 / 阶段 F；数据补齐和校验仍归入 Phase 2 / 阶段 E。

### Phase C 计划

在 `doc/phase C implementation_plan.md` 中修正：

- 内部时间统一使用整数毫秒 `timeMs`。
- 相同毫秒事件使用稳定 `sequence` 排序。
- 主输出策略明确为 `MANUAL_TIMELINE`、`FIXED_ROTATION`、`SKILL_BAR`。
- 辅助策略明确为 `SETUP_PHASE`、`CAST_ON_READY`、`TIMESTAMPED_ACTIONS`。
- 起手铺垫从 `t = 0` 开始，不引入负时间轴。
- 新增 `strategies.ts` 作为 Phase C 的策略层实现文件。

## 5. 本地产物管理

`.gitignore` 已补充：

- `node_modules/`
- `**/node_modules/`
- `agent_tool/node_modules_win/`
- `dist/`
- `**/dist/`
- `*.tsbuildinfo`
- `agent_tool/profile_test_*.json`
- `agent_tool/temp_profile_*.json`

整理后，`node_modules` 和本地临时 profile 不再出现在 `git status --short` 中。

## 6. 全量验证

执行命令：

```powershell
npm run test:b
npm run agent:test:example
npm run agent:calc -- --input examples/zhu_shuang_mo_t21_boss1.json
npm run check:all
```

结果：

- `test:b` 通过。
- `agent:test:example` 通过。
- `agent:calc` 参数透传通过。
- `check:all` 通过：共享引擎类型检查、Agent CLI 类型检查、Web 构建均成功。

Web 构建仍有 Vite chunk 大于 500 kB 的提示，这是现有体积警告，不影响本次 Phase C0 验证。

## 7. 进入 Phase C 前的状态

现在可以进入 Phase C 引擎实现，但建议保持以下边界：

- 不把 Phase C 引擎测试绑定到尚未录完的真实辅助职业数据。
- Boss 血量缺失时，引擎需要明确报错或要求场景输入覆盖，不能静默使用 0 或无限血量。
- 等你继续补充 `skills.json` 后，再用 validator 和后续 Phase E 校准流程逐步收敛真实数据质量。
