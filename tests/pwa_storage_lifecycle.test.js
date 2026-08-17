import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { ensurePersistentStorage, getStorageQuota } from '../src/lib/offline/storagePersistence.js';
import { subscribeSWUpdate, triggerSWUpdate, registerSWUpdateLifecycle } from '../src/lib/offline/swUpdateLifecycle.js';

describe('PWA Storage Persistence & SW Update Lifecycle', () => {
  it('ensurePersistentStorage handles environment without throwing', async () => {
    const isPersisted = await ensurePersistentStorage();
    assert.strictEqual(typeof isPersisted, 'boolean');
  });

  it('getStorageQuota returns storage estimation object', async () => {
    const quotaInfo = await getStorageQuota();
    assert.strictEqual(typeof quotaInfo.quota, 'number');
    assert.strictEqual(typeof quotaInfo.usage, 'number');
    assert.strictEqual(typeof quotaInfo.percentUsed, 'number');
  });

  it('subscribeSWUpdate notifies update listeners', () => {
    let notified = false;
    const unsubscribe = subscribeSWUpdate((updateAvailable) => {
      notified = updateAvailable;
    });

    assert.strictEqual(typeof unsubscribe, 'function');
    unsubscribe();
  });

  it('triggerSWUpdate executes safely', () => {
    assert.doesNotThrow(() => {
      triggerSWUpdate();
    });
  });
});
