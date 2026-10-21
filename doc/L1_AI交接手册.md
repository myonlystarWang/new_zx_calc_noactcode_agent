# L1 意图匹配演进 · AI 交接手册

> 用途：新 AI 接手 L1（AI 对话意图匹配）开发时，**先读本文档再动代码**。目标是延续"严谨、专业、高正确率"的工作风格。
> 维护规则：只追加不覆盖；每条规则/坑必须带"来源轮次"可追溯。
> 配套文档（必读，顺序阅读）：
> 1. `doc/AI对话全链路说明书与意图匹配维护指南.md`（设计态唯一真相，尤其第六/七章）
> 2. `doc/L1意图匹配演进任务清单.md`（执行态唯一真相：状态总览/待办/证据存档）
> 3. 本手册（怎么干活：协作规则/工作流/踩坑库/数据事实）

---

## 一、项目上下文（30 秒版）

- 项目：诛仙 3 伤害分析工具（web_app：React 19 + Vite 5 + Tailwind v3），线上 `zxarena.raddishlab.tech`（Cloudflare Pages，push 自动构建）
- L1 = `web_app/src/services/CopilotService.ts` 的 `matchLocalIntent`（AI 问答的本地意图匹配层，零成本直出卡片）
- 回归夹具：`scripts/l1_intent_fixture.mjs`（esbuild 打包 + mock DataService + 点路径断言 + golden 快照三层），入口 `npm run test:l1`，当前 **979 条全绿**
- 渲染层：`web_app/src/components/home/HomeAIChatStage.tsx`（各 cardType 的卡片分支）
- 装备进阶关联：`web_app/src/utils/equipSeries.ts`（法身/锦囊/战罡/项链/戒指等升降阶序列）
- 当前分支：`feat/ai-copilot-tools`（SSH origin，github.com 走 ssh.github.com:443）

---

## 二、用户协作规则（硬性，违反=返工）

| # | 规则 | 来源 |
|---|---|---|
| 1 | **新功能先做一版给用户看，确认后才 commit/push**。用户说"入库/推送"才推；只说"做/继续"= 只做到待核对态 | 2026-10-17 v1.2.4 未确认就推送被要求 revert |
| 2 | **不主动扩大用户指示范围**。用户说戒指 lv1 屏蔽就只屏蔽戒指，不做"全库 lv1"（即使判断语义相同/玩家零损失） | 2026-10-16 lv1 扩大被纠 |
| 3 | **遇不清楚立即停下问，禁止猜测推进**；用户质疑时先做数据比对再回应（他的文档记忆力是可靠核查源） | 2026-10-16 删待办池被质疑，比对后发现真丢 2 处 |
| 4 | **文档结构性重组后必须做"重组前后全量比对审计"**：任务编号集合 + 关键信息点 + 日志条数 + 追踪轮次四维脚本比对，不能人工看一眼就删 | 同上 |
| 5 | **用户提的问题要全域排查同型**，不能只修当前实例。"其他按钮机器词"10-16 修了品质系，系列系漏到 10-17 才被抓 | 2026-10-17 |
| 6 | **改动范围只含本次相关文件**；用户工作区并发编辑的文件不擅自 revert/清理，commit 时须在 message 注明含用户编辑 | 2026-10-16 抗性→属性批量替换 |
| 7 | 活文档只追加不覆盖；`doc/web_optimization_plan.md` 由用户本人维护，**AI 不得编辑** | 长期约定 |
| 8 | **L1 回答不跳转既有单页面**（compendium 等路由页），全部内嵌卡片呈现 | 2026-10-17 攻略入口被撤 |
| 9 | 玩家向文案（changelog）**零技术名词**，每条说清"输什么→得什么"；内部组件名（如"战术策略库"）是黑话红线 | 2026-10-16 changelog 两次被退回重写 |
| 10 | **备选方案用数据验证再决策**：用户说"没必要分但如果硬要分可以X"时，先实证 X 的覆盖率/收益再定（如项链七前缀仅覆盖 44% → 采纳"不分类"） | 2026-10-17 T-16b |
| 11 | **用户说"其他"时当面确认口径**："其他/剩余/全部"三个语义差一条补集线——"其他X"= 排除已归系列的剩余 | 2026-10-17 用户暴怒纠正（我将错就错一天） |
| 12 | **分屏窄栏防挤压与极简无套框原则**：右侧分屏展开时左侧 AI 对话栏仅宽 ~420px。严禁冗余说明文字（下方已有按钮/芯片的卡片，头部严禁再用文本复述如“包含 X 个：A、B、C...”或“当前列表（点击...）”）；删除多余副标题和冗余 Tag（如“开服监测 共 6 服”），直接呈现核心芯片/实体操作，杜绝折行挤压；**禁止文字过多套框**（严禁在一个卡片内给状态文字再套深色背景+描边小框，状态一律与战区芯片统一采用呼吸绿点 `●` 呈现），保持视觉干净轻盈 | 2026-10-18 用户明确定规：“删除重复无用内容，左边栏会挤压换行，以后的设计都要考虑记录我这个要求” / “如果文字加框太多了也不好看，样式统一” |
| 13 | **左分屏窄栏表格横向自适应与防换行原则**：卡片包含数据表格/对比表时，表格容器必须包裹 `overflow-x-auto`，内部 table 明确声明 `min-w-[480px]`（或根据列数需要的最小宽度）并配合 `whitespace-nowrap`，彻底防止在左侧最小窄栏宽度（~420px）下单元格发生非预期的挤压换行；数值范围一律统一使用空格连接线 ` - ` 替代 `~` 保持清晰统一 | 2026-10-18 宠物上限对比表折行修复与神机波浪号统一替换 |
| 14 | **卡片原生美学与去繁就简原则**：卡片设计严格遵循游戏内原生 Tooltip / 装备框风格，保持极简轻盈；严禁无意义的重复模式切换/多余底部操作栏，能内嵌在首行右侧的小功能（如「展开上限对比」按钮）尽量靠右内嵌，属性范围紧随属性名，避免层级杂乱 | 2026-10-18 宠物结誓卡片交互极净化反馈 |

---

## 三、L1 开发标准工作流（SOP，按序执行）

```
① 读双文档+memory      指南 + 任务清单 + .workbuddy/memory/ 最近日志
② 数据先行实证          任何"分类/系列/屏蔽"想法，先用 node 脚本统计实证再设计
                       （项链无品质系列、q 字段才是品质，都是实证推翻了原设想）
③ 探针实测              每个新 query 用 --probe 跑，记录 cardType/候选数/totalCount
                       ⚠ 期望值必须实测，禁止拍脑袋
④ 写用例                加 curated 用例（id/input/expect/tags/assert:strong/note 五要素齐全）
⑤ 预跑看失败分类        新用例=golden 缺失；旧用例翻转=逐条确认是"预期变化"还是 bug
                       ⚠ 断言失败必须逐条人工确认，不过不 approve
⑥ --golden 收录         输出"断言失败 0 条"才算数
⑦ 全量验收              test:l1 全绿 + tsc -b 0 错 + vite build 过
                       ⚠ 用户 npm run build = tsc -b && vite build，tsc 红=构建挂
⑧ 变异测试              污染一条期望 → 必须 exit=1 被抓出 → 还原
⑨ 文档同步              任务清单更新日志（只追加、倒序插标题后第一行）
                       + changelog.ts 玩家向条目 + package.json 同号 + change_log.md
⑩ 给核对点              列核对清单给用户（行为表+实测样本），**等确认后才 commit/push**
```

commit message 规范：标题 `feat(l1)/fix(l1)/docs:` + 正文列改动构成 + 验证结果（N 条全绿 + tsc/vite + 变异）。

---

## 四、踩坑库（实现坑 / 验证坑 / 流程坑）

### 4.1 实现坑（matchLocalIntent 内）

| 坑 | 现象 | 根因 | 对策 |
|---|---|---|---|
| cleanTokens 是 AND 语义 | series 多 pattern 注入后零候选 | `for (const ct of cleanTokens) if (!matches) return false` 要求全部命中 | series 用独立 OR 组，**不进 cleanTokens** |
| series label 用 includes 匹配 | "至尊 法身"被法身系列劫持（返回全部法身而非至尊 2 件） | series 命中会跳过 matchedQ 品质过滤 | series 匹配改**精确匹配**（q===label \|\| q===alias） |
| 系列名含品质词 | "神级首饰"含"神级"→ matchedQ 误滤全部 | matchedQ 从 q 提取品质词不过滤语义 | series 命中时跳过品质过滤 |
| equip 品质字段名 | 查 `e.quality` 全空误判"项链无品质系列" | 实际字段是 `e.q`（1710/2836 有值：修武531/昭武529/彰武529/神级108） | 统计前先看数据样例字段 |
| 宽泛词机制 | "所有项链"曾查无 | "所有"进了 cleanTokens AND | `/^(所有\|全部)/` + matchedSlot → 清空 cleanTokens 全量平铺 |
| hub 全覆盖判断 | 品质系 6 部位设"其他"被用户判冗余 | 三系 q 覆盖 100% 无剩余 | 覆盖实证（三系和==全量）才不设；有剩余才设 |
| 装备分支过滤是全局的 | 用户要"锦囊屏蔽神恩"但函数无上下文 | 过滤在 equips.filter 内无 slot 判断 | 限定 `e.slot === '锦囊' && (...)` 精确范围 |
| mock 与真实 DataService 漂移 | class_status 在夹具里走文本兜底 | 真实 getSkillMeta 存在，mock 漏加 | 新分支用到 DataService 方法时同步补 mock |
| render 层 0 值 | 辅助卡显示一排 0 | 数据层直接渲染 | 0/undefined/null/'' 渲染层过滤 |
| slot_hub 标题写死 | 系列系部件显示"请选择品质系列" | 渲染层硬编码，服务端 text 是对的 | 按部件类型分流文案 |
| 「其他X」做成全量 | 用户点"其他项链"出 155 全量而非剩余 | 误解"其他"=全部（正确=补集） | SLOT_SERIES exclude 型条目：排除同 slot 所有其他系列 terms 命中 |
| 机器词只修一层 | displayText 修了气泡，服务端 text/keyword 仍露"所有项链" | 外泄类问题链路有多环 | 链路全覆盖排查：气泡→服务端 text→cardData 字段→前端展示 |
| "合并升级"只做一半 | 太昊 5 档归了神级系列但卡片内不联动 | 查询层归并≠升降阶关联 | equipSeries 序列才是"升级"本体，两件都要做 |
| 技能 11ff11 是合法色 | 按字面屏蔽会清空 78% 技能库 | el_descs 富文本用 ^色码 是 schema 用法 | 屏蔽前先实证命中字段的业务含义（装备 ad=异常/技能 el_descs=合法） |
| boss 卡字段名 | 断言 `cardData.equip.name` 得 undefined | boss 单卡实际字段是 `cardData.name`/`dungeonName`（装备才是 equip） | 断言路径一律先 --probe 看 cardData keys |
| node -e 改 JSON 崩了没写盘 | 4 个期望修正内存改了没落盘，白工 | writeFileSync 在脚本末尾，中途抛错即全丢 | 批量改 JSON/文档一律 .cjs 脚本文件；崩了重跑要用磁盘现状 |
| 卡片在窄栏下挤压换行 | 战区卡文字堆砌（标题缀开服监测/Tag缀共N服/重复文字列表/提示文字），分屏窄栏下高度暴增折行混乱 | 下方已有芯片组件展示的内容，头部严禁再用文字复述；精简标题与Tag，直接呈现实体芯片 | 窄栏防挤压原则（规则 12） |
| 表格在窄分屏下折行挤压 | 宠物对比表未设 min-w，在 ~420px 栏目内单元格强行折行甚至数字被腰斩 | 容器包 `overflow-x-auto`，内部 table 声明 `min-w-[480px]` + `whitespace-nowrap` | 表格横向自适应原则（规则 13） |
| 属性范围波浪号歧义 | 部分属性池用 `~` 且无空格，贴合数字或负号时极难辨认 | 全站属性浮动范围统一使用带空格连接线 ` - ` | 范围连接符规范（规则 13） |

### 4.2 验证坑（夹具/构建）

| 坑 | 现象 | 对策 |
|---|---|---|
| 假绿 | golden approve 时把断言失败一起收进来 | approve 后必须读输出"断言失败 0 条"；不过不进入下一步 |
| 期望值拍脑袋 | 用例红/绿都解释不通 | 所有期望 `--probe` 实测后再写 |
| 矩阵用例是生成物 | 手改 matrix 用例下次被覆盖 | 改期望用 `--generate-matrix` 重生成 |
| 用户并发编辑 | golden 89 条红（抗性→属性批量替换） | 分类脚本按**字段 diff**（text/hintText 逐字段），不用整体 stringify 比对（键序假差异） |
| TS6133 未使用导入 | npm run build 挂（tsc -b 红）而 vite build 过，易漏 | 入库前必跑 tsc -b；用户文件里的也提示他删 |
| bash 双引号反引号 | `node -e "...\`hash\`..."` 反引号被当命令替换，内容被吃成空 | 批量改文档/JSON 用 `.cjs` 脚本文件，不用 node -e 行内 |
| node -e 改文档插错节 | 日志插进提问追踪表/插到倒序日志末尾 | 改前先 grep 确认 anchor 所在节；更新日志是**倒序（最新在上）**，必须插标题后第一行 |
| 新用例 golden 未收录 vs 断言失败 | 两种失败混在一起看花眼 | 预跑时按失败原因分类计数（"golden 中无此用例" / 具体断言差异） |

### 4.3 流程坑

| 坑 | 教训 |
|---|---|
| v1.2.4 未确认就推送 | 用户要 revert 时用 `git revert`（保留历史）；revert 范围以用户指示为准 |
| 删"重复"章节前不比对 | T-05 整项+来源列丢失；删除任何章节前逐行对比两处内容（列集合+逐条事项） |
| 同型问题只修当前实例 | "其他按钮机器词"分两次才修全；用户提问题先 grep 全域同型 |
| 版本合并/拆分 | 1.2.2/1.2.3 合并按用户指示执行；changelog 版本条目 = package.json version 同号 |
| 文档重组双视图 | 1.4 与待办池重复；每节必须声明"唯一视图"归属 |
| swap 脚本二次 indexOf | 交换两行时第二次 indexOf 命中刚插入的新行，等于没换 | 先存两行内容再按索引赋值，勿链式 findIndex |
| 单引号字符串跨行 | node -e/.cjs 里字符串跨行直接 SyntaxError | 用数组 .join 或模板字符串 |

---

## 五、L1 数据事实速查（开发前必读）

### 5.1 数据源

| 文件 | 关键事实 |
|---|---|
| `equip_curated.json` | 品质字段是 `q`（非 quality）；15 部位；佩章整类已屏蔽；1 级戒指已屏蔽 |
| `skills.json` | `_meta.supportRoles` = 31 条职业×阵营档案（name/faction/roleType[support\|dps]/rating/abilities/damageBoost/greenPoint/purplePoint/defenseBreak/focus）；`_meta` 经 `getSkillMeta()` 读取（loadSkills 剥离 _meta 存 skillMeta） |
| `fabao_curated.json` | 法宝名 = `名称` 字段 |
| `dungeons.json` / `dungeons_monsters.json` | 副本词典；T19/T20/T21 各 9 怪（6 Boss + 3 小怪），流波初识/困难各 7 怪（5 Boss + 2 小怪）；同名小怪由母副本 `_ADDS` 并入，boss_candidates 跨难度多候选切换（T-11 闭环） |

### 5.2 匹配链优先级（matchLocalIntent 内顺序）

```
exactFabaoName（法宝精确名全局优先，R1）
→ class_hub（裸职业名→四/五入口卡）
→ class_status（XX状态→supportRoles 档案卡）
→ slot_hub（裸部位名→品质三入口/系列入口）
→ 副本分支 → 装备分支（含 series OR 组+宽泛词+屏蔽过滤）→ 法宝分支 → 技能分支
```

### 5.3 现役机制清单

- **屏蔽规则**（装备分支 equips.filter）：天帝宝库_前缀/测试/作废/废弃/梦入神机/自出洞来无敌手/天机指环/星语/锦囊竞技场+神恩（限锦囊）/八皇御宝+2024玺绶（限玺绶）/戒指 lv=1/佩章整类/门派专属护符
- **series OR 组**：SLOT_SERIES 词库（项链/戒指/锦囊/罡气/法身/玺绶 + _all 跨部位神级首饰），match: prefix/contains/suffix + aliases，**精确匹配** label/alias
- **宽泛词**：`/^(所有|全部)/` + matchedSlot → 清 cleanTokens 全量平铺（hub"其他"按钮的 query，气泡显示 label 不外泄机器词）
- **口语别名**：帽子/盔/冠→头盔、鞋子/鞋/靴/履→靴子（仅 hub 触发用）
- **色调规矩**：所有分流 hub（class_hub/slot_hub/class_status）统一 cyan；指标语义色（增伤玫红/绿点绿/紫点紫/破防琥珀/专注天蓝）
- **exclude 补集**：SLOT_SERIES 的 other 条目（match:exclude）= 排除同 slot 其他系列 terms 命中；「其他X」的真语义
- **太昊/太乙 5 阶**：equipSeries TAIHAO_TIERS/TAIYI_TIERS（0~3星+造化之），11.5 分支优先于印记阶梯
- **11ff11 屏蔽**：装备 JSON.stringify 含 11ff11 即屏蔽（11 件跨服/节日/礼包）；**技能 el_descs 的 ^11ff11 是合法颜色码，禁屏蔽**
- **群英屏蔽**：项链 startsWith 群英（20 件）
- **服名与战区查询（T-06/T-08 三层差异化 UX）**：server_list.json = 9 战区 36 服。分为三层交互：① 单服名/拼音/ID命中 → single_server 卡（展示所属战区、心跳状态、端口与服ID，卡片按钮直接分屏聚焦监控该服）；② 9 大战区命中 → zhanqu 卡（卡内平铺该战区全部服务器状态，点击任意服直达，卡片按钮直接分屏定位该战区）；③ 开服/宏观词 → radar 卡（全区开服雷达卡片，卡片按钮分屏进入开服雷达）。全链路支持 workspaceParams 动态深度联动。
- **孤儿副本键（T-11）**：dungeons_monsters.json 有 `_ADDS` 后缀键（T19_ADDS / T20_ADDS / T21_ADDS / LIU_BO_JING_BIAN_CHUSHI_ADDS / _HARD_ADDS），getDungeons 合并到母副本（母键 + 母键_ADDS）；同名小怪按难度分存→boss_candidates 多候选切换（缚魂触/化生触/潮音骨 3 候选按 T19/T20/T21 切换、炼血堂 2 候选）

---

## 六、当前状态（2026-10-18 21:00，详见任务清单）

- **已发布**：v1.2.0 / v1.2.1 / v1.2.2 / v1.2.3（2026-10-18 用户确认发布）
- **工作区交付内容（748 夹具全绿 + tsc/vite 双过）**：
  - class_hub 4 按钮（技能/装备/法宝/职业状态；攻略移出至 T-18）
  - class_status 卡（五指标语义色 + 0 值过滤 + max-w-xl 对齐 BossDetailCard）
  - 「其他X」= exclude 补集；太昊/太乙 5 阶升降序列
  - 机器词链路玩家化（气泡 displayText + text/keyword）
  - 屏蔽：活动装备名单 10 件（跨服战场/纪念/礼包/宋金，兔年吉祥保留）/ 三清符引 / 馒头 / 群英 20
  - **T-06 服名查询**（36 服名/拼音/serverId → 战区卡）、**T-08** 服务器数 33→36、**T-11** `_ADDS` 并入母副本（真实爬取鉴别 T19/T20 机制怪入库，缚魂触/化生触/潮音骨 3 候选分难度切换，T19/T20/T21 各自 9 怪全覆盖）
  - **战区与单服卡交互紧凑化与极简去框**：取消自动展开右栏、单服卡收敛极简单行、开服状态统一为呼吸绿点（杜绝文字套框）、窄栏防挤压（规则 12）
  - **T-18 攻略卡片与装备进阶落地**：
    - 宸极·凝灵契（`ninglingqi.json` + `NinglingqiDetailCard.tsx`）：12 孔全量洗炼概率池与 CAP 硬上限；
    - 宠物结誓/誓印（`pet_pledge.json` + `PetPledgeDetailCard.tsx`）：5 档代表宠物选项卡，极简原生 Tooltip 视窗，首行内嵌上限对比展开，`min-w-[480px]` 窄栏防挤压（规则 13/14）；
    - 阵灵聚灵升级消耗（`zhenling_upgrade.json` + `ZhenlingUpgradeCard.tsx`）：1~12阶金紫双列对照表、6金2紫 12阶顶配测算与自定义速算工具；
    - 法宝经验等级对照（`fabao_upgrade_exp.json` + `FabaoUpgradeCard.tsx`）：1~40级经验与魔血对照表、双列全景模式、30/35/40里程碑及速算工具；
    - 贺岁金印（周年印）1~19阶全系列入库与升降级步进推演（19件全补全入 `equip_curated.json`，`equipSeries.ts` 整合 1~19阶，中文/阿拉伯数字/俗称归一化）；
    - 全站属性浮动范围波浪号统一替换为 ` - `；
- **已完成**：T-16 全系 / T-15b / T-16a / T-16b / T-06 / T-08 / T-11 / T-18 部分子项；**T-05 关闭**（无档位字段，映射无依据——勿重启）
- **剩余待办**：T-09 新副本数据（需数据源）/ T-18 攻略大类（随用户资料持续增补）/ T-07 语料抓取（待拍板来源）
- **接手第一步**：确认用户是否已给发布指令；若没有，保持工作区现状勿 push

## 七、给接手 AI 的第一周检查单

1. [ ] 读完三份文档（指南 + 任务清单 + 本手册）
2. [ ] 跑一次 `npm run test:l1` 确认 671 全绿（环境坑见下）
3. [ ] 用 `--probe "逐霜" "焚香状态" "锦囊" "所有项链"` 感受现有行为
4. [ ] 读 `matchLocalIntent` 的匹配链（第五节顺序），动手前先画分支图
5. [ ] 任何改动走第三节 SOP 十步，**第⑩步之前不 push**

## 八、本机环境坑（Windows）

- 裸 `npm`/`tsc`/`vite` 不在 PATH：用托管 node 直调（`node_modules/typescript/bin/tsc -b`、`node_modules/vite/bin/vite.js build`、`node_modules/npm/bin/npm-cli.js`）
- Bash 工具 stdout 不可靠：node 脚本 `writeFileSync` 落盘再 Read；或直接写 .cjs 脚本文件跑
- 改文档/JSON 禁用 `node -e` 行内长字符串（反引号/引号地狱）——写 scratch/*.cjs 跑完删
- git 操作用 Bash 工具（Git Bash）；写 .git 需 `dangerouslyDisableSandbox:true`
- 老 .tsx 是 CRLF：脚本 split/join 前 `.replace(/\r\n/g,'\n')` 归一化
- Glob 不索引 .gitignore 路径（scratch/、.workbuddy/）——结论涉及"文件是否存在"必须 ls/PowerShell/node fs 直查磁盘
