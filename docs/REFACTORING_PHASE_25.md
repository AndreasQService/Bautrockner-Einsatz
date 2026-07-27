# QTool Refactoring – Phase 25

## Arbeitsstand

- Arbeitsverzeichnis: C:\QTool_Test
- Branch: refactor/qtool-phase-1
- Ausgangscommit: 26c892313621067e23f5adae105f346a28aff23d

## Ausgelagerte Utility

formatCompletedEquipmentRuntime(startDateStr, endDateStr) wurde in src/utils/dashboardUtils.js ergänzt. Sie übernimmt ausschließlich die in Phase 24 charakterisierte Berechnung abgeschlossener Geräte-Laufzeiten.

Die ursprüngliche lokale Logik parst Start und Ende, prüft beide Datumswerte, setzt intern erzeugte Date-Kopien auf lokale Mitternacht, teilt die Millisekundendifferenz durch 86.400.000, rundet mit Math.ceil auf und begrenzt negative Ergebnisse auf null. Das Rückgabeformat bleibt <Tage> d; fehlende beziehungsweise ungültige Startwerte und ungültige Endwerte ergeben -.

## Laufende Geräte

getDaysRunning ruft die Utility nur bei truthy endDateStr frühzeitig auf. Der gesamte bisherige lokale Code für die Verzweigung ohne Enddatum ist textuell und strukturell unverändert darunter erhalten. Es wurde kein Referenzzeitpunkt eingeführt und kein Verhalten von new Date() ohne Parameter verändert.

## Reinheit und Zeitzone

Die Utility verwendet ausschließlich ihre beiden Parameter und mutiert weder Eingabewerte noch übergebene Date-Objekte. Lokales Date-Parsing, lokale Mitternacht, DST- und Zeitzonenabhängigkeit bleiben unverändert.

## Vorher-/Nachher-Prüfung

Vierzehn abgeschlossene Eingabefälle vergleichen die neue Produktionsfunktion direkt mit der unveränderten Phase-24-Referenz. Der Mutationstest vergleicht zusätzlich das Ergebnis und bestätigt unveränderte Zeitwerte beider übergebenen Date-Objekte.

## Prüfungen

- Phase-24-Tests zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- git diff --check: ohne Befund
- ESLint für Utility und Test: ohne Befund
- Dashboard: keine neuen Befunde gegenüber den sieben bekannten Ausgangsbefunden
- keine neue Abhängigkeit und kein Importzyklus
- package.json und package-lock.json: unverändert

## Verbleibende Risiken

Das Restrisiko beschränkt sich auf die neue Import- und Funktionsgrenze. Die bereits bestehende lokale Zeitzonen- und DST-Abhängigkeit wurde bewusst nicht korrigiert. Empfohlen ist eine Sichtprüfung abgeschlossener und laufender Geräte nebeneinander.
