import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

/**
 * Übergibt die echte OAuth-Antwort über den offiziellen MSAL Redirect Bridge
 * an das Hauptfenster. MSAL bereinigt danach die URL und schließt das Popup.
 */
export function completeOneDrivePopup(broadcast = broadcastResponseToMainFrame) {
  return broadcast();
}
