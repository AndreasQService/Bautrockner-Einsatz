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
// Nutzt die bestehenden VITE_MSAL_* Umgebungsvariablen aus .env

const msalConfig = {
  auth: {
    clientId:               import.meta.env.VITE_MSAL_CLIENT_ID,
    // 'common' erlaubt jedes Microsoft-Konto (persönlich + Arbeits-/Schulkonto)
    authority:              `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
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
  scopes: ['User.Read', 'Files.ReadWrite', 'Files.ReadWrite.All', 'offline_access'],
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

  let account = getActiveAccount();
  if (!account) {
    // Kein Account → interaktiver Login
    const result = await connectOneDrive();
    account = result.account ?? null;
    if (!account) {
      throw new Error('[Auth] Kein Microsoft-Konto nach Login verfügbar.');
    }
  }

  try {
    const result = await msal.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return result.accessToken;

  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Silent fehlgeschlagen (Consent, MFA, etc.) → Popup
      console.warn('[Auth] Silent-Token fehlgeschlagen → Popup-Login');
      const result = await msal.acquireTokenPopup({
        ...loginRequest,
        account,
      });
      if (result.account) msal.setActiveAccount(result.account);
      return result.accessToken;
    }
    // Andere Fehler (Netzwerk etc.) → weiterschmeissen
    throw new Error(`[Auth] Token-Beschaffung fehlgeschlagen: ${error.message}`);
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
