/**
 * 更新日志数据（Step 11）
 *
 * 唯一真相来源：`doc/change_log.md`（1.0.1 ~ 1.0.8 的真实历史）+ 后续各轮网站优化。
 * 新增版本时：① 改 `web_app/package.json` 的 version；② 在 CHANGELOG 顶部插一条同号记录。
 * 顺序约定：**数组第 0 条即当前版本**（ChangelogPage / Header 徽章都按此推导）。
 *
 * 文案口径（用户拍板）：「面向普通玩家」——只说改了什么、加了什么、**在哪操作**，
 * 不写实现手段（路由/分包/编码方式/aria 等技术名词一律不出现在正文里）。
 * 需要细节时以 doc/change_log.md 为准。
 */

export type ChangeType = 'feat' | 'fix' | 'perf' | 'data';

export interface ChangelogChange {
    /** 变更类型 —— 决定页面上的标签文案与图标（不参与配色） */
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
        version: '1.1.1',
        date: '2026-09-17',
        title: '分享链接不再丢增益数值',
        changes: [
            { type: 'fix', text: '修复：只改了增益数值、没有勾掉任何一条时，「复制分享链接」发出去的数值会变回默认（比如专注 241 变成 261）—— 现在改多少就分享多少' },
        ],
    },
    {
        version: '1.1.0',
        date: '2026-09-17',
        title: '方案对比：两套配装当面比',
        changes: [
            { type: 'feat', text: '计算器「属性方案」区新增「对比」按钮，存了两套以上方案后就能用' },
            { type: 'feat', text: '点开后可左右并排看两套方案：七项属性、各项增益、打每个副本的伤害，高的一边标绿，并标出差多少、差百分之几' },
            { type: 'feat', text: '伤害可以一层层点开看：副本 → BOSS → 每个技能，两边各打多少一眼对读；不点开就不会铺满屏幕' },
            { type: 'feat', text: '对比窗口只看不改，关掉就回到原来的配置；要换当前方案请回计算器用「属性方案」下拉' },
            { type: 'feat', text: '顶部「全景战斗资料库」新增下拉菜单，在任意页面都能直接进极致属性 / 职业技能 / 职业状态 / 副本 BOSS' },
        ],
    },
    {
        version: '1.0.9',
        date: '2026-09-17',
        title: '大更新：网址可分享、多套方案、长图分享、更新日志',
        changes: [
            { type: 'feat', text: '每个页面都有自己的网址，可以收藏、发给别人；刷新、前进后退都不会跳错页面' },
            { type: 'feat', text: '可以保存多套属性方案，随时切换、重命名、删除；改动没保存时会提醒' },
            { type: 'feat', text: '计算完能生成一张长图（属性、增益、当前 BOSS 每个技能的伤害都在上面），直接发给别人看' },
            { type: 'feat', text: '也能生成一个分享链接，别人打开看到的是和你完全一样的配置和结果' },
            { type: 'feat', text: '新增本页「更新日志」，能看到每个版本改了什么' },
            { type: 'feat', text: '页面某一块出错不再整页白屏，可以一键刷新恢复' },
            { type: 'feat', text: '补齐键盘操作与读屏支持，图标按钮也能读出含义' },
            { type: 'perf', text: '打开更快：首屏要下载的内容缩小约 70%' },
            { type: 'fix', text: '修复部分按钮、卡片边框颜色不显示的问题' },
            { type: 'fix', text: '网络不稳或本地数据损坏时会给出提示，不再无声出错' },
            { type: 'fix', text: '页脚补上意见反馈入口和免责声明，版权年份改为自动更新' },
            { type: 'feat', text: '分享到微信 / QQ 时会显示正确的标题和缩略图，搜索引擎也能更好地收录本站' },
        ],
    },
    {
        version: '1.0.8',
        date: '2026-09-15',
        title: '技能速查补全四代被动；两个搜索框合并',
        changes: [
            { type: 'feat', text: '单次计算改用最高品质曦日，把四代被动全部算进去；另加一个「战斗满状态峰值」的算法（逐霜苍龙·龙怒）' },
            { type: 'feat', text: '技能速查补上四代被动卡：玄烛 / 赤乌槽位、三档品质的增量、普通卡的反向增益都标了出来' },
            { type: 'perf', text: '右上角搜索框与首页 Ctrl+K 搜索框合并成一套，两边的结果和排序完全一致' },
        ],
    },
    {
        version: '1.0.7',
        date: '2026-09-15',
        title: '流波惊变技改 · 逐霜',
        changes: [
            { type: 'feat', text: '新增「多层叠加」的计算方式：同一个增益可以叠很多层，逐霜「龙怒」是第一个用上的技能' },
            { type: 'feat', text: '龙怒改为按层数逐层消耗来算：施放鹰扬折冲一次补满 27 层，每打中一次消耗一层，附加攻击按技能等级计算' },
            { type: 'data', text: '玄烛·醉月飞觞佩戴即给苍龙啸系 +50% 附加攻击；山雨欲来 III 附加攻击比 395% → 445%' },
        ],
    },
    {
        version: '1.0.6',
        date: '2026-09-13',
        title: '新副本数据：天帝宝库（三个难度）',
        changes: [
            { type: 'data', text: '天帝宝库三个难度（初入江湖 / 再起风云 / 三生苦旅）各 7 只 BOSS 的属性都录齐了，含新增的黄鸟与秦无炎' },
            { type: 'data', text: '三生苦旅的血量从占位数字换成真实值，并逐只核对过血条' },
        ],
    },
    {
        version: '1.0.5',
        date: '2026-09-13',
        title: '新副本数据：流波惊变',
        changes: [
            { type: 'data', text: '新增副本流波惊变（初识 / 困难），每个难度 5 只 BOSS + 2 只小怪的属性' },
        ],
    },
    {
        version: '1.0.4',
        date: '2026-09-08',
        title: '新副本数据：镇海！断浪碎晶宫（T21）+ 辅助职业能力表',
        changes: [
            { type: 'data', text: 'T21 六只 BOSS 的 18 项面板属性录齐，三只小怪单独归档' },
            { type: 'data', text: '新增辅助职业能力表：19 个职业的增伤 / 绿点 / 紫点 / 破防与综合评定' },
        ],
    },
    {
        version: '1.0.3',
        date: '2026-06-10',
        title: '昭冥技能排期修正',
        changes: [
            { type: 'feat', text: '训练场与辅助的初始参数统一放到配置文件里，以后调整不用改代码' },
            { type: 'fix', text: '修正昭冥「日月弘光」的冷却排期；增益时长支持按效果动态延长' },
        ],
    },
    {
        version: '1.0.2',
        date: '2026-03-14',
        title: '技能悬浮提示 + 战力徽章特效',
        changes: [
            { type: 'feat', text: '鼠标悬停技能可以看到详情卡：附加攻击比、固定攻击、气血 / 真气比、爆伤、伤害倍数、重要性与频次' },
            { type: 'feat', text: '综合战力徽章加呼吸灯效果，卡片加光晕' },
        ],
    },
    {
        version: '1.0.1',
        date: '2026-03-14',
        title: '新增太昊职业',
        changes: [
            { type: 'data', text: '新增太昊职业及其核心技能「天地绝」' },
        ],
    },
];

/** 数组第 0 条即当前版本（changelog 与 package.json 同号） */
export const LATEST_CHANGELOG_VERSION = CHANGELOG[0].version;
