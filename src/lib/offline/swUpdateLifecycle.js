/**
 * swUpdateLifecycle.js
 * Non-intrusive Service Worker update lifecycle management for QTOOL PWA.
 * Handles update detection, background pre-caching, and safe update triggering.
 */

let updateSWFn = null;
let updateAvailableListeners = [];

if (typeof window !== 'undefined') {
  window.addEventListener('qtool:sw-update-available', () => {
    notifyUpdateListeners(true);
  });
}

export function registerSWUpdateLifecycle() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Dynamic import of virtual:pwa-register if available or fallback
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      updateSWFn = registerSW({
        onNeedRefresh() {
          console.log('[PWA Lifecycle] 🔄 Neue QTool Version im Hintergrund geladen');
          notifyUpdateListeners(true);
        },
        onOfflineReady() {
          console.log('[PWA Lifecycle] 📶 QTool ist bereit für 100% Offline-Betrieb');
        }
      });
    })
    .catch(() => {
      // Fallback for standard navigator.serviceWorker registration
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA Lifecycle] 🔄 Neue Service Worker Version installiert');
              notifyUpdateListeners(true);
            }
          };
        };
      }).catch(() => {});
    });
}

export function notifyUpdateListeners(hasUpdate) {
  updateAvailableListeners.forEach(listener => {
    try {
      listener(hasUpdate);
    } catch (e) {}
  });
}

export function subscribeSWUpdate(callback) {
  if (typeof callback === 'function') {
    updateAvailableListeners.push(callback);
  }
  return () => {
    updateAvailableListeners = updateAvailableListeners.filter(cb => cb !== callback);
  };
}

export function triggerSWUpdate() {
  if (typeof updateSWFn === 'function') {
    updateSWFn(true);
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
