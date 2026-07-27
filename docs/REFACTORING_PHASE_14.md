# QTool Refactoring – Phase 14

## Umfang

- Ausgangscommit: dc06f4594efde14600074012936e30dc25b24e01
- Ausgelagert: rein darstellender Aufgaben-/Bearbeiterblock aus src/features/projects/ProjectListRow.jsx
- Neue Komponente: src/components/ProjectTaskAssignmentInfo.jsx
- Props: row
- Aufrufstellen: eine
- Ungefährer JSX-Umfang: 32 Zeilen

## Unveränderte Darstellung und Bedingungen

Aufgabenanzahl, Überfälligkeitsanzeige, Farben, Schriftgewichte, Nicht-zugewiesen-Badge, Bearbeiteranzeige, User-Icons, sichtbare Texte und alle Inline-Styles wurden wortgleich und in gleicher Reihenfolge übernommen. Sämtliche Bedingungen verwenden unverändert dieselben row-Felder.

## Reinheit

Die Komponente liest nur ihre Prop. Sie besitzt keinen State, keine Hooks, keine Event-Handler, keine Callback-Props, keine Mutation und keine Browser-, Netzwerk-, Supabase- oder Storage-Zugriffe. Der stopPropagation-Handler verbleibt unverändert im Elterncontainer.

## Nicht veränderte Bereiche

Keine Änderung an Handlern, Statussteuerung, Öffnen-Button, Props-Werten, State, Hooks, Supabase, Sync, Storage, To-do-Logik, Abschluss, Archivierung, Messungen, PDF, Karten, Uploads, Environment, Datenbank oder Abhängigkeiten.

## Prüfungen

- npm run build: erfolgreich, 2523 Module transformiert
- npm run test:guard: 23/23 bestanden
- alle Refactoring-Tests: 38/38 bestanden
- ESLint für die neue Komponente: ohne Befund
- ESLint für ProjectListRow.jsx: ausschließlich der vorbestehende showReason-Befund
- git diff --check: ohne Befund
- package.json und package-lock.json: unverändert

## Risiken und manuelle Prüfung

Das Restrisiko besteht ausschließlich in der neuen Komponentengrenze und dem Icon-Importpfad. Projektzeilen mit keinen, offenen und überfälligen Aufgaben sowie zugewiesenen und nicht zugewiesenen Bearbeitern sollten visuell geprüft werden.
