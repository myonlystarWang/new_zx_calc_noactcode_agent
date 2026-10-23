/**
 * 从诛仙3 客户端本地数据生成开服雷达的区服清单
 *
 * 数据源：
 *   D:/PGP/games/诛仙/element/userdata/server/serverlist.txt   (UTF-16LE，含全部战区/服务器/四线路)
 *   开服时间：官网「新服预约礼」页面人工核对（见 NEW_SERVER_OPEN_AT）
 *
 * 产物：
 *   web_app/public/game_data/server_list.json      —— 数组结构保持兼容（DataService / L1 夹具读取）
 *   web_app/src/data/serverList.generated.ts       —— 雷达页同步渲染用（免 fetch 闪烁）
 *
 * 用法：node scripts/build_server_list.mjs [--game-dir <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_GAME_DIR = 'D:/PGP/games/诛仙/element/userdata/server';

const argIdx = process.argv.indexOf('--game-dir');
const GAME_DIR = argIdx > -1 ? process.argv[argIdx + 1] : DEFAULT_GAME_DIR;

/** 官方开服时间（北京时间）。来源：官网「新服预约礼」net/251230server 页面与开服公告 */
const NEW_SERVER_OPEN_AT = {
    小池镇: '2026-10-23T12:00:00+08:00',
    流波山: '2026-09-19T12:00:00+08:00',
    朝阳峰: '2026-08-07T12:00:00+08:00',
    无情海: '2026-07-03T12:00:00+08:00',
    滴血洞: '2026-05-22T12:00:00+08:00',
    剑啸青锋: '2026-04-10T12:00:00+08:00',
    小竹峰: '2026-03-13T12:00:00+08:00',
    掣马凌霄: '2026-02-06T12:00:00+08:00',
};

/** 「新服推荐」收录窗口（天）：官网新服页只保留近一年的批次 */
const NEW_WINDOW_DAYS = 365;
/** 卡面「新」角标窗口（天）：90 天内的才算视觉上的新服 */
const BADGE_WINDOW_DAYS = 90;

/** 客户端 serverlist.txt 没有体验服，单独补 */
const EXTRA_ZONES = [
    {
        zhanQu: '体验服',
        servers: [{ name: '先知', server: 'xianzhi', serverId: '10086', aliases: [] }],
    },
];

const PAREN = /（([^）]+)）/;

function parseServerList(file) {
    const text = fs.readFileSync(file, 'utf16le').replace(/^\uFEFF/, '');
    const raw = text.split(/\r?\n/).map(s => s.replace(/\u0000/g, '').trim()).filter(Boolean);

    const zones = [];
    let cur = null;

    for (const line of raw) {
        if (!line.includes('\t')) {
            cur = { zhanQu: line, servers: [] };
            zones.push(cur);
            continue;
        }
        if (!cur) continue;

        const cols = line.split('\t').map(s => s.trim());
        const name = cols[0];
        // 部分行（如「碧瑶(电信)」）第一个字段后多一个空 tab，按内容定位线路列
        const routes = cols.find(c => c.includes('link.zhuxian.com.cn')) || cols[1] || '';
        const serverId = [...cols].reverse().find(c => /^\d+$/.test(c)) || '';

        const tail = routes.split('*').pop() || '';
        const host = tail.split(':')[1] || '';
        if (!host) continue;

        // 同一物理入口有 4 条线路：<base>.link…（电信主）/ dx / wt / yd，去掉线路后缀归并为一台
        const base = host
            .replace(/\.link\.zhuxian\.com\.cn$/, '')
            .replace(/(dx|wt|yd)$/, '');

        // 「小池镇（新）」这类括号后缀是客户端对新区批次的标注，卡片上由「新」角标替代
        const cleanName = name.replace(/（新）$/, '');

        let entry = cur.servers.find(s => s.server === base);
        if (!entry) {
            entry = { name: cleanName, server: base, serverId, aliases: [] };
            cur.servers.push(entry);
        }
        if (!entry.serverId && serverId) entry.serverId = serverId;
        if (!entry.aliases.includes(cleanName)) entry.aliases.push(cleanName);
    }
    return zones;
}

function decorate(zones, today) {
    for (const zone of zones) {
        for (const srv of zone.servers) {
            // aliases 第一位是主名；后续是合服前的子服名
            if (srv.aliases[0] !== srv.name) srv.aliases = [srv.name, ...srv.aliases.filter(n => n !== srv.name)];
            srv.mergedNames = srv.aliases.slice(1).map(n => {
                const m = n.match(PAREN);
                return m ? m[1] : n;
            });

            const baseOnly = srv.name.replace(/（.*?）/g, '');
            const openAt = NEW_SERVER_OPEN_AT[baseOnly] || NEW_SERVER_OPEN_AT[srv.name] || null;
            srv.openAt = openAt;
            const ageDays = openAt ? (today - new Date(openAt)) / 86400000 : null;
            srv.ageDays = ageDays === null ? null : Math.floor(ageDays);
            srv.isNew = ageDays !== null && ageDays <= NEW_WINDOW_DAYS;
            srv.showNewBadge = ageDays !== null && ageDays <= BADGE_WINDOW_DAYS;
        }
    }
    return zones;
}

function main() {
    const listFile = path.join(GAME_DIR, 'serverlist.txt');
    if (!fs.existsSync(listFile)) {
        console.error(`找不到 ${listFile}`);
        process.exit(1);
    }

    const today = new Date();
    const zones = decorate([...EXTRA_ZONES, ...parseServerList(listFile)], today)
        .filter(z => z.servers.length > 0);

    const payload = zones.map(z => ({
        zhanQu: z.zhanQu,
        servers: z.servers.map(s => ({
            name: s.name,
            server: s.server,
            serverId: s.serverId,
            aliases: s.aliases,
            openAt: s.openAt,
            isNew: s.isNew,
        })),
    }));

    const totalServers = payload.reduce((a, z) => a + z.servers.length, 0);
    const newCnt = payload.reduce((a, z) => a + z.servers.filter(s => s.isNew).length, 0);

    // 1) 公共数据（保持数组结构，L1 / DataService 兼容）
    const jsonOut = path.join(ROOT, 'web_app/public/game_data/server_list.json');
    fs.writeFileSync(jsonOut, JSON.stringify(payload, null, 2), 'utf8');

    // 2) 雷达页同步常量
    const tsOut = path.join(ROOT, 'web_app/src/data/serverList.generated.ts');
    const ts = `/* 自动生成，勿手改。重新生成：node scripts/build_server_list.mjs */
export interface RadarServer {
    /** 主显示名（合服后的大服名） */
    name: string;
    /** 探测用子域：<server>.link.zhuxian.com.cn:29000 */
    server: string;
    serverId: string;
    /** 全部显示名，[0] 为主名，其余为合服前子服名 */
    aliases: string[];
    /** 官方开服时间 ISO 字符串，无数据为 null */
    openAt: string | null;
    /** 开服是否在一年内（进入「新服推荐」） */
    isNew: boolean;
}

export interface RadarZone {
    zhanQu: string;
    servers: RadarServer[];
}

export const SERVER_ZONES: RadarZone[] = ${JSON.stringify(payload, null, 4)};

export const SERVER_TOTAL = ${totalServers};
export const NEW_SERVER_TOTAL = ${newCnt};
`;
    fs.writeFileSync(tsOut, ts, 'utf8');

    console.log(`战区 ${payload.length} 个 / 服务器 ${totalServers} 台 / 新服 ${newCnt} 台`);
    for (const z of payload) {
        const names = z.servers.map(s => (s.aliases.length > 1 ? `${s.name}(+${s.aliases.length - 1})` : s.name));
        console.log(`  ${z.zhanQu}  ${z.servers.length}: ${names.join(' ')}`);
    }
    console.log(`\n→ ${path.relative(ROOT, jsonOut)}`);
    console.log(`→ ${path.relative(ROOT, tsOut)}`);
}

main();
