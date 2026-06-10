# 诛仙3团队副本模拟训练场 — 任务跟踪清单

## [x] 阶段A：Workspace 与共享引擎基础 (已完成)

- `[x]` **A-1：配置 NPM Workspaces 根目录**
  - `[x]` 创建根目录 `package.json`，配置 workspaces 指向 `packages/*`、`agent_tool` 和 `web_app`
- `[x]` **A-2：创建共享模拟引擎包 `@zx/simulation-engine`**
  - `[x]` 在 `packages/simulation-engine` 下创建 `package.json` 与 `tsconfig.json` 并配置模块导出
- `[x]` **A-3：提取并迁移伤害公式（Hit Resolver）**
  - `[x]` 对比并合并 `agent_tool` 与 `web_app` 伤害计算公式
  - `[x]` 在共享包中实现 `resolveHitDamage` 逐段结算函数，并迁移基础类型定义至 `src/types.ts`
- `[x]` **A-4：重构 `agent_tool` 与 `web_app` 接入共享包**
  - `[x]` 将双端 `types` 与 `calculator` 重新覆写为统一重定向 `@zx/simulation-engine`
- `[x]` **A-5：回归与编译验证**
  - `[x]` 执行全局 `npm install` 并编译共享包，终端回归测试数据完全一致，前端项目顺利打包

---

## [x] 阶段B：数据 Schema 与 Profile 覆盖 (已完成)

- `[x]` **B-1：在 `@zx/simulation-engine` 补充并完成 Schema 定义**
  - `[x]` 我们已经在 Phase A 的 `src/types.ts` 中完成了 `SkillActionType`、`MultiPhaseConfig`、`CooldownResetEffect`、`AppliedEffectConfig`、`HitTimingConfig` 等全套 Schema 定义！
- `[x]` **B-2：定义玩家 Profile 的 `skillOverrides` 运行时融合机制**
  - `[x]` 在共享包中实现 `PlayerSkillOverride` 接口与 deep-merge 覆盖助手函数
  - `[x]` 在 Actor 的构造器中实现玩家个性化 CD/施法时间/Buff 覆盖混入
- `[x]` **B-3：扩充 Boss 数据与 HP 配置机制**
  - `[x]` 为 `dungeons_monsters.json` 架构中的各 Boss 补充 `MonsterHealth` 字段，填入 T19-T21 和天帝宝库的主流 Boss 血量
  - `[x]` 支持模拟器场景输入中允许临时覆盖 Boss 血量
- `[x]` **B-4：开发自动化数据校验工具（Validator Script）**
  - `[x]` 编写校验脚本，检查技能、Buff/Debuff/功能技能、互斥组 `ExclusiveGroup`、优先级 `Priority`、覆盖策略 `ExclusivePolicy` 等配置完整性
- `[x]` **B-5：阶段B 回归与可用性校验**
  - `[x]` 编写测试脚本校验 Profile 覆盖以及数据校验工具功能正常，确保无编译 and 逻辑错误
