/**
 * OfficeProjectsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Main page component for the office project control view.
 *
 * Drop-in replacement / complement for the existing OfficeDashboard.
 *
 * Props:
 *   reports      {object[]}  - Raw project records from Supabase / App state
 *   supabase     {object}    - Supabase client
 *   currentUser  {object}    - { name: string }
 *   onSelectReport {Function} - Navigate to detail view
 *
 * Usage in Dashboard.jsx (desktop mode only — technician mode untouched):
 *   import OfficeProjectsPage from '../features/projects/OfficeProjectsPage'
 *   ...
 *   {mode !== 'technician' && (
 *     <OfficeProjectsPage
 *       reports={reports}
 *       supabase={supabase}
 *       currentUser={currentUser}
 *       onSelectReport={onSelectReport}
 *     />
 *   )}
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Search, Activity } from 'lucide-react';

import { mapProjectsToRows }   from './projectRowMapper.js';
import { sortProjects }        from './sortProjects.js';
import { filterProjects, searchProjects, calcFilterCounts } from './filters.js';
import { getDaysSince }        from './statusRules.js';
import { updateProjectStatus } from './statusActions.js';
import ProjectDashboard        from './ProjectDashboard.jsx';
import ProjectListRow          from './ProjectListRow.jsx';
import { hasSupplierInvoice }  from './invoiceEvidence.js';

// ─── Compute dashboard stats from view models ─────────────────────────────────

const buildStats = (rows, allReports) => {
  const leckRows = rows.filter(r => ['Leckortung', 'leckortung'].includes(r.currentStatus) && r.daysInStatus !== null);
  const avgL = leckRows.length ? Math.round(leckRows.reduce((s, r) => s + r.daysInStatus, 0) / leckRows.length) : null;

  // Trocknung avg needs raw drying start date
  const dryRows = allReports.filter(r => r.status === 'Trocknung');
  const dryDays = dryRows.map(r => {
    const start = r.dryingStarted ||
      r.equipment?.map(e => e.startDate).filter(Boolean).sort()[0] ||
      r.statusStartedAt || r.date;
    return getDaysSince(start);
  }).filter(d => d !== null);
  const avgD = dryDays.length ? Math.round(dryDays.reduce((s, d) => s + d, 0) / dryDays.length) : null;

  return {
    total:            rows.length,
    red:              rows.filter(r => r.priority === 'red').length,
    yellow:           rows.filter(r => r.priority === 'yellow').length,
    green:            rows.filter(r => r.priority === 'green').length,
    unassigned:       rows.filter(r => r.isUnassigned).length,
    openReports:      rows.filter(r => ['Leckortung', 'leckortung', 'aufnahme', 'Schadenaufnahme', 'bericht'].includes(r.currentStatus)).length,
    openInvoices:     rows.filter(r => {
      const raw = r._raw;
      const hasInv = hasSupplierInvoice(raw);
      return !hasInv && ['Instandsetzung', 'Instandstellung', 'instandstellung', 'rechnung'].includes(r.currentStatus);
    }).length,
    noActivity:       rows.filter(r => (r.daysInStatus ?? 0) >= 3 && r.openTasksCount > 0).length,
    avgDaysLeckortung: avgL,
    avgDaysTrocknung:  avgD,
  };
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function OfficeProjectsPage({ reports, supabase, currentUser, onSelectReport, onReportsChanged }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [collapsed, setCollapsed]       = useState(false);

  // 1. Map all active (non-archived) projects to view models
  const allRows = useMemo(() => {
    const activeReports = reports.filter(r => r.status !== 'Abgeschlossen');
    return mapProjectsToRows(activeReports);
  }, [reports]);

  // 2. Stats (over all rows, before filter)
  const stats = useMemo(() => buildStats(allRows, reports), [allRows, reports]);

  // 3. Filter counts (for badge display)
  const filterCounts = useMemo(() => calcFilterCounts(allRows), [allRows]);

  // 4. Apply filter + search + sort
  const displayRows = useMemo(() => {
    let list = filterProjects(allRows, activeFilter);
    list = searchProjects(list, searchTerm);
    return sortProjects(list);
  }, [allRows, activeFilter, searchTerm]);

  // 5. Status direkt ändern (aus dem Dropdown in der Zeile)
  const [changingId, setChangingId] = useState(null);   // zeigt mini-Spinner per Row
  const [changeError, setChangeError] = useState(null); // zeigt Fehler kurz an

  const handleChangeStatus = useCallback(async (projectId, newStatus) => {
    if (!supabase) return;
    setChangingId(projectId);
    setChangeError(null);

    const result = await updateProjectStatus(supabase, {
      projectId,
      newStatus,
      changedBy: currentUser?.name || 'Büro',
    });

    setChangingId(null);

    if (result.success) {
      onReportsChanged?.();   // Eltern-Komponente lädt aus Supabase neu
    } else {
      setChangeError(result.error || 'Fehler beim Statuswechsel');
      setTimeout(() => setChangeError(null), 4000);
    }
  }, [supabase, currentUser, onReportsChanged]);

  if (allRows.length === 0) return null;

  return (
    <div style={{
      marginBottom: '2rem', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.08)',
      backgroundColor: 'var(--surface, #1E293B)',
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
    }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0.9rem 1.25rem',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.06) 100%)',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <Activity size={16} color="#3B82F6" />
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #F1F5F9)', flex: 1 }}>
          Büro-Projektkontrolle
          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#64748B', marginLeft: 8 }}>
            {allRows.length} aktive Projekte
          </span>
        </span>

        {stats.red > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>
            ⚠ {stats.red} kritisch
          </span>
        )}
        {stats.yellow > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
            ⏱ {stats.yellow} verzögert
          </span>
        )}

        <ChevronDown size={15} color="#64748B" style={{
          transform: collapsed ? 'rotate(-90deg)' : 'none',
          transition: 'transform 0.2s',
        }} />
      </div>

      {!collapsed && (
        <>
          {/* ── Dashboard: stats strip + filter tiles ─────────────── */}
          <ProjectDashboard
            stats={stats}
            filterCounts={filterCounts}
            activeFilter={activeFilter}
            onChangeFilter={setActiveFilter}
          />

          {/* ── Search bar ───────────────────────────────────────── */}
          <div style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
              <input
                type="text"
                placeholder="Projekt suchen…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', padding: '0.42rem 0.9rem 0.42rem 2rem',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-main, #F1F5F9)',
                  fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#475569', marginLeft: 'auto' }}>
              {displayRows.length} {displayRows.length === 1 ? 'Projekt' : 'Projekte'}
              {(activeFilter || searchTerm) && <span style={{ color: '#F59E0B', marginLeft: 4 }}>(gefiltert)</span>}
            </span>
          </div>

          {/* ── Fehler-Toast ──────────────────────────────── */}
          {changeError && (
            <div style={{
              padding: '0.45rem 1.25rem', fontSize: '0.75rem',
              color: '#FCA5A5', backgroundColor: 'rgba(239,68,68,0.08)',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
            }}>
              ⚠ {changeError}
            </div>
          )}

          {/* ── Projektliste ──────────────────────────────── */}
          <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
            {displayRows.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Keine Projekte für diesen Filter.
              </div>
            ) : (
              <div>
                {displayRows.map(row => (
                  <ProjectListRow
                    key={row.id}
                    row={row}
                    onOpen={() => onSelectReport(row._raw)}
                    onChangeStatus={supabase ? handleChangeStatus : undefined}
                    isChanging={changingId === row.id}
                  />
                ))}
              </div>
            )}
          </div>


          {/* ── Legend ────────────────────────────────────────────── */}
          <div style={{
            padding: '0.5rem 1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.61rem', color: '#334155', fontWeight: 700 }}>LEGENDE:</span>
            {[
              { color: '#EF4444', label: 'Kritisch – sofort handeln' },
              { color: '#F59E0B', label: 'Verzögert – heute planen' },
              { color: '#10B981', label: 'OK – im Zeitplan' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.63rem', color: '#64748B' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color }} />
                {label}
              </div>
            ))}
            <span style={{ fontSize: '0.6rem', color: '#334155', marginLeft: 'auto', fontStyle: 'italic' }}>
              Sortierung: Kritisch + älteste zuerst
            </span>
          </div>
        </>
      )}
    </div>
  );
}
