# Realer Abnahmefall 1

Dieser Ordner ist ausschliesslich fuer den echten Integrationslauf gegen
QTool-Test bestimmt. Contracttests, Quelltext-Regex und Browser-Mocks sind keine
E2E-Evidenz und duerfen den Fall 1 nicht auf `PASS` setzen.

Vor jeder externen Mutation muss `authorizeRealFall1()` erfolgreich sein. Das
Gate verlangt gleichzeitig:

- exakte Test-Supabase-Ref `aoxduqspiezzyqeqyzzl` und sperrt die Live-Ref,
- OneDrive-Stamm `QTool_TEST_ONLY`,
- gueltige, eindeutige `QTOOL_RUN_ID`,
- eine Projekt-ID, welche die komplette Run-ID enthaelt,
- eine Projektnummer mit `TEST__`, welche ebenfalls die komplette Run-ID enthaelt,
- zwei getrennte Testidentitaeten,
- `QTOOL_FALL1_EXECUTE` exakt gleich der Run-ID,
- `QTOOL_FALL1_ACK=TEST-ONLY-MUTATIONS-AUTHORIZED`,
- bei einer entfernten UI eine explizite Bindung an die Test-Projekt-Ref.
- OneDrive-Metadaten muessen `parentReference.driveId` exakt gleich der
  freigegebenen Worker-Drive-ID ausweisen; `me/drive` ist verboten.

Ohne diese Werte wird nichts extern geschrieben. Der eigentliche Fall-1-Runner
muss fuer jeden Schritt maschinenlesbare Evidenz mit `createEvidenceRecorder()`
ablegen. Ein Lauf ist erst bestanden, wenn die vollstaendige Soll/Ist-Matrix aus
`docs/OFFLINE_FIRST_REQUIREMENTS_TRACEABILITY.md` belegt ist.

## Runner

`real_fall1_runner.cjs` ist absichtlich kein normaler Playwright-Test. Er kann
nur mit `node tests/fall1/real_fall1_runner.cjs --execute` gestartet werden.
Zusaetzlich muessen alle oben genannten Variablen und eine run-gebundene
Szenariodatei (`QTOOL_FALL1_SCENARIO`) vorhanden sein. Diese Datei enthaelt
explizite Browseraktionen (Selektor, Aktion, Sollwert), damit ein geaendertes UI
nicht durch unscharfe oder ausweichende Selektoren versehentlich als PASS gilt.

Der Runner erzeugt Evidenz fuer Guard, zwei getrennte Identitaeten, Lock und
Read-only-Zweitgeraet, lokale IndexedDB-Bestaende vor/nach Offline-Aenderungen,
Netzunterbruch, expliziten End-Sync, relationale Supabase-Readbacks und die erst
nach Navigation aufgehobene Sperre. Fehlende Browser, Credentials, Selektoren
oder Nachweise brechen den Lauf hart ab; sie werden nie als E2E-PASS gewertet.
Vor `fall1_complete: PASS` validiert ein zentrales Abschluss-Gate Reihenfolge,
Vollstaendigkeit, Tabellenzahl, Medienzahl, beide SHA-256-Werte sowie die Drive-ID
aus dem tatsaechlich zurueckgelesenen OneDrive-Objekt.

Die ausfuehrbare Vorbereitungs-, Migrations-, Rollback- und PASS-Checkliste
steht in `docs/TEST_FALL1_EXECUTABLE_CHECKLIST.md`.
