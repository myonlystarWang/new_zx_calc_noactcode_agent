import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { calculateFromInput } from './engine.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = resolve(root, 'zx_analysis_results/独白_魔_含瑛');

const PROFILE = resolve(dir, 'profile.json');
const DELTAS = [
  { attr: 'health', delta: 20000, label: '气血 +2w' },
  { attr: 'mana', delta: 40000, label: '真气 +4w' },
  { attr: 'minAttack', delta: -3000, label: '最小攻击 -3000' },
  { attr: 'maxAttack', delta: -3000, label: '最大攻击 -3000' },
  { attr: 'critDamage', delta: -4, label: '爆伤 -4' }
] as const;

const WAN = 10000;

const round = (v: number, d = 2) => Number(v.toFixed(d));

async function main() {
  const text = await readFile(PROFILE, 'utf8');
  const base: any = JSON.parse(text.replace(/^\uFEFF/, ''));
  const usage: Record<string, number> = base.skillUsage || {};
  console.error('USAGE_KEYS', JSON.stringify(usage));

  const modified: any = structuredClone(base);
  for (const { attr, delta } of DELTAS) {
    modified.attributes[attr] = base.attributes[attr] + delta;
  }

  const baseRes = await calculateFromInput(base);
  const modRes = await calculateFromInput(modified);
  if (!baseRes.ok || !modRes.ok) {
    console.error('CALC FAILED', JSON.stringify({ base: baseRes, mod: modRes }, null, 2));
    process.exit(1);
  }

  const baseBoss = (baseRes as any).bosses[0];
  const modBoss = (modRes as any).bosses[0];

  const baseMap = new Map(baseBoss.skills.map((s: any) => [s.skillId, s]));

  // weighted total using profile.skillUsage shares (long-axis combat scenario)
  const rows: any[] = [];
  let baseWeighted = 0;
  let modWeighted = 0;
  let baseRawTotal = 0;
  let modRawTotal = 0;

  for (const s of modBoss.skills) {
    const b = baseMap.get(s.skillId);
    const bAvg = b ? b.avgFinalDamage : 0;
    const mAvg = s.avgFinalDamage;
    const share = Number((usage[s.skillId] && (usage[s.skillId] as any).damageShare) ?? 0);
    baseWeighted += bAvg * share;
    modWeighted += mAvg * share;
    baseRawTotal += bAvg;
    modRawTotal += mAvg;
    rows.push({
      skillId: s.skillId,
      skillName: s.skillName,
      baseAvg: Math.round(bAvg),
      modAvg: Math.round(mAvg),
      deltaAvg: Math.round(mAvg - bAvg),
      deltaAvgWan: round((mAvg - bAvg) / WAN, 3),
      sharePct: round(share * 100, 2)
    });
  }

  const out = {
    ok: true,
    playerName: base.playerName,
    className: base.className,
    factionName: base.factionName,
    dungeon: base.target?.dungeon,
    bossIndex: base.target?.bossIndex,
    deltas: DELTAS.map((d) => ({ attr: d.attr, label: d.label, delta: d.delta, base: base.attributes[d.attr], modified: modified.attributes[d.attr] })),
    baseAttributes: base.attributes,
    modifiedAttributes: modified.attributes,
    summary: {
      baseWeightedTotal: Math.round(baseWeighted),
      modWeightedTotal: Math.round(modWeighted),
      weightedDelta: Math.round(modWeighted - baseWeighted),
      weightedDeltaWan: round((modWeighted - baseWeighted) / WAN, 3),
      weightedDeltaPct: round(((modWeighted - baseWeighted) / baseWeighted) * 100, 4),
      baseRawTotal: Math.round(baseRawTotal),
      modRawTotal: Math.round(modRawTotal),
      rawDelta: Math.round(modRawTotal - baseRawTotal),
      rawDeltaWan: round((modRawTotal - baseRawTotal) / WAN, 3)
    },
    rows
  };

  await writeFile(resolve(dir, 'modified_profile.json'), JSON.stringify(modified, null, 2), 'utf8');
  await writeFile(resolve(dir, 'modified_calc.json'), JSON.stringify(modRes, null, 2), 'utf8');
  await writeFile(resolve(dir, 'compare_result.json'), JSON.stringify(out, null, 2), 'utf8');

  console.log(JSON.stringify(out, null, 2));
}

await main();
