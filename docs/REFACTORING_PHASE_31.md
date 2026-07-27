# QTool Refactoring – Phase 31

## Umfang

- Ausgangscommit: 832358c
- Ursprüngliche Ableitung: Projekt-/Adresszelle in DeviceInventoryList
- Ziel-Datei: src/utils/dashboardUtils.js
- Neue Utility: formatEquipmentProjectAddress(report)

## Parameter und Rückgabewert

Die Utility erhält direkt das bisherige report-Objekt und liefert ein neues Objekt mit street und details. street übernimmt unverändert report.street oder den Fallback Keine Strasse. details verbindet truthy zip und city mit einem Leerzeichen, fügt danach das bestehende weitere Leerzeichen ein und hängt eine truthy projectNumber in runden Klammern an.

Feldpriorität, Trennzeichen, führende beziehungsweise abschließende Leerzeichen, Fallbacks und das Ignorieren von address, projectTitle und id bleiben unverändert. Es wurden keine Trimmung, Normalisierung oder zusätzliche Fehlerbehandlung ergänzt.

## Unveränderte Tabellenzelle

Beide vorhandenen div-Elemente, ihre Styles, Reihenfolge und die umgebende Tabellenzeile bleiben erhalten. Ausschließlich die bisherigen Inline-Werte wurden durch projectAddress.street und projectAddress.details ersetzt. Sortierung, Filterung, Navigation und Klickverhalten wurden nicht verändert.

## Tests und Mutation

Sechzehn Eingabefälle vergleichen die neue Produktionsfunktion direkt mit der unveränderten Phase-30-Referenz. Der zusätzliche Mutationstest ruft die Utility auf und bestätigt, dass das Report-Objekt unverändert bleibt.

## Importstruktur

Dashboard.jsx importiert die Utility aus dashboardUtils.js. Die Utility-Datei importiert keine Dashboard-Komponente; es entsteht kein Importzyklus. Der Import wird an genau einer Produktionsstelle verwendet.

## Prüfungen

- Phase-30-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- git diff --check: ohne Befund
- ESLint für Utility und Test: ohne Befund
- Dashboard: keine neuen Befunde gegenüber den sieben bekannten Ausgangsbefunden
- keine neue Abhängigkeit
- package.json und package-lock.json: unverändert

## Verbleibende Risiken

Das Restrisiko beschränkt sich auf die neue Import-, Funktions- und Objektgrenze. Empfohlen ist eine Sichtprüfung der Geräteinventar-Projektzelle mit vollständiger Adresse, fehlender Straße, nur Projektnummer und vollständig fehlenden Werten.
