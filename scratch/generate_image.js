const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

// Ensure scratch directory exists
const scratchDir = path.join(__dirname);
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

const width = 1200;
const height = 800;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// 1. Draw a technical test pattern background
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, width, height);

// Draw grid lines
ctx.strokeStyle = '#CCCCCC';
ctx.lineWidth = 1;
for (let x = 0; x < width; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}
for (let y = 0; y < height; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

// Draw concentric circles in center
ctx.strokeStyle = '#3b82f6';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.arc(width / 2, height / 2, 200, 0, Math.PI * 2);
ctx.stroke();

ctx.strokeStyle = '#10b981';
ctx.beginPath();
ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2);
ctx.stroke();

// Draw diagonal lines
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(0, 0);
ctx.lineTo(width, height);
ctx.stroke();
ctx.beginPath();
ctx.moveTo(width, 0);
ctx.lineTo(0, height);
ctx.stroke();

// 2. Draw large watermark text: "QTOOL TESTDATEN – NICHT PRODUKTIV"
ctx.save();
ctx.translate(width / 2, height / 2);
ctx.rotate(-15 * Math.PI / 180);
ctx.font = 'bold 50px Arial, sans-serif';
ctx.fillStyle = 'rgba(220, 38, 38, 0.25)'; // Semi-transparent red
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Repeat watermark at offsets to make it a true watermark pattern
for (let offset = -200; offset <= 200; offset += 100) {
  ctx.fillText('QTOOL TESTDATEN – NICHT PRODUKTIV', 0, offset);
}
ctx.restore();

// 3. Draw a solid banner for high-contrast watermark text
ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
ctx.fillRect(0, height - 100, width, 100);

ctx.font = 'bold 36px Arial, sans-serif';
ctx.fillStyle = '#FFD700'; // Gold color
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('QTOOL TESTDATEN – NICHT PRODUKTIV', width / 2, height - 70);

ctx.font = 'bold 24px Arial, sans-serif';
ctx.fillStyle = '#FFFFFF';
ctx.fillText('TESTRUN_2026-07-21_161114_A7K2', width / 2, height - 30);

// Also add info on top left
ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
ctx.fillRect(10, 10, 480, 50);
ctx.font = 'bold 20px Arial, sans-serif';
ctx.fillStyle = '#00FF00';
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText('TEST IMAGE: 1200 x 800 px (JPEG)', 20, 20);

// Save as JPEG
const buffer = canvas.toBuffer('image/jpeg');
const outputPath = path.join(scratchDir, 'TEST__Bild_0001.jpg');
fs.writeFileSync(outputPath, buffer);

const stats = fs.statSync(outputPath);
const fileSizeKb = (stats.size / 1024).toFixed(2);
console.log(`SUCCESS: Created ${outputPath} (${fileSizeKb} KB)`);
