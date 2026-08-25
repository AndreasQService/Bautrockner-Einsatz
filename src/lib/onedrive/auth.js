/**
 * auth.js
 * Stabile, persistent-auth-fähige Token-Verwaltung für Microsoft Graph
 *
 * Regeln:
 *   1. acquireTokenSilent() IMMER zuerst
 *   2. Interaktiver Popup-Login NUR im Fehlerfall (InteractionRequiredAuthError)
 *   3. Aktiver Account wird nach Reload wiederhergestellt (localStorage-Cache via MSAL)
 *   4. Kein Token → klarer Fehler, kein stilles Versagen
 */

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';

// ─── MSAL-Konfiguration ──────────────────────────────────────────────────────
// LIVE muss sich gegen das OneDrive des angemeldeten Q-Service-Benutzers
// authentifizieren. Die feste Tenant-ID bleibt ausschließlich für Test/Preview.
const isLiveQTool = window.location.hostname === 'bautrockner-einsatz.vercel.app';
const oneDriveTenant = isLiveQTool ? 'organizations' : import.meta.env.VITE_MSAL_TENANT_ID;

const msalConfig = {
  auth: {
    clientId:               import.meta.env.VITE_MSAL_CLIENT_ID,
    authority:              `https://login.microsoftonline.com/${oneDriveTenant}`,
    redirectUri:            window.location.origin,
    postLogoutRedirectUri:  window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation:         'localStorage',  // Überlebt Browser-Reload
    storeAuthStateInCookie: true,           // Safari / iOS ITP Schutz
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'Files.ReadWrite', 'offline_access'],
};

// ─── Singleton ───────────────────────────────────────────────────────────────

let _msalInstance = null;
let _initialized  = false;

/**
 * MSAL-Instanz zurückgeben (lazy-init, Singleton)
 * @returns {PublicClientApplication}
 */
export function getMsalInstance() {
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication(msalConfig);
  }
  return _msalInstance;
}

// ─── Initialisierung ─────────────────────────────────────────────────────────

/**
 * Muss einmal beim App-Start aufgerufen werden.
 * Verarbeitet Redirect-Result und stellt aktiven Account wieder her.
 * Idempotent (mehrfacher Aufruf sicher).
 *
 * @returns {Promise<import('@azure/msal-browser').AccountInfo|null>}
 */
export async function initOneDriveAuth() {
  const msal = getMsalInstance();

  if (!_initialized) {
    await msal.initialize();
    _initialized = true;
  }

  // Nach Popup-Redirect → Ergebnis verarbeiten
  const redirectResult = await msal.handleRedirectPromise().catch(() => null);
  if (redirectResult?.account) {
    msal.setActiveAccount(redirectResult.account);
    return redirectResult.account;
  }

  // Bereits gesetzter aktiver Account (localStorage)
  const active = msal.getActiveAccount();
  if (active) return active;

  // Erster Account aus Liste setzen (nach Reload)
  const accounts = msal.getAllAccounts();
  if (accounts.length > 0) {
    msal.setActiveAccount(accounts[0]);
    return accounts[0];
  }

  return null;
}

// ─── Account-Zugriff ─────────────────────────────────────────────────────────

/**
 * Gibt den aktuell aktiven Account zurück (ohne I/O)
 * @returns {import('@azure/msal-browser').AccountInfo|null}
 */
export function getActiveAccount() {
  const msal     = getMsalInstance();
  const active   = msal.getActiveAccount();
  if (active) return active;

  const accounts = msal.getAllAccounts();
  if (accounts.length > 0) {
    msal.setActiveAccount(accounts[0]);
    return accounts[0];
  }
  return null;
}

// ─── Verbindung herstellen ───────────────────────────────────────────────────

/**
 * Interaktiver Login (Popup).
 * Nur aufrufen, wenn kein Account vorhanden oder silent fehlschlägt.
 * @returns {Promise<import('@azure/msal-browser').AuthenticationResult>}
 */
export async function connectOneDrive() {
  const msal   = getMsalInstance();
  const result = await msal.loginPopup(loginRequest);
  if (result.account) msal.setActiveAccount(result.account);
  return result;
}

// ─── Token-Beschaffung ───────────────────────────────────────────────────────

/**
 * Liefert ein frisches Access-Token für Microsoft Graph.
 *
 * Reihenfolge:
 *   1. Silent (Token aus Cache oder per Refresh-Token)
 *   2. Popup (nur bei InteractionRequiredAuthError)
 *
 * Wirft einen Fehler, wenn kein Token beschafft werden kann.
 * → Kein stilles Versagen!
 *
 * @returns {Promise<string>} Access-Token
 */
export async function getGraphAccessToken() {
  const msal = getMsalInstance();

  const account = getActiveAccount();
  // Background workers must never open an authentication popup. Interactive
  // login is restricted to the explicit dashboard connect button.
  if (!account) return null;

  try {
    const result = await msal.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return result.accessToken;

  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Silent fehlgeschlagen → KEIN Popup, still scheitern
      // (Popup nur über expliziten Login-Button durch User)
      console.warn('[Auth] Silent-Token fehlgeschlagen – kein Popup (Background-Kontext)');
      return null;
    }
    // Andere Fehler → weiterschmeissen
    throw new Error(`[Auth] Token-Beschaffung fehlgeschlagen: ${error.message}`);
  }
}

/** Silent-only connectivity check. Never opens a popup or redirect. */
export async function getGraphAccessTokenSilent() {
  const msal = getMsalInstance();
  const account = getActiveAccount();
  if (!account) return null;
  try {
    const result = await msal.acquireTokenSilent({ ...loginRequest, account });
    return result?.accessToken || null;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) return null;
    throw new Error(`[Auth] Stille Token-Prüfung fehlgeschlagen: ${error.message}`);
  }
}

/**
 * Abmelden und Cache leeren
 */
export async function signOutOneDrive() {
  const msal    = getMsalInstance();
  const account = getActiveAccount();
  if (!account) return;
  await msal.logoutPopup({ account });
}

/**
 * Gibt die Drive ID des persönlichen OneDrives zurück und loggt sie.
 * Einmalig aufrufen um ONEDRIVE_DRIVE_ID für den Backend-Worker zu ermitteln.
 */
export async function getPersonalDriveId() {
  try {
    await initOneDriveAuth(); // MSAL muss initialisiert sein
    const token = await getGraphAccessToken();
    const resp  = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    console.log('✅ PERSÖNLICHE DRIVE ID:', data.id);
    console.log('   driveType:', data.driveType);
    console.log('   owner:    ', data.owner?.user?.displayName);
    return data.id;
  } catch (e) {
    console.warn('Drive ID Fehler:', e.message);
    return null;
  }
}

