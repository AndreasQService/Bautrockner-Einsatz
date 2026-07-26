# QTool Refactoring – Phase 13

## Umfang

- Ausgangscommit: 2dd4c05dce7002b76cfa54d2a2a3066f09e499f2
- Ausgelagert: rein darstellender Dauerblock aus src/features/projects/ProjectListRow.jsx
- Neue Komponente: src/components/ProjectStatusDuration.jsx
- Props: dDays, daysColor, daysInStatus
- Aufrufstellen: eine

## Unveränderte Darstellung

Der Kommentar, das span-Element, alle Inline-Styles, die Bedingung dDays >= 3, der Farbwert und der Aufruf von formatStatusDuration wurden unverändert übernommen. Die neue Komponente importiert ausschließlich die bereits charakterisierte Utility-Funktion.

## Reinheit

Kein State, keine Hooks, keine Handler, keine Callback-Props, keine Mutation und keine Browser-, Netzwerk-, Supabase- oder Storage-Zugriffe.

## Nicht veränderte Bereiche

Keine Änderung an Props-Werten, sichtbaren Texten, Bedingungen, Elementreihenfolge, State, Hooks, Handlern, Supabase, Sync, Storage, To-do, Abschluss, Archivierung, Messungen, PDF, Karten, Uploads, Environment, Datenbank oder Abhängigkeiten.

## Prüfungen

- npm run build: erfolgreich, 2522 Module transformiert
- npm run test:guard: 23/23 bestanden
- alle Refactoring-Tests: 38/38 bestanden
- ESLint für die neue Komponente: ohne Befund
- ESLint für ProjectListRow.jsx: ausschließlich der vorbestehende showReason-Befund
- git diff --check: ohne Befund
- package.json und package-lock.json: unverändert

## Risiken und manuelle Prüfung

Das Restrisiko besteht ausschließlich in der neuen Komponentengrenze und dem Importpfad. Die Anzeigen Heute, 1T und mehrere Tage sowie die Farb- und Fettschriftgrenzen sollten in der Projektliste geprüft werden.
