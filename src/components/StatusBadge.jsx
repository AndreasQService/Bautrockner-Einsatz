import React from 'react';

export default function StatusBadge({ status = 'success', children, className = '' }) {
  let badgeStyles = 'bg-slate-100 text-slate-900 border border-slate-300';

  const normalized = String(status).toLowerCase();

  if (normalized.includes('success') || normalized.includes('synced') || normalized.includes('ok') || normalized.includes('erfasst') || normalized.includes('abgeschlossen')) {
    badgeStyles = 'bg-emerald-50 text-emerald-900 border border-emerald-300';
  } else if (normalized.includes('pending') || normalized.includes('offline') || normalized.includes('local') || normalized.includes('bearbeitung') || normalized.includes('warten')) {
    badgeStyles = 'bg-amber-50 text-amber-900 border border-amber-300';
  } else if (normalized.includes('error') || normalized.includes('conflict') || normalized.includes('kritisch') || normalized.includes('fail')) {
    badgeStyles = 'bg-rose-50 text-rose-900 border border-rose-300';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${badgeStyles} ${className}`}>
      {children}
    </span>
  );
}
