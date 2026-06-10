# T19-T21 Boss 属性补充（减免暴击）任务跟踪

- `[x]` **1. 修改 `types.ts` 扩展 `MonsterAttributeModifiers` 类型**
  - `[x]` 新增 `MonsterCriticalHitRateReduction?: number;` 可选属性
- `[x]` **2. 修改 `dungeons_monsters.json` 录入减免暴击数值**
  - `[x]` 为 T19, T20, T21 对应的 18 个 Boss 实体补充 `MonsterCriticalHitRateReduction` 属性
- `[x]` **3. 编译与测试验证**
  - `[x]` 执行 `npm run test:e` 运行测试并通过
  - `[x]` 执行 `npm run check:all` 验证编译与前端打包无回归并构建成功
- `[x]` **4. 补充 Boss 数据自动校验**
  - `[x]` 新增 `validateMonstersData`，校验 Boss 基础字段、血量、伤害压缩、减暴击等数值字段
  - `[x]` 在 `npm run test:b` 中读取真实 `dungeons_monsters.json`，校验 T19/T20/T21 各 6 个 Boss 均已录入 `MonsterCriticalHitRateReduction`
  - `[x]` 增加非法 Boss 数据反例，验证 validator 会拦截非法爆伤减免、血量、伤害压缩和减暴击字段
