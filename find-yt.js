import * as cheerio from 'cheerio';

async function main() {
    const res = await fetch('https://www.youngjaecomputer.com/');
    const html = await res.text();
    const $ = cheerio.load(html);

    const ytLinks = [];
    $('a[href*="youtube.com"]').each((i, el) => {
        ytLinks.push($(el).attr('href'));
    });

    console.log([...new Set(ytLinks)]);
}

main();
