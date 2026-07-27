# QTool Refactoring – Phase 22

## Umfang

- Ausgangscommit: `df075d1`
- Untersuchte Funktion: lokale `formatEquipmentDate(dateString)` in `DeviceInventoryList`
- Produktionscode: unverändert

## Charakterisiertes Verhalten

Die Funktion erhält einen Parameter `dateString`. Falsy Werte wie leerer String, `null` und `undefined` ergeben `-`. Ein truthy, aber ungültiger Datumswert wird unverändert zurückgegeben. Gültige Werte werden über `Date`, `getDate`, `getMonth` und `getFullYear` als `TT.MM.JJ` formatiert; Tag und Monat sind zweistellig, vom Jahr bleiben die letzten zwei Stellen.

Datumswerte mit Uhrzeit verlieren die Uhrzeit in der Anzeige. Da lokale Kalenderfelder verwendet werden, können Zeitstempel mit `Z` oder Offset nahe einem Tageswechsel je nach lokaler Zeitzone einen anderen Kalendertag ergeben. Dieses vorhandene Verhalten wird nicht bereinigt.

## Tests

Die 13 Tests decken ISO-Datum, Datum mit und ohne Uhrzeit, leeren String, `null`, `undefined`, ungültigen Wert, Jahresgrenze, Schalttag, zwei realistische Gerätedaten, UTC-Zeitstempel und Nichtmutation eines Date-kompatiblen Objekts ab.

## Nicht veränderte Bereiche

Keine Produktionsdatei, Abhängigkeit, Sortierung, Filterung, Gerätezeile, State-, Hook-, Handler-, Supabase- oder Speicherlogik wurde verändert. `package.json` und `package-lock.json` bleiben unverändert.

## Prüfungen

- gezielter Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Risiko und Empfehlung

Phase 22 verändert kein Laufzeitverhalten. Das verbleibende fachliche Risiko ist die dokumentierte lokale Zeitzonenabhängigkeit. Nach erfolgreichem Commit kann die exakt charakterisierte Funktion separat und unverändert ausgelagert werden.
