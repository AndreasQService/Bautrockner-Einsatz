/**
 * uploadWorker.js
 * Zentraler Queue-Worker für OneDrive-Uploads
 *
 * Architektur-Regeln:
 *   • Kein Bild wird "direkt" hochgeladen – NUR über diesen Worker
 *   • Upload gilt erst als fertig wenn OneDrive 200/201 + remoteItemId zurückgibt
 *   • Jede Unterbrechung → Session-Status per nextExpectedRanges prüfen
 *   • Jeder Fehler → sichtbarer Status, kein stilles catch {}
 *   • Retry: max. MAX_RETRIES Versuche mit Exponential-Backoff
 *   • Rate-Limiting: 429 / 503 → warten und wiederholen
 *   • Concurrency: max. maxParallel gleichzeitige Uploads
 */

import {
  getPendingItems,
  getUploadBlob,
  getUploadItem,
  putUploadItem,
} from './db.js';
import {
  createUploadSession,
  getUploadSessionStatus,
  uploadChunk,
} from './oneDriveApi.js';

// ─── Konstanten ───────────────────────────────────────────────────────────────

/** Chunk-Grösse: 5 MB (müssen Vielfache von 327680 = 320 KiB sein) */
const CHUNK_SIZE  = 5 * 320 * 1024; // 1.6 MB – bewährt für mobile Verbindungen
const MAX_RETRIES = 5;

/** Backoff in ms: Versuch 0→1s, 1→2s, 2→4s, 3→8s, 4→16s */
function backoffMs(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

/**
 * Aktualisiert ein UploadItem in der DB mit Patch-Feldern
 * @param {import('./queueTypes').UploadItem} item
 * @param {Partial<import('./queueTypes').UploadItem>} patch
 * @returns {Promise<import('./queueTypes').UploadItem>}
 */
async function updateItem(item, patch) {
  const next = { ...item, ...patch, updatedAt: nowIso() };
  await putUploadItem(next);
  return next;
}

/**
 * Parst den nächsten erwarteten Start-Offset aus nextExpectedRanges
 * @param {string[]} [ranges]
 * @returns {number}
 */
function parseNextStart(ranges) {
  if (!ranges?.length) return 0;
  const [start] = ranges[0].split('-');
  return Number(start || 0);
}

/**
 * Wartet auf Retry-Backoff – respektiert Retry-After Header
 * @param {number} retryCount
 * @param {number} [retryAfterMs]
 */
async function waitBackoff(retryCount, retryAfterMs) {
  const delay = retryAfterMs ?? backoffMs(retryCount);
  console.info(`[Worker] ⏳ Backoff ${delay}ms (Versuch ${retryCount + 1})`);
  await new Promise((r) => setTimeout(r, delay));
}

// ─── Kernlogik: Ein einzelnes Item uploaden ───────────────────────────────────

/**
 * Verarbeitet ein einzelnes UploadItem vollständig.
 * Gibt das aktualisierte Item zurück.
 *
 * @param {string}   itemId
 * @param {Function} [onStatusChange]  Callback(item) bei Statusänderung
 * @returns {Promise<import('./queueTypes').UploadItem>}
 */
export async function processUploadItem(itemId, onStatusChange) {
  let item = await getUploadItem(itemId);
  if (!item) throw new Error(`[Worker] UploadItem ${itemId} nicht in DB gefunden`);

  // Blob laden
  const blob = await getUploadBlob(item.id);
  if (!blob) {
    item = await updateItem(item, {
      status:       'failed',
      errorMessage: 'Lokaler Blob fehlt – Upload nicht möglich. Bitte Datei erneut auswählen.',
    });
    onStatusChange?.(item);
    return item;
  }

  // ─── Upload-Session anlegen oder fortsetzen ────────────────────────────────
  try {
    // (A) Neue Session anlegen, wenn keine vorhanden
    if (!item.uploadSessionUrl) {
      item = await updateItem(item, {
        status:       'creating_session',
        errorMessage: undefined,
      });
      onStatusChange?.(item);

      const session = await createUploadSession(item.remotePath);

      item = await updateItem(item, {
        uploadSessionUrl:   session.uploadUrl,
        nextExpectedRanges: session.nextExpectedRanges ?? ['0-'],
        status:             'uploading',
      });
      onStatusChange?.(item);
    }

    // (B) Laufenden Upload fortsetzen: Session-Status abfragen
    if (item.bytesUploaded > 0) {
      try {
        const state = await getUploadSessionStatus(item.uploadSessionUrl);
        const resumeStart = parseNextStart(state.nextExpectedRanges);

        item = await updateItem(item, {
          nextExpectedRanges: state.nextExpectedRanges,
          bytesUploaded:      resumeStart,
          status:             'uploading',
        });
        onStatusChange?.(item);

      } catch (sessionErr) {
        // Session abgelaufen → neu anlegen, von vorne
        console.warn('[Worker] Session abgelaufen, neue Session wird erstellt:', sessionErr.message);
        item = await updateItem(item, {
          uploadSessionUrl:   undefined,
          nextExpectedRanges: undefined,
          bytesUploaded:      0,
          status:             'pending_resume',
        });
        onStatusChange?.(item);
        // Rekursiver Aufruf mit frischer Session
        return processUploadItem(itemId, onStatusChange);
      }
    }

    // ─── Chunk-Upload-Schleife ─────────────────────────────────────────────
    let start = item.bytesUploaded;

    while (start < blob.size) {
      const endExclusive  = Math.min(start + CHUNK_SIZE, blob.size);
      const chunk         = await blob.slice(start, endExclusive).arrayBuffer();
      const endInclusive  = endExclusive - 1;

      let chunkRes;
      let chunkAttempt = 0;

      // Retry-Schleife für einzelnen Chunk
      while (true) {
        try {
          chunkRes = await uploadChunk(
            item.uploadSessionUrl,
            chunk,
            start,
            endInclusive,
            blob.size
          );
          break; // Erfolgreich

        } catch (chunkErr) {
          const msg = chunkErr.message || '';
          const is429 = msg.includes('429');
          const is5xx = msg.includes('503') || msg.includes('500') || msg.includes('502') || msg.includes('504');

          if ((is429 || is5xx) && chunkAttempt < MAX_RETRIES) {
            chunkAttempt++;
            const retryAfterMs = is429 ? 60_000 : undefined;
            await waitBackoff(chunkAttempt, retryAfterMs);
            continue;
          }

          // Nicht-retriable oder Limit erreicht → Item auf failed
          item = await updateItem(item, {
            status:       'failed',
            errorMessage: `Chunk-Upload bei Byte ${start}: ${msg}`,
            retryCount:   item.retryCount + 1,
          });
          onStatusChange?.(item);
          return item;
        }
      }

      // ── 202: Chunk angenommen, weiter ─────────────────────────────────────
      if (chunkRes.status === 202) {
        const body = await chunkRes.json().catch(() => ({}));
        const nextStart = parseNextStart(body.nextExpectedRanges) || endExclusive;

        item = await updateItem(item, {
          status:             'uploading',
          nextExpectedRanges: body.nextExpectedRanges,
          bytesUploaded:      nextStart,
        });
        onStatusChange?.(item);
        start = nextStart;
        continue;
      }

      // ── 200 / 201: Upload abgeschlossen ────────────────────────────────────
      if (chunkRes.status === 200 || chunkRes.status === 201) {
        const body = await chunkRes.json().catch(() => ({}));

        item = await updateItem(item, {
          status:             'uploaded_unverified',
          bytesUploaded:      blob.size,
          remoteItemId:       body.id       ?? undefined,
          remoteETag:         body.eTag     ?? undefined,
          nextExpectedRanges: [],
        });
        onStatusChange?.(item);
        return item;
      }
    }

    // Falls loop ohne 200/201 endet (sollte nicht passieren)
    return item;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextRetryCount = (item.retryCount || 0) + 1;
    item = await updateItem(item, {
      status:       'failed',
      errorMessage: message,
      retryCount:   nextRetryCount,
      nextAttemptAt: new Date(Date.now() + Math.min(15 * 60 * 1000, backoffMs(nextRetryCount))).toISOString(),
    });
    onStatusChange?.(item);
    return item;
  }
}

// ─── Queue-Lauf: Alle ausstehenden Items mit Concurrency-Limit ────────────────

/**
 * Verarbeitet alle ausstehenden Upload-Items mit begrenzter Parallelität.
 *
 * Kandidaten für den Lauf:
 *   persisted | pending_resume | failed (dauerhaft, mit persistiertem Backoff)
 *
 * Items in 'uploaded_unverified' werden NICHT hier verarbeitet –
 * das ist Aufgabe des Reconcile-Workers.
 *
 * @param {object} options
 * @param {number}   [options.maxParallel=2]   Maximale parallele Uploads
 * @param {Function} [options.onItemChange]    Callback(item) bei Statusänderung
 * @returns {Promise<void>}
 */
export async function runUploadWorker({ maxParallel = 2, onItemChange } = {}) {
  const pending = await getPendingItems();

  // Kandidaten filtern: nur was der Worker anfassen soll
  const candidates = pending.filter((i) => {
    if (i.status === 'uploaded_unverified') return false; // → Reconcile
    if (i.terminalFailure === true) return false;
    if (i.nextAttemptAt && Date.parse(i.nextAttemptAt) > Date.now()) return false;
    return true;
  });

  if (!candidates.length) {
    console.info('[Worker] Keine ausstehenden Uploads.');
    return;
  }

  console.info(`[Worker] 🚀 Starte ${candidates.length} Uploads (max. ${maxParallel} parallel)`);

  const queue   = [...candidates];
  const running = new Set();

  async function startNext() {
    const next = queue.shift();
    if (!next) return;

    const promise = processUploadItem(next.id, onItemChange)
      .catch((err) => {
        console.error(`[Worker] Unerwarteter Fehler bei ${next.id}:`, err);
      })
      .finally(() => {
        running.delete(promise);
        // Nächstes Item starten, sobald Slot frei
        if (queue.length > 0) startNext();
      });

    running.add(promise);
  }

  // Initialen Pool befüllen
  const initialCount = Math.min(maxParallel, candidates.length);
  for (let i = 0; i < initialCount; i++) {
    await startNext();
  }

  // Warten bis alle fertig
  await new Promise((resolve) => {
    const check = () => {
      if (running.size === 0 && queue.length === 0) {
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });

  console.info('[Worker] ✅ Queue-Lauf abgeschlossen');
}
