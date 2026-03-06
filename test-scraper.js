import * as cheerio from 'cheerio';

async function main() {
    const url = 'https://www.youngjaecomputer.com/shop/item.php?it_id=2772529981';
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);

        // Test different selectors for price
        console.log("sit_tot_price:", $('#sit_tot_price').text().trim());
        console.log(".sit_opt_prc:", $('.sit_opt_prc').text().trim());
        console.log(".prc:", $('.prc').text().trim());
        console.log(".price:", $('.price').text().trim());

        // Let's just dump the HTML around forms or price-looking elements
        console.log("\nLooking for elements containing '원':");
        $('*').each((i, el) => {
            const text = $(el).text().trim();
            if (text.includes('원') && text.length < 20 && $(el).children().length === 0) {
                console.log(`<${el.name} class="${$(el).attr('class') || ''}" id="${$(el).attr('id') || ''}">`, text);
            }
        });

    } catch (e) {
        console.error(e);
    }
}

main();
