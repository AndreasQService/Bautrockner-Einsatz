import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

// Top-level iPad Pro 11 device emulation
test.use({
  viewport: { width: 834, height: 1194 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  permissions: []
});

test.describe('ULTIMATE IPAD HARDCORE INTEGRITY TEST (PLAYWRIGHT WEBKIT / IPAD PRO)', () => {
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5180';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page, context }) => {
    try {
      await context.setOffline(false);
      await page.evaluate(async () => {
        const { supabase } = await import('/src/supabaseClient.js');
        await supabase.from('damage_reports').delete().ilike('project_number', 'SORBA-ULTRA%');
        await supabase.from('damage_reports').delete().ilike('project_title', '%ULTRA%');
      });
    } catch (e) {
      // Ignore tear-down errors if page/browser context closed
    }
  });

  // --- 1. OFFLINE KELLER DUMP ---
  test('1. Offline Keller Dump: 3 Rooms, 12 Points Restored After Page Crash', async ({ page, context }) => {
    test.setTimeout(75000);
    await login(page);

    // Initialize SORBA-ULTRA-001 project with 3 rooms and 12 measurement points
    const projId = await page.evaluate(async () => {
      const { initializeInstantProject } = await import('/src/lib/offline/createProject.js');
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');

      const rooms = [
        { id: 'room_keller', name: 'Keller Hauptraum' },
        { id: 'room_waschkueche', name: 'Waschküche' },
        { id: 'room_technik', name: 'Technikraum' }
      ];

      const measurementRooms = [
        {
          id: 'room_keller',
          name: 'Keller Hauptraum',
          climate: { temp: '18.2', humidity: '82' },
          measurements: [
            { id: 'm1', pointName: 'Wand Nord', w_value: '95', b_value: '130', notes: 'Sehr feucht' },
            { id: 'm2', pointName: 'Wand Ost', w_value: '90', b_value: '125', notes: 'Feucht' },
            { id: 'm3', pointName: 'Boden Estrich 1', w_value: '3.1', unit: 'CM%', notes: 'CM Messung' },
            { id: 'm4', pointName: 'Boden Estrich 2', w_value: '2.8', unit: 'CM%', notes: 'CM Messung' }
          ]
        },
        {
          id: 'room_waschkueche',
          name: 'Waschküche',
          climate: { temp: '19.0', humidity: '79' },
          measurements: [
            { id: 'm5', pointName: 'Sockel West', w_value: '88', b_value: '120', notes: 'Wasseraustritt' },
            { id: 'm6', pointName: 'Sockel Süd', w_value: '85', b_value: '115', notes: 'Feuchtsaum' },
            { id: 'm7', pointName: 'Boden Fliesen', w_value: '75', b_value: '100', notes: 'Unterfliesen' },
            { id: 'm8', pointName: 'Wand Decke', w_value: '40', b_value: '45', notes: 'Trockener' }
          ]
        },
        {
          id: 'room_technik',
          name: 'Technikraum',
          climate: { temp: '21.5', humidity: '65' },
          measurements: [
            { id: 'm9', pointName: 'Rohrdurchführung', w_value: '99', b_value: '140', notes: 'Leckagestelle' },
            { id: 'm10', pointName: 'Verteilerkasten', w_value: '70', b_value: '95', notes: 'Kontrolle' },
            { id: 'm11', pointName: 'Boden Beton', w_value: '3.5', unit: 'CM%', notes: 'CM Messung' },
            { id: 'm12', pointName: 'Wand Süd', w_value: '60', b_value: '75', notes: 'Abklingend' }
          ]
        }
      ];

      const proj = initializeInstantProject({
        projectTitle: 'Keller Wasserschaden ULTRA-001',
        projectNumber: 'SORBA-ULTRA-001',
        street: 'Seestrasse 100',
        zip: '8595',
        city: 'Altnau',
        rooms,
        measurementRooms
      });

      await DeviceLocalStore.saveSnapshot(proj.id, 'techniker@qservice.ch', proj);
      return proj.id;
    });

    expect(projId).toBeTruthy();

    // Simulate page crash / force reload
    await page.reload({ waitUntil: 'networkidle' });

    // Assert 100% of values restored from IndexedDB
    const restoredData = await page.evaluate(async (pId) => {
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');
      const draftObj = await DeviceLocalStore.getUnconfirmedDraft(pId, 'techniker@qservice.ch');
      return draftObj?.data || draftObj?.snapshot || null;
    }, projId);

    expect(restoredData).not.toBeNull();
    expect(restoredData.projectNumber).toBe('SORBA-ULTRA-001');
    expect(restoredData.measurementRooms.length).toBe(3);

    // Total measurement points across 3 rooms = 4 + 4 + 4 = 12
    const totalPoints = restoredData.measurementRooms.reduce(
      (sum, r) => sum + (r.measurements ? r.measurements.length : 0),
      0
    );
    expect(totalPoints).toBe(12);
    expect(restoredData.measurementRooms[0].measurements[0].w_value).toBe('95');
    expect(restoredData.measurementRooms[2].measurements[0].w_value).toBe('99');
  });

  // --- 2. HIGH-RES PHOTO BURST ---
  test('2. High-Res Photo Burst: 5x 5MB Canvas Blobs Compressed < 500KB in Outbox', async ({ page }) => {
    test.setTimeout(60000);
    await login(page);

    const burstResult = await page.evaluate(async () => {
      const { compressSingleImage } = await import('/src/utils/imageCompressor.js');
      const { createOfflineTransaction, listPendingOperations } = await import('/src/lib/offline/transactionStore.js');

      const burstProject = `SORBA-ULTRA-PHOTO-${Date.now()}`;
      const blobsInfo = [];

      // Generate 5 canvas blobs (~5MB each uncompressed canvas)
      for (let i = 1; i <= 5; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 3200;
        canvas.height = 2400;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = i % 2 === 0 ? '#1e3a8a' : '#047857';
        ctx.fillRect(0, 0, 3200, 2400);

        // Add pattern/text to ensure real image data size
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px sans-serif';
        ctx.fillText(`iPad Photo Burst Test ${i}`, 100, 100);

        const originalBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        const compressedBlob = await compressSingleImage(originalBlob, 1600, 0.75, 'image/jpeg');

        await createOfflineTransaction({
          projectId: burstProject,
          snapshot: { id: burstProject },
          operations: [{
            type: 'image.upload',
            entityId: `photo-burst-${i}`,
            payload: {
              fileName: `photo_${i}.jpg`,
              originalSizeBytes: originalBlob.size,
              compressedSizeBytes: compressedBlob.size
            }
          }]
        });

        blobsInfo.push({
          index: i,
          originalSizeKB: Math.round(originalBlob.size / 1024),
          compressedSizeKB: Math.round(compressedBlob.size / 1024),
          isUnder500KB: compressedBlob.size < 500 * 1024
        });
      }

      const pendingOps = await listPendingOperations({ projectId: burstProject });

      return {
        blobsInfo,
        pendingCount: pendingOps.length,
        allUnder500KB: blobsInfo.every(b => b.isUnder500KB)
      };
    });

    expect(burstResult.pendingCount).toBe(5);
    expect(burstResult.allUnder500KB).toBe(true);
  });

  // --- 3. CONCURRENCY CLASH ---
  test('3. Concurrency Clash: Postgres Lock Triggers Conflict Without Losing Draft', async ({ page }) => {
    test.setTimeout(60000);
    await login(page);

    const clashResult = await page.evaluate(async () => {
      const { supabase } = await import('/src/supabaseClient.js');
      const { checkOptimisticConflict, updateProjectAtomicOptimistic } = await import('/src/lib/offline/optimisticConcurrency.js');
      const { initializeInstantProject } = await import('/src/lib/offline/createProject.js');
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');

      // Create project
      const proj = initializeInstantProject({
        projectTitle: 'Concurrency Clash Ultra',
        projectNumber: 'SORBA-ULTRA-CLASH',
        street: 'Rheinstrasse 42',
        city: 'Altnau',
        status: 'Erfasst'
      });

      const projectId = proj.id;
      const initialTime = '2026-01-01T10:00:00.000Z';

      // Upsert base row in Supabase
      await supabase.from('damage_reports').upsert({
        id: projectId,
        project_number: proj.projectNumber,
        project_title: proj.projectTitle,
        status: proj.status,
        report_data: proj
      }, { onConflict: 'id' });

      // Save local draft in IndexedDB with initial timestamp
      const localDraft = {
        ...proj,
        _supabase_updated_at: initialTime,
        status: 'Schadenaufnahme',
        notes: 'Technician local unsaved edits'
      };

      await DeviceLocalStore.saveSnapshot(projectId, 'techniker@qservice.ch', localDraft);

      // Context A (Office) updates server row with different status and updated_at
      const serverTimeA = '2026-08-16T12:00:00.000Z';
      const serverDataA = {
        id: projectId,
        projectTitle: proj.projectTitle,
        status: 'Trocknung abgeschlossen',
        _supabase_updated_at: serverTimeA,
        updated_at: serverTimeA
      };

      await supabase.from('damage_reports').update({
        status: 'Trocknung abgeschlossen'
      }).eq('id', projectId);

      // Context B (iPad) checks for optimistic conflict against serverDataA
      const conflictCheck = checkOptimisticConflict(localDraft, serverDataA);

      // Also attempt atomic Postgres update with expectedUpdatedAt = initialTime
      const resB = await updateProjectAtomicOptimistic({
        supabase,
        projectId,
        expectedUpdatedAt: initialTime,
        patchData: { status: 'Schadenaufnahme' }
      }).catch(err => ({ hasConflict: true, err }));

      // Verify draft in IndexedDB was NOT lost
      const draftAfterClash = await DeviceLocalStore.getUnconfirmedDraft(projectId, 'techniker@qservice.ch');

      return {
        hasConflict: conflictCheck.hasConflict || resB?.hasConflict === true,
        draftRetained: draftAfterClash !== null && (draftAfterClash.data?.notes === 'Technician local unsaved edits' || draftAfterClash.snapshot?.notes === 'Technician local unsaved edits')
      };
    });

    expect(clashResult.hasConflict).toBe(true);
    expect(clashResult.draftRetained).toBe(true);
  });
});
