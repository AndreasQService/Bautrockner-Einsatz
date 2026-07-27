# QTool Refactoring – Phase 35

## Rahmen

- Arbeitsverzeichnis: `C:\QTool_Test`
- Branch: `refactor/qtool-phase-1`
- Ausgangscommit: `4a8020b327010b7e125d3522d3c565eea65e75fe`

## Ausgelagerte Utility

`formatActiveEquipmentRuntime(startDateStr, referenceDate)` in `src/utils/dashboardUtils.js` übernimmt ausschließlich die in Phase 34 charakterisierte aktive Laufzeitberechnung. Beide Parameter werden mit `new Date(...)` in interne Date-Instanzen kopiert; übergebene Date-Objekte werden nicht mutiert.

Die bisherige lokale aktive Logik in `getDaysRunning` erzeugte Start und aktuellen Zeitpunkt, normalisierte beide auf lokale Mitternacht, teilte die Differenz durch 86.400.000, rundete mit `Math.ceil` auf und begrenzte negative Werte auf null. Diese Rechenschritte und das Format `<Tage> d` sind in der Utility unverändert.

## Neue Aufrufstelle

Nach dem unveränderten abgeschlossenen Pfad ruft `Dashboard.jsx` nun `formatActiveEquipmentRuntime(startDateStr, new Date())` auf. Der aktuelle Zeitpunkt wird weiterhin unmittelbar an derselben Aufrufstelle lokal mit `new Date()` erzeugt und als expliziter `referenceDate` übergeben. Es wurden weder `Date.now()` noch Timer oder automatische Aktualisierung eingeführt.

## Fallbacks, Zeitzone und DST

Fehlende, leere, `null`-, `undefined`- oder ungültige Startwerte ergeben weiterhin `-`. Ein ungültiger Referenzwert ergibt ebenfalls `-`. Zukünftige Startdaten ergeben weiterhin `0 d`.

Die Normalisierung verwendet weiterhin lokale Mitternacht. Damit bleibt die Abhängigkeit von lokaler Zeitzone und Sommerzeit vollständig erhalten: In `Europe/Zurich` ergibt der 23-Stunden-Frühlingswechsel `1 d`, während der 25-Stunden-Herbstwechsel durch `Math.ceil` auf `2 d` aufrundet.

## Tests und Mutation

Alle 16 Phase-34-Fälle bleiben bestehen. Die 15 tabellarischen Fälle vergleichen die neue Produktionsfunktion direkt mit der unveränderten lokalen Referenz. Der Mutationstest ruft die Produktionsfunktion direkt auf und bestätigt unveränderte Start- und Referenz-Date-Objekte.

- Phase-34-Test zweimal: erfolgreich
- sämtliche Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- gezieltes ESLint: keine neuen Befunde
- `git diff --check`: ohne Befund

## Unveränderte Bereiche und Risiken

Der abgeschlossene Laufzeitpfad mit `formatCompletedEquipmentRuntime` ist unverändert. Ebenso unverändert bleiben State, Hooks, Effects, Handler, Timer, Gerätezeilen, Sortierung, Filterung, Klickverhalten, Supabase, Speicherlogik, Abhängigkeiten und Paketdateien.

Das verbleibende Risiko beschränkt sich auf die Import- und Aufrufverdrahtung. Die direkten Vorher-/Nachher-Vergleiche, der Build und die Gesamtsuite sichern die identischen Rückgabewerte ab. Als manuelle Prüfung wird ein aktives Gerät am selben Tag, über einen normalen Tageswechsel sowie am Herbst-DST-Wechsel empfohlen.
