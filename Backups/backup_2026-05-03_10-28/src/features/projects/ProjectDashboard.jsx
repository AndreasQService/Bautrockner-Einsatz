/**
 * ProjectDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Mini-dashboard with KPI tiles and quick-filter buttons for the office view.
 *
 * Props:
 *   stats        {DashboardStats}
 *   filterCounts {Record<string, number>}
 *   activeFilter {ProjectFilterKey | null}
 *   onChangeFilter {(key: ProjectFilterKey | null) => void}
 *
 * @typedef {import('../features/projects/types.js').DashboardStats} DashboardStats
 * @typedef {import('../features/projects/types.js').ProjectFilterKey} ProjectFilterKey
 */

import { AlertTriangle, Clock, CheckCircle2, FileText, User, Zap } from 'lucide-react';

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ value, label, accent, Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3,
        padding: '0.7rem 1rem', flex: '1 0 80px',
        borderRadius: 12, cursor: onClick ? 'pointer' : 'default',
        backgroundColor: active ? `${accent}1A` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${active ? accent : 'rgba(255,255,255,0.07)'}`,
        boxShadow: active ? `0 0 16px ${accent}22` : 'none',
        transition: 'all 0.18s', outline: 'none',
      }}
      onMouseEnter={e => onClick && !active && (e.currentTarget.style.borderColor = `${accent}44`)}
      onMouseLeave={e => onClick && !active && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      {Icon && <Icon size={15} color={accent} />}
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: active ? accent : '#CBD5E1', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.61rem', color: active ? accent : '#475569', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 }}>
        {label}
      </div>
    </button>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }) {
  const items = [
    { label: 'Aktive Projekte', value: stats.total,           color: '#94A3B8' },
    { label: '🔴 Kritisch',     value: stats.red,             color: '#EF4444' },
    { label: '🟡 Verzögert',    value: stats.yellow,          color: '#F59E0B' },
    { label: '✅ OK',           value: stats.green,           color: '#10B981' },
    stats.avgDaysLeckortung != null
      ? { label: 'Ø Leckortung', value: `${stats.avgDaysLeckortung} T`, color: '#3B82F6' }
      : null,
    stats.avgDaysTrocknung != null
      ? { label: 'Ø Trocknung',  value: `${stats.avgDaysTrocknung} T`, color: '#8B5CF6' }
      : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0.65rem 1rem',
          borderRight: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: item.color, lineHeight: 1 }}>
            {item.value}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#475569', fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap' }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard component ─────────────────────────────────────────────────

/**
 * @param {{ stats: DashboardStats, filterCounts: object, activeFilter: string|null, onChangeFilter: Function }} props
 */
export default function ProjectDashboard({ stats, filterCounts, activeFilter, onChangeFilter }) {
  const toggle = (key) => onChangeFilter(activeFilter === key ? null : key);

  const kpis = [
    { key: 'critical',    value: filterCounts.critical    ?? stats.red,          label: 'Kritisch',       accent: '#EF4444', Icon: AlertTriangle },
    { key: 'delayed',     value: filterCounts.delayed     ?? stats.yellow,        label: 'Verzögert',      accent: '#F59E0B', Icon: Clock         },
    { key: 'reportOpen',  value: filterCounts.reportOpen  ?? stats.openReports,   label: 'Bericht offen',  accent: '#3B82F6', Icon: FileText       },
    { key: 'invoiceOpen', value: filterCounts.invoiceOpen ?? stats.openInvoices,  label: 'Rechnung offen', accent: '#10B981', Icon: FileText       },
    { key: 'unassigned',  value: filterCounts.unassigned  ?? stats.unassigned,    label: 'Nicht zugew.',   accent: '#F59E0B', Icon: User           },
    { key: 'noActivity',  value: filterCounts.noActivity  ?? stats.noActivity,    label: 'Keine Aktivität',accent: '#8B5CF6', Icon: Zap            },
  ];

  return (
    <div>
      <StatsStrip stats={stats} />

      <div style={{
        display: 'flex', gap: '0.6rem', flexWrap: 'wrap',
        padding: '0.9rem 1.25rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {kpis.map(kpi => (
          <KpiTile
            key={kpi.key}
            value={kpi.value}
            label={kpi.label}
            accent={kpi.accent}
            Icon={kpi.Icon}
            active={activeFilter === kpi.key}
            onClick={() => toggle(kpi.key)}
          />
        ))}
      </div>

      {activeFilter && (
        <div style={{ padding: '0.3rem 1.25rem', fontSize: '0.68rem', color: '#475569', backgroundColor: 'rgba(59,130,246,0.04)' }}>
          Filter aktiv: <strong style={{ color: '#60A5FA' }}>{kpis.find(k => k.key === activeFilter)?.label}</strong>
          {' '}·{' '}
          <button
            onClick={() => onChangeFilter(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.68rem', textDecoration: 'underline' }}
          >
            aufheben
          </button>
        </div>
      )}
    </div>
  );
}
