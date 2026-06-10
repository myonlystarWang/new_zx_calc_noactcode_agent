# T19-T21 Boss 属性补充（减免暴击）录入设计方案

本方案旨在丰富静态副本 Boss 属性数据，支持“减免暴击”属性的录入与保存。

## Proposed Changes

### 1. 模拟引擎类型扩展

#### [MODIFY] [types.ts](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/packages/simulation-engine/src/types.ts)
- 在 `MonsterAttributeModifiers` 接口中，新增一个可选字段 `MonsterCriticalHitRateReduction?: number;` 以映射“减免暴击”数值。

### 2. 静态副本数据

#### [MODIFY] [dungeons_monsters.json](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/web_app/public/game_data/dungeons_monsters.json)
- 为 T19, T20, T21 对应的 6 个核心 Boss 录入 `"MonsterCriticalHitRateReduction"` 属性：
  - **T19**:
    - 赤梭: `210`
    - 玄铠: `225`
    - 望潮: `220`
    - 裂魂: `215`
    - 璃音: `215`
    - 沧渊: `225`
  - **T20**:
    - 赤梭: `250`
    - 玄铠: `265`
    - 望潮: `260`
    - 裂魂: `255`
    - 璃音: `255`
    - 沧渊: `265`
  - **T21**:
    - 赤梭: `295`
    - 玄铠: `310`
    - 望潮: `305`
    - 裂魂: `300`
    - 璃音: `300`
    - 沧渊: `310`

---

## Verification Plan

### Automated Tests
- 执行 `npm run test:e` 验证场景装配器在解析新 Boss 属性后能正常通过测试。
- 执行 `npm run check:all` 保证整个工程（类型系统、Web App、CLI）无任何编译及类型 Regression。
