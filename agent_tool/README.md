# 诛仙 3 Hermes 伤害计算工具

这是给 Hermes/agent 调用的无 UI 计算入口。微信自然语言由 Hermes 解析成 JSON，本工具只做确定性计算并输出 JSON。

## 安装与运行

```bash
cd /mnt/d/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool
npm install
npm run calc -- --input examples/zhu_shuang_mo_t21_boss1.json
```

## Hermes 调用边界

Hermes 负责把用户原话解析为结构化 JSON，例如：

```json
{
  "className": "逐霜",
  "factionName": "魔",
  "attributes": {
    "health": 4000000,
    "mana": 4500000,
    "minAttack": 300000,
    "maxAttack": 350000,
    "critDamage": 2800,
    "monsterDamageIncrease": 40
  },
  "buffs": {
    "useDefaults": true,
    "overrides": {
      "专注": 241
    }
  },
  "target": {
    "dungeon": "T21",
    "bossIndex": 1
  }
}
```

工具会读取 `../web_app/public/game_data/*.json`，按 `new_zx_calc_noactcode` 的计算公式返回结构化结果和微信可用摘要。

## Hermes profile 兼容字段

工具也支持 Hermes profile 中的 buff 简写：

```json
{
  "buffs": {
    "focus": 271,
    "greenPoint": 900,
    "monsterDamageTaken": 120,
    "witchCurse": 22.5
  }
}
```

这些字段等价于：

```json
{
  "buffs": {
    "useDefaults": true,
    "overrides": {
      "专注": 271,
      "绿点": 900,
      "易伤": 120,
      "巫咒": 22.5
    }
  }
}
```

角色防御必须写在 `attributes.defense`。如果缺失，工具会按网页默认值 `5000` 计算。

## 战斗模拟（sim）与四代技能佩戴

战斗模拟入口（不走单次 calc 路径）：

```bash
npm run agent:sim -- --input agent_tool/examples/simulation_minimal.json
```

`SimulationScenario` 的每个 actor 支持可选字段 `equippedFourthGen`，表示该角色佩戴的四代技能（玄烛·xxx / 赤乌·xxx）及其品质：

```json
"equippedFourthGen": [
  { "skillId": "GW_XIAN_FG_YLP", "quality": "XI_RI" }
]
```

- `quality` 取值：`YING_JU`（萤炬）/ `HAO_YUE`（皓月）/ `XI_RI`（曦日）。
- 佩戴上限：玄烛（`XUAN_ZHU`）最多 3 个、赤乌（`CHI_WU`）最多 1 个、总数最多 4 个，超限直接抛错。
- 四代被动条目的 `ActionType` 为 `FOURTH_GEN_PASSIVE`，不会进入技能循环、不会被释放，只通过 `FourthGenPresets`（作用本技能）/ `FourthGenGrants`（作用其他技能）改写技能数值。
- 直接内联 `baseSkills` 的裸 scenario，需要把四代被动条目一并写进 `baseSkills`；走 assembler 的上层场景会自动把已佩戴的四代实体选入，无需手填。
- 不传 `equippedFourthGen` 时结果与旧逻辑完全一致（零回归）。

鬼王「玄烛·狱龙破」佩戴前后对比示例见 `examples/simulation_guiwang_fourth_gen.json`（不佩戴 vs 佩戴曦日，增强目标技能「未名斩·玄」）。
