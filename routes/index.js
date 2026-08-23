const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { readJSON, writeJSON } = require('../utils/fileHandler');

// Favicon dinamis dari profile avatar
router.get('/favicon.ico', (req, res) => {
    try {
        const profile = readJSON('profile.json');
        let faviconPath = profile.avatar_url || '/img/avatar.png';
        let cleanPath = faviconPath.startsWith('/') ? faviconPath.substring(1) : faviconPath;
        let fullPath = path.join(__dirname, '..', 'public', cleanPath);

        if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath).toLowerCase();
            let contentType = 'image/x-icon';
            if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.gif') contentType = 'image/gif';
            else if (ext === '.webp') contentType = 'image/webp';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(fullPath);
        }

        const defaultPath = path.join(__dirname, '..', 'public', 'img', 'avatar.png');
        if (fs.existsSync(defaultPath)) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(defaultPath);
        }
        return res.status(204).end();
    } catch (error) {
        console.error('Favicon error:', error);
        const defaultPath = path.join(__dirname, '..', 'public', 'img', 'avatar.png');
        if (fs.existsSync(defaultPath)) return res.sendFile(defaultPath);
        return res.status(204).end();
    }
});

// Home page
router.get('/', (req, res) => {
    const profile = readJSON('profile.json');
    res.render('home', { profile, title: profile.name });
});

// Mods list
router.get('/mods', (req, res) => {
    const mods = readJSON('mods.json');
    res.render('mods', { mods, title: 'Modpacks' });
});

// Mod detail + safe countdown download page
router.get('/download/:id', (req, res) => {
    const mods = readJSON('mods.json');
    const mod = mods.find(m => m.id === req.params.id);
    if (!mod) return res.redirect('/mods');
    res.render('mod-detail', { mod, title: mod.name });
});

// Direct download redirect (only reached after countdown unlocks)
router.get('/go/:id', (req, res) => {
    const mods = readJSON('mods.json');
    const mod = mods.find(m => m.id === req.params.id);
    if (!mod) return res.redirect('/mods');
    res.redirect(mod.download_url);
});

// Servers page
router.get('/servers', (req, res) => {
    const servers = readJSON('servers.json');
    res.render('servers', { servers, title: 'Servers' });
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
        { id: 1, amount: '5K', action: 'Buang Item Dipegang', color: '#A855F7' },
        { id: 2, amount: '15K', action: 'Buang 5 Item', color: '#F59E0B' },
        { id: 3, amount: '100K', action: 'Clear 1 Inventory', color: '#EF4444' }
    ];
}

// Halaman overlay - tampilan challenge untuk OBS browser source
router.get('/overlay', (req, res) => {
    res.render('overlay', { challenges: getChallenges(), title: 'Minecraft Challenge - Overlay' });
});

// API untuk update challenges dari luar (OBS dock / remote), diproteksi secret key
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
            color: req.query[`challenge${index}_color`] || '#A855F7'
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

// API endpoint untuk update dari admin panel (session-protected)
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
