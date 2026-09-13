export * from '@zx/simulation-engine';

// 模块增强：为 Boss 展示属性追加伤害压缩字段（JSON 中 MonsterAttributeModifiers.DamageCompressionPercent）
declare module '@zx/simulation-engine' {
    interface MonsterDisplayAttributes {
        damageCompression?: number;
    }
}
