import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    getCaseFileStoragePath,
    getDurablePhotoUrl
} from '../src/lib/caseFilePhotoAccess.js';

test('extracts a normalized case-files storage path', () => {
    assert.equal(getCaseFileStoragePath({ storagePath: '/reports/a/foto 1.jpg' }), 'reports/a/foto 1.jpg');
    assert.equal(
        getCaseFileStoragePath({ url: 'https://example.test/storage/v1/object/authenticated/case-files/reports%2Fa%2Ffoto.jpg?token=x' }),
        'reports/a/foto.jpg'
    );
});

test('only an https URL is considered a durable direct photo URL', () => {
    assert.equal(getDurablePhotoUrl({ preview: 'blob:https://example.test/123' }), null);
    assert.equal(getDurablePhotoUrl({ preview: 'data:image/jpeg;base64,abc' }), null);
    assert.equal(getDurablePhotoUrl({ url: 'https://cdn.example.test/foto.jpg' }), 'https://cdn.example.test/foto.jpg');
});

test('private case photos use authenticated download and explicit fallback', () => {
    const component = fs.readFileSync(new URL('../src/components/AuthenticatedStorageImage.jsx', import.meta.url), 'utf8');
    assert.match(component, /\.from\('case-files'\)[\s\S]*\.download\(storagePath\)/);
    assert.match(component, /Vorschau nicht verfügbar/);
});

test('DamageForm uses authenticated rendering and signed sharing links', () => {
    const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
    assert.match(form, /<AuthenticatedStorageImage[\s\S]*photo=\{img\}/);
    assert.match(form, /\.createSignedUrl\(storagePath, 300\)/);
    assert.doesNotMatch(form, /object\/public\/case-files/);
});
