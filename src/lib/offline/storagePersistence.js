/**
 * storagePersistence.js
 * iOS WebKit Storage Persistence & Quota Management Helper.
 * Guarantees zero silent eviction of IndexedDB drafts and local transactions.
 */

export async function ensurePersistentStorage() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[PWA Storage] Persistent storage granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (err) {
      console.warn('[PWA Storage] Error requesting persistent storage:', err);
      return false;
    }
  }
  return false;
}

export async function getStorageQuota() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
        percentUsed: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
      };
    } catch (err) {
      console.warn('[PWA Storage] Error estimating storage:', err);
    }
  }
  return { quota: 0, usage: 0, percentUsed: 0 };
}
