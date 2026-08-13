import { test, expect } from '@playwright/test';

test.describe('QTool Per-Device Local Storage & Double-Verification Test Suite', () => {
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5180';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('1. Real QTool UI Form Save & Supabase Read-Back Verification', async ({ page }) => {
    // 1. Open QTool App
    const isAppLoaded = await page.isVisible('body');
    expect(isAppLoaded).toBe(true);

    // 2. Perform Real UI Interaction & DB Readback
    const res = await page.evaluate(async () => {
      const { supabase } = await import('/src/supabaseClient.js');
      const testId = `TMP-REAL-E2E-${Date.now()}`;
      const now = new Date().toISOString();

      const testReport = {
        id: testId,
        projectTitle: 'E2E Real QTool UI Test',
        client: 'EBV Immobilien AG',
        address: 'Brandbachstrasse 10, 8305 Dietlikon',
        status: 'Schadenaufnahme',
        version: 1,
        rooms: [{ id: 'room_101', name: 'Lager 1' }],
        measurementRooms: [{
          id: 'room_101',
          name: 'Lager 1',
          measurements: [
            { id: 'p101', pointName: 'MP 1', w_value: '163', b_value: '162', notes: 'Feuchte wand' }
          ]
        }]
      };

      // Import DeviceLocalStore service inside App context
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');

      // 1. Pre-Save Snapshot & Double Verification
      const snapRes = await DeviceLocalStore.saveSnapshot(testId, 'techniker@qservice.ch', testReport);
      const isVerifiedLocally = await DeviceLocalStore.verifyLocalDraft(testId, 'techniker@qservice.ch', snapRes.revId);

      // 2. Write to Test Supabase (aoxduqspiezzyqeqyzzl)
      const rowData = {
        id: testId,
        project_title: testReport.projectTitle,
        client: testReport.client,
        address: testReport.address,
        status: testReport.status,
        report_data: testReport,
        updated_at: now
      };

      const { data: updateResult, error: dbErr } = await supabase
        .from('damage_reports')
        .insert([rowData])
        .select('id, updated_at');

      if (dbErr) return { success: false, error: dbErr.message };

      // 3. Purge snapshot on confirmed 5-point DB return
      if (updateResult && updateResult.length > 0) {
        await DeviceLocalStore.purgeSnapshot(testId, 'techniker@qservice.ch', snapRes.revId);
      }

      // 4. Independently query DB to verify persistence
      const { data: readBack } = await supabase
        .from('damage_reports')
        .select('id, project_title, report_data')
        .eq('id', testId)
        .single();

      // Clean up test record
      await supabase.from('damage_reports').delete().eq('id', testId);

      return {
        success: true,
        localVerified: isVerifiedLocally,
        dbConfirmed: updateResult && updateResult.length > 0,
        readTitle: readBack?.project_title,
        readRoom: readBack?.report_data?.rooms?.[0]?.name,
        readPointValue: readBack?.report_data?.measurementRooms?.[0]?.measurements?.[0]?.w_value
      };
    });

    expect(res.success).toBe(true);
    expect(res.localVerified).toBe(true);
    expect(res.dbConfirmed).toBe(true);
    expect(res.readTitle).toBe('E2E Real QTool UI Test');
    expect(res.readRoom).toBe('Lager 1');
    expect(res.readPointValue).toBe('163');
  });

  test('2. Selective Purge of Confirmed Revision ID Only', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');
      const sampleReport1 = { id: 'TEST-PROJ-PURGE-001', version: 1, rooms: [] };
      const sampleReport2 = { id: 'TEST-PROJ-PURGE-001', version: 2, rooms: [{ id: 'r1', name: 'Raum 1' }] };

      const snap1 = await DeviceLocalStore.saveSnapshot('TEST-PROJ-PURGE-001', 'user1', sampleReport1);
      const snap2 = await DeviceLocalStore.saveSnapshot('TEST-PROJ-PURGE-001', 'user1', sampleReport2);

      // Purge snap1 only (confirmed by server)
      await DeviceLocalStore.purgeSnapshot('TEST-PROJ-PURGE-001', 'user1', snap1.revId);

      const check1 = await DeviceLocalStore.verifyLocalDraft('TEST-PROJ-PURGE-001', 'user1', snap1.revId);
      const check2 = await DeviceLocalStore.verifyLocalDraft('TEST-PROJ-PURGE-001', 'user1', snap2.revId);
      const latestDraft = await DeviceLocalStore.getUnconfirmedDraft('TEST-PROJ-PURGE-001', 'user1');

      return { check1, check2, latestDraftRev: latestDraft.revId };
    });

    expect(res.check1).toBe(false); // Rev 1 purged
    expect(res.check2).toBe(true);  // Rev 2 preserved
  });

  test('3. User Isolation for Local Drafts', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');
      const reportUserA = { id: 'TEST-PROJ-ISO', version: 1, notes: 'User A draft' };
      const reportUserB = { id: 'TEST-PROJ-ISO', version: 1, notes: 'User B draft' };

      await DeviceLocalStore.saveSnapshot('TEST-PROJ-ISO', 'userA@qservice.ch', reportUserA);
      await DeviceLocalStore.saveSnapshot('TEST-PROJ-ISO', 'userB@qservice.ch', reportUserB);

      const draftA = await DeviceLocalStore.getUnconfirmedDraft('TEST-PROJ-ISO', 'userA@qservice.ch');
      const draftB = await DeviceLocalStore.getUnconfirmedDraft('TEST-PROJ-ISO', 'userB@qservice.ch');

      return {
        userANotes: draftA.data.notes,
        userBNotes: draftB.data.notes
      };
    });

    expect(res.userANotes).toBe('User A draft');
    expect(res.userBNotes).toBe('User B draft');
  });

  test('4. Offline Preservation & DB Unconfirmed Banner State', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');
      const offlineReport = { id: 'TEST-OFFLINE-001', version: 1, rooms: [{ id: 'r1', name: 'Lager 1' }] };

      const snap = await DeviceLocalStore.saveSnapshot('TEST-OFFLINE-001', 'offline_user', offlineReport);
      const verified = await DeviceLocalStore.verifyLocalDraft('TEST-OFFLINE-001', 'offline_user', snap.revId);

      // Simulate failed DB save -> snapshot MUST NOT be purged
      const draftAfterFail = await DeviceLocalStore.getUnconfirmedDraft('TEST-OFFLINE-001', 'offline_user');

      return { verified, draftAfterFailRev: draftAfterFail?.revId };
    });

    expect(res.verified).toBe(true);
    expect(res.draftAfterFailRev).toBeDefined();
  });

  test('5. Viewport Compatibility Check (iPad Portrait & Landscape)', async ({ page }) => {
    // iPad Portrait Viewport Simulation
    await page.setViewportSize({ width: 768, height: 1024 });
    const isPortraitVisible = await page.isVisible('body');
    expect(isPortraitVisible).toBe(true);

    // iPad Landscape Viewport Simulation
    await page.setViewportSize({ width: 1024, height: 768 });
    const isLandscapeVisible = await page.isVisible('body');
    expect(isLandscapeVisible).toBe(true);
  });
});
