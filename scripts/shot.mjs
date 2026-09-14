import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outDir = path.resolve(process.argv[2]);
const outFile = path.join(outDir, process.argv[3]);
const size = process.argv[4] ?? '1728,1000';
const url = process.argv[5] ?? 'http://localhost:5199/';

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(path.join(outDir, 'profile'), { recursive: true, force: true });

const args = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  `--user-data-dir=${path.join(outDir, 'profile')}`,
  `--window-size=${size}`,
  '--virtual-time-budget=12000',
  `--screenshot=${outFile}`,
  url,
];

const r = spawnSync(CHROME, args, { stdio: 'inherit', timeout: 120000 });
console.log('exitCode=', r.status, 'signal=', r.signal);
console.log('exists=', fs.existsSync(outFile), 'size=', fs.existsSync(outFile) ? fs.statSync(outFile).size : 0);
