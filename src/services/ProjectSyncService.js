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
const STALE_SYNCING_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Globaler Status-Flag
let _isProcessing = false;

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
 * Helper: Prüft ob ein Sync-Vorgang hängt
 */
const isStaleSyncing = (item) => {
  if (item.status !== 'syncing') return false;
  if (!item.updatedAt) return true;
  return (Date.now() - new Date(item.updatedAt).getTime()) > STALE_SYNCING_MS;
};

/**
 * Fügt einen neuen Sync-Auftrag in die Warteschlange ein.
 */
export async function queueProjectBackup(projectId, folderName, projectData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const all = getAllReq.result || [];
      // Bestehende nicht-syncing Einträge gleicher projectId löschen
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
        updatedAt: new Date().toISOString(),
        lastError: null
      };
      store.add(newItem);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
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
const getPayloadSizeKB = (data) => JSON.stringify(data || {}).length / 1024;

/**
 * Hilfsfunktion: Entfernt gezielt nur Bilddaten aus dem Payload
 * Erzeugt eine Kopie, verändert das Original nicht.
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
  const db = await openDB();
  item.updatedAt = new Date().toISOString();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};

/**
 * Hilfsfunktion: Upsert mit Timeout
 */
async function upsertWithTimeout(supabase, payload, projectId, attempts, timeoutMs = 15000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  );

  const upsertPromise = (async () => {
    const { data, error } = await supabase
      .from('onedrive_sync_queue')
      .upsert({
        project_id: projectId,
        payload: payload,
        type: 'project_json',
        status: 'pending',
        updated_at: new Date().toISOString(),
        error_message: null,
        attempts: attempts
      }, { onConflict: 'project_id' });
    return { data, error };
  })();

  return Promise.race([upsertPromise, timeoutPromise]);
}

/**
 * Warteschlange abarbeiten: Lokale Backups zu Supabase schieben
 */
export async function processProjectQueue() {
  if (_isProcessing) return;
  _isProcessing = true;

  try {
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });

    if (!all || all.length === 0) return;

    // 1. Detaillierte console.table beim Start
    console.log('[ProjectSync] --- START QUEUE INVENTORY ---');
    const inventory = all.map(item => ({
      id: item.id,
      projectId: item.projectId,
      status: item.status,
      attempts: item.attempts,
      lastError: item.lastError || 'none',
      updatedAt: item.updatedAt || 'missing',
      payloadSizeKB: getPayloadSizeKB(item.data).toFixed(2)
    }));
    console.table(inventory);

    for (const item of all) {
      try {
        if (item.status === 'synced') continue;

        // 5. Stale Recovery inkl. missing updatedAt
        if (isStaleSyncing(item)) {
          console.log(`[ProjectSync] --- CONTINUE REASON: stale_syncing_reset (${item.projectId}) ---`);
          item.status = 'pending';
          item.lastError = 'stale_syncing_reset';
          item.attempts = (item.attempts || 0) + 1;
          await updateItemStatus(item);
          // Wir machen hier kein continue, sondern versuchen das Item direkt zu verarbeiten
        }

        // 3. Error Retry Begrenzung
        if (item.status === 'error' && item.attempts >= MAX_ATTEMPTS) {
          console.log(`[ProjectSync] --- CONTINUE REASON: skipped_max_attempts (${item.projectId}) ---`);
          continue;
        }

        // 4. Payload Too Large Check
        if (item.lastError === 'payload_too_large') {
          console.log(`[ProjectSync] --- CONTINUE REASON: skipped_payload_too_large (${item.projectId}) ---`);
          continue;
        }

        // Nur pending, error oder blocked_by_session verarbeiten
        if (item.status !== 'pending' && item.status !== 'error' && item.status !== 'blocked_by_session') {
          continue;
        }

        if (!supabase) {
          throw new Error('Supabase client ist nicht initialisiert.');
        }

        const originalSizeKB = getPayloadSizeKB(item.data);
        let finalPayload = item.data;
        let finalSizeKB = originalSizeKB;

        // Strip Bilder falls > 1MB
        if (originalSizeKB > 1024) {
          finalPayload = safeStripImagePayload(item.data);
          finalSizeKB = getPayloadSizeKB(finalPayload);
          console.log(`[ProjectSync] ${item.projectId} strip: ${originalSizeKB.toFixed(2)}KB -> ${finalSizeKB.toFixed(2)}KB`);
        }

        // Abbruch falls immer noch > 2MB
        if (finalSizeKB > 2048) {
          console.warn(`[ProjectSync] --- CONTINUE REASON: skipped_payload_too_large_after_strip (${item.projectId}: ${finalSizeKB.toFixed(2)}KB) ---`);
          item.status = 'error';
          item.lastError = 'payload_too_large';
          item.attempts = (item.attempts || 0) + 1;
          await updateItemStatus(item);
          continue; 
        }

        console.log(`[ProjectSync] ${item.projectId} upsert started (attempts: ${item.attempts}, size: ${finalSizeKB.toFixed(2)}KB)`);
        
        // ── SESSION GUARD ──────────────────────────────────────────
        // Prüfen ob diese Session noch Owner ist
        const myToken = sessionStorage.getItem('qtool_session_token');
        if (myToken) {
          const { data: sessions } = await supabase
            .from('project_sessions')
            .select('session_token, started_at')
            .eq('open_project_id', item.projectId);
            
          if (sessions && sessions.length > 0) {
            const sorted = sessions.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
            const owner = sorted[0];
            if (owner.session_token !== myToken) {
              console.warn(`[QSync] session blocked: ${item.projectId} (not owner)`);
              item.status = 'blocked_by_session';
              item.lastError = 'blocked_by_session';
              await updateItemStatus(item);
              continue;
            }
          }
        }
        // ───────────────────────────────────────────────────────────

        item.status = 'syncing';
        await updateItemStatus(item);

        const { error } = await upsertWithTimeout(supabase, finalPayload, item.projectId, item.attempts || 0);

        if (error) {
          throw error;
        }

        console.log(`[ProjectSync] ${item.projectId} upsert success`);
        item.status = 'synced';
        item.lastError = null;
        await updateItemStatus(item);

      } catch (err) {
        const isTimeout = err.message === 'timeout';
        console.warn(`[ProjectSync] --- CONTINUE REASON: ${isTimeout ? 'timeout' : 'upsert_failed'} (${item.projectId}): ${err.message} ---`);
        
        item.status = 'error';
        item.lastError = isTimeout ? 'timeout' : err.message;
        item.attempts = (item.attempts || 0) + 1;
        await updateItemStatus(item);
        // Continue erfolgt automatisch durch Ende des Blocks
      }
    }
  } catch (e) {
    console.error('[ProjectSync] Kritischer Queue-Fehler:', e);
  } finally {
    _isProcessing = false;
  }
}
