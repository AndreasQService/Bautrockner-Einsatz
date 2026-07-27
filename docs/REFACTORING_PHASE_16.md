# QTool Refactoring – Phase 16

## Umfang

- Ausgangscommit: 925ea19f71fb28fe36157aba4f7059f5d394ce9d
- Ausgangsdatei: src/components/Dashboard.jsx
- Ausgelagert: Inline-Adressableitung der Technikerkarte
- Ziel: formatTechnicianLocation in src/utils/dashboardUtils.js
- Parameter und Aufruf: report unverändert

## Reinheit und Verhalten

Die Utility liest ausschließlich street, zip, city und address. Reihenfolge, trim-Verhalten, Kommasetzung und der Fallback Keine Adresse wurden exakt übernommen. Es gibt keine Mutation, Zeit-, Browser-, Netzwerk-, Supabase- oder Storage-Abhängigkeit.

## Tests

tests/refactoring-phase-16.test.js enthält neun Vorher-/Nachher-Vergleiche für vollständige und unvollständige Eingaben sowie einen Mutationstest.

## Nicht veränderte Bereiche

Keine Änderung an JSX-Struktur außerhalb des ersetzten Ausdrucks, State, Hooks, Handlern, Suche, Filterung, Navigation, Supabase, Sync, Storage, To-do, Abschluss, Archivierung oder Abhängigkeiten.

## Prüfungen

- npm run build: erfolgreich, 2525 Module transformiert
- npm run test:guard: 23/23 bestanden
- alle Refactoring-Tests: 56/56 bestanden
- neue Phase-16-Tests: 10/10 bestanden, davon neun Vorher-/Nachher-Vergleiche
- ESLint für Utility und Test: ohne Befund
- Dashboard.jsx: unverändert sieben vorbestehende ESLint-Befunde
- git diff --check: ohne Befund
- package.json und package-lock.json: unverändert

## Risiko und manuelle Prüfung

Das Restrisiko beschränkt sich auf Import und Aufruf. Techniker-Karten sollten mit vollständiger Adresse, Teiladresse, address-Fallback und ohne Adresse geprüft werden.
