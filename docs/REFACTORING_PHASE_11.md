# QTool Refactoring – Phase 11

## Umfang

- Ausgangscommit: da19a463f41aa6d7481f2368592a72bd1f43be46
- Ausgelagert: lokale Funktion dT aus src/features/projects/ProjectListRow.jsx
- Ziel: formatStatusDuration in src/utils/projectUtils.js
- Parameter: d
- Rückgabe und Fallbacks: unverändert leerer String, Heute, 1T oder interpolierter Wert mit T
- Aufrufstellen: eine, mit unverändertem Argument row.daysInStatus

## Reinheit und Sicherheit

Die Funktion liest ausschließlich ihren Parameter und liefert deterministisch einen String. Sie besitzt keine Mutation, keinen State, keine Hooks, keine Browser-, Netzwerk-, Supabase- oder Storage-Abhängigkeit. Der Ausdruck wurde inhaltlich unverändert übernommen. JSX, Props-Werte, Bedingungen, Texte und Styles wurden nicht geändert.

## Charakterisierungstests

tests/refactoring-phase-11.test.js vergleicht zehn Eingaben mit einer wortgleichen Referenz der bisherigen Funktion: undefined, null, 0, 1, mehrere und große Dauern sowie die bestehenden Ausgaben für negative, leere, String- und Boolean-Werte.

## Nicht veränderte Bereiche

Keine Änderungen an State, Hooks, Handlern, Supabase, Authentifizierung, To-do, Abschluss, Archivierung, Sync, Storage, Messungen, PDF, Karten, Uploads, Environment, Datenbank oder Abhängigkeiten.

## Prüfungen

- npm run build: erfolgreich, 2520 Module transformiert
- npm run test:guard: 23/23 bestanden
- alle Refactoring-Tests: 36/36 bestanden
- neue Phase-11-Tests: 10/10 bestanden
- ESLint für Utility und Test: ohne Befund
- ESLint für ProjectListRow.jsx: ausschließlich der bereits vorhandene showReason-Befund
- git diff --check: ohne Befund
- package.json und package-lock.json: unverändert

## Risiken und manuelle Prüfung

Das Restrisiko beschränkt sich auf Import und Funktionsname. In der Projektliste sollten die Anzeigen für Heute, 1T und mehrere Tage visuell kontrolliert werden.
