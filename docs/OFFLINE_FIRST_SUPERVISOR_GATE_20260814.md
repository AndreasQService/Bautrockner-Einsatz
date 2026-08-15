# QTool-Test Supervisor Gate – 2026-08-14

## Entscheid

**Noch keine Funktions- oder Live-Freigabe.** Die lokale Architektur- und
Contractstufe ist noch nicht gruen. Die Testmigration wurde nicht angewandt und der echte
Fall 1 gegen Test-Supabase, Test-Storage und OneDrive wurde nicht ausgefuehrt.
Quelltext-Regex, SQL-Textpruefungen und Browser-Mocks werden ausdruecklich nicht
als E2E-Nachweis gewertet.

## Evidence-Matrix

| Verbindlicher Schritt | Lokale Evidenz | Echtes Testsystem | Gate |
|---|---|---|---|
| Online laden und atomaren Lock erwerben | RPC-/SQL-Contracts; fail-closed Client | Migration und Zwei-Session-Lauf ausstehend | PARTIAL |
| Verifizierte lokale Sitzung, Banner und Counts | Unit-/Contracttests fuer Snapshot, Medien und Counts | echter Browser-/IndexedDB-Readback ausstehend | PARTIAL |
| Waehrend Sitzung nur lokal arbeiten | Supabase- und OneDrive-Transportgate; Auto-Worker blockiert | Netztrennung im Browser ausstehend | PARTIAL |
| Expliziter projektbezogener Abschluss-Sync | nicht-nestbarer Context, Projektfilter, Tokenheader | echter Queue-/Retry-Lauf ausstehend | PARTIAL |
| Supabase DB serverseitig owner-only | RLS-Entwurf bindet `auth.uid`, Projekt und Token | Migration nicht angewandt; bekannte RPC-/Edge-Function-Bypaesse; 20-Minuten-TTL widerspricht Offline-Sitzung | **BLOCKED** |
| Supabase Storage Readback, Bytes und SHA-256 | Handler-/Contractevidenz | echter Upload/Download ausstehend | PARTIAL |
| OneDrive Readback, Item-ID, ETag, Bytes und SHA-256 | Gate und Projektbackup-Verifikation im Code | Graph-/OneDrive-Teststamm-Lauf ausstehend | PARTIAL |
| `fully_confirmed`, Action, dann Release | Release steht nach bestaetigter View-Transition | Lokale Sitzung wird vor Navigation auf `fully_confirmed` gesetzt und gilt dann nicht mehr als aktiv; Fehlerpfad oeffnet Client-Gate vorzeitig | **BLOCKED** |
| Fremde Sessions lesen, aber schreiben nicht | SELECT bleibt; Mutation-RLS owner-only | Lauf mit zwei Testidentitaeten ausstehend | PARTIAL |
| Neue Projekte atomar erstellen und sperren | Server-RPC und Clientpfad lokal verdrahtet; Contracttests | Nicht gegen Test-Supabase/IndexedDB real erprobt | PARTIAL |

## Ausgefuehrte lokale Pruefungen

- Node Unit-/Contracttests mit `TZ=Europe/Zurich`: **306/306 bestanden**.
- Gezielte neue Gate-/SQL-/Offline-Tests (Director-Runde 4): **46/46 bestanden**.
- Build: **bestanden**, 2'577 Module.
- `git diff --check`: **bestanden**.
- Gezieltes ESLint fuer Offline-Code, Sperr-Hook, Supabase-Client und neue
  Gate-Tests: **nicht bestanden (29 Fehler)**. Ein Fehler liegt im Sperr-Hook;
  die weiteren liegen im bereits stark vorbelasteten Supabase-Testclient.
- Repository-weites ESLint: **nicht gruen**, 1'939 bestehende Probleme inklusive
  Backup- und historische Dateien; deshalb kein Release-Gate.
- Browser-Mockversuch: **nicht ausgefuehrt**, weil das installierte
  Playwright-Chromium-Binary fehlt. Das ist kein Testfehler und kein PASS.

## Hartes Gate fuer den echten Fall 1

`tests/fall1/real_fall1_guard.cjs` blockiert jede externe Mutation, solange nicht
alle folgenden Werte eindeutig gesetzt und an denselben Lauf gebunden sind:

- exakte Test-Supabase-Ref `aoxduqspiezzyqeqyzzl`, Live-Ref gesperrt,
- OneDrive-Stamm exakt `QTool_TEST_ONLY`,
- gueltige `QTOOL_RUN_ID`,
- Run-ID im Testprojekt, `TEST__`-Projektnummer,
- zwei getrennte Testidentitaeten,
- doppelte explizite Mutationsfreigabe fuer genau diese Run-ID,
- Remote-UI explizit an die Test-Projekt-Ref gebunden.

In der aktuellen Umgebung fehlen diese Werte. Deshalb wurden weder Supabase noch
Storage oder OneDrive mutiert und Live blieb unangetastet.

## Verbleibende Abschlussblocker

1. Testmigration kontrolliert auf Test-Supabase anwenden und Schema-/Policy-
   Installation per Katalogabfrage beweisen.
2. Die 20-Minuten-Server-TTL aus dem normalen Offline-Arbeitsablauf entfernen
   oder durch einen expliziten, fachlich freigegebenen Crash-Recovery-Prozess
   ersetzen. Kein Fremd-Takeover waehrend eine lokale Sitzung offen ist.
3. Storage-Policy-Migration auf QTool-Policies begrenzen. Der aktuelle
   DO-Block loescht sonst Schreib-Policies aller Buckets.
4. `/functions/v1` und alle privilegierten RPCs schliessen. Der Client-Gate
   erfasst derzeit nur REST/Storage; `delete-project`, `extract` und
   `onedrive-upload-worker` koennen ihn umgehen. Die RPC-Revoke-Liste umfasst
   die tatsaechlich verwendeten `fn_complete_and_create_todo` und
   `fn_complete_todo_and_archive_project` nicht.
5. Exit-Zustandsmaschine korrigieren: Bei fehlgeschlagener Navigation oder
   fehlgeschlagenem Release muss die Sitzung aktiv, wiederholbar und cloud-
   gesperrt bleiben. `fully_confirmed` darf das aktive Gate nicht vor Release
   abschalten.
6. Den Offline-Download vervollstaendigen. Der aktuelle Oeffnungspfad liest nur
   `damage_reports.report_data`; relationale Raeume/Messwerte/Protokolle,
   To-dos, Geraetezuordnungen, Dokumente und Upload-Journal werden nicht als
   Required-Artefakte geladen oder gegen Server-Counts/IDs geprueft. Medien mit
   reinem Storage-Pfad werden ebenfalls nicht heruntergeladen.
7. `SYSTEM_SETTINGS` aus der Projekt-RLS herausloesen. Die aktuelle globale
   `damage_reports`-Policy blockiert den bestehenden Benutzerverwaltungs-Upsert,
   weil fuer `SYSTEM_SETTINGS` keine Projektsperre existiert.
8. Playwright Browser installieren/bereitstellen.
9. Eindeutige Test-Run-ID, zwei Testidentitaeten, Testprojekt und OneDrive-
   Autorisierung bereitstellen.
10. Fall 1 komplett ausfuehren und Soll/Ist-Evidenz fuer DB, Storage, OneDrive,
   Counts, Hashes, Lock-Timeline, Exit und Fremdschreibabwehr ablegen.
