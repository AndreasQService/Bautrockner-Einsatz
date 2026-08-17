import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { subscribeSWUpdate, triggerSWUpdate } from '../lib/offline/swUpdateLifecycle.js';
import { ensurePersistentStorage } from '../lib/offline/storagePersistence.js';

export default function PWAUpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Ensure iOS WebKit storage persistence on mount
    ensurePersistentStorage();

    const unsubscribe = subscribeSWUpdate((updateAvailable) => {
      setHasUpdate(updateAvailable);
    });

    return () => unsubscribe();
  }, []);

  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-md bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-sky-500/40 flex items-center justify-between gap-4 animate-bounce-short">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div>
          <div className="font-medium text-sm text-slate-100">Neue QTool-Version verfügbar</div>
          <div className="text-xs text-slate-400">Änderungen bleiben lokal gesichert.</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => triggerSWUpdate()}
          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors shadow-md flex items-center gap-1.5"
        >
          Aktualisieren
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
