import QRCode from 'qrcode';
import os from 'os';
import fs from 'fs';
import path from 'path';

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

const ip = getLocalIP();
// Set ?v=7 to bypass old service worker / browser cache completely
const url = `http://${ip}:5173/?v=7`;

QRCode.toFile('qtool-ipad-qr.png', url, {
    color: {
        dark: '#0f172a', // sleek dark slate
        light: '#ffffff'
    },
    width: 500,
    margin: 2
}, function (err) {
    if (err) throw err;
    console.log(`QR Code generated for URL: ${url} and saved to qtool-ipad-qr.png`);
    
    // Copy to brain artifacts folder
    const destDir = "C:\\Users\\Andreas Q-Service\\.gemini\\antigravity\\brain\\e42c67c6-fe1d-497e-8d93-f4827a9b1c68";
    if (fs.existsSync(destDir)) {
        fs.copyFileSync('qtool-ipad-qr.png', path.join(destDir, 'qtool-ipad-qr.png'));
        console.log(`QR Code copied to brain directory successfully!`);
    } else {
        console.log(`Brain directory not found at: ${destDir}`);
    }
});
