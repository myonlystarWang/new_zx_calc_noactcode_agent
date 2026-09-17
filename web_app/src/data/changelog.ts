/**
 * 更新日志数据（Step 11）
 *
 * 唯一真相来源：`doc/change_log.md`（1.0.1 ~ 1.0.8 的真实历史）+ 本轮网站优化（1.0.9，Step 1-11）。
 * 新增版本时：① 改 `web_app/package.json` 的 version；② 在 CHANGELOG 顶部插一条同号记录。
 * 顺序约定：**数组第 0 条即当前版本**（ChangelogPage / Header 徽章都按此推导）。
 *
 * 历史条目为「摘要」而非全文搬运——change_log.md 里单条动辄上千字，不适合放进前端页面；
 * 需要细节时以 doc/change_log.md 为准。
 */

export type ChangeType = 'feat' | 'fix' | 'perf' | 'data';

export interface ChangelogChange {
    /** 变更类型 —— 决定页面上的颜色标签 */
    type: ChangeType;
    text: string;
}

export interface ChangelogEntry {
    version: string;
    /** ISO 日期（YYYY-MM-DD） */
    date: string;
    /** 该版本一句话主题（对应 change_log.md 的 `###` 行） */
    title: string;
    changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        version: '1.1.0',
        date: '2026-09-17',
        title: '方案对比页 + Header 资料库下拉',
        changes: [
            { type: 'feat', text: '新增「方案对比」弹窗：并排比较两套方案的七项面板属性、全部增益数值与各副本 BOSS 伤害，每行较高的一侧标绿、右侧给出变化幅度' },
            { type: 'feat', text: '伤害对比支持「副本 → BOSS → 技能」三层钻取：逐技能并排比较（门派/阵营不同时按技能并集 + 各自占比阅读），按需展开不铺满屏幕' },
            { type: 'feat', text: '对比弹窗内可把任一套方案一键载入计算器继续测算（只读打开，不点「载入」不会改动当前配置）' },
            { type: 'feat', text: 'Header「全景战斗资料库」新增下拉子入口（极致属性 / 职业技能 / 职业状态 / 副本 BOSS），任意页面可直达，与首页入口对齐' },
            { type: 'feat', text: '计算器「属性方案」区新增「对比」按钮（保存 2 套以上方案后可用）' },
        ],
    },
    {
        version: '1.0.9',
        date: '2026-09-17',
        title: '网站优化专项：路由化、多方案、分享与更新日志',
        changes: [
            { type: 'feat', text: 'Hash 路由 + 深链：URL 成为导航状态的唯一来源（可收藏、可分享、刷新保留、前进后退幂等）' },
            { type: 'feat', text: '多套方案保存 / 切换 / 删除：职业、阵营、属性与增益整包快照，含未保存改动提示' },
            { type: 'feat', text: '分享长图（1080 宽 Canvas 自绘）：含当前副本当前 BOSS 全部技能伤害与多段技能逐段明细 + 二维码' },
            { type: 'feat', text: '分享链接：纯前端差分编码，约 175 字符，对方打开看到相同配置与相同结果' },
            { type: 'feat', text: '更新日志页面 + 版本号统一管理（本页），版本号与 package.json 同源' },
            { type: 'feat', text: '全局错误边界：单个组件崩溃不再整页白屏，可一键刷新恢复' },
            { type: 'feat', text: '无障碍补全：图标按钮、抽屉、播放控制器补齐 aria-label 与 button 语义' },
            { type: 'perf', text: 'Vite 手动分包：首屏主包 1137 KB → 332 KB（gzip 89 KB），分享相关库懒加载' },
            { type: 'fix', text: '修复 slate-850 / 350 / 450、red-350 等无效色阶导致导航按钮、卡片边框样式静默失效（全站 40+ 处）' },
            { type: 'fix', text: '数据层加固：8 处 fetch 补 response.ok 校验、Promise.allSettled 降级提示、损坏 localStorage 自动清理' },
            { type: 'fix', text: 'Footer 版权年份改动态、移除幽灵类型，补意见反馈入口与免责声明' },
            { type: 'feat', text: 'SEO：description / Open Graph / theme-color / noscript 降级、robots.txt 与 sitemap.xml' },
        ],
    },
    {
        version: '1.0.8',
        date: '2026-09-15',
        title: '单次计算接入「四代曦日满配 + 战斗满状态峰值」；两个搜索入口合并',
        changes: [
            { type: 'feat', text: '单次计算路径按最高品质曦日套用全部四代 Grants，并新增「战斗满状态峰值」变体（逐霜苍龙·龙怒）' },
            { type: 'feat', text: '技能速查补四代被动卡：玄烛/赤乌槽位、三品质增量聚合、普通卡反向增益标签' },
            { type: 'perf', text: '右上角全局搜索与首页 Ctrl+K 命令面板合并为共享 searchIndex.ts，一套索引与打分规则两端同步生效' },
        ],
    },
    {
        version: '1.0.7',
        date: '2026-09-15',
        title: '流波惊变技改 · 逐霜（首个落地职业，作为后续职业范本）',
        changes: [
            { type: 'feat', text: '叠层模型新增「单实例多层」（StackMode / InitialStacks / StackGain），龙怒为首个使用场景' },
            { type: 'feat', text: '龙怒改为数据驱动：鹰扬折冲施放补满 27 层、命中逐层消耗，附加攻击比按技能等级计算' },
            { type: 'data', text: '玄烛·醉月飞觞佩戴即给苍龙啸系 +50% 附加攻击；山雨欲来 III 附加攻击比 395% → 445%' },
        ],
    },
    {
        version: '1.0.6',
        date: '2026-09-13',
        title: '天帝宝库三难度 Boss 属性录入',
        changes: [
            { type: 'data', text: '天帝宝库（初入江湖 / 再起风云 / 三生苦旅）每难度 7 只 Boss 完整属性，含新增的黄鸟与秦无炎' },
            { type: 'data', text: '三生苦旅占位血量替换为真实值，逐只核对「气血 × 血条」血缘关系' },
        ],
    },
    {
        version: '1.0.5',
        date: '2026-09-13',
        title: '新副本「流波惊变」属性录入',
        changes: [
            { type: 'data', text: '新增副本流波惊变（初识 / 困难），每难度 5 只 Boss + 2 只小怪完整属性' },
        ],
    },
    {
        version: '1.0.4',
        date: '2026-09-08',
        title: '镇海！断浪碎晶宫（T21）属性 + PVE 辅助职业能力表',
        changes: [
            { type: 'data', text: 'T21 六只 Boss 完整属性（18 项面板）+ 三只小怪独立归档' },
            { type: 'data', text: '新增 PVE 辅助职业能力表：19 个职业的增伤 / 绿点 / 紫点 / 破防与综合评定' },
        ],
    },
    {
        version: '1.0.3',
        date: '2026-06-10',
        title: '统一收口配置文件 + 昭冥重构修正',
        changes: [
            { type: 'feat', text: '新增 default_overrides.json，消除训练场 DPS 与辅助的硬编码初始参数' },
            { type: 'fix', text: '修正昭冥日月弘光 CD 排期，新增 BUFF_EXTEND 事件以支持 Buff 时长动态延长' },
        ],
    },
    {
        version: '1.0.2',
        date: '2026-03-14',
        title: '技能附加信息悬浮提示 + 战力徽章特效',
        changes: [
            { type: 'feat', text: '技能 Info 悬浮卡片：附加攻击比、固定攻击、气血/真气比、爆伤、伤害倍数、重要性与频次' },
            { type: 'perf', text: '综合战力徽章呼吸灯与卡片光晕特效' },
        ],
    },
    {
        version: '1.0.1',
        date: '2026-03-14',
        title: '新增太昊职业',
        changes: [
            { type: 'data', text: '太昊职业与核心技能「天地绝」配置，并确立 SkillID 命名规则' },
        ],
    },
];

/** 数组第 0 条即当前版本（changelog 与 package.json 同号） */
export const LATEST_CHANGELOG_VERSION = CHANGELOG[0].version;
