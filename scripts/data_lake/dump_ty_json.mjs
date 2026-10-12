import fs from 'fs';

const html = fs.readFileSync('scripts/data_lake/newtianyuan.html', 'utf8');
const match = html.match(/const INIT_LOGIC=(\{[\s\S]*?\});const/);
if (match) {
    fs.writeFileSync('web_app/public/game_data/new_tianyuan_data.json', match[1], 'utf8');
    console.log('Saved new_tianyuan_data.json successfully!');
} else {
    console.error('Failed to match INIT_LOGIC');
}
