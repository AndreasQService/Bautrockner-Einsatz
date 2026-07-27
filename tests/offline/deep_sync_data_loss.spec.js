import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabase = createClient(
  'https://aoxduqspiezzyqeqyzzl.supabase.co',
  'sb_publishable_HZzncDQUEtA8XN6HhT0ysA_K-Ho2eEL'
);

const BASE_URL = 'http://127.0.0.1:5180';
const runId = Math.random().toString(36).substring(2, 7).toUpperCase();

// Registry to track created project IDs for absolute safe cleanup
const createdProjectIds = new Set();

// Serial execution configuration
test.describe.configure({ mode: 'serial' });

// Ensure authenticated session for Supabase client
async function ensureDbAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInWithPassword({
    email: 'test-env-user@qtool.local',
    password: 'TestEnvPassword123!'
  });
  if (error) {
    const { error: signUpError } = await supabase.auth.signUp({
      email: 'test-env-user@qtool.local',
      password: 'TestEnvPassword123!'
    });
    if (!signUpError) {
      await supabase.auth.signInWithPassword({
        email: 'test-env-user@qtool.local',
        password: 'TestEnvPassword123!'
      });
    }
  }
}

// Reset database state for a specific dynamically generated project ID
async function resetDbForProject(projectId, causeVal, rooms = null, title = null) {
  await ensureDbAuthenticated();
  const T1 = new Date().toISOString();
  const projectTitle = title || `PLAYWRIGHT_DATA_LOSS_${runId}_${projectId.substring(0, 5)}`;
  
  const payload = {
    id: projectId,
    project_title: projectTitle,
    client: 'Musterprojekt AG',
    address: 'Teststrasse 1, 8000 Zürich',
    assigned_to: 'Mensur Sherifi',
    status: 'Schadenaufnahme',
    updated_at: T1,
    report_data: {
      id: projectId,
      projectTitle: projectTitle,
      assignedTo: 'Mensur Sherifi',
      cause: causeVal,
      notes: 'SENTINEL_NOTES_ORIGINAL',
      findings: 'SENTINEL_FINDINGS_ORIGINAL',
      description: 'SENTINEL_DESCRIPTION_ORIGINAL',
      contacts: [
        { id: 'contact-1', name: 'SENTINEL_CONTACT_1', phone: '111111', role: 'Mieter' },
        { id: 'contact-2', name: 'SENTINEL_CONTACT_2', phone: '222222', role: 'Mieter' }
      ],
      rooms: rooms || [
        { id: 'room-1', name: 'SENTINEL_ROOM_1', measurements: [] },
        { id: 'room-2', name: 'SENTINEL_ROOM_2', measurements: [] }
      ],
      equipment: [
        { id: 'equipment-1', name: 'SENTINEL_EQUIPMENT_1' }
      ],
      insurance: {
        policyNumber: 'SENTINEL_POLICY',
        claimNumber: 'SENTINEL_CLAIM'
      },
      damageLocation: {
        street: 'Teststrasse 1',
        zip: '8000',
        city: 'Zürich'
      },
      nestedMetadata: {
        level1: {
          level2: {
            preservedValue: 'SENTINEL_NESTED'
          }
        }
      }
    }
  };

  const { error } = await supabase.from('damage_reports').upsert(payload);
  if (error) {
    throw new Error(`DB Reset failed for project ${projectId}: ${error.message}`);
  }
  
  createdProjectIds.add(projectId);

  const { data } = await supabase.from('damage_reports').select('updated_at, report_data').eq('id', projectId).single();
  return { updated_at: data.updated_at, report_data: data.report_data };
}

// Global cleanup after all tests
async function cleanupCreatedProjects() {
  await ensureDbAuthenticated();
  console.log(`[CLEANUP] Starting cleanup of ${createdProjectIds.size} created test projects...`);
  for (const pid of createdProjectIds) {
    await supabase.from('damage_reports').delete().eq('id', pid);
  }
  createdProjectIds.clear();
}

// Helper to log in as technician
async function loginAsTechnician(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = () => Promise.reject(new Error('Service Worker disabled for testing'));
    }
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch (e) {}
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="Name eingeben..."]');
  await page.fill('input[placeholder="Name eingeben..."]', 'Mensur Sherifi');
  await page.fill('input[type="password"]', '123');
  await page.click('button:has-text("Anmelden")');
  await page.waitForTimeout(2000);
}

// Network-level Autosave verification helper
async function waitForAutosave(page, actionCallback) {
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/rest/v1/damage_reports') &&
                ['POST', 'PATCH', 'PUT'].includes(response.request().method()) &&
                response.status() >= 200 && response.status() < 300,
    { timeout: 60000 }
  );
  await actionCallback();
  await responsePromise;
  await page.waitForTimeout(1000); // short wait for internal React UI state settling
}

// Deep JSON comparison helper
function deepCompare(obj1, obj2, path = '') {
  if (obj1 === obj2) return true;
  
  if (typeof obj1 === 'string' && typeof obj2 === 'string') {
    const d1 = Date.parse(obj1);
    const d2 = Date.parse(obj2);
    if (!isNaN(d1) && !isNaN(d2)) {
      if (Math.abs(d1 - d2) < 15000) return true;
    }
  }

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    throw new Error(`Differenz bei Pfad "${path}": Lokaler Wert "${obj1}" (${typeof obj1}) vs Server-Wert "${obj2}" (${typeof obj2})`);
  }

  const ignoreKeys = ['_supabase_updated_at', '_offline_saved_at', '_sync_conflict', '_db_updated_at', 'localUpdatedAt', 'baseUpdatedAt', 'clientId', 'schemaVersion', 'reportId'];
  const keys1 = Object.keys(obj1).filter(k => !ignoreKeys.includes(k));
  const keys2 = Object.keys(obj2).filter(k => !ignoreKeys.includes(k));
  
  if (keys1.length !== keys2.length) {
    const diffKeys1 = keys1.filter(k => !keys2.includes(k));
    const diffKeys2 = keys2.filter(k => !keys1.includes(k));
    throw new Error(`Differenz bei Pfad "${path}": Unterschiedliche Key-Menge. Nur in obj1: [${diffKeys1.join(',')}], Nur in obj2: [${diffKeys2.join(',')}]`);
  }

  for (const key of keys1) {
    if (!keys2.includes(key)) {
      throw new Error(`Differenz bei Pfad "${path}": Key "${key}" fehlt in obj2.`);
    }
    deepCompare(obj1[key], obj2[key], path ? `${path}.${key}` : key);
  }
  return true;
}

// HTTP request tracker for counting and assertions
class SupabaseWriteTracker {
  constructor(page) {
    this.page = page;
    this.requests = [];
    this.isTracking = false;
  }

  start() {
    this.requests = [];
    this.isTracking = true;
    this.page.on('request', this._handleRequest.bind(this));
  }

  stop() {
    this.isTracking = false;
    this.page.off('request', this._handleRequest.bind(this));
  }

  _handleRequest(request) {
    if (!this.isTracking) return;
    const url = request.url();
    if (url.includes('/rest/v1/damage_reports')) {
      const method = request.method();
      const headers = request.headers();
      const postData = request.postData();
      
      this.requests.push({
        method,
        url,
        headers,
        postData: postData ? JSON.parse(postData) : null,
        timestamp: new Date().toISOString()
      });
    }
  }

  getWriteCount() {
    return this.requests.filter(r => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method)).length;
  }

  assertNoUnconditionalWrites() {
    for (const r of this.requests) {
      if (['PATCH', 'PUT'].includes(r.method)) {
        const urlObj = new URL(r.url);
        const hasUpdatedAtFilter = urlObj.searchParams.has('updated_at') || urlObj.searchParams.toString().includes('updated_at');
        if (!hasUpdatedAtFilter) {
          throw new Error(`Kritischer Fehler: Unbedingter Schreibversuch (${r.method}) ohne updated_at Filter! URL: ${r.url}`);
        }
      }
      if (r.method === 'POST') {
        const preferHeader = r.headers['prefer'] || '';
        if (preferHeader.includes('resolution=merge-duplicates')) {
          throw new Error(`Kritischer Fehler: POST/upsert mit merge-duplicates ist verboten!`);
        }
      }
    }
  }
}

// E2E Verification helper to check Supabase configuration before running
async function verifySupabaseEnvironment(page) {
  const isMockActive = await page.evaluate(() => {
    return !!(window.supabase && window.supabase.supabaseUrl === undefined);
  });
  if (isMockActive) {
    throw new Error("Sicherheitsabbruch: Der Mock-Client ist aktiv! Echte Deep-Tests erfordern den echten Client.");
  }
}

test.describe('DEEP OFFLINE SYNC & DATA LOSS PREVENTION', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(1800000); // 30 minutes baseline timeout for loops
  });

  test.afterAll(async () => {
    await cleanupCreatedProjects();
  });

  // =========================================================================
  // SCHRITT 1: DIE STANDARD-SCENARIOS (1-5)
  // =========================================================================

  test('Test 1: Normales Online-Speichern & Erhalt von Sentinel-Werten', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST1_1`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);
    await verifySupabaseEnvironment(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    const textarea = page.locator('textarea:not([readonly])').first();
    await expect(textarea).toHaveValue('Original Cause');

    console.log("Warte auf Online Autosave...");
    await waitForAutosave(page, async () => {
      await textarea.fill('Cause updated online');
      await textarea.dispatchEvent('blur');
    });

    const { data: dbRecord } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbRecord.report_data.cause).toBe('Cause updated online');
    expect(dbRecord.report_data.notes).toBe('SENTINEL_NOTES_ORIGINAL');
    expect(dbRecord.report_data.findings).toBe('SENTINEL_FINDINGS_ORIGINAL');
    expect(dbRecord.report_data.contacts[0].name).toBe('SENTINEL_CONTACT_1');

    await context.close();
  });

  test('Test 2: Altes Offline-Gerät darf neueren Serverstand niemals überschreiben (Konflikt-Modal)', async ({ browser }) => {
    const iterationsCount = 20;
    console.log(`[Test 2] Starting loop with ${iterationsCount} iterations...`);
    
    for (let i = 1; i <= iterationsCount; i++) {
      const projectId = crypto.randomUUID();
      const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST2_${i}`;
      const { updated_at: T1 } = await resetDbForProject(projectId, `Original Cause T1_${i}`, null, projectTitle);

      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await loginAsTechnician(pageA);
      await verifySupabaseEnvironment(pageA);

      await pageA.click(`.tech-project-card:has-text("${projectTitle}")`);
      await pageA.click('button:has-text("Schadenaufnahme")');
      await pageA.waitForSelector('textarea:not([readonly])');

      const textareaA = pageA.locator('textarea:not([readonly])').first();
      await expect(textareaA).toHaveValue(`Original Cause T1_${i}`);

      // Device A goes offline
      await contextA.setOffline(true);

      // Device A makes edits offline
      await textareaA.fill(`Offline edit from A on iter ${i}`);
      await textareaA.dispatchEvent('blur');
      await pageA.waitForTimeout(22000); // Wait for cache save

      // Device B modifies project online
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await loginAsTechnician(pageB);
      await verifySupabaseEnvironment(pageB);

      await pageB.click(`.tech-project-card:has-text("${projectTitle}")`);
      await pageB.click('button:has-text("Schadenaufnahme")');
      await pageB.waitForSelector('textarea:not([readonly])');

      const textareaB = pageB.locator('textarea:not([readonly])').first();
      await expect(textareaB).toHaveValue(`Original Cause T1_${i}`);

      console.log(`[Test 2] Waiting for B online save iteration ${i}...`);
      await waitForAutosave(pageB, async () => {
        await textareaB.fill(`Online overwrite from B on iter ${i}`);
        await textareaB.dispatchEvent('blur');
      });

      await ensureDbAuthenticated();
      const { data: dbAfterB } = await supabase.from('damage_reports').select('updated_at, report_data').eq('id', projectId).single();
      const dbCopy = JSON.parse(JSON.stringify(dbAfterB.report_data));
      const dbUpdatedAt = dbAfterB.updated_at;

      expect(dbCopy.cause).toBe(`Online overwrite from B on iter ${i}`);
      expect(dbUpdatedAt).not.toBe(T1);

      // Device A starts request tracking
      const tracker = new SupabaseWriteTracker(pageA);
      tracker.start();

      // Device A goes back online
      await contextA.setOffline(false);
      await pageA.waitForTimeout(4000);

      // Navigate back to Dashboard to trigger conflict check
      await pageA.click('button:has-text("Dashboard")');
      await pageA.waitForSelector('text=Lokale Änderungen gefunden!');

      tracker.stop();

      // Assertions on writes and DB state
      tracker.assertNoUnconditionalWrites();
      expect(tracker.getWriteCount()).toBe(0); // 0 successful writes on conflict

      await ensureDbAuthenticated();
      const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
      
      // Perform strict deep compare
      deepCompare(dbCopy, dbFinal.report_data);

      await contextA.close();
      await contextB.close();
      console.log(`[Test 2] Iteration ${i}/${iterationsCount} passed successfully.`);
    }
  });

  test('Test 3: Gültige Offline-Änderungen werden ohne Fremdänderung gemerged', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST3_1`;
    await resetDbForProject(projectId, 'Original Cause T1', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);
    await verifySupabaseEnvironment(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');
    await page.waitForTimeout(2000);

    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Valid offline cause edit');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000); // Wait for cache save

    await context.setOffline(false);
    await page.waitForTimeout(6000); // Let online event trigger sync

    const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbFinal.report_data.cause).toBe('Valid offline cause edit');
    expect(dbFinal.report_data.notes).toBe('SENTINEL_NOTES_ORIGINAL');

    await context.close();
  });

  test('Test 4: Explizite Kontakt-Löschung offline mit Konflikt-Schutz', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST4_1`;
    const { updated_at: T1 } = await resetDbForProject(projectId, 'Original Cause T1', null, projectTitle);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginAsTechnician(pageA);
    await verifySupabaseEnvironment(pageA);

    await pageA.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageA.click('button:has-text("Schadenaufnahme")');
    await pageA.waitForSelector('textarea:not([readonly])');
    await pageA.waitForTimeout(2000);

    await contextA.setOffline(true);

    // Simulate offline cache with deleted contact-2
    await pageA.evaluate((args) => {
      const parsed = JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
      parsed[args.projectId] = {
        reportId: args.projectId,
        baseUpdatedAt: args.T1,
        localUpdatedAt: new Date().toISOString(),
        reportData: {
          id: args.projectId,
          cause: 'Original Cause T1',
          contacts: [
            { id: 'contact-1', name: 'SENTINEL_CONTACT_1', phone: '111111', role: 'Mieter' }
          ]
        },
        changedPaths: ['contacts'],
        operations: [{ type: 'array_delete', path: 'contacts', itemId: 'contact-2' }],
        clientId: 'device-a-client',
        schemaVersion: 'v1'
      };
      localStorage.setItem('qservice_unsaved_reports', JSON.stringify(parsed));
    }, { projectId, T1 });

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginAsTechnician(pageB);
    await pageB.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageB.click('button:has-text("Schadenaufnahme")');
    await pageB.waitForSelector('textarea:not([readonly])');
    await pageB.waitForTimeout(2000);

    await waitForAutosave(pageB, async () => {
      await pageB.fill('textarea:not([readonly])', 'Cause updated by B');
      await pageB.dispatchEvent('textarea:not([readonly])', 'blur');
    });

    await contextA.setOffline(false);
    await pageA.waitForTimeout(4000);
    await pageA.click('button:has-text("Dashboard")');
    await pageA.waitForSelector('text=Lokale Änderungen gefunden!');

    await ensureDbAuthenticated();
    const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbFinal.report_data.cause).toBe('Cause updated by B');
    expect(dbFinal.report_data.contacts.length).toBe(2); // Contact-2 preserved!

    await contextA.close();
    await contextB.close();
  });

  test('Test 5: Serverseitiger Optimistic Lock Schutz', async () => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST5_1`;
    const { updated_at: T1, report_data: originalData } = await resetDbForProject(projectId, 'Original Cause T1', null, projectTitle);

    const T2 = new Date().toISOString();
    const { error: concurrentEditError } = await supabase.from('damage_reports').update({
      updated_at: T2,
      report_data: { ...originalData, cause: 'Concurrent Online Mod' }
    }).eq('id', projectId);
    expect(concurrentEditError).toBeNull();

    const { data: updateResult, error: syncError } = await supabase
      .from('damage_reports')
      .update({
        updated_at: new Date().toISOString(),
        report_data: { ...originalData, cause: 'Obsolete Sync Try' }
      })
      .eq('id', projectId)
      .eq('updated_at', T1) // optimistic lock
      .select('id');

    expect(syncError).toBeNull();
    expect(updateResult.length).toBe(0); // 0 rows affected
  });

  // =========================================================================
  // SCHRITT 2: ERWEITERTE TESTFÄLLE (A-O)
  // =========================================================================

  test('Test A: Race Condition zwischen Versionsprüfung und DB-Update', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_A`;
    const { updated_at: T1 } = await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginAsTechnician(pageA);

    await pageA.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageA.click('button:has-text("Schadenaufnahme")');
    await pageA.waitForSelector('textarea:not([readonly])');

    // Simulate an offline state on pageA
    await contextA.setOffline(true);
    await pageA.fill('textarea:not([readonly])', 'Offline change from A');
    await pageA.dispatchEvent('textarea:not([readonly])', 'blur');
    await pageA.waitForTimeout(22000); // Save to cache

    // Browser B changes online
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginAsTechnician(pageB);
    await pageB.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageB.click('button:has-text("Schadenaufnahme")');
    await pageB.waitForSelector('textarea:not([readonly])');
    await waitForAutosave(pageB, async () => {
      await pageB.fill('textarea:not([readonly])', 'Online change from B');
      await pageB.dispatchEvent('textarea:not([readonly])', 'blur');
    });

    await ensureDbAuthenticated();
    const { data: dbAfterB, error: selectError } = await supabase.from('damage_reports').select('updated_at, report_data').eq('id', projectId).single();
    if (selectError) {
      throw new Error(`Select in Test A failed for project ${projectId}: ${selectError.message} (${selectError.code})`);
    }
    expect(dbAfterB.report_data.cause).toBe('Online change from B');

    // Go back online on A
    await contextA.setOffline(false);
    await pageA.waitForTimeout(4000);
    await pageA.click('button:has-text("Dashboard")');
    await pageA.waitForSelector('text=Lokale Änderungen gefunden!');

    // DB state must remain B's online edits
    const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbFinal.report_data.cause).toBe('Online change from B');

    await contextA.close();
    await contextB.close();
  });

  test('Test B: Netzwerkabbruch nach Server-Write, aber vor Client-Antwort', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_B`;
    const { updated_at: T1 } = await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginAsTechnician(pageA);

    await pageA.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageA.click('button:has-text("Schadenaufnahme")');
    await pageA.waitForSelector('textarea:not([readonly])');

    // Setup network interception for lost response on contextA (captures worker requests)
    let writeExecutedOnServer = false;
    await contextA.route(/\/rest\/v1\/damage_reports/, async (route, request) => {
      const method = request.method();
      if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
        console.log("[Test B Route] Forwarding request to server via route.fetch()...");
        const response = await route.fetch();
        console.log(`[Test B Route] Server response status: ${response.status()}`);
        if (response.status() === 200 || response.status() === 201 || response.status() === 204) {
          writeExecutedOnServer = true;
        }
        // Abort the connection to the browser so the browser thinks the write failed/lost connection
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    const textarea = pageA.locator('textarea:not([readonly])').first();
    await expect(textarea).toHaveValue('Original Cause');

    await textarea.fill('Offline change from A with response loss');
    await textarea.dispatchEvent('blur');
    await pageA.waitForTimeout(25000); // Autosave timer fires, trigger interception

    expect(writeExecutedOnServer).toBe(true);

    // Browser must still contain the cache because it didn't get the successful reply
    const cacheContent = await pageA.evaluate(() => localStorage.getItem('qservice_unsaved_reports'));
    expect(cacheContent).toContain(projectId);

    // Now disable route blocking
    await contextA.unroute(/\/rest\/v1\/damage_reports/);

    // Go back online / re-save (trigger clean sync)
    await pageA.click('button:has-text("Dashboard")');
    
    // Wait for the conflict modal since client baseUpdatedAt != server updated_at
    await pageA.waitForSelector('text=Lokale Änderungen gefunden!', { timeout: 10000 });
    
    // Click "Lokalen Stand erzwingen" to resolve conflict and write the data
    await pageA.click('button:has-text("Lokalen Stand erzwingen")');
    await pageA.waitForTimeout(6000); // Allow sync retry to execute

    // Cache must now be successfully cleared
    const cacheContentAfter = await pageA.evaluate(() => localStorage.getItem('qservice_unsaved_reports') || '{}');
    expect(cacheContentAfter).not.toContain(projectId);

    // Read and verify cause
    const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbFinal.report_data.cause).toBe('Offline change from A with response loss');

    await contextA.close();
  });

  test('Test C: Zwei Tabs im selben Browserkontext', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_C`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page1 = await context.newPage();
    await loginAsTechnician(page1);

    const page2 = await context.newPage();
    await page2.goto(BASE_URL);
    await page2.waitForTimeout(2000);

    // Check dashboard on both pages
    await expect(page1.locator('.tech-project-card', { hasText: projectTitle }).first()).toBeVisible();
    await expect(page2.locator('.tech-project-card', { hasText: projectTitle }).first()).toBeVisible();

    await context.close();
  });

  test('Test D: Drei konkurrierende Geräte', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_D`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginAsTechnician(pageA);

    await pageA.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageA.click('button:has-text("Schadenaufnahme")');
    await pageA.waitForSelector('textarea:not([readonly])');

    // Device A goes offline
    await contextA.setOffline(true);
    await pageA.fill('textarea:not([readonly])', 'Offline A');
    await pageA.dispatchEvent('textarea:not([readonly])', 'blur');
    await pageA.waitForTimeout(22000); // Save to cache

    // Device B online changes
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginAsTechnician(pageB);
    await pageB.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageB.click('button:has-text("Schadenaufnahme")');
    await pageB.waitForSelector('textarea:not([readonly])');
    await waitForAutosave(pageB, async () => {
      await pageB.fill('textarea:not([readonly])', 'Online B');
      await pageB.dispatchEvent('textarea:not([readonly])', 'blur');
    });

    // Device C online changes
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    await loginAsTechnician(pageC);
    await pageC.click(`.tech-project-card:has-text("${projectTitle}")`);
    await pageC.click('button:has-text("Schadenaufnahme")');
    await pageC.waitForSelector('textarea:not([readonly])');
    await waitForAutosave(pageC, async () => {
      await pageC.fill('textarea:not([readonly])', 'Online C');
      await pageC.dispatchEvent('textarea:not([readonly])', 'blur');
    });

    // Device A back online
    await contextA.setOffline(false);
    await pageA.waitForTimeout(4000);
    await pageA.click('button:has-text("Dashboard")');
    await pageA.waitForSelector('text=Lokale Änderungen gefunden!');

    await ensureDbAuthenticated();
    const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbFinal.report_data.cause).toBe('Online C');

    await contextA.close();
    await contextB.close();
    await contextC.close();
  });

  test('Test E: Zwei Queue-Einträge für dieselbe reportId', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_E`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    // Offline change 1
    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Change 1');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000);

    // Offline change 2
    await page.fill('textarea:not([readonly])', 'Change 2');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000);

    const cacheContent = await page.evaluate(() => localStorage.getItem('qservice_unsaved_reports') || '{}');
    const parsed = JSON.parse(cacheContent);
    // Keys length must be 1 (only 1 entry for this project)
    expect(Object.keys(parsed).length).toBe(1);

    await context.close();
  });

  test('Test F: Mehrere Projekte gleichzeitig in der Queue', async ({ browser }) => {
    const projectId1 = crypto.randomUUID();
    const projectTitle1 = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_F1`;
    await resetDbForProject(projectId1, 'Cause 1', null, projectTitle1);

    const projectId2 = crypto.randomUUID();
    const projectTitle2 = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_F2`;
    await resetDbForProject(projectId2, 'Cause 2', null, projectTitle2);

    const context = await browser.newContext();
    
    // Open Tab 1 and load Project 1 online
    const page1 = await context.newPage();
    await loginAsTechnician(page1);
    await page1.click(`.tech-project-card:has-text("${projectTitle1}")`);
    await page1.click('button:has-text("Schadenaufnahme")');
    await page1.waitForSelector('textarea:not([readonly])');

    // Open Tab 2 and load Project 2 online
    const page2 = await context.newPage();
    await loginAsTechnician(page2);
    await page2.click(`.tech-project-card:has-text("${projectTitle2}")`);
    await page2.click('button:has-text("Schadenaufnahme")');
    await page2.waitForSelector('textarea:not([readonly])');

    // Now simulate offline state for the context (applies to both pages)
    await context.setOffline(true);

    // Edit Project 1 in Tab 1 offline
    await page1.fill('textarea:not([readonly])', 'Offline Cause 1');
    await page1.dispatchEvent('textarea:not([readonly])', 'blur');
    await page1.waitForTimeout(22000); // Save to cache

    // Edit Project 2 in Tab 2 offline
    await page2.fill('textarea:not([readonly])', 'Offline Cause 2');
    await page2.dispatchEvent('textarea:not([readonly])', 'blur');
    await page2.waitForTimeout(22000); // Save to cache

    // Verify both are present in the shared localStorage
    const cache = await page2.evaluate(() => localStorage.getItem('qservice_unsaved_reports') || '{}');
    const parsed = JSON.parse(cache);
    expect(parsed[projectId1]).toBeDefined();
    expect(parsed[projectId2]).toBeDefined();

    await context.close();
  });

  test('Test G: Browserneustart mit persistentem Offline-Cache', async ({ browser }) => {
    const iterations = 10;
    for (let i = 1; i <= iterations; i++) {
      const projectId = crypto.randomUUID();
      const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_G_${i}`;
      await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await loginAsTechnician(page1);

      await page1.click(`.tech-project-card:has-text("${projectTitle}")`);
      await page1.click('button:has-text("Schadenaufnahme")');
      await page1.waitForSelector('textarea:not([readonly])');

      await context1.setOffline(true);
      await page1.fill('textarea:not([readonly])', `Offline Cause G Iter ${i}`);
      await page1.dispatchEvent('textarea:not([readonly])', 'blur');
      await page1.waitForTimeout(22000); // Save to cache

      const storageState = await context1.storageState();
      await context1.close();

      // Launch page 2 with persisted state
      const context2 = await browser.newContext({ storageState });
      const page2 = await context2.newPage();
      await page2.goto(BASE_URL);
      await page2.waitForTimeout(4000); // Wait for sync trigger (online by default)

      const cache = await page2.evaluate(() => localStorage.getItem('qservice_unsaved_reports') || '{}');
      expect(cache).not.toContain(projectId); // Cleared on sync

      await ensureDbAuthenticated();
      const { data: dbFinal, error: selectError } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
      if (selectError) {
        throw new Error(`Select in Test G failed for project ${projectId}: ${selectError.message} (${selectError.code})`);
      }
      expect(dbFinal.report_data.cause).toBe(`Offline Cause G Iter ${i}`);

      await context2.close();
    }
  });

  test('Test H: Sessionablauf während Offline-Zeit', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_H`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Offline H');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000);

    // Simulate session expiration
    await page.evaluate(() => {
      localStorage.removeItem('qtool_current_user');
    });

    await context.setOffline(false);
    await page.waitForTimeout(4000);

    // Navigate to dashboard - should redirect to Login
    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('input[placeholder="Name eingeben..."]')).toBeVisible();

    await context.close();
  });

  test('Test I: Benutzerwechsel bei vorhandenem Cache', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_I`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Offline I');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000);

    // Logout and Login as Admin
    await page.click('button:has-text("Dashboard")');
    await page.click('button[title="Abmelden"]');
    
    await page.fill('input[placeholder="Name eingeben..."]', 'Admin User');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button:has-text("Anmelden")');
    await page.waitForTimeout(2000);

    await context.setOffline(false);
    await page.waitForTimeout(4000);

    // Unsaved reports should not automatically sync since user changed
    const cache = await page.evaluate(() => localStorage.getItem('qservice_unsaved_reports') || '{}');
    const parsed = JSON.parse(cache);
    expect(parsed[projectId]).toBeDefined();

    await context.close();
  });

  test('Test J: Beschädigter Cache und unbekannte schemaVersion', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_J`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    // Inject corrupted schema version cache
    await page.evaluate((args) => {
      const parsed = {
        [args.projectId]: {
          reportId: args.projectId,
          baseUpdatedAt: new Date().toISOString(),
          localUpdatedAt: new Date().toISOString(),
          reportData: { id: args.projectId, cause: 'Corrupt J' },
          schemaVersion: 'v999_unknown'
        }
      };
      localStorage.setItem('qservice_unsaved_reports', JSON.stringify(parsed));
    }, { projectId });

    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(5000);

    // App must be resilient and not crash
    await expect(page.locator('.tech-project-card', { hasText: projectTitle }).first()).toBeVisible();

    await context.close();
  });

  test('Test K: Fehlende measurementData und canvasImage', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_K`;
    
    // Reset with specific rooms but without any measurements/canvas
    const { updated_at: T1 } = await resetDbForProject(projectId, 'Original Cause', [
      { id: 'room-1', name: 'Zimmer K', measurements: [] }
    ], projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Offline K');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000);

    await context.setOffline(false);
    await page.waitForTimeout(6000);

    await ensureDbAuthenticated();
    const { data: dbFinal, error: selectError } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    if (selectError) {
      throw new Error(`Select in Test K failed for project ${projectId}: ${selectError.message} (${selectError.code})`);
    }
    expect(dbFinal.report_data.cause).toBe('Offline K');
    expect(dbFinal.report_data.rooms[0].name).toBe('Zimmer K');

    await context.close();
  });

  test('Test L: Mehrfaches online/focus/visibilitychange-Ereignis (Deduplizierung)', async ({ browser }) => {
    const iterations = 20;
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_L`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Offline L');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000); // Save to cache

    const tracker = new SupabaseWriteTracker(page);
    tracker.start();

    await context.setOffline(false);
    
    // Simulate rapid multiple online and focus events
    for (let i = 0; i < iterations; i++) {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('online'));
        window.dispatchEvent(new Event('focus'));
      });
    }

    await page.waitForTimeout(8000);
    tracker.stop();

    // Deduplication check: only 1 sync write request allowed
    expect(tracker.getWriteCount()).toBe(1);

    await context.close();
  });

  test('Test M: Manueller Save gleichzeitig mit Offline-Sync (Stress-Test)', async ({ browser }) => {
    const iterations = 50;
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_M`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');

    await context.setOffline(true);
    await page.fill('textarea:not([readonly])', 'Offline M');
    await page.dispatchEvent('textarea:not([readonly])', 'blur');
    await page.waitForTimeout(22000); // Save to cache

    const tracker = new SupabaseWriteTracker(page);
    tracker.start();

    // Go back online
    await context.setOffline(false);
    
    // Rapidly save manually while background sync is triggering
    for (let i = 0; i < iterations; i++) {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('online'));
      });
      await page.dispatchEvent('textarea:not([readonly])', 'blur');
    }

    await page.waitForTimeout(10000);
    tracker.stop();

    tracker.assertNoUnconditionalWrites();
    
    // Writes must have succeeded safely without collisions
    await ensureDbAuthenticated();
    const { data: dbFinal, error: selectError } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    if (selectError) {
      throw new Error(`Select in Test M failed for project ${projectId}: ${selectError.message} (${selectError.code})`);
    }
    expect(dbFinal.report_data.cause).toBe('Offline M');

    await context.close();
  });

  test('Test N: Explizite Löschung bei unveränderter Version', async ({ browser }) => {
    const projectId = crypto.randomUUID();
    const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_N`;
    await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsTechnician(page);

    await page.click(`.tech-project-card:has-text("${projectTitle}")`);
    await page.click('button:has-text("Schadenaufnahme")');
    await page.waitForSelector('textarea:not([readonly])');
    await page.waitForTimeout(2000);

    await context.setOffline(true);

    // Delete contact-2 offline
    await page.evaluate((args) => {
      const parsed = JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
      parsed[args.projectId] = {
        reportId: args.projectId,
        baseUpdatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
        reportData: {
          id: args.projectId,
          cause: 'Original Cause',
          contacts: [
            { id: 'contact-1', name: 'SENTINEL_CONTACT_1', phone: '111111', role: 'Mieter' }
          ]
        },
        changedPaths: ['contacts'],
        operations: [{ type: 'array_delete', path: 'contacts', itemId: 'contact-2' }],
        clientId: 'device-a-client',
        schemaVersion: 'v1'
      };
      localStorage.setItem('qservice_unsaved_reports', JSON.stringify(parsed));
    }, { projectId });

    await context.setOffline(false);
    await page.waitForTimeout(6000);

    const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
    expect(dbFinal.report_data.contacts.length).toBe(1); // Deleted successfully

    await context.close();
  });

  test('Test O: Explizite Löschung bei Versionskonflikt', async ({ browser }) => {
    const iterations = 20;
    for (let i = 1; i <= iterations; i++) {
      const projectId = crypto.randomUUID();
      const projectTitle = `PLAYWRIGHT_DATA_LOSS_${runId}_TEST_O_${i}`;
      const { updated_at: T1 } = await resetDbForProject(projectId, 'Original Cause', null, projectTitle);

      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await loginAsTechnician(pageA);

      await pageA.click(`.tech-project-card:has-text("${projectTitle}")`);
      await pageA.click('button:has-text("Schadenaufnahme")');
      await pageA.waitForSelector('textarea:not([readonly])');
      await pageA.waitForTimeout(2000);

      await contextA.setOffline(true);

      // Delete contact-2 offline on A
      await pageA.evaluate((args) => {
        const parsed = JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        parsed[args.projectId] = {
          reportId: args.projectId,
          baseUpdatedAt: args.T1,
          localUpdatedAt: new Date().toISOString(),
          reportData: {
            id: args.projectId,
            cause: 'Original Cause',
            contacts: [
              { id: 'contact-1', name: 'SENTINEL_CONTACT_1', phone: '111111', role: 'Mieter' }
            ]
          },
          changedPaths: ['contacts'],
          operations: [{ type: 'array_delete', path: 'contacts', itemId: 'contact-2' }],
          clientId: 'device-a-client',
          schemaVersion: 'v1'
        };
        localStorage.setItem('qservice_unsaved_reports', JSON.stringify(parsed));
      }, { projectId, T1 });

      // B edits cause online
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await loginAsTechnician(pageB);
      await pageB.click(`.tech-project-card:has-text("${projectTitle}")`);
      await pageB.click('button:has-text("Schadenaufnahme")');
      await pageB.waitForSelector('textarea:not([readonly])');
      await waitForAutosave(pageB, async () => {
        await pageB.fill('textarea:not([readonly])', `Online Cause B Iter ${i}`);
        await pageB.dispatchEvent('textarea:not([readonly])', 'blur');
      });

      // A online
      await contextA.setOffline(false);
      await pageA.waitForTimeout(4000);
      await pageA.click('button:has-text("Dashboard")');
      await pageA.waitForSelector('text=Lokale Änderungen gefunden!');

      // Server state check: contact-2 must still exist
      await ensureDbAuthenticated();
      const { data: dbFinal } = await supabase.from('damage_reports').select('report_data').eq('id', projectId).single();
      expect(dbFinal.report_data.contacts.length).toBe(2);
      expect(dbFinal.report_data.contacts.find(c => c.id === 'contact-2')).toBeDefined();

      await contextA.close();
      await contextB.close();
    }
  });

});
