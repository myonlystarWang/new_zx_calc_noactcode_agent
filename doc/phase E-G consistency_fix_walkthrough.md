# Phase E-G 一致性修复 Walkthrough

本轮修复了 Phase E-G 走查发现的代码、数据和文档口径不一致问题。

## 变更

- [field_keys.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/field_keys.ts)：补 `BuffSpeedPercentEffect` 白名单。
- [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json)：补逐霜速度互斥策略字段。
- [scenario_assembler.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/scenario_assembler.ts) 与 [SimulationArena.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationArena.tsx)：排除当前阶段暂禁用辅助技能参与默认仿真。
- [BossConfigPanel.tsx](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/src/components/arena/BossConfigPanel.tsx)：`DamageCompressionPercent` 按配置百分数直接显示。
- 跗骨相关文档改为“当前暂禁用，后续暴击概率模型再启用”。

## 验证

- `npm run test:b`
- `npm run test:c`
- `npm run test:e`
- `npm run test:f`
- `npm run agent:test:example`
- `npm run agent:test:sim`
- `npm run check:all`

以上命令已通过；`check:all` 仍有 Vite chunk size warning，不影响类型检查和生产构建通过。
