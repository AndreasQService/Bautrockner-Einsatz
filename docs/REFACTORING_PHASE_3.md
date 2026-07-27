# QTool Refactoring – Phase 3

## Ausgangslage

- Arbeitsverzeichnis: `C:\QTool_Test`
- Branch: `refactor/qtool-phase-1`
- Ausgangscommit: `9c8cc97`

## Ausgelagerte Funktion

`buildDisplayName(project)` wurde aus `src/features/projects/projectRowMapper.js` nach `src/utils/projectUtils.js` verschoben. `projectRowMapper.js` importiert die Funktion nun aus der neuen Utility-Datei; die bestehende Aufrufstelle in `mapProjectToRowViewModel` blieb unverändert.

Die Funktion ist rein: Sie liest ausschließlich Felder des übergebenen Objekts, mutiert weder dieses Objekt noch andere Werte und gibt deterministisch einen String zurück. Sie verwendet kein JSX, React-State, Props, Hooks, Supabase, Storage, Netzwerk, DOM, Browser-APIs, aktuelles Datum, aktuelle Uhrzeit oder Zufallswerte und besitzt keine Seiteneffekte.

Funktionskörper, Parametername, Rückgabewerte und Defaultwert wurden unverändert übernommen. Ein zweiter Kandidat wurde bei Unsicherheit nicht ausgewählt.

## Ausdrücklich nicht verändert

Nicht verändert wurden React-State, Hooks, Komponenten- und Props-Strukturen, Event-Handler, Callback-Logik, Supabase-Zugriffe, Authentifizierung, To-dos, Projektabschluss, Archivierung, Räume, Schadensberichte, Messprotokolle, Messskizzen, Canvas, Pointer Events, PDF-Erzeugung, Karten, Außenaufnahme, Uploads, Storage-Pfade, Vercel-, Environment- und Datenbankkonfiguration, RLS sowie `package.json` und `package-lock.json`.

## Prüfungen und Tests

- Vorprüfung von Arbeitsverzeichnis, Branch, sauberem Git-Status und Ausgangscommit `9c8cc97`.
- Vorheriger Build mit `npm run build`: erfolgreich.
- Nachheriger Build mit `npm run build`: erfolgreich (2515 Module transformiert).
- `npm run test:guard`: erfolgreich, 23 von 23 Tests bestanden.
- Rückgabevergleich für acht repräsentative Eingaben: 8 von 8 identisch; keine Eingabe wurde mutiert.
- Gezieltes ESLint: neue Utility-Datei und Ausgangsdatei ohne Befund; keine bestehenden Befunde in der Ausgangsdatei.
- `git diff --check`: erfolgreich; Git-Status und Diff-Statistik geprüft.

## Build-Ergebnis

Der Build war vor und nach der Änderung erfolgreich. Nach der Änderung transformierte Vite 2515 Module. Die bereits vorhandenen Hinweise zu gemischten dynamischen/statischen Imports und zur Chunk-Größe blieben bestehen.

## Verbleibende Risiken

Das verbleibende Risiko ist gering und beschränkt sich auf die Modulauflösung des neuen Imports. Die Utility-Datei besitzt keine Laufzeit-Imports und kann daher keinen Importzyklus verursachen.

## Empfohlene manuelle Prüfung

In der Projektliste die Anzeigenamen für Projekte mit Straße und Ort, nur Adresse, nur Projekttitel, nur ID sowie vollständig fehlenden Benennungsfeldern kontrollieren.
