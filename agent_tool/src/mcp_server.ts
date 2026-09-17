/**
 * 诛仙3 伤害计算本地 MCP server（STDIO，零依赖手写协议）
 * 客户端：豆包桌面（STDIO 连接器）/ WorkBuddy（mcp.json）
 * 构建：esbuild 打包成单文件 mjs 后由 node 直接运行。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameData } from './data.js';
import { calculateFromInput } from './engine.js';

const here = dirname(fileURLToPath(import.meta.url));

// 数据目录：环境变量 > 相对解析 > 绝对兜底（本机已知路径）
const KNOWN_DATA_DIR = 'D:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/public/game_data';
const DATA_DIR =
  process.env.ZX_DATA_DIR ||
  resolve(here, '..', '..', 'web_app', 'public', 'game_data');
const RESOLVED_DATA_DIR = existsSync(DATA_DIR) ? DATA_DIR : KNOWN_DATA_DIR;

// 角色档案存储（录入：保存命名档案）
const PROFILES_DIR = resolve(here, '..', 'profiles');
const PROFILES_FILE = resolve(PROFILES_DIR, 'player_profiles.json');

const token = (s: string): string =>
  s.trim().toLowerCase().replace(/[\s_（）()！!·.\-]/g, '');

// ---------- 工具定义 ----------
type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const TOOLS: ToolDef[] = [
  {
    name: 'zx_calc',
    description:
      '计算某职业对某副本 boss 的各技能伤害，一次调用即返回全部结果。' +
      '入参：{ className:"逐霜", factionName:"魔", attributes:{...}, target:{ dungeon:"天帝宝库", bossIndex:1 } }。' +
      'attributes 用中文键：攻击/气血/真气/防御/爆伤/暴击率/对怪增伤。可选 buffs:{ useDefaults:true }。' +
      '调用前若用户给了截图，先复述属性待确认。失败时返回具体错误原因；不要为了一次计算反复检索工具，直接调用即可。',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        className: { type: 'string', description: '职业名，如 逐霜/归云/涅羽/青云/鬼王/青罗' },
        classId: { type: 'string' },
        factionName: { type: 'string', description: '阵营：仙/佛/魔' },
        faction: { type: 'string' },
        attributes: { type: 'object', description: '角色属性，中文键：攻击/气血/真气/防御/爆伤/暴击率/对怪增伤/1%攻击等' },
        buffs: { type: 'object', description: '战斗增益：useDefaults(默认true)、overrides(按名覆盖值)、focus/greenPoint/monsterDamageTaken/witchCurse 简写' },
        target: { type: 'object', description: '目标：dungeon(副本名或T21)、bossId/bossName/bossIndex' },
        attributeCaps: { type: 'object', description: '可选属性上限覆盖' }
      }
    }
  },
  {
    name: 'zx_calc_profile',
    description:
      '用已保存的角色档案一键算伤害（最简单的计算入口）。' +
      '入参仅 { profileName:"津威", dungeon:"天帝宝库", bossIndex:1 }，属性从档案自动读取。' +
      '若不确定档案名，先调 zx_record {action:"list"}。dungeon/bossIndex 不传则用档案里的默认值。',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        profileName: { type: 'string', description: '档案名，如 津威' },
        dungeon: { type: 'string', description: '可选：副本名或 T21 等，覆盖档案默认' },
        bossIndex: { type: 'number', description: '可选：第几个 boss（1 起）' },
        bossName: { type: 'string', description: '可选：boss 名' }
      }
    }
  },
  {
    name: 'zx_lookup_boss',
    description:
      '查询副本与其 boss 信息（怪物减伤、等级等）。输入 { dungeonId|dungeonName|dungeon, bossId|bossName? }。不传 boss 则返回该副本全部 boss 摘要。',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        dungeonId: { type: 'string' },
        dungeonName: { type: 'string' },
        dungeon: { type: 'string' },
        bossId: { type: 'string' },
        bossName: { type: 'string' }
      }
    }
  },
  {
    name: 'zx_lookup_class',
    description:
      '查询职业信息：阵营、属性上限、技能列表。输入 { classId|className, faction? }。',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        classId: { type: 'string' },
        className: { type: 'string' },
        faction: { type: 'string', description: '可选：仙/佛/魔，限定技能表' }
      }
    }
  },
  {
    name: 'zx_list_dungeons',
    description: '枚举全部副本（DungeonID / 名称），帮 agent 定位副本名称。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'zx_list_classes',
    description: '枚举全部职业（ClassID / 名称 / 定位类型），帮 agent 定位职业名称。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'zx_record',
    description:
      '录入/读取命名角色档案（保存后可被 zx_calc 复用，无需每次贴属性）。输入 { action: "save"|"get"|"list"|"delete", name, profile? }。' +
      'save 时 profile 至少含 className + attributes；可含 factionName/buffs/target 作为默认。档案存于 agent_tool/profiles/player_profiles.json。',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        action: { type: 'string', description: 'save | get | list | delete' },
        name: { type: 'string', description: '档案名，如 津威' },
        profile: { type: 'object', description: 'save 时的角色数据（AgentCalcInput 子集）' }
      }
    }
  },
  {
    name: 'zx_edit_data',
    description:
      '编辑游戏数据 JSON（作者向维护）。输入 { dataType, key, subKey?, patch }。dataType ∈ classes|skills|dungeons|dungeons_monsters|combat_buffs。' +
      'key 定位条目（ClassID/ClassName/DungeonID/SkillID/MonsterID/BuffID），subKey 用于 skills/dungeons_monsters 的二级定位（先 key 找副本/职业，再 subKey 找技能/boss）。' +
      'patch 为浅合并到该条目的字段对象。写入前自动时间戳备份原文件。',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        dataType: { type: 'string', description: 'classes | skills | dungeons | dungeons_monsters | combat_buffs' },
        key: { type: 'string', description: '一级定位键（ID 或名称）' },
        subKey: { type: 'string', description: '可选二级定位键（skills/dungeons_monsters 用）' },
        patch: { type: 'object', description: '要合并进目标条目的字段' }
      }
    }
  }
];

// ---------- 帮助：读 game_data ----------
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

// ---------- 处理器 ----------
async function handleTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  try {
    switch (name) {
      case 'zx_calc': {
        const result = await calculateFromInput(args as any, RESOLVED_DATA_DIR);
        return { text: JSON.stringify(result, null, 2), isError: !result.ok };
      }
      case 'zx_calc_profile': {
        const profileName = args.profileName as string | undefined;
        if (!profileName) return { text: JSON.stringify({ ok: false, error: '需要 profileName' }), isError: true };
        const store: Record<string, any> = existsSync(PROFILES_FILE) ? readJson(PROFILES_FILE) : {};
        const profile = store[profileName];
        if (!profile) {
          return {
            text: JSON.stringify({ ok: false, error: '档案不存在: ' + profileName, available: Object.keys(store), hint: '先用 zx_record {action:"save"} 保存档案' }),
            isError: true
          };
        }
        const targetOverride: Record<string, unknown> = { ...(profile.target || {}) };
        if (args.dungeon) targetOverride.dungeon = args.dungeon;
        if (args.bossIndex != null) targetOverride.bossIndex = args.bossIndex;
        if (args.bossName) targetOverride.bossName = args.bossName;
        const input = { ...profile, target: targetOverride };
        const result = await calculateFromInput(input as any, RESOLVED_DATA_DIR);
        return { text: JSON.stringify(result, null, 2), isError: !result.ok };
      }
      case 'zx_lookup_boss': {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        const raw = (args.dungeonId || args.dungeonName || args.dungeon) as string | undefined;
        const dungeon = data.dungeons.find(
          (d) => token(d.DungeonID) === token(raw ?? '') || token(d.DungeonName).includes(token(raw ?? '')) || token(raw ?? '').includes(token(d.DungeonName))
        );
        if (!dungeon) return { text: JSON.stringify({ ok: false, error: '未知副本: ' + raw }), isError: true };
        const monsters = data.monstersByDungeon[dungeon.DungeonID] || [];
        const bossRaw = (args.bossId || args.bossName) as string | undefined;
        const list = bossRaw
          ? monsters.filter((m) => token(m.MonsterID) === token(bossRaw!) || token(m.MonsterName).includes(token(bossRaw!)))
          : monsters;
        const summary = list.map((m) => ({
          monsterId: m.MonsterID,
          monsterName: m.MonsterName,
          dungeonLevel: m.DungeonLevel,
          monsterAttributeModifiers: m.MonsterAttributeModifiers
        }));
        return { text: JSON.stringify({ ok: true, dungeonId: dungeon.DungeonID, dungeonName: dungeon.DungeonName, bossCount: monsters.length, bosses: summary }, null, 2), isError: false };
      }
      case 'zx_lookup_class': {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        const raw = (args.classId || args.className) as string | undefined;
        const cls = data.classes.find(
          (c) => token(c.ClassID) === token(raw ?? '') || token(c.ClassName) === token(raw ?? '') || token(c.ClassName).includes(token(raw ?? ''))
        );
        if (!cls) return { text: JSON.stringify({ ok: false, error: '未知职业: ' + raw }), isError: true };
        const skills = (data.skills[cls.ClassID] || []).map((s) => ({ skillId: s.SkillID, skillName: s.SkillName, actionType: s.ActionType }));
        return {
          text: JSON.stringify(
            { ok: true, classId: cls.ClassID, className: cls.ClassName, roleType: (cls as any).RoleType, capHealth: (cls as any).CapHealth, capMana: (cls as any).CapMana, skillCount: skills.length, skills },
            null,
            2
          ),
          isError: false
        };
      }
      case 'zx_list_dungeons': {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        return { text: JSON.stringify({ ok: true, dungeons: data.dungeons.map((d) => ({ dungeonId: d.DungeonID, dungeonName: d.DungeonName })) }, null, 2), isError: false };
      }
      case 'zx_list_classes': {
        const data = await loadGameData(RESOLVED_DATA_DIR);
        return { text: JSON.stringify({ ok: true, classes: data.classes.map((c) => ({ classId: c.ClassID, className: c.ClassName, roleType: (c as any).RoleType })) }, null, 2), isError: false };
      }
      case 'zx_record': {
        const action = args.action as string;
        const name = args.name as string | undefined;
        let store: Record<string, unknown> = {};
        if (existsSync(PROFILES_FILE)) store = readJson(PROFILES_FILE);
        if (action === 'list') return { text: JSON.stringify({ ok: true, names: Object.keys(store) }, null, 2), isError: false };
        if (!name) return { text: JSON.stringify({ ok: false, error: 'zx_record 需要 name' }), isError: true };
        if (action === 'get') {
          if (!(name in store)) return { text: JSON.stringify({ ok: false, error: '档案不存在: ' + name }), isError: true };
          return { text: JSON.stringify({ ok: true, name, profile: store[name] }, null, 2), isError: false };
        }
        if (action === 'delete') {
          delete store[name];
          if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
          writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), 'utf8');
          return { text: JSON.stringify({ ok: true, deleted: name, remaining: Object.keys(store) }, null, 2), isError: false };
        }
        if (action === 'save') {
          const profile = args.profile as Record<string, unknown> | undefined;
          if (!profile || !profile.className || !(profile.attributes as object)) {
            return { text: JSON.stringify({ ok: false, error: 'save 需要 profile{ className, attributes }' }), isError: true };
          }
          store[name] = profile;
          if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
          writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), 'utf8');
          return { text: JSON.stringify({ ok: true, saved: name, profile }), isError: false };
        }
        return { text: JSON.stringify({ ok: false, error: '未知 action: ' + action }), isError: true };
      }
      case 'zx_edit_data': {
        const dataType = args.dataType as string;
        const key = args.key as string | undefined;
        const subKey = args.subKey as string | undefined;
        const patch = args.patch as Record<string, unknown> | undefined;
        const fileMap: Record<string, string> = {
          classes: 'classes.json',
          skills: 'skills.json',
          dungeons: 'dungeons.json',
          dungeons_monsters: 'dungeons_monsters.json',
          combat_buffs: 'combat_buffs.json'
        };
        const fname = fileMap[dataType];
        if (!fname) return { text: JSON.stringify({ ok: false, error: '未知 dataType: ' + dataType }), isError: true };
        if (!key) return { text: JSON.stringify({ ok: false, error: 'zx_edit_data 需要 key' }), isError: true };
        if (!patch || typeof patch !== 'object') return { text: JSON.stringify({ ok: false, error: 'zx_edit_data 需要 patch 对象' }), isError: true };

        const filePath = resolve(RESOLVED_DATA_DIR, fname);
        const raw = readJson<any>(filePath);

        let entry: any;
        if (Array.isArray(raw)) {
          entry = raw.find((e) => token(e.ID ?? e.ClassID ?? e.DungeonID ?? e.BuffID ?? e.MonsterID ?? '') === token(key) || token(e.Name ?? e.ClassName ?? e.DungeonName ?? e.BuffName ?? e.MonsterName ?? '').includes(token(key)));
        } else {
          const parent = raw[key] ?? raw[Object.keys(raw).find((k) => token(k) === token(key)) || ''];
          if (parent == null) return { text: JSON.stringify({ ok: false, error: '未找到 key: ' + key + ' 于 ' + fname }), isError: true };
          if (subKey && Array.isArray(parent)) {
            entry = parent.find((e) => token(e.ID ?? e.SkillID ?? e.MonsterID ?? '') === token(subKey) || token(e.Name ?? e.SkillName ?? e.MonsterName ?? '').includes(token(subKey)));
          } else {
            entry = parent;
          }
        }
        if (!entry) return { text: JSON.stringify({ ok: false, error: '未找到匹配条目 key=' + key + (subKey ? ' subKey=' + subKey : '') }), isError: true };

        Object.assign(entry, patch);
        const backup = resolve(RESOLVED_DATA_DIR, fname + '.bak.' + Date.now());
        copyFileSync(filePath, backup);
        writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');
        return { text: JSON.stringify({ ok: true, file: fname, backup: basename(backup), changed: entry }, null, 2), isError: false };
      }
      default:
        return { text: JSON.stringify({ ok: false, error: '未知工具: ' + name }), isError: true };
    }
  } catch (err) {
    return { text: JSON.stringify({ ok: false, error: 'RUNTIME_ERROR', message: err instanceof Error ? err.message : String(err) }), isError: true };
  }
}

// ---------- STDIO JSON-RPC ----------
const send = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + '\n');

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buf += chunk;
  let idx: number;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) void dispatch(line);
  }
});
process.stdin.on('end', () => process.exit(0));

async function dispatch(line: string) {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method } = msg;
  if (!method) return;
  // 通知（无 id）忽略
  if (method === 'notifications/initialized' || method.startsWith('notifications/')) return;

  if (method === 'initialize') {
    // 回显客户端请求的协议版本：tools 方法在各版本间语义稳定，硬编码旧版本会被严格客户端拒收工具列表
    const clientVersion = (msg.params && msg.params.protocolVersion) as string | undefined;
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: clientVersion || '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'zx-damage-mcp', version: '1.0.0' }
      }
    });
    return;
  }
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = msg.params || {};
    const { text, isError } = await handleTool(name, args || {});
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError } });
    return;
  }
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
}
