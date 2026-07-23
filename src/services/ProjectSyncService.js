/**
 * ProjectSyncService.js
 * Verwaltet die Warteschlange für Projektdaten-Backups (OneDrive JSON).
 * Schreibt die Daten in die Supabase-Warteschlange (onedrive_sync_queue).
 */

import { supabase as supabaseClient } from '../supabaseClient.js';

// Globaler Fallback für den Fall, dass das Modul-System hakt
const supabase = supabaseClient || window.supabase;

console.log('[ProjectSync] Service initialisiert. Supabase Instanz vorhanden:', !!supabase);
if (!supabase) {
  console.warn('[ProjectSync] WARNUNG: Supabase Client konnte nicht gefunden werden (Modul & Window)');
}
const DB_NAME = 'qtool-sync-queue';
const STORE_NAME = 'projects';

/**
 * Initialisiert die Datenbank
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fügt einen neuen Sync-Auftrag in die Warteschlange ein.
 */
export async function queueProjectBackup(projectId, folderName, projectData) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const all = await new Promise((res) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result || []);
  });

  for (const item of all) {
    if (item.projectId === projectId && item.status !== 'syncing') {
      store.delete(item.id);
    }
  }

  const newItem = {
    projectId,
    folderName,
    data: projectData,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastError: null
  };

  return new Promise((resolve, reject) => {
    const req = store.add(newItem);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Liefert die Anzahl der ausstehenden Projektsynchronisationen
 */
export async function getPendingProjectCount() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((res) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
    });
    return all.filter(item => item.status !== 'synced').length;
  } catch (e) {
    return 0;
  }
}

/**
 * Hilfsfunktion: Berechnet die Größe des Payloads in KB
 */
const getPayloadSizeKB = (data) => JSON.stringify(data).length / 1024;

/**
 * Hilfsfunktion: Entfernt gezielt nur Bilddaten aus dem Payload
 */
const safeStripImagePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(safeStripImagePayload);
  const newObj = {};
  const keysToStrip = ['preview', 'base64', 'imageBase64', 'thumbnail', 'blob', 'dataUrl', 'imageDataUrl', 'canvasDataUrl'];
  for (const key in obj) {
    let value = obj[key];
    if (keysToStrip.includes(key)) {
      newObj[key] = null;
    } else if (key === 'src' && typeof value === 'string' && value.startsWith('data:image/')) {
      newObj[key] = null;
    } else {
      newObj[key] = safeStripImagePayload(value);
    }
  }
  return newObj;
};

/**
 * Hilfsfunktion: Wrapper für asynchrones Speichern eines Items (öffnet eigene Transaktion)
 */
const updateItemStatus = async (item) => {
  const db = await openSyncDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.put(item);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};

/**
 * Warteschlange abarbeiten: Lokale Backups zu Supabase schieben
 */
export async function processProjectQueue() {
  if (_isProcessing) return;
  _isProcessing = true;

  try {
    const db = await openSyncDB();
    // 1. Nur lesen (Transaktion schließt danach)
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });

    const pending = all.filter(item => item.status === 'pending' || item.status === 'error');
    if (pending.length === 0) return;

    console.log(`[ProjectSync] Schiebe ${pending.length} Projekte zu Supabase...`);

    for (const item of pending) {
      console.log(`[ProjectSync] ${item.projectId}`);
      
      try {
        if (!supabase) throw new Error('Supabase client ist nicht initialisiert.');

        const IS_TEST_ENV = !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EXPECTED_SUPABASE_PROJECT_ID);
        if (IS_TEST_ENV) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Schreiben blockiert: Keine aktive Supabase-Session im Testmodus.');
          }
        }

        const originalSizeKB = getPayloadSizeKB(item.data);
        console.log(`[ProjectSync] originalSizeKB: ${originalSizeKB.toFixed(2)}`);

        let finalPayload = item.data;
        let finalSizeKB = originalSizeKB;

        // Schritt 1: Falls zu groß (>1MB), gezielt Bilder strippen
        if (originalSizeKB > 1024) {
          finalPayload = safeStripImagePayload(item.data);
          finalSizeKB = getPayloadSizeKB(finalPayload);
          console.log(`[ProjectSync] strippedSizeKB: ${finalSizeKB.toFixed(2)}`);
        }

        // Schritt 2: Falls immer noch zu groß (>2MB), Versuch abbrechen
        if (finalSizeKB > 2048) {
          console.warn(`[ProjectSync] payload_too_large`);
          item.status = 'error';
          item.lastError = 'payload_too_large';
          item.attempts = (item.attempts || 0) + 1;
          await updateItemStatus(item);
          continue; 
        }

        console.log(`[ProjectSync] upsert started`);
        item.status = 'syncing';
        await updateItemStatus(item);

        const { error } = await upsertWithTimeout(supabase, finalPayload, item.projectId);

        if (error) throw error;

        console.log(`[ProjectSync] upsert success`);
        item.status = 'synced';
        item.lastError = null;
        await updateItemStatus(item);
      } catch (err) {
        const isTimeout = err.message === 'timeout';
        console.warn(`[ProjectSync] ${isTimeout ? 'timeout' : 'upsert failed'}: ${err.message}`);
        
        item.status = 'error';
        item.lastError = isTimeout ? 'timeout' : err.message;
        item.attempts = (item.attempts || 0) + 1;
        await updateItemStatus(item);
        continue;
      }
    }
  } catch (e) {
    console.error('[ProjectSync] Kritischer Fehler:', e);
  } finally {
    _isProcessing = false;
  }
}
