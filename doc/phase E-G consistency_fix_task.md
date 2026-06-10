# Phase E-G 一致性修复 Task

- `[x]` 修复 `BuffSpeedPercentEffect` 未进入 `BUFF_EFFECT_KEYS` 导致 `test:b` schema 失败。
- `[x]` 为逐霜 `ZS_HASTE_GROUP` 速度 Buff 补 `ExclusivePolicy` 与 `EffectPower`。
- `[x]` 当前阶段暂禁用辅助技能不进入默认团队仿真，但继续在页面展示供查阅。
- `[x]` 明确昭冥跗骨生灵当前暂禁用，仅保留数据占位与后续恢复入口。
- `[x]` 修正 Boss `DamageCompressionPercent` 在 UI 中被重复乘 100 的显示问题。
- `[x]` 补充 `test:f` 断言，防止暂禁用辅助技能再次被默认装配。

