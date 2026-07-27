# QTool Refactoring – Phase 1

## Umfang

Aus `src/components/DamageForm.jsx` wurden zwei eindeutig statische Konstanten nach `src/config/damageFormConfig.js` ausgelagert:

- `statusColors`: unveränderliches Mapping der vorhandenen Workflow-Status auf ihre bestehenden Darstellungswerte.
- `ROOM_OPTIONS`: unveränderliche, feste Auswahlwerte für Raumbezeichnungen.

Werte, Reihenfolgen, Schreibweisen und sichtbare Texte wurden unverändert übernommen. Beide Konstanten waren bereits auf Modulebene definiert, hängen weder von React-State oder Props noch von Projekt-, Benutzer-, Supabase-, Datums- oder Laufzeitdaten ab.

## Ausdrücklich nicht verändert

Nicht verändert wurden React-State, Hooks, Funktionen, Komponenten, Callbacks, Event-Handler, Speicher- und Supabase-Zugriffe, Authentifizierung, To-dos, Projektabschluss, Archivierung, Räume und deren Datenstruktur, Schadensberichte, Messfunktionen, Canvas, Pointer Events, PDF-Erzeugung, Karten, Aufnahmen, Uploads, Storage-Pfade, Umgebungs- und Deployment-Konfiguration sowie Datenfeldnamen und Defaultwerte.

Die lokale Konstante `STEPS` wurde nicht ausgelagert, da sie in `DamageForm.jsx` derzeit nicht verwendet wird. Die abweichenden Werte in `src/components/DamageForm/DamageForm.constants.jsx` wurden nicht zusammengeführt, weil deren Statusfolge nicht identisch ist.

## Prüfungen und Tests

- Vorprüfung von Arbeitsverzeichnis, Branch, sauberem Git-Status und Ausgangscommit `2347436`.
- Vorheriger Build mit `npm run build`: erfolgreich.
- Nachheriger Build mit `npm run build`: erfolgreich (2513 Module transformiert).
- `git diff --check`: erfolgreich, keine Whitespace-Fehler.
- Git-Status und Diff-Statistik: geprüft; ausschließlich die drei vorgesehenen Dateien sind betroffen.
- `npm run test:guard`: erfolgreich, 23 von 23 Tests bestanden.
- Gezieltes ESLint: Die neue Config-Datei ist fehlerfrei; `DamageForm.jsx` enthält 66 bereits bestehende Befunde (60 Fehler, 6 Warnungen), ohne neuen Befund für den Import.

## Build-Ergebnis

Der Build war vor und nach der Änderung erfolgreich. Vite transformierte nach der Änderung 2513 Module und erzeugte den Produktions-Build. Die bereits vorhandenen Hinweise zu gemischten dynamischen/statischen Imports und zur Chunk-Größe blieben bestehen.

## Verbleibende Risiken

Das verbleibende Risiko ist gering und beschränkt sich auf die korrekte Modulauflösung des neuen Imports. Die Config-Datei enthält ausschließlich Literale und keine Laufzeitlogik oder Imports; ein Importzyklus kann von ihr nicht ausgehen.

## Empfehlung für die manuelle Prüfung

Die Statusauswahl im Schadenformular sowie alle Raumauswahlfelder öffnen und prüfen, dass Reihenfolge, Texte und Darstellung gegenüber dem Ausgangsstand unverändert sind. Insbesondere `Kontrolle*`, `Küche`, `Gäste-WC`, `Arbeitszimmer / Büro` und `Sonstiges / Eigener Name` kontrollieren.
