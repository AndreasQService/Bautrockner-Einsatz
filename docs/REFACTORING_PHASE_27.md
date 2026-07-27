# QTool Refactoring – Phase 27

## Umfang

- Ausgangscommit: c9b9697
- Ursprüngliche Ableitung: lokale typeModel-Zuweisung in DeviceInventoryList
- Ziel-Datei: src/utils/dashboardUtils.js
- Neue Utility: formatEquipmentTypeModel(equipment)

## Unveränderte Ableitung

Die Utility erhält direkt das bisherige item- beziehungsweise Equipment-Objekt. Sie liest equipment.type und danach equipment.model, entfernt falsy Werte, entfernt exakt gleiche Duplikate und verbindet die verbleibenden Werte mit dem Trennzeichen Leerzeichen-Bindestrich-Leerzeichen. Reihenfolge, Trennzeichen, Leerzeichen, Rückgabewerte und der leere String als Fallback bleiben unverändert. Es wurden weder trim noch Normalisierung oder zusätzliche Fehlerbehandlung ergänzt.

Der sichtbare JSX-Fallback Unbekanntes Gerät bleibt unverändert außerhalb der Utility. Gerätezeile, Elementreihenfolge, Styles, Klickverhalten, Sortierung und Filterung wurden nicht verändert.

## Tests und Mutation

Sechzehn Eingabefälle vergleichen die neue Produktionsfunktion direkt mit der unveränderten Phase-26-Referenz. Der zusätzliche Mutationstest ruft die Utility auf und bestätigt, dass das Equipment-Objekt unverändert bleibt.

## Importstruktur

Dashboard.jsx importiert die Utility aus dashboardUtils.js. Die Utility-Datei importiert keine Dashboard-Komponente; dadurch entsteht kein Importzyklus. Der Import wird an genau einer Produktionsstelle verwendet.

## Prüfungen

- Phase-26-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- git diff --check: ohne Befund
- ESLint für Utility und Test: ohne Befund
- Dashboard: keine neuen Befunde gegenüber den sieben bekannten Ausgangsbefunden
- keine neue Abhängigkeit
- package.json und package-lock.json: unverändert

## Verbleibende Risiken

Das Restrisiko beschränkt sich auf die neue Import- und Funktionsgrenze. Empfohlen ist eine Sichtprüfung von Gerätezeilen mit Typ und Modell, nur einem Wert, identischen Werten und vollständig fehlender Bezeichnung.
