import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

export const dynamic = 'force-dynamic';

const parser = new Parser({
    customFields: {
        item: [
            ['media:group', 'mediaGroup']
        ]
    }
});
// Using YoungJaeComputer's channel ID if we know it, or try handle via a proxy/rss generator if needed
// Actually, standard YouTube RSS: https://www.youtube.com/feeds/videos.xml?channel_id=UC...
// Or for standard @handle (sometimes works with rss if resolved): 
const YOUTUBE_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCaOwfLJxMjZ8RCBwg8_c90A';

export async function GET(request) {
    try {
        // 1. Fetch YouTube RSS Feed
        // For now we will mock the YouTube fetch if RSS fails or we don't have the right channel ID yet.
        // Let's implement the skeleton first

        // We'll need to fetch the RSS feed
        const feed = await parser.parseURL(YOUTUBE_RSS_URL);

        // Fetch more videos initially because we might filter some out (the ones without prices)
        const latestVideos = feed.items.slice(0, 10);

        const results = [];

        for (const video of latestVideos) {
            // Stop processing if we already have 4 valid items
            if (results.length >= 4) break;
            // 2. Extract product URL from the video description
            // In RSS, the description is video.content or video.contentSnippet
            let description = "";
            if (video.mediaGroup && video.mediaGroup['media:description'] && video.mediaGroup['media:description'][0]) {
                description = video.mediaGroup['media:description'][0];
            }

            // Match the youngjaecomputer URL in the description
            const urlMatch = description.match(/https?:\/\/(?:www\.)?youngjaecomputer\.com\/[^\s]+/i);
            let productLink = urlMatch ? urlMatch[0] : null;

            let productTitle = "Product Title Not Found";
            let productPrice = "홈페이지 참조";
            let productImage = "";

            if (productLink) {
                // 3. Scrape the product page for Title, Price, and Top Image
                try {
                    const productRes = await fetch(productLink);
                    if (productRes.ok) {
                        const html = await productRes.text();
                        const $ = cheerio.load(html);

                        // Assuming Gnuboard/YoungCart structure:
                        // The title is usually in a specific header or meta tag
                        productTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
                        productImage = $('meta[property="og:image"]').attr('content') || '';

                        // Price is typically in an element with class sit_opt_prc or similar
                        // We'll try to find a strong tag with a price or a specific ID
                        // We may need to inspect the actual product page HTML to refine selectors
                        let priceText = $('#_it_price').text() || $('#r_1set_price').text() || $('#sit_tot_price').text() || $('.sit_opt_prc').text() || '';
                        if (priceText) {
                            productPrice = priceText.trim();
                        }
                    }
                } catch (e) {
                    console.error("Failed to scrape product page:", productLink, e);
                }
            }

            // Only push to results if we found a valid price (meaning it's a real product item page)
            if (productPrice !== "Price Not Found" && productPrice !== "홈페이지 참조" && productPrice !== "") {
                results.push({
                    videoId: video.id.replace('yt:video:', ''), // extract ID from yt:video:ID
                    title: video.title,
                    link: video.link,
                    productLink,
                    productTitle,
                    productPrice,
                    productImage
                });
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // CORS Headers to allow the admin page to request this data
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
            },
        });

    } catch (error) {
        console.error('Error fetching latest shorts:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function OPTIONS(request) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
