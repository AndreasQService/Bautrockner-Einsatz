# Schritt-für-Schritt Anleitung: Microsoft OneDrive & MSAL Setup

Diese Anleitung beschreibt, wie die Microsoft OneDrive Integration (über die Microsoft Graph API und MSAL.js) für das QTool eingerichtet und konfiguriert wird.

---

## 1. App-Registrierung im Microsoft Entra ID (Azure Portal)

Um mit der Microsoft Graph API kommunizieren zu können, muss eine App-Registrierung in deinem Microsoft/Azure-Konto erstellt werden.

1. Gehe zum [Microsoft Azure Portal](https://portal.azure.com) und melde dich an.
2. Suche nach **Microsoft Entra ID** (früher Azure Active Directory).
3. Wähle im linken Menü **App-registrierungen** (App registrations) und klicke auf **Neue Registrierung** (New registration).
4. Konfiguriere die App wie folgt:
   * **Name**: `QTool-App` (oder ähnlich)
   * **Unterstützte Kontotypen**: 
     * Wähle **"Konten in allen Organisationsverzeichnissen (beliebiger Microsoft Entra ID-Mandant – mandantenfähig) und persönliche Microsoft-Konten (z. B. Skype, Xbox)"** (Multitenant und persönliche Konten, `common`).
   * **Umleitungs-URI (Redirect URI)**:
     * Plattform: **Single-Page-Anwendung (SPA)** (Wichtig: Nicht Web oder Mobil!)
     * URI für lokale Entwicklung: `http://localhost:5173`
5. Klicke auf **Registrieren**.

---

## 2. Redirect-URIs für Vercel (Produktion) hinzufügen

Sobald die App auf Vercel deployed ist, musst du die Produktions-URL in der App-Registrierung hinterlegen:

1. Gehe in deiner App-Registrierung im Azure Portal auf **Authentifizierung** (Authentication).
2. Klicke unter **Single-Page-Anwendung** auf **URI hinzufügen**.
3. Trage deine Vercel-Projekt-URL ein, z. B.:
   * `https://dein-projekt.vercel.app`
4. Klicke auf **Speichern** (oben links).

---

## 3. API-Berechtigungen konfigurieren

Die App benötigt Berechtigungen, um Dateien im OneDrive des Benutzers zu lesen und zu schreiben.

1. Gehe in der App-Registrierung auf **API-Berechtigungen** (API permissions).
2. Klicke auf **Berechtigung hinzufügen** -> **Microsoft Graph**.
3. Wähle **Delegierte Berechtigungen** (Delegated permissions).
4. Suche und aktiviere folgende Berechtigungen:
   * `User.Read` (Standardmäßig aktiv – erlaubt das Lesen des Benutzerprofils)
   * `Files.ReadWrite` (Erlaubt den Zugriff auf die Dateien des angemeldeten Benutzers)
   * `Files.ReadWrite.All` (Erlaubt den Zugriff auf alle Dateien, auf die der Benutzer Zugriff hat)
   * `offline_access` (Ermöglicht das automatische Erneuern des Tokens im Hintergrund)
5. Klicke unten auf **Berechtigungen hinzufügen**.

---

## 4. Umgebungsvariablen konfigurieren

Kopiere die Anmeldedaten der App-Registrierung in deine Umgebungsvariablen.

1. Gehe in der App-Registrierung zur **Übersicht** (Overview).
2. Kopiere die **Anwendungs-ID (Client-ID)** und die **Verzeichnis-ID (Mandanten-ID)**.
3. Trage diese Werte in deine lokale `.env.local` bzw. `.env` ein:

```env
# OneDrive / Microsoft MSAL Integration
VITE_MSAL_CLIENT_ID="deine-anwendungs-client-id"
VITE_MSAL_TENANT_ID="common" # Verwende 'common' für Multitenant + persönliche Konten
```

> [!NOTE]
> Für Vercel (Produktion) müssen diese Variablen ebenfalls im Vercel-Dashboard unter **Settings -> Environment Variables** hinterlegt werden (siehe [VERCEL_GUIDE.md](file:///c:/QTool/VERCEL_GUIDE.md)).

---

## 5. Funktionsweise im QTool

### Ordnerstruktur
Das Tool speichert alle Daten strukturiert im OneDrive unter:
`OneDrive/QTool/[Projektnummer]_[Strasse]_[Ort]/`

Darin werden automatisch folgende Unterordner angelegt:
* `/Fotos/` – Unterordner pro Raum (z. B. Wohnzimmer, Küche) für Schadens- und Messfotos
* `/Dokumente/` – Für Rechnungen, E-Mails und Pläne
* `Projektdaten.json` – Strukturierte JSON-Sicherung des Projekts
* `Schadensbericht_[Datum].pdf` – Der generierte PDF-Bericht

### Token-Verwaltung & Sync
* **MSAL.js**: Das Token wird sicher im `localStorage` des Browsers gecacht.
* **Auto-Login**: Beim Laden der Seite wird versucht, die Session im Hintergrund stillschweigend zu erneuern (`acquireTokenSilent`).
* **Offline-Support**: Wenn keine Internetverbindung besteht, werden Fotos in der lokalen **IndexedDB** zwischengespeichert und synchronisiert, sobald wieder Netz vorhanden ist.
