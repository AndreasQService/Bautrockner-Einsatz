const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'images');

function generateSampleJpeg(index) {
    // Minimal valid JPEG binary buffer structure with SOF0 marker
    const width = 800 + (index % 5) * 100;
    const height = 600 + (index % 3) * 100;

    // Header: SOI, APP0, DQT, SOF0, DHT, SOS
    const numStr = String(index).padStart(2, '0');
    const headerStr = `JPEG_TEST_IMAGE_${numStr}_WIDTH_${width}_HEIGHT_${height}_QTOOL_E2E_FIXTURE`;

    const buffer = Buffer.alloc(1024 + index * 64);
    // SOI
    buffer[0] = 0xFF; buffer[1] = 0xD8;
    // APP0
    buffer[2] = 0xFF; buffer[3] = 0xE0;
    buffer[4] = 0x00; buffer[5] = 0x10;
    buffer.write('JFIF', 6);
    // Fill text marker in comment block (FE)
    buffer[11] = 0xFF; buffer[12] = 0xFE;
    buffer.writeUInt16BE(headerStr.length + 2, 13);
    buffer.write(headerStr, 15);
    // EOI at the end
    buffer[buffer.length - 2] = 0xFF;
    buffer[buffer.length - 1] = 0xD9;

    return { buffer, width, height };
}

function generateFixtures() {
    console.log('=== GENERATING 36 PHYSICAL JPEG TEST ASSETS & MANIFEST ===');

    if (!fs.existsSync(FIXTURES_DIR)) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    const manifestEntries = [];

    for (let i = 1; i <= 36; i++) {
        const numStr = String(i).padStart(2, '0');
        const filename = `test_damage_image_${numStr}.jpg`;
        const filePath = path.join(FIXTURES_DIR, filename);

        const { buffer, width, height } = generateSampleJpeg(i);
        fs.writeFileSync(filePath, buffer);

        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();

        manifestEntries.push({
            filename,
            path: filePath,
            sizeBytes: buffer.length,
            sha256,
            resolution: `${width}x${height}`,
            expectedDamageSpot: { x: 100 + i * 10, y: 150 + i * 5 },
            assignedRoom: i % 2 === 0 ? 'Wohnzimmer' : 'Badezimmer'
        });
    }

    // Corrupted JPEG
    const corruptPath = path.join(FIXTURES_DIR, 'corrupted_test_image.jpg');
    fs.writeFileSync(corruptPath, Buffer.from('NOT_A_VALID_JPEG_HEADER_CORRUPTED'));

    // Invalid file type
    const invalidPath = path.join(FIXTURES_DIR, 'invalid_type_document.pdf');
    fs.writeFileSync(invalidPath, Buffer.from('%PDF-1.4 Invalid type test file'));

    const manifest = {
        generatedAt: new Date().toISOString(),
        totalImages: manifestEntries.length,
        images: manifestEntries,
        corruptedFixture: 'corrupted_test_image.jpg',
        invalidTypeFixture: 'invalid_type_document.pdf'
    };

    const manifestPath = path.join(FIXTURES_DIR, 'asset_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`Generated 36 JPEG assets + 2 special fixtures. Manifest saved to ${manifestPath} ✅`);
}

generateFixtures();
