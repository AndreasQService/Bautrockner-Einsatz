import { formatStatusDuration } from '../utils/projectUtils.js';

export default function ProjectStatusDuration({ dDays, daysColor, daysInStatus }) {
  return (
    <>
      {/* 4 · Dauer (EINMALIG) */}
      <span style={{
        fontSize: '0.72rem', fontWeight: dDays >= 3 ? 700 : 400,
        color: daysColor, whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {formatStatusDuration(daysInStatus)}
      </span>
    </>
  );
}
