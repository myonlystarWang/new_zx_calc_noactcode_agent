# 英招技能校准与 1% 属性缩放接口任务跟踪

- `[x]` **1. 修改 `combat_loop.ts` 支持 Boss 被暴击率 Debuff 过滤**
  - `[x]` 将 `BuffMonsterCritRateIncreaseEffect` 加入 `BOSS_DAMAGE_EFFECT_FIELDS`
- `[x]` **2. 修改 `normalize.ts` 注册 1% 属性键名映射**
  - `[x]` 将 `CharacterOnePercentAttack/Defense/Health/Mana` 的别名注册到 `attrAliases`
- `[x]` **3. 录入/修正 `skills.json` 中英招技能数据**
  - `[x]` 在 `skills.json` 中为英招新增【攻坚】 (Gong Jian) 技能 `YZ_FO_SKILL_GJ`
  - `[x]` 修改英招【背水】 (Bei Shui) 技能 `YZ_FO_SKILL_BS`，为其配置 `FourthGenPresets`
- `[x]` **4. 编译与测试验证**
  - `[x]` 执行 `npm run test:e` 运行测试并全部通过
  - `[x]` 执行 `npm run check:all` 验证编译与前端打包无回归并构建成功
