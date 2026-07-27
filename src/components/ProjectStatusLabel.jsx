export default function ProjectStatusLabel({ currentStatusLabel }) {
  return (
    <span style={{
      fontSize: '0.72rem', color: '#60A5FA', fontWeight: 600,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {currentStatusLabel}
    </span>
  );
}
