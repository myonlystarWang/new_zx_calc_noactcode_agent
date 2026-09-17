import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const NODE = 'C:/Users/ww/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const SERVER = 'D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool/build/mcp_server.mjs';
const example = JSON.parse(readFileSync('D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool/examples/zhu_shuang_mo_t21_boss1.json', 'utf8'));

const child = spawn(NODE, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => process.stderr.write('[server stderr] ' + d));
child.on('close', () => {
  const lines = out.split('\n').filter((l) => l.trim());
  for (const l of lines) {
    try {
      const m = JSON.parse(l);
      const tag = m.method ? m.method : 'resp#' + m.id;
      console.log('=== ' + tag + (m.error ? ' ERROR' : ''));
      if (m.result && m.result.tools) console.log('  tools:', m.result.tools.map((t) => t.name).join(', '));
      else if (m.result && m.result.content) console.log('  ' + m.result.content[0].text.slice(0, 1000));
      else console.log('  ' + JSON.stringify(m.result || m.error || m).slice(0, 500));
    } catch (e) {
      console.log('RAW ' + l.slice(0, 200));
    }
  }
});

const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'zx_calc', arguments: example } });
send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'zx_list_classes' } });
send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'zx_lookup_boss', arguments: { dungeon: 'TIANDI_BAOKU_HARD' } } });

setTimeout(() => child.kill('SIGTERM'), 2000);
