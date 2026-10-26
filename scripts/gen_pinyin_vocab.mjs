/**
 * 生成拼音别名表（构建期，一次性 / 词表变更后重跑）
 *
 * 背景：CopilotService 的 L0 拼音归一需要把 PINYIN_VOCAB_TERMS（约 66 个固定词条）
 * 转成全拼。pinyin-pro 打包后 295KB raw / 136KB gz，且被 CopilotService 静态引入，
 * 直接吃掉了首屏 ~30% 的 JS 体积——而实际只用到 66 个词的转换结果。
 *
 * 做法：脚本读取 CopilotService.ts 里的词表常量，用 pinyin-pro 转换一次，
 * 产出 pinyinVocab.generated.ts。运行时不依赖 pinyin-pro，行为完全一致
 * （同音歧义整键弃用、按拼音长度降序，均在此复刻）。
 *
 * 用法：node scripts/gen_pinyin_vocab.mjs
 * 触发时机：修改 PINYIN_VOCAB_TERMS / PROFESSIONS 之后必须重跑。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'web_app/src/services/CopilotService.ts');
const OUT = path.join(ROOT, 'web_app/src/services/pinyinVocab.generated.ts');

const source = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

function extractArrayBody(name) {
  const re = new RegExp(`const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\n\\];`);
  const match = source.match(re);
  if (!match) throw new Error(`未在 CopilotService.ts 找到数组常量 ${name}`);
  return match[1];
}

/** 去掉行注释后按 JS 字面量求值，支持 [...OTHER] 展开 */
function evaluateArray(body, scope) {
  const cleaned = body.replace(/\/\/[^\n]*/g, '');
  const keys = Object.keys(scope);
  const fn = new Function(...keys, `return [${cleaned}];`);
  return fn(...keys.map(k => scope[k]));
}

const professions = evaluateArray(extractArrayBody('PROFESSIONS'), {});
const vocabTerms = evaluateArray(extractArrayBody('PINYIN_VOCAB_TERMS'), { PROFESSIONS: professions });

// —— 与 CopilotService 原实现逐行对齐 ——
const byPinyin = new Map();
for (const term of vocabTerms) {
  const py = pinyin(term, { toneType: 'none' }).replace(/ü/g, 'v').replace(/[^a-z]/g, '');
  if (!py) continue;
  const list = byPinyin.get(py) || [];
  list.push(term);
  byPinyin.set(py, list);
}
const aliases = [];
for (const [py, terms] of byPinyin) {
  if (terms.length === 1) aliases.push([py, terms[0]]);
}
aliases.sort((a, b) => b[0].length - a[0].length);

// 同音冲突被剔除的词（打印出来，便于人工复核是否有必要保留）
const dropped = [...byPinyin.entries()].filter(([, terms]) => terms.length > 1);

const header = `/**
 * 拼音别名表 —— 自动生成，请勿手改
 *
 * 生成脚本：scripts/gen_pinyin_vocab.mjs
 * 数据来源：CopilotService.ts 的 PROFESSIONS + PINYIN_VOCAB_TERMS
 * 词表变更后必须重跑：node scripts/gen_pinyin_vocab.mjs
 *
 * 生成物替代了运行时的 pinyin-pro（295KB raw / 136KB gz），首屏不再加载该依赖。
 * 排序与去歧义规则与原实现一致：同音多词整键弃用、按拼音长度降序。
 */

/** 生成时的词表快照（仅用于核对是否已漂移，不参与运行时逻辑） */
export const PINYIN_VOCAB_SNAPSHOT: string[] = ${JSON.stringify(vocabTerms, null, 4).replace(/\n/g, '\n')};

/** [拼音全拼, 中文术语]，已按拼音长度降序 */
export const PINYIN_ALIASES: Array<[string, string]> = ${JSON.stringify(aliases, null, 4)};
`;

fs.writeFileSync(OUT, header, 'utf8');

console.log(`[gen-pinyin-vocab] 词条 ${vocabTerms.length} 个 → 别名 ${aliases.length} 条`);
if (dropped.length) {
  console.log(`[gen-pinyin-vocab] 同音冲突弃用 ${dropped.length} 组：`);
  for (const [py, terms] of dropped) console.log(`  ${py} ← ${terms.join(' / ')}`);
}
console.log(`[gen-pinyin-vocab] 输出 ${path.relative(ROOT, OUT)}`);
