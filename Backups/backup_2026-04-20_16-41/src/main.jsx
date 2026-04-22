import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tw.css'
import './index.css'
import ErrorBoundary from './ErrorBoundary.jsx'

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

