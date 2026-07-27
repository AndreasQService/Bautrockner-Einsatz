# QTool Refactoring – Phase 20

## Umfang

- Ausgangscommit: 497e372
- Untersuchter Bereich: `DryingMonitor` in `src/components/Dashboard.jsx`
- Charakterisiert: lokale Auswahl des Trocknungs-Startdatums
- Produktionscode: unverändert

## Charakterisierung

Die Tests fixieren Vorrang und Fallbacks der vorhandenen Ableitung: `dryingStarted` hat Vorrang, danach wird das lexikografisch früheste vorhandene `equipment[].startDate` gewählt, zuletzt `report.date`. Fehlende, leere, `null`- und `undefined`-Gerätedaten sowie die unveränderte Eingabe werden geprüft.

## Reinheit

Die Ableitung liest ausschließlich das übergebene Report-Objekt. Sie verwendet weder State, Hooks, aktuelle Zeit, DOM, Netzwerk, Supabase noch Storage. Das durch `map` erzeugte Datumsarray wird sortiert; Report und Equipment werden nicht mutiert.

## Nicht veränderte Bereiche

Keine Produktionsdatei und insbesondere keine interaktive Logik, Handler, State-, Effect-, Messwert-, Laufzeit-, Supabase- oder Speicherlogik wurde verändert.

## Prüfungen

- gezielter Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- `npm run test:guard`: erfolgreich
- `npm run build`: erfolgreich
- gezieltes ESLint: ohne neuen Befund
- `git diff --check`: ohne Befund

## Risiko und nächste Prüfung

Dieses Paket ändert kein Laufzeitverhalten. Die charakterisierte Ableitung kann in einem separaten Folgepaket unverändert nach `src/utils/dashboardUtils.js` ausgelagert und gegen diese Referenz verglichen werden.
