const express = require('express');
const router = express.Router();
const { readJSON } = require('../utils/fileHandler');

router.get('/', async (req, res) => {
    const profile = await readJSON('profile.json');
    res.render('home', { profile, title: profile.name });
});

router.get('/mods', async (req, res) => {
    const mods = await readJSON('mods.json');
    res.render('mods', { mods, title: 'Modpacks' });
});

router.get('/download/:id', async (req, res) => {
    const mods = await readJSON('mods.json');
    const mod = mods.find(m => m.id === req.params.id);
    if (!mod) return res.redirect('/mods');
    res.render('download', { mod, title: 'Download - ' + mod.name });
});

router.get('/go/:id', async (req, res) => {
    const mods = await readJSON('mods.json');
    const mod = mods.find(m => m.id === req.params.id);
    if (!mod) return res.redirect('/mods');
    res.redirect(mod.download_url);
});

router.get('/servers', async (req, res) => {
    const servers = await readJSON('servers.json');
    res.render('servers', { servers, title: 'Servers' });
});

module.exports = router;