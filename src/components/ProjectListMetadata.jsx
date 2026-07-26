import Sep from './ProjectListSeparator.jsx';

export default function ProjectListMetadata({ row, col, PAL }) {
  return (
    <>
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
    </>
  );
}
