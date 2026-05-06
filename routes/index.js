const express = require('express');
const router = express.Router();
const { readJSON } = require('../utils/fileHandler');

// Halaman verifikasi AdSense
router.get('/ads', (req, res) => {
    const mods = readJSON('mods.json');
    const firstMod = mods.length > 0 ? mods[0] : {
        id: '0',
        name: 'Nuxy MC Modpack',
        mc_version: '1.20.1',
        description: 'Download modpack terbaik dari Nuxy MC',
        download_url: '#',
        release_date: new Date().toISOString().split('T')[0]
    };
    
    res.render('ads-verify', {
        mod: firstMod,
        title: 'Download Modpack'
    });
});

// Home page
router.get('/', (req, res) => {
    const profile = readJSON('profile.json');
    res.render('home', { 
        profile,
        title: profile.name
    });
});

// Mods page
router.get('/mods', (req, res) => {
    const mods = readJSON('mods.json');
    res.render('mods', { 
        mods,
        title: 'Modpacks'
    });
});

// Download interstitial page
router.get('/download/:id', (req, res) => {
    const mods = readJSON('mods.json');
    const mod = mods.find(m => m.id === req.params.id);
    
    if (!mod) {
        return res.redirect('/mods');
    }
    
    res.render('download', {
        mod,
        title: 'Download - ' + mod.name
    });
});

// Direct download redirect
router.get('/go/:id', (req, res) => {
    const mods = readJSON('mods.json');
    const mod = mods.find(m => m.id === req.params.id);
    
    if (!mod) {
        return res.redirect('/mods');
    }
    
    res.redirect(mod.download_url);
});

// Servers page
router.get('/servers', (req, res) => {
    const servers = readJSON('servers.json');
    res.render('servers', { 
        servers,
        title: 'Servers'
    });
});

module.exports = router;