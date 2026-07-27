# QTool Refactoring – Phase 33

## Umfang

- Ausgangscommit: `7ada5ba`
- Ausgelagerte Ableitung: Gerätestatus in `DeviceInventoryList`
- Ziel: `getEquipmentStatus` in `src/utils/dashboardUtils.js`

## Änderung

Die zuvor direkt in `Dashboard.jsx` ausgeführte Ableitung aus `item.endDate` wurde ohne inhaltliche Änderung in die reine Funktion `getEquipmentStatus` verschoben. `DeviceInventoryList` verwendet deren unveränderte Beschriftung und Stylewerte an derselben JSX-Stelle.

Die Utility liest ausschließlich `equipment.endDate`, verändert die Eingabe nicht und liefert bei gleicher Eingabe immer dasselbe Ergebnis. Sie greift weder auf React, den aktuellen Zeitpunkt, Supabase, Browser-APIs noch veränderlichen globalen Zustand zu.

## Erhaltenes Verhalten

- falsy `endDate`: `Aktiv`
- truthy `endDate`: `Deinstalliert`
- aktive Styles: `rgba(16, 185, 129, 0.15)`, `#10B981`, `1px solid rgba(16, 185, 129, 0.25)`
- deinstallierte Styles: `rgba(59, 130, 246, 0.15)`, `#3B82F6`, `1px solid rgba(59, 130, 246, 0.25)`

Leere, fehlende, `null`-, `undefined`- und numerisch falsy Werte sowie ungültige truthy Werte behalten exakt das in Phase 32 charakterisierte Verhalten.

## Tests

Die 15 Phase-32-Tests vergleichen die neue Utility für jeden Fall direkt mit der unveränderten lokalen Referenz und den erwarteten Ergebnissen. Der Mutationstest ruft die neue Utility direkt auf.

- Phase-32-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- gezieltes ESLint: ohne neue Befunde
- `git diff --check`: ohne Befund

## Nicht veränderte Bereiche und Risiken

JSX-Struktur, Tabellenzeile, sichtbare Texte, CSS-Klassen, Inline-Styles, Elementreihenfolge, Bedingungen, Props, Sortierung, Filterung, Laufzeitberechnung, State, Hooks, Handler, Supabase, Speicherlogik, Abhängigkeiten sowie Paketdateien bleiben unverändert.

Das verbleibende Risiko beschränkt sich auf die Importverdrahtung. Vorher/Nachher-Vergleiche, Build und Gesamttests sichern die identischen Rückgabewerte ab. Als manuelle Prüfung wird empfohlen, je ein aktives und deinstalliertes Gerät in der Geräteinventarliste hinsichtlich Statusbeschriftung und Badge-Darstellung zu vergleichen.
