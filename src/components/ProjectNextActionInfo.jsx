export default function ProjectNextActionInfo({ action }) {
  return (
    <span style={{
      fontSize: '0.77rem', fontWeight: 600,
      color: '#E2E8F0',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      flex: '1 1 180px', minWidth: 0,
    }}>
      → {action}
    </span>
  );
}
