const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/fileHandler');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
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
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
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

// ==================== DASHBOARD ====================
router.get('/', (req, res) => {
    res.render('admin/dashboard', { title: 'Admin Dashboard' });
});

// ==================== PROFILE ====================
router.get('/profile', (req, res) => {
    const profile = readJSON('profile.json');
    res.render('admin/profile', { profile, title: 'Edit Profile' });
});

router.post('/profile', upload.single('avatar'), (req, res) => {
    try {
        console.log('=== FORM DATA RECEIVED ===');
        console.log('Body keys:', Object.keys(req.body));
        console.log('Full body:', req.body);
        
        const profile = readJSON('profile.json');
        const { name, bio } = req.body;
        
        // Handle avatar
        let avatar_url = profile.avatar_url || '/img/avatar.png';
        if (req.file) {
            if (profile.avatar_url && profile.avatar_url.includes('/uploads/profiles/')) {
                const oldPath = path.join(__dirname, '..', 'public', profile.avatar_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            avatar_url = '/uploads/profiles/' + req.file.filename;
        }
        
        // BUILD SOCIAL LINKS MANUALLY
        const socials = [];
        
        const allKeys = Object.keys(req.body);
        console.log('All keys:', allKeys);
        
        const nameKeys = allKeys.filter(key => key.startsWith('social_name_'));
        console.log('Name keys found:', nameKeys);
        
        nameKeys.sort().forEach(key => {
            const index = key.replace('social_name_', '');
            const name = req.body[key] ? req.body[key].trim() : '';
            const url = req.body['social_url_' + index] ? req.body['social_url_' + index].trim() : '';
            const icon = req.body['social_icon_' + index] ? req.body['social_icon_' + index].trim() : 'fas fa-link';
            const type = req.body['social_type_' + index] ? req.body['social_type_' + index].trim() : 'social';
            const iconType = req.body['social_icon_type_' + index] ? req.body['social_icon_type_' + index].trim() : 'fontawesome';
            
            console.log(`Link ${index}:`, { name, url, icon, type, iconType });
            
            if (name && url) {
                socials.push({
                    name: name,
                    url: url,
                    icon: icon,
                    type: type,
                    icon_type: iconType
                });
            }
        });
        
        console.log('Final socials:', socials);
        console.log('=== END ===');
        
        const updatedProfile = {
            avatar_url: avatar_url,
            name: name || 'Nuxy MC',
            bio: bio || '',
            socials: socials
        };
        
        writeJSON('profile.json', updatedProfile);
        req.flash('success_msg', 'Profile berhasil disimpan!');
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error: ' + error.message);
    }
    
    res.redirect('/admin/profile');
});

router.post('/profile/delete-avatar', (req, res) => {
    try {
        const profile = readJSON('profile.json');
        if (profile.avatar_url && profile.avatar_url.includes('/uploads/profiles/')) {
            const avatarPath = path.join(__dirname, '..', 'public', profile.avatar_url);
            if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        }
        profile.avatar_url = '/img/avatar.png';
        writeJSON('profile.json', profile);
        req.flash('success_msg', 'Avatar dihapus, menggunakan default.');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/profile');
});

// ==================== MODS ====================
router.get('/mods', (req, res) => {
    const mods = readJSON('mods.json');
    res.render('admin/mods', { mods, title: 'Manage Modpacks' });
});

router.post('/mods/add', (req, res) => {
    try {
        const mods = readJSON('mods.json');
        const newMod = {
            id: Date.now().toString(),
            name: req.body.name || '',
            mc_version: req.body.mc_version || '',
            description: req.body.description || '',
            download_url: req.body.download_url || '',
            release_date: req.body.release_date || new Date().toISOString().split('T')[0]
        };
        mods.push(newMod);
        writeJSON('mods.json', mods);
        req.flash('success_msg', 'Modpack berhasil ditambahkan!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/mods');
});

router.post('/mods/edit/:id', (req, res) => {
    try {
        const mods = readJSON('mods.json');
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
            writeJSON('mods.json', mods);
            req.flash('success_msg', 'Modpack berhasil diupdate!');
        }
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/mods');
});

router.get('/mods/delete/:id', (req, res) => {
    try {
        let mods = readJSON('mods.json');
        mods = mods.filter(m => m.id !== req.params.id);
        writeJSON('mods.json', mods);
        req.flash('success_msg', 'Modpack berhasil dihapus!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/mods');
});

// ==================== SERVERS ====================
router.get('/servers', (req, res) => {
    const servers = readJSON('servers.json');
    res.render('admin/servers', { servers, title: 'Manage Servers' });
});

router.post('/servers/add', (req, res) => {
    try {
        const servers = readJSON('servers.json');
        const hasJava = req.body.has_java === 'on';
        const hasBedrock = req.body.has_bedrock === 'on';
        
        const newServer = {
            id: Date.now().toString(),
            name: req.body.name || '',
            has_java: hasJava,
            java_ip: hasJava ? (req.body.java_ip || '') : '',
            has_bedrock: hasBedrock,
            bedrock_ip: hasBedrock ? (req.body.bedrock_ip || '') : '',
            bedrock_port: hasBedrock ? (parseInt(req.body.bedrock_port) || 19132) : 19132,
            community: {
                whatsapp: req.body.whatsapp || '',
                discord: req.body.discord || ''
            }
        };
        servers.push(newServer);
        writeJSON('servers.json', servers);
        req.flash('success_msg', 'Server berhasil ditambahkan!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/servers');
});

router.post('/servers/edit/:id', (req, res) => {
    try {
        const servers = readJSON('servers.json');
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
                bedrock_port: hasBedrock ? (parseInt(req.body.bedrock_port) || 19132) : 19132,
                community: {
                    whatsapp: req.body.whatsapp || '',
                    discord: req.body.discord || ''
                }
            };
            writeJSON('servers.json', servers);
            req.flash('success_msg', 'Server berhasil diupdate!');
        }
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/servers');
});

router.get('/servers/delete/:id', (req, res) => {
    try {
        let servers = readJSON('servers.json');
        servers = servers.filter(s => s.id !== req.params.id);
        writeJSON('servers.json', servers);
        req.flash('success_msg', 'Server berhasil dihapus!');
    } catch (error) {
        req.flash('error_msg', 'Error: ' + error.message);
    }
    res.redirect('/admin/servers');
});

// ==================== OVERLAY ====================
router.get('/overlay', (req, res) => {
    let challenges = [];
    const challengesPath = path.join(__dirname, '..', 'data', 'challenges.json');
    
    if (fs.existsSync(challengesPath)) {
        try {
            challenges = JSON.parse(fs.readFileSync(challengesPath, 'utf8'));
        } catch(e) {
            console.error('Error reading challenges.json:', e);
        }
    }
    
    if (!challenges || challenges.length === 0) {
        challenges = [
            { id: 1, amount: "5K", action: "Buang Item Dipegang", color: "#8B5CF6" },
            { id: 2, amount: "10K", action: "Buang 5 Item", color: "#F59E0B" },
            { id: 3, amount: "20K", action: "Kill Villager Armorer", color: "#EF4444" },
            { id: 4, amount: "30K", action: "Kill Villager Mending", color: "#22C55E" },
            { id: 5, amount: "50K", action: "Buang 1 Set Armor", color: "#06B6D4" },
            { id: 6, amount: "100K", action: "Clear Inventory", color: "#A855F7" },
            { id: 7, amount: "200K", action: "Bebas Atur Sendiri", color: "#14B8A6" }
        ];
    }
    
    res.render('admin/overlay', { challenges, title: 'Edit Overlay' });
});

module.exports = router;