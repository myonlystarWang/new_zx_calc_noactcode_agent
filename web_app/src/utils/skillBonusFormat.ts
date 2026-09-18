/**
 * 技能附加属性（SkillBonusAttributes）数值的统一展示格式化。
 *
 * 数值字段有两种形态：标量（每段同值）与数组（多段技能每段不同值，如铁马冰河II 30/50/70/110）。
 * 数组直接拼进 JSX/模板字符串会渲染成 "30,50,70,110"，故所有展示点统一走这里。
 *
 * 展示口径（唯一）：**逐段完整序列** —— `585/465/385/325%（4段）`。
 * 不做「峰值简写」也不做「连续重复折叠」：两条路都被实际使用口径否决
 * （峰值丢信息；折叠后 `104/114/124×4%` 读起来容易被误读成「第 4 段 124%」）。
 * 窄容器放不下的问题由**布局**解决：数组字段跨整行显示（卡片 `col-span-2 sm:col-span-3`、
 * 技能详情面板/tooltip `col-span-2`），标量字段仍走多列紧凑布局。
 *
 * 零值口径：0 视为「无有效加成」→ 返回 null / hasBonusValue=false。
 * 这与改造前的 truthy 判断（`if (bonus.X)`）保持一致，避免卡片上冒出 "+0%" 噪声行。
 * 注意 DungeonDetail 那类"总是显示、零值回落 +0%"的面板，用 `?? '+0%'` 兜底即可维持原样。
 */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 非零有效数值（0 不构成可展示加成） */
const isNonZero = (v: unknown): v is number => isNum(v) && v !== 0;

/** 是否为「每段数组」形态 */
export function isPerHitArray(v: unknown): v is number[] {
  return Array.isArray(v);
}

/** 该字段是否有可展示的数值（空数组、全零数组、零标量均视为无） */
export function hasBonusValue(value: number | number[] | undefined): boolean {
  if (isPerHitArray(value)) return value.some(isNonZero);
  return isNonZero(value);
}

/**
 * 取用于比较的标量值：数组取最大值（如 SkillDamageBonus > 1 判定），无有效值返回 undefined。
 */
export function bonusScalar(value: number | number[] | undefined): number | undefined {
  if (isPerHitArray(value)) {
    const arr = value.filter(isNum);
    return arr.length > 0 ? Math.max(...arr) : undefined;
  }
  return isNum(value) ? value : undefined;
}

/**
 * 附加属性数值 → 展示文案。
 * - 标量：`+30%`；标量为 0 或缺失 → null
 * - 数组全等：`+40% ×36`（每段同值，不列 36 遍）
 * - 数组不等：`585/465/385/325%（4段）`（完整逐段，不折叠、不取峰值）
 *
 * @param unit 单位后缀（`'%'` 或 `''`）
 * @param signed 是否带 `+` 前缀，默认 true
 */
export function formatBonusValue(
  value: number | number[] | undefined,
  unit = '%',
  signed = true
): string | null {
  if (isPerHitArray(value)) {
    const arr = value.filter(isNum);
    if (arr.length === 0) return null;
    if (!arr.some((v) => v !== 0)) return null; // 每段皆为 0：无有效加成
    const sign = signed ? '+' : '';
    if (arr.every((v) => v === arr[0])) return `${sign}${arr[0]}${unit} ×${arr.length}`;
    return `${arr.join('/')}${unit}（${arr.length}段）`;
  }
  if (!isNonZero(value)) return null;
  return `${signed ? '+' : ''}${value}${unit}`;
}

/** 每段逐值列表（用于需要逐段展开的场景），如 `30 / 50 / 70 / 110`；标量返回 null */
export function formatPerHitList(value: number | number[] | undefined, unit = '%'): string | null {
  if (!isPerHitArray(value)) return null;
  const arr = value.filter(isNum);
  if (arr.length === 0) return null;
  return arr.map((v) => `${v}${unit}`).join(' / ');
}
