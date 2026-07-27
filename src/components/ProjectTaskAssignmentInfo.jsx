import { User } from 'lucide-react';

export default function ProjectTaskAssignmentInfo({ row }) {
  return (
    <>
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
    </>
  );
}
