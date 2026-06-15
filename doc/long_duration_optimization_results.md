# 长周期有限时域调度优化结果

> 生成时间: 2026-06-12T09:23:08.924Z

## 测试参数

- 优化目标: **固定时域总伤最大化**，固定时域 DPS = 总伤 / 600s
- 搜索模式: **local**
- 候选顺序数: **50**
- Delay 范围: **21, 22, 23, 24s**
- 总仿真次数: **200**
- 时域长度: **600s**
- Boss: **ZHENHAI_DUANLANG_T21 / CHI_SUO_T21**，血量覆盖 999,999,999,999,999
- 日月弘光: 按 delay + 35s 周期重复，首次 1.0s
- 停云凝风: 从 8.0s 开始每 135s 重复
- 总耗时: **147.0s**

> 注意：当前引擎中停云凝风不会延长日月弘光一段/二段 Buff；本脚本沿用该规则。

## Top 排行

| 排名 | 候选 | Delay(s) | 总伤 | 固定时域DPS | 引擎AverageDPS | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | HighHP_base | 23 | 26736.9亿 | 4,456,147,450 | 4,480,453,912 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 2 | HighHP_base | 22 | 26724.0亿 | 4,453,998,149 | 4,478,292,887 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 3 | HighHP_base | 24 | 26690.2亿 | 4,448,363,896 | 4,472,627,903 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 4 | HighHP_base | 21 | 26654.0亿 | 4,442,333,270 | 4,466,564,382 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 5 | HighHP_base_move_1_to_4 | 24 | 26563.0亿 | 4,427,160,925 | 4,445,067,137 | 山雨III -> 龙战 -> 山雨II -> 枕戈 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 6 | HighHP_base_adj_7_8 | 22 | 26469.8亿 | 4,411,636,173 | 4,435,380,242 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 临渊 |
| 7 | HighHP_base_adj_7_8 | 23 | 26450.7亿 | 4,408,442,334 | 4,432,169,213 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 临渊 |
| 8 | QX_before_LZ | 23 | 26420.2亿 | 4,403,368,404 | 4,427,179,250 | 枕戈 -> 山雨III -> 清啸 -> 龙战 -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 9 | SY2_before_LZ | 23 | 26405.6亿 | 4,400,931,987 | 4,425,055,917 | 枕戈 -> 山雨III -> 山雨II -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 10 | HighHP_base_move_4_to_6 | 23 | 26404.1亿 | 4,400,685,617 | 4,425,342,148 | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 山雨II -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 11 | HighHP_base_move_4_to_6 | 22 | 26396.9亿 | 4,399,479,286 | 4,424,129,059 | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 山雨II -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 12 | HighHP_base_move_1_to_4 | 23 | 26389.7亿 | 4,398,276,702 | 4,416,066,088 | 山雨III -> 龙战 -> 山雨II -> 枕戈 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 13 | HighHP_base_move_2_to_4 | 23 | 26385.4亿 | 4,397,563,852 | 4,424,672,344 | 枕戈 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 14 | QX_before_LZ | 22 | 26374.4亿 | 4,395,732,641 | 4,419,502,197 | 枕戈 -> 山雨III -> 清啸 -> 龙战 -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 15 | HighHP_base_move_2_to_4 | 22 | 26359.9亿 | 4,393,318,159 | 4,420,400,479 | 枕戈 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 16 | SY2_before_LZ | 22 | 26357.8亿 | 4,392,970,452 | 4,417,050,740 | 枕戈 -> 山雨III -> 山雨II -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 17 | HighHP_base_adj_7_8 | 21 | 26346.9亿 | 4,391,149,597 | 4,414,783,404 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 临渊 |
| 18 | HighHP_base_move_4_to_1 | 23 | 26328.5亿 | 4,388,080,211 | 4,405,997,936 | 山雨II -> 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 19 | QX_before_LZ | 24 | 26305.2亿 | 4,384,206,950 | 4,407,914,182 | 枕戈 -> 山雨III -> 清啸 -> 龙战 -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 20 | HighHP_base_adj_1_2 | 24 | 26303.6亿 | 4,383,928,872 | 4,401,115,227 | 山雨III -> 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |

## 最优组合详情

```
候选: HighHP_base
来源: 45s high-HP best + 600s sample winner
Delay: 23s
总伤: 26736.9亿
固定时域DPS: 4,456,147,450
引擎AverageDPS: 4,480,453,912
DPS统计时长: 596.7s
完整技能顺序: 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊

技能伤害占比:
  山雨欲来III         29.72% (7944.9亿)
  苍龙啸             28.64% (7656.6亿)
  山雨欲来II          17.79% (4757.8亿)
  苍龙啸·煞           14.36% (3839.8亿)
  临渊敛爪             8.37% (2237.9亿)
  银鳞玄冰             1.12% (299.8亿)
```

### 施放次数

| 技能 | 次数 | 首次 | 末次 |
| :--- | :--- | :--- | :--- |
| 枕戈 | 10 | 2.0s | 544.8s |
| 山雨III | 180 | 3.0s | 598.1s |
| 龙战 | 15 | 4.0s | 574.9s |
| 山雨II | 91 | 4.5s | 598.8s |
| 苍龙煞 | 61 | 5.1s | 589.4s |
| 清啸 | 34 | 8.7s | 593.9s |
| 苍龙 | 184 | 9.8s | 599.6s |
| 鹰扬煞 | 10 | 14.9s | 569.6s |
| 鹰扬 | 10 | 21.2s | 597.6s |
| 银鳞 | 4 | 28.6s | 502.1s |
| 临渊 | 173 | 31.8s | 582.2s |
| 日月 | 11 | 1.0s | 581.0s |
| 停云 | 5 | 8.0s | 548.0s |

## 候选说明

| 候选 | 来源 | 顺序 |
| :--- | :--- | :--- |
| HighHP_base | 45s high-HP best + 600s sample winner | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| T21_best | v3_fixed T21 winner | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| T20_best | v3_fixed T20 winner | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| Arena_default | SimulationArena default skill bar | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| BuffFirst | all three core states before first damage | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| QX_before_LZ | local variant around HighHP_base | 枕戈 -> 山雨III -> 清啸 -> 龙战 -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| SY2_before_LZ | local variant around HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| ShaReset_early | local variant around HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 清啸 -> 苍龙 -> 鹰扬 -> 银鳞 -> 临渊 |
| YLXB_before_resets | local variant around HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 银鳞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| ResetEarly | manual reset-priority baseline | 枕戈 -> 清啸 -> 龙战 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 山雨III -> 山雨II -> 银鳞 -> 临渊 |
| DamageFirst | late state baseline | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 清啸 -> 龙战 -> 银鳞 -> 临渊 |
| HighHP_base_adj_1_2 | adjacent swap from HighHP_base | 山雨III -> 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_adj_2_3 | adjacent swap from HighHP_base | 枕戈 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_adj_4_5 | adjacent swap from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 山雨II -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_adj_5_6 | adjacent swap from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_adj_6_7 | adjacent swap from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 苍龙 -> 清啸 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_adj_7_8 | adjacent swap from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_adj_8_9 | adjacent swap from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| HighHP_base_adj_9_10 | adjacent swap from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| HighHP_base_move_1_to_3 | single move from HighHP_base | 山雨III -> 龙战 -> 枕戈 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_4 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 枕戈 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_5 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 枕戈 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_6 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 枕戈 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_7 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 枕戈 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_8 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 枕戈 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_9 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 枕戈 -> 银鳞 -> 临渊 |
| HighHP_base_move_1_to_10 | single move from HighHP_base | 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 枕戈 -> 临渊 |
| HighHP_base_move_2_to_4 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_2_to_5 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 山雨III -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_2_to_6 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 山雨III -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_2_to_7 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 山雨III -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_2_to_8 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 山雨III -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_2_to_9 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 山雨III -> 银鳞 -> 临渊 |
| HighHP_base_move_2_to_10 | single move from HighHP_base | 枕戈 -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 山雨III -> 临渊 |
| HighHP_base_move_3_to_1 | single move from HighHP_base | 龙战 -> 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_3_to_5 | single move from HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 龙战 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_3_to_6 | single move from HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 龙战 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_3_to_7 | single move from HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 龙战 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_3_to_8 | single move from HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 龙战 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_3_to_9 | single move from HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 龙战 -> 银鳞 -> 临渊 |
| HighHP_base_move_3_to_10 | single move from HighHP_base | 枕戈 -> 山雨III -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 龙战 -> 临渊 |
| HighHP_base_move_4_to_1 | single move from HighHP_base | 山雨II -> 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_4_to_2 | single move from HighHP_base | 枕戈 -> 山雨II -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_4_to_6 | single move from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 山雨II -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_4_to_7 | single move from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 山雨II -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_4_to_8 | single move from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 山雨II -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_4_to_9 | single move from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 山雨II -> 银鳞 -> 临渊 |
| HighHP_base_move_4_to_10 | single move from HighHP_base | 枕戈 -> 山雨III -> 龙战 -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 山雨II -> 临渊 |
| HighHP_base_move_5_to_1 | single move from HighHP_base | 苍龙煞 -> 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| HighHP_base_move_5_to_2 | single move from HighHP_base | 枕戈 -> 苍龙煞 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
