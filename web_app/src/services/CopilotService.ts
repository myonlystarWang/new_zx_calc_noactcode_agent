/**
 * CopilotService.ts
 * 双轨 AI 助手服务引擎：
 * 1. L1 本地极速意图引擎（0ms、0成本、0消耗）：Boss、技能、法宝、极致攻略、开服状态直答与计算
 * 2. L2 纯文本专属模型池（高 RPM、免费模型池）：智谱 GLM-4-Flash、硅基流动 Qwen2.5、Workers AI
 * 3. L3 视觉多模态专属模型池（识图专用通道）：智谱 GLM-4V-Flash、硅基 Qwen2-VL、Gemini-1.5-Flash、Workers AI Vision
 */

import { DataService, isValidSkill } from './DataService';
import { getVisionFixture } from './vision/devFixture';
import { downscaleDataUrl } from '../utils/imageDownscale';
import { pinyin } from 'pinyin-pro';
import type { Dungeon, Monster, CuratedEquipItem, CuratedSkillItem, FabaoItem } from '../types';
import { getEquipSeries, collapseSeriesCandidates } from '../utils/equipSeries';
import { isYunlingEquip } from '../utils/equipStatKey';
import { EQUIP_HUB_GROUPS, EQUIP_HUB_OPTIONS } from './equipHubOptions';

export const UNIFIED_NOT_FOUND_REPLY =
    '天书万象 AI 暂时未能完全理解您的意思。建议尝试使用“关键词+空格”组合检索，例如：\n' +
    '• 装备速查：【昭武 衣服】、【佩章】、【四灵本元】、【新天缘】、【神机洗练】、【旧天缘】\n' +
    '• 门派与技能：【逐霜 苍龙啸】、【鬼王 星宿】、【青云 神通】、【贺岁时装特技】\n' +
    '• 进阶与数值：【星宿升星】、【宝石属性】、【宠物刻蚀】、【阵灵升级】、【法宝经验】\n' +
    '• 工具与模拟：【战力计算】、【副本训练场】、【开服雷达】、【天缘模拟】\n' +
    '• 截图识图：直接在聊天框【粘贴游戏 C 键面板截图】\n\n' +
    '或者直接点选下方全景分类导航：';

export const TOP_HUB_OPTIONS = [
    { key: 'equip', label: '装备', query: '装备' },
    { key: 'skill', label: '技能', query: '技能' },
    { key: 'xingsu', label: '星宿', query: '星宿' },
    { key: 'tianyuan', label: '天缘', query: '天缘' },
    { key: 'exp', label: '升级经验', query: '升级经验' },
    { key: 'zhenling', label: '阵灵', query: '阵灵' },
    { key: 'fabao', label: '法宝', query: '法宝' },
    { key: 'measure', label: '属性测算', query: '属性测算' },
    { key: 'guide', label: '玩法攻略', query: '玩法攻略' },
    { key: 'calc', label: '伤害计算', query: '计算实战战力', workspaceMode: 'calc' },
    { key: 'server', label: '开服雷达', query: '开服雷达' },
];

/**
 * 统一的「未命中」消息工厂（2026-10-22）
 * 铁律：L1 任何走查无结果的返回，都必须自带 top_hub 全景分类导航卡。
 * 历史坑：早期 4 处 return 只回 UNIFIED_NOT_FOUND_REPLY 文本、不带 cardType，
 * 而 HomePage 只在 L2 chatText 兜底时才补挂 top_hub → 用户在「武器上15的神机有哪些」
 * 一类输入下只看到一堆示例文案、下方导航卡缺失（截图实证 2026-10-22）。
 */
export function buildNotFoundMessage(timeStr: string): CopilotMessage {
    return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: UNIFIED_NOT_FOUND_REPLY,
        time: timeStr,
        cardType: 'top_hub',
        cardData: {
            title: '全景分类导航',
            options: TOP_HUB_OPTIONS,
        },
    };
}

/** L2/远端可能返回同义「没听懂」文案，统一判定，避免导航卡只在一种措辞下出现 */
const NOT_FOUND_MARKERS = ['未能完全理解', '未能理解', '无法理解', '没听懂', '本地知识库暂未覆盖'];

export function isNotFoundReply(reply: string): boolean {
    if (!reply) return false;
    return NOT_FOUND_MARKERS.some((m) => reply.includes(m));
}

export interface CopilotMessage {
    id: string;
    sender: 'user' | 'assistant' | 'system';
    text: string;
    time: string;
    image?: string;
    cardType?: 'boss' | 'boss_candidates' | 'skill' | 'skill_candidates' | 'fabao' | 'fabao_candidates' | 'equip' | 'equip_candidates' | 'ceiling' | 'server' | 'c_panel_review' | 'xyc_diag' | 'tool_card' | 'class_hub' | 'slot_hub' | 'class_status' | 'peizhang' | 'ninglingqi' | 'pet_pledge' | 'zhenling_upgrade' | 'fabao_upgrade' | 'shenji_forge' | 'exp_hub' | 'measure_hub' | 'guide_hub' | 'top_hub' | 'equip_hub' | 'skill_hub' | 'jiuwenlang' | 'tianyuan_old' | 'tianyuan_new' | 'tianyuan_sim' | 'xingsu' | 'baoshi' | 'fashion_skill' | 'silin_benyuan' | 'tianyuan_hub' | 'sim_hub' | 'yunling_forge' | 'xyc_tome' | 'xyc_wash' | 'xyc_hub' | 'wip_feature';
    cardData?: any;
}

export interface VisionExtractionResult {
    mode: 'c_panel' | 'xyc' | 'item' | 'general';
    rawExplanation: string;
    /** 新协议：识别到的原始结构化面板（存在时前端走 c_panel_review 校对新卡） */
    panel?: any;
    /** 新协议：通道与降级信息 */
    provider?: string | null;
    degraded?: boolean;
    degradedReason?: string;
    /** 降级时也要带上「模型认为是哪个体系」，否则前端只能默认角色面板（天缘图会掉进战力计算） */
    recognizedKind?: string | null;
    recognizedKindEvidence?: string[];
    lastError?: string;
    quality?: 'full' | 'partial';
    issues?: string[];
}

export interface DungeonCategoryConfig {
    id: 'tben' | 'tuanben' | 'trials';
    label: string;
    keywords: string[];
    dungeonIds: string[];
}

export const DUNGEON_CATEGORIES: DungeonCategoryConfig[] = [
    {
        id: 'tben',
        label: 'T本（T10-T21）',
        keywords: ['t本', 't系列', 't10-t21', 't16-t21', '梯本', '小队本', '小队副本'],
        dungeonIds: [
            'WUDU_QIGONGQIN_T10',
            'WUDU_QIGONGQIN_T11',
            'WUDU_QIGONGQIN_T12',
            'WENTIAN_HUANYUE_T13',
            'WENTIAN_HUANYUE_T14',
            'WENTIAN_HUANYUE_T15',
            'HUIMENG_LINGYUN_T16',
            'HUIMENG_LINGYUN_T17',
            'HUIMENG_LINGYUN_T18',
            'ZHENHAI_DUANLANG_T19',
            'ZHENHAI_DUANLANG_T20',
            'ZHENHAI_DUANLANG_T21',
        ]
    },
    {
        id: 'tuanben',
        label: '团本（兽神、空桑、天帝、流波）',
        keywords: ['团本', '团队本', '团队副本', '大型本', '大型团本', '大型副本'],
        dungeonIds: [
            'SHOUSHEN_JIANGLIN_HARD',
            'JIEQI_KONGSANG_NORMAL',
            'JIEQI_KONGSANG_HARD',
            'TIANDI_BAOKU_NORMAL',
            'TIANDI_BAOKU_MEDIUM',
            'TIANDI_BAOKU_HARD',
            'LIU_BO_JING_BIAN_CHUSHI',
            'LIU_BO_JING_BIAN_HARD',
        ]
    },
    {
        id: 'trials',
        label: '历练与试炼（四象七、悬夜林）',
        keywords: ['历练', '试炼', '历练与试炼', '试炼本', '历练本'],
        dungeonIds: [
            'SIXIANG_QI',
            'XUANYELIN_QIWEI_WUGONG',
        ]
    }
];

export interface DungeonDictionaryItem {
    dungeonId: string;
    shortLabel: string;
    fullName: string;
    categoryId: 'tben' | 'tuanben' | 'trials';
    categoryLabel: string;
    aliases: string[];
}

export const DUNGEON_DICTIONARY: DungeonDictionaryItem[] = [
    {
        dungeonId: 'WUDU_QIGONGQIN_T10',
        shortLabel: 'T10',
        fullName: '鏖战！五毒其攻侵（T10）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t10', '五毒t10', '五毒其攻侵t10', '鏖战t10', '五毒初']
    },
    {
        dungeonId: 'WUDU_QIGONGQIN_T11',
        shortLabel: 'T11',
        fullName: '鏖战！五毒其攻侵（T11）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t11', '五毒t11', '五毒其攻侵t11', '鏖战t11', '五毒中']
    },
    {
        dungeonId: 'WUDU_QIGONGQIN_T12',
        shortLabel: 'T12',
        fullName: '鏖战！五毒其攻侵（T12）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t12', '五毒t12', '五毒其攻侵t12', '鏖战t12', '五毒高']
    },
    {
        dungeonId: 'WENTIAN_HUANYUE_T13',
        shortLabel: 'T13',
        fullName: '问天！幻月自缥缈（T13）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t13', '幻月t13', '幻月自缥缈t13', '问天t13', '幻月初']
    },
    {
        dungeonId: 'WENTIAN_HUANYUE_T14',
        shortLabel: 'T14',
        fullName: '问天！幻月自缥缈（T14）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t14', '幻月t14', '幻月自缥缈t14', '问天t14', '幻月中']
    },
    {
        dungeonId: 'WENTIAN_HUANYUE_T15',
        shortLabel: 'T15',
        fullName: '问天！幻月自缥缈（T15）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t15', '幻月t15', '幻月自缥缈t15', '问天t15', '幻月高']
    },
    {
        dungeonId: 'HUIMENG_LINGYUN_T16',
        shortLabel: 'T16',
        fullName: '会盟！凌云诛众仙（T16）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t16', '绘梦灵运t16', '绘梦t16', '灵运t16', '凌云t16']
    },
    {
        dungeonId: 'HUIMENG_LINGYUN_T17',
        shortLabel: 'T17',
        fullName: '会盟！凌云诛众仙（T17）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t17', '绘梦灵运t17', '绘梦t17', '灵运t17', '凌云t17']
    },
    {
        dungeonId: 'HUIMENG_LINGYUN_T18',
        shortLabel: 'T18',
        fullName: '会盟！凌云诛众仙（T18）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t18', '绘梦灵运t18', '绘梦t18', '灵运t18', '凌云t18']
    },
    {
        dungeonId: 'ZHENHAI_DUANLANG_T19',
        shortLabel: 'T19',
        fullName: '镇海！断浪碎晶宫（T19）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t19', '镇海断浪t19', '断浪t19', '镇海t19', '碎晶宫t19', '断浪碎晶宫t19']
    },
    {
        dungeonId: 'ZHENHAI_DUANLANG_T20',
        shortLabel: 'T20',
        fullName: '镇海！断浪碎晶宫（T20）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t20', '镇海断浪t20', '断浪t20', '镇海t20', '碎晶宫t20', '断浪碎晶宫t20']
    },
    {
        dungeonId: 'ZHENHAI_DUANLANG_T21',
        shortLabel: 'T21',
        fullName: '镇海！断浪碎晶宫（T21）',
        categoryId: 'tben',
        categoryLabel: 'T本（T10-T21）',
        aliases: ['t21', '镇海断浪t21', '断浪t21', '镇海t21', '碎晶宫t21', '断浪碎晶宫t21']
    },
    {
        dungeonId: 'SHOUSHEN_JIANGLIN_HARD',
        shortLabel: '兽神困难',
        fullName: '兽神降临（困难）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['兽神困难', '兽神', '兽神降临', '兽神降临困难']
    },
    {
        dungeonId: 'JIEQI_KONGSANG_NORMAL',
        shortLabel: '空桑初识',
        fullName: '劫起空桑（初识）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['空桑初识', '空桑简单', '空桑普通', '劫起空桑初识']
    },
    {
        dungeonId: 'JIEQI_KONGSANG_HARD',
        shortLabel: '空桑困难',
        fullName: '劫起空桑（困难）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['空桑困难', '劫起空桑困难']
    },
    {
        dungeonId: 'TIANDI_BAOKU_NORMAL',
        shortLabel: '天帝1',
        fullName: '天帝宝库（初入江湖）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['天帝1', '天帝一', '天帝初识', '天帝普通', '天帝宝库普通', '宝库1', '宝库一', '天帝初入江湖']
    },
    {
        dungeonId: 'TIANDI_BAOKU_MEDIUM',
        shortLabel: '天帝2',
        fullName: '天帝宝库（再起风云）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['天帝2', '天帝二', '天帝中等', '天帝宝库中等', '宝库2', '宝库二', '天帝再起风云']
    },
    {
        dungeonId: 'TIANDI_BAOKU_HARD',
        shortLabel: '天帝3',
        fullName: '天帝宝库（三生苦旅）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['天帝3', '天帝三', '天帝困难', '天帝宝库困难', '宝库3', '宝库三', '天帝三生苦旅']
    },
    {
        dungeonId: 'LIU_BO_JING_BIAN_CHUSHI',
        shortLabel: '流波初识',
        fullName: '流波惊变（初识）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['流波初识', '流波普通', '流波简单', '流波惊变初识']
    },
    {
        dungeonId: 'LIU_BO_JING_BIAN_HARD',
        shortLabel: '流波困难',
        fullName: '流波惊变（困难）',
        categoryId: 'tuanben',
        categoryLabel: '团本（兽神、空桑、天帝、流波）',
        aliases: ['流波困难', '流波惊变困难']
    },
    {
        dungeonId: 'SIXIANG_QI',
        shortLabel: '四象七',
        fullName: '试炼·四象五行（七杀罪狱）',
        categoryId: 'trials',
        categoryLabel: '历练与试炼（四象七、悬夜林）',
        aliases: ['四象七', '四象7', '四象之七', '四象试炼', '七杀罪狱']
    },
    {
        dungeonId: 'XUANYELIN_QIWEI_WUGONG',
        shortLabel: '悬夜林',
        fullName: '悬夜林（七尾蜈蚣）',
        categoryId: 'trials',
        categoryLabel: '历练与试炼（四象七、悬夜林）',
        aliases: ['悬夜林', '悬夜', '七尾蜈蚣']
    }
];

export interface DungeonSeriesConfig {
    seriesId: string;
    seriesName: string;
    keywords: string[];
    dungeonIds: string[];
    hintText: string;
}

export const DUNGEON_SERIES: DungeonSeriesConfig[] = [
    {
        seriesId: 'wudu',
        seriesName: '鏖战！五毒其攻侵',
        keywords: ['五毒', '五毒其攻侵', '鏖战', '心魔'],
        dungeonIds: ['WUDU_QIGONGQIN_T10', 'WUDU_QIGONGQIN_T11', 'WUDU_QIGONGQIN_T12'],
        hintText: '包含【T10】、【T11】、【T12】三种小队梯队。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【T10】/【T11】/【T12】精准直达：'
    },
    {
        seriesId: 'huanyue',
        seriesName: '问天！幻月自缥缈',
        keywords: ['幻月', '问天', '幻月自缥缈'],
        dungeonIds: ['WENTIAN_HUANYUE_T13', 'WENTIAN_HUANYUE_T14', 'WENTIAN_HUANYUE_T15'],
        hintText: '包含【T13】、【T14】、【T15】三种小队梯队。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【T13】/【T14】/【T15】精准直达：'
    },
    {
        seriesId: 'liubo',
        seriesName: '流波惊变',
        keywords: ['流波', '流波惊变', '惊变'],
        dungeonIds: ['LIU_BO_JING_BIAN_CHUSHI', 'LIU_BO_JING_BIAN_HARD'],
        hintText: '包含【初识】与【困难】两种难度阶段。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【流波初识】/【流波困难】精准直达：'
    },
    {
        seriesId: 'kongsang',
        seriesName: '劫起空桑',
        keywords: ['空桑', '劫起空桑'],
        dungeonIds: ['JIEQI_KONGSANG_NORMAL', 'JIEQI_KONGSANG_HARD'],
        hintText: '包含【初识】与【困难】两种难度阶段。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【空桑初识】/【空桑困难】精准直达：'
    },
    {
        seriesId: 'tiandi',
        seriesName: '天帝宝库',
        keywords: ['天帝', '天帝宝库', '宝库'],
        dungeonIds: ['TIANDI_BAOKU_NORMAL', 'TIANDI_BAOKU_MEDIUM', 'TIANDI_BAOKU_HARD'],
        hintText: '分为【天帝1（初入江湖）】、【天帝2（再起风云）】、【天帝3（三生苦旅）】三种难度阶梯。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【天帝1】/【天帝2】/【天帝3】精准直达：'
    },
    {
        seriesId: 'duanlang',
        seriesName: '镇海！断浪碎晶宫',
        keywords: ['断浪', '碎晶宫', '镇海断浪', '断浪碎晶宫'],
        dungeonIds: ['ZHENHAI_DUANLANG_T19', 'ZHENHAI_DUANLANG_T20', 'ZHENHAI_DUANLANG_T21'],
        hintText: '包含【T19】、【T20】、【T21】三种小队梯队。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【T19】/【T20】/【T21】精准直达：'
    },
    {
        seriesId: 'lingyun',
        seriesName: '会盟！凌云诛众仙',
        keywords: ['凌云', '会盟', '绘梦', '凌云诛众仙'],
        dungeonIds: ['HUIMENG_LINGYUN_T16', 'HUIMENG_LINGYUN_T17', 'HUIMENG_LINGYUN_T18'],
        hintText: '包含【T16】、【T17】、【T18】三种小队梯队。可在下方点选切换查看各难度 BOSS 战斗属性，或输入【T16】/【T17】/【T18】精准直达：'
    }
];

export interface BossCandidateItem {
    id: string;
    monsterId: string;
    monsterName: string;
    dungeonId: string;
    dungeonName: string;
    dungeonShortLabel: string;
    categoryLabel: string;
    difficulty?: string;
    def: number;
    hp: number;
    critRed: number;
    critDmgRed: number;
    route: string;
    monster?: Monster;
    dungeon?: Dungeon;
}

const CUSTOM_KEYS_STORAGE = 'zx_ai_copilot_custom_keys';

// 职业名总表（模块级单源，T-12/T-15 共用）：
// ① 轩辕策微工具意图排除用——带职业前缀的「职业+轩辕策」应走技能分支（技能数据有 27 个「职业·轩辕策」组）；
// ② 裸职业名精确匹配（class_hub 分流卡）用。
const PROFESSIONS: string[] = [
    '逐霜', '青云', '鬼王', '合欢', '天音', '鬼道', '焚香', '九黎', '烈山', '怀光',
    '天华', '太昊', '辰皇', '破军', '牵机', '英招', '归云', '画影', '昭冥', '惊岚',
    '涅羽', '百灵', '释罗', '万毒', '长生堂', '青罗', '炼血'
];

// ------------------------------------------------------------
// T-05 拼音归一词库（L0 层）：与下方 matchLocalIntent 内的品质/部位数组、
// PROFESSIONS、SKILL_CATEGORY_MAP 同源（P2 词库数据化时统一为单一数据文件）
// ------------------------------------------------------------
const PINYIN_VOCAB_TERMS: string[] = [
    ...PROFESSIONS,
    // 装备品质
    '修武', '昭武', '彰武', '神隐', '神级', '天命', '至尊', '混虚',
    // 装备部位
    '武器', '头盔', '衣服', '靴子', '袖甲', '腰带', '项链', '戒指', '法身', '罡气', '护符', '勋章', '玺绶', '锦囊', '佩章',
    // 通用查询词
    '技能', '装备', '法宝', '副本', '属性', '轩辕策', '神通', '天书', '心法', '造化',
    '易伤', '增伤', '破防', '绿点', '紫点',
];

// [拼音, 中文术语]，按拼音长度降序（贪心最长匹配）；同音歧义整键弃用防误命中
let pinyinAliasCache: Array<[string, string]> | null = null;
function getPinyinAliases(): Array<[string, string]> {
    if (pinyinAliasCache) return pinyinAliasCache;
    const byPinyin = new Map<string, string[]>();
    for (const term of PINYIN_VOCAB_TERMS) {
        // ü→v 规范化：pinyin-pro 返回 "lü"，而用户键盘输入用 "lv"，两边必须同构
        const py = pinyin(term, { toneType: 'none' }).replace(/ü/g, 'v').replace(/[^a-z]/g, '');
        if (!py) continue;
        const list = byPinyin.get(py) || [];
        list.push(term);
        byPinyin.set(py, list);
    }
    const aliases: Array<[string, string]> = [];
    for (const [py, terms] of byPinyin) {
        if (terms.length === 1) aliases.push([py, terms[0]]);
    }
    aliases.sort((a, b) => b[0].length - a[0].length);
    pinyinAliasCache = aliases;
    return aliases;
}

// ------------------------------------------------------------
// T-16 部件系列词库（用户 2026-10-16 逐部件分诊口径）
// 非品质系部件按名称模式分系列；系列 query（如「社稷项链」）在装备分支展开为
// terms 走包含/起头/结尾匹配。match: prefix=起头 / contains=包含 / suffix=结尾。
// 神级首饰沿用既有「印记」卡片（太昊/太乙按升级合并显示）。
// 注：星语项链 11 件经实证全部为 lv=1 废弃数据，用户裁决全部屏蔽——入口已移除，
// 装备分支另有「星语」显式屏蔽兜底（防未来非 1 级星语数据漏出）。
// ------------------------------------------------------------
interface SlotSeries {
    key: string;
    label: string;
    /** prefix=起头 / contains=包含 / suffix=结尾 / exclude=补集（该 slot 下不属于任何其他系列） */
    match: 'prefix' | 'contains' | 'suffix' | 'exclude';
    /** 装备名称匹配词（按 match 模式命中任一即属该系列；exclude 时留空） */
    terms: string[];
    /** 玩家别称（如「积分项链」= 煌武） */
    aliases?: string[];
}
const SLOT_SERIES: Record<string, SlotSeries[]> = {
    '_all': [
        // 跨部位系列：裸「神级首饰」混显项链+戒指；「神级项链」「神级戒指」按部位收窄
        { key: 'shenji', label: '神级首饰', match: 'contains', terms: ['印记', '造化之', '符石', '血玉'] },
    ],
    '项链': [
        { key: 'shenji', label: '神级首饰', match: 'contains', terms: ['印记', '造化之', '太昊', '太乙'], aliases: ['神级项链'] },
        { key: 'huangwu', label: '煌武项链', match: 'contains', terms: ['煌武'], aliases: ['积分项链'] },
        { key: 'zhandui', label: '战队项链', match: 'contains', terms: ['圣瑞', '圣谛'] },
        { key: 'sheji', label: '社稷项链', match: 'contains', terms: ['菩提珠', '琥珀珠', '舍利子', '血菩提', '真如子'] },
        { key: 'other', label: '其他项链', match: 'exclude', terms: [] },
    ],
    '戒指': [
        { key: 'shenji', label: '神级首饰', match: 'contains', terms: ['符石', '血玉'], aliases: ['神级戒指'] },
        { key: 'other', label: '其他戒指', match: 'exclude', terms: [] },
    ],
    '锦囊': [
        { key: 'xiaoyao', label: '逍遥锦囊', match: 'prefix', terms: ['逍遥'] },
        { key: 'taixu', label: '太虚锦囊', match: 'prefix', terms: ['太虚'] },
        { key: 'shenxing', label: '神行锦囊', match: 'prefix', terms: ['神行'] },
        { key: 'guanxin', label: '观心锦囊', match: 'prefix', terms: ['观心'] },
        { key: 'tianyu', label: '天雨锦囊', match: 'prefix', terms: ['天雨'] },
        { key: 'other', label: '其他锦囊', match: 'exclude', terms: [] },
    ],
    '罡气': [
        { key: 'zhangang', label: '战罡', match: 'contains', terms: ['战罡'] },
        { key: 'other', label: '其他罡气', match: 'exclude', terms: [] },
    ],
    '法身': [
        { key: 'fashen', label: '法身', match: 'prefix', terms: ['法身'] },
        { key: 'jinshen', label: '金身', match: 'prefix', terms: ['金身', '无常空相'] },
    ],
    '玺绶': [
        { key: 'anniversary', label: '周年印', match: 'prefix', terms: ['贺岁金印'], aliases: ['贺岁金印', '周年印', '周年金印', '贺岁印'] },
        { key: 'fengyun', label: '风云印', match: 'prefix', terms: ['风云印'] },
        { key: 'jingtian', label: '惊天印', match: 'prefix', terms: ['惊天印'] },
        { key: 'qitian', label: '齐天印', match: 'prefix', terms: ['齐天印'] },
        { key: 'fantian', label: '翻天印', match: 'prefix', terms: ['翻天印'] },
        { key: 'futian', label: '覆天印', match: 'prefix', terms: ['覆天印'] },
        { key: 'sheji', label: '社稷印', match: 'prefix', terms: ['社稷印'] },
        {
            key: 'kuafu', label: '跨服印', match: 'contains', terms: [
                '2013跨服冠军玺绶', '傲雪凌寒印', '霸王龙图印', '百战苍劫印', '碧峭击云印', '碧影含光印', '参商凌空印', '沧溟横云印', '苍龙翔云印', '苍穹御光印', '尘陨归墟印', '宸罡御无印', '宸月破空印', '赤砂辉月印', '赤炎流火印', '帝阙垂荫印', '繁天鸣玉印', '飞尘祈光印', '风雷掠江印', '锋纵八纮印', '浮尘穿雾印', '浮岚流光印', '冠军绶带', '龟甲玉璜', '寒冥幽绶印', '寒潭藏锋印', '寒天惊弦印', '皓月凝光印', '横扫六合印', '宏威霸者印', '虎面玉璜', '晦明百修印', '魂坠寒溟印', '混元万古印', '季军绶带', '剑芒惊夜印', '剑鸣封幽印', '剑破寒川印', '剑指天衡印', '角力惊涛印', '劫光耀泽印', '金戈铁马印', '金鼓铿锵印', '惊绝四方印', '九天煌极印', '九天天授印', '九天真武印', '九霄谒圣印', '勘妄归臻印', '魁昂九霄印', '雷部鸿钧印', '雷部混元印', '雷部使者印', '雷部天尊印', '雷部无极印', '雷部无相印', '雷部玄霄印', '雷部总兵印', '雷霆万钧印', '雷音千里印', '裂云催关印', '灵山吞海印', '灵至太墟印', '凌风斩岳印', '凌霄御尘印', '凌虚御光印', '龙城飞将印', '龙纹玉璜', '龙骧虎视印', '掠影夺锋印', '名扬十载印', '墨烬飞白印', '幕天逐寒印', '凝雨拂光印', '怒涛卷雪印', '磐岳镇流印', '破浪乘风印', '气盖山河印', '千古江山印', '青峰破阵印', '青岳御风印', '擎雷撼州印', '狮王争霸王者印', '狮王争霸威者印', '狮王争霸尊者印', '疏雨化痕印', '朔光披金印', '素云承露印', '碎星征寒印', '踏尘饮血印', '天域浮岛王者印', '万古独断印', '威扬四海印', '威震三山印', '威震十方印', '问鼎九州印', '问鼎王者印', '无上尊圣印', '无象尊者印', '武德十全印', '雾雨鎏金印', '侠骨剑心印', '袖揽苍穹印', '虚渊荡尘印', '玄璧映光印', '玄戈鸣金印', '玄谷行光印', '玄冥魁星印', '玄穹衍圣印', '玄霜古玺印', '玄羽破锋印', '璇光不染印', '雪舞回风印', '亚军绶带', '引光归澜印', '勇者绶带', '幽冥镇渊印', '御浪擎天印', '月影穿林印', '云霭隐光印', '云飞影疾印', '斩业无归印', '战神天罡印', '长风裂天印', '真武圣尊印', '振羽凛风印', '至武神威印', '逐鹿疆场王者印', '逐鹿疆场威者印', '逐鹿疆场尊者印', '紫宸神谕印'
            ]
        },
        { key: 'other', label: '其他玺绶', match: 'exclude', terms: [] },
    ],
};

// 系列名匹配：**精确匹配** label 或别名（防止「至尊 法身」这类「品质+部位」
// 组合查询被 series includes 误劫持——T-16 实测踩中，见 gen-equip-至尊-法身）。
// 先按 matchedSlot 查部位专属（含「神级项链」等部位收窄别名），
// 再无 slot 时查 _all 跨部位（裸「神级首饰」）与其他部位。
function findSlotSeries(slot: string | undefined, q: string): SlotSeries | undefined {
    const hit = (list?: SlotSeries[]) => list?.find(s =>
        q === s.label || (s.aliases || []).some(a => q === a)
    );
    if (slot) {
        const own = hit(SLOT_SERIES[slot]);
        if (own) return own;
    }
    return hit(SLOT_SERIES['_all']) || hit(SLOT_SERIES['项链']) || hit(SLOT_SERIES['戒指']) ||
        hit(SLOT_SERIES['锦囊']) || hit(SLOT_SERIES['罡气']) || hit(SLOT_SERIES['法身']) || hit(SLOT_SERIES['玺绶']);
}

// 纯字母输入（如 "zhu shuang"）→ 词库中文术语；有任何无法解析的字母段则整体放弃（防半归一化错配）
function normalizePinyinQuery(q: string): string | null {
    const letters = q.replace(/[^a-z]/g, '');
    if (letters.length < 2) return null;
    const aliases = getPinyinAliases();
    const hits: string[] = [];
    let i = 0;
    while (i < letters.length) {
        let hitPy: string | null = null;
        let hitTerm: string | null = null;
        for (const [py, term] of aliases) {
            if (letters.startsWith(py, i)) { hitPy = py; hitTerm = term; break; }
        }
        if (!hitPy || !hitTerm) return null;
        hits.push(hitTerm);
        i += hitPy.length;
    }
    return hits.length > 0 ? hits.join('') : null;
}

export interface UserCustomApiKeys {
    zhipuKey?: string;
    siliconflowKey?: string;
    geminiKey?: string;
}

export class CopilotService {
    private static instance: CopilotService;

    public static getInstance(): CopilotService {
        if (!CopilotService.instance) {
            CopilotService.instance = new CopilotService();
        }
        return CopilotService.instance;
    }

    public getUserKeys(): UserCustomApiKeys {
        try {
            return JSON.parse(localStorage.getItem(CUSTOM_KEYS_STORAGE) || '{}');
        } catch {
            return {};
        }
    }

    public saveUserKeys(keys: UserCustomApiKeys): void {
        localStorage.setItem(CUSTOM_KEYS_STORAGE, JSON.stringify(keys));
    }

    /**
     * L1: 本地极速意图识别（不消耗任何大模型 Token 和 RPM）
     * 覆盖 法宝、装备、Boss、技能、极致攻略、开服状态、轩辕策
     */
    public async matchLocalIntent(query: string): Promise<CopilotMessage | null> {
        let q = query.trim().toLowerCase();
        if (!q) return null;

        // T-05 拼音归一（L0）：纯字母输入（"zhu shuang"/"guiwang"）→ 词库中文术语后走常规匹配；
        // 未命中任何词库术语则保持原样（后续落 L2/查无）。含数字/中文的输入不走此路。
        if (/^[a-z\s]+$/.test(q)) {
            const normalized = normalizePinyinQuery(q);
            if (normalized) q = normalized;
        }

        // 「四象」= 四象七副本的简写（用户 2026-10-23 明确：与轩辕策无关，走副本 BOSS）
        if (q === '四象') q = '四象七';

        // 玩家高频同音/错别字与特定别名归一（2026-10-28 / 2026-10-29 线上 Gap 归口）
        if (q === '黄帝内径') q = '黄帝内经';
        if (q === '归去来玄') q = '归去来';
        if (q === '奥义提升') q = '天琊';
        if (q === '四灵元本') q = '四灵本元';
        if (q === '天音天数') q = '天音天书';
        if (q.includes('轩辕册')) q = q.replace(/轩辕册/g, '轩辕策');
        if (q.includes('伤心花') && (q.includes('真气') || q.includes('爆') || q.includes('血炼'))) {
            // 法宝极端真气/血炼问答：优先定位法宝【伤心花】图鉴做兜底
            q = '伤心花';
        }

        const dataService = DataService.getInstance();
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // 纯数值输入守卫（如输入 "200"、"1000"、"+15" 等）：
        // 杜绝被错误匹配到脏技能名（如 "2"）或任何部件，直接返回统一的“查无此条目”规范提示
        // T-03 精细化：16~21（含"打19"口语形）是玩家对 T16-T21 的通行简称
        //（完美论坛实证"0点去打19"），归一为 tNN 后走副本词典；其余纯数字维持守卫
        const bareDungeonNum = q.match(/^(?:打)?(1[6-9]|2[01])$/);
        if (bareDungeonNum) {
            q = `t${bareDungeonNum[1]}`;
        } else if (/^[+-]?\d+(?:\.\d+)?$/.test(q)) {
            return buildNotFoundMessage(timeStr);
        }

        // ====================================================
        // 核心系统微工具与独立页面意图识别（高优先级，避免被实体槽位分词误伤）
        // ====================================================

        // 0.0 WIP 规划中功能与攻略专项提示（2026-10-29 线上净增量 Gap 收口）
        const WIP_REGISTRY: Array<{
            matcher: (query: string) => boolean;
            featureName: string;
            category: string;
            desc: string;
            recommendedQuery?: string;
        }> = [
            {
                matcher: (s) => s.includes('轮回世界') || s.includes('身世') || s.includes('灵猫'),
                featureName: '轮回世界攻略',
                category: '系统玩法攻略',
                desc: '包含身世选择、灵猫天赋与轮回世界全线通关指南。功能还在开发中，暂未开放。',
                recommendedQuery: '玩法攻略',
            },
            {
                matcher: (s) => s === '周天' || s === '天罡周天' || s.includes('周天星宿'),
                featureName: '周天系统',
                category: '星宿属性进阶',
                desc: '包含周天属性激活与星宿进阶数值矩阵。功能还在开发中，暂未开放。',
                recommendedQuery: '星宿',
            },
            {
                matcher: (s) => s.includes('帝鸿') || s.includes('帝鸿魄'),
                featureName: '帝鸿轩辕策进阶',
                category: '轩辕策进阶系统',
                desc: '包含帝鸿魄洗练、神皇属性转化与高阶词条洗练规则。功能还在开发中，暂未开放。',
                recommendedQuery: '轩辕策',
            },
            {
                matcher: (s) => s.includes('至圣灵轩符'),
                featureName: '至圣灵轩符道具指南',
                category: '洗练道具百科',
                desc: '包含至圣灵轩符洗练保底机制与获取途径一览。功能还在开发中，暂未开放。',
                recommendedQuery: '轩辕策洗练',
            },
            {
                matcher: (s) => s.includes('阵灵阵容') || s.includes('阵灵搭配') || s.includes('阵灵模拟'),
                featureName: '阵灵模拟与阵容搭配',
                category: '阵灵进阶工具',
                desc: '包含 6金2紫/克制阵容克性评分与阵法模拟器。功能还在开发中，暂未开放。',
                recommendedQuery: '阵灵升级',
            },
            {
                matcher: (s) => s.includes('人物传') || s.includes('曾书书'),
                featureName: '人物传剧情攻略',
                category: '任务剧情指南',
                desc: '包含曾书书等全人物传支线分支与成就奖励速查。功能还在开发中，暂未开放。',
                recommendedQuery: '玩法攻略',
            },
            {
                matcher: (s) => (s.includes('佛焚香') || s.includes('归云')) && (s.includes('加点') || s.includes('玩') || s.includes('怎么')),
                featureName: '门派流派进阶攻略',
                category: '门派战术流派',
                desc: '包含佛焚香加点、归云输出循环等高阶流派配装指南。功能还在开发中，暂未开放。',
                recommendedQuery: '职业状态',
            },
            {
                matcher: (s) => s.includes('状态图标') || s.includes('buff图标'),
                featureName: '战斗状态图标大全',
                category: '实战辅助手册',
                desc: '包含诛仙3全门派不利与有利状态图标与对应机制。功能还在开发中，暂未开放。',
                recommendedQuery: '职业状态',
            },
            {
                matcher: (s) => s.includes('真气') && (s.includes('极限') || s.includes('极致') || s.includes('攻略')),
                featureName: '极致真气攻略',
                category: '极致属性系列',
                desc: '包含青云/鬼王真气上限理论峰值与各部位堆叠清单。功能还在开发中，暂未开放。',
                recommendedQuery: '玩法攻略',
            },
            {
                matcher: (s) => s.includes('化灵'),
                featureName: '化灵系统全景攻略',
                category: '系统玩法攻略',
                desc: '包含化灵属性上限、进阶消耗与实战边际收益。功能还在开发中，暂未开放。',
                recommendedQuery: '属性测算',
            },
            {
                matcher: (s) => s.includes('元婴') && (s.includes('升级') || s.includes('归劫') || s.includes('洗')),
                featureName: '元婴洗练升级指南',
                category: '装备进阶攻略',
                desc: '包含元婴归劫概率、道胎升级经验与定制属性。功能还在开发中，暂未开放。',
                recommendedQuery: '装备',
            },
            {
                matcher: (s) => s === '坐骑' || s.includes('坐骑大全') || s.includes('坐骑移速'),
                featureName: '坐骑全图鉴',
                category: '图鉴全景资料',
                desc: '包含全网坐骑移速、飞行坐骑与获取渠道汇总。功能还在开发中，暂未开放。',
                recommendedQuery: '全景导航',
            },
        ];

        const hitWip = WIP_REGISTRY.find(item => item.matcher(q));
        if (hitWip) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `【${hitWip.featureName}】功能还在开发中，暂未开放。已为你记录至产品需求库，敬请期待后续版本上线！\n你也可以先行查阅相关的【${hitWip.recommendedQuery || '全景导航'}】：`,
                time: timeStr,
                cardType: 'wip_feature',
                cardData: {
                    title: hitWip.featureName,
                    category: hitWip.category,
                    desc: hitWip.desc,
                    recommendedQuery: hitWip.recommendedQuery || '全景导航',
                    statusText: '功能还在开发中，暂未开放',
                },
            };
        }

        // 3.98 轩辕策属性信息卡（xyc_tome）—— 已提到微工具区首位（与新天缘精炼同级优先）
        // 四系 × 普通/英雄 × Lv.1–20 全词条区间（装备大类「轩辕策」入口 / 裸「轩辕策」均走此卡）
        // 带「模拟 / 洗炼 / 洗练」时走下方 xyc_wash 洗练模拟卡；无模拟词才落本信息卡
        const isXycTomeQuery =
            (q.includes('轩辕策') ||
                q.includes('青龙策') ||
                q.includes('白虎策') ||
                q.includes('朱雀策') ||
                q.includes('玄武策') ||
                q.includes('青龙书') ||
                q.includes('白虎书') ||
                q.includes('朱雀书') ||
                q.includes('玄武书') ||
                q.includes('青囊玉书') ||
                q.includes('白锦道册') ||
                q.includes('朱翎术纪') ||
                q.includes('玄甲元略') ||
                q.includes('特殊洗练')) &&
            !PROFESSIONS.some((pr) => q.includes(pr));

        if (isXycTomeQuery) {
            let initialBeast = '青龙';
            if (q.includes('白虎') || q.includes('白锦道册')) initialBeast = '白虎';
            else if (q.includes('朱雀') || q.includes('朱翎术纪')) initialBeast = '朱雀';
            else if (q.includes('玄武') || q.includes('玄甲元略')) initialBeast = '玄武';

            const wantsSim = q.includes('模拟') || q.includes('洗炼') || q.includes('洗练') || q.includes('特殊洗练');
            const initialHero = !q.includes('普通');
            const xycLvlMatch = q.match(/(\d{1,2})\s*级/);
            const initialLevel = xycLvlMatch ? Math.min(20, Math.max(1, parseInt(xycLvlMatch[1], 10))) : 1;

            // 洗练 / 模拟 → 洗练模拟卡（1:1 物品窗 + 三种洗练道具）；其余 → 属性信息卡
            if (wantsSim) {
                const gradeMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
                const xycGradeMatch = q.match(/([一二三四五六])\s*品/);
                const initialGrade = xycGradeMatch ? gradeMap[xycGradeMatch[1]] : 6;
                const initialVersion = q.includes('英雄') ? '英雄' : '普通';
                const initialOcc = PROFESSIONS.find((pr) => q.includes(pr));
                return {
                    id: `msg-${Date.now()}`,
                    sender: 'assistant',
                    text: '为你打开【轩辕策洗练模拟】。洗练不改变属性条数：大衍奇术只洗属性、一元道契只洗技能（仅青龙 / 白虎）、太乙宝函属性与技能同洗；上限 10 次，用五种「轩辕拾遗录」逐档提升（逍遥 +4 / 秋水 +3 / 齐物 +3 / 尽年 +5 / 相易 +5，10→30；相易那档仅青龙 / 白虎英雄版能到）。累计洗满 25 次后自动切换【特殊洗练】：三道具齐用、最多锁 2 条、自选本职业 3 级技能必得，25→30 共 5 次额度。',
                    time: timeStr,
                    cardType: 'xyc_wash',
                    cardData: {
                        initialBeast,
                        initialVersion,
                        initialGrade,
                        initialOcc,
                        initialLevel,
                    },
                };
            }

            try {
                const [xycRules, xycMeta] = await Promise.all([
                    dataService.getXycRules(),
                    dataService.getXycTomeMeta(),
                ]);
                return {
                    id: `msg-${Date.now()}`,
                    sender: 'assistant',
                    text: '为你呈现【轩辕策属性全览】。青龙 / 白虎 / 朱雀 / 玄武 四系 × 普通·英雄 双版，Lv.1–20 全词条区间与每级固定增益：',
                    time: timeStr,
                    cardType: 'xyc_tome',
                    cardData: {
                        rules: xycRules,
                        meta: xycMeta,
                        initialBeast,
                        initialHero,
                        initialLevel,
                    },
                };
            } catch (e) {
                console.error('[CopilotService] 轩辕策信息卡数据加载失败', e);
            }
        }

        // 0.9 服务器按名查询（T-06）：36 服名/拼音精确命中 → single_server 卡（带所属战区）
        {
            const serverList = await dataService.getServerList();
            const rawServerList = Array.isArray(serverList) ? serverList : [];
            const flatServers = rawServerList.flatMap((z: any) =>
                (Array.isArray(z.servers) ? z.servers : []).map((sv: any) => ({ ...sv, zhanQu: z.zhanQu }))
            );
            const hitServer = flatServers.find((sv: any) =>
                q === sv.name ||
                q === sv.server ||
                q === String(sv.serverId) ||
                q === `${sv.name}服` ||
                q === `${sv.name}开服` ||
                q === `查${sv.name}` ||
                q === `${sv.zhanQu} ${sv.name}` ||
                q === `${sv.zhanQu}${sv.name}` ||
                (sv.name.includes('(') && (q === sv.name.replace(/\(.*\)/, '') || q === sv.name.replace(/\(.*\)/, '') + '服'))
            );
            if (hitServer) {
                return {
                    id: `msg-${Date.now()}`,
                    sender: 'assistant',
                    text: `【${hitServer.name}】隶属【${hitServer.zhanQu}】，可在下方开服雷达查看实时状态：`,
                    time: timeStr,
                    cardType: 'server',
                    cardData: {
                        subType: 'single_server',
                        title: `${hitServer.zhanQu} · ${hitServer.name}`,
                        serverName: hitServer.name,
                        serverId: hitServer.serverId,
                        serverCode: hitServer.server,
                        zhanQu: hitServer.zhanQu,
                        workspaceParams: {
                            zhanQu: hitServer.zhanQu,
                            serverName: hitServer.name,
                            serverId: hitServer.serverId
                        },
                        route: `/tools/server?zhanQu=${encodeURIComponent(hitServer.zhanQu)}&server=${encodeURIComponent(hitServer.name)}`,
                        btnText: '在右侧打开'
                    }
                };
            }

            // 0.95 战区按名查询：命中 9 大战区之一 → zhanqu 卡（包含该战区下全部服务器）
            const hitZhanQu = rawServerList.find((z: any) => {
                const zqName: string = z.zhanQu || '';
                const zqShort: string = zqName.replace('战区', '');
                return (
                    q === zqName ||
                    q === zqShort ||
                    q === `${zqName}开服` ||
                    q === `${zqShort}开服` ||
                    q === `查${zqName}` ||
                    q === `查${zqShort}` ||
                    q === `${zqName}服务器` ||
                    (zqShort.length >= 2 && q === `${zqShort}战区`)
                );
            });
            if (hitZhanQu) {
                // 只透出卡面需要的字段（server_list.json 现带有 aliases/openAt/isNew 等雷达专用字段）
                const servers = (Array.isArray(hitZhanQu.servers) ? hitZhanQu.servers : []).map((sv: any) => ({
                    name: sv.name,
                    server: sv.server,
                    serverId: sv.serverId,
                }));
                return {
                    id: `msg-${Date.now()}`,
                    sender: 'assistant',
                    text: `【${hitZhanQu.zhanQu}】共包含 ${servers.length} 组服务器，可在下方卡片查看服务器列表与开服状态：`,
                    time: timeStr,
                    cardType: 'server',
                    cardData: {
                        subType: 'zhanqu',
                        title: hitZhanQu.zhanQu,
                        zhanQu: hitZhanQu.zhanQu,
                        servers,
                        workspaceParams: {
                            zhanQu: hitZhanQu.zhanQu
                        },
                        route: `/tools/server?zhanQu=${encodeURIComponent(hitZhanQu.zhanQu)}`,
                        btnText: '在右侧打开'
                    }
                };
            }
        }

        // 1. 开服雷达（全区开服与服务器心跳监测宏观词）
        if (
            q.includes('开服') ||
            q.includes('服务器') ||
            q.includes('测服') ||
            q.includes('选服') ||
            q.includes('开没开') ||
            q.includes('几服') ||
            q.includes('战区') ||
            q.includes('雷达')
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【全区开服雷达监测】。本站实时探测诛仙3官方全部区服毫秒级开服状态，支持开服声音即时提醒。',
                time: timeStr,
                cardType: 'server',
                cardData: {
                    subType: 'radar',
                    title: '全区开服雷达监测',
                    desc: '全部区服实时检测开服状态，支持声音提醒与时延速览',
                    workspaceMode: 'server',
                    workspaceParams: {},
                    route: '/tools/server',
                    btnText: '进入开服雷达'
                }
            };
        }

        // 2. 战力与秒伤计算器
        if (
            q.includes('计算器') ||
            q.includes('战力计算') ||
            q.includes('伤害计算') ||
            q.includes('秒伤计算') ||
            q.includes('战力推演') ||
            q.includes('伤害测算') ||
            q.includes('边际贡献') ||
            q.includes('属性加权') ||
            q === '计算' ||
            q === '算伤害' ||
            q === '战力' ||
            q === '秒伤' ||
            q === '测算'
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【战力计算器】。独创诛仙3真实伤害与秒伤测算引擎，覆盖 T20/团本属性防御减免、无视穿透机制，并提供暴击/爆伤/增伤边际贡献权重分析。',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '战力计算器',
                    desc: '属性录入 · 增益勾选 · T本/团本多技能伤害计算',
                    workspaceMode: 'calc',
                    route: '/calculator',
                    btnText: '打开战力计算器'
                }
            };
        }

        // 3. 副本训练场
        if (
            q.includes('训练场') ||
            q.includes('打桩') ||
            q.includes('木桩') ||
            q.includes('副本训练') ||
            q.includes('战斗模拟') ||
            q.includes('技能循环') ||
            q.includes('副本模拟') ||
            q.includes('竞技场') ||
            q === 'arena'
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【副本训练场】。支持多角色技能循环仿真、自定义副本 BOSS 机制打桩，逐秒记录实战输出与承伤报表。',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '副本训练场',
                    desc: '多角色逐秒实战仿真 · 技能循环排布与伤害统计',
                    workspaceMode: 'arena',
                    route: '/arena',
                    btnText: '进入副本训练场'
                }
            };
        }

        // 3.97 轩辕 / 四象裸词歧义分流（xyc_hub）
        if (q === '轩辕') {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你定位到【轩辕】相关系统与技能，请选择要查询的方向：',
                time: timeStr,
                cardType: 'xyc_hub',
                cardData: {
                    title: '轩辕',
                    options: [
                        { key: 'xyc_wash', label: '轩辕策洗练模拟', query: '轩辕策洗练' },
                        { key: 'xyc_tome', label: '轩辕策全系属性', query: '轩辕策' },
                        { key: 'skill_hdnj', label: '青云技能·黄帝内经', query: '黄帝内经' },
                        { key: 'silin', label: '四灵本元系统', query: '四灵本元' },
                    ],
                },
            };
        }

        // 「青龙 / 白虎 / 朱雀 / 玄武」既是轩辕策四系，也是副本 BOSS / 技能名（玄武经、青龙献爪），硬猜必错。
        // 与 class_hub 同款选择卡：点选后再发可命中的具体词（`X策` / `X boss`），无上下文依赖、无循环。
        const bareBeast = q.trim();
        if (['青龙', '白虎', '朱雀', '玄武'].includes(bareBeast)) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `「${bareBeast}」在站内有多类内容，请选择要看的一类：`,
                time: timeStr,
                cardType: 'xyc_hub',
                cardData: {
                    title: bareBeast,
                    options: [
                        { key: 'xyc_tome', label: `轩辕策·${bareBeast}书`, query: `${bareBeast}策` },
                        { key: 'boss', label: `副本 BOSS·${bareBeast}`, query: `${bareBeast} boss` },
                        { key: 'sixiangqi', label: '四象七 · 副本 BOSS', query: '四象七' },
                    ],
                },
            };
        }

        // 4. 轩辕策属性模拟
        // T-12（R2 裁决）：带职业前缀的「职业+轩辕策」是技能查询（技能数据有 27 个「职业·轩辕策」组），
        // 排除后落技能分支；仅裸「轩辕策」才走本工具卡
        if (
            !q.includes('四象七') &&
            !q.includes('四象7') &&
            !q.includes('七杀') &&
            !PROFESSIONS.some(pr => q.includes(pr.toLowerCase())) &&
            (
                q.includes('轩辕策') ||
                q.includes('四象') ||
                q.includes('青龙书') ||
                q.includes('白虎书') ||
                q.includes('玄武书') ||
                q.includes('朱雀书')
            )
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【轩辕策属性模拟】。填入任意阶数数值，即可反推其 1 阶初始底子、20 阶满级极限属性以及极品毕业度评级。',
                time: timeStr,
                cardType: 'xyc_diag',
                cardData: {
                    title: '轩辕策属性模拟',
                    desc: '支持青龙/白虎/朱雀/玄武 1~20 阶成长推算与毕业度评定',
                    workspaceMode: 'xyc',
                    route: '/tools/xyc',
                    btnText: '进入轩辕策属性'
                }
            };
        }

        // 5a. 天缘属性分类卡（tianyuan_hub）：精准呈现新旧天缘两大分支
        const isTianyuanHubQuery =
            q === '天缘' ||
            q === '天缘属性' ||
            q === '天缘分类' ||
            q === '天缘系统' ||
            q === '天缘选择';

        if (isTianyuanHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现【天缘属性】分类导航。诛仙3天缘分为天命四件套（旧天缘）与上玄佑万辰须弥系列（新天缘），请点选对应卡片查看：',
                time: timeStr,
                cardType: 'tianyuan_hub',
                cardData: {
                    title: '天缘属性分类导航',
                    options: [
                        { key: 'tianyuan_old', label: '旧天缘', query: '旧天缘' },
                        { key: 'tianyuan_new', label: '新天缘', query: '新天缘' },
                    ]
                }
            };
        }

        // 5a2. 新版天缘模拟卡（对话内嵌）：开箱生成 + 精炼天命，不跳转 tools
        // 新天缘整类优先给模拟器（下方可展开信息卡），仅「X级 / 词条池 / 信息卡」这类查询走信息卡
        //（识图卡的「查新天缘词条池」按钮直接发这条 query，不能被模拟器抢走）
        const isNewTianyuanSimQuery =
            !q.includes('旧天缘') &&
            !q.includes('词条池') &&
            !q.includes('词条表') &&
            !q.includes('信息卡') &&
            !/\d{1,2}\s*级/.test(q) &&
            (
                q.includes('须弥') ||
                q.includes('新天缘') ||
                q.includes('上玄') ||
                q.includes('佑万') ||
                (q.includes('天缘') &&
                    (
                        q.includes('模拟') ||
                        q.includes('精炼') ||
                        q.includes('洗') ||
                        q.includes('概率') ||
                        q.includes('几率') ||
                        q.includes('属性') ||
                        q.includes('词条')
                    ))
            );

        if (isNewTianyuanSimQuery) {
            let simGroupName = '上玄佑万辰须弥刃';
            if (q.includes('甲') || q.includes('衣')) simGroupName = '上玄佑万辰须弥甲';
            else if (q.includes('盔') || q.includes('冠') || q.includes('帽') || q.includes('头')) {
                simGroupName = '上玄佑万辰须弥盔';
            }

            const simData = await dataService.getNewTianYuanData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你调出【新天缘精炼】。可直接在对话里开箱抽词条、精炼到 +10，并推演 +3/+6/+9/+10 的天命点分配：',
                time: timeStr,
                cardType: 'tianyuan_sim',
                cardData: {
                    data: simData,
                    initialGroupName: simGroupName
                }
            };
        }

        // 5b. 旧天缘属性全览卡（装备天缘词条池，优先承接所有普通天缘查询，新天缘系列除外）
        const isOldTianyuanQuery =
            !q.includes('新天缘') &&
            !q.includes('须弥') &&
            !q.includes('上玄') &&
            !q.includes('佑万') &&
            (
                q.includes('天缘') ||
                q.includes('旧天缘') ||
                q.includes('天命天缘')
            );

        if (isOldTianyuanQuery) {
            let partId = 'weapon';
            if (q.includes('靴') || q.includes('鞋')) partId = 'shoes';
            else if (q.includes('甲') || q.includes('衣')) partId = 'armor';
            else if (q.includes('盔') || q.includes('帽')) partId = 'helmet';

            let targetLvl = 10;
            const lvlMatch = q.match(/(\d{1,2})\s*级/);
            if (lvlMatch) {
                targetLvl = Math.min(10, Math.max(1, parseInt(lvlMatch[1], 10)));
            }

            const oldTianyuanData = await dataService.getOldTianyuanData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【旧天缘属性全览】。支持天命武器、靴子、衣服、头盔4部位词条池全览与满级(10级)自动推算：`,
                time: timeStr,
                cardType: 'tianyuan_old',
                cardData: {
                    data: oldTianyuanData,
                    initialPartId: partId,
                    initialLevel: targetLvl
                }
            };
        }

        // 5. 新天缘属性信息卡（涵盖 上玄 / 佑万 / 须弥 / 新天缘 等现代天缘体系）
        const isNewTianyuanQuery =
            q.includes('新天缘') ||
            q.includes('须弥天缘') ||
            q.includes('上玄天缘') ||
            q.includes('佑万天缘') ||
            q.includes('须弥刃') ||
            q.includes('须弥甲') ||
            q.includes('须弥盔') ||
            q.includes('须弥冠') ||
            q.includes('上玄佑万辰') ||
            (q.includes('天缘') && (q.includes('上玄') || q.includes('佑万') || q.includes('须弥'))) ||
            ((q.includes('上玄') || q.includes('佑万')) && (q.includes('刃') || q.includes('甲') || q.includes('盔') || q.includes('属性')));

        if (isNewTianyuanQuery) {
            let initialGroupName = '上玄佑万辰须弥刃';
            if (q.includes('甲') || q.includes('衣')) initialGroupName = '上玄佑万辰须弥甲';
            else if (q.includes('盔') || q.includes('冠') || q.includes('帽') || q.includes('履') || q.includes('鞋') || q.includes('靴')) {
                initialGroupName = '上玄佑万辰须弥盔';
            }

            let targetLvl = 10;
            const lvlMatch = q.match(/(\d{1,2})\s*级/);
            if (lvlMatch) {
                targetLvl = Math.min(10, Math.max(0, parseInt(lvlMatch[1], 10)));
            }

            const newTianyuanData = await dataService.getNewTianYuanData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你速查到【新版天缘属性全览】（上玄佑万辰须弥系列）。支持须弥刃、须弥甲、须弥冠3大部位词条池与 0~10 级天命阶跃自动推算：',
                time: timeStr,
                cardType: 'tianyuan_new',
                cardData: {
                    data: newTianyuanData,
                    initialGroupName,
                    initialLevel: targetLvl
                }
            };
        }

        // 6. 凝灵契模拟（显式带“模拟”时走工具卡，普通凝灵契查询走0.56装备信息卡）
        if (
            q.includes('凝灵契模拟') ||
            q.includes('灵契模拟') ||
            q.includes('模拟凝灵')
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【凝灵契模拟】。支持法宝灵契各槽位孔位洗炼概率推演与属性期望成本测算。',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '凝灵契模拟',
                    desc: '凝灵契洗炼模拟，支持多槽位孔位锁定与属性结果展示',
                    workspaceMode: 'ninglingqi',
                    route: '/tools/ninglingqi',
                    btnText: '进入凝灵契模拟'
                }
            };
        }

        // 7. 仙友留言板（意见反馈）
        if (
            q.includes('留言') ||
            q.includes('反馈') ||
            q.includes('建议') ||
            q.includes('捉虫') ||
            q.includes('催更')
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【仙友留言板 · 意见反馈】。欢迎留下你的战术推演心得、数值机制捉虫或新功能催更，与全服仙友共同求索诛仙万象大道！',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '仙友留言板 · 意见反馈',
                    desc: '仙友交流、数值捉虫、新功能催更，共同打造更精准的诛仙数据库',
                    route: '/feedback',
                    btnText: '前往仙友留言板'
                }
            };
        }

        // 8. 更新动态
        if (
            q === '更新' ||
            q.includes('更新动态') ||
            q.includes('更新日志') ||
            q.includes('更新记录') ||
            q.includes('排期') ||
            q.includes('版本更新') ||
            q.includes('changelog') ||
            q.includes('新特性')
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【更新动态】。天书万象大模型与全栈工具持续迭代，可查阅全网最新特性排期与版本演进历程。',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '天书万象 · 更新动态',
                    desc: '查阅全知 AI 大模型、伤害计算引擎与模拟器工具的持续迭代与排期',
                    route: '/changelog',
                    btnText: '查看更新动态'
                }
            };
        }

        // 9. 关于本站
        if (
            q === '关于' ||
            q.includes('关于本站') ||
            q.includes('关于我们') ||
            q.includes('本站') ||
            q.includes('初衷') ||
            q.includes('作者') ||
            q.includes('萝卜') ||
            q.includes('网站介绍') ||
            q === '天书万象'
        ) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你定位【关于本站】。天书万象汇聚真实游戏装备与技能数据、独创伤害计算公式与属性加权边际贡献分析，搭配丰富实用的全栈模拟器，与你共探诛仙万象大道。',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '关于天书万象',
                    desc: '收集大量真实游戏装备技能数据与攻略，独创伤害计算公式与边际贡献分析',
                    route: '/about',
                    btnText: '了解关于本站'
                }
            };
        }

        // ----------------------------------------------------
        // 0. 提取多维度实体槽位（品质、部位、门派/职业、名称词）
        // ----------------------------------------------------
        const tokens = q.split(/[\s,，+＋/、·\-_\(\)（）]+/).filter(Boolean);
        const qualities = ['修武', '昭武', '彰武', '神隐', '神级', '天命', '至尊', '混虚'];
        const slots = [
            '武器', '头盔', '衣服', '靴子', '袖甲', '腰带',
            '项链', '戒指', '法身', '罡气', '护符', '勋章', '玺绶', '锦囊', '佩章'
        ];
        const slotAliases: Record<string, string> = {
            '帽子': '头盔', '头': '头盔', '冠': '头盔', '盔': '头盔', '帽': '头盔',
            '衣服': '衣服', '甲': '衣服', '铠': '衣服', '铠甲': '衣服', '袍': '衣服', '衣': '衣服',
            '鞋': '靴子', '鞋子': '靴子', '靴': '靴子', '履': '靴子',
            '护腕': '袖甲', '手环': '袖甲', '手': '袖甲', '手套': '袖甲', '钏': '袖甲', '腕': '袖甲', '袖': '袖甲', '袖子': '袖甲',
            '带': '腰带', '腰带': '腰带',
            '金身': '法身',
            '印': '玺绶', '玉玺': '玺绶', '玺': '玺绶',
            '戒': '戒指', '指环': '戒指',
            '链': '项链', '项圈': '项链'
        };
        const profs = PROFESSIONS;

        const isYinji = tokens.some(t => t.includes('印记')) || q.includes('印记');
        const matchedQ = qualities.find(qu => tokens.some(t => t.includes(qu.toLowerCase())) || q.includes(qu.toLowerCase()));
        let matchedSlot = slots.find(sl => tokens.some(t => t === sl.toLowerCase() || (t.length >= 2 && t.includes(sl.toLowerCase()))));
        if (!matchedSlot) {
            for (const [alias, realSlot] of Object.entries(slotAliases)) {
                if (alias === '印' && isYinji) continue; // 印记属于神级项链，不作为玺绶
                if (tokens.some(t => t === alias || (alias.length >= 2 && t.includes(alias))) || (alias.length >= 2 && q.includes(alias))) {
                    matchedSlot = realSlot;
                    break;
                }
            }
        }
        // 如果搜【印记】且用户未显式指定其他部位，自动对应神级项链
        if (isYinji && !matchedSlot) {
            matchedSlot = '项链';
        }
        const matchedProf = profs.find(pr => tokens.some(t => t.includes(pr.toLowerCase())) || q.includes(pr.toLowerCase()));

        // ----------------------------------------------------
        // 0.5 裸职业名歧义分流（class_hub，T-15a）
        // 输入精确等于单个职业名时不猜测意图，返回技能/装备/法宝三入口；
        // 点击入口 = 替用户重发「职业+后缀」查询词，走现有链路，无上下文依赖。
        // 位置在副本分支之前：精确匹配优先，免疫 BOSS 名包含碰撞
        //（如「炼血」vs「炼血堂教众」——修 T-11 孤儿键后后者会从 null 变 boss_candidates）。
        // 选项 query 均实测可用（逐霜 30/33/4，天华 30/33/5）。
        // ----------------------------------------------------
        if (profs.includes(q)) {
            const hubOptions = [
                { key: 'skill', label: '技能速查', query: `${q}技能` },
                { key: 'equip', label: '装备查询', query: `${q}装备` },
                { key: 'fabao', label: '专属法宝', query: `${q}法宝` },
                // T-15b：状态→class_status 分支（职业+状态）。攻略为独立大类（T-18），不进 hub
                { key: 'status', label: '职业状态', query: `${q}状态` },
            ];
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你定位到职业【${q}】。请选择要查询的信息类型：`,
                time: timeStr,
                cardType: 'class_hub',
                cardData: {
                    className: q,
                    options: hubOptions
                }
            };
        }

        // ------------------------------------------------------------
        // 0.5b 职业状态摘要（class_status，T-15b）
        // 「XX状态」/「阵营+XX状态」/ 裸词「职业状态」/「各职业状态」等 → 从 skills.json._meta.supportRoles 取该职业档案：
        // 覆盖 4 团队减益（易伤/绿点/紫点/破防）与 7 增益（专注/加爆伤/加攻击/加血/加蓝/加防御/加怪增）
        // ------------------------------------------------------------
        const isGenericStatus =
            q === '状态' ||
            q === '群体专注' ||
            q === '职业状态' ||
            q === '各职业状态' ||
            q === '全职业状态' ||
            q === '门派状态' ||
            q === '职业增益' ||
            q === '团队增益' ||
            q === '门派增益' ||
            q === '职业状态速查';

        let statusClass = '';
        let preferredFaction: string | undefined = undefined;

        if (isGenericStatus) {
            statusClass = '逐霜';
        } else if (q.endsWith('状态') || ((q.includes('状态') || q.includes('增益')) && profs.some(p => q.includes(p)))) {
            // 兼容前缀阵营，如「魔青罗状态」/「佛英招状态」
            for (const f of ['仙', '魔', '佛']) {
                if (q.includes(f)) {
                    preferredFaction = f;
                    break;
                }
            }
            const matchedP = profs.find(p => q.includes(p));
            if (matchedP) {
                statusClass = matchedP;
            } else if (q.endsWith('状态')) {
                let raw = q.slice(0, -2).trim();
                for (const f of ['仙', '魔', '佛']) {
                    if (raw.startsWith(f) && profs.includes(raw.slice(f.length))) {
                        preferredFaction = f;
                        raw = raw.slice(f.length);
                        break;
                    }
                }
                if (profs.includes(raw)) {
                    statusClass = raw;
                }
            }
        }

        if (statusClass && profs.includes(statusClass)) {
            const skillMeta = await dataService.getSkillMetaAsync();
            const supportData = skillMeta?.supportRoles || null;
            const roles = Array.isArray(supportData?.roles) ? supportData.roles : [];
            const classRoles = roles.filter((r: any) => r?.name === statusClass);
            if (classRoles.length > 0) {
                const isDps = classRoles.some((r: any) => r?.roleType === 'dps');
                const factions = [...new Set(classRoles.map((r: any) => r?.faction).filter(Boolean))];
                const metrics: string[] = Array.isArray(supportData?.metrics) ? supportData.metrics : [];
                const allClasses = [...new Set(roles.map((r: any) => r?.name).filter(Boolean))];
                return {
                    id: `msg-${Date.now()}`,
                    sender: 'assistant',
                    text: isGenericStatus
                        ? `为你呈现全职业战斗状态档案（默认展示热门【逐霜】）。可在卡片内自由切换职业，也可直接发送【青云状态】、【天音状态】、【焚香状态】等快速查看：`
                        : (isDps
                            ? `【${statusClass}】是输出职业（${factions.join('/') || '多阵营'}），核心任务是打伤害：`
                            : `【${statusClass}】是辅助职业（${factions.join('/') || '多阵营'}），核心任务是团队增益：`),
                    time: timeStr,
                    cardType: 'class_status',
                    cardData: {
                        className: statusClass,
                        isDps,
                        factions,
                        preferredFaction,
                        metrics,
                        roles: classRoles.map((r: any) => ({
                            faction: r.faction,
                            roleType: r.roleType,
                            rating: r.rating,
                            abilities: Array.isArray(r.abilities) ? r.abilities : [],
                            // 4 减益
                            damageBoost: r.damageBoost,
                            greenPoint: r.greenPoint,
                            purplePoint: r.purplePoint,
                            defenseBreak: r.defenseBreak,
                            // 7 增益
                            focus: r.focus,
                            focusType: r.focusType,
                            critDamage: r.critDamage,
                            atkUp: r.atkUp,
                            healUp: r.healUp,
                            manaUp: r.manaUp,
                            defUp: r.defUp,
                            monsterDmgUp: r.monsterDmgUp,
                        })),
                        allRoles: roles,
                        allClasses,
                    }
                };
            }
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `【${statusClass}】暂无状态档案。可尝试查询其技能速查、装备图鉴或专属法宝：`,
                time: timeStr
            };
        }

        // ------------------------------------------------------------
        // 0.54a 星辰属性及升星增益卡片（星宿系统）
        // 支持「星宿」、「星宿属性」、「星宿升级」、「星宿升星」、「启明星辰」、「荧惑星辰」、「重华星辰」、「重华星宿」、「星辰属性」等
        // 注意：排查职业星宿技能（如「鬼王 星宿」、「青云 星宿」），带职业名的交给后续技能分支
        // ------------------------------------------------------------
        const hasClassPrefixForSkill = PROFESSIONS.some(cn => q.includes(cn) && q.includes('星宿'));
        const isXingsuQuery = !hasClassPrefixForSkill && (
            q === '星宿' ||
            q === '星辰' ||
            q === '星宿属性' ||
            q === '星宿升级' ||
            q === '星宿升星' ||
            q === '星宿增益' ||
            q === '星宿经验' ||
            q.includes('启明') ||
            q.includes('荧惑') ||
            q.includes('重华') ||
            q.includes('玉衡') ||
            q.includes('开阳') ||
            q.includes('瑶光') ||
            q.includes('星辰属性') ||
            q.includes('星宿系统')
        );

        if (isXingsuQuery) {
            let typeId = 'chonghua';
            if (q.includes('启明') || q.includes('玉衡')) typeId = 'qiming';
            else if (q.includes('荧惑') || q.includes('开阳')) typeId = 'yinghuo';

            let targetRank = 5;
            const rankMatch = q.match(/(\d)\s*星/);
            if (rankMatch) {
                targetRank = Math.min(5, Math.max(1, parseInt(rankMatch[1], 10)));
            }

            const xingsuData = await dataService.getXingsuData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【星辰属性及升星增益】。支持启明星辰（玉衡）、荧惑星辰（开阳）、重华星辰（瑶光）属性全览与1~5星升星测算：`,
                time: timeStr,
                cardType: 'xingsu',
                cardData: {
                    data: xingsuData,
                    initialTypeId: typeId,
                    initialRank: targetRank
                }
            };
        }

        // ------------------------------------------------------------
        // 0.54c 宝石属性及升级全景卡片（宝石系统）
        // 支持「宝石」、「宝石属性」、「宝石升级」、「普通宝石」、「完美宝石」、「宝石镶嵌」、「10级宝石」以及12种具体宝石名
        // ------------------------------------------------------------
        const BAOSHI_GEMS = [
            '混沌金刚珠', '三昧紫阳珠', '元运断金珠', '天心断金珠',
            '煌燿金刚珠', '培元断金珠', '醒神碧灵珠', '渡劫碧灵珠',
            '夺魄碧灵珠', '神行紫阳珠', '无极紫阳珠', '避尘金刚珠'
        ];
        const BAOSHI_GEM_MAP: Record<string, string> = {
            '混沌金刚珠': 'hundun_jingang',
            '三昧紫阳珠': 'sanwei_ziyang',
            '元运断金珠': 'yuanyun_duanjin',
            '天心断金珠': 'tianxin_duanjin',
            '煌燿金刚珠': 'huangyao_jingang',
            '培元断金珠': 'peiyuan_duanjin',
            '醒神碧灵珠': 'xingshen_biling',
            '渡劫碧灵珠': 'dujie_biling',
            '夺魄碧灵珠': 'duopo_biling',
            '神行紫阳珠': 'shenxing_ziyang',
            '无极紫阳珠': 'wuji_ziyang',
            '避尘金刚珠': 'bichen_jingang',
        };
        const isBaoshiQuery =
            q === '宝石' ||
            q.includes('宝石属性') ||
            q.includes('宝石升级') ||
            q.includes('普通宝石') ||
            q.includes('完美宝石') ||
            q.includes('宝石镶嵌') ||
            q.includes('宝石全景') ||
            q.includes('宝石') ||
            q.includes('金刚珠') ||
            q.includes('紫阳珠') ||
            q.includes('断金珠') ||
            q.includes('碧灵珠') ||
            BAOSHI_GEMS.some(g => q.includes(g));

        if (isBaoshiQuery) {
            let matchedGemId = 'hundun_jingang';
            for (const [name, id] of Object.entries(BAOSHI_GEM_MAP)) {
                if (q.includes(name)) {
                    matchedGemId = id;
                    break;
                }
            }

            let targetLevel = 6;
            const lvlMatch = q.match(/(\d{1,2})\s*级/);
            if (lvlMatch) {
                targetLevel = Math.min(10, Math.max(1, parseInt(lvlMatch[1], 10)));
            }

            const initialQuality: 'normal' | 'perfect' = q.includes('普通') ? 'normal' : 'perfect';
            const baoshiData = await dataService.getBaoshiData();

            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【宝石属性及升级全景】。支持 12 种宝石自由切换、普通/完美品阶与 1~10 级强化属性速查：`,
                time: timeStr,
                cardType: 'baoshi',
                cardData: {
                    data: baoshiData,
                    initialGemId: matchedGemId,
                    initialLevel: targetLevel,
                    initialQuality
                }
            };
        }

        // ------------------------------------------------------------
        // 0.54d 贺岁时装技能图鉴（十二生肖时装特技）
        // 支持「贺岁时装技能」、「时装技能」、「贺岁时装」、「生肖时装」、「生肖技能」以及十二生肖时装特技名
        // ------------------------------------------------------------
        const FASHION_SKILLS = [
            '福星高照', '玉阙玄天', '龙腾四海', '金蛇狂舞', '天马行空', '三阳开泰',
            '灵猴兆瑞', '金鸡迎春', '白云苍狗', '诸事顺利', '乐不思鼠', '牛转乾坤'
        ];
        const FASHION_SKILL_MAP: Record<string, string> = {
            '福星高照': 'tiger_fuxing',
            '玉阙玄天': 'rabbit_yuque',
            '龙腾四海': 'dragon_longteng',
            '金蛇狂舞': 'snake_jinshe',
            '天马行空': 'horse_tianma',
            '三阳开泰': 'goat_sanyang',
            '灵猴兆瑞': 'monkey_linghou',
            '金鸡迎春': 'rooster_jinji',
            '白云苍狗': 'dog_baiyun',
            '诸事顺利': 'boar_zhushi',
            '乐不思鼠': 'rat_lebu',
            '牛转乾坤': 'ox_niuzhuan'
        };
        const ZODIAC_MAP: Record<string, string> = {
            '虎': 'tiger_fuxing', '兔': 'rabbit_yuque', '龙': 'dragon_longteng', '蛇': 'snake_jinshe',
            '马': 'horse_tianma', '羊': 'goat_sanyang', '猴': 'monkey_linghou', '鸡': 'rooster_jinji',
            '狗': 'dog_baiyun', '猪': 'boar_zhushi', '鼠': 'rat_lebu', '牛': 'ox_niuzhuan'
        };

        const isExplicitClassTianhuaSkill = q.includes('天籁') || (q.includes('天华') && q.includes('金蛇狂舞'));

        const isFashionSkillQuery = !isExplicitClassTianhuaSkill && (
            q === '时装技能' ||
            q === '时装特技' ||
            q === '贺岁时装特技' ||
            q === '贺岁时装技能' ||
            q === '贺岁时装' ||
            q === '贺岁技能' ||
            q === '生肖时装' ||
            q === '生肖技能' ||
            q.includes('时装技能') ||
            q.includes('时装特技') ||
            q.includes('贺岁时装') ||
            q.includes('生肖时装') ||
            q.includes('贺岁礼包') ||
            q.includes('贺岁装') ||
            FASHION_SKILLS.some(s => q === s || q.includes(s)) ||
            Object.keys(ZODIAC_MAP).some(z =>
                q === `${z}年` ||
                q === `${z}年时装` ||
                q.includes(`${z}年时装`) ||
                q.includes(`${z}年贺岁`) ||
                (q.includes(`${z}年`) && (q.includes('装') || q.includes('技能') || q.includes('礼包') || q.includes('特技')))
            )
        );

        if (isFashionSkillQuery) {
            let matchedSkillId = 'snake_jinshe'; // 默认定位金蛇狂舞
            if (q === '时装技能' || q === '时装特技' || q === '贺岁时装技能' || q === '贺岁时装特技' || q === '生肖时装' || q === '贺岁时装') {
                matchedSkillId = 'snake_jinshe';
            } else {
                for (const [name, id] of Object.entries(FASHION_SKILL_MAP)) {
                    if (q.includes(name)) {
                        matchedSkillId = id;
                        break;
                    }
                }
                for (const [zodiac, id] of Object.entries(ZODIAC_MAP)) {
                    if (q.includes(`${zodiac}年`) || q.includes(zodiac)) {
                        matchedSkillId = id;
                        break;
                    }
                }
            }

            const fashionSkillData = await dataService.getFashionSkillData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【贺岁时装技能图鉴】。支持 12 大生肖时装专属特技、参数规格与金蛇狂舞/诸事顺利联动强化测算：`,
                time: timeStr,
                cardType: 'fashion_skill',
                cardData: {
                    data: fashionSkillData,
                    initialSkillId: matchedSkillId
                }
            };
        }

        // ------------------------------------------------------------
        // 0.54b 佩章·九纹琅卡片
        // 支持「九纹琅」、「九纹」、「佩章九纹琅」、「九纹属性」、「九纹琅属性」、「九纹升级」等
        // ------------------------------------------------------------
        const isJiuwenlangQuery =
            q.includes('九纹琅') ||
            q.includes('九纹') ||
            q === '九纹属性' ||
            q === '九纹琅属性' ||
            q === '佩章九纹琅' ||
            q === '九纹琅升级' ||
            q === '九纹等级';

        if (isJiuwenlangQuery) {
            let targetLvl = 40;
            const lvlMatch = q.match(/(\d{1,2})\s*级/);
            if (lvlMatch) {
                targetLvl = Math.min(40, Math.max(1, parseInt(lvlMatch[1], 10)));
            }

            const jiuwenlangData = await dataService.getJiuwenlangData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【佩章·九纹琅】1~40 级属性与升级材料对照。可切换等级查看属性，并横向对比该级各配方所需材料：`,
                time: timeStr,
                cardType: 'jiuwenlang',
                cardData: {
                    data: jiuwenlangData,
                    initialLevel: targetLvl
                }
            };
        }

        // ------------------------------------------------------------
        // 0.55 圣粹佩章装备卡（T-18 体系）
        // 支持「佩章」、「圣粹佩章」、「椒图佩章+15」、「貔貅佩章」等精准命中
        // ------------------------------------------------------------
        const PEIZHANG_TYPE_MAP: Record<string, { id: string; name: string }> = {
            '回风': { id: 'huifeng', name: '回风' },
            '貔貅': { id: 'pixiu', name: '貔貅' },
            '椒图': { id: 'jiaotu', name: '椒图' },
            '角端': { id: 'jiaoduan', name: '角端' },
            '含瑛': { id: 'hanying', name: '含瑛' }
        };

        const isPeizhangQuery =
            q.includes('佩章') ||
            q.includes('圣粹') ||
            Object.keys(PEIZHANG_TYPE_MAP).some(k =>
                q === k ||
                q.startsWith(k + '+') ||
                q.startsWith(k + '＋') ||
                q.startsWith(k + '佩章')
            );

        if (isPeizhangQuery && !q.includes('印')) {
            let matchedTypeId = 'pixiu';
            let matchedTypeName = '貔貅';
            for (const [k, v] of Object.entries(PEIZHANG_TYPE_MAP)) {
                if (q.includes(k)) {
                    matchedTypeId = v.id;
                    matchedTypeName = v.name;
                    break;
                }
            }

            let targetRefLv = 11;
            const refMatch = q.match(/(?:\+|＋|炼器\+?|炼器＋?)(\d{1,2})/);
            if (refMatch) {
                targetRefLv = Math.min(15, Math.max(0, parseInt(refMatch[1], 10)));
            }

            const peizhangData = await dataService.getPeizhangData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到装备【${matchedTypeName}佩章<圣粹>】（炼器＋${targetRefLv}）。支持在卡片内切换五大分类、推演升降级属性与查询阶位隐藏属性概率池：`,
                time: timeStr,
                cardType: 'peizhang',
                cardData: {
                    selectedTypeId: matchedTypeId,
                    refineLevel: targetRefLv,
                    types: peizhangData?.types
                }
            };
        }

        // ------------------------------------------------------------
        // 0.55b 四灵本元装备卡（伏龙鼎镶嵌，属装备大类）
        // 支持「四灵本元」「本元」「伏龙鼎」「饕餮本元」「夔牛本元 五阶」「本元 钧天玄霆」
        // 注意：阶位名（扶摇/风雷/九霄/幽明…）与技能、装备重名，故仅在与「本元/伏龙鼎」同现时才反查定位
        // ------------------------------------------------------------
        const SILIN_SPIRIT_MAP: Record<string, { id: string; name: string }> = {
            '夔牛': { id: 'kuiniu', name: '夔牛' },
            '黄鸟': { id: 'huangniao', name: '黄鸟' },
            '烛龙': { id: 'zhulong', name: '烛龙' },
            '饕餮': { id: 'taotie', name: '饕餮' }
        };
        const SILIN_TIER_CN: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5 };

        const isSilinBenyuanQuery =
            q === '四灵' ||
            q === '四灵系统' ||
            q === '四灵本元' ||
            q === '四灵本源' ||
            q.includes('本元') ||
            q.includes('本源') ||
            q.includes('伏龙鼎');

        if (isSilinBenyuanQuery) {
            const silinData = await dataService.getSilinBenyuanData();

            let matchedSpiritId: string | undefined;
            let matchedSpiritName: string | undefined;
            let matchedTier: number | undefined;

            for (const [k, v] of Object.entries(SILIN_SPIRIT_MAP)) {
                if (q.includes(k)) {
                    matchedSpiritId = v.id;
                    matchedSpiritName = v.name;
                    break;
                }
            }

            const tierMatch = q.match(/([1-5一二三四五])\s*阶/);
            if (tierMatch) {
                matchedTier = SILIN_TIER_CN[tierMatch[1]] ?? parseInt(tierMatch[1], 10);
            }

            // 阶位名反查：输入「钧天玄霆」直接定位 夔牛·五阶
            const allTierNames: Array<{ spiritId: string; spiritName: string; tier: number; name: string }> = [];
            for (const sp of (silinData?.spirits || [])) {
                const tierNames: Record<string, string | null> = sp.tierNames || {};
                for (const [t, name] of Object.entries(tierNames)) {
                    if (name) allTierNames.push({ spiritId: sp.id, spiritName: sp.name, tier: parseInt(t, 10), name: String(name) });
                }
            }
            const hitTierName = allTierNames.find((x) => q.includes(x.name));
            if (hitTierName) {
                matchedSpiritId = hitTierName.spiritId;
                matchedSpiritName = hitTierName.spiritName;
                matchedTier = hitTierName.tier;
            }

            if (matchedTier && (matchedTier < 1 || matchedTier > 5)) matchedTier = undefined;

            const scopeText = matchedSpiritName
                ? `【${matchedSpiritName}本元${matchedTier ? '·' + ['一', '二', '三', '四', '五'][matchedTier - 1] + '阶' : ''}】`
                : '【四灵本元】';

            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到装备${scopeText}（伏龙鼎镶嵌）。支持四灵切换与 1~5 阶切换，逐阶查看可能词条、五阶满值、本阶折算数值与精确概率：`,
                time: timeStr,
                cardType: 'silin_benyuan',
                cardData: {
                    data: silinData,
                    initialSpiritId: matchedSpiritId,
                    initialTier: matchedTier
                }
            };
        }

        // ------------------------------------------------------------
        // 0.56 宸极·凝灵契装备卡（T-18 体系）
        // 支持「凝灵契」、「宸极凝灵契」、「宸极·凝灵契」、「宸极」、「灵契」等精准命中
        // ------------------------------------------------------------
        const isNinglingqiQuery =
            q === '宸极' ||
            q.includes('凝灵契') ||
            q.includes('宸极凝灵契') ||
            q.includes('宸极·凝灵契') ||
            q.includes('灵契') ||
            q.includes('洗契') ||
            q.includes('凝灵石');

        if (isNinglingqiQuery && !q.includes('印')) {
            let targetHole = 12;
            const holeMatch = q.match(/(\d{1,2})\s*孔/);
            if (holeMatch) {
                targetHole = Math.min(12, Math.max(1, parseInt(holeMatch[1], 10)));
            }

            const ninglingqiData = await dataService.getNinglingqiData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到装备【宸极凝灵契】。支持在卡片内查看 12 孔位全量可洗出属性池、数值范围与精确概率分布：`,
                time: timeStr,
                cardType: 'ninglingqi',
                cardData: {
                    data: ninglingqiData,
                    initialHole: targetHole
                }
            };
        }

        // ------------------------------------------------------------
        // 0.57 宠物结誓与誓印卡（T-18 攻略体系）
        // 支持「宠物结誓」、「宠物刻誓」、「结誓」、「刻誓」、「誓印」、「刻蚀」、「刻蚀装备」、
        // 「御宝印」、「通灵印」、「御宝刻蚀」、「通灵刻蚀」、「刻印」、
        // 以及特化宠物「飞天鼠」、「波波」、「鹏鹏」、「丛林山猪」、「昆仑修罗」等
        // ------------------------------------------------------------
        const isPetPledgeQuery =
            q === '宠物' ||
            q === '宠物攻略' ||
            q === '宠物系统' ||
            q === '宠物图鉴' ||
            q.includes('结誓') ||
            q.includes('刻誓') ||
            q.includes('刻蚀') ||
            q.includes('刻印') ||
            q.includes('誓印') ||
            q.includes('御宝印') ||
            q.includes('通灵印') ||
            q.includes('御宝刻蚀') ||
            q.includes('通灵刻蚀') ||
            q === '飞天鼠' || q.includes('飞天鼠') ||
            q === '波波' || q.includes('波波') ||
            q === '鹏鹏' || q.includes('鹏鹏') ||
            q === '丛林山猪' ||
            q === '昆仑修罗';

        if (isPetPledgeQuery) {
            let initialTab: 'preview' | 'table' | 'guide' = 'preview';
            let initialPetId = 'pengpeng';

            if (q.includes('对比') || q.includes('上限') || q.includes('全景') || q.includes('对比图') || q.includes('属性表') || q === '结誓属性' || q === '新版宠物结誓' || q === '誓印属性' || q === '刻誓属性' || q === '刻蚀属性') {
                initialTab = 'table';
            } else if (q.includes('御宝') || q.includes('通灵') || q.includes('印') || q.includes('指南') || q.includes('推荐') || q.includes('刻蚀') || q.includes('刻誓')) {
                initialTab = 'guide';
            }

            if (q.includes('鹏鹏')) {
                initialPetId = 'pengpeng';
            } else if (q.includes('飞天鼠')) {
                initialPetId = 'feitianshu';
            } else if (q.includes('波波')) {
                initialPetId = 'bobo';
            } else if (q.includes('昆仑修罗')) {
                initialPetId = 'special_old';
            } else if (q.includes('丛林山猪')) {
                initialPetId = 'common';
            } else if (q.includes('普通')) {
                initialPetId = 'common';
            }

            const showCompareDefault = q.includes('对比') || q.includes('上限') || q.includes('全景') || q.includes('对比图') || q === '结誓属性' || q === '新版宠物结誓';
            const pledgeData = await dataService.getPetPledgeData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【宠物结誓属性】。支持点选切换 5 大类宠物（普通宠物、昆仑修罗、飞天鼠、波波、鹏鹏）查看结誓属性区间：`,
                time: timeStr,
                cardType: 'pet_pledge',
                cardData: {
                    data: pledgeData,
                    initialPetId,
                    showCompareDefault,
                    initialTab
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58 阵灵聚灵升级消耗卡（T-18 攻略体系）
        // 支持「阵灵升级」、「阵灵聚灵」、「聚灵」、「沧浪冰珠」、「沧热聚灵丹」、「聚灵丹」、
        // 「6金2紫」、「6金2紫12」、「阵灵消耗」、「阵灵升阶」等
        // ------------------------------------------------------------
        // ------------------------------------------------------------
        // 0.58 升级与经验分流卡（exp_hub，T-18）
        // 用户输入「经验」、「升级」、「升级经验」、「经验表」等通用词时，提供分流导航：
        // 1. 法宝经验 (1~40级)  2. 阵灵升级 (1~12阶)
        // ------------------------------------------------------------
        // ------------------------------------------------------------
        // 0.58a 装备全景导航卡（equip_hub）
        // 用户输入「装备」、「装备属性」、「装备图鉴」等通用词，或点击首页「装备属性」药丸时弹出
        // ------------------------------------------------------------
        const isEquipHubQuery =
            q === '装备' ||
            q === '装备属性' ||
            q === '装备图鉴' ||
            q === '装备分类' ||
            q === '装备导航' ||
            q === '查装备';

        if (isEquipHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现【装备全景】导航：主装三系与六部位、其他装备细节（项链 / 戒指 / 锦囊 / 玺绶 / 罡气 / 法身 / 金身 / 佩章 / 勋章 / 护符）、以及四灵本元与宝石等养成系统：',
                time: timeStr,
                cardType: 'equip_hub',
                cardData: {
                    title: '装备全景导航',
                    // 唯一真相在 equipHubOptions.ts：数据里有的部位，这里必须有入口。
                    // 缺一个就会被 scripts/check_equip_hub_coverage.mjs 挡下来。
                    groups: EQUIP_HUB_GROUPS.map(g => ({
                        label: g.label,
                        options: g.options.map(o => ({ key: o.key, label: o.label, query: o.query })),
                    })),
                    options: EQUIP_HUB_OPTIONS.map(o => ({ key: o.key, label: o.label, query: o.query, group: o.group })),
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58b 技能图鉴导航卡（skill_hub）
        // 用户输入「技能」、「技能图鉴」、「技能大全」等通用词，或点击首页「技能图鉴」药丸时弹出
        // ------------------------------------------------------------
        const isSkillHubQuery =
            q === '技能' ||
            q === '技能图鉴' ||
            q === '技能大全' ||
            q === '技能速查' ||
            q === '技能导航' ||
            q === '查技能';

        if (isSkillHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现【技能图鉴】全景导航。可按“逐霜 技能”等检索指定职业，或点选下方技能分类：',
                time: timeStr,
                cardType: 'skill_hub',
                cardData: {
                    title: '技能图鉴导航',
                    options: [
                        { key: 'menpai', label: '门派技能', query: '门派技能' },
                        { key: 'shentong', label: '阵营神通', query: '阵营神通' },
                        { key: 'sandai', label: '三代技能', query: '三代技能' },
                        { key: 'sidai', label: '四代技能', query: '四代技能' },
                        { key: 'xinfa', label: '心法技能', query: '心法技能' },
                        { key: 'shizhuang', label: '时装技能', query: '时装技能' },
                    ]
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58b2 指定门派技能导航卡（[职业] 技能）
        // 用户输入「逐霜 技能」、「逐霜技能」、「青云 技能」等，弹出该门派专属技能分类 Hub
        // ------------------------------------------------------------
        const matchedSkillProf = profs.find(p =>
            q === `${p}技能` ||
            q === `${p} 技能` ||
            q === `查${p}技能` ||
            q === `${p}技能图鉴` ||
            q === `${p} 技能图鉴` ||
            q === `${p}技能大全` ||
            q === `${p} 技能大全` ||
            q === `${p}技能速查` ||
            q === `${p} 技能速查`
        );

        if (matchedSkillProf) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你提供【${matchedSkillProf}】技能分类导航，请选择你想查阅的技能类型：`,
                time: timeStr,
                cardType: 'skill_hub',
                cardData: {
                    title: `${matchedSkillProf}技能分类导航`,
                    prof: matchedSkillProf,
                    options: [
                        { key: 'menpai', label: '门派技能', query: `${matchedSkillProf} 门派技能` },
                        { key: 'shentong', label: '阵营神通', query: `${matchedSkillProf} 阵营神通` },
                        { key: 'sandai', label: '三代技能', query: `${matchedSkillProf} 三代技能` },
                        { key: 'sidai', label: '四代技能', query: `${matchedSkillProf} 四代技能` },
                        { key: 'xinfa', label: '心法技能', query: `${matchedSkillProf} 心法技能` },
                    ]
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58c 升级与经验分流卡（exp_hub，T-18）
        // 用户输入「经验」、「升级」、「升级经验」、「经验表」等通用词时，提供分流导航：
        // 1. 法宝经验 (1~40级)  2. 阵灵升级 (1~12阶)
        // ------------------------------------------------------------
        const isExpHubQuery =
            q === '经验' ||
            q === '升级' ||
            q === '升级经验' ||
            q === '经验表' ||
            q === '升级消耗' ||
            q === '升级表';

        if (isExpHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你提供【养成与升级经验对照】分类导航。请选择您想测算的经验体系：`,
                time: timeStr,
                cardType: 'exp_hub',
                cardData: {
                    title: '升级与经验对照体系',
                    options: [
                        { key: 'fabao_exp', label: '法宝经验', query: '法宝经验' },
                        { key: 'zhenling_exp', label: '阵灵经验', query: '阵灵经验' },
                    ]
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58d 属性测算全景导航卡（measure_hub）
        // 选项简洁凝练（4~5字以内，无emoji）
        // ------------------------------------------------------------
        const isMeasureHubQuery =
            q === '属性测算' ||
            q === '数值测算' ||
            q === '测算' ||
            q === '测算工具' ||
            q === '属性计算';

        if (isMeasureHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现【属性测算】全景导航，支持点选直达各大数值测算工具：',
                time: timeStr,
                cardType: 'measure_hub',
                cardData: {
                    title: '属性测算导航',
                    options: [
                        { key: 'xingsu', label: '星宿升星', query: '星宿升星' },
                        { key: 'baoshi', label: '宝石属性', query: '宝石' },
                        { key: 'tianyuan_old', label: '旧天缘', query: '旧天缘' },
                        { key: 'tianyuan_new', label: '新天缘', query: '新天缘' },
                        { key: 'jiuwenlang', label: '九纹琅', query: '九纹琅' },
                        { key: 'fabao_exp', label: '法宝经验', query: '法宝经验' },
                        { key: 'shenji', label: '神机洗练', query: '神机洗练' },
                        { key: 'zhenling_upgrade', label: '阵灵聚灵', query: '阵灵升级' },
                        { key: 'tianyuan_sim', label: '天缘模拟', query: '天缘模拟' },
                        { key: 'calc', label: '伤害计算', query: '计算实战战力', workspaceMode: 'calc' },
                    ]
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58e 玩法攻略全景指南卡（guide_hub）
        // 严格遵循 T-18 攻略三大域：极致属性域、核心养成域、副本机制域 + 职业状态
        // 选项简洁凝练（4~5字以内，无emoji）
        // ------------------------------------------------------------
        const isGuideHubQuery =
            q === '玩法攻略' ||
            q === '攻略' ||
            q === '玩法' ||
            q === '游戏攻略' ||
            q === '攻略体系';

        if (isGuideHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现【玩法攻略】全景导航，涵盖极致属性上限、核心养成阶梯与副本机制：',
                time: timeStr,
                cardType: 'guide_hub',
                cardData: {
                    title: '玩法攻略导航',
                    options: [
                        { key: 'ignore', label: '极致无视', query: '极致无视' },
                        { key: 'reduction', label: '极致减免', query: '极致减免' },
                        { key: 'crit_red', label: '极致减暴', query: '极致减暴' },
                        { key: 'crit_rate', label: '极致暴击', query: '极致暴击' },
                        { key: 'crit_dmg', label: '极致爆伤', query: '极致爆伤' },
                        { key: 'monster_dmg', label: '极致怪增', query: '怪增' },
                        { key: 'dodge', label: '技能躲闪', query: '躲闪' },
                        { key: 'pet_pledge', label: '宠物刻誓', query: '宠物结誓' },
                        { key: 'fabao_exp', label: '法宝经验', query: '法宝经验' },
                        { key: 'zhenling_upgrade', label: '阵灵经验', query: '阵灵经验' },
                        { key: 'class_status', label: '职业状态', query: '职业状态' },
                        { key: 'boss', label: 'BOSS属性', query: 'BOSS属性' },
                    ]
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58e 全景顶层分类导航卡（top_hub）
        // ------------------------------------------------------------
        const isTopHubQuery =
            q === '导航' ||
            q === '全景导航' ||
            q === '分类' ||
            q === '功能列表' ||
            q === '帮助';

        if (isTopHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现诛仙3全景分类导航，点击下方任意卡片直接查看：',
                time: timeStr,
                cardType: 'top_hub',
                cardData: {
                    title: '全景分类导航',
                    options: TOP_HUB_OPTIONS,
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58f 各类模拟器全景导航卡（sim_hub）
        // 覆盖本站当前所有模拟器：神机洗练、新天缘模拟、轩辕策模拟、凝灵契模拟、战力计算、副本打桩
        // ------------------------------------------------------------
        const isSimHubQuery =
            q === '模拟器' ||
            q === '各类模拟器' ||
            q === '模拟' ||
            q === '模拟工具' ||
            q === '全部模拟器' ||
            q === '微工具' ||
            q === '实用工具';

        if (isSimHubQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '为你呈现【各类模拟器】全景导航。汇集天书万象当前所有实战推演与装备洗炼模拟工具，点击直接进入：',
                time: timeStr,
                cardType: 'sim_hub',
                cardData: {
                    title: '各类模拟器导航',
                    // 只有「战力计算器 / 副本训练场」走右分屏：它们本来就没有对话内嵌卡，
                    // 打开分屏就是唯一入口。其余四个都有信息卡（xyc_wash / shenji_forge /
                    // yunling_forge / tianyuan_sim），**必须按 query 重发**，不能再塞 workspaceMode ——
                    // 否则点「轩辕策洗练」会跳到分屏的"轩辕策属性"页（模式是 xyc，内容对不上），
                    // 点「神隐蕴灵」也会跳过信息卡（2026-10-29 线上反馈）。
                    options: [
                        { key: 'calc', label: '战力计算器', query: '计算器', workspaceMode: 'calc' },
                        { key: 'arena', label: '副本训练场', query: '训练场', workspaceMode: 'arena' },
                        { key: 'xyc_wash', label: '轩辕策洗练', query: '轩辕策洗练' },
                        { key: 'shenji', label: '神机洗练', query: '神机洗练' },
                        { key: 'yunling', label: '神隐蕴灵', query: '神隐蕴灵' },
                        { key: 'tianyuan_sim', label: '新天缘精炼', query: '新天缘精炼' },
                    ]
                }
            };
        }

        // ------------------------------------------------------------
        // 0.58b 阵灵聚灵升级消耗卡（T-18 攻略体系）
        // 覆盖金卡/紫卡 1~12阶沧浪冰珠与沧热聚灵丹消耗及 6金2紫测算
        // ------------------------------------------------------------
        const isZhenlingUpgradeQuery =
            !q.includes('聚灵咒') &&
            (
                q.includes('阵灵升级') ||
                q.includes('阵灵聚灵') ||
                q.includes('阵灵经验') ||
                q === '聚灵' ||
                q === '阵灵' ||
                q === '阵灵攻略' ||
                q === '阵灵升阶' ||
                q.includes('金卡升级') ||
                q.includes('紫卡升级') ||
                q.includes('一张金卡') ||
                q.includes('沧浪冰珠') ||
                q.includes('沧热聚灵丹') ||
                q.includes('聚灵丹') ||
                q.includes('6金2紫') ||
                q.includes('阵灵消耗') ||
                (q.includes('阵灵') && (q.includes('阶') || q.includes('升') || q.includes('冰珠') || q.includes('消耗') || q.includes('经验')))
            );

        if (isZhenlingUpgradeQuery) {
            const zhenlingData = await dataService.getZhenlingUpgradeData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【阵灵聚灵升级消耗对照表】。支持查看金卡与紫卡 1~12 阶沧浪冰珠与沧热聚灵丹消耗及 6金2紫主流顶配全套测算：`,
                time: timeStr,
                cardType: 'zhenling_upgrade',
                cardData: {
                    data: zhenlingData
                }
            };
        }

        // ------------------------------------------------------------
        // 0.59 法宝经验等级对照卡（T-18 攻略体系）
        // 支持「法宝经验」、「法宝升级」、「法宝等级」、「法宝聚气」、「天龙魔血」、「真龙圣血」等
        // ------------------------------------------------------------
        const isFabaoUpgradeQuery =
            q.includes('法宝经验') ||
            q.includes('法宝升级') ||
            q.includes('法宝等级') ||
            q.includes('法宝聚气') ||
            q.includes('天龙魔血') ||
            q.includes('真龙圣血') ||
            q.includes('离阳火精') ||
            q.includes('神木宝卷') ||
            q === '法宝经验表' ||
            q === '法宝升级表' ||
            q === '离阳火精' ||
            (q.includes('法宝') && (q.includes('经验') || q.includes('魔血') || q.includes('圣血') || q.includes('火精') || q.includes('聚气') || q.includes('升到') || q.includes('40级') || q.includes('35级') || q.includes('30级')));

        if (isFabaoUpgradeQuery) {
            const expData = await dataService.getFabaoUpgradeExpData();
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【法宝经验等级对照表】（2023.9.21版）。支持查看 1~40 级各阶段当前级经验、累计经验与天龙魔血/真龙圣血/离阳火精消耗，并支持自定义等级测算：`,
                time: timeStr,
                cardType: 'fabao_upgrade',
                cardData: {
                    data: expData
                }
            };
        }

        // ------------------------------------------------------------
        // 0.59b 神机属性洗练模拟器（shenji_forge）
        // 支持「神机」「神机模拟」「神机洗练」「神机锻造」「神机属性」「修武神机」「昭武神机」「彰武神机」
        // ------------------------------------------------------------
        const isShenjiQuery =
            q === '神机' ||
            q === '神机模拟' ||
            q === '神机洗练' ||
            q === '神机锻造' ||
            q === '神机属性' ||
            q === '修武神机' ||
            q === '昭武神机' ||
            q === '彰武神机' ||
            q.includes('神机模拟') ||
            q.includes('神机洗练') ||
            q.includes('神机锻造') ||
            q.includes('神机属性') ||
            q.includes('修武神机') ||
            q.includes('昭武神机') ||
            q.includes('彰武神机') ||
            (q.includes('神机') && (q.includes('洗') || q.includes('锻') || q.includes('模拟') || q.includes('修武') || q.includes('昭武') || q.includes('彰武')));

        if (isShenjiQuery) {
            let initialQuality: string | undefined;
            if (q.includes('修武')) initialQuality = '修武';
            else if (q.includes('彰武')) initialQuality = '彰武';
            else if (q.includes('昭武')) initialQuality = '昭武';

            const qualityHint = initialQuality ? `（已默认选定【${initialQuality}】）` : '';
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你打开【神机属性洗练模拟器】${qualityHint}。选择品质、部位与蕴灵档位后即可锻造，支持单次锻造与连续锻造：`,
                time: timeStr,
                cardType: 'shenji_forge',
                cardData: {
                    data: {},
                    initialQuality
                }
            };
        }

        // ------------------------------------------------------------
        // ⛔ 已关闭（2026-10-22 用户要求）装备蕴灵 · 数据实验室（右侧分屏）
        // 支持「蕴灵进阶」「蕴灵 进阶」「蕴灵模拟进阶」「装备蕴灵进阶」「蕴灵推演」
        // 保留代码以备恢复：取消下面整段注释，并同步恢复
        //   ① ChatPlusMenu 的「装备蕴灵」分屏项（handleToolClick('yunling')）
        //   ② SplitScreenWorkspace 的 mode === 'yunling' 渲染块
        //   ③ ToolsHubView 的「装备蕴灵」tab 与 routes 的 /tools/yunling
        // ------------------------------------------------------------
        /*
        const isYunlingAdvancedQuery =
            (q.includes('蕴灵') || q.includes('装备蕴灵')) &&
            (q.includes('进阶') || q.includes('推演') || q.includes('实验室') || q.includes('数据') || q.includes('概率表'));

        if (isYunlingAdvancedQuery) {
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: '已为你打开【装备蕴灵 · 数据实验室】。左侧选神隐装备、调幸运值与概率口径，右侧逐手蕴灵并查看期望手数、月德符消耗与蒙特卡洛分布：',
                time: timeStr,
                cardType: 'tool_card',
                cardData: {
                    title: '装备蕴灵 · 数据实验室',
                    desc: '基础概率口径 · 幸运值阶梯 · 月德符三套曲线 · 期望与分布',
                    workspaceMode: 'yunling',
                    route: '/tools/yunling',
                    btnText: '打开蕴灵实验室',
                },
            };
        }
        */

        // ------------------------------------------------------------
        // 0.62 装备蕴灵 · 轻量卡（yunling_forge，仿神机锻造）—— 当前唯一形态
        // 词表：蕴灵 / 装备蕴灵 / 蕴灵模拟 / 炼器模拟 / 装备炼器 / 神隐蕴灵 …
        // 注意：必须在装备查询分支之前；「炼器+N」只命中佩章阶位查询，与此不冲突
        // ------------------------------------------------------------
        const YUNLING_KEYWORDS = ['蕴灵', '装备炼器', '炼器模拟', '装备练器', '练器模拟'];
        const isYunlingLiteQuery =
            q === '蕴灵' ||
            q === '装备蕴灵' ||
            q === '蕴灵模拟' ||
            q === '装备蕴灵模拟' ||
            q === '神隐蕴灵' ||
            q === '蕴灵系统' ||
            q === '炼器' ||
            q === '练器' ||
            q === '炼器系统' ||
            q === '练器系统' ||
            YUNLING_KEYWORDS.some((k) => q.includes(k));

        if (isYunlingLiteQuery) {
            let initialQuality: string | undefined;
            if (q.includes('修武')) initialQuality = '修武';
            else if (q.includes('彰武')) initialQuality = '彰武';
            else if (q.includes('昭武')) initialQuality = '昭武';
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你打开【神隐蕴灵】${initialQuality ? `（已默认选定【${initialQuality}】）` : ''}。选好神隐装备后点【蕴灵】即可，失败装备幸运值 +1，右侧小框逐级记录手数与月德符消耗：`,
                time: timeStr,
                cardType: 'yunling_forge',
                cardData: {
                    data: {},
                    initialQuality,
                },
            };
        }

        // ① 品质系 6 部位（武器/头盔/衣服/靴子/腰带/袖甲，含帽子/鞋子等口语别名）
        //    → 品质三入口。实证：6 部位 q 字段 100% 归属修武/昭武/彰武三系、
        //    无剩余装备（2026-10-16），故不设「其他」冗余选项（用户反馈）；
        // ② 系列系部件（项链/戒指/锦囊/罡气/玺绶）→ 各自系列入口 + 「其他」兜底
        //    **法身不在此列**：它的系列名与部位名同名（都叫「法身」），点选项会再命中
        //    本分支，形成「点进去又回到同一张卡」的死循环（2026-10-30 EP07 实测）。
        //    法身改为直出候选（系列匹配走 findSlotSeries 的精确 label），金身另有独立入口。
        // 「其他」入口的 query 以「所有」开头，装备分支按宽泛词清空关键词全量平铺。
        // ------------------------------------------------------------
        const SLOT_HUB_ALIAS: Record<string, string> = {
            '帽子': '头盔', '帽': '头盔', '盔': '头盔', '冠': '头盔',
            '鞋子': '靴子', '鞋': '靴子', '靴': '靴子', '履': '靴子',
            '袖子': '袖甲', '护腕': '袖甲', '手套': '袖甲', '袖': '袖甲',
        };
        const SERIES_HUB_SLOTS = ['项链', '戒指', '锦囊', '罡气', '玺绶'];
        if (SERIES_HUB_SLOTS.includes(q)) {
            // 系列入口直接取 SLOT_SERIES 条目（含 exclude 型「其他X」——补集语义，
            // query 即自然词不外泄机器词；法身两分类全覆盖无 other 条目自动不出现）
            const options = (SLOT_SERIES[q] || []).map(s => ({
                key: s.key,
                label: s.label,
                // 仅跨部位的「神级首饰」按 aliases 部位收窄（项链→神级项链 / 戒指→神级戒指）；
                // 其余系列 query 用主 label（别名只是附加入口，不作 hub 首选 query）
                query: (s.key === 'shenji' && s.aliases && s.aliases.length > 0) ? s.aliases[0] : s.label
            }));
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你定位到装备部位【${q}】。请选择要查询的系列：`,
                time: timeStr,
                cardType: 'slot_hub',
                cardData: {
                    slot: q,
                    options
                }
            };
        }
        const SLOT_HUB_SLOTS = ['武器', '头盔', '衣服', '靴子', '腰带', '袖甲'];
        const SLOT_HUB_QUALITIES = ['修武', '昭武', '彰武'];
        const hubStdSlot = SLOT_HUB_SLOTS.includes(q) ? q : (SLOT_HUB_ALIAS[q] || null);
        if (hubStdSlot) {
            // 三系全覆盖实证下不设「其他」选项（2026-10-16 用户反馈：全覆盖就不必兜底）
            const hubOptions = SLOT_HUB_QUALITIES.map(qt => ({
                key: qt, label: `${qt}系`, query: `${qt} ${hubStdSlot}`
            }));
            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你定位到装备部位【${hubStdSlot}】。请选择要查询的品质系列：`,
                time: timeStr,
                cardType: 'slot_hub',
                cardData: {
                    slot: hubStdSlot,
                    options: hubOptions
                }
            };
        }

        // 提取用户指令中可能包含的强化/蕴灵目标等级（如 "13"、"+15"、"11阶"）
        let targetRefLevel: number | undefined = undefined;
        const refMatch = q.match(/(?:\+)?(1[0-5]|[0-9])(?:阶|级)?(?:\s|$)/);
        if (refMatch) {
            targetRefLevel = parseInt(refMatch[1], 10);
        }

        // 可蕴灵判定走 equipStatKey 的唯一入口（别在这里再写一份白名单：
        // 曾与 EquipDetailCard 各持一份、列表还不一致，数据一变就会一个说「能 +1」、一个说「能换系」）
        const isYunling = (it: CuratedEquipItem) => isYunlingEquip(it);

        const buildEquipReplyText = (it: CuratedEquipItem, allList?: CuratedEquipItem[]) => {
            const qText = it.q ? `${it.q}品质 · ` : '';
            const slotText = it.slot || '';
            const meta = qText ? `${qText}${slotText}` : slotText;
            const series = allList ? getEquipSeries(it, allList) : null;
            let hint = '装备原生属性卡如下：';
            if (isYunling(it)) {
                hint = '支持在卡片右上角进行【强化 -1 / 强化 +1】推演：';
            } else if (series && series.items.length > 1) {
                hint = `支持在卡片右上角进行【等级 -1 / 等级 +1】推演查看同系共 ${series.items.length} 级属性：`;
            }
            return `为你速查到装备【${it.name}】${meta ? `（${meta}）` : ''}。${hint}`;
        };

        // ----------------------------------------------------
        // 1. 副本与 BOSS 查询意图（挂载 3 大分类、16 大核心副本、97 BOSS 多层级分类词库体系）
        // ----------------------------------------------------
        // R1（T-14 实施）：法宝精确名全局优先——装备分支的"法宝名+秘笈"部分包含
        // （七星剑/四灵幡等 10 对）与副本分支的别名包含（悬夜翎 vs 悬夜）均让位；
        // 带修饰的复合词（"昭武 衣服"）不与法宝名相等，不走此路
        let exactFabaoName: FabaoItem | null = null;
        {
            const fabaoListForExact = await dataService.getFabaoList();
            if (Array.isArray(fabaoListForExact)) {
                exactFabaoName = fabaoListForExact.find(f => f.名称 === q) || null;
            }
        }
        const allDungeons = await dataService.getDungeonsAsync();
        if (Array.isArray(allDungeons) && allDungeons.length > 0 && !exactFabaoName) {
            // A. 检查是否为泛化副本查询词
            const isBroadDungeonWord = [
                '副本', '副本属性', '副本机制', 'boss属性', 'boss机制', '所有副本', '全部副本', '副本列表', '有哪些副本',
                '副本大全', '查副本', '看副本', '刷本', '打本', 'boss', '首领'
            ].includes(q) || q === '副本';

            // B. 检查具体副本配置命中（如 T20、流波困难、天帝3 等，精确到具体单副本）
            const matchedDungeonConf = !isBroadDungeonWord ? DUNGEON_DICTIONARY.find(d =>
                d.aliases.some(al => q === al || q.includes(al))
            ) : undefined;

            // C. 检查多难度系列命中（如 流波惊变、劫起空桑、天帝宝库、镇海断浪、绘梦凌云 等，包含初识/困难或多梯队）
            const matchedSeries = (!isBroadDungeonWord && !matchedDungeonConf) ? DUNGEON_SERIES.find(s =>
                s.keywords.some(kw => q === kw || q.includes(kw))
            ) : undefined;

            // D. 检查一级大类命中（T本、团本、历练与试炼）
            const matchedCategory = (!isBroadDungeonWord && !matchedDungeonConf && !matchedSeries) ? DUNGEON_CATEGORIES.find(cat =>
                cat.keywords.some(kw => q === kw || q.includes(kw))
            ) : undefined;

            // E. 检查 BOSS 命中（支持多难度同名 BOSS 归集，如搜“夔牛”归集 初识·夔牛 与 困难·夔牛）
            const matchedBosses: { d: Dungeon; m: Monster; dConf?: DungeonDictionaryItem }[] = [];
            if (!isBroadDungeonWord && !matchedDungeonConf && !matchedSeries && !matchedCategory) {
                for (const d of allDungeons) {
                    const dConf = DUNGEON_DICTIONARY.find(dc => dc.dungeonId === d.DungeonID);
                    for (const m of d.Monsters || []) {
                        const mName = m.MonsterName.toLowerCase();
                        if (mName === q || (q.length >= 2 && mName.includes(q)) || (mName.length >= 2 && q.includes(mName))) {
                            matchedBosses.push({ d, m, dConf });
                        }
                    }
                }
            }

            // 综合触发副本意图判定：
            const isDungeonIntent = Boolean(
                isBroadDungeonWord ||
                matchedDungeonConf ||
                matchedSeries ||
                matchedCategory ||
                matchedBosses.length > 0 ||
                ((q.includes('副本') || q.includes('boss') || q.includes('首领')) && !q.includes('装备'))
            );

            if (isDungeonIntent) {
                // 1) 仅命中 1 个具体 BOSS
                if (matchedBosses.length === 1) {
                    const { d, m, dConf } = matchedBosses[0];
                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你找到 BOSS【${m.MonsterName}】（出自副本：${d.DungeonName}）的完整实战属性数据：`,
                        time: timeStr,
                        cardType: 'boss',
                        cardData: {
                            name: m.MonsterName,
                            dungeonName: d.DungeonName,
                            dungeonId: d.DungeonID,
                            monsterId: m.MonsterID,
                            categoryLabel: dConf?.categoryLabel,
                            monster: m,
                            dungeon: d,
                            def: m.displayAttributes?.defense ?? m.MonsterAttributeModifiers?.MonsterDefense ?? 0,
                            critRed: m.displayAttributes?.critRateReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction ?? 0,
                            critDmgRed: m.displayAttributes?.critDamageReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction ?? 0,
                            hp: m.displayAttributes?.health ?? m.MonsterAttributeModifiers?.MonsterHealth ?? 0,
                            route: `/compendium/boss?d=${d.DungeonID}&m=${m.MonsterID}`
                        }
                    };
                }

                // 2) 命中多个同名/相似 BOSS（跨难度展示供仙友点选切换）
                if (matchedBosses.length > 1) {
                    const candidates: BossCandidateItem[] = matchedBosses.map(({ d, m, dConf }) => ({
                        id: `${d.DungeonID}_${m.MonsterID}`,
                        monsterId: m.MonsterID,
                        monsterName: `${dConf?.shortLabel || d.DungeonName} · ${m.MonsterName}`,
                        dungeonId: d.DungeonID,
                        dungeonName: d.DungeonName,
                        dungeonShortLabel: dConf?.shortLabel || d.DungeonName,
                        categoryLabel: dConf?.categoryLabel || '',
                        difficulty: d.difficulty,
                        def: m.displayAttributes?.defense ?? m.MonsterAttributeModifiers?.MonsterDefense ?? 0,
                        hp: m.displayAttributes?.health ?? m.MonsterAttributeModifiers?.MonsterHealth ?? 0,
                        critRed: m.displayAttributes?.critRateReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction ?? 0,
                        critDmgRed: m.displayAttributes?.critDamageReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction ?? 0,
                        route: `/compendium/boss?d=${d.DungeonID}&m=${m.MonsterID}`,
                        monster: m,
                        dungeon: d
                    }));

                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你找到 ${candidates.length} 个匹配的 BOSS 条目（分布于不同难度副本），可在下方点选切换查看完整属性矩阵：`,
                        time: timeStr,
                        cardType: 'boss_candidates',
                        cardData: {
                            query: q,
                            candidates
                        }
                    };
                }

                // 3) 命中特定二级副本（如 "T20"、"流波困难"、"天帝3" 等具体单本）
                if (matchedDungeonConf) {
                    const targetDungeon = allDungeons.find(d => d.DungeonID === matchedDungeonConf.dungeonId);
                    if (targetDungeon && targetDungeon.Monsters && targetDungeon.Monsters.length > 0) {
                        const candidates: BossCandidateItem[] = targetDungeon.Monsters.map(m => ({
                            id: `${targetDungeon.DungeonID}_${m.MonsterID}`,
                            monsterId: m.MonsterID,
                            monsterName: m.MonsterName,
                            dungeonId: targetDungeon.DungeonID,
                            dungeonName: targetDungeon.DungeonName,
                            dungeonShortLabel: matchedDungeonConf.shortLabel,
                            categoryLabel: matchedDungeonConf.categoryLabel,
                            difficulty: targetDungeon.difficulty,
                            def: m.displayAttributes?.defense ?? m.MonsterAttributeModifiers?.MonsterDefense ?? 0,
                            hp: m.displayAttributes?.health ?? m.MonsterAttributeModifiers?.MonsterHealth ?? 0,
                            critRed: m.displayAttributes?.critRateReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction ?? 0,
                            critDmgRed: m.displayAttributes?.critDamageReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction ?? 0,
                            route: `/compendium/boss?d=${targetDungeon.DungeonID}&m=${m.MonsterID}`,
                            monster: m,
                            dungeon: targetDungeon
                        }));

                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `为你速查到【${matchedDungeonConf.fullName}】下的全部 ${candidates.length} 个 BOSS 属性数据，可在下方点选切换查看完整实战属性矩阵：`,
                            time: timeStr,
                            cardType: 'boss_candidates',
                            cardData: {
                                query: q,
                                dungeonName: matchedDungeonConf.fullName,
                                candidates
                            }
                        };
                    }
                }

                // 4) 命中多难度系列（如 "流波惊变"、"劫起空桑"、"天帝宝库"、"镇海断浪" 等）
                if (matchedSeries) {
                    const seriesDungeons = allDungeons.filter(d => matchedSeries.dungeonIds.includes(d.DungeonID));
                    const candidates: BossCandidateItem[] = [];
                    for (const d of seriesDungeons) {
                        const dConf = DUNGEON_DICTIONARY.find(dc => dc.dungeonId === d.DungeonID);
                        for (const m of d.Monsters || []) {
                            candidates.push({
                                id: `${d.DungeonID}_${m.MonsterID}`,
                                monsterId: m.MonsterID,
                                monsterName: `${dConf?.shortLabel || d.DungeonName} · ${m.MonsterName}`,
                                dungeonId: d.DungeonID,
                                dungeonName: d.DungeonName,
                                dungeonShortLabel: dConf?.shortLabel || d.DungeonName,
                                categoryLabel: dConf?.categoryLabel || '',
                                difficulty: d.difficulty,
                                def: m.displayAttributes?.defense ?? m.MonsterAttributeModifiers?.MonsterDefense ?? 0,
                                hp: m.displayAttributes?.health ?? m.MonsterAttributeModifiers?.MonsterHealth ?? 0,
                                critRed: m.displayAttributes?.critRateReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction ?? 0,
                                critDmgRed: m.displayAttributes?.critDamageReduction ?? m.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction ?? 0,
                                route: `/compendium/boss?d=${d.DungeonID}&m=${m.MonsterID}`,
                                monster: m,
                                dungeon: d
                            });
                        }
                    }

                    if (candidates.length > 0) {
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `为你速查到【${matchedSeries.seriesName}】系列。${matchedSeries.hintText}`,
                            time: timeStr,
                            cardType: 'boss_candidates',
                            cardData: {
                                query: q,
                                seriesName: matchedSeries.seriesName,
                                candidates
                            }
                        };
                    }
                }

                // 5) 命中一级大类（如 "T本"、"团本"、"历练"）
                if (matchedCategory) {
                    const matchedDungeons = allDungeons.filter(d => matchedCategory.dungeonIds.includes(d.DungeonID));
                    const candidates: BossCandidateItem[] = [];
                    for (const d of matchedDungeons) {
                        const dConf = DUNGEON_DICTIONARY.find(dc => dc.dungeonId === d.DungeonID);
                        const bossList = d.Monsters?.filter(m => m.role === 'boss') || [];
                        const repBoss = bossList.length > 0 ? bossList[bossList.length - 1] : d.Monsters?.[d.Monsters.length - 1];
                        if (repBoss) {
                            candidates.push({
                                id: `${d.DungeonID}_${repBoss.MonsterID}`,
                                monsterId: repBoss.MonsterID,
                                monsterName: `${dConf?.shortLabel || d.DungeonName} · ${repBoss.MonsterName}`,
                                dungeonId: d.DungeonID,
                                dungeonName: d.DungeonName,
                                dungeonShortLabel: dConf?.shortLabel || '副本',
                                categoryLabel: matchedCategory.label,
                                difficulty: d.difficulty,
                                def: repBoss.displayAttributes?.defense ?? repBoss.MonsterAttributeModifiers?.MonsterDefense ?? 0,
                                hp: repBoss.displayAttributes?.health ?? repBoss.MonsterAttributeModifiers?.MonsterHealth ?? 0,
                                critRed: repBoss.displayAttributes?.critRateReduction ?? repBoss.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction ?? 0,
                                critDmgRed: repBoss.displayAttributes?.critDamageReduction ?? repBoss.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction ?? 0,
                                route: `/compendium/boss?d=${d.DungeonID}&m=${repBoss.MonsterID}`,
                                monster: repBoss,
                                dungeon: d
                            });
                        }
                    }

                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你速查到【${matchedCategory.label}】分类下的核心副本 BOSS。支持点选切换查看各 BOSS 完整战斗属性，亦可输入具体副本或难度（如“流波困难”、“天帝3”、“T20”）精准定位：`,
                        time: timeStr,
                        cardType: 'boss_candidates',
                        cardData: {
                            query: q,
                            categoryLabel: matchedCategory.label,
                            candidates
                        }
                    };
                }

                // 6) 泛意图【副本】/【全部副本】/【副本列表】（用户输入“副本”）
                // 按 DUNGEON_DICTIONARY 顺序展示全网 16 大核心副本的关底代表 BOSS
                const candidates: BossCandidateItem[] = [];
                for (const dConf of DUNGEON_DICTIONARY) {
                    const d = allDungeons.find(item => item.DungeonID === dConf.dungeonId);
                    if (!d) continue;
                    const bossList = d.Monsters?.filter(m => m.role === 'boss') || [];
                    const repBoss = bossList.length > 0 ? bossList[bossList.length - 1] : d.Monsters?.[d.Monsters.length - 1];
                    if (repBoss) {
                        candidates.push({
                            id: `${d.DungeonID}_${repBoss.MonsterID}`,
                            monsterId: repBoss.MonsterID,
                            monsterName: `${dConf.shortLabel} · ${repBoss.MonsterName}`,
                            dungeonId: d.DungeonID,
                            dungeonName: d.DungeonName,
                            dungeonShortLabel: dConf.shortLabel,
                            categoryLabel: dConf.categoryLabel,
                            difficulty: d.difficulty,
                            def: repBoss.displayAttributes?.defense ?? repBoss.MonsterAttributeModifiers?.MonsterDefense ?? 0,
                            hp: repBoss.displayAttributes?.health ?? repBoss.MonsterAttributeModifiers?.MonsterHealth ?? 0,
                            critRed: repBoss.displayAttributes?.critRateReduction ?? repBoss.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction ?? 0,
                            critDmgRed: repBoss.displayAttributes?.critDamageReduction ?? repBoss.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction ?? 0,
                            route: `/compendium/boss?d=${d.DungeonID}&m=${repBoss.MonsterID}`,
                            monster: repBoss,
                            dungeon: d
                        });
                    }
                }

                const dungeonTotal = allDungeons.length;
                const bossTotal = allDungeons.reduce(
                    (sum, d) => sum + (d.Monsters || []).filter(m => m.role === 'boss').length, 0);

                return {
                    id: `msg-${Date.now()}`,
                    sender: 'assistant',
                    text: `为你速查到诛仙核心副本群（涵盖 T本、团本与试炼共 ${dungeonTotal} 大副本体系与 ${bossTotal} 个 BOSS 实战属性数据）。

【分类与难度精准检索引导】：
• 一级大类速查：输入【T本】、【团本】、【副本】
• 多难度系列：输入【流波惊变】、【劫起空桑】、【天帝宝库】
• 梯队与试炼：输入【T20】、【T21】、【兽神困难】、【四象七】、【悬夜林】
• 核心 BOSS 快捷直达：输入【夔牛】、【饕餮】、【玄晔】、【黄鸟】等

下方已为你精选各核心副本代表BOSS，可点选切换查看完整属性：`,
                    time: timeStr,
                    cardType: 'boss_candidates',
                    cardData: {
                        query: q,
                        candidates
                    }
                };
            }
        }

        // 2. 装备查询意图（多槽位复合搜索，优先级高于泛化文本）
        // R1（T-14）：法宝精确名优先，本分支让位（"法宝名+秘笈"式部分包含不再劫持）
        if (!exactFabaoName) try {
            const rawEquips = await dataService.getEquipList();
            if (Array.isArray(rawEquips) && rawEquips.length > 0) {
                // 仅保留通用/生肖护符，完全屏蔽各门派专属技能护符，并屏蔽测试/活动/副本临时装备（如“2023守卫青云困难副本内使用”）
                const equips = rawEquips.filter(e => {
                    if (e.slot === '护符') {
                        if (e.prof && e.prof.length > 0 && !e.prof.includes('通用')) return false;
                    }
                    const n = (e.name || '').toLowerCase();
                    if (n.includes('守卫青云') || n.includes('副本内使用') || n.includes('测试') || n.includes('作废') || n.includes('废弃') || n.startsWith('天帝宝库_')) {
                        return false;
                    }
                    // 用户 2026-10-16 口径：书籍类饰品与天机指环系列屏蔽
                    if (n.includes('梦入神机') || n.includes('自出洞来无敌手') || n.includes('天机指环')) {
                        return false;
                    }
                    // 用户 2026-10-17 口径：ad 属性含颜色代码 11ff11 的装备全部屏蔽（实证 11 件，
                    // 均为跨服战场/节日活动/礼包类——神佑之封印宝钻/人皇之戒/无畏指环/命运/
                    // 福禄双全/上元金鉴/荣耀宝链/传国玉玺/牛年大牛/兔年吉祥/社稷杯金球）
                    if (JSON.stringify(e).includes('11ff11')) {
                        return false;
                    }
                    // 用户 2026-10-17 口径：跨服战场/节日纪念/礼包/宋金战场类活动装备不展示
                    // （B 类已做 ad 清洗，此处按名单屏蔽；兔年吉祥因有有效属性经用户确认保留）
                    const HIDDEN_EVENT_EQUIPS = ['神佑之封印宝钻', '人皇之戒', '无畏指环', '命运', '福禄双全', '上元金鉴', '荣耀宝链', '传国玉玺', '牛年大牛', '社稷杯金球'];
                    if (HIDDEN_EVENT_EQUIPS.includes(e.name || '')) {
                        return false;
                    }
                    // 用户 2026-10-17 口径：群英起头项链全屏蔽（20 件，群英龙胆坠等早期活动装）
                    if (e.slot === '项链' && n.startsWith('群英')) {
                        return false;
                    }
                    // 用户 2026-10-17 口径：三清符引系列与活动食物项链屏蔽（项链）
                    if (n.startsWith('三清符引') || n.includes('吃不完的馒头')) {
                        return false;
                    }
                    // 用户 2026-10-16 口径：星语项链全部屏蔽（原 11 件全为 lv=1 废弃数据）
                    if (n.includes('星语')) {
                        return false;
                    }
                    // 用户 2026-10-16 口径：佩章整类屏蔽（不需要分类）
                    if (e.slot === '佩章') {
                        return false;
                    }
                    // 用户 2026-10-16 口径：锦囊屏蔽竞技场/神恩相关（仅限锦囊，其他部位不动）
                    if (e.slot === '锦囊' && (n.includes('竞技场') || n.includes('神恩'))) {
                        return false;
                    }
                    // 用户 2026-10-16 口径：玺绶屏蔽八皇御宝系列与 2024 搁置玺绶
                    if (e.slot === '玺绶' && (n.startsWith('八皇御宝') || n.includes('2024玺绶'))) {
                        return false;
                    }
                    // 用户 2026-10-16 口径：戒指 1 级为废弃数据（59 件；仅限戒指，其他部位不动）
                    if (e.lv === 1 && e.slot === '戒指') {
                        return false;
                    }
                    return true;
                });

                // 智能提取自由关键词：剥离品质、部位标准名、部位俗称别名（帽子/鞋/衣服/甲等）、职业、强化数值与常见助词
                const sortedAliases = Object.keys(slotAliases).sort((a, b) => b.length - a.length);
                const cleanTokens: string[] = [];
                for (const tok of tokens) {
                    let remainder = tok.toLowerCase();
                    // 过滤纯强化数字
                    if (/^\+?\d+$/.test(remainder) || remainder === String(targetRefLevel) || remainder === `+${targetRefLevel}`) {
                        continue;
                    }
                    for (const qu of qualities) remainder = remainder.replace(qu.toLowerCase(), ' ');
                    for (const sl of slots) remainder = remainder.replace(sl.toLowerCase(), ' ');
                    for (const al of sortedAliases) remainder = remainder.replace(al.toLowerCase(), ' ');
                    for (const pr of profs) remainder = remainder.replace(pr.toLowerCase(), ' ');
                    const parts = remainder.split(/\s+/).map(s => s.trim()).filter(s =>
                        s.length >= 2 &&
                        !['装备', '品质', '部位', '的', '属性', '怎么样', '如何', '展示', '技能', '神通', '天书', '副本', 'boss', '首领', '怪', '怪物'].includes(s)
                    );
                    cleanTokens.push(...parts);
                }

                // T-16 系列检索词展开（「社稷项链」「跨服印」「战罡」等系列 query）：
                // 在 matchedEquips 过滤中作为 OR 组（不能进 cleanTokens——那是 AND
                // 语义，多 term 会互斥导致零候选）。findSlotSeries 按 matchedSlot 优先、
                // 再无 slot 时查 _all 跨部位（裸「神级首饰」混显项链+戒指）。
                const matchedSeries = findSlotSeries(matchedSlot, q);

                // 宽泛检索词（「所有项链」「所有戒指」）：hub「其他」入口专用——
                // 清空自由关键词，按 matchedSlot 全量平铺（「所有」本身不是装备名词）
                if (/^(所有|全部)/.test(q) && matchedSlot) {
                    cleanTokens.length = 0;
                }

                const SKILL_CATEGORY_WORDS = [
                    '技能', '技能描述', '技能机制', '神通', '天书',
                    '心法', '造化', '星宿', '轩辕策', '玄烛', '赤乌', '飞升'
                ];
                const isExplicitSkillTerm = (SKILL_CATEGORY_WORDS.some(w => q.includes(w)) && !q.includes('装备')) ||
                    (q.includes('技能') && !matchedSlot && !matchedQ && !q.includes('装备'));

                const ZODIAC_HUFU_MAP: Record<string, string> = {
                    '鼠年护符': '庚子护符', '牛年护符': '辛丑护符', '虎年护符': '壬寅护符',
                    '兔年护符': '癸卯护符', '龙年护符': '甲辰护符', '蛇年护符': '乙巳护符',
                    '马年护符': '丙午护符', '羊年护符': '乙未护符', '猴年护符': '丙申护符',
                    '鸡年护符': '丁酉护符', '狗年护符': '戊戌护符', '猪年护符': '己亥护符',
                    '生肖护符': '丙午护符'
                };

                // 印记/玺绶别名与常见错别字容错映射（如“十方度厄”->“十方渡厄”、“澄水避寒”->“澄水辟寒”）
                const YIN_TYPO_MAP: Record<string, string> = {
                    '十方度厄': '十方渡厄',
                    '度厄': '渡厄',
                    '澄水避寒': '澄水辟寒',
                    '避寒': '辟寒',
                    '乾元晴雷': '乾元擎雷',
                    '乾元青雷': '乾元擎雷',
                    '晴雷': '擎雷',
                    '青雷': '擎雷',
                    '无极封耀': '无极封曜',
                    '封耀': '封曜',
                    '凝霜揽晖': '凝霜揽辉',
                    '揽晖': '揽辉',
                    '玄离归墟': '玄螭归墟',
                    '玄赤归墟': '玄螭归墟',
                    '玄离': '玄螭',
                    '玄赤': '玄螭',
                };

                const mapEquipTypo = (str: string): string => {
                    let res = str;
                    for (const [typo, correct] of Object.entries(YIN_TYPO_MAP)) {
                        if (res.includes(typo)) {
                            res = res.replaceAll(typo, correct);
                        }
                    }
                    return res;
                };

                const HESUI_TIER_CN_MAP: Record<string, string> = {
                    '1': '壹', '2': '贰', '3': '叁', '4': '肆', '5': '伍',
                    '6': '陆', '7': '柒', '8': '捌', '9': '玖', '10': '拾',
                    '11': '壹拾壹', '12': '壹拾贰', '13': '壹拾叁', '14': '壹拾肆', '15': '壹拾伍',
                    '16': '壹拾陆', '17': '壹拾柒', '18': '壹拾捌', '19': '壹拾玖',
                    '一': '壹', '二': '贰', '两': '贰', '三': '叁', '四': '肆', '五': '伍',
                    '六': '陆', '七': '柒', '八': '捌', '九': '玖', '十': '拾',
                    '十一': '壹拾壹', '十二': '壹拾贰', '十三': '壹拾叁', '十四': '壹拾肆', '十五': '壹拾伍',
                    '十六': '壹拾陆', '十七': '壹拾柒', '十八': '壹拾捌', '十九': '壹拾玖',
                    '一十一': '壹拾壹', '一十二': '壹拾贰', '一十三': '壹拾叁', '一十四': '壹拾肆', '一十五': '壹拾伍',
                    '一十六': '壹拾陆', '一十七': '壹拾柒', '一十八': '壹拾捌', '一十九': '壹拾玖',
                    '壹': '壹', '贰': '贰', '叁': '叁', '肆': '肆', '伍': '伍',
                    '陆': '陆', '柒': '柒', '捌': '捌', '玖': '玖', '拾': '拾',
                    '壹拾壹': '壹拾壹', '壹拾贰': '壹拾贰', '壹拾叁': '壹拾叁', '壹拾肆': '壹拾肆', '壹拾伍': '壹拾伍',
                    '壹拾陆': '壹拾陆', '壹拾柒': '壹拾柒', '壹拾捌': '壹拾捌', '壹拾玖': '壹拾玖',
                };

                const resolveHesuiJinyinAlias = (input: string): string | null => {
                    const raw = input.trim().replace(/\s+/g, '');
                    const prefixMatch = raw.match(/^(\d{1,2}|[一二两三四五六七八九十壹贰叁肆伍陆柒捌玖拾]{1,4})周年(?:印|金印)$/);
                    if (prefixMatch) {
                        const tier = HESUI_TIER_CN_MAP[prefixMatch[1]];
                        if (tier) return `贺岁金印（${tier}）`;
                    }
                    const suffixMatch = raw.match(/^(?:贺岁金印|贺岁印|周年印|周年金印)[（(]?(\d{1,2}|[一二两三四五六七八九十壹贰叁肆伍陆柒捌玖拾]{1,4})(?:阶|级)?[）)]?$/);
                    if (suffixMatch) {
                        const tier = HESUI_TIER_CN_MAP[suffixMatch[1]];
                        if (tier) return `贺岁金印（${tier}）`;
                    }
                    return null;
                };

                const hesuiCanonical = resolveHesuiJinyinAlias(q);
                const normalizedQ = hesuiCanonical || mapEquipTypo(q);

                const hasEquipNameMatch = !isExplicitSkillTerm && equips.some(e => {
                    const eName = e.name.toLowerCase();
                    if (eName.includes(q) || eName.includes(normalizedQ)) return true;
                    if (q.includes('天奕') && eName.includes('天弈')) return true;
                    if (q.includes('天循') && eName.includes('天遁')) return true;
                    if (q.includes('天戌') && eName.includes('天戍')) return true;
                    for (const [zAlias, realName] of Object.entries(ZODIAC_HUFU_MAP)) {
                        if (q.includes(zAlias) && eName.includes(realName)) return true;
                    }
                    return cleanTokens.some(ct => {
                        if (ct.length < 2) return false;
                        const nct = mapEquipTypo(ct);
                        if (eName.includes(ct) || eName.includes(nct)) return true;
                        if (ct === '天奕' && eName.includes('天弈')) return true;
                        if (ct === '天循' && eName.includes('天遁')) return true;
                        if (ct === '天戌' && eName.includes('天戍')) return true;
                        for (const [zAlias, realName] of Object.entries(ZODIAC_HUFU_MAP)) {
                            if (ct.includes(zAlias) && eName.includes(realName)) return true;
                        }
                        return false;
                    });
                });

                const isEquipIntent = Boolean(
                    !isExplicitSkillTerm &&
                    (matchedQ ||
                        matchedSlot ||
                        matchedSeries ||
                        hasEquipNameMatch ||
                        Boolean(hesuiCanonical) ||
                        q.includes('装备'))
                );

                if (isEquipIntent) {
                    // 若用户仅输入了单一单字部位（如单独输入“甲”、“衣”、“鞋”、“头”、“带”等），且未提供品质、门派或特定名称：
                    // 单字范围过大且歧义较高，不盲目全量输出上百件装备，而是进行精准组合引导
                    if (q.length === 1 && matchedSlot && !matchedQ && !matchedProf && cleanTokens.length === 0) {
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `天书万象 AI 识别到您正在查询【${matchedSlot}】部位。由于单字检索范围过大，建议搭配品质或门派组合检索，例如：【昭武 ${q}】、【彰武 ${matchedSlot}】、【逐霜 ${matchedSlot}】。`,
                            time: timeStr
                        };
                    }

                    // 1) 优先精确定位名称（忽略末尾性别括号）
                    // 若检索词仅为单一品质大阶（如 "昭武"、"修武"、"彰武"、"神隐"、"混虚"）或技能类别名，绝不能当作单件装备名称精确直出
                    const isQualityOnlyQuery = qualities.some(qu => qu.toLowerCase() === q);
                    const isSkillCategoryQuery = SKILL_CATEGORY_WORDS.some(w => w === q);
                    const exactEquip = (isQualityOnlyQuery || isSkillCategoryQuery) ? undefined : equips.find(e => {
                        const raw = e.name.toLowerCase();
                        const base = raw.replace(/[（(][男女][）)]/g, '').trim();
                        return raw === q || base === q || raw === normalizedQ || base === normalizedQ;
                    });
                    if (exactEquip) {
                        // 如果命中该系列的基础装备且用户未指定具体星级/阶位，默认展示最高阶（如 ★★★），并支持卡片内降阶
                        let targetEquip = exactEquip;
                        const series = getEquipSeries(exactEquip, equips);
                        if (series && series.items.length > 1) {
                            const isBaseItem = exactEquip.id === series.items[0].id && exactEquip.name === series.items[0].name;
                            const hasSpecificTier = q.includes('★') || q.includes('星') || q.includes('初') || q.includes('阶')
                                || /[（(][^）)]+[）)]/.test(q)
                                || Boolean(hesuiCanonical)
                                || /[0-9一二两三四五六七八九十壹贰叁肆伍陆柒捌玖拾]/.test(q);
                            if (isBaseItem && !hasSpecificTier) {
                                targetEquip = series.items[series.items.length - 1];
                            }
                        }
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: buildEquipReplyText(targetEquip, equips),
                            time: timeStr,
                            cardType: 'equip',
                            cardData: {
                                equip: targetEquip,
                                initialRefLevel: targetRefLevel,
                                allEquips: equips
                            }
                        };
                    }

                    // 2) 多槽位组合过滤（品质 / 部位 / 职业 / 关键词）
                    const matchedEquips = equips.filter(e => {
                        const eName = e.name.toLowerCase();
                        const eQ = (e.q || '').toLowerCase();
                        const eSlot = (e.slot || '').toLowerCase();
                        const eProfs = (e.prof || []).map(p => p.toLowerCase());

                        // 品质匹配（系列 query 跳过：系列名如「神级首饰」含品质词「神级」，属误提取）
                        if (matchedQ && !matchedSeries && !eQ.includes(matchedQ.toLowerCase()) && !eName.includes(matchedQ.toLowerCase())) {
                            return false;
                        }
                        // 部位匹配
                        if (matchedSlot && eSlot !== matchedSlot.toLowerCase()) {
                            return false;
                        }
                        // 职业匹配
                        if (matchedProf && !eProfs.some(p => p.includes(matchedProf.toLowerCase())) && !eName.includes(matchedProf.toLowerCase())) {
                            return false;
                        }
                        // 系列匹配（T-16）：按 match 模式（prefix/contains/suffix）命中任一
                        // term 即保留；exclude=补集（不属于该 slot 任何其他系列的剩余装备，
                        // 即 hub「其他X」的真正语义——2026-10-17 用户纠正：其他≠全部）；
                        // 系列 query 跳过普通关键词 AND
                        if (matchedSeries) {
                            if (matchedSeries.match === 'exclude') {
                                const siblingSeries = (SLOT_SERIES[matchedSlot || ''] || [])
                                    .filter(s => s.key !== 'other' && s.match !== 'exclude');
                                const isCovered = siblingSeries.some(s =>
                                    s.terms.some(t => eName.includes(t.toLowerCase()))
                                );
                                return !isCovered;
                            }
                            return matchedSeries.terms.some(t => {
                                const tl = t.toLowerCase();
                                if (matchedSeries.match === 'prefix') return eName.startsWith(tl);
                                if (matchedSeries.match === 'suffix') return eName.endsWith(tl);
                                return eName.includes(tl);
                            });
                        }
                        // 其余自由关键词匹配（如 "大乘战罡"、"逍遥"、"惊涛"、"天弈"、"天循"、"十方度厄"）
                        for (const ct of cleanTokens) {
                            const nct = mapEquipTypo(ct);
                            const term = nct === '天奕' ? '天弈' : (nct === '天循' ? '天遁' : (nct === '天戌' ? '天戍' : nct));
                            const altTerm = nct === '天弈' ? '天奕' : (nct === '天遁' ? '天循' : (nct === '天戍' ? '天戌' : ''));
                            const matches = eName.includes(term) || (altTerm ? eName.includes(altTerm) : false) || eName.includes(ct);
                            if (!matches) return false;
                        }
                        return true;
                    });

                    // 针对匹配结果进行高阶与星级优先排序（三星 > 二星 > 一星 > 满计/高阶 > 等级）
                    matchedEquips.sort((a, b) => {
                        const starA = (a.name.match(/\u2605/g) || []).length;
                        const starB = (b.name.match(/\u2605/g) || []).length;
                        if (starB !== starA) return starB - starA;

                        const highA = a.name.includes('万计') || a.name.includes('自在') || a.name.includes('若水') || a.name.includes('混虚') || a.name.includes('无量');
                        const highB = b.name.includes('万计') || b.name.includes('自在') || b.name.includes('若水') || b.name.includes('混虚') || b.name.includes('无量');
                        if (highA !== highB) return highA ? -1 : 1;

                        // 若用户未指定特定门派，按主流门派优先级排布候选
                        if (!matchedProf) {
                            const getProfIdx = (item: CuratedEquipItem) => {
                                if (!item.prof || item.prof.length === 0) return 999;
                                const first = item.prof[0];
                                const idx = profs.findIndex(p => first.includes(p));
                                return idx >= 0 ? idx : 999;
                            };
                            const pA = getProfIdx(a);
                            const pB = getProfIdx(b);
                            if (pA !== pB) return pA - pB;
                        }

                        return (b.lv || 0) - (a.lv || 0);
                    });

                    // 将同系列的中间阶位聚合去重，默认保留最高阶作为系列候选代表（避免数十件同系中间阶位填满候选栏）
                    const collapsedCandidates = collapseSeriesCandidates(matchedEquips, equips);

                    if (collapsedCandidates.length === 1) {
                        const single = collapsedCandidates[0];
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: buildEquipReplyText(single, equips),
                            time: timeStr,
                            cardType: 'equip',
                            cardData: {
                                equip: single,
                                initialRefLevel: targetRefLevel,
                                allEquips: equips
                            }
                        };
                    } else if (collapsedCandidates.length > 1) {
                        const topCandidates = collapsedCandidates.slice(0, 100);
                        // 宽泛词 query（「所有项链」类机器词，hub「其他」入口用）不外泄：
                        // 文本与 keyword 均玩家化为「XX的全部装备」（2026-10-17 用户截图发现）
                        const isBroadQuery = /^(所有|全部)/.test(q);
                        const displayKeyword = isBroadQuery && matchedSlot ? `${matchedSlot}的全部装备` : query;
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `为你检索到 ${collapsedCandidates.length} 件符合【${displayKeyword}】的候选装备，可在下方直接切换查看详情：`,
                            time: timeStr,
                            cardType: 'equip_candidates',
                            cardData: {
                                keyword: displayKeyword,
                                candidates: topCandidates,
                                totalCount: collapsedCandidates.length,
                                initialRefLevel: targetRefLevel,
                                allEquips: equips
                            }
                        };
                    } else if (matchedQ || matchedSlot || q.includes('装备')) {
                        return buildNotFoundMessage(timeStr);
                    }
                }
            }
        } catch (e) {
            console.warn('Load equip for intent failed:', e);
        }

        // 2. 法宝查询意图（支持法宝名、特技名、特效机制、门派、种族等多维检索）
        try {
            const fabaos = await dataService.getFabaoList();
            if (Array.isArray(fabaos) && fabaos.length > 0) {
                const isExplicitFabaoQuery = q.includes('法宝') || q.includes('特技');
                // 提取关键词：去除常见助词与疑问词
                let keyword = q.replace(/带|有|的|法宝|特技|特效|是哪个|有哪些|怎么样|如何|获取|好用吗|介绍|\?|？/g, '').trim();
                if (!keyword) keyword = q;

                // 智能机制同义词/标签扩展
                const searchTerms = [keyword];
                if (keyword.includes('爆伤')) {
                    searchTerms.push('致命一击伤害', '暴击伤害');
                } else if (keyword.includes('暴击')) {
                    searchTerms.push('致命一击率');
                } else if (keyword.includes('破防') || keyword.includes('降防')) {
                    searchTerms.push('降低目标防御', '防御尽散');
                } else if (keyword.includes('易伤') || keyword.includes('增伤')) {
                    searchTerms.push('受到伤害增加', '递增伤害');
                } else if (keyword.includes('解控') || keyword.includes('驱散')) {
                    searchTerms.push('驱除', '清除不利');
                } else if (keyword.includes('流失')) {
                    searchTerms.push('气血流失', '损失气血');
                } else if (keyword.includes('禁食')) {
                    searchTerms.push('禁食');
                }

                // 优先精确定位名称或法宝特技名
                const exactName = fabaos.find(f =>
                    f.名称.toLowerCase() === keyword ||
                    f.名称.toLowerCase() === q ||
                    (f.skillName && f.skillName.toLowerCase() === keyword) ||
                    (f.skillName && f.skillName.toLowerCase() === q)
                );
                if (exactName) {
                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你速查到法宝【${exactName.名称}】（${exactName.类型 || '战斗法宝'}）。支持在下方卡片中直接切换【普通/承/真】形态与【1~5阶】技能数值：`,
                        time: timeStr,
                        cardType: 'fabao',
                        cardData: {
                            id: exactName.id,
                            name: exactName.名称,
                            grade: exactName.类型 || '战斗法宝',
                            fabao: exactName
                        }
                    };
                }

                // 检索所有匹配法宝 (按名称、特技名、门派、种族、技能特效文本)
                // 注意：只有当用户明确指定“法宝”意图，或者关键词命中法宝名/自身特技名时才触发。
                // 绝对禁止对整个法宝做全局模糊匹配（避免天琊等法宝中枚举的全门派影响技能误劫持普通技能检索）
                const matchedList = fabaos.filter(f => {
                    const name = (f.名称 || '').toLowerCase();
                    const sName = (f.skillName || '').toLowerCase();
                    const mp = (f.门派 || '').toLowerCase();
                    const zc = (f.种族 || '').toLowerCase();

                    return searchTerms.some(term => {
                        const t = term.toLowerCase();
                        if (name.includes(t) || sName.includes(t)) return true;
                        if (isExplicitFabaoQuery) {
                            if (mp && mp.includes(t)) return true;
                            if (zc && zc.includes(t)) return true;
                            // 检查法宝技能特效说明，但过滤掉“影响技能” cross-reference 段落
                            const effectStr = JSON.stringify(f.技能特效 || '').toLowerCase();
                            const cleanEffect = effectStr.replace(/影响技能[^\n"]*/g, '');
                            if (cleanEffect.includes(t)) return true;
                        }
                        return false;
                    });
                });

                if (matchedList.length === 1) {
                    const single = matchedList[0];
                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你速查到匹配【${keyword}】的法宝【${single.名称}】（${single.类型 || '战斗法宝'}）：`,
                        time: timeStr,
                        cardType: 'fabao',
                        cardData: {
                            id: single.id,
                            name: single.名称,
                            grade: single.类型 || '战斗法宝',
                            fabao: single
                        }
                    };
                } else if (matchedList.length > 1) {
                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你检索到 ${matchedList.length} 件符合【${keyword}】的候选法宝，可在下方直接切换查看详情：`,
                        time: timeStr,
                        cardType: 'fabao_candidates',
                        cardData: {
                            keyword,
                            candidates: matchedList
                        }
                    };
                } else if (isExplicitFabaoQuery) {
                    return buildNotFoundMessage(timeStr);
                }
            }
        } catch (e) {
            console.warn('Load fabao for intent failed:', e);
        }

        // 3. 技能查询意图（挂载 5,927 全量 1:1 游戏原生高保真卡片与等级推演器）
        try {
            const allCuratedSkills = await dataService.getAllCuratedSkills();
            if (Array.isArray(allCuratedSkills) && allCuratedSkills.length > 0) {
                const SKILL_CATEGORY_MAP: Record<string, { groupKeyword?: string; nameKeyword?: string; label: string }> = {
                    '玄烛': { groupKeyword: '星宿', nameKeyword: '玄烛', label: '玄烛星宿' },
                    '赤乌': { groupKeyword: '星宿', nameKeyword: '赤乌', label: '赤乌星宿' },
                    '星宿': { groupKeyword: '星宿', label: '星宿' },
                    '心法': { groupKeyword: '心法', label: '心法' },
                    '神通': { groupKeyword: '神通', label: '神通' },
                    '造化': { groupKeyword: '造化', label: '造化' },
                    '天书': { groupKeyword: '天书', label: '天书' },
                    '轩辕策': { groupKeyword: '轩辕策', label: '轩辕策' },
                    '飞升': { groupKeyword: '飞升', label: '飞升' }
                };

                // 技能 5 大分类器精准提取（用户口径：门派技能、阵营神通、三代技能、四代技能、心法技能）
                let targetSubCat: 'sandai' | 'sidai' | 'xinfa' | 'shentong' | 'menpai' | null = null;
                if (tokens.some(t => /三代|3代|iii|ⅲ/i.test(t)) || /三代|3代|iii|ⅲ/i.test(q)) {
                    targetSubCat = 'sandai';
                } else if (tokens.some(t => /四代|4代/i.test(t) || t.includes('玄烛') || t.includes('赤乌')) || /四代|4代|玄烛|赤乌/.test(q)) {
                    targetSubCat = 'sidai';
                } else if (tokens.some(t => t.includes('心法')) || q.includes('心法')) {
                    targetSubCat = 'xinfa';
                } else if (tokens.some(t => t.includes('神通') || t.includes('造化') || t.includes('阵营') || t === '仙' || t === '魔' || t === '佛') || q.includes('神通') || q.includes('造化') || q.includes('阵营')) {
                    targetSubCat = 'shentong';
                } else if (tokens.some(t => t.includes('门派') || t.includes('普通') || t.includes('天书')) || q.includes('门派技能') || q.includes('普通技能') || q.includes('天书') || (matchedProf && (q.includes('门派') || q.includes('普通')))) {
                    targetSubCat = 'menpai';
                }

                const matchedCategories: string[] = [];
                for (const cat of Object.keys(SKILL_CATEGORY_MAP)) {
                    if (tokens.some(t => t.includes(cat.toLowerCase())) || q.includes(cat.toLowerCase())) {
                        matchedCategories.push(cat);
                    }
                }
                const hasExplicitCategory = matchedCategories.length > 0 || targetSubCat !== null;

                const matchedCamp = ['仙', '魔', '佛'].find(c =>
                    tokens.some(t => t === c || t === c + '阵' || t === c + '阵营') ||
                    q.includes(c + '神通') || q.includes(c + '造化')
                );
                const isExplicitSkillQuery = q.includes('技能') || q.includes('神通') || q.includes('天书') || hasExplicitCategory;

                const cleanTokens = tokens.filter(t => {
                    const low = t.toLowerCase();
                    if (['技能', '技能描述', '技能机制', '机制', '数值', '效果', '查询', '速查'].includes(low)) return false;
                    if (profs.some(p => p.toLowerCase() === low)) return false;
                    if (/^\d+$/.test(low)) return false;
                    return true;
                });

                // 提取纯粹的技能原名自由关键词（剥离门派、技能类别词、阵营词等）
                const skillNameTokens: string[] = [];
                for (const ct of cleanTokens) {
                    let remainder = ct;
                    for (const pr of profs) remainder = remainder.replace(pr.toLowerCase(), '');
                    for (const cat of Object.keys(SKILL_CATEGORY_MAP)) remainder = remainder.replace(cat.toLowerCase(), '');
                    if (matchedCamp) remainder = remainder.replace(matchedCamp, '');
                    remainder = remainder.replace(/技能|神通|天书|心法|造化|星宿|玄烛|赤乌|三代|3代|四代|4代|门派|普通|阵营/g, '').trim();
                    if (remainder.length >= 2) {
                        skillNameTokens.push(remainder);
                        // T-04 机制同义词（用户确认口径）：易伤=增伤——数据 tag 写"增伤"，玩家口语说"易伤"
                        if (remainder === '易伤') skillNameTokens.push('增伤');
                    }
                }

                const qClean = q.replace(/[·\s,，+＋/、\-_\(\)（）]/g, '');

                // 技能 5 大分类的判定闭包（严格对齐用户规则口径）
                const isGen3Skill = (sk: CuratedSkillItem) =>
                    (/III|Ⅲ/i.test(sk.name || '') || /三代/.test(sk.name || '')) &&
                    !sk.name.includes('触发') &&
                    sk.group_name !== '触发技能';

                const isGen4Skill = (sk: CuratedSkillItem) =>
                    ((sk.name || '').includes('玄烛') || (sk.name || '').includes('赤乌') || /四代/.test(sk.name || '')) &&
                    !sk.name.includes('触发') &&
                    sk.group_name !== '触发技能';

                const isXinfaSkill = (sk: CuratedSkillItem) => {
                    if (isGen3Skill(sk) || isGen4Skill(sk)) return false;
                    const name = sk.name || '';
                    const group = sk.group_name || '';
                    const hasTag = Boolean(sk.tags && sk.tags.some(t => t.n && t.n.includes('心法')));
                    return (hasTag || group.includes('心法') || name.includes('心法')) && !name.includes('触发');
                };

                const isShentongSkill = (sk: CuratedSkillItem) => {
                    if (isGen3Skill(sk) || isGen4Skill(sk) || isXinfaSkill(sk)) return false;
                    const name = sk.name || '';
                    const group = sk.group_name || '';
                    return (
                        (/<玄>|<煞>|<禅>|II|Ⅱ/i.test(name) ||
                            group.includes('神通') ||
                            group.includes('造化') ||
                            /<玄>|<煞>|<禅>/.test(group)) &&
                        !name.includes('触发')
                    );
                };

                const isMenpaiSkill = (sk: CuratedSkillItem) => {
                    if (isGen3Skill(sk) || isGen4Skill(sk) || isXinfaSkill(sk) || isShentongSkill(sk)) return false;
                    return !sk.name.includes('触发') && sk.group_name !== '触发技能' && sk.group_name !== '怪物技能';
                };

                // A. 若指定门派，且输入的是 5 大分类纯检索（如「逐霜 三代技能」、「青云 四代技能」等）
                if (skillNameTokens.length === 0 && targetSubCat && matchedProf) {
                    const profPool = allCuratedSkills.filter(sk => (sk.group_name || '').includes(matchedProf) && isValidSkill(sk));
                    let matchedList: CuratedSkillItem[] = [];
                    let label = '';
                    if (targetSubCat === 'sandai') {
                        matchedList = profPool.filter(isGen3Skill);
                        label = '三代技能';
                    } else if (targetSubCat === 'sidai') {
                        matchedList = profPool.filter(isGen4Skill);
                        label = '四代技能';
                    } else if (targetSubCat === 'xinfa') {
                        matchedList = profPool.filter(isXinfaSkill);
                        label = '心法技能';
                    } else if (targetSubCat === 'shentong') {
                        matchedList = profPool.filter(isShentongSkill);
                        label = '阵营神通';
                    } else if (targetSubCat === 'menpai') {
                        matchedList = profPool.filter(isMenpaiSkill);
                        label = '门派技能';
                    }

                    if (matchedList.length > 0) {
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `为你速查到【${matchedProf}】${label}（共 ${matchedList.length} 个），可在下方快速点选查看 1:1 原生说明与等级推演：`,
                            time: timeStr,
                            cardType: 'skill_candidates',
                            cardData: {
                                candidates: matchedList.slice(0, 30),
                                query: q,
                                skill: matchedList[0]
                            }
                        };
                    }
                }

                // B. 若未指定门派，但指定了 5 大分类纯检索（如「三代技能」、「四代技能」等）
                if (skillNameTokens.length === 0 && targetSubCat && !matchedProf) {
                    let matchedList: CuratedSkillItem[] = [];
                    let label = '';
                    if (targetSubCat === 'sandai') {
                        matchedList = allCuratedSkills.filter(isGen3Skill);
                        label = '三代技能';
                    } else if (targetSubCat === 'sidai') {
                        matchedList = allCuratedSkills.filter(isGen4Skill);
                        label = '四代技能';
                    } else if (targetSubCat === 'xinfa') {
                        matchedList = allCuratedSkills.filter(isXinfaSkill);
                        label = '心法技能';
                    } else if (targetSubCat === 'shentong') {
                        matchedList = allCuratedSkills.filter(isShentongSkill);
                        label = '阵营神通';
                    } else if (targetSubCat === 'menpai') {
                        matchedList = allCuratedSkills.filter(isMenpaiSkill);
                        label = '门派技能';
                    }

                    if (matchedList.length > 0) {
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `为你速查到各门派部分${label}，支持输入“逐霜 ${label}”等精准查看指定门派技能库：`,
                            time: timeStr,
                            cardType: 'skill_candidates',
                            cardData: {
                                candidates: matchedList.slice(0, 30),
                                query: q,
                                skill: matchedList[0]
                            }
                        };
                    }
                }

                // 各主流职业代表性核心技能（当用户点击【技能描述】或输入“技能”但未指定具体技能名、门派与类别时展示）
                const CORE_SIGNATURE_SKILL_NAMES = [
                    '苍龙啸', '神剑御雷真诀', '未名斩', '聚灵咒', '江南', '缠绵',
                    '六道轮回', '大梵般若', '无量真言', '玄阳火典', '影祭',
                    '双飞火', '龙骧', '松风雅韵', '影刀风', '术·枯魂', '业·罪杀',
                    '溯月游', '掠天跃', '白鱼吹浪'
                ];

                if (isExplicitSkillQuery && cleanTokens.length === 0 && !matchedProf && !hasExplicitCategory) {
                    const repSkills: CuratedSkillItem[] = [];
                    for (const name of CORE_SIGNATURE_SKILL_NAMES) {
                        const s = allCuratedSkills.find(sk => sk.name === name && sk.group_kind === 'prof' && isValidSkill(sk))
                            || allCuratedSkills.find(sk => sk.name === name && isValidSkill(sk));
                        if (s) repSkills.push(s);
                    }
                    if (repSkills.length > 0) {
                        return {
                            id: `msg-${Date.now()}`,
                            sender: 'assistant',
                            text: `为你速查到各主流职业代表性核心技能，可在下方快速切换查看 1:1 原生说明与等级推演（也可输入“青云技能”或具体技能名精准速查）：`,
                            time: timeStr,
                            cardType: 'skill_candidates',
                            cardData: {
                                candidates: repSkills,
                                query: q
                            }
                        };
                    }
                }

                const candidates: { sk: CuratedSkillItem; score: number }[] = [];
                for (const sk of allCuratedSkills) {
                    if (!sk.name || !sk.name.trim() || !isValidSkill(sk)) continue;
                    const sName = sk.name.trim().toLowerCase();
                    const sGroup = (sk.group_name || '').toLowerCase();
                    const sNameClean = sName.replace(/[·\s]/g, '');

                    // 如果明确指定了门派（如逐霜、青云），优先限制在其门派树下
                    if (matchedProf && !sGroup.includes(matchedProf.toLowerCase())) {
                        continue;
                    }

                    // 阵营限制（若指定了仙/魔/佛且搜索神通或造化）
                    if (matchedCamp && (matchedCategories.includes('神通') || matchedCategories.includes('造化') || q.includes('神通') || q.includes('造化'))) {
                        const campSymbols: Record<string, string[]> = {
                            '仙': ['仙', '<玄>'],
                            '魔': ['魔', '<煞>'],
                            '佛': ['佛', '<禅>']
                        };
                        const symbols = campSymbols[matchedCamp] || [matchedCamp];
                        const matchesCamp = symbols.some(sym => sGroup.includes(sym) || sName.includes(sym));
                        if (!matchesCamp) continue;
                    }

                    let score = 0;

                    // 1. 无缝连字符匹配（如用户输入 '玄烛绝圣弃智' 匹配 '玄烛·绝圣弃智·萤炬'）
                    if (qClean.length >= 4 && sNameClean.includes(qClean)) {
                        score = 160;
                    }

                    // 2. 复合命中：同时命中自由技能词 与 类别（如 '玄烛' + '绝圣弃智'，或 '赤乌' + '天魔舞'）
                    const matchesAllSkillTokens = skillNameTokens.length > 0 &&
                        skillNameTokens.every(st => sName.includes(st) || sNameClean.includes(st));

                    const matchesAnyCat = matchedCategories.length > 0 && matchedCategories.some(cat => {
                        const rule = SKILL_CATEGORY_MAP[cat];
                        if (rule.nameKeyword && !sName.includes(rule.nameKeyword)) return false;
                        if (rule.groupKeyword && !sGroup.includes(rule.groupKeyword)) return false;
                        return true;
                    });

                    if (matchesAllSkillTokens && matchesAnyCat) {
                        score = Math.max(score, 150);
                    } else if (matchesAllSkillTokens && matchedCategories.length === 0) {
                        score = Math.max(score, 120);
                    } else if (sName === q || (cleanTokens.length > 0 && cleanTokens.some(t => t === sName))) {
                        score = Math.max(score, 100);
                    } else if (skillNameTokens.length === 0 && matchesAnyCat) {
                        // 用户只搜类别（如 '玄烛 赤乌'、'青云 心法'、'神通'）
                        score = Math.max(score, 80);
                    } else if (skillNameTokens.length > 0 && skillNameTokens.some(st => sName.includes(st))) {
                        score = Math.max(score, 50);
                    } else if (isExplicitSkillQuery && matchedProf && sk.group_kind === 'prof') {
                        score = Math.max(score, 10);
                    }

                    // 标签辅助匹配加分
                    if (sk.tags && sk.tags.length > 0 && skillNameTokens.length > 0) {
                        for (const t of skillNameTokens) {
                            if (t.length >= 2 && sk.tags.some(tag => tag.n.includes(t) || t.includes(tag.n))) {
                                score += 20;
                                break;
                            }
                        }
                    }

                    // 技能 5 大子分类匹配提权
                    if (targetSubCat === 'sandai' && isGen3Skill(sk)) score += 60;
                    else if (targetSubCat === 'sidai' && isGen4Skill(sk)) score += 60;
                    else if (targetSubCat === 'xinfa' && isXinfaSkill(sk)) score += 60;
                    else if (targetSubCat === 'shentong' && isShentongSkill(sk)) score += 60;
                    else if (targetSubCat === 'menpai' && isMenpaiSkill(sk)) score += 60;

                    // 额外高阶星宿排序提权：曦日 > 皓月 > 萤炬
                    if (score >= 80 && (sName.includes('·星宿') || sGroup.includes('星宿'))) {
                        if (sName.includes('曦日') || q.includes('曦日')) score += 5;
                        else if (sName.includes('皓月') || q.includes('皓月')) score += 3;
                        else if (sName.includes('萤炬') || q.includes('萤炬')) score += 1;
                    }

                    if (score > 0) {
                        candidates.push({ sk, score });
                    }
                }

                // 排除内部触发/怪物技能，除非精确指定
                const filtered = candidates.filter(c => {
                    if (c.sk.group_name === '触发技能' || c.sk.group_name === '怪物技能' || c.sk.name.includes('触发')) {
                        return c.score >= 100;
                    }
                    return true;
                });

                const getProfIdx = (group: string) => {
                    const idx = profs.findIndex(p => group.includes(p));
                    return idx >= 0 ? idx : 999;
                };

                filtered.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    const pA = getProfIdx(a.sk.group_name || '');
                    const pB = getProfIdx(b.sk.group_name || '');
                    if (pA !== pB) return pA - pB;
                    if (a.sk.group_kind === 'prof' && b.sk.group_kind !== 'prof') return -1;
                    if (b.sk.group_kind === 'prof' && a.sk.group_kind !== 'prof') return 1;
                    return a.sk.name.length - b.sk.name.length;
                });

                const matchedSkills = filtered.slice(0, 30).map(c => c.sk);

                if (matchedSkills.length === 1) {
                    const single = matchedSkills[0];
                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: `为你速查到技能【${single.name}】（${single.group_name || '门派技能'}）的 1:1 游戏原生视图，可在卡片右上角进行【等级 -1 / 等级 +1】推演：`,
                        time: timeStr,
                        cardType: 'skill',
                        cardData: {
                            skill: single,
                            name: single.name
                        }
                    };
                } else if (matchedSkills.length > 1) {
                    let replySummary = `为你检索到 ${matchedSkills.length} 个符合条件的技能，可在下方快速切换查看 1:1 原生说明与等级推演：`;
                    if (hasExplicitCategory && skillNameTokens.length === 0) {
                        const catLabels = matchedCategories.map(c => SKILL_CATEGORY_MAP[c]?.label || c).join(' / ');
                        const profPrefix = matchedProf ? `【${matchedProf}】` : '';
                        replySummary = `为你速查到 ${profPrefix}${catLabels}技能（共 ${filtered.length} 个），可在下方快速点选切换查看 1:1 原生说明与等级推演：`;
                        if (matchedCategories.includes('星宿') || q.includes('星宿')) {
                            replySummary += `\n（若您想查看全职业通用的【星宿装备及星辰升星增益】，可直接输入「星宿」或「星辰」）`;
                        } else if (matchedCategories.includes('轩辕策') || q.includes('轩辕策')) {
                            replySummary += `\n（若您想进行【轩辕策洗炼模拟与词条诊断】，可直接输入「轩辕策」）`;
                        }
                    } else if (skillNameTokens.length > 0 && hasExplicitCategory) {
                        const catLabels = matchedCategories.map(c => SKILL_CATEGORY_MAP[c]?.label || c).join(' / ');
                        replySummary = `为你速查到【${skillNameTokens.join(' ')}】相关的${catLabels}技能，可在下方快速切换不同阶位与等级推演：`;
                    }

                    return {
                        id: `msg-${Date.now()}`,
                        sender: 'assistant',
                        text: replySummary,
                        time: timeStr,
                        cardType: 'skill_candidates',
                        cardData: {
                            candidates: matchedSkills,
                            skill: matchedSkills[0]
                        }
                    };
                } else if (isExplicitSkillQuery) {
                    return buildNotFoundMessage(timeStr);
                }
            }

        } catch (e) {
            console.warn('Load curated skills for intent failed:', e);
        }

        // 5. 极致属性攻略意图（信息卡 inline 呈现全领域细分，不再跳转路由页）
        // 覆盖 7 大属性：无视 / 减免 / 减暴击 / 暴击 / 爆伤 / 怪增 / 躲闪
        // 判序要点：「减暴/减爆」先于「爆伤/暴击」，否则「极致减暴击」会被误判为暴击攻略
        if (q.includes('极致无视') || q.includes('极致减免') || q.includes('极致减暴') || q.includes('怪增') || q.includes('躲闪') || q.includes('爆伤') || q.includes('暴伤') || q.includes('暴击') || q.includes('爆击') || q.includes('天花板') || q.includes('上限')) {
            let attrKey = 'ignore';
            let title = '极致无视伤害减免攻略';

            if (q.includes('减暴') || q.includes('减爆')) {
                attrKey = 'critReduction';
                title = '极致减暴击攻略';
            } else if (q.includes('爆伤') || q.includes('暴伤') || q.includes('暴击伤害')) {
                attrKey = 'critDamage';
                title = '极致爆伤攻略';
            } else if (q.includes('减免')) {
                attrKey = 'reduction';
                title = '极致减免伤害攻略';
            } else if (q.includes('怪增')) {
                attrKey = 'monsterDamageBonus';
                title = '极致对怪物增伤攻略';
            } else if (q.includes('躲闪')) {
                attrKey = 'dodge';
                title = '极致技能躲闪攻略';
            } else if (q.includes('暴击') || q.includes('爆击')) {
                attrKey = 'critRate';
                title = '极致暴击攻略';
            }

            return {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: `为你速查到【${title}】全景信息卡，涵盖全领域细分来源、理论最高与大致毕业门槛：`,
                time: timeStr,
                cardType: 'ceiling',
                cardData: {
                    title,
                    attrKey
                }
            };
        }

        return null;
    }

    /**
     * L2: 纯文本聊天通道（智能知识回复，无 Key 或网络故障时提供高质量诛仙3战术与机制应答）
     */
    public async chatText(
        prompt: string,
        history: { role: string; content: string }[] = []
    ): Promise<string> {
        // 先调用 Cloudflare Pages 后端网关 /api/copilot/chat
        try {
            const res = await fetch('/api/copilot/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    history,
                    customKeys: this.getUserKeys()
                })
            });

            if (res.ok) {
                const json = await res.json();
                if (json.reply) return json.reply;
            }
        } catch (e) {
            console.warn('Backend /api/copilot/chat not reachable, trying client failover:', e);
        }

        // 客户端备选直连降级：若用户配置了自己的智谱 Key
        const keys = this.getUserKeys();
        if (keys.zhipuKey) {
            try {
                const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${keys.zhipuKey}`
                    },
                    body: JSON.stringify({
                        model: 'glm-4-flash',
                        messages: [
                            { role: 'system', content: '你是诛仙3资深战斗配装与机制专家，回答精炼严谨，紧扣副本战力与属性。回答禁止使用 LaTeX，公式请用纯文本表示。' },
                            ...history,
                            { role: 'user', content: prompt }
                        ]
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    return data.choices?.[0]?.message?.content || '未能生成回复。';
                }
            } catch (err) {
                console.error('Client direct Zhipu error:', err);
            }
        }

        // 本地智能领域知识引擎（杜绝单一死板的硬编码一句话）
        const p = prompt.trim().toLowerCase();

        if (p.includes('开服') || p.includes('雷达') || p.includes('服务器') || p.includes('测服')) {
            return `【全区开服雷达监测服务】：\n1. 覆盖战区：实时监测诛仙3官方 9 大战区共 36 组服务器在线心跳与维护状态。\n2. 智能特性：提供网络延时毫秒级测速，支持开服声光三音阶提醒，第一时间锁定新服开放与维护开机。\n3. 你可以在右侧战术工作区打开【开服雷达】或访问独立工具页体验。`;
        }

        if (p.includes('训练场') || p.includes('打桩') || p.includes('木桩') || p.includes('循环')) {
            return `【副本与多角色模拟训练场】：\n1. 实战打桩：支持逐秒编排技能释放循环，模拟技能冷却、施法前摇与多段伤害计算。\n2. 机制仿真：内嵌 T18-T20 等主流团本 BOSS 的真实防御、减免、属性与暴击属性衰减。\n3. 伤害报表：输出详尽的秒伤曲线、段数分布与承伤数据，辅助优化输出手法与技能循环。`;
        }

        if (p.includes('天缘') || p.includes('须弥')) {
            return `【天缘与天命属性推算】：\n1. 机制说明：须弥系列装备与神级首饰具备天缘词条洗炼机制，理论极值词条能够提供显著的战斗增益。\n2. 模拟测算：本站提供天缘洗炼模拟，可推演出现目标属性组合的概率分布与期望成本。\n3. 你可以通过工作台【天缘属性】工具直接进行推演。`;
        }

        if (p.includes('留言') || p.includes('反馈') || p.includes('建议') || p.includes('捉虫')) {
            return `【仙友留言板 · 意见反馈】：\n仙友交流、数值机制捉虫、新功能催更，欢迎点击前往【仙友留言板】页面（/#/feedback）与全服仙友共同求索诛仙万象大道！`;
        }

        if (p.includes('更新') || p.includes('动态') || p.includes('排期') || p.includes('版本')) {
            return `【天书万象 · 更新动态】：\n本站基于全知 AI 大模型与确定性数值引擎持续演进，包含装备库更新、技能多段机制拟合、秒伤算法校准等，欢迎前往【更新动态】（/#/changelog）查阅最新迭代。`;
        }

        if (p.includes('关于') || p.includes('本站') || p.includes('初衷') || p.includes('作者') || p.includes('萝卜')) {
            return `【关于天书万象】：\n本站汇聚了诛仙3真实游戏装备、技能、BOSS与法宝数据，独创伤害计算公式与属性加权边际贡献分析，搭配全栈微工具与模拟器，致力于打造开放、专业、精准的修真战术助手。`;
        }

        if (p.includes('法宝')) {
            return `关于【诛仙3法宝体系】：\n当前副本主流输出与辅助法宝梯队：\n1. 【天琊 / 噬魂】：经典核心法宝，具备高额本体攻击与附加攻击成长，传承特效提供强大的减防与破防收益。\n2. 【伤心花 / 斩龙剑】：具备极佳的爆发增伤、禁食与控场机制。\n3. 【玉净瓶】：通用型自保与解控法宝，提供技能净化与气血防护。\n你可以直接输入具体法宝名称（如：玉净瓶、天琊、噬魂）调取全阶特技数值与图鉴直达卡片。`;
        }

        if (p.includes('逐霜') || p.includes('苍龙啸')) {
            return `关于【逐霜】职业副本战力定位：\n1. 核心机制：逐霜主要依赖【苍龙啸】的多段爆发。在仙阵营与龙怒状态下，爆发秒伤达到全门派第一梯队。\n2. 属性优先级：\n- 对怪增伤：建议达到 80%+；\n- 暴击率与暴伤：暴击率需抵消副本 Boss 减暴（T20 需 170%+），爆伤建议 850%+。\n3. 你可以点击左上角直接进入【属性战力计算器】精确录入逐霜面板并测算每段伤害。`;
        }

        if (p.includes('青云') || p.includes('神剑')) {
            return `关于【青云门】职业副本战力定位：\n1. 核心机制：以【神剑御雷真诀】等大范围持续群攻与高频段数为核心，佛青云拥有优秀自保与续航，魔青云偏向极致减防爆发。\n2. 属性优先级：追求极致攻击力、本体攻击比例与技能附加伤害，配合减爆免与无视减免打满群桩秒伤。`;
        }

        if (p.includes('鬼王') || p.includes('未名斩')) {
            return `关于【鬼王宗】职业副本战力定位：\n1. 核心机制：【未名斩】多段单体爆发配合聚灵一击的极限瞬间出伤。\n2. 属性优先级：真气总量直接决定聚灵爆发伤害，同时需兼顾对怪增伤与暴击爆伤。`;
        }

        if (p.includes('破防') || p.includes('伤害') || p.includes('计算') || p.includes('公式') || p.includes('门槛')) {
            return `【诛仙3副本实战战力与配装指南】：\n1. 属性达标：在当前高阶团队副本（如 T18-T20 断浪碎晶宫）中，对怪增伤与暴击爆伤是决定输出上限的核心三角。\n2. 破防机制：BOSS拥有极高面板防御与伤害减免，若自身基础攻击与无视穿透不足，技能伤害将受到大幅压制；当穿透达标后方可发挥完整爆发潜能。\n3. 精确测算：建议直接点击左上角【属性战力计算器】或在当前对话中【粘贴游戏 C 键面板截图】，天书万象 AI 将自动为你模拟实战秒伤与各部位提升性价比。`;
        }

        if (p.includes('配装') || p.includes('装备') || p.includes('元婴') || p.includes('轩辕策')) {
            return `【诛仙3主流副本配装梯度建议】：\n1. 武器防具：神隐 / 混虚彰武为当前毕业选择，平民进阶推荐混虚昭武 +11 蕴灵。\n2. 元婴属性：输出职业首选「双暴击 + 双爆伤」或「附带气血/真气/攻击百分比」，辅助自保职业首选「双减免百分比 + 双减暴伤」。\n3. 轩辕策：青龙书与白虎书主暴击爆伤三代技能，朱雀书与玄武书主气血真气攻击属性，推荐使用本站【轩辕策模拟器】推算满级毕业度。\n4. 佩章与阵灵：优先选择带怪物增伤、爆伤的组合词条。`;
        }

        return UNIFIED_NOT_FOUND_REPLY;
    }

    /**
     * L3: 视觉多模态通道（专为截图 OCR 与属性结构化提取服务）
     */
    public async diagnoseImage(
        base64Image: string,
        userPrompt: string = ''
    ): Promise<VisionExtractionResult> {
        // DEV-only：本地 fixture 注入（生产构建自动剔除）
        const fx = getVisionFixture();
        if (fx) return fx;

        const keys = this.getUserKeys();

        // 上传前降采样：长边 ≤1600（省 input token，也避免模型缩放后小字更糊）
        const imageForModel = await downscaleDataUrl(base64Image, { maxEdge: 1600 });

        // 1. 优先调用后端视觉网关
        try {
            const res = await fetch('/api/copilot/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: imageForModel,
                    prompt: userPrompt,
                    customKeys: keys
                })
            });

            if (res.ok) {
                const json = await res.json();
                if (json && (json.result || json.panel)) {
                    return {
                        ...(json.result || { mode: 'general' as const, rawExplanation: '' }),
                        panel: json.panel,
                        provider: json.provider ?? null,
                        degraded: Boolean(json.degraded),
                        degradedReason: json.degradedReason,
                        recognizedKind: json.recognizedKind ?? null,
                        recognizedKindEvidence: json.recognizedKindEvidence,
                        lastError: json.lastError,
                        quality: json.quality,
                        issues: json.issues
                    };
                }
            }
        } catch (e) {
            console.warn('Backend /api/copilot/vision not reachable, attempting direct client / fallback:', e);
        }

        // 2. 客户端直连视觉模型（若用户配置了智谱 GLM-4V 密钥）
        if (keys.zhipuKey) {
            try {
                const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${keys.zhipuKey}`
                    },
                    body: JSON.stringify({
                        model: 'glm-4v-flash',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text: '你是诛仙3资深属性分析专家。请识别这张游戏面板截图（C键属性或轩辕策等）。若为C键角色面板，请提取以下字段以严格纯JSON格式返回（禁止markdown代码块，直接返回json对象）：\n{"mode":"c_panel","rawExplanation":"简短战力评估","cPanelData":{"characterClass":"门派如逐霜/青云/鬼王","faction":"XIAN/FO/MO","attack":最大攻击数字,"defense":防御数字,"hp":气血数字,"mp":真气数字,"critRate":暴击率数字,"critDamage":暴伤数字,"ignoreReduction":无视减免数字,"damageReduction":减免伤害数字,"critReduction":减暴率数字,"monsterDamageBonus":对怪增伤数字}}'
                                    },
                                    {
                                        type: 'image_url',
                                        image_url: { url: base64Image }
                                    }
                                ]
                            }
                        ]
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const reply = data.choices?.[0]?.message?.content || '';
                    const cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    if (parsed.mode && (parsed.cPanelData || parsed.xycData)) {
                        return parsed;
                    }
                }
            } catch (err) {
                console.warn('Direct Zhipu Vision failed:', err);
            }
        }

        // 3. 所有通道失败：明确降级，不产生任何数值（旧「启发式抠数 + 默认模板」已删除）
        return {
            mode: 'general',
            rawExplanation: '识图功能受限：当前没有可用的视觉模型，未能识别出任何数值。请手动填写，或稍后重试。',
            degraded: true,
            degradedReason: 'provider_error',
            provider: null
        };
    }

}
