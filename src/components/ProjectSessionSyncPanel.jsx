import React from 'react';
import { buildProjectSessionStatusModel } from '../lib/offline/projectSessionStatusModel.js';

export default function ProjectSessionSyncPanel({
  localConfirmed,
  localMaterializationVerified,
  counts,
  readiness,
  syncing = false,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
  onSyncAndExit,
  onDashboard,
  onReturnToDashboard,
}) {
  const model = buildProjectSessionStatusModel({
    localConfirmed,
    localMaterializationVerified,
    counts,
    readiness,
    syncing,
    online,
  });

  const isSupabaseSynced = model.supabaseOk;
  const isOneDriveSynced = model.oneDriveOk;
  const handleReturnToDashboard = onReturnToDashboard || onDashboard || onSyncAndExit;

  return (
    <div
      aria-label="Projekt-Synchronisationsstatus"
      title={model.localAvailable ? 'Projekt offline verfügbar' : 'Projekt wird lokal vollständig vorbereitet'}
      className="flex items-center justify-between gap-4 py-2 px-4 bg-slate-900 text-white rounded-lg mb-4 shadow-md"
    >
      {/* Status Pills */}
      <div className="flex items-center gap-2">
        {/* Supabase Status */}
        <span
          id="project-supabase-sync-badge"
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            isSupabaseSynced
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
              : 'bg-rose-950/60 text-rose-300 border-rose-500/50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isSupabaseSynced ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
          {isSupabaseSynced ? 'Supabase OK' : 'Supabase ausstehend'}
        </span>

        {/* OneDrive Status */}
        <span
          id="project-onedrive-sync-badge"
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            isOneDriveSynced
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
              : 'bg-rose-950/60 text-rose-300 border-rose-500/50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOneDriveSynced ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
          {isOneDriveSynced ? 'OneDrive OK' : 'OneDrive ausstehend'}
        </span>
      </div>

      {/* Standard Dashboard Button */}
      <button
        type="button"
        onClick={handleReturnToDashboard}
        aria-label="Dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-sm font-medium rounded-md border border-slate-700 transition-colors shadow-sm cursor-pointer"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        Dashboard
      </button>
    </div>
  );
}
