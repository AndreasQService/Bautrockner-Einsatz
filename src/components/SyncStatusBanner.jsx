import React from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, HardDrive, ShieldAlert, WifiOff } from 'lucide-react';

export default function SyncStatusBanner({
  status, // 'local_saved' | 'syncing' | 'db_confirmed' | 'db_unconfirmed' | 'critical_error' | 'version_conflict'
  message,
  onRetrySave,
  onSyncLater,
  onRetryLocalAndDb,
  hasUnsyncedDraft = false
}) {
  if (!status && !hasUnsyncedDraft) return null;

  return (
    <div style={{ width: '100%', marginBottom: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. LOKAL GESICHERT */}
      {status === 'local_saved' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 1rem', borderRadius: '6px',
          backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
          fontSize: '0.9rem', fontWeight: 600
        }}>
          <HardDrive size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span>Lokal gesichert – noch nicht an Datenbank übertragen</span>
        </div>
      )}

      {/* 2. SYNCHRONISIERUNG LÄUFT */}
      {status === 'syncing' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 1rem', borderRadius: '6px',
          backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
          fontSize: '0.9rem', fontWeight: 600
        }}>
          <RefreshCw size={18} className="animate-spin" style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>Synchronisierung läuft...</span>
        </div>
      )}

      {/* 3. MESSRESULTATE SICHER IN DER DATENBANK GESPEICHERT */}
      {status === 'db_confirmed' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 1rem', borderRadius: '6px',
          backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#14532d',
          fontSize: '0.9rem', fontWeight: 700
        }}>
          <CheckCircle size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>Messresultate sicher in der Datenbank gespeichert.</span>
        </div>
      )}

      {/* 4. DATENBANKSPEICHERUNG NICHT BESTÄTIGT (NON-DISMISSIBLE BANNER) */}
      {status === 'db_unconfirmed' && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          padding: '1rem 1.25rem', borderRadius: '8px',
          backgroundColor: '#fffbeb', border: '2px solid #f59e0b', color: '#92400e',
          fontSize: '0.95rem', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
            <WifiOff size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#78350f' }}>
                Speicherung in der Datenbank nicht bestätigt. Ihre Messresultate bleiben auf diesem Gerät lokal gesichert.
              </div>
              {message && <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', opacity: 0.9 }}>{message}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={onRetrySave}
              style={{
                padding: '0.5rem 1rem', borderRadius: '6px', border: 'none',
                backgroundColor: '#d97706', color: '#ffffff', fontWeight: 700,
                fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <RefreshCw size={14} /> Erneut speichern
            </button>
            <button
              type="button"
              onClick={onSyncLater}
              style={{
                padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d97706',
                backgroundColor: 'transparent', color: '#92400e', fontWeight: 600,
                fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              Später synchronisieren
            </button>
          </div>
        </div>
      )}

      {/* 5. KRITISCHER FEHLER (WEDER DATENBANK NOCH LOKALE SICHERUNG BESTÄTIGT) */}
      {status === 'critical_error' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '1rem'
        }}>
          <div style={{
            maxWidth: '550px', width: '100%', borderRadius: '12px',
            backgroundColor: '#fef2f2', border: '3px solid #ef4444',
            padding: '1.5rem', color: '#991b1b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <ShieldAlert size={32} style={{ color: '#dc2626', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#7f1d1d' }}>
                ACHTUNG: Die Messresultate konnten weder in der Datenbank noch lokal sicher gespeichert werden. Diese Seite nicht schließen oder neu laden.
              </h3>
            </div>

            <p style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.25rem 0', fontWeight: 600, color: '#991b1b' }}>
              Fotografieren oder notieren Sie die Messresultate und versuchen Sie die Speicherung erneut.
            </p>

            {message && (
              <div style={{
                padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: '6px',
                fontSize: '0.85rem', fontFamily: 'monospace', margin: '0 0 1.25rem 0', wordBreak: 'break-all'
              }}>
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={onRetryLocalAndDb}
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: 'none',
                backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 800,
                fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              <RefreshCw size={18} /> Speicherung erneut versuchen
            </button>
          </div>
        </div>
      )}

      {/* 6. PERMANENT UNSYNCED BADGE */}
      {hasUnsyncedDraft && status !== 'db_unconfirmed' && status !== 'critical_error' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.75rem', borderRadius: '6px',
          backgroundColor: '#fef3c7', border: '1px solid #fde047', color: '#92400e',
          fontSize: '0.8rem', fontWeight: 700, marginTop: '0.5rem'
        }}>
          <AlertTriangle size={14} style={{ color: '#d97706' }} />
          <span>Messresultate noch nicht synchronisiert – lokal auf diesem Gerät gesichert.</span>
        </div>
      )}

    </div>
  );
}
