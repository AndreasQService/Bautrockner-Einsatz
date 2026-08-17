import { useState, useEffect, useRef, useCallback } from 'react';

export function startSessionLifecycle({
  enabledRef,
  isSessionActiveRef,
  reportIdRef,
  viewRef,
  supabase,
  upsertSession,
  eventTarget = window
}) {
  if (!enabledRef?.current) return undefined;

  if (upsertSession) upsertSession();

  const handleUnload = () => {
    console.log('[ProjectSession] Navigation / unload event.');
  };

  eventTarget.addEventListener('beforeunload', handleUnload);

  return () => {
    eventTarget.removeEventListener('beforeunload', handleUnload);
  };
}

export function useProjectSession(
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
  const [lockedProjectIds] = useState(new Set());
  const [isSessionActive, setIsSessionActive] = useState(true);

  const isSessionActiveRef = useRef(true);
  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  const tokenRef = useRef(sessionToken);
  const reportIdRef = useRef(selectedReportId);
  const modeRef = useRef(resolvedMode);
  const viewRef = useRef(view);
  const enabledRef = useRef(enabled);

  useEffect(() => { tokenRef.current = sessionToken; }, [sessionToken]);
  useEffect(() => { reportIdRef.current = selectedReportId; }, [selectedReportId]);
  useEffect(() => { modeRef.current = resolvedMode; }, [resolvedMode]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const upsertSession = useCallback(async () => {
    setIsSessionActive(true);
  }, []);

  const pollSessions = useCallback(async () => {
    setIsSessionActive(true);
  }, []);

  const deleteSession = useCallback(async () => {
    return true;
  }, []);

  const registerProjectActivity = useCallback(() => {
    setIsSessionActive(true);
  }, []);

  const releaseProjectLock = useCallback(async (projectId) => {
    console.log('[ProjectSession] releaseProjectLock called for:', projectId);
    return true;
  }, []);

  const takeOverLock = useCallback(async (projectId) => {
    console.log('[ProjectSession] takeOverLock called for:', projectId);
    return true;
  }, []);

  const acquireProjectLock = useCallback(async (projectId) => {
    console.log('[ProjectSession] acquireProjectLock called for:', projectId);
    return true;
  }, []);

  return {
    isSessionActive,
    setIsSessionActive,
    lockedProjectIds,
    activeLockUser: null,
    activeLockSince: null,
    activeLockDevice: null,
    isLockedByIPad: false,
    activeLockActivity: null,
    upsertSession,
    deleteSession,
    pollSessions,
    registerProjectActivity,
    releaseProjectLock,
    takeOverLock,
    acquireProjectLock,
    isProjectLockedByOther: () => false,
  };
}


