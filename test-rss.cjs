const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
        item: [
            ['media:group', 'mediaGroup']
        ]
    }
});

async function main() {
    const feed = await parser.parseURL('https://www.youtube.com/feeds/videos.xml?channel_id=UCaOwfLJxMjZ8RCBwg8_c90A');
    const latest = feed.items[0];
    console.log('Latest item:', JSON.stringify(latest, null, 2));
}

main();
