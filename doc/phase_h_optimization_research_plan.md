# 日月弘光2段延迟 × 技能栏顺序 联合优化研究计划 (V4)

> **目标**：找到逐霜魔阵营下，`RyhgPhase2DelaySeconds` 与技能栏排列的最优组合，使 T20/T21/T21高血量 Boss 的击杀效率最高。
> **每个场景独立测试、独立出结论。**

---

## 1. 固定位置与可变技能

### 1.1 默认固定位置（不参与排列）

| 位置 | 技能 | 原因 |
| :--- | :--- | :--- |
| **末位（第11位）** | 临渊敛爪（ZS_MO_SKILL_LYLZ） | 填充技能，最低优先级 |

> 说明：默认模式不再固定枕戈待旦、清啸横朔、龙战于野的位置。这样可以直接比较“核心状态全上再输出”和“先输出、过程中补状态”两类策略。临渊敛爪仍默认固定末位；如果要连临渊也完全参与搜索，可使用脚本的 `--mode=all-movable`。

### 1.2 默认可变技能（占据第1~10位，共10个槽位）

| 技能ID | 技能名 | 约束条件 |
| :--- | :--- | :--- |
| ZS_MO_SKILL_ZGDD | 枕戈待旦 | 不固定；参与第1~10位搜索 |
| ZS_MO_SKILL_QXHS | 清啸横朔 | 不固定；参与第1~10位搜索 |
| ZS_MO_SKILL_LZYY | 龙战于野 | 不固定；参与第1~10位搜索 |
| ZS_MO_SKILL_SY2 | 山雨欲来II | 无 |
| ZS_MO_SKILL_SY3 | 山雨欲来III | 无 |
| ZS_MO_SKILL_CLX | 苍龙啸 | 必须排在鹰扬折冲之前 |
| ZS_MO_SKILL_YYZC | 鹰扬折冲 | 必须排在苍龙啸之后 |
| ZS_MO_SKILL_CLXS | 苍龙啸·煞 | 必须排在鹰扬折冲·煞之前 |
| ZS_MO_SKILL_YYZC_SHA | 鹰扬折冲·煞 | 必须排在苍龙啸·煞之后 |
| ZS_MO_SKILL_YLXB | 银鳞玄冰 | 无 |

### 1.3 有效排列数

默认模式 `buffs-movable` 下，10个技能的全排列 = 10! = 3,628,800。两个独立的有序对约束各淘汰一半：
- 有效排列数 = 3,628,800 / 4 = **907,200 种**

可选模式：

| 模式 | 含义 | 有效排列数 | 预估仿真时间 |
| :--- | :--- | :--- | :--- |
| `buffs-movable` | 默认；枕戈/清啸/龙战与主要输出技能全参与搜索，临渊末位 | 907,200 | 约 146.5 小时（约 6.1 天） |
| `v3-fixed` | 旧版收窄搜索；枕戈第1、龙战第3、临渊末位，清啸参与第2与第4~10位 | 10,080 | 约 1.6 小时 |
| `all-movable` | 11个技能全部参与搜索，连临渊也不固定 | 9,979,200 | 约 1,611 小时（约 67.1 天） |

---

## 2. 测试变量

### 2.1 RyhgPhase2DelaySeconds

**范围 0~30，每 1s 一个，共 31 个值**

### 2.2 测试场景（各自独立）

| 场景 | 副本ID | Boss ID | Boss 血量 | 停止条件 |
| :--- | :--- | :--- | :--- | :--- |
| **T20 赤梭** | ZHENHAI_DUANLANG_T20 | CHI_SUO_T20 | 1244.7 亿 | 击杀或45s |
| **T21 赤梭** | ZHENHAI_DUANLANG_T21 | CHI_SUO_T21 | 1968.3 亿 | 击杀或45s |
| **T21 高血量** | ZHENHAI_DUANLANG_T21 | CHI_SUO_T21 | **5000 亿**（覆盖） | 45s（比剩余血量） |

---

## 3. 执行方案（单阶段全量扫描）

默认模式下，枕戈待旦、清啸横朔、龙战于野均进入可变池。本次以全量扫描为准，不做 delay 粗筛，避免启发式筛选漏掉某个顺序下的真实最优 delay：

- 每个场景：907,200 排列 × 31 delay = **28,123,200 次仿真**
- 3 个场景合计：**84,369,600 次仿真**
- 按 160 sims/s 估算，约 **146.5 小时（约 6.1 天）**；若本机实际速度更高/更低，以控制台进度 ETA 为准

### 3.1 排名规则（每个场景独立排名）

1. **已击杀**的组合优先于**未击杀**的组合
2. 已击杀的组合按 **击杀时间升序** 排名
3. 未击杀的组合按 **Boss剩余血量升序**（=造成伤害最多）排名

---

## 4. 脚本修改要点

基于上一版 `scratch/optimize_ryhg_and_order.ts`，需要修改：

1. **默认固定位置**：仅固定 LYLZ 末位；ZGDD、QXHS、LZYY 都参与搜索
2. **可变技能**：默认 10 个，占据第1~10位
3. **排列生成**：默认有效排列应为 907,200；保留 `CLX -> YYZC` 与 `CLXS -> YYZC_SHA` 两个有序约束
4. **单阶段全量扫描**：直接扫描 31 delay × 907,200 排列，禁止用 delay 粗筛替代全量搜索
5. **三个场景独立运行**，各自输出独立的 Top 20 排行表
6. **状态策略分组**：额外输出首个伤害前已完成 0/1/2/3 个核心状态时的各组最优结果
7. **输出结果到文件**：生成 `doc/optimization_results.md`
8. **一致性修正**：脚本中的辅助默认属性、四代品质写入逻辑应尽量与 `SimulationArena.tsx` 保持一致，避免 CLI 与网页复现不一致

---

## 5. 执行命令

在项目根目录执行。Windows 终端必须先切 UTF-8，否则中文进度会显示为乱码。

### PowerShell（推荐）

```powershell
chcp 65001 > $null
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
npx tsx scratch/optimize_ryhg_and_order.ts 2>&1 | Tee-Object -FilePath scratch/optimization_run.log
```

较窄的 `v3-fixed` 搜索：

```powershell
chcp 65001 > $null
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
npx tsx scratch/optimize_ryhg_and_order.ts --mode=v3-fixed 2>&1 | Tee-Object -FilePath scratch/optimization_run_v3_fixed.log
```

### cmd.exe

cmd 没有 `Tee-Object`，不能直接使用 PowerShell 的管道命令。若只需要写日志：

```bat
chcp 65001 > nul
npx tsx scratch\optimize_ryhg_and_order.ts --mode=v3-fixed > scratch\optimization_run_v3_fixed.log 2>&1
```

若在 cmd 里也想同时显示进度并写日志，可以从 cmd 调用 PowerShell：

```bat
powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); npx tsx scratch/optimize_ryhg_and_order.ts --mode=v3-fixed 2>&1 | Tee-Object -FilePath scratch/optimization_run_v3_fixed.log"
```

可选参数：

```bash
# 仅验证搜索规模，不执行仿真
npx tsx scratch/optimize_ryhg_and_order.ts --dry-run

# 跑旧版较窄的 V3 搜索空间
npx tsx scratch/optimize_ryhg_and_order.ts --mode=v3-fixed

# 连临渊敛爪也参与全排列
npx tsx scratch/optimize_ryhg_and_order.ts --mode=all-movable
```

---

## 6. 输出文件内容（`doc/optimization_results.md`）

脚本自动生成的结果文件，包含：

1. **测试参数概要**：排列数、delay范围、场景列表
2. **每个场景的 Top 20 排行表**：
   - 排名、Delay、击杀时间/剩余血量、平均DPS、技能顺序
3. **每个场景的状态策略分组最优**：
   - 首个伤害前完成 0/1/2/3 个核心状态的各自最优组合
4. **每个场景的最优组合详情**：
   - 完整技能顺序
   - 技能伤害占比
5. **三场景对比总结**：最优 delay 和顺序是否一致

---

## 7. 结果判断标准

### 7.1 如何确定每个场景的最优

- T20/T21：直接看 **击杀时间最短** 的组合
- T21 高血量：看 **Boss剩余血量百分比最低** 的组合

### 7.2 最终决策

- 如果三个场景的最优顺序和 delay **一致**：直接采用
- 如果三个场景的最优 **不一致**（大概率）：以 **T21 赤梭** 为主基准，T20 和高血量作为参考
- 最终将选定的 delay 和顺序更新到 `default_overrides.json` 和 `SimulationArena.tsx`

### 7.3 正确性验证

- 将最优组合代入网页前端仿真，确认击杀时间与脚本输出一致
- 如最终结果显示“非三状态全上再输出”更优，应再抽取 Top 组合与三状态组最优组合的起手时间轴或累计伤害对照，解释收益来源
