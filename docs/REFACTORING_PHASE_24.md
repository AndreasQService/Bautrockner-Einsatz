# QTool Refactoring – Phase 24

## Umfang

- Ausgangscommit: `2eafd1e`
- Untersuchte lokale Funktion: `getDaysRunning(startDateStr, endDateStr)` in `DeviceInventoryList`
- Charakterisiert wurden ausschließlich abgeschlossene Zeiträume mit festem, truthy `endDateStr`.
- Produktionscode: unverändert

## Parameter und Datumsfelder

Die Funktion besitzt die Parameter `startDateStr` und `endDateStr`. Es gibt keine Priorität mehrerer Startdatumsfelder: Ausschließlich `startDateStr` wird als Beginn verwendet. In den charakterisierten Fällen wird ausschließlich das ausdrücklich übergebene `endDateStr` als Ende verwendet.

## Charakterisiertes Verhalten

Fehlendes, leeres, `null`- oder `undefined`-Startdatum ergibt `-`. Nicht parsebare Start- oder feste Enddaten ergeben ebenfalls `-`. Gültige Werte werden in neue `Date`-Objekte umgewandelt und mit `setHours(0, 0, 0, 0)` auf lokale Mitternacht normalisiert. Uhrzeiten innerhalb desselben lokalen Kalendertags ergeben daher `0 d`.

Die Differenz wird durch 86.400.000 Millisekunden geteilt und mit `Math.ceil` aufgerundet. Negative Ergebnisse bei einem Enddatum vor dem Startdatum werden durch `Math.max(0, ...)` auf `0 d` begrenzt. Monats-, Jahres- und Schaltjahrwechsel folgen demselben Verfahren.

## Zeitzonenabhängigkeit

Parsing und Normalisierung verwenden die lokale Zeitzone. ISO-Zeitstempel mit Offset können dadurch einem anderen lokalen Kalendertag zugeordnet werden. Außerdem können Sommerzeitwechsel dazu führen, dass die Millisekundendifferenz zwischen lokalen Mitternachten nicht exakt 24 Stunden beträgt; das bestehende `Math.ceil`-Verhalten bleibt unverändert charakterisiert. Diese Phase führt keine Zeitzonenbereinigung ein.

## Tests und Mutation

Die 15 Tests decken gleichen Tag, einen und mehrere Tage, Monats- und Jahreswechsel, Schaltjahr, Uhrzeiten, umgekehrte Daten, ungültige Werte, leere beziehungsweise fehlende Startwerte und Nichtmutation ab. Der Mutationstest übergibt echte `Date`-Objekte und bestätigt, dass deren Zeitwerte unverändert bleiben; mutiert werden nur intern erzeugte Kopien.

Fälle ohne festes `endDateStr` werden ausdrücklich nicht ausgeführt, damit weder `new Date()` als aktueller Zeitpunkt noch die laufende Gerätedauer Teil dieser Charakterisierung sind.

## Nicht veränderte Bereiche

`Dashboard.jsx`, `dashboardUtils.js` und sämtlicher sonstiger Produktionscode bleiben unverändert. State, Effects, Hooks, Handler, Gerätezeilen, Sortierung, Filterung, Supabase, Speicherlogik, Abhängigkeiten sowie `package.json` und `package-lock.json` wurden nicht verändert.

## Prüfungen

- Phase-24-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Bewertung für eine spätere Auslagerung

Die abgeschlossene Berechnung mit festem Enddatum ist deterministisch und kann technisch als separate reine Funktion ausgelagert werden. Dabei müsste die laufende Verzweigung ohne Enddatum ausdrücklich in `DeviceInventoryList` verbleiben; eine solche Aufteilung wäre ein eigener, erneut zu prüfender Refactoring-Schritt.
