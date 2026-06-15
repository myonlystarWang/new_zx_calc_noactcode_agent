# 日月弘光2段延迟 × 技能顺序 联合优化结果

> 生成时间: 2026-06-12T08:30:27.233Z

## 测试参数

- 搜索模式: **v3-fixed** (V3 fixed: ZGDD pos1, LZYY inserted at pos3, LYLZ last)
- 有效排列数: **10,080**
- Delay 范围: **0~30s** (每1s一个, 共31个)
- 每场景仿真次数: **312,480**
- 总仿真次数: **937,440**
- Top保留数量: **50**
- 总耗时: **6175.4s**

## 状态策略分类

- `3_states_before_first_damage`: 首个伤害技能前已经完成枕戈、清啸、龙战。
- `2_states_before_first_damage`: 首个伤害技能前完成其中两个核心状态。
- `1_state_before_first_damage`: 首个伤害技能前只完成一个核心状态。
- `0_states_before_first_damage`: 首个动作就是伤害技能。

---

## T20 赤梭 (1244.7亿HP)

### Top 排行

| 排名 | Delay(s) | 结果 | 平均DPS | 状态策略 | ZGDD/QXHS/LZYY位置 | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 3 | 18.247s | 8,929,311,826 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 2 | 3 | 18.247s | 8,929,311,826 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 3 | 3 | 18.247s | 8,929,311,826 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 4 | 2 | 18.353s | 8,861,925,592 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 5 | 4 | 18.353s | 8,861,925,592 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 6 | 2 | 18.353s | 8,861,925,592 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 7 | 4 | 18.353s | 8,861,925,592 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 8 | 2 | 18.353s | 8,861,925,592 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 9 | 4 | 18.353s | 8,861,925,592 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 10 | 3 | 18.460s | 8,794,927,355 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 11 | 3 | 18.460s | 8,794,927,355 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 12 | 3 | 18.460s | 8,794,927,355 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 13 | 3 | 18.460s | 8,794,927,355 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 银鳞 -> 山雨III -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 14 | 5 | 18.460s | 8,794,927,355 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 15 | 5 | 18.460s | 8,794,927,355 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 16 | 2 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 17 | 3 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 18 | 2 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 19 | 3 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 20 | 3 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 21 | 4 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 22 | 3 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 23 | 4 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 24 | 3 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 25 | 4 | 18.513s | 8,111,208,579 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 26 | 5 | 18.567s | 8,728,934,562 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 27 | 3 | 18.567s | 8,761,498,336 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 银鳞 -> 山雨II -> 山雨III -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 28 | 2 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 29 | 3 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 30 | 4 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 31 | 4 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 32 | 4 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 33 | 2 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 34 | 3 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 35 | 2 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 36 | 2 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 37 | 2 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 38 | 3 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 39 | 4 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 40 | 3 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 41 | 4 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 42 | 3 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 43 | 4 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 44 | 2 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 45 | 3 | 18.620s | 8,055,044,772 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 46 | 2 | 18.673s | 8,664,527,834 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 47 | 4 | 18.673s | 8,664,527,834 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 48 | 2 | 18.673s | 8,664,527,834 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 49 | 4 | 18.673s | 8,664,527,834 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 50 | 2 | 18.673s | 8,664,527,834 | 3_states_before_first_damage | ZGDD@1, QXHS@2, LZYY@3 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |

### 各状态策略分组最优

| 状态策略 | Delay(s) | 结果 | 平均DPS | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- |
| 3_states_before_first_damage | 3 | 18.247s | 8,929,311,826 | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 2_states_before_first_damage | - | - | - | - |
| 1_state_before_first_damage | 2 | 18.513s | 8,111,208,579 | 枕戈 -> 山雨II -> 龙战 -> 山雨III -> 清啸 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 0_states_before_first_damage | - | - | - | - |

### 最优组合详情

```
Delay: 3s
击杀时间: 18.247s
平均DPS: 8,929,311,826
状态策略: 3_states_before_first_damage
完整技能顺序: 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊

技能伤害占比:
  苍龙啸·煞           41.95% (522.1亿)
  山雨欲来III         25.16% (313.1亿)
  山雨欲来II          15.54% (193.5亿)
  苍龙啸              9.50% (118.2亿)
  银鳞玄冰             7.85% (97.8亿)
```

---

## T21 赤梭 (1968.3亿HP)

### Top 排行

| 排名 | Delay(s) | 结果 | 平均DPS | 状态策略 | ZGDD/QXHS/LZYY位置 | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 16 | 32.313s | 6,753,235,950 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 2 | 17 | 32.420s | 6,728,534,338 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 3 | 15 | 32.527s | 6,704,012,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 4 | 18 | 32.527s | 6,704,012,772 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 5 | 19 | 32.633s | 6,679,895,982 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 6 | 16 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 7 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 8 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 9 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 10 | 16 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 11 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 12 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 苍龙 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 13 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 银鳞 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 14 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 15 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 16 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 17 | 20 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 18 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 19 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 20 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 银鳞 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 21 | 16 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| 22 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| 23 | 16 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 鹰扬 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 24 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 鹰扬 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 25 | 16 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 鹰扬 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 26 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 鹰扬 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 27 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 银鳞 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 28 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@7, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 银鳞 -> 清啸 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 29 | 16 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 30 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 31 | 17 | 32.740s | 6,655,727,015 | 1_state_before_first_damage | ZGDD@1, QXHS@7, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 苍龙 -> 清啸 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 32 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 33 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 34 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 苍龙煞 -> 苍龙 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 35 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@4, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 清啸 -> 山雨II -> 银鳞 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 36 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 37 | 18 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 38 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 39 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙 -> 银鳞 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 40 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 41 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 银鳞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 42 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@5, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 银鳞 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 43 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 苍龙煞 -> 鹰扬 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| 44 | 17 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 苍龙煞 -> 鹰扬 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| 45 | 17 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 苍龙煞 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 46 | 17 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 47 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 银鳞 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 48 | 18 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 清啸 -> 银鳞 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 49 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@7, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 鹰扬 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| 50 | 16 | 32.847s | 6,631,732,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬 -> 鹰扬煞 -> 银鳞 -> 临渊 |

### 各状态策略分组最优

| 状态策略 | Delay(s) | 结果 | 平均DPS | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- |
| 3_states_before_first_damage | 17 | 33.153s | 6,823,469,979 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 临渊 |
| 2_states_before_first_damage | - | - | - | - |
| 1_state_before_first_damage | 16 | 32.313s | 6,753,235,950 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 0_states_before_first_damage | - | - | - | - |

### 最优组合详情

```
Delay: 16s
击杀时间: 32.313s
平均DPS: 6,753,235,950
状态策略: 1_state_before_first_damage
完整技能顺序: 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊

技能伤害占比:
  苍龙啸·煞           27.18% (534.9亿)
  苍龙啸             26.15% (514.7亿)
  山雨欲来III         25.24% (496.8亿)
  山雨欲来II          16.68% (328.4亿)
  银鳞玄冰             4.75% (93.5亿)
```

---

## T21 高血量 (5000亿HP)

### Top 排行

| 排名 | Delay(s) | 结果 | 平均DPS | 状态策略 | ZGDD/QXHS/LZYY位置 | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 29 | 剩余49.88% | 5,992,618,770 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 2 | 29 | 剩余49.98% | 6,042,670,130 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 3 | 28 | 剩余49.98% | 6,042,660,587 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 4 | 28 | 剩余49.99% | 5,979,154,011 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 5 | 29 | 剩余50.04% | 6,035,122,734 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬 -> 鹰扬煞 -> 临渊 |
| 6 | 29 | 剩余50.04% | 5,985,293,718 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 银鳞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 7 | 29 | 剩余50.04% | 5,985,293,718 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 8 | 29 | 剩余50.06% | 6,048,731,941 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 9 | 29 | 剩余50.06% | 6,031,842,569 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 10 | 29 | 剩余50.07% | 6,047,637,263 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 11 | 28 | 剩余50.08% | 6,030,161,764 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 12 | 30 | 剩余50.09% | 5,967,868,520 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 13 | 28 | 剩余50.10% | 5,977,889,372 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 银鳞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 14 | 28 | 剩余50.10% | 5,977,889,372 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 15 | 26 | 剩余50.11% | 5,965,532,028 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 16 | 29 | 剩余50.13% | 6,024,295,174 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 鹰扬煞 -> 临渊 |
| 17 | 27 | 剩余50.14% | 5,961,793,558 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 18 | 28 | 剩余50.15% | 6,038,566,967 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 19 | 28 | 剩余50.16% | 6,037,472,289 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 20 | 25 | 剩余50.17% | 5,957,254,086 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 21 | 28 | 剩余50.19% | 6,016,316,833 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬 -> 鹰扬煞 -> 临渊 |
| 22 | 29 | 剩余50.22% | 5,970,556,514 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 银鳞 -> 龙战 -> 山雨II -> 山雨III -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 23 | 30 | 剩余50.24% | 5,960,986,002 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 24 | 30 | 剩余50.24% | 5,960,986,002 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 银鳞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 25 | 28 | 剩余50.28% | 5,963,436,175 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 银鳞 -> 龙战 -> 山雨II -> 山雨III -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 26 | 30 | 剩余50.28% | 6,005,531,438 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 27 | 28 | 剩余50.30% | 6,003,818,011 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 鹰扬煞 -> 临渊 |
| 28 | 30 | 剩余50.31% | 6,002,332,089 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 29 | 30 | 剩余50.33% | 6,000,236,311 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬 -> 鹰扬煞 -> 临渊 |
| 30 | 30 | 剩余50.37% | 6,011,622,052 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 31 | 30 | 剩余50.37% | 5,994,784,693 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 鹰扬煞 -> 临渊 |
| 32 | 27 | 剩余50.37% | 5,994,603,534 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 33 | 27 | 剩余50.37% | 5,994,603,534 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 34 | 30 | 剩余50.38% | 6,010,527,374 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 35 | 24 | 剩余50.39% | 5,931,606,487 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 36 | 29 | 剩余50.41% | 5,938,653,080 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 37 | 23 | 剩余50.44% | 5,925,407,632 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 38 | 27 | 剩余50.49% | 5,997,453,628 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 39 | 27 | 剩余50.50% | 5,996,358,951 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 40 | 27 | 剩余50.53% | 5,927,311,342 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 41 | 27 | 剩余50.53% | 5,927,311,342 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 银鳞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 42 | 28 | 剩余50.53% | 5,927,175,668 | 1_state_before_first_damage | ZGDD@1, QXHS@8, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 清啸 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 43 | 24 | 剩余50.53% | 5,975,073,072 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 44 | 24 | 剩余50.53% | 5,975,073,072 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙煞 -> 鹰扬煞 -> 苍龙 -> 鹰扬 -> 临渊 |
| 45 | 29 | 剩余50.54% | 5,926,032,617 | 1_state_before_first_damage | ZGDD@1, QXHS@8, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 清啸 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| 46 | 30 | 剩余50.54% | 5,931,516,220 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 银鳞 -> 龙战 -> 山雨II -> 山雨III -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 47 | 29 | 剩余50.57% | 5,931,063,185 | 1_state_before_first_damage | ZGDD@1, QXHS@9, LZYY@3 | 枕戈 -> 银鳞 -> 龙战 -> 山雨II -> 山雨III -> 苍龙煞 -> 苍龙 -> 鹰扬煞 -> 清啸 -> 鹰扬 -> 临渊 |
| 48 | 25 | 剩余50.58% | 5,986,712,821 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 银鳞 -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |
| 49 | 28 | 剩余50.58% | 5,918,527,497 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 鹰扬 -> 苍龙煞 -> 鹰扬煞 -> 临渊 |
| 50 | 25 | 剩余50.59% | 5,985,618,143 | 1_state_before_first_damage | ZGDD@1, QXHS@6, LZYY@3 | 枕戈 -> 山雨III -> 龙战 -> 银鳞 -> 山雨II -> 清啸 -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 鹰扬 -> 临渊 |

### 各状态策略分组最优

| 状态策略 | Delay(s) | 结果 | 平均DPS | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- |
| 3_states_before_first_damage | 28 | 剩余51.21% | 6,112,553,970 | 枕戈 -> 清啸 -> 龙战 -> 山雨II -> 山雨III -> 苍龙 -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 鹰扬 -> 临渊 |
| 2_states_before_first_damage | - | - | - | - |
| 1_state_before_first_damage | 29 | 剩余49.88% | 5,992,618,770 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 0_states_before_first_damage | - | - | - | - |

### 最优组合详情

```
Delay: 29s
未击杀 - 剩余血量: 49.88%
平均DPS: 5,992,618,770
状态策略: 1_state_before_first_damage
完整技能顺序: 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊

技能伤害占比:
  山雨欲来III         28.37% (711.0亿)
  苍龙啸             27.70% (694.1亿)
  苍龙啸·煞           19.61% (491.4亿)
  山雨欲来II          17.28% (432.9亿)
  临渊敛爪             3.99% (100.0亿)
  银鳞玄冰             3.06% (76.7亿)
```

---

## 综合对比

| 场景 | 最优Delay | 结果 | 平均DPS | 状态策略 | 完整顺序 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T20 赤梭 (1244.7亿HP) | 3s | 18.247s | 8,929,311,826 | 3_states_before_first_damage | 枕戈 -> 清啸 -> 龙战 -> 山雨III -> 山雨II -> 苍龙煞 -> 鹰扬煞 -> 银鳞 -> 苍龙 -> 鹰扬 -> 临渊 |
| T21 赤梭 (1968.3亿HP) | 16s | 32.313s | 6,753,235,950 | 1_state_before_first_damage | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 清啸 -> 苍龙煞 -> 苍龙 -> 鹰扬 -> 银鳞 -> 鹰扬煞 -> 临渊 |
| T21 高血量 (5000亿HP) | 29s | 剩余49.88% | 5,992,618,770 | 1_state_before_first_damage | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
