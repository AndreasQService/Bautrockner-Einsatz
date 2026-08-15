import { test, expect } from '@playwright/test';

const PROJECT_ID = 'PW-OFFLINE-40-IMAGES';
const IMAGE_COUNT = 40;
const IMAGE_BYTES = 256 * 1024;

type StoredEvidence = {
  transactionId: string;
  snapshotChecksum: string;
  blobEvidence: Array<{ blobId: string; checksum: string; size: number; entityId: string }>;
};

test.describe('P0 browser IndexedDB durability', () => {
  test('40 images survive offline work, abrupt page close and reload with exact hashes', async ({ context }) => {
    test.setTimeout(120_000);
    // The durability proof is intentionally cloud-independent. This also makes
    // accidental access to Test or Live Supabase/OneDrive impossible.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
      else await route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    await page.goto('/');

    await page.evaluate(async () => {
      const { closeOfflineDatabase, OFFLINE_DB_NAME } = await import('/src/lib/offline/db.js');
      await closeOfflineDatabase();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB cleanup blocked'));
      });
    });

    await context.setOffline(true);
    const evidence = await page.evaluate(async ({ projectId, imageCount, imageBytes }): Promise<StoredEvidence> => {
      const { createOfflineTransaction } = await import('/src/lib/offline/transactionStore.js');
      const digest = async (blob: Blob) => {
        const value = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      };
      const blobs = [];
      const operations = [];
      const images = [];
      const blobEvidence = [];
      for (let index = 0; index < imageCount; index += 1) {
        const bytes = new Uint8Array(imageBytes);
        for (let offset = 0; offset < bytes.length; offset += 1) bytes[offset] = (index * 31 + offset * 17) & 0xff;
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const blobId = `pw-blob-${index}`;
        const entityId = `pw-image-${index}`;
        const checksum = await digest(blob);
        blobs.push({ blobId, entityId, kind: 'damage-image', blob, checksum });
        operations.push({ type: 'image.upload', entityId, blobId, payload: { index } });
        images.push({ id: entityId, offlineBlobId: blobId, checksum, size: blob.size });
        blobEvidence.push({ blobId, entityId, checksum, size: blob.size });
      }
      const snapshot = {
        id: projectId,
        projectTitle: 'Playwright durable 40-image proof',
        description: 'OFFLINE_TEXT_MUST_SURVIVE',
        rooms: [{ id: 'room-1', name: 'Lager 1', measurements: [{ id: 'm-1', wall: 87, floor: 64 }] }],
        measurementProtocols: [{ id: 'protocol-1', notes: 'OFFLINE_PROTOCOL_MUST_SURVIVE' }],
        images,
      };
      const manifest = await createOfflineTransaction({ projectId, snapshot, blobs, operations });
      return { transactionId: manifest.transactionId, snapshotChecksum: manifest.snapshotChecksum, blobEvidence };
    }, { projectId: PROJECT_ID, imageCount: IMAGE_COUNT, imageBytes: IMAGE_BYTES });

    // An abrupt close models iPad Safari being killed; no graceful cleanup runs.
    await page.close({ runBeforeUnload: false });
    await context.setOffline(false);

    const recoveredPage = await context.newPage();
    await recoveredPage.goto('/');
    const recovered = await recoveredPage.evaluate(async ({ projectId, evidence }) => {
      const { closeOfflineDatabase, openOfflineDatabase, OFFLINE_STORES } = await import('/src/lib/offline/db.js');
      const { getTransactionManifest, getTransactionSnapshot } = await import('/src/lib/offline/transactionStore.js');
      const { sha256CanonicalProjectContent } = await import('/src/lib/offline/canonicalDigest.js');
      await closeOfflineDatabase();
      const manifest = await getTransactionManifest(evidence.transactionId);
      const snapshot = await getTransactionSnapshot(evidence.transactionId);
      const db = await openOfflineDatabase();
      const rows = await db.getAllFromIndex(OFFLINE_STORES.BLOBS, 'by-transaction', evidence.transactionId);
      const digest = async (blob: Blob) => {
        const value = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      };
      const blobs = await Promise.all(rows.map(async row => ({
        blobId: row.blobId,
        entityId: row.entityId,
        size: row.blob.size,
        checksum: await digest(row.blob),
      })));
      return {
        manifest,
        projectId: snapshot?.data?.id,
        description: snapshot?.data?.description,
        protocol: snapshot?.data?.measurementProtocols?.[0]?.notes,
        measurement: snapshot?.data?.rooms?.[0]?.measurements?.[0],
        snapshotChecksum: await sha256CanonicalProjectContent(snapshot?.data),
        blobs,
        pendingCount: (await db.getAllFromIndex(OFFLINE_STORES.OUTBOX, 'by-project', projectId)).length,
      };
    }, { projectId: PROJECT_ID, evidence });

    expect(recovered.manifest.localConfirmedAt).toBeTruthy();
    expect(recovered.projectId).toBe(PROJECT_ID);
    expect(recovered.description).toBe('OFFLINE_TEXT_MUST_SURVIVE');
    expect(recovered.protocol).toBe('OFFLINE_PROTOCOL_MUST_SURVIVE');
    expect(recovered.measurement).toEqual({ id: 'm-1', wall: 87, floor: 64 });
    expect(recovered.snapshotChecksum).toBe(evidence.snapshotChecksum);
    expect(recovered.pendingCount).toBe(IMAGE_COUNT);
    expect(recovered.blobs).toHaveLength(IMAGE_COUNT);
    expect(recovered.blobs.sort((a, b) => a.blobId.localeCompare(b.blobId)))
      .toEqual(evidence.blobEvidence.sort((a, b) => a.blobId.localeCompare(b.blobId)));
  });
});
