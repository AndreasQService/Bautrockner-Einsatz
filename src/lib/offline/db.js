import { openDB } from 'idb';

export const OFFLINE_DB_NAME = 'qtool-offline-transactions';
export const OFFLINE_DB_VERSION = 2;

export const OFFLINE_STORES = Object.freeze({
  TRANSACTIONS: 'transactions',
  SNAPSHOTS: 'projectSnapshots',
  BLOBS: 'blobs',
  OUTBOX: 'outbox',
  SESSIONS: 'projectSessions',
});

let databasePromise;

export function openOfflineDatabase() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB ist auf diesem Gerät nicht verfügbar');
  }

  if (!databasePromise) {
    databasePromise = openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (db.objectStoreNames.contains(OFFLINE_STORES.TRANSACTIONS)) {
          if (!db.objectStoreNames.contains(OFFLINE_STORES.SESSIONS)) {
            const sessions = db.createObjectStore(OFFLINE_STORES.SESSIONS, { keyPath: 'projectId' });
            sessions.createIndex('by-state', 'state');
            sessions.createIndex('by-updated', 'updatedAt');
          }
          return;
        }
        const transactions = db.createObjectStore(OFFLINE_STORES.TRANSACTIONS, {
          keyPath: 'transactionId',
        });
        transactions.createIndex('by-project', 'projectId');
        transactions.createIndex('by-status', 'status');
        transactions.createIndex('by-created', 'createdAt');

        const snapshots = db.createObjectStore(OFFLINE_STORES.SNAPSHOTS, {
          keyPath: 'transactionId',
        });
        snapshots.createIndex('by-project', 'projectId');
        snapshots.createIndex('by-updated', 'updatedAt');

        const blobs = db.createObjectStore(OFFLINE_STORES.BLOBS, { keyPath: 'blobId' });
        blobs.createIndex('by-transaction', 'transactionId');
        blobs.createIndex('by-project', 'projectId');

        const outbox = db.createObjectStore(OFFLINE_STORES.OUTBOX, {
          keyPath: 'operationId',
        });
        outbox.createIndex('by-transaction', 'transactionId');
        outbox.createIndex('by-project', 'projectId');
        outbox.createIndex('by-status', 'status');
        outbox.createIndex('by-idempotency', 'idempotencyKey', { unique: true });
        outbox.createIndex('by-next-attempt', 'nextAttemptAt');

        const sessions = db.createObjectStore(OFFLINE_STORES.SESSIONS, { keyPath: 'projectId' });
        sessions.createIndex('by-state', 'state');
        sessions.createIndex('by-updated', 'updatedAt');
      },
      blocked() {
        console.warn('[OfflineFirst] Datenbank-Upgrade durch einen offenen Tab blockiert');
      },
      blocking() {
        databasePromise?.then((db) => db.close());
        databasePromise = undefined;
      },
      terminated() {
        databasePromise = undefined;
      },
    });
  }
  return databasePromise;
}

export async function closeOfflineDatabase() {
  if (!databasePromise) return;
  const db = await databasePromise;
  db.close();
  databasePromise = undefined;
}
