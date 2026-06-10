# Change Log

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
