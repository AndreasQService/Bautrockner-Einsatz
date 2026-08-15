import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 5000; // poll every 5s
const HEARTBEAT_INTERVAL = 30 * 1000; // keep ownership alive while project stays open
const SESSION_TIMEOUT = 15 * 60 * 1000; // owner triggers the strict sync-and-exit flow

export function startSessionLockLifecycle({
  enabledRef,
  isSessionActiveRef,
  reportIdRef,
  viewRef,
  supabase,
  upsertSession,
  pollSessions,
  eventTarget = window,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  if (!enabledRef.current || !supabase) return undefined;

  // Set lock immediately on project open
  upsertSession();
  pollSessions();

  // Poll lock status every 5 seconds (no write heartbeat)
  let lastHeartbeatAt = Date.now();
  const pollTimer = setIntervalFn(() => {
    if (!enabledRef.current) return;
    pollSessions();
    const inProject = viewRef?.current === 'details' || viewRef?.current === 'new-report';
    const now = Date.now();
    if (inProject && reportIdRef?.current && isSessionActiveRef?.current && now - lastHeartbeatAt >= HEARTBEAT_INTERVAL) {
      lastHeartbeatAt = now;
      upsertSession();
    }
  }, POLL_INTERVAL);

  const handleUnload = () => {
    // Keep lock on page reload / tab close. It remains visible and exclusive
    // until explicit verified release or a separately audited recovery.
    console.log('[SessionLock] Preserving project lock session on unload.');
  };

  eventTarget.addEventListener('beforeunload', handleUnload);

  return () => {
    clearIntervalFn(pollTimer);
    eventTarget.removeEventListener('beforeunload', handleUnload);

    // A normal release is deliberately NOT performed by effect cleanup.  The
    // navigation gate releases only after all cloud destinations are verified
    // and the view transition has actually completed. Crash recovery remains
    // available on reload; abandoned locks require audited recovery.
  };
}

export function useSessionLock(
  supabase,
  sessionToken,
  selectedReportId,
  view,
  resolvedMode,
  sessionStartedAt,
  enabled = true,
  currentUser = null,
  onInactivityTimeout = null
) {
  const [lockedProjectIds, setLockedProjectIds]   = useState(new Set());
  // Initialize to true if locking is disabled or no report is selected
  const [isSessionActive,  setIsSessionActive]    = useState(!enabled || !selectedReportId);
  const [activeLockUser, setActiveLockUser]       = useState(null);
  const [activeLockSince, setActiveLockSince]     = useState(null);
  const [activeLockDevice, setActiveLockDevice]   = useState(null);
  const [isLockedByIPad, setIsLockedByIPad]       = useState(false);
  const [activeLockActivity, setActiveLockActivity] = useState(null);

  const isSessionActiveRef = useRef(!enabled || !selectedReportId);
  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  const isTestAgent = typeof navigator !== 'undefined' && navigator.userAgent.includes('QToolDeepTest');
  const isLockEnabled = enabled || isTestAgent;

  if (!isLockEnabled && !isSessionActive) {
    setIsSessionActive(true);
  }

  const tokenRef      = useRef(sessionToken);
  const reportIdRef   = useRef(selectedReportId);
  const modeRef       = useRef(resolvedMode);
  const viewRef       = useRef(view);
  const enabledRef    = useRef(isLockEnabled);

  const lastExtendedRef = useRef(0);
  const lastLocalActivityRef = useRef(0);

  // Keep refs synchronized
  useEffect(() => { tokenRef.current    = sessionToken;    }, [sessionToken]);
  useEffect(() => { reportIdRef.current = selectedReportId; }, [selectedReportId]);
  useEffect(() => { modeRef.current     = resolvedMode;    }, [resolvedMode]);
  useEffect(() => { viewRef.current     = view;            }, [view]);
  useEffect(() => { enabledRef.current  = isLockEnabled;   }, [isLockEnabled]);

  // iPad detection
  const isIPad = /iPad/i.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                 (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
  const myDevice = isIPad ? 'iPad' : (/iPhone|Android/i.test(navigator.userAgent) ? 'Mobil' : 'Desktop');

  const userEmail = currentUser?.email || 'Unbekannt';
  const userId = currentUser?.id || 'unknown';
  const username = currentUser?.name || 'Unbekannt';

  // ── Eigene Session upserten (Sperre setzen/verlängern) ───────────────────
  const upsertSession = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;
    const openProjectId = (viewRef.current === 'details' || viewRef.current === 'new-report')
      ? (reportIdRef.current ?? null)
      : null;

    if (!openProjectId) return;

    // Save device, user ID, username, and email in device string
    const deviceValue = `${myDevice}:${userId}:${username}:${userEmail}`;
    // 1. Attempt lock acquire on database via atomic RPC function
    const { data, error } = await supabase.rpc('acquire_project_lock', {
      p_project_id:    openProjectId,
      p_session_token: tokenRef.current,
      p_user_id:       String(userId),
      p_user_name:     username,
      p_device:        deviceValue,
    });

    if (error) {
      console.warn('[SessionLock] Lock acquire RPC failed:', error.message);
      // Fail closed: without a database confirmation this client is never the
      // writer.  The local offline outbox may keep data safe, but it must not
      // turn a second device into a concurrent cloud writer.
      setIsSessionActive(false);
    } else {
      const result = data && data[0];
      if (result && result.acquired) {
        // Lock confirmed by DB
        setIsSessionActive(true);
        console.log('[SessionLock] LOCK_ACQUIRED / DB confirmed lock.', { openProjectId });
      } else {
        // Lock blocked/denied!
        // iPad priority is decided atomically inside acquire_project_lock.
        // Never delete another owner's row from the browser and never assume
        // ownership after a denied/failed RPC.
        setIsSessionActive(false);
        console.log('[SessionLock] LOCK_DENIED / project locked by another session.', result);
      }
    }
  }, [supabase, myDevice, userId, username, userEmail]);

  // ── Session bei Aktivität verlängern ───────────────────────────────────
  const registerProjectActivity = useCallback(() => {
    if (!enabledRef.current || !supabase) return;
    const now = Date.now();
    lastLocalActivityRef.current = now;

    // Throttle database calls to once every 10 seconds to protect the API
    if (now - lastExtendedRef.current > 10000) {
      lastExtendedRef.current = now;
      upsertSession();
      console.log('[SessionLock] USER_ACTIVITY registered, DB lock extended.');
    }
  }, [supabase, upsertSession]);

  // Only a read-back-verified local project mutation resets inactivity.
  // Reading, scrolling, tab changes and generic clicks intentionally do not.
  useEffect(() => {
    if (!enabled || !supabase) return;

    const handleActivity = (event) => {
      if (String(event?.detail?.projectId || '') !== String(reportIdRef.current || '')) return;
      registerProjectActivity();
    };

    window.addEventListener('qtool:local-mutation-confirmed', handleActivity);

    return () => {
      window.removeEventListener('qtool:local-mutation-confirmed', handleActivity);
    };
  }, [enabled, supabase, registerProjectActivity]);

  // Reset local activity timer on opening new project
  useEffect(() => {
    if (selectedReportId) {
      lastLocalActivityRef.current = Date.now();
      lastExtendedRef.current = Date.now();
    }
  }, [selectedReportId]);

  // ── Session löschen (Sperre freigeben) ─────────────────────────────────
  const deleteSession = useCallback(async (explicitProjectId = null) => {
    if (!supabase) return;
    const projectId = explicitProjectId || reportIdRef.current;
    if (!projectId) return;
    const { data, error } = await supabase.rpc('release_project_lock', {
      p_project_id: projectId,
      p_session_token: tokenRef.current,
    });
    if (error) throw error;
    if (data !== true) throw new Error('Sperre wurde nicht freigegeben: Owner/Session stimmt nicht.');
    console.log('[SessionLock] LOCK_RELEASED');
    return true;
  }, [supabase]);

  // ── Andere Sessions abfragen und Locks berechnen ──────────────────────
  const pollSessions = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;

    const myProjectId = reportIdRef.current;
    const myView      = viewRef.current;
    const inProject   = myView === 'details' || myView === 'new-report';

    // 1. Check local inactivity timeout first
    if (inProject && isSessionActiveRef.current) {
      const inactiveMs = Date.now() - lastLocalActivityRef.current;
      if (inactiveMs >= SESSION_TIMEOUT) {
        console.warn('[SessionLock] INACTIVITY_TIMEOUT reached!');
        // Inactivity is a request to leave, not permission to release.  The
        // caller's strict exit gate decides whether navigation and release are
        // safe. Until then this owner keeps its lease and remains the only
        // cloud writer.
        if (onInactivityTimeout) {
          await onInactivityTimeout();
        }
        // Avoid firing the same guarded request every poll while a required
        // cloud confirmation is still blocking exit.
        lastLocalActivityRef.current = Date.now();
        return;
      }
    }

    // 2. Query every open owner session. last_seen is diagnostic only; elapsed time never hides or releases a lock because the owner may be offline.
    const { data, error } = await supabase.rpc('get_project_lock_status', {
      p_project_id: null,
      p_session_token: tokenRef.current,
    });

    if (error) {
      console.warn('[SessionLock] poll failed:', error.message);
      return;
    }

    const parsedSessions = (data || []).map(s => ({
      ...s,
      deviceType: s.device_type || 'Gerät',
      username: s.lock_owner || 'Unbekannt',
      created_at: s.locked_at,
      last_seen: s.last_seen_at,
    }));

    // Dashboard locked projects
    const otherIds = new Set(
      parsedSessions
        .filter(s => !s.is_owner && s.open_project_id)
        .map(s => s.open_project_id)
    );
    setLockedProjectIds(otherIds);

    if (!inProject || !myProjectId) {
      setIsSessionActive(true);
      setIsLockedByIPad(false);
      setActiveLockUser(null);
      setActiveLockSince(null);
      setActiveLockDevice(null);
      return;
    }

    // Concurrency conflict check
    const projectSessions = parsedSessions.filter(s => s.open_project_id === myProjectId);

    // The database unique index + atomic RPC is authoritative.  Absence of an
    // owner is not ownership; a subsequent acquire RPC must confirm it.
    const ownerSession = projectSessions[0] || null;
    const amIOwner = Boolean(ownerSession?.is_owner);
    const winningSession = amIOwner ? null : ownerSession;

    setIsSessionActive(amIOwner);
    setIsLockedByIPad(!amIOwner && ownerSession?.deviceType === 'iPad');

    if (amIOwner) {
      const mySession = parsedSessions.find(s => s.is_owner);
      setActiveLockUser(username);
      setActiveLockSince(mySession?.created_at || new Date().toISOString());
      setActiveLockDevice(myDevice);
      setActiveLockActivity(mySession?.last_seen || new Date().toISOString());
    } else {
      setActiveLockUser(winningSession?.username || 'Unbekannt');
      setActiveLockSince(winningSession?.created_at || winningSession?.last_seen || new Date().toISOString());
      setActiveLockDevice(winningSession?.deviceType || 'Gerät');
      setActiveLockActivity(winningSession?.last_seen || new Date().toISOString());
    }
  }, [supabase, myDevice, username, onInactivityTimeout]);

  // Main lifecycle loop setup
  useEffect(() => {
    return startSessionLockLifecycle({
      enabledRef,
      isSessionActiveRef,
      tokenRef,
      reportIdRef,
      viewRef,
      supabase,
      upsertSession,
      pollSessions,
    });
  }, [enabled, supabase, upsertSession, pollSessions, myDevice]);

  // Trigger immediate lock check when opening project
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void upsertSession();
      void pollSessions();
    });
    return () => { cancelled = true; };
  }, [enabled, view, selectedReportId, resolvedMode, upsertSession, pollSessions]);

  // Force Lock Takeover
  const takeOverLock = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      if (!supabase || !reportIdRef.current) return;

      // A takeover is still arbitrated by the atomic RPC. Desktop clients can
      // never delete an owner's lease; iPad priority is enforced server-side.
      await upsertSession();
    } catch (e) {
      console.error(e);
    }
  }, [supabase, upsertSession]);

  return {
    lockedProjectIds,
    isSessionActive,
    setIsSessionActive,
    takeOverLock,
    isLockedByIPad,
    activeLockUser,
    activeLockSince,
    activeLockDevice,
    activeLockActivity,
    registerProjectActivity,
    releaseProjectLock: deleteSession
  };
}
