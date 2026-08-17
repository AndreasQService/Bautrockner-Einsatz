import {
  claimPendingOperations,
  getOfflineBlob,
  getTransactionSnapshot,
  setOperationStatus,
} from './transactionStore.js';
import { OFFLINE_STATES } from './states.js';
import { hasActiveProjectSession } from './projectSessionStore.js';

const handlers = new Map();
let runningPromise = null;
let lifecycleCleanup = null;
let retryTimer = null;

export class OutboxConflictError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'OutboxConflictError';
    this.code = 'OUTBOX_CONFLICT';
    this.details = details;
  }
}

export function registerOutboxHandler(type, handler) {
  if (typeof type !== 'string' || !type) throw new TypeError('Outbox-Typ ist erforderlich');
  if (typeof handler !== 'function') throw new TypeError(`Handler für ${type} muss eine Funktion sein`);
  handlers.set(type, handler);
  return () => {
    if (handlers.get(type) === handler) handlers.delete(type);
  };
}

export function getRegisteredOutboxTypes() {
  return [...handlers.keys()];
}

function findHandler(type) {
  return handlers.get(type) || [...handlers.entries()]
    .find(([registered]) => registered.endsWith('.*') && type.startsWith(registered.slice(0, -1)))?.[1];
}

const retryAt = (attempt) => new Date(Date.now() + Math.min(5 * 60_000, 2 ** Math.min(attempt, 8) * 1_000));

async function executeClaimed(operation) {
  const handler = findHandler(operation.type);
  if (!handler) {
    // Kein Handler ist kein Datenfehler. Lease freigeben und später erneut versuchen.
    await setOperationStatus(operation.operationId, OFFLINE_STATES.QUEUED, {
      retryAt: retryAt(operation.attemptCount),
    });
    return { operationId: operation.operationId, status: 'deferred', reason: 'handler_missing' };
  }

  try {
    const [snapshot, blob] = await Promise.all([
      getTransactionSnapshot(operation.transactionId),
      operation.blobId ? getOfflineBlob(operation.blobId) : null,
    ]);
    const result = await handler({ operation, snapshot, blob });
    if (result?.conflict) {
      throw new OutboxConflictError(result.message || 'Versionskonflikt', result.details);
    }
    // Cloud-Erfolg allein reicht nicht: Handler muss Readback/Prüfsumme/Version explizit bestätigen.
    if (result?.verified !== true) {
      throw Object.assign(new Error('Cloud-Zustand wurde nicht verifiziert'), { code: 'UNVERIFIED_CLOUD_STATE' });
    }
    await setOperationStatus(operation.operationId, OFFLINE_STATES.CLOUD_CONFIRMED);
    return { operationId: operation.operationId, status: OFFLINE_STATES.CLOUD_CONFIRMED, evidence: result.evidence || null };
  } catch (error) {
    if (error instanceof OutboxConflictError || error?.code === 'OUTBOX_CONFLICT') {
      await setOperationStatus(operation.operationId, OFFLINE_STATES.CONFLICT, { error });
      return { operationId: operation.operationId, status: OFFLINE_STATES.CONFLICT };
    }
    const retryable = error?.retryable !== false && error?.code !== 'UNVERIFIED_CLOUD_STATE';
    await setOperationStatus(operation.operationId, OFFLINE_STATES.FAILED, { error });
    if (retryable) {
      await setOperationStatus(operation.operationId, OFFLINE_STATES.QUEUED, {
        retryAt: retryAt(operation.attemptCount),
      });
    }
    return { operationId: operation.operationId, status: retryable ? OFFLINE_STATES.QUEUED : OFFLINE_STATES.FAILED, error };
  }
}

export async function runOfflineOutboxOnce({ limit = 10, allowDuringProjectSession = false, projectId = null, forceLeaseReset = false } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { claimed: 0, results: [], skipped: 'offline' };
  }
  if (!allowDuringProjectSession && await hasActiveProjectSession()) {
    return { claimed: 0, results: [], skipped: 'active_project_session' };
  }
  const claimed = await claimPendingOperations({ limit, projectId, forceLeaseReset: true });
  const results = [];
  for (const operation of claimed) results.push(await executeClaimed(operation));
  return { claimed: claimed.length, results };
}

export function triggerOfflineOutboxSync(reason = 'manual', { projectId = null } = {}) {
  if (runningPromise) return runningPromise;
  runningPromise = runOfflineOutboxOnce({ allowDuringProjectSession: reason === 'project_exit', projectId })
    .then((result) => ({ ...result, reason }))
    .finally(() => { runningPromise = null; });
  return runningPromise;
}

/** Explicit immediate drain attempt for manual "Sync Now" or iOS Standby Wakeup */
export async function drainOutboxImmediately(reason = 'manual_sync_now', options = {}) {
  return triggerOfflineOutboxSync(reason, options);
}

export function startOfflineOutboxWorker({ intervalMs = 30_000 } = {}) {
  if (lifecycleCleanup || typeof window === 'undefined') return lifecycleCleanup || (() => {});
  const trigger = (reason) => void triggerOfflineOutboxSync(reason).catch((error) => {
    console.warn('[OfflineOutbox] Worker-Durchlauf fehlgeschlagen:', error);
  });
  const onOnline = () => trigger('online_wakeup');
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      trigger('ios_visibility_wakeup');
    }
  };
  const onPageshow = (e) => {
    if (e.persisted) {
      trigger('ios_bfcache_wakeup');
    }
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageshow);

  retryTimer = window.setInterval(() => trigger('interval'), intervalMs);
  trigger('app_start');

  lifecycleCleanup = () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageshow);
    if (retryTimer) window.clearInterval(retryTimer);
    retryTimer = null;
    lifecycleCleanup = null;
  };
  return lifecycleCleanup;
}

export function stopOfflineOutboxWorker() {
  lifecycleCleanup?.();
}
