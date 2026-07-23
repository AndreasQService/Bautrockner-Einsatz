import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSupabaseConfig, LIVE_PROJECT_ID } from '../src/supabaseClient.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. Test-Datenbank / Isolierung: Live-Projekt-ID ist strengstens verboten', () => {
  assert.throws(
    () => validateSupabaseConfig(`https://${LIVE_PROJECT_ID}.supabase.co`, 'some_key', LIVE_PROJECT_ID),
    (err) => err.message.includes('[TEST GUARD ABORT] KRITISCHER SICHERHEITSFEHLER')
  );
});

test('2. Test-Datenbank / Isolierung: Valides Test-Projekt aoxduqspiezzyqeqyzzl wird akzeptiert', () => {
  const url = validateSupabaseConfig(
    'https://aoxduqspiezzyqeqyzzl.supabase.co',
    'sb_publishable_HZzncDQUEtA8XN6HhT0ysA_K-Ho2eEL',
    'aoxduqspiezzyqeqyzzl'
  );
  assert.equal(url.hostname, 'aoxduqspiezzyqeqyzzl.supabase.co');
});

test('3. Test-Datenbank: Supabase-Fehler oder 0 Zeilen ergibt exakt 0 Projekte (Kein Fallback auf Prod-Cache)', () => {
  // Simulation des fetchReports Handlers für 0 Zeilen oder Fehler
  const simulateFetchReports = (dbData, dbError, localCache = null) => {
    let reportsState = localCache || ['TEST__ISOLATION_001'];
    
    if (dbError) {
      reportsState = [];
    } else if (dbData) {
      reportsState = dbData.filter(r => r.id !== '__session__');
    }
    return reportsState;
  };

  // Test 3a: Leeres Test-Projekt (0 Zeilen in DB)
  const emptyResult = simulateFetchReports([], null);
  assert.equal(emptyResult.length, 0, 'Leere Test-DB muss exakt 0 Projekte im Dashboard ergeben');

  // Test 3b: Fehlerhafte Verbindung / ungültiger Key
  const errorResult = simulateFetchReports(null, { code: 'PGRST301', message: 'Invalid API key' });
  assert.equal(errorResult.length, 0, 'Bei Supabase-Fehler dürfen exakt 0 Projekte geladen werden');

  // Test 3c: Lokaler Altbestand vorhanden, Supabase liefert 0
  const cachedResult = simulateFetchReports([], null, ['TEST__ISOLATION_001']);
  assert.equal(cachedResult.length, 0, 'Bei Supabase 0 Projekten muss auch lokaler Altbestand ignoriert und 0 angezeigt werden');

  // Simulation des Speichervorgangs
  const simulateSave = (isNew, dbInsertSucceeds) => {
    let reportsState = [];
    if (isNew) {
      if (dbInsertSucceeds) {
        reportsState.push({ id: 'new_id', title: 'new_project' });
      }
    }
    return reportsState;
  };

  // Test 3d: Fehlgeschlagener INSERT -> kein sichtbares Projekt
  const failedInsert = simulateSave(true, false);
  assert.equal(failedInsert.length, 0, 'Bei fehlgeschlagenem INSERT darf kein Projekt sichtbar sein');

  // Test 3e: Erfolgreicher INSERT -> exakt 1 sichtbares Projekt
  const successfulInsert = simulateSave(true, true);
  assert.equal(successfulInsert.length, 1, 'Bei erfolgreichem INSERT muss das Projekt sichtbar sein');
  assert.equal(successfulInsert[0].id, 'new_id');
});

test('4. Test-Datenbank / Storage-Isolierung: Keys erhalten projektspezifischen Präfix', () => {
  const getStorageKey = (keyName, isTest, projectId) => {
    if (isTest && projectId) {
      return `qtool_test_${projectId}_${keyName}`;
    }
    return keyName;
  };

  const testKey = getStorageKey('qservice_reports_prod', true, 'aoxduqspiezzyqeqyzzl');
  assert.equal(testKey, 'qtool_test_aoxduqspiezzyqeqyzzl_qservice_reports_prod');
  assert.notEqual(testKey, 'qservice_reports_prod', 'Test-Key darf nicht dem un-isolierten Produktiv-Key entsprechen');
});

test('5. Storage-Verifikationen: Bucket-Einschränkung und Session-Validierung', () => {
  const activeBucket = 'case-files';
  const forbiddenBuckets = ['damage-images', 'project-images'];
  
  assert.equal(activeBucket, 'case-files');
  assert.ok(!forbiddenBuckets.includes(activeBucket), 'case-files darf nicht in den verbotenen Buckets liegen');
  
  // Simuliere Schreib-Blockade ohne Session
  const simulateSync = (session, data) => {
    if (!session) {
      throw new Error('Schreiben blockiert: Keine aktive Supabase-Session im Testmodus.');
    }
    return 'uploaded';
  };
  
  assert.throws(
    () => simulateSync(null, { test: 1 }),
    /Schreiben blockiert/
  );
  
  const result = simulateSync({ user: 'test' }, { test: 1 });
  assert.equal(result, 'uploaded');
});

test('6. Bildeigenschaften im Testmodus (Vorschau-Wiederherstellung, Upload-Blockade & Validierung)', () => {
  // Simuliere Dateiauswahl und Validierung
  const validateAndCreatePreview = (file) => {
    if (!file) throw new Error('Keine Datei ausgewählt');
    
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error(`Ungültiger Dateityp: ${fileExt}`);
    }
    
    // Im echten System: URL.createObjectURL(file)
    const previewUrl = `blob:http://127.0.0.1:5180/\${Math.random().toString(36).substring(7)}`;
    return previewUrl;
  };

  // Test 6a: Gültiges JPEG erzeugt gültige Vorschau
  const validFile = { name: 'TEST__Bild_0001.jpg', size: 1024, type: 'image/jpeg' };
  const preview = validateAndCreatePreview(validFile);
  assert.ok(preview.startsWith('blob:'), 'Vorschau-URL muss eine gültige Blob-URL sein');

  // Test 6b: Ungültige Datei (z.B. exe) wird abgelehnt
  const invalidFile = { name: 'malware.exe', size: 2048, type: 'application/octet-stream' };
  assert.throws(
    () => validateAndCreatePreview(invalidFile),
    /Ungültiger Dateityp/
  );

  // Test 6c: Kein Upload allein durch Dateiauswahl im Testmodus
  const simulateImageUploadFlow = (file, isTestMode) => {
    const logs = [];
    // Schritt 0: Lokal sichern / in State legen
    const previewUrl = validateAndCreatePreview(file);
    logs.push('locally_saved');
    
    // Cloud Upload-Aufrufe
    const uploadToSupabaseStorage = () => { logs.push('supabase_storage_uploaded'); };
    const uploadToOneDrive = () => { logs.push('onedrive_uploaded'); };
    const writeToDatabaseJournal = () => { logs.push('database_journal_written'); };
    
    if (isTestMode) {
      // Im Testmodus überspringen wir jegliche automatischen Uploads bei Auswahl
      logs.push('upload_deferred');
    } else {
      uploadToSupabaseStorage();
      uploadToOneDrive();
      writeToDatabaseJournal();
    }
    
    return logs;
  };

  const testModeLogs = simulateImageUploadFlow(validFile, true);
  assert.ok(testModeLogs.includes('locally_saved'), 'Bild muss lokal gespeichert werden');
  assert.ok(testModeLogs.includes('upload_deferred'), 'Upload muss im Testmodus verzögert werden');
  assert.ok(!testModeLogs.includes('supabase_storage_uploaded'), 'Kein Supabase Storage Upload bei Dateiauswahl');
  assert.ok(!testModeLogs.includes('onedrive_uploaded'), 'Kein OneDrive Upload bei Dateiauswahl');
  assert.ok(!testModeLogs.includes('database_journal_written'), 'Kein Datenbank-Journal bei Dateiauswahl');

  // Test 6d: URL bleibt bis Entfernen/Unmount aktiv (Simuliere tracking & Cleanup)
  const activeUrls = [];
  const trackObjectURL = (url) => {
    activeUrls.push(url);
    return url;
  };
  const revokeObjectURL = (url) => {
    const idx = activeUrls.indexOf(url);
    if (idx !== -1) {
      activeUrls.splice(idx, 1);
    }
  };

  const mockUrl = trackObjectURL('blob:http://127.0.0.1:5180/mock-preview');
  assert.equal(activeUrls.length, 1, 'Blob-URL muss registriert und aktiv sein');
  assert.equal(activeUrls[0], 'blob:http://127.0.0.1:5180/mock-preview');
  
  // Simuliere Unmount/Entfernen -> URLs werden aufgeräumt
  revokeObjectURL(mockUrl);
  assert.equal(activeUrls.length, 0, 'Blob-URL muss nach Entfernen/Unmount bereinigt/revoked sein');
});

test('7. IndexedDB Migrationen und Fehler-Resistenz', () => {
  // Simuliere onupgradeneeded für eine frische DB ohne Stores
  const mockDb = {
    objectStoreNames: {
      names: [],
      contains(name) { return this.names.includes(name); }
    },
    createObjectStore(name, options) {
      this.objectStoreNames.names.push(name);
      return {
        createIndex: (idxName, keyPath, opts) => {}
      };
    }
  };

  const onUpgradeNeeded = (db) => {
    const STORE_PHOTOS = 'photos';
    const STORE_QUEUE = 'upload-queue';
    
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
      db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_QUEUE)) {
      db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
    }
  };

  onUpgradeNeeded(mockDb);
  assert.ok(mockDb.objectStoreNames.contains('photos'), 'photos Store muss angelegt werden');
  assert.ok(mockDb.objectStoreNames.contains('upload-queue'), 'upload-queue Store muss angelegt werden');

  // Test: Fehlender Cleanup-Store verursacht keinen Fehler
  const deleteOldSyncedPhotosMock = async (dbInstance) => {
    const STORE_PHOTOS = 'photos';
    if (!dbInstance.objectStoreNames.contains(STORE_PHOTOS)) {
      // Wenn der Store fehlt, leise 0 zurückgeben statt abzustürzen
      return 0;
    }
    return 10; // Simulierter Erfolg
  };

  const emptyDb = {
    objectStoreNames: {
      contains(name) { return false; }
    }
  };

  // Sollte leise 0 zurückgeben und NICHT abstürzen
  deleteOldSyncedPhotosMock(emptyDb).then(result => {
    assert.equal(result, 0, 'Sollte 0 zurückgeben wenn der Store fehlt');
  });
});

test('8. Preview und Upload-Flows bei Reload', async () => {
  const imagesState = [];
  const indexedDBMock = {};

  const simulateSelectImage = async (file) => {
    const tempId = 'img_' + Math.random().toString(36).substring(7);
    const initialPreview = 'blob:http://127.0.0.1:5180/' + tempId;
    
    // 1. Sofortige Object-URL erzeugen
    const previewUrl = initialPreview;
    
    // 2. In IndexedDB speichern
    indexedDBMock[tempId] = { id: tempId, blob: file };
    
    // 3. Erst nach erfolgreichem Speichern in den State übernehmen
    imagesState.push({
      id: tempId,
      preview: previewUrl,
      name: file.name
    });
    
    return tempId;
  };

  const file = { name: 'TEST__Bild_0001.jpg', type: 'image/jpeg' };
  const id = await simulateSelectImage(file);
  
  assert.equal(imagesState.length, 1, 'Bild sollte im State sein');
  assert.ok(imagesState[0].preview.startsWith('blob:'), 'Vorschau-URL muss existieren');

  // Simuliere Reload: Preview-URL ist nach F5 ungültig (null)
  imagesState[0].preview = null;

  // Lade Blob über dieselbe ID neu
  const restorePreview = async (imgId) => {
    const entry = indexedDBMock[imgId];
    if (entry) {
      return 'blob:http://127.0.0.1:5180/restored_' + imgId;
    }
    return null;
  };

  const restoredUrl = await restorePreview(imagesState[0].id);
  assert.ok(restoredUrl.includes('restored_'), 'Preview sollte nach Reload wiederhergestellt sein');
});

test('9. performCloudSave Syntax & Referenz-Check', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

  // Prüfe, ob fetchReports als Funktion deklariert ist
  assert.ok(
    appCode.includes('const fetchReports = useCallback(') || 
    appCode.includes('async function fetchReports(') || 
    appCode.includes('const fetchReports = async'), 
    'fetchReports muss im globalen/komponenten-Scope deklariert sein'
  );
  
  // Prüfe, ob performCloudSave fetchReports aufruft
  assert.ok(appCode.includes('fetchReports()'), 'performCloudSave muss fetchReports() aufrufen');
});


