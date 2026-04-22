import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tw.css'
import './index.css'
import ErrorBoundary from './ErrorBoundary.jsx'

// ─── Durable Upload: App-Start Repair ───────────────────────────────────────
// Repariert hängende Items aus abgebrochenen Sitzungen (kein await nötig,
// läuft im Hintergrund und blockiert den Render-Start nicht).
import('./lib/uploads/reconcile.js')
  .then(({ repairHangingItems }) => repairHangingItems())
  .then((n) => { if (n > 0) console.info(`[Boot] 🔧 ${n} hängende Uploads repariert`); })
  .catch((e) => console.warn('[Boot] Repair fehlgeschlagen:', e.message));

// ─── Durable Upload: Migration alter Fotos (einmalig) ───────────────────────
// Übernimmt alle ausstehenden Fotos aus dem alten qtool-photos-Store
// in die neue durable Queue → werden beim nächsten Worker-Durchlauf hochgeladen.
import('./lib/uploads/migrateOldQueue.js')
  .then(({ migrateOldQueueIfNeeded }) => migrateOldQueueIfNeeded())
  .then(({ migrated }) => {
    if (migrated > 0) {
      console.info(`[Boot] 📦 ${migrated} alte Fotos in durable Queue migriert`);
      // Worker starten damit migrierte Items sofort hochgeladen werden
      import('./lib/uploads/uploadWorker.js')
        .then(({ runUploadWorker }) => runUploadWorker({ maxParallel: 2 }))
        .catch((e) => console.warn('[Boot] Worker nach Migration fehlgeschlagen:', e.message));
    }
  })
  .catch((e) => console.warn('[Boot] Migration fehlgeschlagen:', e.message));

// ─── Durable Upload: Auth persistieren ──────────────────────────────────────
import('./lib/onedrive/auth.js')
  .then(({ initOneDriveAuth }) => initOneDriveAuth())
  .catch((e) => console.warn('[Boot] Auth-Init fehlgeschlagen:', e.message));


const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

Promise.all([
  import('@azure/msal-browser'),
  import('@azure/msal-react'),
  import('./App.jsx'),
  import('./msalConfig.js'),
]).then(async ([
  { PublicClientApplication },
  { MsalProvider },
  { default: App },
  { msalConfig },
]) => {

  const root = createRoot(document.getElementById('root'));

  if (isLocalhost) {
    // Vollständiger MSAL-Flow auf Localhost
    const msalInstance = new PublicClientApplication(msalConfig);
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('MSAL timeout')), 5000));
    const render = () => root.render(
      <StrictMode><MsalProvider instance={msalInstance}><ErrorBoundary><App /></ErrorBoundary></MsalProvider></StrictMode>
    );
    Promise.race([
      msalInstance.initialize().then(() => msalInstance.handleRedirectPromise().catch(() => null)),
      timeout
    ]).then(render).catch(e => { console.warn('[MSAL]', e.message); render(); });

  } else {
    // Auf Vercel / iPad / Netzwerk: Echter MSAL-Flow mit Popup-Login
    // loginPopup funktioniert auf Chrome/iPad besser als loginRedirect
    const msalInstance = new PublicClientApplication(msalConfig);
    const render = () => root.render(
      <StrictMode><MsalProvider instance={msalInstance}><ErrorBoundary><App /></ErrorBoundary></MsalProvider></StrictMode>
    );
    msalInstance.initialize()
      .then(() => msalInstance.handleRedirectPromise().catch(() => null))
      .then(render)
      .catch(e => { console.warn('[MSAL Vercel]', e.message); render(); });
  }

}).catch(err => {
  console.error('[QTool] Ladefehler:', err);
});

