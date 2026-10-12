import fs from 'fs';

const html = fs.readFileSync('scripts/data_lake/xuanyuance.html', 'utf8');
const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/g)].map(x => x[0]);
for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].includes('xyc_') || scripts[i].includes('青龙') || scripts[i].includes('白虎') || scripts[i].includes('玄武') || scripts[i].includes('朱雀')) {
        console.log(`Script ${i}:`);
        console.log(scripts[i]);
    }
}
