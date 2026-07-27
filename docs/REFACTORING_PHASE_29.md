# QTool Refactoring – Phase 29

## Umfang

- Ausgangscommit: 7d18d36
- Ursprüngliche Ableitung: Standort-/Raumbezeichnung im wahr-Zweig der Raumspalte von DeviceInventoryList
- Ziel-Datei: src/utils/dashboardUtils.js
- Neue Utility: formatEquipmentLocation(equipment)

## Unveränderte Ableitung

Die Utility erhält direkt das bisherige item- beziehungsweise Equipment-Objekt. Ohne truthy room liefert sie den leeren String. Bei vorhandenem Raum wird ein truthy apartment mit dem unveränderten Trennzeichen Leerzeichen-Bindestrich-Leerzeichen vorangestellt; ohne Apartment wird nur der Raum ausgegeben. Feldpriorität, Leerzeichen, identische Werte und Rückgabewerte bleiben unverändert. Es wurden weder Trimmung noch Normalisierung oder zusätzliche Fehlerbehandlung ergänzt.

## Unverändertes JSX

Die bestehende item.room-Bedingung bleibt im Dashboard erhalten. Ausschließlich der Textinhalt des wahr-Zweigs verwendet nun die Utility. Der sichtbare Fallback kein Raum zugeordnet, die umgebenden Elemente, Styles, Reihenfolge, Gerätezeile, Sortierung, Filterung und Klicklogik bleiben unverändert.

## Tests und Mutation

Sechzehn Eingabefälle vergleichen die neue Produktionsfunktion direkt mit der unveränderten Phase-28-Referenz. Der zusätzliche Mutationstest ruft die Utility auf und bestätigt, dass das Equipment-Objekt unverändert bleibt.

## Importstruktur

Dashboard.jsx importiert die Utility aus dashboardUtils.js. Die Utility-Datei importiert keine Dashboard-Komponente; es entsteht kein Importzyklus. Der Import wird an genau einer Produktionsstelle verwendet.

## Prüfungen

- Phase-28-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- git diff --check: ohne Befund
- ESLint für Utility und Test: ohne Befund
- Dashboard: keine neuen Befunde gegenüber den sieben bekannten Ausgangsbefunden
- keine neue Abhängigkeit
- package.json und package-lock.json: unverändert

## Verbleibende Risiken

Das Restrisiko beschränkt sich auf die neue Import- und Funktionsgrenze. Empfohlen ist eine Sichtprüfung der Raumspalte mit Apartment und Raum, nur Raum sowie fehlendem Raum und sichtbarem Fallback.
