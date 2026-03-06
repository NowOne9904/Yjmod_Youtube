import { GET } from './src/app/api/latest-shorts/route.js';

async function main() {
    const res = await GET();
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

main();
