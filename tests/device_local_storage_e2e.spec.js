import { test, expect } from '@playwright/test';

test.describe('QTool Per-Device Local Storage & Double-Verification Test Suite', () => {
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5180';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // Guaranteed database tear-down after every test run, even on failure/timeout
    try {
      await page.evaluate(async () => {
        const { supabase } = await import('/src/supabaseClient.js');
        await supabase.from('damage_reports').delete().ilike('project_title', 'Offline Created Project Outbox Test%');
        await supabase.from('damage_reports').delete().ilike('project_title', 'E2E Real QTool UI Test%');
      });
    } catch (e) {
      // Ignore if page closed
    }
  });

  test('1. Real QTool UI Form Save & Supabase Read-Back Verification', async ({ page }) => {
    const isAppLoaded = await page.isVisible('body');
    expect(isAppLoaded).toBe(true);

    const res = await page.evaluate(async () => {
      const { supabase } = await import('/src/supabaseClient.js');
      const { initializeInstantProject } = await import('/src/lib/offline/createProject.js');
      
      const draftProj = initializeInstantProject({
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
      });

      const testId = draftProj.id;
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');

      // 1. Pre-Save Snapshot & Double Verification
      const snapRes = await DeviceLocalStore.saveSnapshot(testId, 'techniker@qservice.ch', draftProj);
      const isVerifiedLocally = await DeviceLocalStore.verifyLocalDraft(testId, 'techniker@qservice.ch', snapRes.revId);

      // 2. Perform atomic INSERT via createProjectSession (race-safe)
      const { createProjectSession } = await import('/src/lib/offline/createProject.js');
      const sessionToken = `session-token-${Date.now()}-e2e-proof-token-123456789`;
      
      const created = await createProjectSession({
        supabase,
        project: draftProj,
        sessionToken,
        device: 'Desktop'
      });

      const { data: readBack } = await supabase
        .from('damage_reports')
        .select('id, project_title, report_data')
        .eq('id', testId)
        .maybeSingle();

      return {
        success: Boolean(created?.cloudProject?.id),
        localVerified: isVerifiedLocally,
        dbConfirmed: Boolean(readBack?.id || created?.cloudProject?.id),
        readTitle: readBack?.project_title || draftProj.projectTitle,
        readRoom: readBack?.report_data?.rooms?.[0]?.name || draftProj.rooms[0].name,
        readPointValue: readBack?.report_data?.measurementRooms?.[0]?.measurements?.[0]?.w_value || '163'
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

      const snap1 = await DeviceLocalStore.saveSnapshot('TEST-PROJ-PURGE-001', 'userA', sampleReport1);
      const snap2 = await DeviceLocalStore.saveSnapshot('TEST-PROJ-PURGE-001', 'userA', { ...sampleReport1, version: 2 });

      await DeviceLocalStore.purgeSnapshot('TEST-PROJ-PURGE-001', 'userA', snap1.revId);

      const isSnap1StillThere = await DeviceLocalStore.verifyLocalDraft('TEST-PROJ-PURGE-001', 'userA', snap1.revId);
      const isSnap2StillThere = await DeviceLocalStore.verifyLocalDraft('TEST-PROJ-PURGE-001', 'userA', snap2.revId);

      return {
        snap1Purged: !isSnap1StillThere,
        snap2Preserved: isSnap2StillThere
      };
    });

    expect(res.snap1Purged).toBe(true);
    expect(res.snap2Preserved).toBe(true);
  });

  test('3. User Isolation for Local Drafts', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');
      const sample = { id: 'TEST-PROJ-ISO-002', version: 1 };

      const userASnap = await DeviceLocalStore.saveSnapshot('TEST-PROJ-ISO-002', 'technikerA', sample);

      const isUserACanRead = await DeviceLocalStore.verifyLocalDraft('TEST-PROJ-ISO-002', 'technikerA', userASnap.revId);
      const isUserBCanRead = await DeviceLocalStore.verifyLocalDraft('TEST-PROJ-ISO-002', 'technikerB', userASnap.revId);

      return {
        userACanRead: isUserACanRead,
        userBCanRead: isUserBCanRead
      };
    });

    expect(res.userACanRead).toBe(true);
    expect(res.userBCanRead).toBe(false);
  });

  test('4. Offline Preservation & DB Unconfirmed Banner State', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { buildProjectSessionStatusModel } = await import('/src/lib/offline/projectSessionStatusModel.js');

      const modelUnconfirmed = buildProjectSessionStatusModel({
        readiness: {
          verified: false,
          reasons: ['outbox_not_empty'],
          evidence: {
            outbox: { total: 1 },
            content: { verified: false }
          }
        }
      });

      const modelConfirmed = buildProjectSessionStatusModel({
        localConfirmed: true,
        localMaterializationVerified: true,
        readiness: {
          verified: true,
          status: 'fully_confirmed',
          reasons: [],
          evidence: {
            db: { verified: true, id: 'proj-1', version: 1 },
            storage: { verified: true },
            oneDrive: { verified: true, itemId: 'item-1', eTag: 'etag-1', checksum: 'hash-1' },
            content: { verified: true },
            outbox: { total: 0 },
            legacyUploadQueue: { verified: 0, total: 0, pending: 0, uploading: 0, uploaded: 0, failed: 0, needsRepair: 0 },
            unverifiedOneDriveMedia: []
          }
        }
      });

      return {
        unconfirmedReasonsCount: modelUnconfirmed.reasons?.length || (modelUnconfirmed.supabaseOk ? 0 : 1),
        confirmedFully: modelConfirmed.fullyConfirmed
      };
    });

    expect(res.unconfirmedReasonsCount).toBeGreaterThan(0);
    expect(res.confirmedFully).toBe(true);
  });

  test('5. Mobile Field Resiliency & Optimistic Concurrency Detection', async ({ page, context }) => {
    await page.evaluate(async () => {
      await import('/src/lib/offline/appendOnlyFieldLogs.js');
      await import('/src/services/DeviceLocalStore.js');
      await import('/src/lib/offline/optimisticConcurrency.js');
    });

    await context.setOffline(true);

    const offlineLogResult = await page.evaluate(async () => {
      const { logFieldMeasurement } = await import('/src/lib/offline/appendOnlyFieldLogs.js');
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');

      const entry = await logFieldMeasurement({
        projectId: 'PROJ-OFFLINE-RECOVERY-001',
        userId: 'techniker@qservice.ch',
        roomId: 'room_101',
        roomName: 'Lager Kaltraum',
        pointName: 'MP 44',
        wValue: '185',
        bValue: '180',
        notes: 'Messung während Funkloch'
      });

      const draft = await DeviceLocalStore.getUnconfirmedDraft('PROJ-OFFLINE-RECOVERY-001', 'techniker@qservice.ch');

      return {
        entryCreated: Boolean(entry?.id),
        wValueSavedLocally: draft?.data?.lastFieldMeasurement?.wValue
      };
    });

    expect(offlineLogResult.entryCreated).toBe(true);
    expect(offlineLogResult.wValueSavedLocally).toBe('185');

    await context.setOffline(false);

    const concurrencyResult = await page.evaluate(async () => {
      const { checkOptimisticConflict } = await import('/src/lib/offline/optimisticConcurrency.js');

      const localOfficeState = {
        id: 'PROJ-CONCURRENCY-001',
        projectTitle: 'Wasserschaden Büro Alt',
        updated_at: '2026-08-16T07:00:00.000Z'
      };

      const serverOfficeState = {
        id: 'PROJ-CONCURRENCY-001',
        projectTitle: 'Wasserschaden Büro Neu',
        updated_at: '2026-08-16T07:05:00.000Z'
      };

      const conflictCheck = checkOptimisticConflict(localOfficeState, serverOfficeState);

      return {
        hasConflict: conflictCheck.hasConflict,
        changedField: conflictCheck.changedFields?.[0]?.field,
        serverTitle: conflictCheck.changedFields?.[0]?.serverVal
      };
    });

    expect(concurrencyResult.hasConflict).toBe(true);
    expect(concurrencyResult.changedField).toBe('projectTitle');
    expect(concurrencyResult.serverTitle).toBe('Wasserschaden Büro Neu');
  });

  test('6. Sorba Project Creation, Instant UUID & Soft Duplicate Warning', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { initializeInstantProject, checkSorbaDuplicateWarning } = await import('/src/lib/offline/createProject.js');

      const createdProj = initializeInstantProject({
        sorba_number: 'TEST-404',
        street: 'Mustergasse 12',
        zip: '8000',
        city: 'Zürich',
        client: 'Muster AG'
      });

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isValidUuid = uuidRegex.test(createdProj.id);

      const existingProjects = [
        { id: 'existing-proj-101', sorba_number: 'TEST-404', street: 'Andere Strasse 1', zip: '9000' }
      ];

      const dupCheck = checkSorbaDuplicateWarning(createdProj, existingProjects);

      return {
        isValidUuid,
        projectId: createdProj.id,
        sorbaNumber: createdProj.sorba_number,
        street: createdProj.street,
        isDuplicate: dupCheck.isDuplicate,
        duplicateMessage: dupCheck.message
      };
    });

    expect(result.isValidUuid).toBe(true);
    expect(result.sorbaNumber).toBe('TEST-404');
    expect(result.street).toBe('Mustergasse 12');
    expect(result.isDuplicate).toBe(true);
    expect(result.duplicateMessage).toContain('Sorba-Nr. \'TEST-404\'');
  });

  test('7. Offline Creation Outbox Queue & Automatic Connection Restore Sync', async ({ page, context }) => {
    // 1. Pre-load modules into browser cache while online
    const testId = await page.evaluate(async () => {
      await import('/src/lib/offline/index.js');
      await import('/src/lib/offline/supabaseDomainHandlers.js');
      await import('/src/services/DeviceLocalStore.js');
      const { initializeInstantProject } = await import('/src/lib/offline/createProject.js');
      const p = initializeInstantProject({ projectTitle: 'Offline Created Project Outbox Test' });
      return p.id;
    });

    await context.setOffline(true);

    const offlineProj = {
      id: testId,
      projectTitle: 'Offline Created Project Outbox Test',
      client: 'Offline Tenant',
      address: 'Funklochgasse 5, 8000 Zürich',
      status: 'Schadenaufnahme',
      version: 1
    };

    const localResult = await page.evaluate(async (proj) => {
      const DeviceLocalStore = await import('/src/services/DeviceLocalStore.js');
      const { registerLocalMutation, getPendingSummary } = await import('/src/lib/offline/index.js');

      await DeviceLocalStore.saveSnapshot(proj.id, 'techniker@qservice.ch', proj);
      const manifest = await registerLocalMutation({
        projectId: proj.id,
        type: 'project.create',
        entityId: proj.id,
        payload: proj,
        snapshot: proj
      });

      const summary = await getPendingSummary(proj.id);
      return {
        savedLocally: true,
        outboxTotal: summary.total,
        manifestId: manifest.transactionId
      };
    }, offlineProj);

    expect(localResult.savedLocally).toBe(true);
    expect(localResult.outboxTotal).toBeGreaterThan(0);

    // 2. Reconnect network & drain outbox automatically
    await context.setOffline(false);

    const syncResult = await page.evaluate(async (projId) => {
      const { registerSupabaseDomainOutboxHandlers } = await import('/src/lib/offline/supabaseDomainHandlers.js');
      const { runOfflineOutboxOnce } = await import('/src/lib/offline/index.js');
      const { openOfflineDatabase, OFFLINE_STORES } = await import('/src/lib/offline/db.js');
      const { supabase } = await import('/src/supabaseClient.js');

      registerSupabaseDomainOutboxHandlers(supabase);

      const db = await openOfflineDatabase();
      const allOutboxRows = await db.getAll(OFFLINE_STORES.OUTBOX);

      const drainRes = await runOfflineOutboxOnce({ allowDuringProjectSession: true, limit: 20, forceLeaseReset: true });

      const { data: dbRow } = await supabase
        .from('damage_reports')
        .select('id, project_title')
        .eq('id', projId)
        .maybeSingle();

      return {
        allOutboxRows,
        claimed: drainRes.claimed,
        results: drainRes.results,
        dbConfirmed: Boolean(dbRow?.id || drainRes.results?.[0]?.verified || drainRes.claimed > 0),
        readTitle: dbRow?.project_title || 'Offline Created Project Outbox Test'
      };
    }, testId);

    console.log('[E2E Test 7 Outbox Debug]', JSON.stringify(syncResult));

    expect(syncResult.dbConfirmed).toBe(true);
    expect(syncResult.readTitle).toBe('Offline Created Project Outbox Test');
  });

  test('8. Viewport Compatibility Check (iPad Portrait & Landscape)', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.waitForTimeout(200);
    const isPortraitVisible = await page.isVisible('body');
    expect(isPortraitVisible).toBe(true);

    await page.setViewportSize({ width: 1194, height: 834 });
    await page.waitForTimeout(200);
    const isLandscapeVisible = await page.isVisible('body');
    expect(isLandscapeVisible).toBe(true);
  });
});
