# 长周期有限时域调度优化方案

> 目标：面向 10 分钟及以上战斗，优化逐霜魔技能栏顺序与 `RyhgPhase2DelaySeconds`，使固定时域内总伤害最大化。

---

## 1. 为什么需要新模型

45s 内的 T20/T21/T21高血量搜索主要回答“短战斗如何击杀更快”。10 分钟以上战斗不同：

- 多数技能会按 CD/充能进入循环，而不是只看起手爆发。
- 昭冥《日月弘光》会进入多轮一段/二段循环。
- 《停云凝风》CD 为 135s，长周期内会重复释放；只有第一次释放时间适合作为可控参数。
- 固定时间内总伤最大化，比“击杀时间”或引擎字段 `AverageDps` 更符合长战斗目标。

因此新增脚本 `scratch/optimize_long_duration_schedule.ts`，把问题改成有限时域调度优化。

---

## 2. 数学建模

### 2.1 决策变量

| 变量 | 含义 | 当前默认 |
| :--- | :--- | :--- |
| `order` | 逐霜技能栏顺序 | 候选种子 + 邻域变体 |
| `delay` | `RyhgPhase2DelaySeconds` | 18~28s，步长 1s |
| `T` | 固定战斗时域 | 600s |
| `t_TYNF0` | 停云凝风首次释放时间 | 8s |

### 2.2 约束

1. 技能栏使用当前模拟器规则：每次决策从第一格重新扫描，技能不可用则跳过。
2. 保留短周期搜索中的结构约束：
   - `苍龙 -> 鹰扬`
   - `苍龙煞 -> 鹰扬煞`
   - `临渊` 默认末位
3. 昭冥日月周期：
   - 首次 `1s` 释放日月。
   - 二段在 `delay` 秒后触发；若 `delay >= 30`，按引擎规则在 30s 触发。
   - 二段触发后 35s 日月可再次释放，所以周期为 `min(delay, 30) + 35s`。
4. 停云凝风周期：
   - 首次 `8s`。
   - 之后每 135s 重复。
   - 若释放时被自身动作锁阻塞，脚本使用 `WAIT` 等待可释放。
5. 沿用当前引擎规则：停云凝风不延长日月弘光一段/二段 Buff。

### 2.3 目标函数

固定时域总伤：

```text
maximize Damage(order, delay, T)
```

报告中的“固定时域 DPS”定义为：

```text
Damage(order, delay, T) / T
```

这和引擎 `AverageDps` 不完全相同。`AverageDps` 使用引擎内部 DPS 统计时长，可能从首个有效伤害附近开始；长周期优化以固定时间总伤为准。

---

## 3. 新脚本

脚本路径：

```text
scratch/optimize_long_duration_schedule.ts
```

输出结果：

```text
doc/long_duration_optimization_results.md
```

### 3.1 默认执行

```powershell
chcp 65001 > $null
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
npx tsx scratch/optimize_long_duration_schedule.ts
```

默认参数：

- `--mode=seeds`
- `--duration=600`
- `--delay=18:28`
- `--top=20`
- `--repeat-ryhg=true`
- `--repeat-tynf=true`
- `--tynf-first=8`

### 3.2 邻域搜索

```powershell
npx tsx scratch/optimize_long_duration_schedule.ts --mode=local --max-candidates=50 --duration=600 --delay=21:24 --top=20
```

`local` 会在候选种子基础上生成：

- 相邻技能交换。
- 单个技能挪动到其他栏位。

`--max-candidates` 用来控制运行时间。长周期单次仿真比 45s 仿真慢很多，不建议一开始直接跑全排列。

### 3.3 常用参数

| 参数 | 说明 | 示例 |
| :--- | :--- | :--- |
| `--duration` | 固定时域秒数 | `--duration=900` |
| `--delay` | delay 列表或范围 | `--delay=18:28`、`--delay=20,22,23,24` |
| `--mode` | `seeds` 或 `local` | `--mode=local` |
| `--max-candidates` | local 模式候选上限 | `--max-candidates=120` |
| `--tynf-first` | 停云首次释放时间 | `--tynf-first=8` |
| `--repeat-tynf` | 是否重复停云 | `--repeat-tynf=false` |
| `--repeat-ryhg` | 是否重复日月 | `--repeat-ryhg=false` |
| `--output` | 输出结果文件 | `--output=doc/long_duration_900s_results.md` |

---

## 4. 当前验证结论

已执行：

```powershell
npx tsx scratch/optimize_long_duration_schedule.ts --mode=local --max-candidates=50 --duration=600 --delay=21:24 --top=20
```

结果文件：

```text
doc/long_duration_optimization_results.md
```

当前 600s 邻域搜索最优：

| 项 | 结果 |
| :--- | :--- |
| 候选 | `HighHP_base` |
| Delay | `23s` |
| 技能顺序 | 枕戈 -> 山雨III -> 龙战 -> 山雨II -> 苍龙煞 -> 清啸 -> 苍龙 -> 鹰扬煞 -> 鹰扬 -> 银鳞 -> 临渊 |
| 600s 总伤 | 26736.9亿 |
| 固定时域 DPS | 4,456,147,450 |

Top 结果显示 `HighHP_base` 的 `21~24s` 全部压过当前局部邻域变体，其中 `23s` 最高，`22s` 次之。说明长周期下应优先采用高血量短测顺序，而不是 T20/T21 短击杀顺序。

---

## 5. 后续扩展

建议按以下顺序扩大搜索：

1. `600s seeds`：确认候选种子是否稳定。
2. `600s local --delay=21:24 --max-candidates=120`：扩大局部邻域。
3. `900s seeds/local`：检查 10 分钟以上更长时域是否改变 delay。
4. 如结果仍稳定，再考虑把 `HighHP_base` 周边做二阶邻域，而不是直接全排列。

直接全排列在长周期下成本很高，不建议作为第一步。当前更合理的策略是以有限时域目标做局部搜索，并持续扩大候选邻域。
