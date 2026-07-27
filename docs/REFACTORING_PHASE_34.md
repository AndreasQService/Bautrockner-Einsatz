# QTool Refactoring – Phase 34

## Umfang

- Ausgangscommit: `51f3850d0832d383c7f90ee606954042f3d22303`
- Untersuchte Logik: aktive Geräte-Laufzeit in `DeviceInventoryList`
- Produktionscode: unverändert

## Aktuelles Verhalten

Für aktive Geräte wird `item.startDate` als Startwert an `getDaysRunning` übergeben. Da kein truthy `endDate` vorhanden ist, verwendet die Funktion den Zeitpunkt ihres Aufrufs über `new Date()` als Ende. Start und Ende werden als neue `Date`-Instanzen erzeugt und mit `setHours(0, 0, 0, 0)` auf die jeweilige lokale Mitternacht normalisiert.

Die Millisekundendifferenz wird durch exakt 24 Stunden geteilt, mit `Math.ceil` aufgerundet und durch `Math.max(0, …)` auf mindestens null begrenzt. Die Rückgabe ist `${Tage} d`. Ein fehlendes, leeres, `null`- oder `undefined`-Startdatum sowie ein ungültiges Datum ergeben `-`.

Gleicher lokaler Kalendertag ergibt `0 d`; ein zukünftiges Startdatum wird auf `0 d` geklemmt. Uhrzeiten innerhalb eines Tages werden durch die Mitternachtsnormalisierung verworfen.

## Zeitzone und Sommerzeit

Die Berechnung ist von der lokalen Laufzeit-Zeitzone abhängig. Zwischen zwei lokalen Mitternachten können bei einer DST-Umstellung 23 oder 25 Stunden liegen. Mit dem festen 24-Stunden-Divisor ergibt der Frühlingswechsel in `Europe/Zurich` für einen Kalendertag weiterhin `1 d`; der Herbstwechsel rundet 25 Stunden mit `Math.ceil` auf `2 d`. Die Tests halten dieses aktuelle Verhalten fest und sind deshalb bewusst an die konfigurierte Workspace-Zeitzone `Europe/Zurich` gebunden.

## Teststrategie und Mutation

Die Testreferenz entspricht unverändert der aktiven lokalen Berechnungsfolge. Nur der sonst parameterlose aktuelle Zeitpunkt wird innerhalb der Testfunktion durch einen expliziten festen Referenzwert ersetzt. Die Systemzeit und globale Timer werden nicht verändert.

Die Funktion erzeugt aus Start und Referenz neue `Date`-Objekte. Übergebene `Date`-Objekte und Eingabedaten werden nicht mutiert; dies wird separat geprüft.

## Prüfungen

- 16 Phase-34-Tests, darunter zwei DST-Grenzen und ein Mutationstest
- Phase-34-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Risiko und nächster Schritt

Phase 34 verändert kein Produktionsverhalten. Eine spätere reine Funktion ist technisch möglich, wenn der Referenzzeitpunkt als expliziter Parameter übergeben wird. Das wäre eine bewusst zu prüfende Schnittstellenänderung und sollte die hier dokumentierte lokale Mitternachts-, Rundungs-, Fallback- und DST-Semantik unverändert übernehmen.

Als manuelle Prüfung wird empfohlen, die angezeigte Laufzeit eines aktiven Geräts am selben Tag, über einen normalen Tageswechsel und rund um den Herbst-DST-Wechsel zu vergleichen.
