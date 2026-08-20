import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { getProjectSyncSummary } from '../lib/projectSyncSummary.js';
import { verifyProjectSupabaseSync } from '../lib/verifyProjectSupabaseSync.js';
import { verifyProjectOneDriveSync } from '../lib/verifyProjectOneDriveSync.js';

const EMPTY_EVIDENCE = { verifiedPhotoKeys: [], verifiedDeviceKeys: [], textVerified: false, protocolsVerified: false };
const emptyTarget = () => ({ phase: 'loading', evidence: EMPTY_EVIDENCE, error: null, verifiedAt: null });

export default function ProjectSyncControlBox({ report, supabase, offline = false }) {
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

  const targetComplete = name => targets[name].phase === 'ready' && summaries[name].complete;
  const green = targetComplete('supabase') && targetComplete('oneDrive');
  const statusColor = green ? '#10B981' : '#EF4444';
  const loading = targets.supabase.phase === 'loading' || targets.oneDrive.phase === 'loading';

  return (
    <section aria-label="Supabase Synchronisationskontrolle und OneDrive Synchronisationskontrolle" aria-live="polite" style={{
      position: 'fixed', left: '50%', bottom: '56px', transform: 'translateX(-50%)', zIndex: 99,
      width: 'min(1060px, calc(100% - 24px))', background: 'var(--surface)', border: `1px solid ${statusColor}`,
      borderRadius: '10px', padding: '0.55rem 0.75rem', boxShadow: '0 -3px 14px rgba(0,0,0,0.22)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: statusColor, fontWeight: 700, fontSize: '0.82rem' }}>
          {loading ? <RefreshCw size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor }} />
          {green ? 'Alle Daten in beiden Clouds bestätigt' : (loading ? 'Clouds werden geprüft …' : 'Synchronisation ausstehend')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(185px, 1fr))', gap: '0.45rem', flex: '1 1 780px' }}>
          {summaries.supabase.rows.map((row, index) => {
            const oneDriveRow = summaries.oneDrive.rows[index];
            const supabaseGreen = targets.supabase.phase === 'ready' && row.complete;
            const oneDriveGreen = targets.oneDrive.phase === 'ready' && oneDriveRow.complete;
            return <div key={row.label} style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{row.label}</div>
              <span style={{ color: supabaseGreen ? '#10B981' : '#EF4444' }}>● Supabase {row.synced}/{row.total}</span>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}> · </span>
              <span style={{ color: oneDriveGreen ? '#10B981' : '#EF4444' }}>● OneDrive {oneDriveRow.synced}/{oneDriveRow.total}</span>
            </div>;
          })}
        </div>
      </div>
      {(targets.supabase.error || targets.oneDrive.error) && <div role="alert" style={{ color: '#EF4444', fontSize: '0.7rem', marginTop: '0.3rem' }}>
        {targets.supabase.error && `Supabase: ${targets.supabase.error}`}
        {targets.supabase.error && targets.oneDrive.error && ' · '}
        {targets.oneDrive.error && `OneDrive: ${targets.oneDrive.error}`}
      </div>}
    </section>
  );
}
