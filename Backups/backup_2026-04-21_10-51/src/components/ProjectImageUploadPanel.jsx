/**
 * ProjectImageUploadPanel.jsx
 * Durable Bild-Upload-Panel für ein Projekt
 *
 * Regeln:
 *   • Kein direkter Upload im UI-Component
 *   • Files → addFiles() → IndexedDB → Worker → OneDrive
 *   • Status wird aus DB gelesen, nie "optimistisch" aus State
 *   • needs_repair und failed sind immer sichtbar
 *   • Erst nach reconcile → 'verified' gilt Upload als abgeschlossen
 */

import React, { useRef, useState } from 'react';
import { useUploadQueue }           from '../lib/uploads/useUploadQueue.js';
import { STATUS_LABELS }            from '../lib/uploads/queueTypes.js';

// ─── Status-Farben ────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  queued:              '#94a3b8',
  persisting:          '#f59e0b',
  persisted:           '#3b82f6',
  creating_session:    '#8b5cf6',
  uploading:           '#06b6d4',
  paused:              '#94a3b8',
  pending_resume:      '#f59e0b',
  uploaded_unverified: '#f59e0b',
  verified:            '#10b981',
  needs_repair:        '#ef4444',
  failed:              '#ef4444',
};

// ─── Fortschrittsbalken ───────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color, borderRadius: '2px',
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

// ─── Einzelner Upload-Eintrag ─────────────────────────────────────────────────
function UploadItemRow({ item }) {
  const color      = STATUS_COLOR[item.status] || '#94a3b8';
  const label      = STATUS_LABELS[item.status] || item.status;
  const isActive   = ['uploading', 'creating_session', 'pending_resume'].includes(item.status);
  const isError    = ['failed', 'needs_repair'].includes(item.status);
  const isVerified = item.status === 'verified';

  return (
    <div style={{
      padding:         '0.6rem 0.75rem',
      borderRadius:    '8px',
      border:          `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
      backgroundColor: isError
        ? 'rgba(239,68,68,0.05)'
        : isVerified
          ? 'rgba(16,185,129,0.05)'
          : 'var(--surface)',
      display:         'flex',
      flexDirection:   'column',
      gap:             '0.3rem',
    }}>

      {/* Dateiname + Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span style={{
          fontSize:     '0.82rem',
          fontWeight:   600,
          color:        'var(--text-main)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          flex:         1,
        }}>
          {item.originalName}
        </span>
        <span style={{
          fontSize:      '0.72rem',
          color,
          fontWeight:    600,
          whiteSpace:    'nowrap',
          flexShrink:    0,
        }}>
          {label}
        </span>
      </div>

      {/* Fortschrittsbalken (während Upload) */}
      {isActive && item.size > 0 && (
        <ProgressBar value={item.bytesUploaded} max={item.size} color={color} />
      )}
      {isActive && item.size > 0 && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {formatBytes(item.bytesUploaded)} / {formatBytes(item.size)}
        </div>
      )}

      {/* Fehlermeldung */}
      {item.errorMessage && (
        <div style={{
          fontSize:      '0.72rem',
          color:         '#ef4444',
          padding:       '0.25rem 0.4rem',
          borderRadius:  '4px',
          background:    'rgba(239,68,68,0.08)',
          wordBreak:     'break-word',
        }}>
          {item.errorMessage}
        </div>
      )}

      {/* Retry-Zähler */}
      {item.retryCount > 0 && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {item.retryCount}× wiederholt
        </div>
      )}
    </div>
  );
}

// ─── Batch-Zusammenfassung ────────────────────────────────────────────────────
function BatchSummary({ summary }) {
  if (!summary || summary.total === 0) return null;

  const rows = [
    { label: 'Gesamt',           value: summary.total,       color: 'var(--text-main)' },
    { label: 'Lokal gesichert',  value: summary.persisted,   color: '#3b82f6'           },
    { label: 'Hochgeladen',      value: summary.uploaded,    color: '#f59e0b'           },
    { label: '✅ Verifiziert',   value: summary.verified,    color: '#10b981'           },
    { label: '❌ Fehlgeschlagen', value: summary.failed,      color: '#ef4444'           },
    { label: '🔧 Reparatur nötig', value: summary.needsRepair, color: '#ef4444'          },
  ].filter((r) => r.value > 0);

  return (
    <div style={{
      display:         'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap:             '0.4rem',
      padding:         '0.6rem 0.75rem',
      borderRadius:    '8px',
      border:          '1px solid var(--border)',
      backgroundColor: 'var(--surface)',
      fontSize:        '0.78rem',
    }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{r.label}</span>
          <span style={{ fontWeight: 700, color: r.color, fontSize: '1rem' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string} props.projectId        QTool Projekt-ID
 * @param {string} [props.remoteFolder]   OneDrive-Zielpfad (optional, Default: QTool/{projectId}/Fotos)
 * @param {string} [props.label]          Optionaler Titel
 */
export default function ProjectImageUploadPanel({ projectId, remoteFolder, label }) {
  const folder = remoteFolder || `QTool/${projectId}/Fotos`;

  const {
    items,
    summary,
    isBusy,
    isOneDriveReady,
    addFiles,
    processAll,
  } = useUploadQueue(projectId, folder);

  const inputRef    = useRef(null);
  const [dragOver,  setDragOver]  = useState(false);

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true);  };
  const handleDragLeave = ()  => { setDragOver(false); };
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter(isImageFile);
    if (files.length) await addFiles(files);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files ?? []).filter(isImageFile);
    if (files.length) await addFiles(files);
    e.target.value = '';
  };

  // ─── Ausstehende Items für Fehleranzeige ─────────────────────────────────
  const visibleItems = items.filter((i) => i.status !== 'verified' || items.length < 20);
  const hasErrors    = items.some((i) => ['failed', 'needs_repair'].includes(i.status));
  const hasPending   = items.some((i) =>
    ['queued','persisted','uploading','pending_resume','uploaded_unverified'].includes(i.status)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

      {/* Titel */}
      {label && (
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {label}
        </div>
      )}

      {/* Dropzone */}
      <div
        id="durable-upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border:          `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius:    '8px',
          padding:         '1.25rem',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          gap:             '0.4rem',
          backgroundColor: dragOver ? 'rgba(37,99,235,0.06)' : 'transparent',
          cursor:          isOneDriveReady ? 'pointer' : 'not-allowed',
          opacity:         isOneDriveReady ? 1 : 0.5,
          transition:      'all 0.2s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.jpg,.jpeg,.png,.heic,.heif,.webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={!isOneDriveReady}
          id="durable-upload-input"
        />

        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke={dragOver ? 'var(--primary)' : 'var(--text-muted)'} strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>

        <div style={{ fontSize: '0.83rem', color: 'var(--text-main)', fontWeight: 500, textAlign: 'center' }}>
          {isOneDriveReady
            ? 'Bilder hierher ziehen oder tippen zum Auswählen'
            : 'Bitte zuerst OneDrive verbinden'}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          JPG, PNG, HEIC, WebP · Offline-sicher · Wiederaufnahme automatisch
        </div>
      </div>

      {/* Batch-Zusammenfassung */}
      {summary && <BatchSummary summary={summary} />}

      {/* Aktionen */}
      {(hasErrors || hasPending) && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            id="durable-upload-resume-btn"
            onClick={() => void processAll()}
            disabled={isBusy}
            style={{
              padding:         '0.4rem 0.9rem',
              borderRadius:    '6px',
              border:          '1px solid var(--border)',
              backgroundColor: isBusy ? 'var(--surface)' : 'var(--primary)',
              color:           isBusy ? 'var(--text-muted)' : '#fff',
              fontSize:        '0.82rem',
              cursor:          isBusy ? 'not-allowed' : 'pointer',
              fontWeight:      600,
            }}
          >
            {isBusy ? '⏳ Läuft…' : '🔄 Upload fortsetzen'}
          </button>

          {hasErrors && (
            <div style={{
              padding:        '0.4rem 0.75rem',
              borderRadius:   '6px',
              border:         '1px solid rgba(239,68,68,0.3)',
              backgroundColor:'rgba(239,68,68,0.08)',
              fontSize:       '0.78rem',
              color:          '#ef4444',
              fontWeight:     600,
            }}>
              ⚠️ {items.filter(i => ['failed','needs_repair'].includes(i.status)).length} Fehler
            </div>
          )}
        </div>
      )}

      {/* Item-Liste (kompakt, neueste zuerst, max. 50) */}
      {visibleItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '320px', overflowY: 'auto' }}>
          {[...visibleItems].reverse().slice(0, 50).map((item) => (
            <UploadItemRow key={item.id} item={item} />
          ))}
          {visibleItems.length > 50 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              + {visibleItems.length - 50} weitere…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isImageFile(file) {
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name) || file.type.startsWith('image/');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
