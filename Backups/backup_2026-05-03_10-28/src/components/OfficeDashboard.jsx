/**
 * OfficeDashboard.jsx  v2
 * ───────────────────────────────────────────────────────────────────────────
 * Büro-Projektkontrolle — NUR für mode === 'desktop'
 * Techniker-Modus NICHT betroffen.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  AlertTriangle, Clock, CheckCircle2, ChevronRight, ChevronDown,
  Search, ListTodo, Zap, FileText, X, User, ArrowRight,
  TrendingUp, Activity
} from 'lucide-react';

import {
  analyzeProject, sortByPriority, calcDashboardKPIs, PRIORITY_COLORS, formatDays,
} from '../services/projectControl';

// ─── Ampel-Indikator ─────────────────────────────────────────────────────────

function AmpelBadge({ color }) {
  const c = PRIORITY_COLORS[color] || PRIORITY_COLORS.green;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      backgroundColor: c.bg, color: c.text,
      border: `1px solid ${c.border}44`,
      borderRadius: '999px', padding: '0.18rem 0.55rem',
      fontSize: '0.68rem', fontWeight: 800, whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', backgroundColor: c.dot,
        flexShrink: 0,
        boxShadow: color === 'red' ? `0 0 6px ${c.dot}` : 'none',
        animation: color === 'red' ? 'ampelPulse 1.8s ease-in-out infinite' : 'none',
      }} />
      {c.label}
    </span>
  );
}

// ─── Aufgaben-Popover ────────────────────────────────────────────────────────

function TasksPopover({ tasks, projectName, onClose, anchorRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target))
        onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const urgent = tasks.filter(t => t.urgent);
  const normal = tasks.filter(t => !t.urgent);

  return (
    <div ref={ref} onClick={e => e.stopPropagation()} style={{
      position: 'absolute', zIndex: 9999, top: '110%', right: 0,
      backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '13px', padding: '1rem', width: '300px',
      boxShadow: '0 24px 48px rgba(0,0,0,0.55)',
      animation: 'fadeInDown 0.15s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94A3B8' }}>
          Offene Aufgaben
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0 }}>
          <X size={14} />
        </button>
      </div>

      {urgent.length > 0 && (
        <>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            ⚠ Überfällig ({urgent.length})
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {urgent.map((t, i) => (
              <li key={t.id || i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                padding: '0.35rem 0.5rem', borderRadius: '8px',
                backgroundColor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <AlertTriangle size={11} color="#EF4444" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '0.74rem', color: '#FCA5A5', lineHeight: 1.4 }}>{t.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {normal.length > 0 && (
        <>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            Offen ({normal.length})
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {normal.map((t, i) => (
              <li key={t.id || i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                padding: '0.35rem 0.5rem', borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <Clock size={11} color="#64748B" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.4 }}>{t.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tasks.length === 0 && (
        <div style={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
          Keine offenen Aufgaben
        </div>
      )}
    </div>
  );
}

// ─── Projekt-Zeile ────────────────────────────────────────────────────────────

function ProjectRow({ report, onSelect }) {
  const [showTasks, setShowTasks] = useState(false);
  const btnRef = useRef(null);

  const priority = report._priority || { color: 'green', reason: '—', urgency: 0 };
  const col = PRIORITY_COLORS[priority.color] || PRIORITY_COLORS.green;
  const openTasks = report._allOpenTasks || [];
  const urgentCount = report._urgentTasksCount || 0;
  const normalCount = openTasks.length - urgentCount;
  const statusDays = report._statusDays;
  const nextAction = report._nextAction || '—';
  const nextIcon = report._nextActionIcon || '→';

  const projectName = report.street
    ? `${report.street}${report.city ? ', ' + report.city : ''}`
    : report.address?.split(',')[0] || report.projectTitle || report.id;

  const isRed = priority.color === 'red';
  const isYellow = priority.color === 'yellow';

  return (
    <tr
      onClick={() => onSelect(report)}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        backgroundColor: col.rowBg,
        transition: 'background-color 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = isRed
        ? 'rgba(239,68,68,0.09)'
        : isYellow ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = col.rowBg}
    >
      {/* Ampel-Streifen (farbige linke Linie) */}
      <td style={{
        padding: 0, width: '3px',
        backgroundColor: col.border,
      }} />

      {/* Ampel + Grund */}
      <td style={{ padding: '0.7rem 0.6rem 0.7rem 0.75rem', verticalAlign: 'top', minWidth: '120px' }}>
        <AmpelBadge color={priority.color} />
        <div style={{
          fontSize: '0.67rem', color: isRed ? '#FCA5A5' : isYellow ? '#FCD34D' : '#64748B',
          marginTop: '4px', lineHeight: 1.35, maxWidth: '120px',
          fontWeight: isRed ? 600 : 400,
        }}>
          {priority.reason}
        </div>
      </td>

      {/* Projekt / Adresse */}
      <td style={{ padding: '0.7rem 0.6rem', verticalAlign: 'top', minWidth: '160px' }}>
        <div style={{
          fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px',
        }}>
          {projectName}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600, marginTop: '2px' }}>
          {report.projectNumber || report.id}
        </div>
        <div style={{
          fontSize: '0.68rem', color: '#64748B', marginTop: '1px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px',
        }}>
          {report.client || '—'}
        </div>
      </td>

      {/* Status + Dauer */}
      <td style={{ padding: '0.7rem 0.6rem', verticalAlign: 'top', minWidth: '120px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          backgroundColor: 'rgba(59,130,246,0.12)', color: '#60A5FA',
          borderRadius: '999px', padding: '0.18rem 0.55rem',
          fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {report.status || '—'}
        </span>
        {statusDays !== null && (
          <div style={{
            fontSize: '0.65rem', marginTop: '4px', whiteSpace: 'nowrap',
            color: statusDays >= 6 ? '#F87171' : statusDays >= 3 ? '#FCD34D' : '#64748B',
            fontWeight: statusDays >= 3 ? 700 : 400,
          }}>
            ⏱ seit {formatDays(statusDays)}
          </div>
        )}
      </td>

      {/* Konkrete Nächste Aktion */}
      <td style={{ padding: '0.7rem 0.6rem', verticalAlign: 'top', maxWidth: '220px' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
          backgroundColor: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: '8px', padding: '0.35rem 0.5rem',
        }}>
          <span style={{ fontSize: '0.82rem', flexShrink: 0, marginTop: '-1px' }}>{nextIcon}</span>
          <span style={{ fontSize: '0.74rem', color: '#CBD5E1', lineHeight: 1.4 }}>
            {nextAction}
          </span>
        </div>
      </td>

      {/* Aufgaben-Badge */}
      <td style={{ padding: '0.7rem 0.6rem', verticalAlign: 'top', position: 'relative' }}>
        {openTasks.length > 0 ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              ref={btnRef}
              onClick={e => { e.stopPropagation(); setShowTasks(v => !v); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
              title="Aufgaben anzeigen"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ListTodo size={12} color={urgentCount > 0 ? '#EF4444' : '#64748B'} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#CBD5E1' }}>
                  {openTasks.length} Aufgaben
                </span>
              </div>
              {urgentCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.67rem', color: '#EF4444', fontWeight: 700 }}>
                    {urgentCount} überfällig
                  </span>
                  {normalCount > 0 && (
                    <span style={{ fontSize: '0.67rem', color: '#64748B' }}>
                      · {normalCount} offen
                    </span>
                  )}
                </div>
              )}
            </button>
            {showTasks && (
              <TasksPopover
                tasks={openTasks}
                projectName={projectName}
                onClose={() => setShowTasks(false)}
                anchorRef={btnRef}
              />
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.7rem', color: '#334155' }}>—</span>
        )}
      </td>

      {/* Bearbeiter */}
      <td style={{ padding: '0.7rem 0.6rem', verticalAlign: 'top' }}>
        {report._isUnassigned ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '0.68rem', fontWeight: 700, color: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '999px', padding: '0.15rem 0.45rem',
          }}>
            <User size={10} /> Nicht zugewiesen
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
            {report.assignedTo}
          </span>
        )}
      </td>

      {/* Öffnen-Pfeil */}
      <td style={{ padding: '0.7rem 0.75rem 0.7rem 0.5rem', verticalAlign: 'middle', textAlign: 'right' }}>
        <ChevronRight size={15} color="#3B82F6" />
      </td>
    </tr>
  );
}

// ─── Schnellfilter-Buttons ───────────────────────────────────────────────────

function QuickFilters({ kpis, activeFilter, onChange }) {
  const filters = [
    { key: 'red',          label: `🔴 Kritisch`,           count: kpis.red,          accent: '#EF4444' },
    { key: 'yellow',       label: `🟡 Verzögert`,          count: kpis.yellow,        accent: '#F59E0B' },
    { key: 'unassigned',   label: `👤 Nicht zugew.`,       count: kpis.unassigned,    accent: '#F59E0B' },
    { key: 'openReports',  label: `📄 Bericht offen`,      count: kpis.openReports,   accent: '#3B82F6' },
    { key: 'openInvoices', label: `💰 Rechnung offen`,     count: kpis.openInvoices,  accent: '#10B981' },
    { key: 'noActivity',   label: `⏱ Keine Aktivität`,    count: kpis.noActivity,    accent: '#8B5CF6' },
  ];

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {filters.map(f => {
        const active = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onChange(active ? null : f.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.3rem 0.7rem', borderRadius: '999px', cursor: 'pointer',
              fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.15s',
              backgroundColor: active ? f.accent + '22' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${active ? f.accent : 'rgba(255,255,255,0.08)'}`,
              color: active ? f.accent : '#64748B',
              boxShadow: active ? `0 0 12px ${f.accent}33` : 'none',
            }}
            onMouseEnter={e => !active && (e.currentTarget.style.borderColor = f.accent + '44')}
            onMouseLeave={e => !active && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          >
            {f.label}
            <span style={{
              minWidth: '18px', textAlign: 'center',
              backgroundColor: active ? f.accent : 'rgba(255,255,255,0.08)',
              color: active ? 'white' : '#94A3B8',
              borderRadius: '999px', fontSize: '0.65rem', fontWeight: 900,
              padding: '0 4px',
            }}>
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Mini-Statistik-Streifen ─────────────────────────────────────────────────

function StatsStrip({ kpis }) {
  const items = [
    { label: 'Gesamt aktiv',     value: kpis.total,                          color: '#94A3B8' },
    { label: '🔴 Kritisch',      value: kpis.red,                            color: '#EF4444' },
    { label: '🟡 Verzögert',     value: kpis.yellow,                         color: '#F59E0B' },
    { label: '✅ OK',            value: kpis.green,                          color: '#10B981' },
    kpis.avgLeckortung !== null
      ? { label: 'Ø Leckortung', value: `${kpis.avgLeckortung} Tage`,        color: '#3B82F6' }
      : null,
    kpis.avgDrying !== null
      ? { label: 'Ø Trocknung',  value: `${kpis.avgDrying} Tage`,            color: '#8B5CF6' }
      : null,
    kpis.unassigned > 0
      ? { label: '👤 Nicht zugew.', value: kpis.unassigned,                   color: '#F59E0B' }
      : null,
  ].filter(Boolean);

  return (
    <div style={{
      display: 'flex', gap: '0', flexWrap: 'nowrap', overflowX: 'auto',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0.7rem 1.25rem', flex: '1 0 auto',
          borderRight: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: item.color, lineHeight: 1 }}>
            {item.value}
          </div>
          <div style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 600, marginTop: '3px', whiteSpace: 'nowrap' }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function OfficeDashboard({ reports, onSelectReport }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const analyzedReports = useMemo(() => {
    const active = reports.filter(r => r.status !== 'Abgeschlossen');
    return active.map(analyzeProject);
  }, [reports]);

  const kpis = useMemo(() => calcDashboardKPIs(analyzedReports), [analyzedReports]);

  const filteredReports = useMemo(() => {
    let list = analyzedReports;

    switch (activeFilter) {
      case 'red':          list = list.filter(r => r._priority?.color === 'red'); break;
      case 'yellow':       list = list.filter(r => r._priority?.color === 'yellow'); break;
      case 'green':        list = list.filter(r => r._priority?.color === 'green'); break;
      case 'unassigned':   list = list.filter(r => r._isUnassigned); break;
      case 'noActivity':   list = list.filter(r => (r._statusDays || 0) >= 3 && r._openTasksCount > 0); break;
      case 'openReports':  list = list.filter(r => ['Leckortung', 'Schadenaufnahme'].includes(r.status)); break;
      case 'openInvoices': list = list.filter(r => {
        const hasInvoice = r.images?.some(img => img.assignedTo === 'Sonstiges');
        return !hasInvoice && (r.status === 'Instandsetzung' || r.status === 'Instandstellung');
      }); break;
    }

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.client?.toLowerCase().includes(s) ||
        r.projectTitle?.toLowerCase().includes(s) ||
        r.projectNumber?.toLowerCase().includes(s) ||
        r.street?.toLowerCase().includes(s) ||
        r.city?.toLowerCase().includes(s) ||
        r.address?.toLowerCase().includes(s) ||
        r.status?.toLowerCase().includes(s) ||
        r.assignedTo?.toLowerCase().includes(s)
      );
    }

    return sortByPriority(list);
  }, [analyzedReports, activeFilter, searchTerm]);

  if (!reports || reports.filter(r => r.status !== 'Abgeschlossen').length === 0) return null;

  return (
    <div style={{
      marginBottom: '2rem', borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      backgroundColor: 'var(--surface)',
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
    }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.9rem 1.25rem',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.06) 100%)',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <Activity size={16} color="#3B82F6" />
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', flex: 1 }}>
          Büro-Projektkontrolle
          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#64748B', marginLeft: '0.6rem' }}>
            {analyzedReports.length} aktive Projekte
          </span>
        </span>

        {kpis.red > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={11} /> {kpis.red} kritisch
          </span>
        )}
        {kpis.yellow > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
            <Clock size={11} /> {kpis.yellow} verzögert
          </span>
        )}

        <ChevronDown size={15} color="#64748B" style={{
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }} />
      </div>

      {!collapsed && (
        <>
          {/* ── Mini-Statistik ──────────────────────────────────────── */}
          <StatsStrip kpis={kpis} />

          {/* ── Filter + Suche ──────────────────────────────────────── */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          }}>
            <QuickFilters
              kpis={kpis}
              activeFilter={activeFilter}
              onChange={setActiveFilter}
            />

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#64748B', cursor: 'pointer', padding: '3px 8px', fontSize: '0.7rem' }}
                >
                  <X size={10} /> Filter aufheben
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Suchen…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    padding: '0.4rem 0.9rem 0.4rem 2rem',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px',
                    backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-main)',
                    fontSize: '0.78rem', outline: 'none', width: '160px', boxSizing: 'border-box',
                  }}
                />
                <Search size={12} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              </div>
            </div>
          </div>

          {/* ── Ergebnis-Info ───────────────────────────────────────── */}
          {(activeFilter || searchTerm) && (
            <div style={{ padding: '0.4rem 1.25rem', backgroundColor: 'rgba(59,130,246,0.05)', fontSize: '0.72rem', color: '#64748B' }}>
              {filteredReports.length} Projekte · Sortiert: Kritisch zuerst, dann nach Dauer
            </div>
          )}

          {/* ── Projektliste ────────────────────────────────────────── */}
          <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
            {filteredReports.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Keine Projekte für diesen Filter.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{
                    borderBottom: '2px solid rgba(255,255,255,0.07)',
                    position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10,
                  }}>
                    <th style={{ width: '3px', padding: 0 }} />
                    {[
                      { label: 'Ampel / Ursache',   w: '130px' },
                      { label: 'Projekt / Adresse',  w: 'auto'  },
                      { label: 'Status',             w: '120px' },
                      { label: '→ Jetzt tun',        w: '230px' },
                      { label: 'Aufgaben',           w: '130px' },
                      { label: 'Bearbeiter',         w: '120px' },
                      { label: '',                   w: '32px'  },
                    ].map(col => (
                      <th key={col.label} style={{
                        padding: '0.55rem 0.6rem', textAlign: 'left',
                        fontSize: '0.62rem', fontWeight: 700, color: '#475569',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        width: col.w, whiteSpace: 'nowrap',
                      }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(report => (
                    <ProjectRow key={report.id} report={report} onSelect={onSelectReport} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Legende ─────────────────────────────────────────────── */}
          <div style={{
            padding: '0.55rem 1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.62rem', color: '#334155', fontWeight: 700 }}>LEGENDE:</span>
            {[
              { color: '#EF4444', label: 'Kritisch – sofort handeln' },
              { color: '#F59E0B', label: 'Verzögert – heute planen' },
              { color: '#10B981', label: 'OK – im Zeitplan' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.64rem', color: '#64748B' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                {label}
              </div>
            ))}
            <span style={{ fontSize: '0.61rem', color: '#334155', marginLeft: 'auto', fontStyle: 'italic' }}>
              Sortierung: Rot + längste Dauer → Gelb → Grün
            </span>
          </div>
        </>
      )}

      <style>{`
        @keyframes ampelPulse {
          0%, 100% { box-shadow: 0 0 4px #EF4444aa; transform: scale(1); }
          50%       { box-shadow: 0 0 12px #EF4444ff; transform: scale(1.25); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
