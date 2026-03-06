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

async function getLatestVideoIds() {
    // uploads playlist ID = "UU" + channelId.slice(2)
    const uploadsPlaylistId = 'UU' + CHANNEL_ID.slice(2);
    const res = await fetch('https://www.youtube.com/youtubei/v1/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            context: INNERTUBE_CONTEXT,
            browseId: 'VL' + uploadsPlaylistId,
        }),
    });
    if (!res.ok) throw new Error(`InnerTube browse failed: ${res.status}`);
    const data = await res.json();
    const str = JSON.stringify(data);
    const ids = [...str.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    return [...new Set(ids)].slice(0, 15);
}

async function getVideoInfo(videoId) {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 제목: og:title 메타 태그 (HTML 엔티티 디코딩)
    const titleMatch = html.match(/<meta(?:\s+[^>]*)?\s+(?:property="og:title"|name="title")\s+content="([^"]+)"/);
    const title = decodeHtmlEntities(titleMatch?.[1] || '');

    // product URL: YouTube redirect URL의 q= 파라미터에서 추출
    // 형태: youtube.com/redirect?...&q=https%3A%2F%2Fwww.youngjaecomputer.com%2F...
    let productLink = null;
    const redirectMatch = html.match(/q=(https%3A%2F%2F(?:www\.)?youngjaecomputer[^"&\\\s]+)/i);
    if (redirectMatch) {
        productLink = decodeURIComponent(redirectMatch[1]);
    }

    return {
        videoId,
        title,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        productLink,
    };
}

export async function GET(request) {
    try {
        const videoIds = await getLatestVideoIds();
        const results = [];

        for (const videoId of videoIds) {
            if (results.length >= 4) break;

            const videoInfo = await getVideoInfo(videoId);
            if (!videoInfo || !videoInfo.productLink) continue;

            let productTitle = 'Product Title Not Found';
            let productPrice = '홈페이지 참조';
            let productImage = '';

            try {
                const productRes = await fetch(videoInfo.productLink);
                if (productRes.ok) {
                    const html = await productRes.text();
                    const $ = cheerio.load(html);

                    productTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
                    productImage = $('meta[property="og:image"]').attr('content') || '';

                    let priceText =
                        $('#_it_price').text() ||
                        $('#r_1set_price').text() ||
                        $('#sit_tot_price').text() ||
                        $('.sit_opt_prc').text() ||
                        '';
                    if (priceText) {
                        productPrice = priceText.trim();
                    }
                }
            } catch (e) {
                console.error('Failed to scrape product page:', videoInfo.productLink, e);
            }

            if (productPrice !== 'Price Not Found' && productPrice !== '홈페이지 참조' && productPrice !== '') {
                results.push({
                    videoId,
                    title: videoInfo.title,
                    link: videoInfo.link,
                    productLink: videoInfo.productLink,
                    productTitle,
                    productPrice,
                    productImage,
                });
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
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
