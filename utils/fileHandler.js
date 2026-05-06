const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function readJSON(filename) {
    try {
        const filePath = path.join(dataDir, filename);
        if (!fs.existsSync(filePath)) {
            // Return default based on filename
            if (filename === 'profile.json') {
                const defaultProfile = {
                    avatar_url: '/img/avatar.png',
                    name: 'Nuxy MC',
                    bio: 'Minecraft Streamer & Modpack Creator',
                    socials: [],
                    links: []
                };
                writeJSON(filename, defaultProfile);
                return defaultProfile;
            }
            // Return empty array for list files
            writeJSON(filename, []);
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        if (filename === 'profile.json') {
            const defaultProfile = {
                avatar_url: '/img/avatar.png',
                name: 'Nuxy MC',
                bio: 'Minecraft Streamer & Modpack Creator',
                socials: [],
                links: []
            };
            return defaultProfile;
        }
        return [];
    }
}

function writeJSON(filename, data) {
    try {
        const filePath = path.join(dataDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
}

module.exports = { readJSON, writeJSON };