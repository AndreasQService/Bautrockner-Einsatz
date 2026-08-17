import React from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function ConflictReloadModal({ isOpen, conflictDetails, onKeepLocal, onAcceptServer, onClose }) {
  if (!isOpen || !conflictDetails) return null;

  const { changedFields = [] } = conflictDetails;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#1b2234', color: '#f8fafc',
        borderRadius: '12px', border: '1px solid #334155',
        maxWidth: '520px', width: '100%', padding: '1.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b', marginBottom: '1rem' }}>
          <AlertTriangle size={24} />
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Gleichzeitige Änderung erkannt</h3>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Ein anderer Benutzer hat dieses Projekt in der Zwischenzeit geändert. Bitte wähle, welche Version übernommen werden soll:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
          {changedFields.map(({ field, localVal, serverVal }) => (
            <div key={field} style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
              <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '0.25rem' }}>Feld: {field}</div>
              <div style={{ color: '#ef4444' }}>Meine Version: "{String(localVal)}"</div>
              <div style={{ color: '#10b981' }}>Server-Version: "{String(serverVal)}"</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onKeepLocal}
            style={{
              padding: '0.6rem 1rem', backgroundColor: '#334155', color: '#f8fafc',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
            <CheckCircle2 size={16} /> Meine Änderungen behalten
          </button>
          <button
            onClick={onAcceptServer}
            style={{
              padding: '0.6rem 1rem', backgroundColor: '#2563eb', color: '#ffffff',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
            <RefreshCw size={16} /> Server-Stand laden
          </button>
        </div>
      </div>
    </div>
  );
}
