# QTool Refactoring – Phase 12

## Umfang

- Ausgangscommit: ffe3baa0d06782cc43e60f8c496634306f704941
- Ausgelagert: statisches PAL-Objekt aus src/features/projects/ProjectListRow.jsx
- Ziel: PROJECT_LIST_PALETTE in src/config/projectListConfig.js
- Einbindung: Import-Alias PAL, damit sämtliche bestehenden Zugriffe unverändert bleiben

## Statische Eignung

Die Konfiguration enthält ausschließlich feste Farben, Styles und sichtbare Prioritätslabels für red, yellow und green. Sie besitzt keine Laufzeitberechnung, Mutation, Hooks, Datenzugriffe oder Seiteneffekte. Werte, Schlüssel und Reihenfolge wurden wortgleich übernommen.

## Tests

tests/refactoring-phase-12.test.js charakterisiert das vollständige Objekt, die Schlüsselreihenfolge und die unveränderte Eingabe.

## Nicht veränderte Bereiche

Keine Änderung an State, Hooks, Handlern, JSX, Props-Werten, Bedingungen, sichtbaren Texten, Styles, Supabase, Sync, Storage, To-do, Abschluss, Archivierung, Messungen, PDF, Karten, Uploads, Environment, Datenbank oder Abhängigkeiten.

## Prüfungen

- npm run build: erfolgreich, 2521 Module transformiert
- npm run test:guard: 23/23 bestanden
- alle Refactoring-Tests: 38/38 bestanden
- neue Phase-12-Tests: 2/2 bestanden
- ESLint für Config und Test: ohne Befund
- ESLint für ProjectListRow.jsx: ausschließlich der vorbestehende showReason-Befund
- git diff --check: ohne Befund
- package.json und package-lock.json: unverändert

## Risiken und manuelle Prüfung

Das Restrisiko beschränkt sich auf den neuen Importpfad. In der Projektliste sollten rote, gelbe und grüne Zeilen auf identische Farben, Labels, Hover-Darstellung und Badge-Darstellung geprüft werden.
