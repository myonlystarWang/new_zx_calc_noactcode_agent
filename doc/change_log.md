# Change Log

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

#### 验收修复（2026-09-16，全局搜索 / 技能速查 UI）
- 修复全局搜索点技能结果错误落到「极致无视」页：根因是 App 导航对象末尾展开 ...t 把 tab:'compendium' 又覆盖回 'skills'；联动修正 SkillsView 搜索守卫（识别 compendium/sub=skills）与 CompendiumView 提前 onSearchConsumed 导致 SkillsView 首次挂载拿不到导航参数。
- 全局搜索纳入单次满配/峰值变体（苍龙啸·龙怒 / ·玄·龙怒 / ·煞·龙怒 / ·禅·龙怒），仅生成「战力测算」条目（技能速查不展示变体卡）；通用，未来职业在 PEAK_VARIANT_RULES 登记即自动出现。
- 搜索直达属性战力计算器时临时关闭自动展开「BOSS 属性卡」与「技能附加属性卡」（ResultsSection 常量 ENABLE_SEARCH_AUTO_FOCUS=false，恢复置 true 即可），仍自动切到对应副本/职业。
- 技能速查四代卡长文本（莹炬/皓月/曦日三品质说明）改为跨整行、纵向排列并自动断词换行；普通卡反向增益按钮允许换行，修复描述溢出卡片。
- 补做属性战力计算器「改前白板 vs 改后满配」全职业逐技能 A/B：仅逐霜苍龙系 5 技能 +50%（仙/魔普通苍龙充能 18→12s）+ 新增 5 个龙怒变体、鬼王未名斩·玄/煞/禅真气比 15→25%（玄烛·狱龙破满配）；其余职业零变化、无技能丢失、无非 DAMAGE 混入。

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
