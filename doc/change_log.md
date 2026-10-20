# Change Log

## [1.2.5] - 2026-10-20

### 极致攻略信息卡内联展开（废弃路由跳转），法宝详情卡顶栏重排

#### Added

1. **极致攻略信息卡 `CeilingDetailCard.tsx`（新增）**：
   - 覆盖「极致无视 / 极致减免 / 极致减暴 / 极致怪增 / 极致躲闪」五篇，数据源与全景资料库 `AttributeTable` / `SourceSectionView` 完全同源：ceiling 篇读 `attribute_ceiling_guide.json`，来源篇（怪增/躲闪）读 `stat_source_lists.json`；
   - 聊天内直接展开全量细分，不再输出 `ceilingVal` / `route`，也不再跳转 `/compendium/ceiling`；
   - 领域分组沿用 `CompendiumView.DOMAINS` 色板：装备 amber、首饰 sky、法身 purple、星宿 teal、阵灵 blue、宠物时装称号 rose（另补 basic=slate、职业阵营=indigo），组头 = 色点 + 领域色名 + 项数 + 同色小计，行内类别小字用同色 400 档；
   - ceiling 篇四档列（最高/夯/顶级/毕业）列头只出现一次，理论最高走 `slate-100` 粗体、后三档 `slate-400`；
   - 来源篇条件项（换装/阵营）以琥珀描边区分，标注「不计入小计」。

2. **领域筛选栏交互**：
   - 两端 `ChevronLeft/Right` 箭头翻页，每次 200px 平滑滚动；箭头固定占位、不可滚方向置灰（`disabled` + `text-slate-600`），避免 chips 区宽度抖动；
   - 竖向滚轮转横向滚动（与 `BaoshiDetailCard` / `ClassStatusCard` 等五张卡同一套写法）：**只要自身溢出就无条件 `preventDefault`**，不放行到聊天区，修复「左右滚动时整页跟着往下滚」。

#### Changed

1. **窄卡排版（左分屏）**：卡片根挂 `@container`，全部断点改用容器查询 `@sm`（24rem），不再依赖视口宽度（左分屏下视口很宽但卡片仅 371px，视口断点会失效）。<@sm 时类别内联进项目名（`·` 分隔）、项目名 `truncate` + `title` 保留全名、数值 11px、四档列宽 `2.4/2/2/2.4rem`；≥@sm 恢复独立类别列 + 12px + `3/2.25/2.25/3rem`。
2. **配色**：行内数值统一 `slate-100` 不逐行染色；列头/项数/小计标签/脚注/备注全部提到 `slate-400`，筛选胶囊 `text-xs`(12px)。
3. **回归基线**：`l1_intent_cases.json` / `l1_intent_golden.json` 的 ceiling 用例改断言 `cardData.attrKey`，并把入口文案「宠物指南」同步为「宠物刻誓」。
4. **数据**：`stat_source_lists.json` 怪增条件项「不知愁专属时装（净增+2.5%）」改为「不知愁专属时装」，note 精简为「极限换不知愁(+3%)需扣除圣诞衣服(-0.5%)与圣诞鞋(-33%暴伤)」，极限 61.7% 口径不变。
5. **资料库极致属性表**：移除表格底部与信息卡重复的「数据截至 … 玩家总结仅供参考」脚注（注释保留）。

#### 法宝详情卡 `FabaoDetailCard.tsx`

1. 顶栏由三行压到两行：第 1 行法宝名称 + 品质/等级标签，第 2 行传承形态与等阶按钮同排；无传承形态时等阶按钮回落到第 1 行右侧，不再留空行。
2. 传承形态由独立按钮组改为内嵌分段控件（`inline-flex rounded-lg bg-slate-950/70 p-0.5`），与职业状态卡切换栏视觉统一。
3. 等阶调节由「滑块 + 1~5 数字块」改为「等阶 -1 / 等阶 +1」两个步进按钮，到 1/5 边界自动禁用。
4. 技能标题行合并「技能名 + 第 N 阶」（`titleLine` / `bodyStr1` 拆分），`GameTooltipShell` 的 `title` 类型放宽为 `React.ReactNode` 以承载带色文本。
5. 暂时收起「获取途径与说明」区块（JSX 注释保留作参考，连带移除 `Info` 图标导入）。

#### Chore

- `.gitignore` 新增 `films/` 与 `zx_analysis_results/_layout_check/`。

## [1.2.4] - 2026-10-19

### 全系装备与数值卡片全景上线，攻略体系架构重构与大规模测算器升级

#### 架构解耦与重构
- **攻略与装备数值系统分离**：将佩章、凝灵契、宠物结誓、周年印、宝石、星宿、旧天缘、九纹琅、贺岁时装技能等装备/技能/数值系统从攻略指南（`doc/T18_攻略体系与知识卡片全景指南.md`）中彻底剥离，攻略文档纯粹聚焦在【极致属性天花板】、【核心养成经验与材料消耗】与【副本机制杀】三大攻略领域。
- **新建全系装备与数值全景指南**：新建 [doc/诛仙3全系装备与数值卡片全景指南.md](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/doc/诛仙3全系装备与数值卡片全景指南.md)，统一承载全系装备、宠物、附魔及技能卡片的系统规范与测算说明。

#### Added（最近两日全量上线之数值、装备、技能与养成系统）
1. **宝石属性及升级全景卡与多孔测算器 (`baoshi.json` + `BaoshiDetailCard.tsx`)**：
   - 覆盖 12 种核心宝石（混沌金刚珠、三昧紫阳珠、元运断金珠、天心断金珠、煌燿金刚珠、培元断金珠、醒神碧灵珠、渡劫碧灵珠、夺魄碧灵珠、神行紫阳珠、无极紫阳珠、避尘金刚珠）；
   - 普通与完美两大品阶 1~10 级属性全览，第 6 级起解锁特化副属性；
   - 内置 1~5 孔首饰/装备多孔镶嵌总属性实时汇总测算器。
2. **贺岁时装技能图鉴卡与代际联动推演 (`fashion_skills_hesui.json` + `FashionSkillDetailCard.tsx`)**：
   - 完整收录虎年至牛年十二生肖贺岁礼包专属特技规格（施法、真气、CD、效果与标签）；
   - 内置蛇年【金蛇狂舞】与猪年【诸事顺利】代际联动增强实时开关与参数预览，呈现全系生肖技能代际联动拓扑。
3. **佩章·九纹琅属性卡与升级差额测算器 (`jiuwenlang.json` + `JiuwenlangDetailCard.tsx`)**：
   - 覆盖 1~20 级九纹琅全部 10 项核心属性（攻击、气血、真气、减免暴伤、暴击、暴伤、技躲、技命、怪增、减免百分比）；
   - 内置升级差额测算器，自选起始与目标等级，一键对比全部 10 项属性升阶增益净值。
4. **旧天缘属性全览卡与满级推导器 (`tianyuan_old.json` + `OldTianyuanDetailCard.tsx`)**：
   - 覆盖天命武器、靴子、衣服、头盔 4 大部位专属词条池与条数概率（1~3条）；
   - 支持 1~10 级天命推演与 3 条属性勾选一键推导满级总加成。
5. **星宿属性及升星增益卡 (`xingsu_upgrade.json` + `XingsuDetailCard.tsx`)**：
   - 覆盖启明星辰（玉衡）、荧惑星辰（开阳）、重华星辰（瑶光）三大量级星宿主副属性池；
   - 1~5 星星级步进控制器与升星累计收益（基础 100% 至 5 星 200% 翻倍）测算。
6. **圣粹佩章五大属性全览与升降级机制 (`peizhang_shengcui.json` + `PeizhangDetailCard.tsx`)**：
   - 覆盖回风、貔貅、椒图、角端、含瑛五大圣粹佩章属性全貌；
   - 支持 +1~+15 炼器推演与隐藏属性概率池查看。
7. **宠物宸极·凝灵契 12 孔属性池与秘效 (`ninglingqi.json` + `NinglingqiDetailCard.tsx`)**：
   - 12 孔属性池全量呈现、官方稀有与暴击条数排他上限规则及 6 阶灵契秘效全景。
8. **宠物结誓与誓印系统全景 (`pet_pledge.json` + `PetPledgeDetailCard.tsx`)**：
   - 5 类代表宠物（普通、昆仑修罗、飞天鼠、波波、鹏鹏）结誓属性上下限对比，并提供御宝印与通灵印誓印指南。
9. **贺岁金印（周年印）1~19 阶全系进阶 (`equip_curated.json` + `EquipDetailCard.tsx`)**：
   - 从 1 阶（壹）至 19 阶（壹拾玖）支持在卡片内逐阶升降推演，怪增暴伤数值一目了然。
10. **阵灵聚灵升级消耗测算 (`zhenling_upgrade.json` + `ZhenlingUpgradeCard.tsx`)**：
    - 1~12 阶金卡与紫卡升级沧浪冰珠与沧热聚灵丹消耗速查，支持 6金2紫 顶配消耗测算。
11. **法宝升级经验等级对照表 (`fabao_upgrade_exp.json` + `FabaoUpgradeCard.tsx`)**：
    - 1~40 级各阶段当前级经验、累计经验与天龙魔血/真龙圣血消耗测算。
12. **经验升级总分流枢纽 (`exp_hub`)**：
    - 输入“经验”或“升级”，一键导航选择法宝经验或阵灵经验测算。

#### 质量保障
- L1 回归夹具：全量 903 条用例 100% 全绿（断言失败 0 条，深度覆盖所有装备部件、星级、宝石品阶、生肖特技、属性测算与玩法攻略 Hub）。
- TypeScript 严格类型检查 0 报错。

## [1.2.3] - 2026-10-18

### 职业状态卡片上线、装备与高难副本小怪补齐

#### Added（玩家可感知）
- 职业状态速查卡：输入职业名点击「职业状态」或直接输入"逐霜状态"、"鬼王状态"，即弹出专属状态卡。
- 首饰升阶全关联：太昊、太乙神级首饰卡片内支持逐阶切换升降；未归类装备一键全量翻阅。
- 高难副本小怪补全：T19、T20、T21副本的「缚魂触」「化生触」「潮音骨」以及流波惊变「炼血堂教众/精英」全量入库。
- 分屏对话去繁就简：战区与单服卡片全面轻量化，精简重复冗余文字与边框背景，开服状态统一采用极简呼吸绿点。

#### 质量保障
- L1 回归夹具：`npm run test:l1`，688 条用例全绿。

## [1.2.1] - 2026-10-16

> 已随 `web_app` v1.2.1 发布：`package.json` 版本号与 `changelog.ts` 条目已同步。

### AI 问答体验升级：职业一键分流、拼音直搜、副本俗称识别

#### Added（玩家可感知）
- 双轨分屏自由拖拽：`useSplitDrag` hook + HomePage 分隔条（`role="separator"` + `aria-orientation`），AI 栏宽度可拖拽，拖拽中禁用宽度 transition 防抖动。
- 开服雷达提示音：三音阶单轮 → 两轮琶音（C5-E5-G5 → C6-E6-G6，共约 1.8s）。
- 裸职业名一键分流：输入"逐霜""鬼王"等职业名，弹出「技能速查 / 装备查询 / 专属法宝」三入口卡片，点击无状态重发对应查询词（`class_hub`）。
- 拼音搜索：`zhu shuang`→逐霜、`guiwang`→鬼王；词库侧预转 + query 侧运行时转双向归一，同音歧义整键弃用，词库外拼音整体放弃归一化。
- 副本俗称直通：纯数字输入 16~21 直通 T 本词典（`19`→T19、`20`→T20），其余纯数字仍走守卫。
- 同义词扩展：易伤→增伤（用户口径"增伤=易伤、只有绿点没有绿"）。

#### Fixed
- 法宝精确名全局优先（R1）：`七星剑`/`四灵幡`/`多情环`/`金刚杵`/`掠影`/`追魂`/`山河扇`/`神木骰`/`万毒鼎`/`玉净瓶` 不再被"法宝名+秘笈"装备部分包含劫持；`悬夜翎` 不再被副本别名"悬夜"劫持。
- 职业前缀+轩辕策→技能分支优先（R2）：27 个「职业+轩辕策」组合从轩辕策工具卡翻转为该职业技能候选卡；裸"轩辕策"仍走工具卡。

#### 质量保障
- L1 回归夹具：`npm run test:l1`，625 条用例全绿（含变异测试双通道捕获）。

## [1.1.10] - 2026-09-30

> 已随 `web_app` v1.1.10 发布：`package.json` 版本号与 `changelog.ts` 条目已同步。

### 流波惊变副本：补录第 4 关 BOSS「夔牛」，并把两档关次修正为 1–5 连续

#### Added
- `web_app/public/game_data/dungeons_monsters.json`：`LIU_BO_JING_BIAN_CHUSHI` / `LIU_BO_JING_BIAN_HARD` 两档各新增第 4 关 BOSS「夔牛」（`MonsterID` = `KUINIU_CHUSHI` / `KUINIU_HARD`，`role: "boss"`，`displayAttributes` 18 项 + `MonsterAttributeModifiers` 4 项）：
  - 初识：血 2039254799 × 300 条 = 611776439700｜攻 620000｜防 480000｜爆伤 1900｜减暴击 235｜减爆伤 1790｜技躲 258｜无视减免 140
  - 困难：血 2061496741 × 820 条 = 1690427327620｜攻 800000｜防 680000｜爆伤 2100｜减暴击 310｜减爆伤 2550｜技躲 298｜无视减免 175
- `scripts/enrich_liubo_kuiniu.mjs`：可复跑的补录脚本（无参=预演只打印，`--write` 落盘）。夔牛记录的定位规则 = 取**离本难度「青龙」记录 id 最近**的那条「夔牛」（初识 青龙 @127519 → 夔牛 @127522；困难 青龙 @126916 → 夔牛 @126919），elements.data 更新后一键重算。

#### Changed / 关键决策
- **关次修正**：`幽姬` 4 → **3**，`苍松` 6 → **5**。两档关次由原来的 `[1,2,3,4,6]`（关 5 只有小怪，是全库 19 组里唯一不连续的一组）恢复为 `[1,2,3,4,5]` 连续。
- 修正依据是**客户端内部小怪命名**，不是推测：
  - `Boss1-` 保护旗帜 / 旋转飞刀 2-4 / Boss树苗 2-3 ⇒ 关 1 年老大
  - `Boss2-` 循环总控 / 踩圈怪 / 踩塔控制怪 / 外·内场透明怪 ⇒ 关 2 玉阳子
  - `Boss3-` **青龙技能目标透明怪 ×4**、**幽姬分身用火球怪**、**幽姬位移位置 1-5** ⇒ 关 3 = 青龙 + 幽姬
  - `Boss4-` 总控 / 屏障 ×8 / 鼎透明怪 ×8 / 收台子 / 起飞 / 简单-困龙绳黄圈 ⇒ 关 4 = 夔牛（夔牛记录就夹在这批辅助怪中间）
  - `Boss5-` 总控 ⇒ 关 5 苍松
  - 旁证：青龙与幽姬的血 / 攻 / 防 / 爆伤几乎同值（同档），其余各关 BOSS 数值明显分档；苍松之后紧跟「入魔的龙首峰弟子」「魔教之人」，与 `_ADDS` 里的炼血堂小怪同关。
- 「炼血堂教众 / 精英」仍留在 `_ADDS` 键、`DungeonLevel` 保持 5（= 苍松那一关的小怪），沿袭 T21 范式，未动前端 Boss 下拉结构。

#### 来源与验证
- 取值口径与既有条目完全一致。原 1.0.5 数据是**用户截图手工录入**，本次改为从 `elements.data` 直接取：先用现有 10 条 BOSS（5 只 × 2 难度）× 10 字段逐位比对，**全部 ✓**（含 4 个 float ÷100 的减免类），确认映射链后才生成夔牛 ——
  `health@360` `healthBars@364` `zhenQi@368` `attack@372` `defense@376` `bonusDamage@380` `damageReduction@384` `normalHit@388` `normalDodge@392` `critRate@396` `critDamage@400` `resistance@404` `critRateReduction@648÷100` `critDamageReduction@652÷100` `skillDodge@656÷100` `skillHit@660÷100` `ignoreReduction@688`；`MonsterHealth = health × healthBars`。
- 引擎 `validateMonstersData` 校验 **0 issues**；全 10 条 BOSS 血缘（血 × 条 = MonsterHealth）逐条 ✓。
- 只改 `public/` 源文件。`web_app/dist/` 是构建产物，需 `npm run web:build` 重新生成（注：该目录本就滞后 —— T17 / T18 / 守护神降临 / 玄叶林七尾蜈蚣 4 组与 public 不一致，非本次引入）。

#### Changed / 本次数据校准（2026-09-30）
- 流波惊变·初识档 6 只 BOSS 的属性校准（同一副本同一批次，与夔牛补录一并发布）：
  - `NIANLAODA_CHUSHI` 年老大：技能闪避 252 → 230。
  - `YUYANGZI_CHUSHI` 玉阳子：减爆伤 1600 → 1450；技能闪避 254 → 232；怪物减致命一击率 1600 → 1450。
  - `QINGLONG_CHUSHI` 青龙：减爆伤 1760 → 1700；技能闪避 256 → 234；怪物减致命一击率 1760 → 1700。
  - `YOUJI_CHUSHI` 幽姬：减爆伤 1760 → 1700；技能闪避 256 → 234；怪物减致命一击率 1760 → 1700。
  - `KUINIU_CHUSHI` 夔牛：血量 611776439700 → 570991343720（血条 300 → 280）；技能闪避 258 → 236。
  - `CANGSONG_CHUSHI` 苍松：技能闪避 260 → 238。
- 上述改动仅调整 `LIU_BO_JING_BIAN_CHUSHI` 数组内既有字段，其余副本 / BOSS / 字段一律未动。

## [1.0.8] - 2026-09-15

### 单次计算路径（属性战力计算器 / agent_tool）接入「四代曦日满配 + 战斗满状态峰值」；技能速查补四代卡

#### Added
- 引擎新增 `single_calc.ts`，导出 `buildSingleCalcSkills(classFactionSkills, faction)`，作为单次路径专用装配：
  1. 合并本阵营 + COMMON 并深拷贝；
  2. `applyPeakFourthGen` 固定按最高品质**曦日（XI_RI）**套用全部四代 Grants（自动扫描、零职业特例；单次是逐技能理论满配，故绕开 3玄烛1赤乌槽位校验；COMMON 命中不到的跨阵营目标静默跳过）；
  3. 只保留 DAMAGE 输出技能（被动/辅助不进单技能列表）；
  4. 按 `PEAK_VARIANT_RULES` 克隆「战斗满状态」峰值变体：首个规则为逐霜苍龙·龙怒（法宝+1 的鹰扬 10 级、满层 9 段全附加，Variant=LONGNU，技能名加后缀「·龙怒」，朴素命名、不带「满配/峰值」字样）。
- 引擎新增 `zhu_shuang.ts`：把原写在 combat_loop 内的逐霜龙怒 helper（isXianCangLongXiaoSkill / 鹰扬等级 / getZhuShuangLongNuBonus，默认 9 级、单次峰值 10 级）抽为共享模块；combat_loop 改为 import，调用点不变、行为零变化。
- 技能速查 SkillsView：① 四代被动（FOURTH_GEN_PASSIVE）独立卡片——「通用」阵营标、玄烛/赤乌槽位、按目标技能名聚合三品质增量（三品质同值合并、异值按「莹炬/皓月/曦日」分列；同名技能合并、同品质多 grant 累加去重）、Description 机制说明；② 列表与职业计数纳入 COMMON，选任一阵营都显示通用四代；③ 普通技能卡仍显示**白板数值**，卡底新增可点击的「玄烛/赤乌增益：受《来源四代》增量」反向标签，点击高亮并滚动到对应四代卡。
- agent_tool `normalize` 单次取技能改走 `buildSingleCalcSkills`；网页属性战力计算器 `DungeonDetail` 的 outputSkills 同步（useMemo 缓存）。

#### Changed / 关键决策
- 单次路径**不加四代槽位/品质选择 UI**（用户拍板方案 A）：固定按理论满配、最高品质曦日呈现；只加角色属性的四代（如云蒸霞蔚只加真气）不进单技能（玩家属性已给定），仅保留直接作用于输出技能的 Grants。
- 命名朴素：苍龙啸 / 苍龙啸·龙怒 / 苍龙啸·玄 / 苍龙啸·玄·龙怒（魔「煞」、佛「禅」同理）；苍龙啸·玄等阵营技能的满配版保留原名。
- 逐霜单次最终附加攻击比（白板 + 醉月 50，龙怒版再叠满层）：仙 苍龙啸 260 / ·龙怒 560、苍龙啸·玄 290 / ·玄·龙怒 590；魔 苍龙啸 260 / ·龙怒 460、煞 290 / ·煞·龙怒 490；佛 禅 290 / ·禅·龙怒 490。
- 全职业通用：四代满配自动扫描，无需写代码；仅「战斗满状态峰值」（如龙怒这类命中叠层）需在 `PEAK_VARIANT_RULES` 为该职业登记一条规则，后续职业照此推广。

#### Notes / 验证
- 两条路径仍共用同一个 `calculateDamage`（公式零差异），差异只在预处理：训练场（scenario_assembler + Actor + combat_loop 时间轴叠层/消耗）为完备实盘，单次路径为理论满配快照；本次让单次快照也反映四代满配与满状态峰值。
- 引擎 tsc=0；test_b / test_c（新增 Test3f：仙本体 260/龙怒 560、魔 260/460、非逐霜吃 +50 但不产生变体、UTILITY 不进列表）/ test_assembler / test_6person_team 全绿；agent:check=0、web tsc=0。
- 网页实测：逐霜仙/魔/佛单次数值与命名正确；技能速查三玄烛卡（醉月/点龙睛/云蒸）品质分组、普通卡白板数值 + 反向标签、同名合并与「曦日充能 12s」补回；训练场六人队 22.16s 击杀 T20 赤梭（苍龙啸 72 次、苍龙啸·煞 27 次、156 条审计、事件流水正常）零回归；鬼王等其他职业单次只做四代满配、不产生龙怒变体、不报错。

#### 验收修复（2026-09-16，全局搜索 / 首页命令面板 / 技能速查 UI）
- 修复全局搜索点技能结果错误落到「极致无视」页：根因是 App 导航对象末尾展开 ...t 把 tab:'compendium' 又覆盖回 'skills'；联动修正 SkillsView 搜索守卫（识别 compendium/sub=skills）与 CompendiumView 提前 onSearchConsumed 导致 SkillsView 首次挂载拿不到导航参数。
- 右上角全局搜索与首页命令面板（Ctrl+K）两套搜索均纳入单次满配/峰值变体（苍龙啸·龙怒 / ·玄·龙怒 / ·煞·龙怒 / ·禅·龙怒），变体仅生成「战力测算/功能入口」条目（技能速查不展示变体卡）；两处技能索引均取自 buildSingleCalcSkills，未来职业在 PEAK_VARIANT_RULES 登记即自动出现。
- 搜索直达属性战力计算器时临时关闭自动展开「BOSS 属性卡」与「技能附加属性卡」（ResultsSection 常量 ENABLE_SEARCH_AUTO_FOCUS=false，恢复置 true 即可），仍自动切到对应副本/职业。
- 技能速查四代卡长文本（莹炬/皓月/曦日三品质说明）改为跨整行、纵向排列并自动断词换行；普通卡反向增益按钮允许换行，修复描述溢出卡片。
- 补做属性战力计算器「改前白板 vs 改后满配」全职业逐技能 A/B：仅逐霜苍龙系 5 技能 +50%（仙/魔普通苍龙充能 18→12s）+ 新增 5 个龙怒变体、鬼王未名斩·玄/煞/禅真气比 15→25%（玄烛·狱龙破满配）；其余职业零变化、无技能丢失、无非 DAMAGE 混入。

#### 搜索入口合并（2026-09-16）
- 右上角全局搜索（GlobalSearch）与首页 Ctrl+K 命令面板（HomePage）原本各维护一套索引与匹配规则，已抽为单一共享模块 `components/search/searchIndex.ts`：唯一数据源 `buildSearchIndex`（功能入口 / 副本 / Boss / 职业技能 / 满状态峰值变体 / 职业评级 / 攻略增益）+ 统一 6 档打分（标点归一、分词、职业/副本前缀拆解、拼音首字母/全拼）；`matchFlat` 供右上角扁平下拉、`matchGrouped` 供首页分类聚合；`SearchTarget` 类型统一在共享层定义、GlobalSearch re-export 兼容 App/Header/ResultsSection/CompendiumView/SkillsView 既有引用。
- 以后新增搜索条目或调整匹配规则只需改 searchIndex.ts 一处，两个入口同步生效；合并后右上角补齐首页独有的「副本入口 / 训练场(arena)」等条目，首页也获得龙怒峰值变体，两处结果完全一致。
- 最近搜索缓存（zx_home_recent_searches）随类型迁移到语义字段，loadRecent 兼容旧版 l/g/c/i/f/k/t 缓存并自动归一，不丢不崩。
- 验证：web tsc=0、vite build 成功（2466 模块）；浏览器两处搜索回归通过——苍龙啸（首页 职业技能 5 / 功能入口 10=5 白板+5 龙怒，右上角扁平 15 条）、白板落技能速查并定位、龙怒变体跳计算器不弹卡且进技能表参与伤害、赤梭切 T20 不展 BOSS 属性、流波惊变副本入口、无视/易伤/专注值、鬼王未名斩三阵营（无龙怒）、拼音 clx/th、热门速搜/最近访问/旧缓存兼容、训练场入口。
## [1.0.7] - 2026-09-15

### 流波惊变技改 · 逐霜（首个落地职业，作为后续职业范本）

#### Added
- 引擎叠层模型 `AppliedEffectConfig` 新增 `StackMode`（MULTI_INSTANCE / SINGLE_INSTANCE_STACKS）、`InitialStacks`、`StackGain`：支持「单实例多层」——同名效果只保留一个实例，施放可补满/补层、重放刷新时长、命中逐层消耗、封顶 MaxStacks；龙怒为首个使用场景（types.ts / effects.ts）。
- 逐霜四代 `ZS_COMMON_FG_ZYFS`（玄烛·醉月飞觞）三品质 Grants 新增：佩戴即给仙/魔/佛全部 5 个苍龙啸技能附加攻击比 +50%（四代满级 10%×5，三品质同值），与龙怒独立叠加、龙怒耗尽后仍在。

#### Changed
- 龙怒（ZS_BUFF_LONG_NU）由 combat_loop 写死的「临渊给 1 层、命中固定 +300%」改为数据驱动：
  - 来源改为 4 个鹰扬折冲（仙普通/·玄、魔普通/·煞）施放即补满 27 层、持续 15s、重放刷新 15s 并补满；临渊敛爪（仙/魔）改为补 1 层、总数封顶 27（魔临渊原本缺失龙怒效果，本次补齐）。
  - 苍龙啸命中每段耗 1 层，当段附加攻击比按鹰扬折冲等级：仙 苍龙啸/苍龙啸·玄 = 20%×等级+100（怒龙吞海 II 满级固定 100），魔 苍龙啸/苍龙啸·煞、佛 苍龙啸·禅 = 20%×等级；默认鹰扬满级 9（仙 280% / 魔佛 180%），法宝 +1 通过 profile 的 PlayerSkillOverride.SkillLevel=10 表达（仙 300% / 魔佛 200%）。
- 山雨欲来 III（仙/魔 ZS_*_SKILL_SY3，三代按三级书）每段附加攻击比 395% → 445%（技改 +50%）；山雨欲来 II 及其余技能不变。

#### Notes（本次明确不建模 / 遗留）
- 逆鳞值消耗（按满逆鳞处理，不建资源）、铺锦势暴击（暴击率不进 DPS 公式）、霜池减伤、寒衣不暖/霜残：本次不建模。
- 心法「乘时而化」（延长玄烛·云蒸霞蔚真气与清啸横朔效果时长）引擎暂无心法字段，仅登记遗留方案，见《四代系统迁移待办.md》第五节。
- 单次计算路径仍不接四代/龙怒（龙怒是战斗循环动态机制），沿用迁移待办第四节的推迟决定。
- 验证：引擎 test_b/c/e/f 全绿（test_c 新增龙怒 5 组用例——仙 27 层每段 +280%、临渊 1 层仅首段附加、魔每段 +180%、单实例多层补层/封顶、法宝+1（普通鹰扬 SkillLevel=10）每段 +300%，差值精确）；单次快照 34 个输出技能仅 SY3 变化、其余 32 个逐格零变化，醉月 +50 数学精确；6 人固定种子队龙怒+醉月方向正确、未改技能零变化；独白·魔 T20 同 profile A/B 仅山雨 III 变化；训练场 arena / 单次计算器 / agent_tool 端到端通过。
## [1.0.6] - 2026-09-13

### Added
- `web_app/public/game_data/dungeons_monsters.json`：天帝宝库（初入江湖／再起风云／三生苦旅）录入完整 Boss 属性（来源：用户提供的游戏内面板数据）。每难度 7 只 Boss（噬人花／金瓶儿／秦无炎／陆雪琪／黄鸟／玄蛇／小灰），含 `role: "boss"` 与 `displayAttributes` 18 项；其中黄鸟、秦无炎为本次新增条目（原列表仅有 5 只）。
- 三生苦旅原有的 `MonsterHealth` 占位值（1200亿~2500亿）已替换为真实值（气血 × 血条），逐只核对血缘关系一致。
- 原列表 5 只 Boss（噬人花／金瓶儿／陆雪琪／玄蛇／小灰）的减爆伤经用户新数据交叉验证完全吻合。

### Notes
- 黄鸟与玄蛇为第 4 关双 Boss，属性完全相同（用户确认）；`DungeonLevel` 均记 4。
- 秦无炎关卡位置用户未明确，按与金瓶儿减爆伤同值（1030/1530/1830）推断为第 2 关双 Boss，`DungeonLevel` 记 2，待确认。
- 小灰抗性为 300000（其余 Boss 9999），按用户数据照录；技能命中按用户数据记 999900。
- 录入后经引擎 `validateMonstersData` 校验（0 issues）。

## [1.0.5] - 2026-09-13

### Added
- `web_app/public/game_data/dungeons.json`：新增新版本副本「流波惊变」两个难度（`LIU_BO_JING_BIAN_CHUSHI` 初识 / `LIU_BO_JING_BIAN_HARD` 困难）。
- `web_app/public/game_data/dungeons_monsters.json`：录入流波惊变（困难 / 初识）全角色完整属性（来源：用户截图）。每难度 5 只 Boss（年老大／玉阳子／青龙／幽姬／苍松，含 `role: "boss"` 与 `displayAttributes` 18 项）置于主键；2 只小怪（炼血堂教众／炼血堂精英，含 `role: "add"`）置于独立 `_ADDS` 键，沿袭 T21 范式，避免破坏既有 Boss 断言与前端 Boss 下拉。
- 血缘关系已核对：新条目 `MonsterHealth` = `displayAttributes.health × healthBars`，逐只一致；已通过引擎 `validateMonstersData` 校验（0 issues）。

### Notes
- 炼血堂教众／炼血堂精英在游戏内等级列显示「免单攻」标签（免疫单体攻击类小怪），`displayAttributes.level` 按同档位 175 记录。
- 两难度炼血堂教众／精英的「防御」在游戏面板中均为空（未显示数值），经用户确认后统一按 0 记录（初识原 OCR 读出的 20000 系截图像素干扰，已修正为 0）。
- 真气／附加伤害／减免伤害三行截图未显示数值，按 0 记录（与 T21 一致）。

## [1.0.4] - 2026-09-08

### Added
- `web_app/public/game_data/dungeons_monsters.json`：录入镇海！断浪碎晶宫（T21）全角色完整属性（来源：帮派内部参考 By：花千寻 截图）。六只 Boss 在原 `MonsterAttributeModifiers` 同级新增 `role: "boss"` 与 `displayAttributes`（18 项：等级／气血／血条／真气／攻击／防御／附加伤害／减免伤害／普攻命中／普攻躲闪／暴击率／暴击伤害／抗性／减免暴击／减免暴伤／技能躲闪／技能命中／无视减免）；三只小怪（缚魂触／化生触／潮音骨，含 `role: "add"`）置于同级顶层键 `ZHENHAI_DUANLANG_T21_ADDS`，避免破坏 "T19-T21 各 6 个 Boss" 的既有断言与前端 Boss 下拉。
- `web_app/public/game_data/support_roles.json`：新增 PVE 辅助职业能力表（19 个职业的增伤／绿点／紫点／破防／其他能力／综合评定 S+~A，含回归玩家推荐与版本环境说明）。
- 血缘关系已核对：T21 Boss 的 `MonsterHealth` = `displayAttributes.health × healthBars`，六只逐只比对一致。

### Modified
- `packages/simulation-engine/src/types.ts`：新增 `MonsterDisplayAttributes` 接口；`Monster` 增加可选字段 `role` 与 `displayAttributes`（计算器仍只读 `MonsterAttributeModifiers`，结算行为无变化）。

### Removed
- `web_app/public/game_data/skills.json`：移除 `SHI_LUO._PLACEHOLDER_META`（该元数据导致 `npm run test:b` 在 Skills Schema 校验阶段即报错）。其内容归档如下，供后续补齐释罗数据参考：
  - note：已按截图实战占比归一化前 4 个技能的 `SkillFrequency`（最大余数法保留 4 位小数，严格 Σ=1.0000）；`Cooldown` / `CastTime` / `SkillImportanceWeight` 仍为占位（更新时间 2026-08-31 20:22:51）。
  - 进度：已完成 `MO`（魔）；待补 `XIAN`（仙）、`FO`（佛）。
  - 占位字段：`Cooldown`、`CastTime`。
  - 爆发追踪：`SL_MO_SKILL_NSSXS`（孽·释罗生相·煞）= 0.5560、`SL_MO_SKILL_CWJHG`（赤乌·敕戒祸根）= 0.4440，由段数×单 hit 伤害推导，已非占位。

## [1.0.3] - 2026-06-10

### Added
- 创建统一收口配置文件 `web_app/public/game_data/default_overrides.json`。
- 新增昭冥重构工作报告文档：[phase_h_default_overrides_and_zhaoming_fixes.md](file:///e:/ww/personal%20work/new_zx_calc_noactcode_agent/doc/phase_h_default_overrides_and_zhaoming_fixes.md)。

### Modified
- `web_app/src/components/arena/SimulationArena.tsx`：静态导入 `default_overrides.json` 并重构初始化钩子，消除 DPS 和辅助的所有硬编码初始参数；在 `buildActiveEffectViews` 中增加对 `BUFF_EXTEND` 事件的支持（在 `BUFF_EXTEND` 事件中同步更新 `remainingMs`，并移出 `BUFF_APPLY` 时的提前过期过滤）以便支持动态延长。
- `web_app/src/components/arena/SimulationReport.tsx`：在 `swimlanes` 解析中增加对 `BUFF_EXTEND` 事件的支持，保证报表与回溯沙盘里的 Buff 持续时间能获得同步且正确的延长。
- `packages/simulation-engine/src/actor.ts`：在 `beginCast` 中对 `ZM_FO_SKILL_RYHG`（日月弘光）进行初始 CD 屏蔽；还原 `getPhaseCooldownDelayMs` 使得日月弘光维持 35 秒基础 CD。
- `packages/simulation-engine/src/combat_loop.ts`：进入日月弘光 2 段（`phaseIndex === 2`）的时刻正式排期并计时 35s 的 CD；重构 `applyBuffDurationExtensions` 为投递独立的 `BUFF_EXTEND` 事件。
- `packages/simulation-engine/src/test_c.ts`：将 `ryhgShortCooldown` 的 `Cooldown` 调整为 `1.2` 确保测试用例顺利通过。
- `scripts/diagnose_phase_h.ts` / `scratch/print_timeline.ts` / `read_dps_logs.ts` / `test_6person_team.ts`：统一重构为从配置文件中读取默认参数，消除了所有硬编码参数。

## [1.0.2] - 2026-03-14

### Added
- 增加技能附加信息的悬浮提示 (Tooltip) 功能。在 `DungeonDetail.tsx` 内引入 `createPortal` 和全局坐标定位，添加了暗色玻璃卡片。
  - 用户鼠标悬浮于技能 `Info` 图标时，可查看：附加攻击比、附加固定攻击、附加气血比、附加真气比、附加爆伤、伤害增加倍数 (`SkillDamageBonus`)、重要性、使用频次。
  - 修复了原 `group-hover` 在 `overflow-hidden` 下引起的界限截断和父级滚动条问题。
- 生成设计文档: [技能附加信息悬浮显示与UI优化设计方案_20260314_V1.0.md](file:///d:/%E7%8E%8B%E7%82%9C/%E5%B7%A5%E4%BD%9C/%E4%B8%AA%E4%BA%BA%E5%B7%A5%E4%BD%9C/wx_proj/new_zx_calc/doc/%E6%8A%80%E8%83%BD%E9%99%84%E5%8A%A0%E4%BF%A1%E6%81%AF%E6%82%AC%E6%B5%AE%E6%98%BE%E7%A4%BA%E4%B8%8EUI%E4%BC%98%E5%8C%96%E8%AE%BE%E8%AE%A1%E6%96%B9%E6%A1%88_20260314_V1.0.md).

### Modified
- `web_app/src/components/business/ResultsSection.tsx`: 优化综合战力评分区域的视觉表现与交互动画，将评分徽章（SS、S等）扩展为基于 TailwindCSS 定制的呼吸灯特效 `animate-pulse-slow`，并在卡片背景叠加了呼吸光芒效果 (`animate-glow`)。
- `web_app/tailwind.config.js`: 配置 `pulse-slow` 和 `glow` 自定义动画。

## [1.0.1] - 2026-03-14

### Added
- 添加太昊职业及其核心技能“天地绝”配置。
- 技能参数：CD 0s, 施放时间 0.3s, 频率 0.9, 权重 0.9。
- 附加属性：攻击比 200%, 固定攻击 2750, 气血/真气比 26%。
- 创建设计文档：[太昊职业添加功能设计方案_20260314_V1.0.md](file:///d:/%E7%8E%8B%E7%82%9C/%E5%B7%A5%E4%BD%9C/%E4%B8%AA%E4%BA%BA%E5%B7%A5%E4%BD%9C/wx_proj/new_zx_calc/doc/%E5%A4%AA%E6%98%8A%E8%81%8C%E4%B8%9A%E6%B7%BB%E5%8A%A0%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1%E6%96%B9%E6%A1%88_20260314_V1.0.md).

### Modified
- `web_app/public/game_data/skills.json`: 注册新职业太昊的技能属性，并按照新规则更新 `SkillID`。
- `doc/太昊职业添加功能设计方案_20260314_V1.0.md`: 增加 `SkillID` 命名规则说明，作为后续职业添加的参考标准。
