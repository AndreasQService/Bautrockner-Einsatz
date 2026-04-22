/**
 * useUploadQueue.js
 * React Hook für durable OneDrive-Uploads
 *
 * Zuständigkeiten:
 *   • addFiles(): Dateien entgegennehmen → in IndexedDB persistieren → Worker starten
 *   • processAll(): Worker + Reconciliation laufen lassen
 *   • refresh(): Queue-State aus DB neu laden
 *   • items: Live-Status aller Items des Projekts
 *   • summary: aggregierte Batch-Übersicht
 *
 * WICHTIG:
 *   • Kein Upload findet im UI-Component statt
 *   • Kein "success" wird angezeigt, bevor reconcile verified sagt
 *   • Online-Event → automatische Wiederaufnahme
 *   • App-Start → ausstehende Items werden erkannt + repariert
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueFiles }       from './queueRepository.js';
import { runUploadWorker }    from './uploadWorker.js';
import {
  reconcileProject,
  getProjectSummary,
  repairHangingItems,
} from './reconcile.js';
import { getItemsByProject }  from './db.js';
import { getActiveAccount }   from '../onedrive/auth.js';

/**
 * @typedef {Object} UseUploadQueueReturn
 * @property {import('./queueTypes').UploadItem[]} items           Alle Items des Projekts
 * @property {object}   summary          Aggregierte Batch-Zahlen
 * @property {boolean}  isBusy           Worker läuft gerade
 * @property {boolean}  isOneDriveReady  Token verfügbar
 * @property {Function} addFiles         (files: File[]) → persist + start
 * @property {Function} processAll       () → worker + reconcile + refresh
 * @property {Function} refresh          () → DB neu laden
 */

/**
 * @param {string} projectId     QTool Projekt-ID
 * @param {string} remoteFolder  OneDrive-Zielpfad, z.B. "QTool/20260236_Muster/Fotos"
 * @returns {UseUploadQueueReturn}
 */
export function useUploadQueue(projectId, remoteFolder) {
  const [items,          setItems]          = useState([]);
  const [summary,        setSummary]        = useState(null);
  const [isBusy,         setIsBusy]         = useState(false);
  const [isOneDriveReady, setIsOneDriveReady] = useState(false);

  const busyRef = useRef(false);

  // ─── OneDrive-Status prüfen ─────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsOneDriveReady(!!getActiveAccount());
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // ─── DB → State ─────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!projectId) return;
    const all = await getItemsByProject(projectId);
    setItems(all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));

    const s = await getProjectSummary(projectId);
    setSummary(s);
  }, [projectId]);

  // ─── Worker + Reconcile laufen lassen ───────────────────────────────────────
  const processAll = useCallback(async () => {
    if (busyRef.current) return; // Nie zwei Worker gleichzeitig
    busyRef.current = true;
    setIsBusy(true);

    try {
      await runUploadWorker({
        maxParallel:  2,
        onItemChange: () => refresh(), // sofortige UI-Aktualisierung pro Chunk
      });
      await reconcileProject(projectId);
      await refresh();
    } catch (err) {
      console.error('[useUploadQueue] Worker-Fehler:', err);
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, [projectId, refresh]);

  // ─── Dateien entgegennehmen und persistieren ─────────────────────────────────
  const addFiles = useCallback(async (files) => {
    if (!files?.length) return;

    await enqueueFiles(
      projectId,
      Array.from(files),
      remoteFolder,
      () => refresh() // Live-Update nach jeder Datei
    );

    await refresh();

    // Sofort mit Upload beginnen
    void processAll();
  }, [projectId, remoteFolder, refresh, processAll]);

  // ─── App-Start: hängende Items reparieren ────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;

    (async () => {
      const repaired = await repairHangingItems();
      if (repaired > 0) {
        console.info(`[useUploadQueue] 🔧 ${repaired} hängende Items repariert`);
        await refresh();
      } else {
        await refresh();
      }

      // Nach Reparatur: ausstehende Uploads starten wenn OneDrive bereit
      if (getActiveAccount()) {
        void processAll();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ─── Online-Event: automatisch fortsetzen ────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      console.info('[useUploadQueue] 🌐 Online erkannt → Uploads fortsetzen');
      void processAll();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [processAll]);

  return {
    items,
    summary,
    isBusy,
    isOneDriveReady,
    addFiles,
    processAll,
    refresh,
  };
}
