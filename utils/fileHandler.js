const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL === '1';
const dataDir = path.join(__dirname, '..', 'data');

// Inisialisasi folder data untuk local development
if (!isVercel && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function readJSON(filename) {
    try {
        if (isVercel) {
            // Di Vercel, baca dari environment variable
            const envKey = 'DATA_' + filename.replace('.json', '').toUpperCase();
            const data = process.env[envKey];
            if (data) {
                return JSON.parse(data);
            }
            // Return default
            return getDefaultData(filename);
        }
        
        // Local development
        const filePath = path.join(dataDir, filename);
        if (!fs.existsSync(filePath)) {
            const defaultData = getDefaultData(filename);
            writeJSON(filename, defaultData);
            return defaultData;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return getDefaultData(filename);
    }
}

function writeJSON(filename, data) {
    try {
        if (isVercel) {
            // Di Vercel, tidak bisa write ke file system
            // Data harus diupdate manual di dashboard Vercel
            console.log('Data updated (simpan ini ke env variable):', JSON.stringify(data));
            // Return true tapi data tidak benar-benar tersimpan
            // Untuk production, gunakan MongoDB atau KV storage
            return true;
        }
        
        // Local development
        const filePath = path.join(dataDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
}

function getDefaultData(filename) {
    if (filename === 'profile.json') {
        return {
            avatar_url: '/img/avatar.png',
            name: 'Nuxy MC',
            bio: 'Minecraft Streamer & Modpack Creator',
            socials: [
                {
                    name: 'YouTube',
                    url: 'https://youtube.com/@nuxymc',
                    icon: 'fab fa-youtube',
                    type: 'social',
                    icon_type: 'fontawesome'
                },
                {
                    name: 'Discord',
                    url: 'https://discord.gg/nuxymc',
                    icon: 'fab fa-discord',
                    type: 'social',
                    icon_type: 'fontawesome'
                },
                {
                    name: 'Saweria',
                    url: 'https://saweria.co/nuxymc',
                    icon: '💛',
                    type: 'donate',
                    icon_type: 'emoji'
                }
            ]
        };
    }
    if (filename === 'mods.json') {
        return [
            {
                id: '1',
                name: 'Nuxy\'s Adventure Pack',
                mc_version: '1.20.1',
                description: 'Epic adventure modpack with 200+ mods!',
                download_url: 'https://drive.google.com/example',
                release_date: '2024-05-01'
            }
        ];
    }
    if (filename === 'servers.json') {
        return [
            {
                id: '1',
                name: 'Nuxy SMP',
                has_java: true,
                java_ip: 'play.nuxy.my.id',
                has_bedrock: true,
                bedrock_ip: 'play.nuxy.my.id',
                bedrock_port: 19132
            }
        ];
    }
    return [];
}

module.exports = { readJSON, writeJSON };