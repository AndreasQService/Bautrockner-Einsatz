import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { getProjectSyncSummary } from '../lib/projectSyncSummary.js';
import { verifyProjectSupabaseSync } from '../lib/verifyProjectSupabaseSync.js';
import { verifyProjectOneDriveSync } from '../lib/verifyProjectOneDriveSync.js';

const EMPTY_EVIDENCE = { verifiedPhotoKeys: [], verifiedDeviceKeys: [], textVerified: false, protocolsVerified: false };
const emptyTarget = () => ({ phase: 'loading', evidence: EMPTY_EVIDENCE, error: null, verifiedAt: null });

export default function ProjectSyncControlBox({ report, supabase, offline = false, onEvidenceChange }) {
  const [targets, setTargets] = useState({ supabase: emptyTarget(), oneDrive: emptyTarget() });
  const generationRef = useRef(0);
  const summaries = useMemo(() => ({
    supabase: getProjectSyncSummary(report, targets.supabase.evidence),
    oneDrive: getProjectSyncSummary(report, targets.oneDrive.evidence)
  }), [report, targets]);

  useEffect(() => {
    let disposed = false;
    let intervalId;
    const generation = ++generationRef.current;
    const updateTarget = (name, value) => {
      if (!disposed && generation === generationRef.current) setTargets(previous => ({ ...previous, [name]: value }));
    };
    const verify = async ({ clearEvidence = false } = {}) => {
      if (disposed || generation !== generationRef.current) return;
      if (clearEvidence) setTargets({ supabase: emptyTarget(), oneDrive: emptyTarget() });
      if (offline || !report?.id) {
        const reason = offline ? 'Offline – keine Cloud-Prüfung möglich' : 'Projekt noch nicht in der Cloud bestätigt';
        setTargets({
          supabase: { phase: 'error', evidence: EMPTY_EVIDENCE, error: reason, verifiedAt: null },
          oneDrive: { phase: 'error', evidence: EMPTY_EVIDENCE, error: reason, verifiedAt: null }
        });
        return;
      }
      const checks = [
        ['supabase', verifyProjectSupabaseSync({ supabase, report })],
        ['oneDrive', verifyProjectOneDriveSync({ report })]
      ];
      const results = await Promise.allSettled(checks.map(([, promise]) => promise));
      results.forEach((result, index) => {
        const name = checks[index][0];
        if (result.status === 'fulfilled') updateTarget(name, { phase: 'ready', evidence: result.value, error: null, verifiedAt: result.value.verifiedAt });
        else updateTarget(name, { phase: 'error', evidence: EMPTY_EVIDENCE, error: result.reason?.message || `${name}-Prüfung fehlgeschlagen`, verifiedAt: null });
      });
    };

    setTargets({ supabase: emptyTarget(), oneDrive: emptyTarget() });
    const timeoutId = setTimeout(() => {
      verify({ clearEvidence: false });
      intervalId = setInterval(verify, 15000);
    }, 350);
    return () => {
      disposed = true;
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [report, supabase, offline]);

  useEffect(() => {
    if (typeof onEvidenceChange !== 'function') return;
    onEvidenceChange({
      supabaseReady: targets.supabase.phase === 'ready',
      oneDriveReady: targets.oneDrive.phase === 'ready',
      supabase: targets.supabase.phase === 'ready' ? targets.supabase.evidence : EMPTY_EVIDENCE,
      oneDrive: targets.oneDrive.phase === 'ready' ? targets.oneDrive.evidence : EMPTY_EVIDENCE
    });
  }, [targets, onEvidenceChange]);

  const targetComplete = name => targets[name].phase === 'ready' && summaries[name].complete;
  const green = targetComplete('supabase') && targetComplete('oneDrive');
  const statusColor = green ? '#10B981' : '#EF4444';
  const loading = targets.supabase.phase === 'loading' || targets.oneDrive.phase === 'loading';

  return (
    <section aria-label="Supabase Synchronisationskontrolle und OneDrive Synchronisationskontrolle" aria-live="polite" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 101,
      minHeight: '38px', background: 'var(--surface)',
      borderTop: `1px solid ${statusColor}`, padding: '0.35rem 0.75rem',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.22)', boxSizing: 'border-box',
      overflowX: 'auto', overflowY: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', minWidth: 'max-content', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: statusColor, fontWeight: 700, fontSize: '0.72rem' }}>
          {loading ? <RefreshCw size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
          {green ? 'Alle Daten in beiden Clouds bestätigt' : (loading ? 'Clouds werden geprüft …' : 'Synchronisation ausstehend')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          {summaries.supabase.rows.map((row, index) => {
            const oneDriveRow = summaries.oneDrive.rows[index];
            const supabaseGreen = targets.supabase.phase === 'ready' && row.complete;
            const oneDriveGreen = targets.oneDrive.phase === 'ready' && oneDriveRow.complete;
            return <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{row.label}:</span>
              <span style={{ color: supabaseGreen ? '#10B981' : '#EF4444' }}>● Supabase {row.synced}/{row.total}</span>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}> · </span>
              <span style={{ color: oneDriveGreen ? '#10B981' : '#EF4444' }}>● OneDrive {oneDriveRow.synced}/{oneDriveRow.total}</span>
            </div>;
          })}
        </div>
        {(targets.supabase.error || targets.oneDrive.error) && <div role="alert" style={{ color: '#EF4444', fontSize: '0.68rem' }}>
          {targets.supabase.error && `Supabase: ${targets.supabase.error}`}
          {targets.supabase.error && targets.oneDrive.error && ' · '}
          {targets.oneDrive.error && `OneDrive: ${targets.oneDrive.error}`}
        </div>}
      </div>
    </section>
  );
}
