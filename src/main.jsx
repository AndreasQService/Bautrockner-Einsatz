import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./msalConfig.js";
import { registerSW } from 'virtual:pwa-register'

// Service Worker registrieren
registerSW({
  onNeedRefresh() { },
  onOfflineReady() { console.log('[QTool] App ist offline verfügbar.') },
})

const msalInstance = new PublicClientApplication(msalConfig);

// MSAL v3: initialize() MUSS vor dem Render aufgerufen werden
msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MsalProvider>
    </StrictMode>,
  )
});
