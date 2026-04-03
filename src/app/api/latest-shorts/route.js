import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

const CHANNEL_ID = 'UCaOwfLJxMjZ8RCBwg8_c90A';

const INNERTUBE_CONTEXT = {
    client: {
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00',
        hl: 'ko',
        gl: 'KR',
    },
};

function decodeHtmlEntities(str) {
    return str
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function getLatestVideoIds() {
    const uploadsPlaylistId = 'UU' + CHANNEL_ID.slice(2);
    const res = await fetchWithTimeout('https://www.youtube.com/youtubei/v1/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            context: INNERTUBE_CONTEXT,
            browseId: 'VL' + uploadsPlaylistId,
        }),
    }, 10000);
    if (!res.ok) throw new Error(`InnerTube browse failed: ${res.status}`);
    const data = await res.json();
    const str = JSON.stringify(data);
    const ids = [...str.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    return [...new Set(ids)].slice(0, 25);
}

async function getVideoInfo(videoId) {
    const res = await fetchWithTimeout(`https://www.youtube.com/shorts/${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        },
    }, 8000);
    if (!res.ok) return null;
    if (!res.url.includes('/shorts/')) return null;

    const html = await res.text();

    const titleMatch = html.match(/<meta(?:\s+[^>]*)?\s+(?:property="og:title"|name="title")\s+content="([^"]+)"/);
    const title = decodeHtmlEntities(titleMatch?.[1] || '');

    let productLink = null;
    const redirectMatch = html.match(/q=(https%3A%2F%2F(?:www\.)?youngjaecomputer[^"&\\\s]+)/i);
    if (redirectMatch) {
        productLink = decodeURIComponent(redirectMatch[1]);
    } else {
        const directMatch = html.match(/"text":"(https?:\/\/(?:www\.)?youngjaecomputer\.com\/[^"]+)"/i);
        if (directMatch) {
            productLink = directMatch[1];
        }
    }

    return {
        videoId,
        title,
        link: `https://www.youtube.com/shorts/${videoId}`,
        productLink,
    };
}

export async function GET() {
    try {
        const videoIds = await getLatestVideoIds();
        const results = [];

        const batchSize = 6;
        for (let i = 0; i < videoIds.length; i += batchSize) {
            if (results.length >= 4) break;

            const batch = videoIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (videoId) => {
                try {
                    const videoInfo = await getVideoInfo(videoId);
                    if (!videoInfo || !videoInfo.productLink) return null;

                    let productTitle = '';
                    let productPrice = '';
                    let productImage = '';

                    try {
                        const productRes = await fetchWithTimeout(videoInfo.productLink, {}, 5000);
                        if (productRes.ok) {
                            const html = await productRes.text();
                            const $ = cheerio.load(html);

                            productTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
                            productImage = $('meta[property="og:image"]').attr('content') || '';

                            const priceText =
                                $('#_it_price').text() ||
                                $('#r_1set_price').text() ||
                                $('#sit_tot_price').text() ||
                                $('.sit_opt_prc').text() ||
                                '';
                            if (priceText) productPrice = priceText.trim();
                        }
                    } catch (e) {
                        console.error('Product scrape timeout/error:', videoInfo.productLink);
                    }

                    if (productPrice) {
                        return {
                            videoId,
                            title: videoInfo.title,
                            link: videoInfo.link,
                            productLink: videoInfo.productLink,
                            productTitle,
                            productPrice,
                            productImage,
                        };
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            for (const res of batchResults) {
                if (res && results.length < 4) {
                    results.push(res);
                }
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
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
