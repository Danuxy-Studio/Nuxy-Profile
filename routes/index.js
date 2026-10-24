const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { readJSON, writeJSON } = require('../utils/fileHandler');

// In-memory cache for Minecraft server status to avoid rate limits & speed up loads
const serverPingCache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Favicon dinamis dari official logo atau avatar
router.get('/favicon.ico', (req, res) => {
    try {
        const faviconIcoPath = path.join(__dirname, '..', 'public', 'img', 'favicon.ico');
        if (fs.existsSync(faviconIcoPath)) {
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(faviconIcoPath);
        }

        const faviconPngPath = path.join(__dirname, '..', 'public', 'img', 'favicon.png');
        if (fs.existsSync(faviconPngPath)) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(faviconPngPath);
        }

        return res.status(204).end();
    } catch (error) {
        console.error('Favicon error:', error);
        return res.status(204).end();
    }
});

// ============ SEO: SITEMAP.XML ============
router.get('/sitemap.xml', (req, res) => {
    try {
        const host = req.get('host') || 'nuxymc.my.id';
        const protocol = req.protocol || 'https';
        const baseUrl = `${protocol}://${host}`;
        const mods = readJSON('mods.json') || [];

        const now = new Date().toISOString().split('T')[0];

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Home page (highest priority)
        xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

        // Servers & Mabar
        xml += `  <url>\n    <loc>${baseUrl}/servers</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;

        // Mods list
        xml += `  <url>\n    <loc>${baseUrl}/mods</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

        // Individual mods
        mods.forEach(mod => {
            if (mod && mod.id) {
                xml += `  <url>\n    <loc>${baseUrl}/download/${mod.id}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
            }
        });

        xml += '</urlset>';

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('Error generating sitemap');
    }
});

// ============ SEO: ROBOTS.TXT ============
router.get('/robots.txt', (req, res) => {
    const host = req.get('host') || 'nuxymc.my.id';
    const protocol = req.protocol || 'https';
    const content = `User-agent: *
Allow: /
Allow: /servers
Allow: /mods
Allow: /download/
Allow: /public/
Disallow: /admin
Disallow: /auth
Disallow: /api/

Sitemap: ${protocol}://${host}/sitemap.xml
`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(content);
});

// ============ API: MINECRAFT SERVER STATUS & PLAYER DETECTION ============
router.get('/api/server-ping', async (req, res) => {
    const { ip, port, type } = req.query;
    if (!ip) {
        return res.status(400).json({ error: 'IP parameter is required' });
    }

    const cleanIp = ip.trim();
    const isBedrock = type === 'bedrock';
    const serverPort = port ? port.trim() : (isBedrock ? '19132' : '25565');
    const cacheKey = `${isBedrock ? 'be' : 'je'}:${cleanIp}:${serverPort}`;

    // Check cache
    const cached = serverPingCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return res.json(cached.data);
    }

    try {
        let apiUrl = isBedrock 
            ? `https://api.mcstatus.io/v2/status/bedrock/${cleanIp}:${serverPort}`
            : `https://api.mcstatus.io/v2/status/java/${cleanIp}:${serverPort}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const result = {
                online: !!data.online,
                players: {
                    online: data.players && typeof data.players.online === 'number' ? data.players.online : 0,
                    max: data.players && typeof data.players.max === 'number' ? data.players.max : 0
                },
                version: data.version && data.version.name_clean ? data.version.name_clean : (data.version && data.version.name ? data.version.name : 'Minecraft'),
                motd: data.motd && data.motd.clean ? data.motd.clean : '',
                timestamp: Date.now()
            };

            serverPingCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return res.json(result);
        }
        
        throw new Error(`API returned status ${response.status}`);
    } catch (err) {
        // Fallback response so frontend never breaks
        const fallback = {
            online: false,
            players: { online: 0, max: 0 },
            version: 'Minecraft',
            motd: '',
            error: err.name === 'AbortError' ? 'Ping timeout' : err.message,
            timestamp: Date.now()
        };
        serverPingCache.set(cacheKey, { timestamp: Date.now() - (CACHE_TTL_MS / 2), data: fallback });
        return res.json(fallback);
    }
});

// ============ HOME PAGE ============
router.get('/', (req, res) => {
    const profile = readJSON('profile.json') || {};
    const servers = readJSON('servers.json') || [];
    const mods = readJSON('mods.json') || [];

    // Find official sponsored server (is_sponsored === true), or fallback to first server
    const sponsorServer = servers.find(s => s && s.is_sponsored) || (servers.length > 0 ? servers[0] : null);

    res.render('home', {
        profile,
        servers,
        mods,
        sponsorServer,
        title: profile.name || 'NuxyMC'
    });
});

// ============ MODS LIST ============
router.get('/mods', (req, res) => {
    const mods = readJSON('mods.json') || [];
    res.render('mods', { mods, title: 'Download Modpack Minecraft' });
});

// ============ MOD DETAIL ============
router.get('/download/:id', (req, res) => {
    const mods = readJSON('mods.json') || [];
    const mod = mods.find(m => m.id === req.params.id);
    if (!mod) return res.redirect('/mods');
    res.render('mod-detail', { mod, title: `Download ${mod.name}` });
});

// Direct download redirect
router.get('/go/:id', (req, res) => {
    const mods = readJSON('mods.json') || [];
    const mod = mods.find(m => m.id === req.params.id);
    if (!mod) return res.redirect('/mods');
    res.redirect(mod.download_url);
});

// ============ SERVERS PAGE ============
router.get('/servers', (req, res) => {
    const servers = readJSON('servers.json') || [];
    res.render('servers', { servers, title: 'Server Minecraft & Mabar Komunitas' });
});

// ============ OVERLAY UNTUK LIVE STREAMING (OBS) ============
function getChallenges() {
    const challengesPath = path.join(__dirname, '..', 'data', 'challenges.json');
    if (fs.existsSync(challengesPath)) {
        try {
            return JSON.parse(fs.readFileSync(challengesPath, 'utf8'));
        } catch (e) {
            console.error('Error reading challenges.json:', e);
        }
    }
    return [
        { id: 1, amount: '5K', action: 'Buang Item Dipegang', color: '#0EA5E9' },
        { id: 2, amount: '15K', action: 'Buang 5 Item', color: '#F59E0B' },
        { id: 3, amount: '100K', action: 'Clear 1 Inventory', color: '#EF4444' }
    ];
}

router.get('/overlay', (req, res) => {
    res.render('overlay', { challenges: getChallenges(), title: 'Minecraft Challenge - Overlay' });
});

router.get('/api/update-challenges', (req, res) => {
    const secret = req.query.secret;
    if (secret !== process.env.OVERLAY_SECRET && secret !== 'nuxymc2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const challenges = [];
    let index = 1;
    while (req.query[`challenge${index}_amount`] !== undefined) {
        challenges.push({
            id: index,
            amount: req.query[`challenge${index}_amount`],
            action: req.query[`challenge${index}_action`],
            color: req.query[`challenge${index}_color`] || '#0EA5E9'
        });
        index++;
    }

    if (challenges.length > 0) {
        const challengesPath = path.join(__dirname, '..', 'data', 'challenges.json');
        fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));
        res.json({ success: true, challenges });
    } else {
        res.json({ success: false, message: 'No challenges provided' });
    }
});

router.post('/api/overlay/update', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { challenges } = req.body;
    if (challenges && Array.isArray(challenges)) {
        const challengesPath = path.join(__dirname, '..', 'data', 'challenges.json');
        fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid data' });
    }
});

module.exports = router;
