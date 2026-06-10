# 昭冥跗骨生灵暴击率接口任务跟踪

- `[x]` **1. 扩展玩家暴击率字段**
  - `[x]` `CharacterAttributes` 新增 `CharacterCriticalHitRatePercent?: number`
  - `[x]` `BuffEffects` 新增 `BuffCriticalHitRatePercentEffect?: number`
  - `[x]` `field_keys.ts` 注册新增字段，纳入 validator 动态字段检查
- `[x]` **2. 接入共享属性聚合**
  - `[x]` `attributes.ts` 累加 `BuffCriticalHitRatePercentEffect`
  - `[x]` 保持字段可选，不加入 CLI 必填属性
- `[x]` **3. 跗骨生灵占位效果**
  - `[x]` `ZM_BUFF_FGSL` 当前阶段暂不参与仿真结算，运行时解析为空 `BuffEffects`
  - `[x]` 保留 `BUFF_APPLY` 事件占位，便于页面查阅与后续恢复
  - `[x]` `skills.json` 为 `ZM_BUFF_FGSL` 增加 `BuffCriticalHitRatePercentEffect: 0` 静态占位
- `[x]` **4. CLI 别名**
  - `[x]` `normalize.ts` 注册 `CharacterCriticalHitRatePercent`、`critRate`、`criticalRate`、`暴击率`、`暴击`
- `[x]` **5. 验证**
  - `[x]` `npm run test:b`
  - `[x]` `npm run test:c`
  - `[x]` `npm run test:e`
  - `[x]` `npm run agent:test:example`
  - `[x]` `npm run agent:test:sim`
  - `[x]` `npm run check:all`

## 注意

- 跗骨生灵当前阶段暂禁用：进入数据查阅范围，但不进入默认团队仿真，也不产生暴击率增益。
- 暴击率概率结算等待后续非 100% 暴击模型统一处理，届时再恢复 `CharacterCriticalHitRatePercent * 0.05`。
