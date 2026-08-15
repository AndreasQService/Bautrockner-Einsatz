# Drei-Projekt-UI-Prüfung (nur QTool-Test)

Der Lauf verwendet ausschließlich einen kurzlebigen, zuvor erzeugten Playwright-Storage-State. Benutzername oder Passwort werden weder im Code noch in der URL hinterlegt. Der State enthält Sitzungstoken und muss deshalb außerhalb des Repositorys mit Dateirechten `0600` liegen und nach dem Lauf gelöscht bzw. serverseitig widerrufen werden.

Pflichtwerte:

- `QTOOL_UI_STORAGE_STATE`: absoluter Pfad außerhalb des Repositorys zum angemeldeten Storage-State der Testumgebung (Dateirechte `0600`)
- `QTOOL_UI_PROJECTS`: exakt drei eindeutige, kommagetrennte Projektbezeichnungen mit `TEST__`
- `QTOOL_REAL_UI_EXECUTE=YES_TEST_ONLY`: bewusstes Mutations-/Ausführungsgate

Aufruf:

```bash
QTOOL_UI_STORAGE_STATE=/sicherer/pfad/qtool-test.json \
QTOOL_UI_PROJECTS='TEST__UI_01,TEST__UI_02,TEST__UI_03' \
QTOOL_REAL_UI_EXECUTE=YES_TEST_ONLY \
npx playwright test --config=playwright.real-ui.config.js
```

Der Test blockiert Live-Supabase bereits vor dem Netzwerk und bricht hart ab, wenn die Seite nicht `qtool-test.vercel.app` ist, nicht als Testumgebung markiert ist, ein Projekt nicht eindeutig gefunden wird, die Offline-Bestätigung fehlt oder Supabase/OneDrive beim Verlassen nicht beide `OK` melden. Tracing bleibt deaktiviert, weil Traces Auth-Header oder lokalen Sitzungsspeicher enthalten können.
