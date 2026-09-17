// 验证 zx_calc_profile 全链路：存档案 → 一键算 → 删档案还原
import { spawn } from 'node:child_process';

const child = spawn(
  'C:/Users/ww/.workbuddy/binaries/node/versions/22.22.2-3/node.exe',
  ['D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool/build/mcp_server.mjs'],
  { stdio: ['pipe', 'pipe', 'pipe'] }
);

let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});
child.stderr.on('data', (d) => console.error('[stderr]', d.toString().trim()));

let nextId = 1;
const pending = new Map();
function call(method, params) {
  return new Promise((res) => {
    const id = nextId++;
    pending.set(id, res);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notify(method) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
}

const results = [];
(async () => {
  await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  notify('notifications/initialized');

  const list = await call('tools/list', {});
  results.push(['tools/list count', list.result.tools.length, list.result.tools.map((t) => t.name).join(',')]);

  // 存一个最小档案（复用 examples 样例属性）
  const fs = await import('node:fs');
  const ex = JSON.parse(fs.readFileSync('D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool/examples/zhu_shuang_mo_t21_boss1.json', 'utf8'));
  const save = await call('tools/call', { name: 'zx_record', arguments: { action: 'save', name: '__test_profile__', profile: ex } });
  results.push(['zx_record save', JSON.parse(save.result.content[0].text).ok]);

  const calc = await call('tools/call', { name: 'zx_calc_profile', arguments: { profileName: '__test_profile__' } });
  const calcBody = JSON.parse(calc.result.content[0].text);
  results.push(['zx_calc_profile ok', calcBody.ok, 'skills: ' + (calcBody.skills ? calcBody.skills.length : JSON.stringify(calcBody).slice(0, 120))]);

  const bad = await call('tools/call', { name: 'zx_calc_profile', arguments: { profileName: '不存在' } });
  const badBody = JSON.parse(bad.result.content[0].text);
  results.push(['missing profile error', badBody.ok === false, 'available=' + JSON.stringify(badBody.available)]);

  const del = await call('tools/call', { name: 'zx_record', arguments: { action: 'delete', name: '__test_profile__' } });
  results.push(['cleanup delete', JSON.parse(del.result.content[0].text).ok]);

  child.kill();
  let pass = 0;
  for (const [name, ...checks] of results) {
    const ok = checks.slice(0, -1).every((c) => c === true || c === undefined) && checks[0] !== false;
    if (ok) pass++;
    console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + checks.filter((c) => typeof c === 'string').join(' | '));
  }
  console.log(pass + '/' + results.length + ' passed');
  process.exit(0);
})();
