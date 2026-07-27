/**
 * useSessionLock – REST-basiertes Session-Locking
 *
 * Kein WebSocket, kein BroadcastChannel.
 * Nur normale HTTPS REST-Calls gegen Supabase.
 *
 * Verhalten:
 * - Jeder Tab upserted seinen Status alle HEARTBEAT_INTERVAL ms
 * - Jeder Tab pollt alle POLL_INTERVAL ms welche Projekte gesperrt sind
 * - Sessions die älter als SESSION_TIMEOUT ms sind gelten als inaktiv
 * - Beim Tab-Schließen wird die Session sofort gelöscht (beforeunload)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const HEARTBEAT_INTERVAL = 10_000;  // alle 10s heartbeat senden
const POLL_INTERVAL      =  5_000;  // alle 5s Poll
const SESSION_TIMEOUT    = 25_000;  // Session gilt als tot nach 25s

export function startSessionLockLifecycle({
  enabledRef,
  tokenRef,
  supabase,
  upsertSession,
  pollSessions,
  cleanupOldSessions,
  deleteSession,
  eventTarget = window,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  fetchFn = fetch,
}) {
  if (!enabledRef.current || !supabase) return undefined;

  upsertSession();
  pollSessions();

  const heartbeatTimer = setIntervalFn(() => enabledRef.current && upsertSession(), HEARTBEAT_INTERVAL);
  const pollTimer = setIntervalFn(() => enabledRef.current && pollSessions(), POLL_INTERVAL);
  const cleanupTimer = setIntervalFn(() => enabledRef.current && cleanupOldSessions(), 5 * 60_000);

  const handleUnload = () => {
    if (!enabledRef.current) return;
    const url = `${supabase.supabaseUrl}/rest/v1/project_sessions?session_token=eq.${encodeURIComponent(tokenRef.current)}`;
    fetchFn(url, {
      method: 'DELETE',
      headers: {
        apikey: supabase.supabaseKey,
        Authorization: `Bearer ${supabase.supabaseKey}`,
      },
      keepalive: true,
    });
  };

  eventTarget.addEventListener('beforeunload', handleUnload);

  return () => {
    clearIntervalFn(heartbeatTimer);
    clearIntervalFn(pollTimer);
    clearIntervalFn(cleanupTimer);
    eventTarget.removeEventListener('beforeunload', handleUnload);
    if (enabledRef.current) deleteSession();
  };
}

export function useSessionLock(supabase, sessionToken, selectedReportId, view, resolvedMode, sessionStartedAt, enabled = true) {
  const [lockedProjectIds, setLockedProjectIds]   = useState(new Set());
  const [isSessionActive,  setIsSessionActive]    = useState(true);

  const tokenRef      = useRef(sessionToken);
  const reportIdRef   = useRef(selectedReportId);
  const modeRef       = useRef(resolvedMode);
  const viewRef       = useRef(view);
  const enabledRef    = useRef(enabled);
  // eslint-disable-next-line react-hooks/refs -- synchronous gate blocks callbacks during the disabling commit
  enabledRef.current = enabled;

  // Refs synchron halten
  useEffect(() => { tokenRef.current    = sessionToken;    }, [sessionToken]);
  useEffect(() => { reportIdRef.current = selectedReportId; }, [selectedReportId]);
  useEffect(() => { modeRef.current     = resolvedMode;    }, [resolvedMode]);
  useEffect(() => { viewRef.current     = view;            }, [view]);

  // ── Eigene Session upserten ────────────────────────────────────────────
  const upsertSession = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;
    const openProjectId = (viewRef.current === 'details' || viewRef.current === 'new-report')
      ? (reportIdRef.current ?? null)
      : null;

    const { error } = await supabase
      .from('project_sessions')
      .upsert({
        session_token:    tokenRef.current,
        open_project_id:  openProjectId,
        mode:             modeRef.current,
        device:           /iPad|iPhone|Android/i.test(navigator.userAgent) ? 'Mobil' : 'Desktop',
        last_seen:        new Date().toISOString(),
      }, { onConflict: 'session_token' });

    if (error) {
      console.warn('[SessionLock] upsert fehlgeschlagen:', error.message);
    } else {
      console.log('[SessionLock] ✅ heartbeat', { openProjectId, mode: modeRef.current });
    }
  }, [supabase]);

  // ── Andere Sessions abfragen und Locks berechnen ──────────────────────
  const pollSessions = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;

    // Timeout-Grenze: Sessions älter als SESSION_TIMEOUT gelten als inaktiv
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT).toISOString();

    const { data, error } = await supabase
      .from('project_sessions')
      .select('session_token, open_project_id, mode, last_seen')
      .gte('last_seen', cutoff);

    if (error) {
      console.warn('[SessionLock] poll fehlgeschlagen:', error.message);
      return;
    }

    const myToken     = tokenRef.current;
    const myProjectId = reportIdRef.current;
    const myView      = viewRef.current;

    // ── Dashboard-Lock: Projekte die andere Tabs offen haben ──────────
    const otherIds = new Set(
      (data || [])
        .filter(s => s.session_token !== myToken && s.open_project_id)
        .map(s => s.open_project_id)
    );
    setLockedProjectIds(otherIds);

    // ── Session-Konflikt: selbes Projekt geöffnet ─────────────────────
    const inProject = myView === 'details' || myView === 'new-report';
    if (!inProject || !myProjectId) {
      setIsSessionActive(true);
      return;
    }

    const conflicting = (data || []).filter(
      s => s.session_token !== myToken &&
           s.open_project_id === myProjectId
    );

    if (conflicting.length === 0) {
      setIsSessionActive(true);
      return;
    }

    // First-wins: älteste Session (kleinster last_seen = nicht korrekt, nutze sessionStartedAt)
    // Stattdessen: nutzen wir die created_at des session_token als Proxy über last_seen
    // Einfachste Implementierung: My token alphabetisch vs. conflicting tokens vergleichen
    //   → deterministisch, aber nicht zeitbasiert
    // Besser: session_started_at mitschicken (last_seen enthält nicht die Startzeit)
    const earliest = conflicting.reduce((min, s) => {
      return (new Date(s.last_seen) < new Date(min.last_seen)) ? s : min;
    }, conflicting[0]);

    // Wir verwenden sessionStartedAt (ms seit Epoch) das wir mitgespeichert haben
    // Da wir es noch nicht speichern, nutzen wir Token-Vergleich als deterministischen Tiebreaker
    const isNewSession = Date.now() - sessionStartedAt < 15000;
    const amIOwner = isNewSession || (myToken < earliest.session_token); // lexikografisch deterministisch

    if (amIOwner) {
      console.log('[SessionLock] ✅ Owner (kein Konflikt)');
      setIsSessionActive(true);
    } else {
      console.warn('[SessionLock] 🔒 Gesperrt – anderer Modus hat Vorrang');
      setIsSessionActive(false);
    }
  }, [supabase, sessionStartedAt]);

  // ── Session löschen ───────────────────────────────────────────────────
  const deleteSession = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;
    await supabase
      .from('project_sessions')
      .delete()
      .eq('session_token', tokenRef.current);
    console.log('[SessionLock] 🗑️ Session gelöscht');
  }, [supabase]);

  // ── Alte (inaktive) Sessions bereinigen ───────────────────────────────
  const cleanupOldSessions = useCallback(async () => {
    if (!supabase) return;
    if (!enabledRef.current) return;
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT).toISOString();
    await supabase
      .from('project_sessions')
      .delete()
      .lt('last_seen', cutoff);
  }, [supabase]);

  // Heartbeat + Poll Loop
  useEffect(() => {
    return startSessionLockLifecycle({
      enabledRef,
      tokenRef,
      supabase,
      upsertSession,
      pollSessions,
      cleanupOldSessions,
      deleteSession,
    });
  }, [enabled, supabase, upsertSession, pollSessions, cleanupOldSessions, deleteSession]);
  // ── Sofortiger Upsert wenn sich Projekt/Modus ändert ─────────────────
  useEffect(() => {
    if (!enabled) return;
    upsertSession();
    pollSessions();
  }, [enabled, view, selectedReportId, resolvedMode, upsertSession, pollSessions]);

  // ── Session übernehmen (Force Lock) ──────────────────────────────────
  const takeOverLock = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      if (!supabase) {
        alert("Fehler: Supabase nicht initialisiert");
        return;
      }
      if (!reportIdRef.current) {
        alert("Fehler: Keine Report ID vorhanden");
        return;
      }
      
      // Lösche alle anderen Sessions für dieses Projekt
      const { error: delError } = await supabase
        .from('project_sessions')
        .delete()
        .eq('open_project_id', reportIdRef.current)
        .neq('session_token', tokenRef.current);
        
      if (delError) {
        alert("Fehler beim Löschen der Sperre: " + delError.message);
      }
        
      // Aktualisiere unsere eigene Session sofort
      await upsertSession();
      setIsSessionActive(true);
    } catch (e) {
      alert("Unerwarteter Fehler: " + e.message);
    }
  }, [supabase, upsertSession]);

  return { lockedProjectIds, isSessionActive, setIsSessionActive, takeOverLock };
}
