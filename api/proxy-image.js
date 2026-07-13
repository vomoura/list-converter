export default async function handler(req, res) {
    const { url } = req.query;

    if (!url || !url.startsWith('https://cards.lorcast.io/')) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Fetch failed' });
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'image/avif';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Proxy error' });
    }
}
