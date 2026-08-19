import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 5000; // poll every 5s
const HEARTBEAT_INTERVAL = 30 * 1000; // keep ownership alive while project stays open
const AUTH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function startSessionLockLifecycle({
  enabledRef,
  isSessionActiveRef,
  tokenRef,
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
    // Keep lock on page reload / tab close. Locks never expire implicitly.
    console.log('[SessionLock] Preserving project lock session on unload.');
  };

  eventTarget.addEventListener('beforeunload', handleUnload);

  return () => {
    clearIntervalFn(pollTimer);
    eventTarget.removeEventListener('beforeunload', handleUnload);

    // Never release from cleanup/unload. The caller releases only after its
    // verified sync/navigation boundary has completed.
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
  onInactivityTimeout = null,
  authenticatedUserId = null
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
  const enabledRef    = useRef(enabled);
  enabledRef.current = isLockEnabled;

  const lastExtendedRef = useRef(0);
  const lastLocalActivityRef = useRef(Date.now());

  // Keep refs synchronized
  useEffect(() => { tokenRef.current    = sessionToken;    }, [sessionToken]);
  useEffect(() => { reportIdRef.current = selectedReportId; }, [selectedReportId]);
  useEffect(() => { modeRef.current     = resolvedMode;    }, [resolvedMode]);
  useEffect(() => { viewRef.current     = view;            }, [view]);

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
    if (!supabase || !AUTH_UUID.test(String(authenticatedUserId || ''))) {
      setIsSessionActive(false);
      return;
    }
    if (!enabledRef.current) return;
    const openProjectId = (viewRef.current === 'details' || viewRef.current === 'new-report')
      ? (reportIdRef.current ?? null)
      : null;

    if (!openProjectId) return;

    // Save device, user ID, username, and email in device string
    const deviceValue = `${myDevice}:${userId}:${username}:${userEmail}`;
    const nowIso = new Date().toISOString();

    // 1. Attempt lock acquire on database via atomic RPC function
    const { data, error } = await supabase.rpc('acquire_project_lock', {
      p_project_id:    openProjectId,
      p_session_token: tokenRef.current,
      p_user_id:       String(authenticatedUserId),
      p_user_name:     username,
      p_device:        deviceValue,
    });

    if (error) {
      console.warn('[SessionLock] Lock acquire RPC failed:', error.message);
      const isNetworkError = !error.status || 
                             error.status === 522 || 
                             error.status === 502 || 
                             error.status === 503 ||
                             error.status === 504 ||
                             String(error.message).toLowerCase().includes('fetch') ||
                             String(error.message).toLowerCase().includes('network') ||
                             String(error.message).toLowerCase().includes('timeout') ||
                             String(error.message).toLowerCase().includes('connection');
      setIsSessionActive(false);
    } else {
      const result = data && data[0];
      if (result && result.acquired) {
        // Lock confirmed by DB
        setIsSessionActive(true);
        console.log('[SessionLock] LOCK_ACQUIRED / DB confirmed lock.', { openProjectId });
      } else {
        setIsSessionActive(false);
        console.log('[SessionLock] LOCK_DENIED / project locked by another session.', result);
      }
    }
  }, [supabase, myDevice, userId, username, userEmail, authenticatedUserId]);

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

  // Activity listeners for window click, keydown, change, and input events
  useEffect(() => {
    if (!enabled || !supabase) return;

    const handleActivity = () => {
      registerProjectActivity();
    };

    window.addEventListener('click', handleActivity, { capture: true });
    window.addEventListener('keydown', handleActivity, { capture: true });
    window.addEventListener('change', handleActivity, { capture: true });
    window.addEventListener('input', handleActivity, { capture: true });

    return () => {
      window.removeEventListener('click', handleActivity, { capture: true });
      window.removeEventListener('keydown', handleActivity, { capture: true });
      window.removeEventListener('change', handleActivity, { capture: true });
      window.removeEventListener('input', handleActivity, { capture: true });
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
  const deleteSession = useCallback(async () => {
    if (!supabase || !reportIdRef.current) return false;
    const { data, error } = await supabase.rpc('release_project_lock', {
      p_project_id: reportIdRef.current,
      p_session_token: tokenRef.current,
    });
    if (error || data !== true) {
      setIsSessionActive(false);
      console.warn('[SessionLock] LOCK_RELEASE_FAILED', error?.message || data);
      return false;
    }
    setIsSessionActive(false);
    console.log('[SessionLock] LOCK_RELEASED');
    return true;
  }, [supabase]);

  // ── Andere Sessions abfragen und Locks berechnen ──────────────────────
  const pollSessions = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;

    const myToken     = tokenRef.current;
    const myProjectId = reportIdRef.current;
    const myView      = viewRef.current;
    const inProject   = myView === 'details' || myView === 'new-report';

    if (!inProject || !myProjectId) {
      setLockedProjectIds(new Set());
      setIsLockedByIPad(false);
      setActiveLockUser(null);
      setActiveLockSince(null);
      setActiveLockDevice(null);
      return;
    }

    // 2. Read redacted lock status only through the authenticated RPC.
    const { data, error } = await supabase.rpc('get_project_lock_status', {
      p_project_id: myProjectId,
      p_session_token: myToken,
    });

    if (error) {
      console.warn('[SessionLock] poll failed:', error.message);
      setIsSessionActive(false);
      return;
    }
    const status = Array.isArray(data) ? data[0] : data;
    const amIOwner = status?.is_owner === true;

    setIsSessionActive(amIOwner);
    setIsLockedByIPad(!amIOwner && status?.device_type === 'iPad');

    if (amIOwner) {
      setActiveLockUser(username);
      setActiveLockSince(status?.locked_at || new Date().toISOString());
      setActiveLockDevice(myDevice);
      setActiveLockActivity(status?.last_seen_at || new Date().toISOString());
    } else {
      setActiveLockUser(status?.lock_owner || 'Unbekannt');
      setActiveLockSince(status?.locked_at || null);
      setActiveLockDevice(status?.device_type || 'Gerät');
      setActiveLockActivity(status?.last_seen_at || null);
    }
  }, [supabase, myDevice, username, onInactivityTimeout, deleteSession]);

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
  }, [enabled, supabase, upsertSession, pollSessions, deleteSession, myDevice]);

  // Trigger immediate lock check when opening project
  useEffect(() => {
    if (!enabled) return;
    upsertSession();
    pollSessions();
  }, [enabled, view, selectedReportId, resolvedMode, upsertSession, pollSessions]);

  return {
    lockedProjectIds,
    isSessionActive,
    setIsSessionActive,
    isLockedByIPad,
    activeLockUser,
    activeLockSince,
    activeLockDevice,
    activeLockActivity,
    registerProjectActivity,
    releaseProjectLock: deleteSession
  };
}
