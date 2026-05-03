/**
 * StatusChangeButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dropdown button for office-only status transitions.
 *
 * - Shows only the ALLOWED next statuses (from statusTransitions.js)
 * - Calls updateProjectStatus() — the single central action
 * - Shows loading state and error
 * - Never available in technician mode
 *
 * Props:
 *   project        {ProjectRecord}  - The raw project object
 *   supabase       {object}         - Supabase client
 *   currentUser    {string}         - Name of the logged-in user
 *   onStatusChanged {() => void}    - Called after successful transition
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader, AlertTriangle } from 'lucide-react';
import { getAllowedNextStatuses, getTransitionLabel, isTerminalStatus } from './statusTransitions.js';
import { updateProjectStatus } from './statusActions.js';

/**
 * @param {{ project: object, supabase: object, currentUser: string, onStatusChanged: Function }} props
 */
export default function StatusChangeButton({ project, supabase, currentUser, onStatusChanged }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const ref = useRef(null);

  const nextStatuses = getAllowedNextStatuses(project.status);
  const terminal = isTerminalStatus(project.status);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTransition = async (newStatus) => {
    setOpen(false);
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await updateProjectStatus(supabase, {
      projectId: project.id,
      newStatus,
      changedBy: currentUser || 'Büro',
    });

    setLoading(false);

    if (result.success) {
      setSuccess(`Status geändert zu: ${getTransitionLabel(newStatus)}`);
      setTimeout(() => setSuccess(null), 3000);
      onStatusChanged?.();
    } else {
      setError(result.error || 'Unbekannter Fehler');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (terminal)
    return <span style={{ fontSize: '0.7rem', color: '#334155', fontStyle: 'italic' }}>Abgeschlossen</span>;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        disabled={loading || nextStatuses.length === 0}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '0.3rem 0.65rem', borderRadius: 8, cursor: 'pointer',
          backgroundColor: open ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.3)',
          color: '#60A5FA', fontSize: '0.72rem', fontWeight: 700,
          transition: 'all 0.15s',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading
          ? <><Loader size={11} style={{ animation: 'scbSpin 1s linear infinite' }} /> Speichern…</>
          : <>Status weiter <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} /></>
        }
      </button>

      {/* Dropdown */}
      {open && nextStatuses.length > 0 && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 9999,
          backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '0.4rem', minWidth: 200,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          animation: 'scbFade 0.12s ease',
        }}>
          <div style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.2rem 0.5rem 0.4rem' }}>
            Nächster Status:
          </div>
          {nextStatuses.map(s => (
            <button
              key={s}
              onClick={() => handleTransition(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.45rem 0.6rem', border: 'none', borderRadius: 7,
                backgroundColor: 'transparent', cursor: 'pointer', color: '#CBD5E1',
                fontSize: '0.78rem', fontWeight: 600, transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              → {getTransitionLabel(s)}
            </button>
          ))}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 10000,
          backgroundColor: '#450a0a', border: '1px solid #EF4444',
          borderRadius: 8, padding: '0.6rem 0.8rem', minWidth: 220,
          display: 'flex', gap: 6, alignItems: 'flex-start',
        }}>
          <AlertTriangle size={13} color="#EF4444" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: '#FCA5A5' }}>{error}</span>
        </div>
      )}

      {/* Success hint */}
      {success && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 10000,
          backgroundColor: '#052e16', border: '1px solid #10B981',
          borderRadius: 8, padding: '0.5rem 0.75rem', minWidth: 220,
          fontSize: '0.72rem', color: '#6EE7B7',
        }}>
          ✅ {success}
        </div>
      )}

      <style>{`
        @keyframes scbSpin { to { transform: rotate(360deg); } }
        @keyframes scbFade { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
