# QTool Refactoring – Phase 30

## Umfang

- Ausgangscommit: `42e5b70`
- Untersuchte Ableitung: Projekt-/Adresszelle in `DeviceInventoryList`
- Produktionscode: unverändert

## Eingabefelder und Ausgabe

Die obere Zeile liest ausschließlich `report.street`. Bei einem falsy Wert wird sichtbar `Keine Strasse` ausgegeben. Die untere Zeile übernimmt truthy `report.zip` und danach truthy `report.city`, verbunden mit einem einzelnen Leerzeichen. Danach folgt durch das bestehende JSX immer ein weiteres Leerzeichen. Ein truthy `report.projectNumber` wird anschließend in runden Klammern ausgegeben.

Dadurch endet die Detailzeile ohne Projektnummer mit einem Leerzeichen; bei ausschließlich vorhandener Projektnummer beginnt sie mit einem Leerzeichen. Diese bestehenden Leerzeichen werden ausdrücklich nicht bereinigt.

## Nicht verwendete Felder und Fallbacks

`report.address`, `report.projectTitle` und `report.id` werden in dieser Geräteinventar-Zelle nicht verwendet. Adressen mit oder ohne Komma, Projekttitel und alleinige Projekt-ID beeinflussen die Ausgabe daher nicht. Falsy, `null`-, `undefined`- oder fehlende Straßenwerte ergeben `Keine Strasse`; die übrigen falsy Felder werden ausgelassen.

## Tests und Mutation

Die 17 Tests decken vollständige Projektdaten, Straße und Ort, nur Straße, nur Ort, Adresse mit und ohne Komma, Projekttitel, Projekt-ID, Projektnummer, leere, `null`-, `undefined`- und fehlende Eigenschaften, leeres Objekt, Sonderzeichen, nur PLZ und Nichtmutation ab.

## Nicht veränderte Bereiche

Keine Produktionsdatei wurde verändert. JSX, Tabellenzeile, sichtbare Texte, Styles, Sortierung, Filterung, Navigation, Klickverhalten, Laufzeitberechnung, State, Hooks, Handler, Supabase, Speicherlogik, Abhängigkeiten sowie `package.json` und `package-lock.json` bleiben unverändert.

## Prüfungen

- Phase-30-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Risiko und nächster Schritt

Phase 30 verändert kein Laufzeitverhalten. Nach erfolgreichem Commit können beide reinen Anzeigen als eine Utility ausgelagert werden, während die zwei bestehenden JSX-Zeilen und ihre Styles erhalten bleiben.
