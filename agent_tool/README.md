# 诛仙 3 Hermes 伤害计算工具

这是给 Hermes/agent 调用的无 UI 计算入口。微信自然语言由 Hermes 解析成 JSON，本工具只做确定性计算并输出 JSON。

## 安装与运行

```bash
cd /mnt/e/ww/personal\ work/new_zx_calc_noactcode_agent/agent_tool
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
