#!/usr/bin/env node
/**
 * L1 golden 快照新鲜度闸门（B 方案）
 *
 * 用途：改过 `web_app/public/game_data/*.json` 却没重跑 golden 时，提前报出来，
 * 避免再出现「47 条 FAIL 到底是回归还是快照过期」这种要花半小时归因的情况。
 *
 * 用法：
 *   node scripts/check_l1_fresh.mjs              # 检查；不一致 → 明细 + exit 1
 *   node scripts/check_l1_fresh.mjs --warn-only  # 不一致只告警，exit 0（用于 predev）
 *   node scripts/check_l1_fresh.mjs --quiet      # 通过时静默（默认就静默，保留兼容）
 *   node scripts/check_l1_fresh.mjs --write      # 手动重建基线（正常应由 --golden 自动写）
 *
 * 临时跳过：环境变量 SKIP_L1_FRESH=1
 *
 * 退出码：0 一致/仅告警/跳过；1 不一致且非 warn-only；2 脚本自身异常
 */
import fs from 'node:fs';
import { diffAgainstBaseline, writeBaseline, readBaseline, FINGERPRINT_FILE } from './l1_data_fingerprint.mjs';

const argv = process.argv.slice(2);
const WARN_ONLY = argv.includes('--warn-only');
const WRITE = argv.includes('--write');
const SKIP = process.env.SKIP_L1_FRESH === '1' || process.env.SKIP_L1_FRESH === 'true';

const REL = 'regression_test/l1_golden.fingerprint.json';
const FIX_HINT = 'node scripts/l1_intent_fixture.mjs --golden';
const SKIP_HINT = 'SKIP_L1_FRESH=1';

function log(msg) {
    process.stdout.write(`${msg}\n`);
}

if (SKIP) {
    process.exit(0);
}

try {
    if (WRITE) {
        const p = writeBaseline();
        log(`[L1 闸门] 基线已写入 ${REL}（${p.fileCount} 个文件，digest ${p.digest}）`);
        process.exit(0);
    }

    const d = diffAgainstBaseline();

    if (d.missingBaseline) {
        log(`[L1 闸门] 缺少基线文件 ${REL}`);
        log(`  → 首次使用请跑：${FIX_HINT}（或在确认 golden 与数据一致后跑 node scripts/check_l1_fresh.mjs --write）`);
        log(`  → 临时跳过：${SKIP_HINT}=1`);
        process.exit(WARN_ONLY ? 0 : 1);
    }

    if (d.same) {
        if (!argv.includes('--quiet')) { /* 通过时静默，不刷屏 */ }
        process.exit(0);
    }

    const lines = [];
    lines.push('[L1 闸门] game_data 已变更，但 L1 golden 快照没有重跑');
    lines.push(`  基线 ${REL}（digest ${d.baselineDigest}）→ 当前 digest ${d.currentDigest}`);
    if (d.changed.length) {
        lines.push(`  内容变更 ${d.changed.length} 个：`);
        for (const c of d.changed.slice(0, 12)) lines.push(`    ~ ${c.name}  ${c.from} -> ${c.to}`);
        if (d.changed.length > 12) lines.push(`    ... 另 ${d.changed.length - 12} 个`);
    }
    if (d.added.length) lines.push(`  新增 ${d.added.length} 个：${d.added.slice(0, 8).join(', ')}${d.added.length > 8 ? ' ...' : ''}`);
    if (d.removed.length) lines.push(`  删除 ${d.removed.length} 个：${d.removed.slice(0, 8).join(', ')}${d.removed.length > 8 ? ' ...' : ''}`);
    lines.push('');
    lines.push('  影响：golden 里存在大量 cardData 数据回波，数据一动就会大面积对不上（2026-10-27 的 47 条 FAIL 即此）。');
    lines.push(`  修复：${FIX_HINT}   # 重建后请逐条确认差异是「预期口径变更」而非 bug`);
    lines.push(`  排查：${FIX_HINT.replace(' --golden', ' --verbose > /tmp/l1.log')} && node scripts/l1_golden_diff.mjs /tmp/l1.log`);
    lines.push(`  临时跳过：${SKIP_HINT}=1`);

    log(lines.join('\n'));

    if (WARN_ONLY) {
        log('  （--warn-only：仅告警，不阻塞）');
        process.exit(0);
    }
    process.exit(1);
} catch (err) {
    log(`[L1 闸门] 检查异常：${err?.stack || err}`);
    process.exit(2);
}
