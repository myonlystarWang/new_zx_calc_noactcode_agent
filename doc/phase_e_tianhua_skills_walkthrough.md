# 天华佛阵营核心技能数据录入与结算逻辑验收报告

本报告记录了对天华 (Tian Hua) 7个核心佛阵营辅助技能的录入、动态缩放算法、HP 互斥规则以及相关自动化单元测试的集成与验收结果。

## 变更详情

### 1. 静态技能数据录入 (`skills.json`)
在 [skills.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/skills.json) 中添加了天华佛阵营核心的 7 个技能：
1. **鸣泉雅韵 (`TH_FO_SKILL_MQYY`)**: 初始无属性加成（通过动态算法计算）。
2. **金蛇狂舞 (`TH_FO_SKILL_JSKW`)**: 提供 40% 攻击力、60% 爆伤、25% 暴击率和 20% 专注的团队 Buff。
3. **秋声雅韵 (`TH_FO_SKILL_QSYY`)**: 支持四代品质（萤炬/皓月/曦日）对应的持续时间与冷却重载预设。
4. **云水雅韵II (`TH_FO_SKILL_YSYY2`)**: 包含 HP（挂载独占组 `HP_OVERRIDE_GROUP` 且策略为 `NO_OVERWRITE`）、MP、攻击三个独立效果。
5. **净莲生 (`TH_FO_SKILL_JLS`)**: 基于玩家 Profile 中的 `SkillLevel` (0-3) 精确过滤应用云水与秋声的子效果。
6. **凤求凰 (`TH_FO_SKILL_FQH`)**: 基于玩家 Profile 中的 `Variant` (HUA/HAO/LIE/OTHER) 精确重置基础爆伤与持续时间。
7. **阳关三叠·禅 (`TH_FO_SKILL_YGSD_CHAN`)**: 挂载以 `CharacterMaxAttack` 为动态缩放源的降低 Boss 防御效果。

### 2. 模拟引擎与属性缩放逻辑 (`combat_loop.ts`)
- 在 `resolveDynamicEffect` 中实现了天华特有 Buff 的动态计算算法：
  - **鸣泉雅韵**: `BuffAttackPercentEffect = 20 + Math.floor(sourceMana / 50000)`。
  - **秋声雅韵**: 
    - `BuffFocusPercentEffect = 22 + Math.min(20, Math.floor(sourceMaxAttack / 5000))`。
    - `BuffDefenseFixedEffect = sourceMaxAttack * 1.5`。
    - `BuffCriticalDamagePercentEffect = Math.floor(sourceMana / 100000)`。
  - **云水雅韵II / 净莲生云水效果**:
    - HP: `BuffHealthFixedEffect = sourceMaxAttack * 2.5`。
    - MP: `BuffManaFixedEffect = sourceMaxAttack * 5`。
    - Attack: `BuffAttackFixedEffect = 10000 + 25 * sourceMana / 1000`。
  - **凤求凰**:
    - 读取 variant 选择爆伤基准与持续时间（华/HUA=100爆伤,40s持续; 昊/HAO=150爆伤,20s持续; 烈/LIE=130爆伤,30s持续; 其他=100爆伤,30s持续）。
    - 最终爆伤为：`基础爆伤 + Math.floor(sourceMana / 30000)`。
  - **阳关三叠·禅**: 降低防御值等于 `-1.0 * sourceMaxAttack`。

### 3. HP 效果独占互斥规则 (`effects.ts`)
在 `shouldReplace` 函数首部拦截并实现 `HP_OVERRIDE_GROUP` 的高精度对比：
- 仅当新来的 HP 效果的**增加数值**与**持续时间**均**严格大于**现存效果时，才会覆盖现存的 HP 效果；否则，新来的效果将被直接忽略（Skipped）。
- 在天音的摩柯心经 HP 效果上也同步添加了 `"ExclusiveGroup": "HP_OVERRIDE_GROUP"` 以便共享互斥对比规则。

---

## 验证结果

### 1. 自动化单元测试验证 (`npm run test:c`)
在 [test_c.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/test_c.ts) 中对天华所有逻辑编写了详细的测试覆盖，运行输出全部通过：
```
=== 启动 阶段C 自动测试 ===
- Timeline 同毫秒事件优先级 [SUCCESS]
- EffectManager 互斥覆盖与旧过期事件校验 [SUCCESS]
- 手动时间轴、多段命中、Buff 过期卡段 [SUCCESS]
- 固定技能循环 [SUCCESS]
- 法宝栏策略与 Boss 死亡截断 [SUCCESS]
- Boss 伤害压缩 [SUCCESS]
- 充能扣减与恢复 [SUCCESS]
- 功能技能刷新充能 [SUCCESS]
- 自动多阶段状态流转 [SUCCESS]
- 四代动态缩放字段参与运行时结算 [SUCCESS]
- 炎兵灸魂动态绿点翻倍结算 [SUCCESS]
- 角色属性数据上限截断结算 [SUCCESS]
- 1% 属性折算参与静态与时间轴伤害结算 [SUCCESS]
- 昭冥技能（停云凝风时间延长、日月弘光自动流转、跗骨生灵暂禁用占位） [SUCCESS]
- 天华技能（鸣泉、秋声、云水II、净莲生不同等级、凤求凰多变体及与摩柯心经互斥判定） [SUCCESS]
- 缺失 Boss 血量明确报错 [SUCCESS]
=== 阶段C 所有测试项目均顺利通过验证！ ===
```

### 2. 全局静态分析与构建校验 (`npm run check:all`)
执行全局构建检查命令通过，说明所有 TypeScript 严格模式检查和 vite 页面应用构建打包 100% 成功：
```
vite v5.4.21 building for production...
✓ 2423 modules transformed.
dist/index.html                   0.46 kB
dist/assets/index-CKd6yDs4.css   49.32 kB
dist/assets/index-__s_UEoZ.js   544.65 kB
✓ built in 28.93s
```
