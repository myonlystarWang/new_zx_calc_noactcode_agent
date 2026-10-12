import fs from 'fs';

function inspect() {
    const xycHtml = fs.readFileSync('scripts/data_lake/xuanyuance.html', 'utf8');
    const tyHtml = fs.readFileSync('scripts/data_lake/newtianyuan.html', 'utf8');
    const ylHtml = fs.readFileSync('scripts/data_lake/ylmn.html', 'utf8');

    console.log('=== XUANYUANCE ===');
    const xycPos = xycHtml.indexOf('xyc_books');
    if (xycPos !== -1) {
        console.log(xycHtml.slice(xycPos, xycPos + 1200));
    }

    console.log('=== NEWTIANYUAN ===');
    const tyPos = tyHtml.indexOf('<body');
    if (tyPos !== -1) {
        const tablePos = tyHtml.indexOf('<table', tyPos);
        console.log(tyHtml.slice(tablePos, tablePos + 1200));
    }

    console.log('=== YLMN ===');
    const ylPos = ylHtml.indexOf('<body');
    if (ylPos !== -1) {
        const tablePos = ylHtml.indexOf('<table', ylPos);
        console.log(ylHtml.slice(tablePos, tablePos + 1200));
    }
}

inspect();
