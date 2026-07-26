/**
 * ProjectListRow.jsx — Einzeilen-Layout
 *
 * Reihenfolge:
 * Priorität · Name · Status · Dauer · ⚠ Ursache · → Aktion · 📋 Tasks · 👤 Bearbeiter · [Status▼] [→]
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, User } from 'lucide-react';
import { getAllowedNextStatuses, getTransitionLabel } from './statusTransitions.js';
import { normalizeReason } from './normalizeReason.js';
import Sep from '../../components/ProjectListSeparator.jsx';
import ProjectStatusLabel from '../../components/ProjectStatusLabel.jsx';
import ProjectNextActionInfo from '../../components/ProjectNextActionInfo.jsx';

// ─── Farben ───────────────────────────────────────────────────────────────────

const PAL = {
  red:    { bg: 'rgba(239,68,68,0.06)',  hover: 'rgba(239,68,68,0.11)',  strip: '#EF4444', dot: '#EF4444', badge: 'rgba(239,68,68,0.18)',  badgeBorder: 'rgba(239,68,68,0.4)',  badgeText: '#FCA5A5', reasonC: '#FCA5A5', label: '🔴 Kritisch'  },
  yellow: { bg: 'rgba(245,158,11,0.04)', hover: 'rgba(245,158,11,0.09)', strip: '#F59E0B', dot: '#F59E0B', badge: 'rgba(245,158,11,0.15)', badgeBorder: 'rgba(245,158,11,0.35)', badgeText: '#FCD34D', reasonC: '#FCD34D', label: '🟡 Verzögert' },
  green:  { bg: 'transparent',           hover: 'rgba(255,255,255,0.03)', strip: '#10B981', dot: '#10B981', badge: 'rgba(16,185,129,0.12)', badgeBorder: 'rgba(16,185,129,0.25)', badgeText: '#6EE7B7', reasonC: '#64748B', label: '🟢 OK'        },
};

const dT = (d) => d == null ? '' : d === 0 ? 'Heute' : d === 1 ? '1T' : `${d}T`;

// ─── Status-Dropdown ──────────────────────────────────────────────────────────

function DropMenu({ currentStatus, projectId, onChangeStatus, isChanging }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const ref = useRef(null);
  const next = getAllowedNextStatuses(currentStatus);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (isChanging) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(v => !v);
  };

  if (!next.length) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={isChanging}
        style={{
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
          color: isChanging ? '#475569' : '#60A5FA', borderRadius: 6, padding: '0.18rem 0.5rem',
          fontSize: '0.66rem', fontWeight: 700, cursor: isChanging ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap', opacity: isChanging ? 0.6 : 1,
        }}
      >
        {isChanging ? '…' : 'Status ▾'}
      </button>

      {open && !isChanging && typeof document !== 'undefined' && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 99999,
            background: '#1E293B',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 9, padding: '0.3rem', minWidth: 185,
            boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
          }}
        >
          {next.map(s => (
            <button
              key={s}
              onClick={() => { setOpen(false); onChangeStatus?.(projectId, s); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', color: '#CBD5E1',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.38rem 0.5rem',
                borderRadius: 7, cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              → {getTransitionLabel(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hauptzeile ───────────────────────────────────────────────────────────────

export default function ProjectListRow({ row, onOpen, onChangeStatus, isChanging }) {
  const [hovered, setHovered] = useState(false);
  const col = PAL[row.priority] || PAL.green;

  const reason = normalizeReason(row.reason || '');
  const showReason = reason && reason !== 'Alles im Zeitplan' && row.priority !== 'green';

  // nextAction: kürzen auf ~45 Zeichen für Einzeilen-Flow
  const action = (row.nextAction || '').length > 48
    ? row.nextAction.slice(0, 46) + '…'
    : (row.nextAction || '');

  const dDays = row.daysInStatus ?? 0;
  const daysColor = dDays >= 6 ? '#F87171' : dDays >= 3 ? '#FCD34D' : '#94A3B8';

  return (
    <>
      <div
        className={`project-row project-row--${row.priority}`}
        onClick={() => onOpen?.(row.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0 0.85rem 0 0',
          minHeight: 48,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          cursor: 'pointer',
          backgroundColor: hovered ? col.hover : col.bg,
          transition: 'background-color 0.12s',
          overflow: 'hidden',
        }}
      >
        {/* Streifen */}
        <div style={{ width: 3, alignSelf: 'stretch', backgroundColor: col.strip, flexShrink: 0 }} />

        {/* 1 · Prioritäts-Badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          backgroundColor: col.badge, border: `1px solid ${col.badgeBorder}`,
          color: col.badgeText, borderRadius: 999,
          padding: '0.14rem 0.5rem', fontSize: '0.63rem', fontWeight: 800,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', backgroundColor: col.dot, flexShrink: 0,
            animation: row.priority === 'red' ? 'rowPulse 1.8s ease-in-out infinite' : 'none',
          }} />
          {PAL[row.priority]?.label.split(' ')[1] ?? 'OK'}
        </span>

        <Sep />

        {/* 2 · Projektname */}
        <span style={{
          fontWeight: 700, fontSize: '0.84rem',
          color: 'var(--text-main, #F1F5F9)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: '0 1 220px', minWidth: 0,
        }}>
          {row.displayName || row.title}
        </span>

        <Sep />

        {/* 3 · Status */}
        <ProjectStatusLabel currentStatusLabel={row.currentStatusLabel} />

        <Sep />

        {/* 4 · Dauer (EINMALIG) */}
        <span style={{
          fontSize: '0.72rem', fontWeight: dDays >= 3 ? 700 : 400,
          color: daysColor, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {dT(row.daysInStatus)}
        </span>


        <Sep />

        {/* 6 · Nächste Aktion — visuell dominant */}
        <ProjectNextActionInfo action={action} />

        {/* ── Ab hier: rechte Meta-Zone (stopPropagation) ─────────── */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, marginLeft: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          {/* 7 · Aufgaben */}
          {(row.openTasksCount ?? 0) > 0 && (
            <span style={{
              fontSize: '0.69rem', whiteSpace: 'nowrap',
              color: row.overdueTasksCount > 0 ? '#EF4444' : '#64748B',
              fontWeight: row.overdueTasksCount > 0 ? 700 : 400,
            }}>
              📋{row.openTasksCount}
              {row.overdueTasksCount > 0 && <span style={{ color: '#EF4444' }}>/{row.overdueTasksCount}⚠</span>}
            </span>
          )}

          {/* 8 · Bearbeiter */}
          {row.isUnassigned ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.67rem', fontWeight: 700, color: '#F59E0B',
              backgroundColor: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 999, padding: '0.1rem 0.42rem',
              whiteSpace: 'nowrap',
            }}>
              <User size={9} /> Nicht zugew.
            </span>
          ) : row.assignedTo ? (
            <span style={{
              fontSize: '0.69rem', color: '#94A3B8',
              whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <User size={9} color="#475569" /> {row.assignedTo}
            </span>
          ) : null}

          {/* 9a · Status-Dropdown */}
          <DropMenu
            currentStatus={row.currentStatus}
            projectId={row.id}
            onChangeStatus={onChangeStatus}
            isChanging={!!isChanging}
          />

          {/* 9b · Öffnen */}
          <button
            onClick={() => onOpen?.(row.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#3B82F6', padding: '0.1rem', display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes rowPulse {
          0%,100% { box-shadow: 0 0 3px #EF4444aa; transform: scale(1); }
          50%      { box-shadow: 0 0 8px #EF4444ff; transform: scale(1.35); }
        }
      `}</style>
    </>
  );
}
