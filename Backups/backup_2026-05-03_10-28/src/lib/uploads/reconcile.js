/**
 * reconcile.js
 * Verifikation und Abgleich: Lokale Queue vs. OneDrive-Realität
 *
 * Ein Bild gilt erst als "verified" wenn:
 *   1. Upload vollständig war (OneDrive 200/201)
 *   2. remoteItemId + remoteETag gespeichert sind
 *   3. Reconciliation bestätigt hat, dass die Datei REMOTE existiert
 *
 * Lauft:
 *   A) Nach jedem Worker-Durchlauf (für 'uploaded_unverified'-Items)
 *   B) Beim App-Start (um hängende 'uploading'-Items zu reparieren)
 *   C) Für jedes Projekt nach Batch-Abschluss
 */

import { getAllUploadItems, getItemsByProject, putUploadItem } from './db.js';
import { listFolderChildren, itemExists }                       from './oneDriveApi.js';

const nowIso = () => new Date().toISOString();

// ─── Start-Reconciliation ─────────────────────────────────────────────────────

/**
 * Beim App-Start: Repariert hängende Status aus abgebrochenen Sitzungen.
 *
 * Regeln:
 *   'persisting'     → war mitten in lokaler Persistierung → 'failed'
 *   'creating_session' → Session nie erstellt → 'persisted' (kann neu starten)
 *   'uploading'      → Verbindung abgebrochen → 'pending_resume'
 *
 * @returns {Promise<number>} Anzahl reparierter Items
 */
export async function repairHangingItems() {
  const all   = await getAllUploadItems();
  let repaired = 0;

  for (const item of all) {
    let patch = null;

    if (item.status === 'persisting') {
      // Blob-Persistierung wurde abgebrochen → erneut versuchen nicht möglich ohne Blob
      patch = {
        status:       'failed',
        errorMessage: 'App-Absturz während lokaler Speicherung. Bitte Datei erneut auswählen.',
      };
    } else if (item.status === 'creating_session') {
      // Session wurde nie erstellt → einfach neu starten
      patch = {
        status:              'persisted',
        uploadSessionUrl:    undefined,
        nextExpectedRanges:  undefined,
        errorMessage:        undefined,
      };
    } else if (item.status === 'uploading') {
      // Mitten im Upload abgebrochen → Session prüfen lassen
      patch = {
        status: 'pending_resume',
      };
    }

    if (patch) {
      await putUploadItem({ ...item, ...patch, updatedAt: nowIso() });
      repaired++;
      console.warn(`[Reconcile] 🔧 "${item.originalName}" repariert: ${item.status} → ${patch.status}`);
    }
  }

  return repaired;
}

// ─── Folder-Reconciliation ────────────────────────────────────────────────────

/**
 * Vergleicht lokale Queue mit OneDrive-Zielordner für einen Ordner.
 *
 * Aktionen:
 *   'uploaded_unverified' + remote vorhanden    → 'verified'   ✅
 *   'uploaded_unverified' + remote FEHLT        → 'needs_repair' 🔧
 *   'verified'            + remote FEHLT        → 'needs_repair' 🔧
 *
 * @param {string}   folderPath   OneDrive-Pfad ohne trailing slash, z.B. "QTool/Projekt/Fotos"
 * @param {string[]} [itemIds]    Optional: nur diese IDs prüfen (sonst alle Items im Pfad)
 * @returns {Promise<{verified: number, needsRepair: number}>}
 */
export async function reconcileFolder(folderPath, itemIds) {
  let remoteFiles;
  try {
    const children  = await listFolderChildren(folderPath);
    // Map: name → {id, eTag}
    remoteFiles = new Map(children.map((c) => [c.name, c]));
  } catch (err) {
    console.error('[Reconcile] Ordner-Abfrage fehlgeschlagen:', err.message);
    // Wenn Graph nicht erreichbar → kein false-positive needs_repair setzen
    return { verified: 0, needsRepair: 0 };
  }

  const all   = await getAllUploadItems();
  const scope = all.filter((i) => {
    const inFolder = i.remotePath.startsWith(folderPath);
    const inIds    = !itemIds || itemIds.includes(i.id);
    return inFolder && inIds;
  });

  let verified    = 0;
  let needsRepair = 0;

  for (const item of scope) {
    const remoteEntry = remoteFiles.get(item.remoteFileName);

    if (item.status === 'uploaded_unverified') {
      if (remoteEntry?.id) {
        // Remote bestätigt → verified
        await putUploadItem({
          ...item,
          status:       'verified',
          remoteItemId: remoteEntry.id,
          remoteETag:   remoteEntry.eTag ?? item.remoteETag,
          errorMessage: undefined,
          updatedAt:    nowIso(),
        });
        verified++;
        console.info(`[Reconcile] ✅ Verifiziert: ${item.originalName}`);
      } else {
        // Remote fehlt → needs_repair
        await putUploadItem({
          ...item,
          status:       'needs_repair',
          errorMessage: 'Datei auf OneDrive nicht gefunden nach Upload.',
          updatedAt:    nowIso(),
        });
        needsRepair++;
        console.warn(`[Reconcile] ⚠️ Fehlt remote: ${item.originalName}`);
      }
    }

    if (item.status === 'verified' && !remoteEntry?.id) {
      // War verified, aber remote verschwunden
      await putUploadItem({
        ...item,
        status:       'needs_repair',
        errorMessage: 'Datei war bestätigt, fehlt jetzt remote (gelöscht?).',
        updatedAt:    nowIso(),
      });
      needsRepair++;
      console.warn(`[Reconcile] 🔧 Verified→Repair: ${item.originalName}`);
    }
  }

  return { verified, needsRepair };
}

// ─── Projekt-Reconciliation ───────────────────────────────────────────────────

/**
 * Verifikation aller 'uploaded_unverified' Items eines Projekts.
 * Gruppiert nach Zielordner für effiziente Batch-Abfragen.
 *
 * @param {string} projectId
 * @returns {Promise<{verified: number, needsRepair: number}>}
 */
export async function reconcileProject(projectId) {
  const items = await getItemsByProject(projectId);

  // Nach Zielordner gruppieren (für batch folder listing)
  const folderMap = new Map();
  for (const item of items) {
    if (!['uploaded_unverified', 'verified'].includes(item.status)) continue;

    // Ordnerpfad = remotePath ohne Dateiname
    const folder = item.remotePath.split('/').slice(0, -1).join('/');
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder).push(item.id);
  }

  let totalVerified    = 0;
  let totalNeedsRepair = 0;

  for (const [folder, ids] of folderMap.entries()) {
    const result = await reconcileFolder(folder, ids);
    totalVerified    += result.verified;
    totalNeedsRepair += result.needsRepair;
  }

  return { verified: totalVerified, needsRepair: totalNeedsRepair };
}

// ─── Zusammenfassung ─────────────────────────────────────────────────────────

/**
 * Gibt eine Batch-Zusammenfassung für ein Projekt zurück.
 * @param {string} projectId
 * @returns {Promise<{total: number, persisted: number, uploading: number,
 *                    verified: number, failed: number, needsRepair: number, pending: number}>}
 */
export async function getProjectSummary(projectId) {
  const items = await getItemsByProject(projectId);

  return {
    total:       items.length,
    persisted:   items.filter((i) => i.status === 'persisted').length,
    uploading:   items.filter((i) => ['creating_session','uploading','pending_resume'].includes(i.status)).length,
    uploaded:    items.filter((i) => i.status === 'uploaded_unverified').length,
    verified:    items.filter((i) => i.status === 'verified').length,
    failed:      items.filter((i) => i.status === 'failed').length,
    needsRepair: items.filter((i) => i.status === 'needs_repair').length,
    pending:     items.filter((i) => ['queued','persisted','pending_resume'].includes(i.status)).length,
  };
}
