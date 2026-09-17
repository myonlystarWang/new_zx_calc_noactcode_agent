// 调试：复现 WorkBuddy/豆包 客户端握手流程，打印原始响应
import { spawn } from 'node:child_process';

const child = spawn(
  'C:/Users/ww/.workbuddy/binaries/node/versions/22.22.2-3/node.exe',
  ['D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/agent_tool/build/mcp_server.mjs'],
  { stdio: ['pipe', 'pipe', 'pipe'] }
);

let out = '';
child.stdout.on('data', (d) => { out += d.toString(); });
child.stderr.on('data', (d) => console.error('[stderr]', d.toString().trim()));

const send = (msg) => {
  const s = JSON.stringify(msg);
  console.log('>>> ' + s.slice(0, 120));
  child.stdin.write(s + '\n');
};

// 模拟新版客户端：请求 2025-06-18 协议版本（观察服务端回什么）
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'debug-client', version: '1.0' } } });
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({ jsonrpc: '2.0', id: 3, method: 'ping' });

setTimeout(() => {
  child.kill();
  console.log('=== RAW STDOUT ===');
  console.log(out || '(empty)');
  for (const line of out.split('\n').filter(Boolean)) {
    try {
      const m = JSON.parse(line);
      if (m.id === 2) console.log('tools/list result keys: ' + JSON.stringify(Object.keys(m.result || {})) + ', tool count: ' + ((m.result || {}).tools || []).length);
      if (m.id === 1) console.log('initialize protocolVersion returned: ' + (m.result || {}).protocolVersion);
      if (m.error) console.log('ERROR RESPONSE: ' + line);
    } catch (e) { console.log('UNPARSEABLE LINE: ' + line.slice(0, 200)); }
  }
}, 2500);
