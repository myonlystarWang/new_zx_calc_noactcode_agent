import fs from 'fs';

function findContent(filename) {
    const html = fs.readFileSync(`scripts/data_lake/${filename}`, 'utf8');
    console.log(`=== ${filename} ===`);
    const mainPos = html.indexOf('class="mu-main"');
    if (mainPos !== -1) {
        console.log(html.slice(mainPos, mainPos + 1800));
    } else {
        const bodyPos = html.indexOf('<body');
        console.log(html.slice(bodyPos, bodyPos + 1800));
    }
}

findContent('newtianyuan.html');
findContent('ylmn.html');
