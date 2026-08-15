import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ── Lade und bereite useSessionLock für Tests vor ──────────────────────
const hookPath = new URL('../src/hooks/useSessionLock.js', import.meta.url);
let hookSource = readFileSync(hookPath, 'utf8');

// Entferne imports
hookSource = hookSource.replace(/import\s*\{\s*useState,\s*useEffect,\s*useRef,\s*useCallback\s*\}\s*from\s*'react';/, '');
// Entferne exports
hookSource = hookSource.replaceAll('export function', 'function');
// Füge Rückgabewert hinzu
hookSource += '\nreturn { startSessionLockLifecycle, useSessionLock };';

const runHook = new Function('useState', 'useEffect', 'useRef', 'useCallback', hookSource);

// ── Hook Harness Klasse für React Lifecycle-Simulation ────────────────
class HookHarness {
  constructor(supabase, sessionToken, selectedReportId, view, resolvedMode, sessionStartedAt, enabled) {
    this.supabase = supabase;
    this.sessionToken = sessionToken;
    this.selectedReportId = selectedReportId;
    this.view = view;
    this.resolvedMode = resolvedMode;
    this.sessionStartedAt = sessionStartedAt;
    this.enabled = enabled;

    this.states = [];
    this.refs = [];
    this.effects = [];
    this.intervals = [];
    this.listeners = new Map();
    this.calls = [];

    // Mock-Implementierung von React Hooks
    this.useState = (initial) => {
      const idx = this.stateIdx++;
      if (this.states[idx] === undefined) {
        this.states[idx] = {
          value: initial,
          setter: (newValue) => {
            this.states[idx].value = typeof newValue === 'function' ? newValue(this.states[idx].value) : newValue;
          }
        };
      }
      return [this.states[idx].value, this.states[idx].setter];
    };

    this.useRef = (initial) => {
      const idx = this.refIdx++;
      if (this.refs[idx] === undefined) {
        this.refs[idx] = { current: initial };
      }
      return this.refs[idx];
    };

    this.useEffect = (fn, deps) => {
      const idx = this.effectIdx++;
      this.effects.push({ fn, deps, idx });
    };

    this.useCallback = (fn) => {
      return fn;
    };

    this.setIntervalFn = (callback, delay) => {
      const timer = { callback, delay };
      this.intervals.push(timer);
      this.calls.push(`interval:${delay}`);
      return timer;
    };

    this.clearIntervalFn = (timer) => {
      this.calls.push(`clear:${timer?.delay}`);
      const i = this.intervals.indexOf(timer);
      if (i >= 0) this.intervals.splice(i, 1);
    };

    this.eventTarget = {
      addEventListener: (name, listener) => {
        this.calls.push(`add:${name}`);
        this.listeners.set(name, listener);
      },
      removeEventListener: (name) => {
        this.calls.push(`remove:${name}`);
        this.listeners.delete(name);
      },
    };

    this.fetchFn = (url, init) => {
      this.calls.push({ method: 'fetch', url, init });
    };

    // Erzeuge das exportierte Modul aus dem modifizierten Quellcode
    const module = runHook(this.useState, this.useEffect, this.useRef, this.useCallback);
    this.useSessionLock = module.useSessionLock;
  }

  run() {
    this.stateIdx = 0;
    this.refIdx = 0;
    this.effectIdx = 0;
    this.effects = [];

    // Führe den Hook aus
    this.result = this.useSessionLock(
      this.supabase,
      this.sessionToken,
      this.selectedReportId,
      this.view,
      this.resolvedMode,
      this.sessionStartedAt,
      this.enabled
    );

    // Vergleiche dependencies und führe Effekte aus
    if (!this.prevEffects) {
      this.prevEffects = [];
    }

    const nextEffects = [];
    this.effects.forEach((eff) => {
      const prev = this.prevEffects[eff.idx];
      let changed = !prev;
      if (prev && eff.deps && prev.deps) {
        changed = eff.deps.some((dep, i) => dep !== prev.deps[i]);
      }
      if (changed) {
        if (prev && prev.cleanup) {
          const origWindow = globalThis.window;
          const origSetInterval = globalThis.setInterval;
          const origClearInterval = globalThis.clearInterval;
          const origFetch = globalThis.fetch;

          globalThis.window = this.eventTarget;
          globalThis.setInterval = this.setIntervalFn;
          globalThis.clearInterval = this.clearIntervalFn;
          globalThis.fetch = this.fetchFn;

          try {
            prev.cleanup();
          } finally {
            globalThis.window = origWindow;
            globalThis.setInterval = origSetInterval;
            globalThis.clearInterval = origClearInterval;
            globalThis.fetch = origFetch;
          }
        }
        // Führe den Effekt aus, wir übergeben die Mocks an startSessionLockLifecycle
        // durch Überschreiben von globalen oder Hook-internen Variablen.
        // Da startSessionLockLifecycle intern die Parameter aus dem globalen window zieht bzw.
        // wir startSessionLockLifecycle in useSessionLock mocken wollen:
        // Wir patchen das optionen-Objekt das an startSessionLockLifecycle übergeben wird.
        // Da startSessionLockLifecycle in useSessionLock aufgerufen wird, müssen wir sicherstellen,
        // dass die Mocks dorthin durchgereicht werden.
        // Dazu patchen wir globalThis.window und globalThis.setInterval, etc. temporär während der Ausführung.
        const origWindow = globalThis.window;
        const origSetInterval = globalThis.setInterval;
        const origClearInterval = globalThis.clearInterval;
        const origFetch = globalThis.fetch;

        globalThis.window = this.eventTarget;
        globalThis.setInterval = this.setIntervalFn;
        globalThis.clearInterval = this.clearIntervalFn;
        globalThis.fetch = this.fetchFn;

        try {
          const cleanup = eff.fn();
          eff.cleanup = typeof cleanup === 'function' ? cleanup : null;
        } finally {
          globalThis.window = origWindow;
          globalThis.setInterval = origSetInterval;
          globalThis.clearInterval = origClearInterval;
          globalThis.fetch = origFetch;
        }
      } else {
        eff.cleanup = prev.cleanup;
      }
      nextEffects.push(eff);
    });

    this.prevEffects = nextEffects;
  }

  updateProps({ supabase, sessionToken, selectedReportId, view, resolvedMode, sessionStartedAt, enabled }) {
    if (supabase !== undefined) this.supabase = supabase;
    if (sessionToken !== undefined) this.sessionToken = sessionToken;
    if (selectedReportId !== undefined) this.selectedReportId = selectedReportId;
    if (view !== undefined) this.view = view;
    if (resolvedMode !== undefined) this.resolvedMode = resolvedMode;
    if (sessionStartedAt !== undefined) this.sessionStartedAt = sessionStartedAt;
    if (enabled !== undefined) this.enabled = enabled;
    this.run();
  }

  unmount() {
    if (this.prevEffects) {
      this.prevEffects.forEach((eff) => {
        if (eff.cleanup) {
          const origWindow = globalThis.window;
          const origSetInterval = globalThis.setInterval;
          const origClearInterval = globalThis.clearInterval;
          const origFetch = globalThis.fetch;

          globalThis.window = this.eventTarget;
          globalThis.setInterval = this.setIntervalFn;
          globalThis.clearInterval = this.clearIntervalFn;
          globalThis.fetch = this.fetchFn;

          try {
            eff.cleanup();
          } finally {
            globalThis.window = origWindow;
            globalThis.setInterval = origSetInterval;
            globalThis.clearInterval = origClearInterval;
            globalThis.fetch = origFetch;
          }
        }
      });
    }
  }
}

// ── Supabase Mock Generator ───────────────────────────────────────────
const createMockSupabase = () => {
  const requests = [];
  return {
    requests,
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    rpc: (name, params) => {
      requests.push({ method: 'rpc', name, params });
      return Promise.resolve({ data: [{ acquired: true }], error: null });
    },
    from: (table) => ({
      upsert: (data, opts) => {
        requests.push({ method: 'upsert', table, data, opts });
        return Promise.resolve({ error: null });
      },
      select: (columns) => {
        requests.push({ method: 'select', table, columns });
        return {
          not: (col, operator, val) => {
            requests.push({ method: 'select.not', table, col, operator, val });
            return Promise.resolve({ data: [], error: null });
          }
        };
      },
      delete: () => {
        requests.push({ method: 'delete', table });
        return {
          eq: (col, val) => {
            requests.push({ method: 'delete.eq', table, col, val });
            return Promise.resolve({ error: null });
          },
          lt: (col, val) => {
            requests.push({ method: 'delete.lt', table, col, val });
            return Promise.resolve({ error: null });
          }
        };
      }
    })
  };
};

// ── Tests ─────────────────────────────────────────────────────────────

test('1. currentUser=false, Supabase-Session=false: kein SessionLock', () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), false);
  harness.run();

  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
  assert.equal(supabase.requests.length, 0);
});

test('2. currentUser=true, Supabase-Session=false: kein SessionLock', () => {
  const supabase = createMockSupabase();
  // currentUser=true, Supabase-Session=false -> enabled=false
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), false);
  harness.run();

  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
  assert.equal(supabase.requests.length, 0);
});

test('3. currentUser=false, Supabase-Session=true: kein SessionLock', () => {
  const supabase = createMockSupabase();
  // currentUser=false, Supabase-Session=true -> enabled=false
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), false);
  harness.run();

  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
  assert.equal(supabase.requests.length, 0);
});

test('4. currentUser=true, Supabase-Session=true: SessionLock startet', () => {
  const supabase = createMockSupabase();
  // currentUser=true, Supabase-Session=true -> enabled=true
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), true);
  harness.run();

  assert.equal(harness.intervals.length, 1);
  assert.equal(harness.listeners.has('beforeunload'), true);
  // Sollte upsertSession und pollSessions sofort aufrufen
  const lockReq = supabase.requests.find(r => r.method === 'rpc' && r.name === 'acquire_project_lock');
  assert.ok(lockReq);
});

test('5. Supabase-Auth wird später verfügbar: SessionLock startet genau einmal', () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), false);
  harness.run();

  assert.equal(harness.intervals.length, 0);

  // Jetzt wird Auth verfügbar -> enabled = true
  harness.updateProps({ enabled: true });

  assert.equal(harness.intervals.length, 1);
  assert.equal(harness.listeners.has('beforeunload'), true);

  // Upsert und Poll sollten ausgeführt worden sein (je 1x aus lifecycle und 1x aus immediate effect)
  const locks = supabase.requests.filter(r => r.method === 'rpc' && r.name === 'acquire_project_lock');
  assert.ok(locks.length >= 1);
});

test('6. Supabase-Auth geht verloren: SessionLock stoppt', () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), true);
  harness.run();

  assert.equal(harness.intervals.length, 1);

  // Auth geht verloren -> enabled = false
  harness.updateProps({ enabled: false });

  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
});

test('7. kein POST vor bestätigter Auth', () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), false);
  harness.run();

  // Versuche property-Updates (wie view-Wechsel), die normalerweise einen upsert triggern würden
  harness.updateProps({ view: 'new-report' });

  const locks = supabase.requests.filter(r => r.method === 'rpc' && r.name === 'acquire_project_lock');
  assert.equal(locks.length, 0);
});

test('8. Lock-Status wird nach Auth über nicht-geheime RPC gepollt', () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), true);
  harness.run();

  // Poll Timer sollte registriert sein
  const pollTimer = harness.intervals.find(t => t.delay === 5000);
  assert.ok(pollTimer);

  const prevStatusCount = supabase.requests.filter(
    r => r.method === 'rpc' && r.name === 'get_project_lock_status'
  ).length;
  pollTimer.callback();
  assert.equal(
    supabase.requests.filter(r => r.method === 'rpc' && r.name === 'get_project_lock_status').length,
    prevStatusCount + 1
  );
  assert.equal(supabase.requests.filter(r => r.method === 'select.not').length, 0);
});

test('9. Logout stoppt weitere Requests', () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), true);
  harness.run();

  assert.equal(harness.intervals.length, 1);

  // Logout triggern -> enabled = false
  harness.updateProps({ enabled: false });

  // Verifizieren, dass keine Timer mehr vorhanden sind
  assert.equal(harness.intervals.length, 0);

  // Verifizieren, dass kein DELETE-Request gesendet wird
  const deletes = supabase.requests.filter(r => r.method === 'delete' || r.method === 'delete.eq');
  assert.equal(deletes.length, 0);
});

test('10. takeOverLock bleibt geschützt', async () => {
  const supabase = createMockSupabase();
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', Date.now(), false);
  harness.run();

  // takeOverLock aufrufen, wenn enabled = false
  const takeOverLock = harness.result.takeOverLock;
  await takeOverLock();

  // Keine Delete-Requests auf project_sessions
  const deletes = supabase.requests.filter(r => r.method.startsWith('delete'));
  assert.equal(deletes.length, 0);
});

test('11. Konflikt blockiert gleichem Modus (Desktop vs Desktop)', async () => {
  const supabase = createMockSupabase();

  // Custom mock select implementation to return conflicting sessions with SAME mode (desktop)
  supabase.from = (table) => ({
    upsert: (data, opts) => {
      supabase.requests.push({ method: 'upsert', table, data, opts });
      return Promise.resolve({ error: null });
    },
    select: (columns) => {
      supabase.requests.push({ method: 'select', table, columns });
      return {
        not: (col, operator, val) => {
          supabase.requests.push({ method: 'select.not', table, col, operator, val });
          return Promise.resolve({
            data: [
              {
                session_token: 'otherToken', // lexicographically smaller than token123
                open_project_id: 'report456',
                mode: 'desktop',
                last_seen: new Date(Date.now() - 5000).toISOString()
              },
              {
                session_token: 'token123',
                open_project_id: 'report456',
                mode: 'desktop',
                last_seen: new Date().toISOString()
              }
            ],
            error: null
          });
        }
      };
    }
  });

  const sessionStartedAt = Date.now() - 30000; // session is old (> 15s)
  const harness = new HookHarness(supabase, 'token123', 'report456', 'details', 'desktop', sessionStartedAt, true);
  harness.run();

  const pollTimer = harness.intervals.find(t => t.delay === 5000);
  assert.ok(pollTimer);

  // Run poll callback which computes conflicts
  await pollTimer.callback();

  // The session active state should be set to false due to same-mode conflict
  assert.equal(harness.states[1].value, false);
});
