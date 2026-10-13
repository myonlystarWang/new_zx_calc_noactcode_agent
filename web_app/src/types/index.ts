export * from '@zx/simulation-engine';

// 模块增强：为 Boss 展示属性追加伤害压缩字段（JSON 中 MonsterAttributeModifiers.DamageCompressionPercent）
declare module '@zx/simulation-engine' {
    interface MonsterDisplayAttributes {
        damageCompression?: number;
    }
}

export interface FabaoSkillVariant {
    num: number;
    skill_id_base?: string;
    str2: string;
    效果标签?: { n: string; v: string }[] | string[];
}

export interface FabaoSkillDetail {
    name: string;
    skill_id_base?: string;
    str1?: string;
    str2?: string;
    str3?: string;
    str4?: string;
    特效列表?: { 独有?: boolean; 名称: string; 等级加成?: number; 描述: string }[];
    特效变体?: FabaoSkillVariant[];
    效果标签?: { n: string; v: string }[] | string[];
}

export interface FabaoItem {
    id: number;
    名称: string;
    描述_原始?: string;
    描述_带换行?: string;
    描述_纯文本?: string;
    skillName?: string;
    skillName来源?: string;
    skillName来源URL?: string;
    技能特效: {
        普通?: FabaoSkillDetail;
        承?: FabaoSkillDetail;
        真?: FabaoSkillDetail;
    };
    等级: number;
    类型: string;
    门派?: string;
    种族?: string;
}

export interface EquipAdditionalAttr {
    id: number;
    n: string;
    t: number;
    l: number;
    d: string;
}

export interface EquipSpecialBonusPoolItem {
    l: number;
    d: string;
}

export type EquipSlot = '武器' | '头盔' | '衣服' | '靴子' | '袖甲' | '腰带' | '项链' | '戒指' | '法身' | '罡气' | '护符' | '勋章' | '玺绶' | '锦囊' | string;
export type EquipQuality = '修武' | '昭武' | '彰武' | '神隐' | '神级' | '至尊' | '天命' | string;

export interface CuratedEquipItem {
    id: number;
    name: string;
    slot: EquipSlot;
    lv: number;
    xz?: string;
    prof: string[];
    g?: string;
    atk?: [number, number];
    def?: number;
    hp?: number;
    mp?: number;
    hit?: number;
    dod?: number;
    rng?: number;
    dura?: number;
    price?: number;
    ref?: number[];
    q: EquipQuality;
    ad: EquipAdditionalAttr[];
    sj?: Record<string, EquipSpecialBonusPoolItem[]>;
}

export interface CuratedSkillItem {
    id: number;
    name: string;
    el_descs: string[];
    el_max: number;
    el_cd?: number;
    el_mp?: number;
    el_req?: number;
    occ?: number;
    tags?: string[];
    group_name?: string;
    group_kind?: string;
    buffed_by?: [number, string][];
}

