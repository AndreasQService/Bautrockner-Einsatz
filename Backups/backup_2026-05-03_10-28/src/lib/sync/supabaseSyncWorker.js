/**
 * supabaseSyncWorker.js
 * Variante C: Lokale Blobs → Supabase Storage + Journal
 *
 * Kein OneDrive-Login nötig. Kein MSAL.
 * Techniker synchronisiert zu Supabase → Backend übernimmt Rest.
 */

import { supabase } from '../../supabaseClient.js';

const SYNC_FLAG = 'qtool_sync_running';

/**
 * Alle ausstehenden Blobs aus der alten PhotoStorage-DB nach Supabase hochladen.
 * Erstellt/aktualisiert Journal-Eintrag in project_image_uploads.
 *
 * @returns {Promise<{synced: number, failed: number}>}
 */
export async function syncPendingToSupabase() {
  // Schutz vor parallelen Runs
  if (sessionStorage.getItem(SYNC_FLAG) === '1') return { synced: 0, failed: 0 };
  sessionStorage.setItem(SYNC_FLAG, '1');

  let synced = 0;
  let failed = 0;

  try {
    // Alte qtool-photos DB öffnen
    const photos = await getOldPendingPhotos();
    if (!photos.length) return { synced: 0, failed: 0 };

    for (const photo of photos) {
      try {
        await syncOnePhoto(photo);
        synced++;
      } catch (err) {
        failed++;
        console.warn('[SyncWorker] Foto fehlgeschlagen:', photo.id, err.message);
      }
    }

    if (synced > 0) {
      console.info(`[SyncWorker] ✅ ${synced} Fotos zu Supabase synchronisiert`);
    }
  } finally {
    sessionStorage.removeItem(SYNC_FLAG);
  }

  return { synced, failed };
}

/**
 * Ein einzelnes Foto zu Supabase Storage hochladen + Journal-Eintrag anlegen
 */
async function syncOnePhoto(photo) {
  if (!supabase) throw new Error('Supabase nicht verfügbar');
  if (!photo.blob) throw new Error('Kein Blob');

  const ext      = photo.name?.split('.').pop() || 'jpg';
  const sha256   = photo.sha256 || photo.id;
  const storagePath = `${photo.projectId || 'unbekannt'}/${sha256}.${ext}`;

  // Supabase Storage Upload (idempotent dank SHA-256-Pfad)
  const { error: uploadErr } = await supabase.storage
    .from('project-images')
    .upload(storagePath, photo.blob, {
      contentType: photo.type || 'image/jpeg',
      upsert: true,                            // Duplikat → überschreiben
    });

  if (uploadErr && uploadErr.statusCode !== '409') {
    throw new Error(`Storage: ${uploadErr.message}`);
  }

  // Journal-Eintrag in project_image_uploads anlegen/aktualisieren
  const { error: journalErr } = await supabase
    .from('project_image_uploads')
    .upsert({
      local_image_id:  photo.id,
      project_id:      photo.projectId || 'unbekannt',
      filename:        photo.name || 'foto.jpg',
      mime_type:       photo.type || 'image/jpeg',
      size_bytes:      photo.size || photo.blob?.size || 0,
      sha256:          sha256,
      storage_path:    storagePath,
      storage_status:  'uploaded_to_backend',
      updated_at:      new Date().toISOString(),
    }, {
      onConflict: 'local_image_id',
      ignoreDuplicates: false,
    });

  if (journalErr) {
    // Journal-Fehler ist nicht kritisch – Bild ist trotzdem in Storage
    console.warn('[SyncWorker] Journal-Fehler (Bild ist trotzdem gesichert):', journalErr.message);
  }

  // Altes PhotoStorage-Flag aktualisieren (syncStatus → 'synced')
  await markOldPhotoSynced(photo.id);
}

// ─── Helpers für alten qtool-photos Store ────────────────────────────────────

async function getOldPendingPhotos() {
  return new Promise((resolve) => {
    const req = indexedDB.open('qtool-photos');
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) { resolve([]); return; }
      const tx    = db.transaction('photos', 'readonly');
      const all   = tx.objectStore('photos').getAll();
      all.onsuccess = () => resolve(
        (all.result || []).filter(p =>
          (p.syncStatus === 'pending' || p.syncStatus === 'error' || !p.syncStatus) &&
          !p.oneDriveItemId
        )
      );
      all.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
    req.onupgradeneeded = (e) => { e.target.result.close(); resolve([]); };
  });
}

async function markOldPhotoSynced(photoId) {
  return new Promise((resolve) => {
    const req = indexedDB.open('qtool-photos');
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) { resolve(); return; }
      const tx   = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const get  = store.get(photoId);
      get.onsuccess = () => {
        const photo = get.result;
        if (photo) {
          photo.syncStatus = 'synced';
          store.put(photo);
        }
      };
      tx.oncomplete = resolve;
      tx.onerror    = resolve;
    };
    req.onerror = resolve;
  });
}
