async function check() {
    const res = await fetch('https://www.mujiston.com/zhuxian/');
    const text = await res.text();
    const regex = /href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    const links = [];
    while ((match = regex.exec(text)) !== null) {
        links.push({ url: match[1], title: match[2].trim() });
    }
    console.log(links);
}
check();
