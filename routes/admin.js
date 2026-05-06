const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/fileHandler');

// Konfigurasi multer untuk Vercel (gunakan /tmp)
const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel ? '/tmp/uploads/profiles' : path.join(__dirname, '..', 'public', 'uploads', 'profiles');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only image files are allowed!'));
    }
});

// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error_msg', 'Please login first');
        return res.redirect('/auth/login');
    }
    next();
};

router.use(requireAuth);

// Dashboard
router.get('/', (req, res) => {
    res.render('admin/dashboard', { title: 'Admin Dashboard' });
});

// Profile - GET
router.get('/profile', async (req, res) => {
    const profile = await readJSON('profile.json');
    res.render('admin/profile', { profile, title: 'Edit Profile' });
});

// Profile - POST
router.post('/profile', upload.single('avatar'), async (req, res) => {
    try {
        const profile = await readJSON('profile.json');
        const { name, bio } = req.body;
        
        let avatar_url = profile.avatar_url || '/img/avatar.png';
        if (req.file) {
            if (profile.avatar_url && profile.avatar_url.includes('/uploads/profiles/')) {
                const oldPath = path.join(uploadDir, path.basename(profile.avatar_url));
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            avatar_url = '/uploads/profiles/' + req.file.filename;
        }
        
        // Process social links
        const socials = [];
        const allKeys = Object.keys(req.body);
        const nameKeys = allKeys.filter(key => key.startsWith('social_name_'));
        
        nameKeys.sort().forEach(key => {
            const index = key.replace('social_name_', '');
            const name = req.body[key] ? req.body[key].trim() : '';
            const url = req.body['social_url_' + index] ? req.body['social_url_' + index].trim() : '';
            const icon = req.body['social_icon_' + index] ? req.body['social_icon_' + index].trim() : 'fas fa-link';
            const type = req.body['social_type_' + index] ? req.body['social_type_' + index].trim() : 'social';
            const iconType = req.body['social_icon_type_' + index] ? req.body['social_icon_type_' + index].trim() : 'fontawesome';
            
            if (name && url) {
                socials.push({ name, url, icon, type, icon_type: iconType });
            }
        });
        
        const updatedProfile = { avatar_url, name: name || 'Nuxy MC', bio: bio || '', socials };
        await writeJSON('profile.json', updatedProfile);
        req.flash('success_msg', 'Profile berhasil disimpan!');
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/profile');
});

// Servers - GET
router.get('/servers', async (req, res) => {
    const servers = await readJSON('servers.json');
    res.render('admin/servers', { servers, title: 'Manage Servers' });
});

// Servers - ADD
router.post('/servers/add', async (req, res) => {
    try {
        const servers = await readJSON('servers.json');
        const hasJava = req.body.has_java === 'on';
        const hasBedrock = req.body.has_bedrock === 'on';
        
        const newServer = {
            id: Date.now().toString(),
            name: req.body.name || '',
            has_java: hasJava,
            java_ip: hasJava ? (req.body.java_ip || '') : '',
            has_bedrock: hasBedrock,
            bedrock_ip: hasBedrock ? (req.body.bedrock_ip || '') : '',
            bedrock_port: hasBedrock ? (parseInt(req.body.bedrock_port) || 19132) : 19132
        };
        
        servers.push(newServer);
        await writeJSON('servers.json', servers);
        req.flash('success_msg', 'Server berhasil ditambahkan!');
    } catch (error) {
        console.error('Error adding server:', error);
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/servers');
});

// Servers - EDIT
router.post('/servers/edit/:id', async (req, res) => {
    try {
        const servers = await readJSON('servers.json');
        const index = servers.findIndex(s => s.id === req.params.id);
        
        if (index !== -1) {
            const hasJava = req.body.has_java === 'on';
            const hasBedrock = req.body.has_bedrock === 'on';
            
            servers[index] = {
                ...servers[index],
                name: req.body.name || servers[index].name,
                has_java: hasJava,
                java_ip: hasJava ? (req.body.java_ip || '') : '',
                has_bedrock: hasBedrock,
                bedrock_ip: hasBedrock ? (req.body.bedrock_ip || '') : '',
                bedrock_port: hasBedrock ? (parseInt(req.body.bedrock_port) || 19132) : 19132
            };
            
            await writeJSON('servers.json', servers);
            req.flash('success_msg', 'Server berhasil diupdate!');
        }
    } catch (error) {
        console.error('Error updating server:', error);
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/servers');
});

// Servers - DELETE
router.get('/servers/delete/:id', async (req, res) => {
    try {
        let servers = await readJSON('servers.json');
        servers = servers.filter(s => s.id !== req.params.id);
        await writeJSON('servers.json', servers);
        req.flash('success_msg', 'Server berhasil dihapus!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/servers');
});

// Mods - GET
router.get('/mods', async (req, res) => {
    const mods = await readJSON('mods.json');
    res.render('admin/mods', { mods, title: 'Manage Modpacks' });
});

// Mods - ADD
router.post('/mods/add', async (req, res) => {
    try {
        const mods = await readJSON('mods.json');
        const newMod = {
            id: Date.now().toString(),
            name: req.body.name || '',
            mc_version: req.body.mc_version || '',
            description: req.body.description || '',
            download_url: req.body.download_url || '',
            release_date: req.body.release_date || new Date().toISOString().split('T')[0]
        };
        mods.push(newMod);
        await writeJSON('mods.json', mods);
        req.flash('success_msg', 'Modpack berhasil ditambahkan!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/mods');
});

// Mods - EDIT
router.post('/mods/edit/:id', async (req, res) => {
    try {
        const mods = await readJSON('mods.json');
        const index = mods.findIndex(m => m.id === req.params.id);
        if (index !== -1) {
            mods[index] = {
                ...mods[index],
                name: req.body.name || mods[index].name,
                mc_version: req.body.mc_version || mods[index].mc_version,
                description: req.body.description || mods[index].description,
                download_url: req.body.download_url || mods[index].download_url,
                release_date: req.body.release_date || mods[index].release_date
            };
            await writeJSON('mods.json', mods);
            req.flash('success_msg', 'Modpack berhasil diupdate!');
        }
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/mods');
});

// Mods - DELETE
router.get('/mods/delete/:id', async (req, res) => {
    try {
        let mods = await readJSON('mods.json');
        mods = mods.filter(m => m.id !== req.params.id);
        await writeJSON('mods.json', mods);
        req.flash('success_msg', 'Modpack berhasil dihapus!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/mods');
});

// Delete Avatar
router.post('/profile/delete-avatar', async (req, res) => {
    try {
        const profile = await readJSON('profile.json');
        if (profile.avatar_url && profile.avatar_url.includes('/uploads/profiles/')) {
            const avatarPath = path.join(uploadDir, path.basename(profile.avatar_url));
            if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        }
        profile.avatar_url = '/img/avatar.png';
        await writeJSON('profile.json', profile);
        req.flash('success_msg', 'Avatar dihapus!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/profile');
});

module.exports = router;