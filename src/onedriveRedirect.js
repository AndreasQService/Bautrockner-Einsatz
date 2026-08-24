import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

broadcastResponseToMainFrame().catch((error) => {
  console.error('[Auth] OneDrive-Callback konnte nicht an das Hauptfenster übergeben werden:', error);
  document.body.textContent = 'OneDrive-Anmeldung fehlgeschlagen. Dieses Fenster kann geschlossen werden.';
});
