import React from 'react';
import { AlertTriangle, CheckCircle2, Cloud, HardDrive, Loader2, LogOut, WifiOff } from 'lucide-react';
import { buildProjectSessionStatusModel } from '../lib/offline/projectSessionStatusModel.js';

const badgeStyle = (ok) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.7rem',
  borderRadius: 999, fontSize: '0.82rem', fontWeight: 800,
  color: ok ? '#14532d' : '#92400e',
  background: ok ? '#dcfce7' : '#fef3c7',
  border: `1px solid ${ok ? '#86efac' : '#fcd34d'}`,
});

export default function ProjectSessionSyncPanel({
  localConfirmed,
  localMaterializationVerified,
  counts,
  readiness,
  syncing = false,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
  onSyncAndExit,
}) {
  const model = buildProjectSessionStatusModel({
    localConfirmed, localMaterializationVerified, counts, readiness, syncing, online,
  });

  return (
    <section aria-label="Projekt-Synchronisationsstatus" style={{
      padding: '1rem', borderRadius: 10, border: '1px solid #334155',
      background: '#0f172a', color: '#e2e8f0', display: 'grid', gap: '0.8rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: 800 }}>
        {model.localAvailable
          ? <CheckCircle2 size={20} color="#22c55e" />
          : <HardDrive size={20} color="#f59e0b" />}
        <span>{model.localAvailable ? 'Projekt offline verfügbar' : 'Projekt wird lokal vollständig vorbereitet'}</span>
      </div>

      {model.counts.length > 0 && (
        <div aria-label="Lokaler Projektumfang" style={{ fontSize: '0.86rem', color: '#cbd5e1' }}>
          {model.counts.join(' · ')}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
        <span style={badgeStyle(model.supabaseOk)}>
          <Cloud size={15} /> {model.supabaseOk ? 'Supabase OK' : 'Supabase ausstehend'}
        </span>
        <span style={badgeStyle(model.oneDriveOk)}>
          <Cloud size={15} /> {model.oneDriveOk ? 'OneDrive OK' : 'OneDrive ausstehend'}
        </span>
      </div>

      {!model.online && (
        <div role="status" style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', color: '#fbbf24' }}>
          <WifiOff size={17} /> Offline – alle Änderungen bleiben lokal gesichert.
        </div>
      )}

      {!model.fullyConfirmed && model.blockers.length > 0 && (
        <div role="alert" style={{ color: '#fbbf24', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontWeight: 800 }}>
            <AlertTriangle size={16} /> Projekt kann noch nicht verlassen werden
          </div>
          <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
            {model.blockers.map((blocker) => <li key={blocker.code}>{blocker.label}</li>)}
          </ul>
        </div>
      )}

      {model.fullyConfirmed && (
        <div role="status" style={{ color: '#86efac', fontWeight: 800 }}>
          Vollständig synchronisiert und zurückgelesen. Projekt kann sicher verlassen werden.
        </div>
      )}

      <button
        type="button"
        onClick={onSyncAndExit}
        disabled={!model.canStartSync && !model.canExit}
        aria-disabled={!model.canStartSync && !model.canExit}
        style={{
          justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.65rem 0.9rem', border: 0, borderRadius: 7, fontWeight: 800,
          cursor: model.canStartSync || model.canExit ? 'pointer' : 'not-allowed',
          background: model.fullyConfirmed ? '#16a34a' : '#2563eb', color: '#fff',
          opacity: model.canStartSync || model.canExit ? 1 : 0.55,
        }}
      >
        {model.syncing ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
        {model.syncing ? 'Synchronisierung und Prüfung läuft …' : 'Synchronisieren und Projekt verlassen'}
      </button>
    </section>
  );
}
