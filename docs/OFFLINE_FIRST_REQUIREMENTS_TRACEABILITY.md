# QTool-Test: Offline-First Requirements & Traceability Gate

Stand: 2026-08-13. Dieses Dokument ist das verbindliche Abnahme-Gate fuer die
aktuelle Implementierung. `PASS` darf nur mit automatisiertem Nachweis und
konkreter Code-Evidenz vergeben werden. Ein erfolgreicher Build ist kein
Funktionsnachweis. LIVE ist ausserhalb des Scopes.

## Verbindlicher End-to-End-Vertrag

```text
Benutzeraenderung
  -> komprimiert/normalisiert und atomar lokal in IndexedDB gesichert
  -> lokaler Readback inklusive Vollstaendigkeit/Hash/Zuordnung
  -> idempotenter Outbox-Auftrag
  -> Supabase DB und Storage geschrieben
  -> Supabase DB und Storage zurueckgelesen und fachlich verifiziert
  -> OneDrive geschrieben und zurueckgelesen/verifiziert
  -> Projektzustand fully_confirmed
  -> Benutzer verlaesst Projekt
  -> Supabase gibt Lock nur fuer passende Projekt-ID + Session-Token frei
```

`local_confirmed`, erfolgreicher HTTP-Request, Storage-Upload oder akzeptierter
OneDrive-Request duerfen weder `fully_confirmed` noch Projekt-Exit/Lock-Release
ausloesen.

## Statuslegende

- `PASS`: Implementierung und automatisierter Contract-/Funktionstest vorhanden.
- `PARTIAL`: Kern vorhanden, aber Vertrag oder Nachweis unvollstaendig.
- `FAIL`: aktueller Laufzeitpfad widerspricht der Anforderung.
- `OPEN`: noch nicht belastbar inventarisiert oder implementiert.

## A. Gemeinsamer Lifecycle aller Geschaeftsdaten

| ID | Datenart / Anforderung | Code-Evidenz | Test-Evidenz | Status / Gate |
|---|---|---|---|---|
| A01 | Projekttexte, Adressen, Kontakte lokal zuerst | `App.jsx`, `domainMutationAdapter.js` | ausstehend | PARTIAL |
| A02 | Raeume und relationale Raumdaten lokal zuerst | `DamageForm.jsx`, `MeasurementRelationalService.js` | ausstehend | PARTIAL |
| A03 | Messprotokolle mit und ohne Datei lokal zuerst | `formMediaAdapter.js`, `MeasurementRelationalService.js` | ausstehend | PARTIAL |
| A04 | Messwerte/Messbilder lokal zuerst | `DamageForm.jsx`, `formMediaAdapter.js` | ausstehend | PARTIAL |
| A05 | Geraete erfassen, zuordnen, abmelden, rueckgaengig lokal zuerst | `DamageForm.jsx`, `DeviceManager.jsx`, `DryingManager.jsx` | ausstehend | PARTIAL |
| A06 | To-dos erstellen/aendern/abschliessen/loeschen und Folge-To-dos lokal zuerst | `TodoService.js` | ausstehend | PARTIAL |
| A07 | Status/History/Archivieren/Wiederherstellen lokal zuerst | `statusActions.js`, `Dashboard.jsx` | ausstehend | PARTIAL |
| A08 | Loeschung als dauerhafter Tombstone, idempotent, Readback beweist Abwesenheit | `App.jsx`, `supabaseDomainHandlers.js` | ausstehend | PARTIAL; direkter Fallbackpfad bleibt |
| A09 | Sorba-Projektnummer lokal zuerst; Webhook-Akzeptanz ist keine Endbestaetigung | `SorbaSyncService.js`, `supabaseDomainHandlers.js` | ausstehend | PARTIAL |
| A10 | Kein Geschaeftspfad darf direkt an zentraler Outbox vorbei nach Supabase schreiben | `OFFLINE_WRITE_COVERAGE.md` | statische Inventur ausstehend zu erneuern | FAIL; Kompatibilitaets-/Fallbackpfade vorhanden |

## B. Lokale Dauerhaftigkeit, Idempotenz und Neustart

| ID | Anforderung | Code-Evidenz | Test-Evidenz | Status / Gate |
|---|---|---|---|---|
| B01 | Snapshot, Blobs, Manifest und Outbox atomar in einer strict IndexedDB-Transaktion | `transactionStore.js:createOfflineTransaction` | Contracttest ausstehend | PARTIAL |
| B02 | Lokaler Readback prueft Projekt-ID, Revision, Vollstaendigkeit und alle referenzierten Blobs | `transactionStore.js` | ausstehend | FAIL; Commit wird nicht vollstaendig zurueckgelesen |
| B03 | Stabile Operation-ID/Idempotency-Key ueber Retry und Neustart | `transactionStore.js`, `outboxWorker.js` | ausstehend | PARTIAL |
| B04 | Worker startet bei App-Start, online, Vordergrund und periodisch | `outboxWorker.js` | ausstehend | PARTIAL |
| B05 | Abgelaufene Upload-Lease wird nach Absturz erneut beansprucht | `claimPendingOperations` | ausstehend | PARTIAL |
| B06 | Retry erzeugt niemals neue Business-Datensaetze/Bilder/To-dos | Domain-/Media-Handler | pro Datenart ausstehend | OPEN |
| B07 | Konflikt ueberschreibt nie still einen neueren Cloudstand | `OutboxConflictError`, Versionsfelder | echte Server-Contracttests ausstehend | PARTIAL |
| B08 | Unbestaetigte Daten/Blobs werden niemals automatisch geloescht | `pruneConfirmedOfflineData` | ausstehend | PARTIAL |

## C. Medien- und Speichervertrag

| ID | Anforderung | Code-Evidenz | Test-Evidenz | Status / Gate |
|---|---|---|---|---|
| C01 | Alle Bildarten nutzen genau einen zentralen Laufzeitpfad | Worker-Aenderung ausstehend | ausstehend | FAIL; Legacy-PhotoStorage/Queue parallel aktiv |
| C02 | Original wird vor dauerhafter Ablage ausgerichtet und komprimiert | `imagePipeline.js` inkl. HEIC-Konvertierung | Regex-Contract gruen; Browserbildtest ausstehend | PARTIAL |
| C03 | Nur komprimierter Arbeitsblob wird genau einmal dauerhaft gespeichert | `formMediaAdapter.js` | Regex-Contract gruen; messbare IDB-Blobanzahl ausstehend | PARTIAL |
| C04 | Original bleibt nur temporaer bis Dekodierung, Groesse, Hash, IndexedDB-Readback und Zuordnung bestaetigt sind | `imagePipeline.js`, `formMediaAdapter.js` | echter Browser-IDB-Test ausstehend | PARTIAL |
| C05 | Schadens-, Mail-, Aussen-, Mess- und bearbeitete Bilder folgen identischem Vertrag | aktive Form-/Uploadpfade umgestellt | pro Bildart Browser-E2E ausstehend | PARTIAL |
| C06 | Deterministischer Storage-Pfad und idempotenter Upsert | `formMediaAdapter.js`, `supabaseMediaHandlers.js` | ausstehend | PARTIAL |
| C07 | Storage-Download prueft immer Dateigroesse und SHA-256 | `supabaseMediaHandlers.js` | Regex-Contract gruen; echter Test-Storage-Readback ausstehend | PARTIAL |
| C08 | DB-Readback beweist Projekt-/Raum-/Messungszuordnung und Metadaten | `supabaseMediaHandlers.js` | ausstehend | PARTIAL |
| C09 | Upload allein setzt keinen bestaetigten Status | `runCloudAfterLocal`, Outbox-Handler | ausstehend | PARTIAL |
| C10 | Speicheranzeige/Quota-Warnung und niemals automatische Loeschung unbestaetigter Medien | nicht gefunden | ausstehend | OPEN |

## D. Supabase-, Storage- und OneDrive-Endbestaetigung

| ID | Anforderung | Code-Evidenz | Test-Evidenz | Status / Gate |
|---|---|---|---|---|
| D01 | Supabase-Mutation wird erst nach fachlichem DB-Readback bestaetigt | Domain-Handler | pro Handler ausstehend | PARTIAL |
| D02 | Storage wird erst nach Download, Groesse, Hash und Zuordnung bestaetigt | Media-Handler | statischer Contract gruen; Test-Storage ausstehend | PARTIAL |
| D03 | OneDrive-Upload ist durable Downstream-Operation desselben Projektabschlusses | Media-Handler wartet auf Journal + Graph-Readback; Legacy-Backfill bleibt aktiv | E2E ausstehend | PARTIAL; Doppelpfad noch zu klaeren |
| D04 | OneDrive-Endreadback beweist Item-ID, ETag, Groesse/Hash, Projektpfad und erforderliche Dateien/PDF | Graph-/Upload-Code | ausstehend | OPEN |
| D05 | `fully_confirmed` nur wenn keine projektbezogene Operation offen/failed/conflict ist und D01-D04 belegt sind | kein eigener Zustand/Projekt-Gate gefunden | ausstehend | FAIL |
| D06 | Statusanzeige trennt lokal, Supabase, Storage, OneDrive, Konflikt und Fehler ehrlich | UI teilweise vorhanden | ausstehend | FAIL; vorhandene Badges sind nicht Gesamt-Gate |

## E. Projekt-Exit und Lock

| ID | Anforderung | Code-Evidenz | Test-Evidenz | Status / Gate |
|---|---|---|---|---|
| E01 | Projekt-Exit blockiert bis `fully_confirmed` | strenger `runGuardedNavigation` vorhanden | Contracttest derzeit rot; Browser-E2E ausstehend | PARTIAL |
| E02 | Dashboard, Zurueck, Projektwechsel, Moduswechsel und andere interne Navigation nutzen dasselbe Gate | `navigationGuardRef` teilweise | pro Navigation ausstehend | PARTIAL |
| E03 | Browser Back/Reload/Tabclose warnt/blockiert solange nicht `fully_confirmed` | `beforeunload` warnt bei offenem Projekt | Contract gruen; echtes Browserverhalten ausstehend | PARTIAL |
| E04 | Lock bleibt waehrend Supabase/Storage/OneDrive Pending/Failed/Conflict erhalten | Cleanup/Inaktivitaet geben nicht mehr direkt frei | Contract gruen; TTL/E2E ausstehend | PARTIAL |
| E05 | Lock wird erst nach voll bestaetigtem Zustand und tatsaechlichem Exit freigegeben | Guard ruft Action vor Token-Release auf | Contract gruen; Fehlerfall/E2E ausstehend | PARTIAL |
| E06 | Release nur durch passenden `project_id + session_token` | `release_project_lock` RPC + Migration | SQL-Contract vorhanden | PARTIAL; Test-DB-Migration/Funktionstest ausstehend |
| E07 | Ein Projekt hat atomar genau einen Owner; alle fremden Sessions sind serverseitig read-only | Migration/RPC setzt nur Lease-Invariante; bestehende Tabellen-/Storage-Policies erlauben weiterhin jedem authentifizierten User Writes | SQL-Contract beweist nur Lockzeile | FAIL; serverseitige Owner-Pruefung fehlt |
| E08 | Fremde Autosaves, alte Tabs und Offline-Outbox-Auftraege werden serverseitig abgelehnt | Business-RPC/RLS fehlt; Mutationen uebergeben keinen Owner-Token | statische Runtime-/Policy-Inventur | FAIL |
| E09 | iPad-Prioritaet ist atomar und darf keinen ungesicherten Desktopstand vernichten | Migration/RPC + Konfliktablage | ausstehend | OPEN |
| E10 | Absturz/Netzausfall: Lock-TTL kontrolliert; Wiederaufnahme durch Originalsession ohne Datenverlust | Lock/Outbox | ausstehend | PARTIAL |

## F. Offline-Verfuegbarkeit und lokale Bereinigung

**ARCHITEKTUR-PAUSE:** F01-F06 werden bis zur Nutzerentscheidung weder als
verbindliche Download-/Cache-Policy implementiert noch freigegeben. Das betrifft
automatische Projektdownloads, Offline-Pakete, Auswahl lokaler Projekte und die
automatische Bereinigung abgeschlossener Projekte. Bereits vorhandene Prune-
Mechanismen duerfen nicht automatisch aktiviert werden. Unbestaetigte Outbox-
Daten und Medien bleiben unabhaengig davon zwingend geschuetzt.

| ID | Anforderung | Code-Evidenz | Test-Evidenz | Status / Gate |
|---|---|---|---|---|
| F01 | Aktive zugewiesene Projekte sind inklusive aller benoetigten Medien/Messdaten offline verfuegbar | Download-/Cacheprofil nicht nachgewiesen | ausstehend | PAUSED - Nutzerentscheidung |
| F02 | Offline neu geoeffnet: lokale Bearbeitung moeglich, aber keine erfundene zentrale Sperre/Cloudbestaetigung | Lock fail-closed + Outbox | ausstehend | PAUSED - Nutzerentscheidung zum Offline-Paket |
| F03 | Bei Wiederverbindung zuerst Lock und Version pruefen, dann Outbox synchronisieren | Orchestrierung nicht nachgewiesen | ausstehend | PAUSED fuer offline neu geoeffnete Projekte |
| F04 | Abgeschlossene Projekte bleiben nur bis Ende Sicherheitsfrist lokal | `pruneConfirmedOfflineData` | ausstehend | PAUSED; automatische Aktivierung verboten |
| F05 | Nur voll bestaetigte abgeschlossene Projekte werden lokal entfernt | `pruneConfirmedOfflineData` | ausstehend | PAUSED; Policy noch nicht beschlossen |
| F06 | Kleiner Online-Index abgeschlossener Projekte darf lokal bleiben | nicht nachgewiesen | ausstehend | PAUSED - Nutzerentscheidung |

## G. Director-Abnahme

Freigabe ist nur moeglich, wenn:

1. A01-A10 fuer alle aktiven Laufzeitpfade `PASS` sind.
2. B01-B08 mit Neustart-/Retry-/Konflikttests `PASS` sind.
3. C01-C10 fuer jede Bildart `PASS` sind.
4. D01-D06 inklusive echter OneDrive-Endbestaetigung `PASS` sind.
5. E01-E10 mit zwei Browsern/Geraeten und serverseitiger Schreibabwehr `PASS` sind.
6. F01-F06 erst nach Aufhebung der Architektur-Pause bewertet werden; bis dahin
   keine automatische Download-/Prune-Policy Teil dieses Releases ist.
7. Build, Lint, `diff --check`, Contracttests und normale Browserablaeufe gruen sind.
8. Kein Test und keine Migration LIVE beruehrt.

## H. Verbindlicher End-to-End-Abnahmefall 1

Dieser Fall ist ein Muss-Test und darf nicht durch Mocks als bestanden gemeldet
werden. Er laeuft ausschliesslich gegen QTool-Test, Test-Supabase und den
freigegebenen OneDrive-Teststamm.

### Ablauf

1. Bei guter Verbindung ein aktives Testprojekt vollstaendig laden.
2. Supabase-Lock atomar erwerben; Lock-Owner mit Projekt-ID, Benutzer-ID,
   Geraete-ID und Session-Token protokollieren.
3. Zweitsession oeffnet dasselbe Projekt und wird serverseitig fuer alle
   Geschaeftsmutationen abgewiesen (Lesen bleibt moeglich).
4. Internet des iPad-Kontexts vollstaendig trennen.
5. Offline in demselben Projekt mindestens je eine Aenderung erfassen:
   - Text und Adresse
   - Raum
   - Messprotokoll und Messwerte
   - Schadens-/Messbild
   - Bildbearbeitung (sichtbarer Kreis)
   - inventarisiertes oder neues Baustellengeraet erfassen
   - Geraet abmelden
6. Nach jeder Aktion lokalen durable Commit und Readback nachweisen.
7. Dashboard, Zurueck, Projektwechsel, Reload/Close versuchen: Projekt-Exit muss
   blockiert bzw. Browserwarnung aktiv sein; Lock bleibt auf Originalsession.
8. Verbindung wiederherstellen; ohne neue Benutzeraktion muss die bestehende
   Outbox anlaufen.
9. Supabase DB-Readback, Storage-Download/Hash und danach OneDrive-Endreadback
   fuer alle betroffenen Artefakte durchfuehren.
10. Erst bei vollstaendiger Evidenz `fully_confirmed` und UI
    `Erfolgreich gespeichert` setzen; Outbox des Projekts muss 0 sein.
11. Projekt tatsaechlich schliessen; erst danach Lock mit exakt demselben
    Projekt-ID/Session-Token-Paar freigeben.
12. Zweitsession erwirbt anschliessend den Lock und kann genau eine verifizierte
    Mutation schreiben.

### Pflicht-Evidenz (Soll/Ist)

| Evidenz | Soll | Ist / Artefakt |
|---|---|---|
| Run-ID und Testprojekt-ID | eindeutig, nur Test | ausstehend |
| Benutzer-/Geraete-/Session-IDs beider Sessions | vollstaendig protokolliert | ausstehend |
| Lock-Timeline | acquire -> offline gehalten -> fully_confirmed -> Exit -> release -> acquire Zweitsession | ausstehend |
| Ausgangs- und Endversion | Endversion monoton und exakt erwartet | ausstehend |
| Lokale Transaction-/Operation-/Entity-IDs | stabil ueber Offline, Neustart und Retry | ausstehend |
| Lokale Counts je Datenart | Soll = Ist nach IndexedDB-Readback | ausstehend |
| Outbox-Counts/Status-Timeline | pending waehrend offline; am Ende projektbezogen 0 | ausstehend |
| Supabase Tabellen-IDs/Counts/Feldwerte | Soll = DB-Readback Ist | ausstehend |
| Storage Pfade, Bytes und SHA-256 je Datei | Soll = Download-Readback Ist | ausstehend |
| OneDrive Item-ID, ETag, Pfad, Bytes und SHA-256 je Pflichtdatei/PDF | Soll = Endreadback Ist | ausstehend |
| Bildbearbeitung | Kreis nach Reload/Cloudreadback sichtbar; Hash dokumentiert | ausstehend |
| Geraete-Lifecycle | genau eine Erfassung und eine Abmeldung, keine Dublette | ausstehend |
| Fremdschreibversuche | alle vor Release serverseitig abgewiesen | ausstehend |
| Exitversuche vor Endbestaetigung | alle blockiert/gewarnt | ausstehend |
| Releasezeitpunkt | strikt nach `fully_confirmed` und tatsaechlichem Exit | ausstehend |

### Bestehender Ist-Stand

Der Abnahmefall ist derzeit **NICHT LAUFFAEHIG**, weil Exit bereits bei
`local_confirmed` erlaubt wird, OneDrive nicht Teil des zentralen
Projektabschlusses ist und `fully_confirmed` als nachweisbarer Gesamtzustand
fehlt. Einzeltests duerfen diese End-to-End-Luecke nicht verdecken.

## Aktuelle Supervisor-Entscheidung

**NICHT FREIGEGEBEN.** Die Architekturgrundlage und erste statische Contracts
sind vorhanden. Browser-IDB/HEIC, echter Supabase-/Storage-/OneDrive-Endreadback,
vollstaendiges `fully_confirmed`, serverseitige Schreibabwehr aller Geschaeftswege
und Abnahmefall H sind nicht bewiesen. F01-F06 sind bewusst pausiert.
