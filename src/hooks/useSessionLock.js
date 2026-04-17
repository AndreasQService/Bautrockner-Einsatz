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

const HEARTBEAT_INTERVAL = 20_000;  // alle 20s heartbeat senden
const POLL_INTERVAL      =  5_000;  // alle 5s Poll
const SESSION_TIMEOUT    = 60_000;  // Session gilt als tot nach 60s

export function useSessionLock(supabase, sessionToken, selectedReportId, view, resolvedMode, sessionStartedAt) {
  const [lockedProjectIds, setLockedProjectIds]   = useState(new Set());
  const [isSessionActive,  setIsSessionActive]    = useState(true);

  const tokenRef      = useRef(sessionToken);
  const reportIdRef   = useRef(selectedReportId);
  const modeRef       = useRef(resolvedMode);
  const viewRef       = useRef(view);

  // Refs synchron halten
  useEffect(() => { tokenRef.current    = sessionToken;    }, [sessionToken]);
  useEffect(() => { reportIdRef.current = selectedReportId; }, [selectedReportId]);
  useEffect(() => { modeRef.current     = resolvedMode;    }, [resolvedMode]);
  useEffect(() => { viewRef.current     = view;            }, [view]);

  // ── Eigene Session upserten ────────────────────────────────────────────
  const upsertSession = useCallback(async () => {
    if (!supabase) return;
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
    const myMode      = modeRef.current;
    const myView      = viewRef.current;

    // ── Dashboard-Lock: Projekte die andere Tabs offen haben ──────────
    const otherIds = new Set(
      (data || [])
        .filter(s => s.session_token !== myToken && s.open_project_id)
        .map(s => s.open_project_id)
    );
    setLockedProjectIds(otherIds);

    // ── Modus-Konflikt: selbes Projekt, anderer Modus ─────────────────
    const inProject = myView === 'details' || myView === 'new-report';
    if (!inProject || !myProjectId) {
      setIsSessionActive(true);
      return;
    }

    const mySessionData = (data || []).find(s => s.session_token === myToken);
    const conflicting = (data || []).filter(
      s => s.session_token !== myToken &&
           s.open_project_id === myProjectId &&
           s.mode !== myMode
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
    const myStarted = sessionStartedAt;
    const earliest = conflicting.reduce((min, s) => {
      return (new Date(s.last_seen) < new Date(min.last_seen)) ? s : min;
    }, conflicting[0]);

    // Vergleich: Wer ist länger aktiv?
    // Falls meine Session älter als der früheste Konflikt → ich bin Owner
    const mySessionStart = mySessionData?.last_seen ?? new Date().toISOString();
    // Wir verwenden sessionStartedAt (ms seit Epoch) das wir mitgespeichert haben
    // Da wir es noch nicht speichern, nutzen wir Token-Vergleich als deterministischen Tiebreaker
    const amIOwner = myToken < earliest.session_token; // lexikografisch deterministisch

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
    await supabase
      .from('project_sessions')
      .delete()
      .eq('session_token', tokenRef.current);
    console.log('[SessionLock] 🗑️ Session gelöscht');
  }, [supabase]);

  // ── Alte (inaktive) Sessions bereinigen ───────────────────────────────
  const cleanupOldSessions = useCallback(async () => {
    if (!supabase) return;
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT).toISOString();
    await supabase
      .from('project_sessions')
      .delete()
      .lt('last_seen', cutoff);
  }, [supabase]);

  // ── Heartbeat + Poll Loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    // Sofort beim Start
    upsertSession();
    pollSessions();

    const heartbeatTimer = setInterval(upsertSession, HEARTBEAT_INTERVAL);
    const pollTimer      = setInterval(pollSessions,  POLL_INTERVAL);
    // Cleanup alter Sessions alle 5 Minuten
    const cleanupTimer   = setInterval(cleanupOldSessions, 5 * 60_000);

    // Tab-Schließen: Session sofort entfernen
    const handleUnload = () => {
      // Synchrones Fetch (navigator.sendBeacon geht nicht für DELETE)
      // Wir nutzen fetch mit keepalive
      const url = `${supabase.supabaseUrl}/rest/v1/project_sessions?session_token=eq.${encodeURIComponent(tokenRef.current)}`;
      fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${supabase.supabaseKey}`,
        },
        keepalive: true,
      });
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
      clearInterval(cleanupTimer);
      window.removeEventListener('beforeunload', handleUnload);
      deleteSession();
    };
  }, [supabase, upsertSession, pollSessions, cleanupOldSessions, deleteSession]);

  // ── Sofortiger Upsert wenn sich Projekt/Modus ändert ─────────────────
  useEffect(() => {
    upsertSession();
    pollSessions();
  }, [view, selectedReportId, resolvedMode, upsertSession, pollSessions]);

  return { lockedProjectIds, isSessionActive, setIsSessionActive };
}
