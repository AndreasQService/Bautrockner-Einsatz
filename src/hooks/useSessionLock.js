import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 5000; // poll every 5s
const HEARTBEAT_INTERVAL = 30 * 1000; // keep ownership alive while project stays open
const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutes

export function startSessionLockLifecycle({
  enabledRef,
  isSessionActiveRef,
  tokenRef,
  reportIdRef,
  viewRef,
  supabase,
  upsertSession,
  pollSessions,
  deleteSession,
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
    // Keep lock on page reload / tab close (will naturally expire in 20 mins)
    console.log('[SessionLock] Preserving project lock session on unload.');
  };

  eventTarget.addEventListener('beforeunload', handleUnload);

  return () => {
    clearIntervalFn(pollTimer);
    eventTarget.removeEventListener('beforeunload', handleUnload);

    // If we left the project page (navigated to dashboard), release the lock immediately
    const inProject = viewRef?.current === 'details' || viewRef?.current === 'new-report';
    const hasProject = reportIdRef?.current;
    if (enabledRef.current && (!inProject || !hasProject)) {
      deleteSession();
    }
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
    if (!supabase) return;
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
      p_user_id:       String(userId),
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
      if (isNetworkError) {
        setIsSessionActive(true);
      } else {
        setIsSessionActive(false);
      }
    } else {
      const result = data && data[0];
      if (result && result.acquired) {
        // Lock confirmed by DB
        setIsSessionActive(true);
        console.log('[SessionLock] LOCK_ACQUIRED / DB confirmed lock.', { openProjectId });
      } else {
        // Lock blocked/denied!
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
    if (!supabase) return;
    await supabase
      .from('project_sessions')
      .delete()
      .eq('session_token', tokenRef.current);
    console.log('[SessionLock] LOCK_RELEASED');
  }, [supabase]);

  // ── Andere Sessions abfragen und Locks berechnen ──────────────────────
  const pollSessions = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;

    const myToken     = tokenRef.current;
    const myProjectId = reportIdRef.current;
    const myView      = viewRef.current;
    const inProject   = myView === 'details' || myView === 'new-report';

    // 1. Check local inactivity timeout first
    if (inProject && isSessionActiveRef.current) {
      const inactiveMs = Date.now() - lastLocalActivityRef.current;
      if (inactiveMs >= SESSION_TIMEOUT) {
        console.warn('[SessionLock] INACTIVITY_TIMEOUT reached!');
        await deleteSession();
        setIsSessionActive(false);
        if (onInactivityTimeout) {
          onInactivityTimeout();
        }
        return;
      }
    }

    // 2. Query other active sessions from database
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT).toISOString();
    const { data, error } = await supabase
      .from('project_sessions')
      .select('session_token, open_project_id, mode, device, last_seen, created_at')
      .gte('last_seen', cutoff);

    if (error) {
      console.warn('[SessionLock] poll failed:', error.message);
      return;
    }

    // Parse device fields
    const parsedSessions = (data || []).map(s => {
      const parts = (s.device || '').split(':');
      return {
        ...s,
        deviceType: parts[0] || 'Desktop',
        userId: parts[1] || 'unknown',
        username: parts[2] || 'Unbekannt',
        userEmail: parts[3] || 'Unbekannt'
      };
    });

    // Dashboard locked projects
    const otherIds = new Set(
      parsedSessions
        .filter(s => s.session_token !== myToken && s.open_project_id)
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

    // Oldest active session gets the lock
    const oldestSession = projectSessions.reduce((min, s) => {
      const timeS = new Date(s.created_at || s.last_seen).getTime();
      const timeMin = new Date(min.created_at || min.last_seen).getTime();
      if (timeS < timeMin) return s;
      if (timeS > timeMin) return min;
      return s.session_token < min.session_token ? s : min;
    }, projectSessions[0]);

    const amIOwner = oldestSession ? (oldestSession.session_token === myToken) : true;
    const winningSession = amIOwner ? null : oldestSession;

    setIsSessionActive(amIOwner);
    setIsLockedByIPad(!amIOwner && oldestSession?.deviceType === 'iPad');

    if (amIOwner) {
      const mySession = parsedSessions.find(s => s.session_token === myToken);
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
      deleteSession: () => {
        try {
          const unsaved = JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
          const hasUnsaved = reportIdRef.current && !!unsaved[reportIdRef.current];
          if (!hasUnsaved) {
            deleteSession();
          } else {
            console.log('[SessionLock] Preserving lock session because of pending offline sync:', reportIdRef.current);
          }
        } catch (e) {
          deleteSession();
        }
      },
    });
  }, [enabled, supabase, upsertSession, pollSessions, deleteSession, myDevice]);

  // Trigger immediate lock check when opening project
  useEffect(() => {
    if (!enabled) return;
    upsertSession();
    pollSessions();
  }, [enabled, view, selectedReportId, resolvedMode, upsertSession, pollSessions]);

  // Force Lock Takeover
  const takeOverLock = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      if (!supabase || !reportIdRef.current) return;

      // Delete conflicting sessions in DB
      await supabase
        .from('project_sessions')
        .delete()
        .eq('open_project_id', reportIdRef.current)
        .neq('session_token', tokenRef.current);

      await upsertSession();
      setIsSessionActive(true);
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
    registerProjectActivity
  };
}
