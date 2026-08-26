import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { getProjectPhotoCandidates, getProjectSyncSummary, reportCategoryMatches } from '../lib/projectSyncSummary.js';
import { verifyProjectSupabaseSync } from '../lib/verifyProjectSupabaseSync.js';
import { verifyProjectOneDriveSync } from '../lib/verifyProjectOneDriveSync.js';

const EMPTY_EVIDENCE = { verifiedPhotoKeys: [], verifiedDeviceKeys: [], textVerified: false, protocolsVerified: false };
const emptyTarget = () => ({ phase: 'loading', evidence: EMPTY_EVIDENCE, error: null, verifiedAt: null, report: null });
const VERIFY_TIMEOUT_MS = 12_000;

const withTimeout = (promise, provider) => new Promise((resolve, reject) => {
  const timeoutId = setTimeout(
    () => reject(new Error(`${provider}-Prüfung hat das Zeitlimit überschritten.`)),
    VERIFY_TIMEOUT_MS
  );
  Promise.resolve(promise).then(
    value => { clearTimeout(timeoutId); resolve(value); },
    error => { clearTimeout(timeoutId); reject(error); }
  );
});

export default function ProjectSyncControlBox({ report, supabase, offline = false, localSaveConfirmed = false, onEvidenceChange }) {
  const [targets, setTargets] = useState({ supabase: emptyTarget(), oneDrive: emptyTarget() });
  const generationRef = useRef(0);
  const reportRef = useRef(report);
  reportRef.current = report;
  const cloudLocatorSignature = useMemo(() => JSON.stringify({
    projectId: report?.id || null,
    photos: getProjectPhotoCandidates(report).map(photo => [
      photo?.id || null,
      photo?.recoveryKey || null,
      photo?.contentHash || null,
      photo?.supabasePath || photo?.storagePath || null,
      photo?.oneDriveItemId || null,
      photo?.oneDrivePath || null,
      photo?.oneDriveSyncedAt || null
    ]),
    devices: (Array.isArray(report?.equipment) ? report.equipment : (report?.devices || []))
      .map(device => [device?.id || null, device?.dbId || null, device?.rentalDbId || null])
  }), [report]);
  // Preserve verified photo keys across harmless form renders. For structured
  // categories, invalidate only the category that actually changed.
  const currentEvidence = name => {
    const target = targets[name];
    if (!target.report) return EMPTY_EVIDENCE;
    const matches = reportCategoryMatches(report, target.report);
    return {
      ...target.evidence,
      verifiedDeviceKeys: matches.devices ? (target.evidence.verifiedDeviceKeys || []) : [],
      textVerified: target.evidence.textVerified === true && matches.text,
      protocolsVerified: target.evidence.protocolsVerified === true && matches.protocols
    };
  };
  const summaries = useMemo(() => ({
    supabase: getProjectSyncSummary(report, currentEvidence('supabase')),
    oneDrive: getProjectSyncSummary(report, currentEvidence('oneDrive'))
  }), [report, targets]);

  useEffect(() => {
    let disposed = false;
    let intervalId;
    const followUpIds = [];
    let verificationInFlight = false;
    const generation = ++generationRef.current;
    const updateTarget = (name, value) => {
      if (!disposed && generation === generationRef.current) setTargets(previous => ({ ...previous, [name]: value }));
    };
    const verify = async ({ clearEvidence = false } = {}) => {
      if (disposed || generation !== generationRef.current) return;
      if (verificationInFlight) return;
      const currentReport = reportRef.current;
      // The cloud evidence is meaningful only for a saved snapshot. Keep the
      // previous evidence while autosave is pending and verify immediately after it succeeds.
      if (!localSaveConfirmed) return;
      if (clearEvidence) setTargets({ supabase: emptyTarget(), oneDrive: emptyTarget() });
      if (offline || !currentReport?.id) {
        const reason = offline ? 'Offline – keine Cloud-Prüfung möglich' : 'Projekt noch nicht in der Cloud bestätigt';
        setTargets({
          supabase: { phase: 'error', evidence: EMPTY_EVIDENCE, error: reason, verifiedAt: null, report: currentReport },
          oneDrive: { phase: 'error', evidence: EMPTY_EVIDENCE, error: reason, verifiedAt: null, report: currentReport }
        });
        return;
      }
      verificationInFlight = true;
      const checks = [
        ['supabase', 'Supabase', () => verifyProjectSupabaseSync({ supabase, report: currentReport })],
        ['oneDrive', 'OneDrive', () => verifyProjectOneDriveSync({ report: currentReport })]
      ];
      // Publish each provider as soon as its own readback finishes. A stalled
      // Graph request must never hold a successful Supabase result hostage.
      await Promise.allSettled(checks.map(async ([name, label, start]) => {
        try {
          const evidence = await withTimeout(start(), label);
          updateTarget(name, { phase: 'ready', evidence, error: null, verifiedAt: evidence.verifiedAt, report: currentReport });
        } catch (error) {
          if (!disposed && generation === generationRef.current) {
            setTargets(previous => ({
              ...previous,
              [name]: {
                ...previous[name],
                phase: 'error',
                error: error?.message || `${label}-Prüfung fehlgeschlagen`
              }
            }));
          }
        }
      }));
      verificationInFlight = false;
    };

    const timeoutId = setTimeout(() => {
      // OneDrive JSON is uploaded after the Supabase transaction. Recheck twice
      // shortly afterwards so the fresh project data is recognized promptly,
      // while the in-flight guard prevents Graph request overlap.
      verify({ clearEvidence: false });
      followUpIds.push(setTimeout(() => verify({ clearEvidence: false }), 2000));
      followUpIds.push(setTimeout(() => verify({ clearEvidence: false }), 6000));
      intervalId = setInterval(verify, 60000);
    }, 0);
    return () => {
      disposed = true;
      clearTimeout(timeoutId);
      followUpIds.forEach(clearTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [report?.id, cloudLocatorSignature, supabase, offline, localSaveConfirmed]);

  useEffect(() => {
    if (typeof onEvidenceChange !== 'function') return;
    const supabaseEvidence = currentEvidence('supabase');
    const oneDriveEvidence = currentEvidence('oneDrive');
    onEvidenceChange({
      supabaseReady: targets.supabase.phase === 'ready',
      oneDriveReady: targets.oneDrive.phase === 'ready',
      cloudsComplete:
        targets.supabase.phase === 'ready' && summaries.supabase.complete &&
        targets.oneDrive.phase === 'ready' && summaries.oneDrive.complete,
      supabase: targets.supabase.phase === 'ready' ? supabaseEvidence : EMPTY_EVIDENCE,
      oneDrive: targets.oneDrive.phase === 'ready' ? oneDriveEvidence : EMPTY_EVIDENCE
    });
  }, [targets, summaries, onEvidenceChange]);

  const targetComplete = name => targets[name].phase === 'ready' && summaries[name].complete;
  const cloudsComplete = targetComplete('supabase') && targetComplete('oneDrive');
  const green = localSaveConfirmed && cloudsComplete;
  const statusColor = green ? '#10B981' : '#EF4444';
  const loading = localSaveConfirmed && (targets.supabase.phase === 'loading' || targets.oneDrive.phase === 'loading');
  const photoFailures = ['supabase', 'oneDrive'].flatMap(provider => (
    targets[provider].phase === 'ready'
      ? (targets[provider].evidence?.photoResults || []).filter(result => !result.verified).map(result => ({ provider, ...result }))
      : []
  ));

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
          {green
            ? 'Alle Daten gespeichert und in beiden Clouds bestätigt'
            : (loading
                ? 'Clouds werden geprüft …'
                : (!localSaveConfirmed
                    ? 'Cloud-Prüfung wartet auf Speicherung des aktuellen Stands'
                    : 'Synchronisation ausstehend'))}
        </div>
        {localSaveConfirmed && <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          {summaries.supabase.rows.map((row, index) => {
            const oneDriveRow = summaries.oneDrive.rows[index];
            // Category evidence remains valid across a provider timeout when that
            // exact category did not change. Changed categories are invalidated by currentEvidence().
            const supabaseGreen = row.complete;
            const oneDriveGreen = oneDriveRow.complete;
            return <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{row.label}:</span>
              <span style={{ color: supabaseGreen ? '#10B981' : '#EF4444' }}>● Supabase {row.synced}/{row.total}</span>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}> · </span>
              <span style={{ color: oneDriveGreen ? '#10B981' : '#EF4444' }}>● OneDrive {oneDriveRow.synced}/{oneDriveRow.total}</span>
            </div>;
          })}
        </div>}
        {localSaveConfirmed && (targets.supabase.error || targets.oneDrive.error) && <div role="alert" style={{ color: '#EF4444', fontSize: '0.68rem' }}>
          {targets.supabase.error && `Supabase: ${targets.supabase.error}`}
          {targets.supabase.error && targets.oneDrive.error && ' · '}
          {targets.oneDrive.error && `OneDrive: ${targets.oneDrive.error}`}
        </div>}
        {localSaveConfirmed && photoFailures.length > 0 && <div role="alert" title={photoFailures.map(item => `${item.provider}: ${item.id || 'ohne ID'} | ${item.storagePath || 'ohne Pfad'} | ${item.reason}`).join('\n')} style={{ color: '#F59E0B', fontSize: '0.68rem', maxWidth: '42vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Fehlend: {photoFailures.slice(0, 3).map(item => `${item.name || item.id || item.storagePath || 'unbekannt'} (${item.provider}: ${item.reason})`).join(' · ')}
          {photoFailures.length > 3 ? ` · +${photoFailures.length - 3}` : ''}
        </div>}
      </div>
    </section>
  );
}
