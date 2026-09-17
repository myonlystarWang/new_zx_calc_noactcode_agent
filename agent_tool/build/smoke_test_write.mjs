import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, copyFileSync, statSync, unlinkSync } from 'node:fs';

const NODE = 'C:/Users/ww/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const SERVER = 'D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool/build/mcp_server.mjs';
const DATA_DIR = 'D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/public/game_data';

const child = spawn(NODE, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
const responses = [];
child.stdout.on('data', (d) => {
  d.toString().split('\n').filter((l) => l.trim()).forEach((l) => {
    try { responses.push(JSON.parse(l)); } catch {}
  });
});
child.stderr.on('data', (d) => process.stderr.write('[server stderr] ' + d));

const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  await wait(100);

  // zx_record save / list / get / delete
  send({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'zx_record', arguments: { action: 'save', name: '冒烟测试', profile: { className: '逐霜', attributes: { minAttack: 1, maxAttack: 2, health: 3, mana: 4, critDamage: 5, monsterDamageIncrease: 6 } } } } });
  send({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'zx_record', arguments: { action: 'list' } } });
  send({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'zx_record', arguments: { action: 'get', name: '冒烟测试' } } });
  send({ jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'zx_record', arguments: { action: 'delete', name: '冒烟测试' } } });

  // zx_edit_data: temporarily bump a buff value, then restore from backup
  send({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'zx_edit_data', arguments: { dataType: 'combat_buffs', key: '专注增益', patch: { DefaultEffectValue: 999999 } } } });

  await wait(800);

  // restore combat_buffs.json from latest backup
  const baks = readdirSync(DATA_DIR).filter((f) => f.startsWith('combat_buffs.json.bak.')).map((f) => ({ f, t: statSync(DATA_DIR + '/' + f).mtimeMs }));
  baks.sort((a, b) => b.t - a.t);
  if (baks.length) {
    copyFileSync(DATA_DIR + '/' + baks[0].f, DATA_DIR + '/combat_buffs.json');
    console.log('RESTORED combat_buffs.json from', baks[0].f);
    unlinkSync(DATA_DIR + '/' + baks[0].f); // remove test backup
  }
  const after = JSON.parse(readFileSync(DATA_DIR + '/combat_buffs.json', 'utf8'));
  const focus = after.find((b) => b.BuffName === '专注增益');
  console.log('focus DefaultEffectValue after restore =', focus?.DefaultEffectValue, '(应为原值，非999999)');

  // print all tool responses
  for (const m of responses) {
    if (!m.result || !m.result.content) { console.log('---', m.id, m.error || ''); continue; }
    console.log('=== resp#' + m.id + (m.result.isError ? ' [ERROR]' : ''));
    console.log('  ' + m.result.content[0].text.slice(0, 500));
  }
  child.kill('SIGTERM');
})();
