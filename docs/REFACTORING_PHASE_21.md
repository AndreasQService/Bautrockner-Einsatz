# QTool Refactoring – Phase 21

## Umfang

- Ausgangscommit: 740786a
- Ursprüngliche Datei: src/components/Dashboard.jsx
- Ziel-Datei: src/utils/dashboardUtils.js
- Ausgelagert: getDryingStartDate(report)
- Betroffene Aufrufstellen: Sortierung der Trocknungsberichte und Startdatum der Trocknungskarte

## Strukturgleiche Übernahme

Der bereits in Phase 20 charakterisierte Funktionskörper wurde inhaltlich unverändert verschoben. Vorrang, Filterung, lexikografische Sortierung und Fallback auf report.date bleiben identisch. Zehn Fälle vergleichen die neue Utility direkt mit der vorherigen lokalen Implementierung; zusätzlich bleibt der Mutationstest bestehen.

## Reinheit

Die Funktion liest nur ihren Parameter. Sie enthält weder aktuelle Zeit noch State, Hooks, DOM-, Netzwerk-, Supabase- oder Storage-Zugriffe und mutiert weder Report noch Equipment.

## Nicht veränderte Bereiche

Sortierausdruck und Kartenanzeige verwenden lediglich den neuen Import. Interaktive Komponenten, Handler, State, Effects, Messwert- und Laufzeitlogik sowie sämtliche geschützten Bereiche wurden nicht verändert.

## Prüfungen

- gezielter Vorher-/Nachher-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- npm run test:guard: erfolgreich
- npm run build: erfolgreich
- gezieltes ESLint: keine neuen Befunde
- git diff --check: ohne Befund

## Risiko und manuelle Prüfung

Das Restrisiko beschränkt sich auf die neue Importgrenze. Empfohlen ist eine Sichtprüfung der Reihenfolge aktiver Trocknungen sowie der angezeigten Laufzeit bei explizitem Trocknungsstart, mehreren Gerätedaten und reinem Projektdatum-Fallback.