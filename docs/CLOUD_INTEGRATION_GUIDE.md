# Systemdokumentation: Cloud-Infrastruktur & Synchronisation (Supabase, Vercel, OneDrive)

Dieses Dokument dokumentiert die gesamte Architektur, das Zusammenspiel und die Konfiguration der drei Kern-Cloud-Dienste des QTools für die Zukunft.

---

## 1. Architektur-Übersicht & Datenfluss

Das QTool verwendet eine hybride Speicherarchitektur, um Offline-Fähigkeit auf der Baustelle mit zentraler Datenhaltung im Büro zu kombinieren.

```
                  +-----------------------------------+
                  |        Vercel (Frontend)          |
                  |  Hosting der React/Vite-App &     |
                  |  Serverless Functions (Proxy API) |
                  +-------------------+-----------+---+
                                      |           |
             Strukturierte Daten      |           |  Bilder, PDFs &
             (JSON, Status, Logs)     |           |  Backup-Dateien
                                      v           v
                          +-----------+---+   +---+-----------+
                          |   Supabase    |   |   OneDrive    |
                          |  PostgreSQL-  |   |  (Microsoft   |
                          |  Datenbank    |   |  Graph API)   |
                          +---------------+   +---------------+
```

### Die Rollen der einzelnen Dienste:
1. **Vercel**: Hostet das React-Frontend (Vite) und stellt Serverless Functions (z. B. Google Maps Proxy unter `/api/google-staticmap.js`) bereit.
2. **Supabase**: Dient als relationale Datenbank (PostgreSQL) für strukturierte Projektdaten (Projekte, Raummessungen, Trocknungsgeräte, App-Sessions und Sperr-Mechanismen).
3. **OneDrive (Microsoft Graph)**: Primärer Speicherort für binäre Medien (Schadensfotos, Pläne) sowie generierte Dokumente (Schadensberichte als PDF, Excel-Messprotokolle) und automatische Projekt-Backups im JSON-Format.
4. **IndexedDB (Lokal)**: Dient als Puffer auf dem Endgerät (iPad/Desktop). Änderungen und Fotos werden offline lokal gespeichert und im Hintergrund synchronisiert, sobald wieder eine Internetverbindung besteht.

---

## 2. Supabase-Konfiguration & Datenbank-Schema

Die Anbindung erfolgt über den Supabase JS Client (`src/supabaseClient.js`).

### Relevante Tabellen:
*   **`reports`**: Enthält die strukturierten Projektdaten im JSONB-Format.
    ```sql
    CREATE TABLE reports (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      content JSONB NOT NULL
    );
    ```
*   **`project_sessions`**: Steuert die Sperrung von Projekten, damit nicht zwei Benutzer dasselbe Projekt gleichzeitig bearbeiten (Vermeidung von Merge-Konflikten).

### Row Level Security (RLS) & Berechtigungen:
*   Für die Tabellen muss sichergestellt sein, dass der anonyme Zugriff (`anon`) Lese- und Schreibrechte besitzt, sofern kein Benutzer-Login-System erzwungen wird.
*   **Befehl zur Deaktivierung der RLS (in Testphasen):**
    ```sql
    ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
    ```

---

## 3. Vercel Deployment & Umgebungsvariablen

Vercel baut die App automatisch bei Updates. Da Passwörter und API-Keys aus Sicherheitsgründen nicht im Git-Repository gespeichert werden dürfen, müssen diese im Vercel-Dashboard hinterlegt sein.

### Erforderliche Umgebungsvariablen auf Vercel:

| Variable | Beschreibung | Beispielwert |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | API-URL deiner Supabase-Instanz | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Öffentlicher Anon-Key von Supabase | `eyJhbGciOiJIUzI...` |
| `VITE_MSAL_CLIENT_ID` | Microsoft Azure App-Registrierungs-ID (Client-ID) | `392ec3b0-d597-4fed-b9d7...` |
| `VITE_MSAL_TENANT_ID` | Microsoft Mandanten-ID (`common` für persönliche + geschäftliche Konten) | `common` oder spezifische ID |
| `VITE_GOOGLE_MAPS_API_KEY` | API-Key für Google Maps Integration (Karten im PDF) | `AIzaSy...` |
| `VITE_OPENAI_API_KEY` | API-Key für Diktat/Whisper-Transkription | `sk-proj-...` |
| `VITE_CLOUD_FIRST_IMAGES` | Steuert, ob Bilder direkt in OneDrive hochgeladen werden | `true` |

---

## 4. OneDrive & MSAL.js Integration

Die Anbindung an OneDrive erfolgt clientseitig über das **MSAL.js v3 SDK** (`@azure/msal-browser`) und die **Microsoft Graph API**.

### Authentifizierungsfluss (`src/lib/onedrive/auth.js`):
1. **Stiller Login**: Beim App-Start prüft `acquireTokenSilent()`, ob ein gültiges Token im `localStorage` gecacht ist.
2. **Interaktiver Login**: Schlägt der stille Login fehl (z. B. nach Ablauf des Refresh-Tokens), wird über einen interaktiven Button ein Microsoft-Login-Popup geöffnet (`connectOneDrive()`).
3. **Scopes**: Die App fordert folgende Berechtigungen an:
   * `User.Read`
   * `Files.ReadWrite.All`
   * `offline_access`

### Ordnerstruktur auf OneDrive:
Jedes Projekt erhält einen eindeutigen Ordner unter dem Hauptverzeichnis `/QTool/`:
`QTool/[Projektnummer]_[Strasse]_[Ort]/`

*   **`/Fotos/[RaumName]/`**: Enthält die Schadensbilder (benannt nach dem Schema `[Projektnummer]_[RaumName]_[Index].jpg`).
*   **`/Dokumente/`**: Enthält die generierten PDF-Berichte (`Schadensbericht_YYYY-MM-DD.pdf`) sowie hochgeladene Pläne, Lieferantenrechnungen und E-Mails.
*   **`Projektdaten.json`**: Ein JSON-Export aller strukturierten Daten des Projekts (ohne Base64-Bilder, um Speicherplatz zu sparen).

---

## 5. Wartung & Troubleshooting

### Fehler: Seite bleibt weiß / Daten laden nicht
*   **Ursache**: Fehlende Umgebungsvariablen auf Vercel oder falsche Supabase RLS-Richtlinien.
*   **Lösung**: Überprüfe das Vercel-Dashboard -> Settings -> Environment Variables. Wenn Änderungen vorgenommen wurden, muss unter *Deployments* ein neues Deployment (Redeploy) ausgelöst werden.

### Fehler: OneDrive-Bilder laden nicht (Token-Ablauf)
*   **Ursache**: Der Benutzer wurde im Browser abgemeldet oder das Refresh-Token ist ungültig geworden.
*   **Lösung**: Den "OneDrive verbinden"-Button in der Navigationsleiste des QTools anklicken und die Microsoft-Anmeldung erneut durchführen.

### Fehler: "403 Forbidden" bei Supabase-Aktionen
*   **Ursache**: Die PostgreSQL-RLS sperrt den Schreibzugriff für nicht authentifizierte Benutzer.
*   **Lösung**: SQL-Editor in Supabase öffnen und Berechtigungen der Tabelle prüfen (`GRANT ALL ON reports TO anon`).
