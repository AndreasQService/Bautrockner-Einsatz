import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startSessionLockLifecycle } from '../src/hooks/useSessionLock.js';

const createHarness = (enabled) => {
  const calls = [];
  const intervals = [];
  const listeners = new Map();
  const enabledRef = { current: enabled };
  const tokenRef = { current: 'session token' };
  const supabase = {
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'test-key',
  };

  const options = {
    enabledRef,
    tokenRef,
    supabase,
    upsertSession: () => calls.push('upsert'),
    pollSessions: () => calls.push('poll'),
    cleanupOldSessions: () => calls.push('cleanup'),
    deleteSession: () => calls.push('delete'),
    eventTarget: {
      addEventListener: (name, listener) => {
        calls.push(`add:${name}`);
        listeners.set(name, listener);
      },
      removeEventListener: (name, listener) => {
        calls.push(`remove:${name}`);
        assert.equal(listeners.get(name), listener);
        listeners.delete(name);
      },
    },
    setIntervalFn: (callback, delay) => {
      const timer = { callback, delay };
      intervals.push(timer);
      calls.push(`interval:${delay}`);
      return timer;
    },
    clearIntervalFn: (timer) => {
      calls.push(`clear:${timer.delay}`);
      intervals.splice(intervals.indexOf(timer), 1);
    },
    fetchFn: (url, init) => calls.push({ url, init }),
  };

  return { calls, enabledRef, intervals, listeners, options };
};

test('enabled false creates no requests, timers, listener, cleanup, or DELETE', () => {
  const harness = createHarness(false);
  const cleanup = startSessionLockLifecycle(harness.options);

  assert.equal(cleanup, undefined);
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
});

test('enabled true preserves the lock on beforeunload and lifecycle cleanup', () => {
  const harness = createHarness(true);
  const cleanup = startSessionLockLifecycle(harness.options);

  assert.deepEqual(harness.calls.slice(0, 4), [
    'upsert',
    'poll',
    'interval:5000',
    'add:beforeunload',
  ]);
  assert.equal(harness.listeners.has('beforeunload'), true);

  harness.intervals[0].callback();
  assert.deepEqual(harness.calls.slice(4, 5), ['poll']);

  harness.listeners.get('beforeunload')();
  // beforeunload now does not trigger immediate delete (lock is preserved)

  cleanup();
  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
  assert.equal(harness.calls.includes('delete'), false);
});

test('false to true starts once without duplicate intervals', () => {
  const harness = createHarness(false);
  assert.equal(startSessionLockLifecycle(harness.options), undefined);

  harness.enabledRef.current = true;
  const cleanup = startSessionLockLifecycle(harness.options);

  assert.equal(harness.calls.filter((call) => call === 'upsert').length, 1);
  assert.equal(harness.calls.filter((call) => call === 'poll').length, 1);
  assert.equal(harness.intervals.length, 1);
  assert.equal(harness.listeners.size, 1);
  cleanup();
});

test('true to false removes timers and listener without further requests', () => {
  const harness = createHarness(true);
  const cleanup = startSessionLockLifecycle(harness.options);
  const scheduledCallbacks = harness.intervals.map(({ callback }) => callback);

  harness.enabledRef.current = false;
  cleanup();
  const callsAfterDisable = harness.calls.length;
  scheduledCallbacks.forEach((callback) => callback());

  assert.equal(harness.intervals.length, 0);
  assert.equal(harness.listeners.size, 0);
  assert.equal(harness.calls.includes('delete'), false);
  assert.equal(harness.calls.length, callsAfterDisable);
});
test('App always calls the hook and gates it with the visible QTool user', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /useSessionLock\([\s\S]*sessionStartedAtRef\.current,\s*Boolean\(currentUser\)\s*&&\s*Boolean\(supabaseSession\?\.user\)\s*\)/);
  assert.match(appSource, /const currentUser = authenticatedUser/);
  assert.match(mainSource, /createElement\(AuthGate, null, \(authenticatedUser\) => createElement\(App, \{ authenticatedUser \}\)\)/);
  assert.doesNotMatch(appSource, /if \(!currentUser\)\s*\{\s*return\s*\(/);
});

test('the immediate project-change effect is also disabled before login', () => {
  const hookSource = readFileSync(new URL('../src/hooks/useSessionLock.js', import.meta.url), 'utf8');
  assert.match(hookSource, /useEffect\(\(\) => \{\s*if \(!enabled\) return;[\s\S]*queueMicrotask\([\s\S]*void upsertSession\(\);[\s\S]*void pollSessions\(\);/);
});

test('old open project locks remain visible until explicit release', () => {
  const hookSource = readFileSync(new URL('../src/hooks/useSessionLock.js', import.meta.url), 'utf8');
  assert.match(hookSource, /\.rpc\('get_project_lock_status'/);
  assert.doesNotMatch(hookSource, /\.from\('project_sessions'\)/);
  assert.doesNotMatch(hookSource, /\.gte\('last_seen'/);
  assert.match(hookSource, /elapsed\s+time never hides or releases a lock/i);
  assert.match(hookSource, /\.rpc\('release_project_lock',[\s\S]*p_session_token:\s*tokenRef\.current/);
});
