# QTool Refactoring – Phase 32

## Umfang

- Ausgangscommit: `00e5070`
- Untersuchte Ableitung: Gerätestatus in `DeviceInventoryList`
- Produktionscode: unverändert

## Bedingung und Feldpriorität

Die Ableitung liest ausschließlich `item.endDate`. Es gibt keine weitere Feldpriorität und keine Datumsvalidierung. `!item.endDate` bestimmt den Zustand: Jeder falsy Wert bedeutet aktiv, jeder truthy Wert bedeutet deinstalliert. Ein ungültiger, aber truthy Datumswert wird deshalb unverändert als deinstalliert interpretiert.

## Beschriftungen und Styles

Aktive Geräte zeigen `Aktiv` mit Hintergrund `rgba(16, 185, 129, 0.15)`, Textfarbe `#10B981` und Rahmen `1px solid rgba(16, 185, 129, 0.25)`. Deinstallierte Geräte zeigen `Deinstalliert` mit Hintergrund `rgba(59, 130, 246, 0.15)`, Textfarbe `#3B82F6` und Rahmen `1px solid rgba(59, 130, 246, 0.25)`.

Leerer String, `null`, `undefined`, fehlendes Feld und numerische Null sind falsy und ergeben aktiv. Gültige Enddaten, ungültige truthy Texte, Leerzeichen und andere truthy Werte ergeben deinstalliert. Andere Equipment-Felder beeinflussen den Status nicht.

## Tests und Mutation

Die 15 Tests decken aktive und deinstallierte Geräte, gültiges und ungültiges Enddatum, leeren String, `null`, `undefined`, fehlende Eigenschaften, leeres Objekt, realistische Datensätze, irrelevante Felder, truthy und falsy Sonderwerte, sichtbare Beschriftungen, sämtliche statischen Stylewerte und Nichtmutation ab.

## Nicht veränderte Bereiche

Keine Produktionsdatei wurde verändert. JSX, Tabellenzeile, Styles, Sortierung, Filterung, Navigation, Klickverhalten, Laufzeitberechnung, State, Hooks, Handler, Supabase, Speicherlogik, Abhängigkeiten sowie `package.json` und `package-lock.json` bleiben unverändert.

## Prüfungen

- Phase-32-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Risiko und nächster Schritt

Phase 32 verändert kein Laufzeitverhalten. Nach erfolgreichem Commit kann die vollständig charakterisierte Statusableitung als reine Utility ausgelagert werden, während die bestehenden JSX-Styles und Tabellenstrukturen erhalten bleiben.
