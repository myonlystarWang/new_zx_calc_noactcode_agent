import fs from 'fs';

const html = fs.readFileSync('scripts/data_lake/newtianyuan.html', 'utf8');
const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/g)].map(x => x[0]);
// find script with data
for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].includes('computedGroups') || scripts[i].includes('currentLevel') || scripts[i].includes('groups')) {
        console.log(`Script ${i}:`);
        console.log(scripts[i].slice(0, 1500));
    }
}
