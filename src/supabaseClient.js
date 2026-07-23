import { createClient } from '@supabase/supabase-js'

// ======================================================================
// ENHANCED STRICT TEST-ENVIRONMENT GUARD
// ======================================================================
export const LIVE_PROJECT_ID = 'yxdoecdqttgdncgbzyus';
export const SUPABASE_ID_REGEX = /^[a-z0-9]{20}$/;

/**
 * Validates Supabase environment parameters for test isolation.
 * Throws explicit descriptive errors on any invalid or prohibited input.
 * 
 * @param {string} rawUrl
 * @param {string} rawKey
 * @param {string} expectedProjectId
 * @returns {URL} parsed valid URL instance
 */
export function validateSupabaseConfig(rawUrl, rawKey, expectedProjectId) {
  // 1. Grundlegende Anwesenheitsprüfungen
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('[TEST GUARD ABORT] VITE_SUPABASE_URL ist nicht konfiguriert!');
  }

  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    throw new Error('[TEST GUARD ABORT] VITE_SUPABASE_ANON_KEY ist nicht konfiguriert!');
  }

  if (!expectedProjectId || typeof expectedProjectId !== 'string' || !expectedProjectId.trim()) {
    throw new Error('[TEST GUARD ABORT] VITE_EXPECTED_SUPABASE_PROJECT_ID ist nicht konfiguriert!');
  }

  // 2. Syntax- & Längenprüfung der erwarteten Projekt-ID (exakt 20 Zeichen, a-z0-9, nur Kleinbuchstaben)
  if (!SUPABASE_ID_REGEX.test(expectedProjectId)) {
    throw new Error(`[TEST GUARD ABORT] UNGÜLTIGE PROJEKT-ID: VITE_EXPECTED_SUPABASE_PROJECT_ID ('${expectedProjectId}') muss genau 20 alphanumerische Kleinbuchstaben/Ziffern enthalten.`);
  }

  // 3. Explizite Blockierung der Live-Projekt-ID
  if (expectedProjectId === LIVE_PROJECT_ID || rawUrl.includes(LIVE_PROJECT_ID)) {
    throw new Error(`[TEST GUARD ABORT] KRITISCHER SICHERHEITSFEHLER: Die Live-Projekt-ID (${LIVE_PROJECT_ID}) darf niemals in der Testumgebung verwendet werden!`);
  }

  // 4. Strikte URL-Validierung mit Web API URL
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (e) {
    throw new Error(`[TEST GUARD ABORT] UNGÜLTIGE URL-SYNTAX: VITE_SUPABASE_URL ('${rawUrl}') konnte nicht geparst werden.`);
  }

  // Check auf exakte Rohstrings: Hash-Fragmente (#), Query-Strings (?) oder unerwünschte Suffixe/Punkte
  if (rawUrl.includes('#')) {
    throw new Error('[TEST GUARD ABORT] UNZULÄSSIGES HASH-FRAGMENT: URL darf kein Hash-Fragment (#) enthalten.');
  }

  if (rawUrl.includes('?')) {
    throw new Error('[TEST GUARD ABORT] UNZULÄSSIGER QUERY-STRING: URL darf keinen Query-String (?) enthalten.');
  }

  if (parsedUrl.hostname.endsWith('.')) {
    throw new Error('[TEST GUARD ABORT] UNZULÄSSIGER SCHLUSS-PUNKT: Hostname darf nicht auf einen Punkt enden.');
  }

  // Protokoll muss exakt 'https:' sein
  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`[TEST GUARD ABORT] UNSICHERES PROTOKOLL: URL-Protokoll muss exakt 'https:' sein, erhalten: '${parsedUrl.protocol}'.`);
  }

  // Hostname muss exakt '${expectedProjectId}.supabase.co' entsprechen
  const expectedHost = `${expectedProjectId}.supabase.co`;
  if (parsedUrl.hostname !== expectedHost) {
    throw new Error(`[TEST GUARD ABORT] HOSTNAME-MISSMATCH: Hostname muss exakt '${expectedHost}' entsprechen, erhalten: '${parsedUrl.hostname}'.`);
  }

  // Keine Ports, Benutzernamen oder Passwörter
  if (parsedUrl.port && parsedUrl.port !== '') {
    throw new Error(`[TEST GUARD ABORT] UNZULÄSSIGER PORT: Port '${parsedUrl.port}' ist in der Supabase-URL nicht erlaubt.`);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('[TEST GUARD ABORT] UNZULÄSSIGE CREDENTIALS: User/Passwort in der URL sind nicht erlaubt.');
  }

  if (parsedUrl.pathname && parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
    throw new Error(`[TEST GUARD ABORT] UNZULÄSSIGER PFAD: Pfad '${parsedUrl.pathname}' in Supabase-URL nicht erlaubt.`);
  }

  return parsedUrl;
}

// Ausführen der Validierung zur Modul-Ladezeit
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const rawUrl = env.VITE_SUPABASE_URL;
const rawKey = env.VITE_SUPABASE_ANON_KEY;
const expectedProjectId = env.VITE_EXPECTED_SUPABASE_PROJECT_ID;

let validatedUrl = null;
let supabaseInstance = null;

const isWebDriver = typeof navigator !== 'undefined' && navigator.webdriver;

if (isWebDriver) {
  // SessionStorage helpers for persistent mock DB state across reloads
  const getSessionStorageItem = (key, fallback) => {
    try {
      const v = sessionStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };

  const setSessionStorageItem = (key, val) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };

  // Centralized Mock Database for E2E and offline testing
  let mockProjects = getSessionStorageItem('mock_db_projects', [
    {
      id: 'c1f73b62-bd32-4752-a567-3406ac89de78',
      project_title: 'W-12345 Wasserschaden Test-Projekt (Measurement)',
      client: 'TEST-CLIENT-001',
      address: 'Wohnzimmer, Küche',
      status: 'In Bearbeitung',
      assigned_to: 'Techniker 1',
      date: new Date().toISOString().split('T')[0],
      drying_started: null,
      report_data: {
        id: 'c1f73b62-bd32-4752-a567-3406ac89de78',
        projectTitle: 'W-12345 Wasserschaden Test-Projekt (Measurement)',
        client: 'TEST-CLIENT-001',
        address: 'Wohnzimmer, Küche',
        status: 'In Bearbeitung',
        assignedTo: 'Techniker 1',
        date: new Date().toISOString().split('T')[0],
        rooms: [
          { id: 'room_wohnzimmer', name: 'Wohnzimmer', measurements: [] },
          { id: 'room_kueche', name: 'Küche', measurements: [] }
        ],
        measurementRooms: [
          { id: 'room_wohnzimmer', name: 'Wohnzimmer', measurements: [] },
          { id: 'room_kueche', name: 'Küche', measurements: [] }
        ]
      }
    }
  ]);

  let systemSettings = {
    id: 'SYSTEM_SETTINGS',
    report_data: {
      users: [
        { id: 1, name: 'Admin User', role: 'admin', password: 'admin' },
        { id: 2, name: 'Techniker 1', role: 'technician', password: '123' },
        { id: 3, name: 'Mensur Sherifi', role: 'technician', password: '123' }
      ]
    }
  };

  let imageUploads = getSessionStorageItem('mock_db_image_uploads', []);

  function makeMockQuery(tableName, data, error = null) {
    const promise = Promise.resolve({ data, error });
    promise.order = (col, opts) => promise;
    promise.eq = (col, val) => {
      console.log('[MOCK DB] eq called:', tableName, col, val);
      if (tableName === 'damage_reports' && val === 'SYSTEM_SETTINGS') {
        return makeMockQuery(tableName, systemSettings, null);
      }
      if (tableName === 'damage_reports') {
        const p = mockProjects.find(x => x.id === val);
        console.log('[MOCK DB] eq damage_reports found:', p ? p.id : 'none');
        return makeMockQuery(tableName, p || null, p ? null : { message: 'Not found' });
      }
      if (tableName === 'project_image_uploads') {
        const items = imageUploads.filter(x => x.local_image_id === val);
        return makeMockQuery(tableName, items[0] || null, items[0] ? null : { message: 'Not found' });
      }
      return promise;
    };
    promise.single = () => {
      console.log('[MOCK DB] single called:', tableName);
      const singleData = Array.isArray(data) ? data[0] : data;
      return makeMockQuery(tableName, singleData, error);
    };
    return promise;
  }

  const mockFrom = (tableName) => {
    return {
      select: (columns) => {
        console.log('[MOCK DB] select called:', tableName, columns);
        if (tableName === 'damage_reports') {
          console.log('[MOCK DB] returning projects count:', mockProjects.length);
          return makeMockQuery(tableName, mockProjects);
        }
        return makeMockQuery(tableName, null);
      },
      upsert: (payload, opts) => {
        console.log('[MOCK DB] upsert called:', tableName, payload);
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const r of rows) {
          if (tableName === 'damage_reports') {
            const idx = mockProjects.findIndex(p => p.id === r.id);
            if (idx >= 0) {
              mockProjects[idx] = { ...mockProjects[idx], ...r };
            } else {
              mockProjects.push(r);
            }
            console.log('[MOCK DB] upsert damage_reports payload measurements count:', r.report_data?.measurementRooms?.[0]?.measurementData?.measurements?.length);
            console.log('[MOCK DB] upsert damage_reports completed. Total projects:', mockProjects.length);
            setSessionStorageItem('mock_db_projects', mockProjects);
          } else if (tableName === 'project_image_uploads') {
            const idx = imageUploads.findIndex(p => p.local_image_id === r.local_image_id);
            const row = {
              ...r,
              storage_status: 'remote_verified',
              remote_item_id: 'fake_onedrive_item_id_' + r.local_image_id,
              remote_path: '/fake/onedrive/path/' + r.filename
            };
            if (idx >= 0) imageUploads[idx] = row;
            else imageUploads.push(row);
            setSessionStorageItem('mock_db_image_uploads', imageUploads);
          }
        }
        return makeMockQuery(tableName, payload);
      },
      update: (payload) => {
        console.log('[MOCK DB] update called:', tableName, payload);
        if (tableName === 'damage_reports') {
          return {
            eq: (col, val) => {
              console.log('[MOCK DB] update eq called:', tableName, col, val);
              const p = mockProjects.find(x => x.id === val);
              if (p) {
                p.report_data = { ...p.report_data, ...payload.report_data };
                setSessionStorageItem('mock_db_projects', mockProjects);
              }
              return makeMockQuery(tableName, null);
            }
          };
        }
        return makeMockQuery(tableName, null);
      }
    };
  };

  const mockStorage = {
    from: (bucket) => {
      return {
        upload: (path, blob, opts) => {
          return Promise.resolve({ data: { path }, error: null });
        },
        list: (path, opts) => {
          const searchName = opts.search || '';
          return Promise.resolve({ data: [{ name: searchName, metadata: { size: 100 }, size: 100 }], error: null });
        }
      };
    }
  };

  supabaseInstance = {
    from: mockFrom,
    storage: mockStorage,
    auth: {
      getSession: () => {
        return Promise.resolve({ data: { session: { user: { id: 2, email: 'Techniker 1' } } }, error: null });
      },
      signInWithPassword: ({ email, password }) => {
        const user = systemSettings.report_data.users.find(u => u.name === email && u.password === password);
        if (user) {
          return Promise.resolve({ data: { user: { id: user.id, email: user.name } }, error: null });
        }
        return Promise.resolve({ data: { user: null }, error: { message: 'Invalid credentials' } });
      },
      onAuthStateChange: (cb) => {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    }
  };
} else if (rawUrl || rawKey || expectedProjectId) {
  validatedUrl = validateSupabaseConfig(rawUrl, rawKey, expectedProjectId);
  supabaseInstance = createClient(validatedUrl.href, rawKey);
}

export const supabase = supabaseInstance;
