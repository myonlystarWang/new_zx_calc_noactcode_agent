import fs from 'fs';

async function inspectTool(urlPath, filename) {
    const url = `https://www.mujiston.com${urlPath}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    const html = await res.text();
    fs.writeFileSync(`scripts/data_lake/${filename}`, html, 'utf8');
    console.log(`Saved ${filename} (${(html.length / 1024).toFixed(1)} KB)`);
}

async function main() {
    await inspectTool('/zhuxian/kaifujiance.html', 'kaifujiance.html');
    await inspectTool('/zhuxian/xuanyuance.html', 'xuanyuance.html');
    await inspectTool('/zhuxian/newtianyuan.html', 'newtianyuan.html');
    await inspectTool('/zhuxian/ylmn.html', 'ylmn.html');
}

main().catch(console.error);
