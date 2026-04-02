import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
  { MsalProvider, MsalContext },
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
    // Auf iPad/Netzwerk: Stub-Context ohne initialization/redirect
    const stubLogger = { verbose: () => {}, verbosePii: () => {}, info: () => {}, warning: () => {}, error: () => {}, trace: () => {}, clone: function() { return this; } };
    const stubInstance = {
      getAllAccounts: () => [],
      getActiveAccount: () => null,
      loginRedirect: () => Promise.resolve(),
      logoutRedirect: () => Promise.resolve(),
      acquireTokenSilent: () => Promise.reject(new Error('OneDrive nur auf Desktop')),
      initialize: () => Promise.resolve(),
      handleRedirectPromise: () => Promise.resolve(null),
      addEventCallback: () => '0',
      removeEventCallback: () => {},
      getLogger: () => stubLogger,
      setActiveAccount: () => {},
    };
    const stubContext = { instance: stubInstance, inProgress: 'none', accounts: [], logger: stubLogger };
    root.render(
      <StrictMode>
        <MsalContext.Provider value={stubContext}>
          <ErrorBoundary><App /></ErrorBoundary>
        </MsalContext.Provider>
      </StrictMode>
    );
  }

}).catch(err => {
  console.error('[QTool] Ladefehler:', err);
});

