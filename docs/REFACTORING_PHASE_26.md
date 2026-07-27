# QTool Refactoring – Phase 26

## Umfang

- Ausgangscommit: `8c095a4`
- Untersuchte Ableitung: lokale `typeModel`-Ableitung in `DeviceInventoryList`
- Produktionscode: unverändert

## Eingaben, Reihenfolge und Ausgabe

Die Ableitung liest ausschließlich `item.type` und danach `item.model`. Beide Werte werden in dieser festen Reihenfolge in ein neues Array aufgenommen. Falsy Werte werden mit `filter(Boolean)` entfernt, anschließend werden exakt gleiche Werte über `indexOf` dedupliziert. Die verbleibenden Werte werden mit dem unveränderten Trennzeichen ` - ` verbunden.

Es findet kein `trim`, keine Groß-/Kleinschreibungsnormalisierung und keine Typprüfung statt. Leerzeichen innerhalb der Werte bleiben erhalten. Truthy Zahlen und andere von `join` unterstützte Werte werden nach den normalen JavaScript-Regeln als Text ausgegeben; `0` wird als falsy entfernt.

## Fallbacks

Bei leeren Strings, `null`, `undefined`, fehlenden Feldern oder leerem Objekt ergibt die Ableitung den leeren String `''`. Der sichtbare Text `Unbekanntes Gerät` ist ein separater JSX-Fallback außerhalb der charakterisierten Ableitung und wurde nicht verändert.

## Tests und Mutation

Die 17 Tests decken vollständige Daten, nur Typ, nur Modell, leere, `null`-, `undefined`- und fehlende Felder, Duplikate, realistische Bezeichnungen, Sonderzeichen, erhaltene Leerzeichen, Zahlen, falsy `0` und Nichtmutation ab. Der Mutationstest bestätigt, dass das Equipment-Objekt unverändert bleibt.

## Nicht veränderte Bereiche

Keine Produktionsdatei wurde verändert. JSX, sichtbare Texte, Gerätezeilen, Sortierung, Filterung, Klickverhalten, Laufzeitberechnung, State, Hooks, Handler, Supabase, Speicherlogik, Abhängigkeiten sowie `package.json` und `package-lock.json` bleiben unverändert.

## Prüfungen

- Phase-26-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Risiko und nächster Schritt

Phase 26 verändert kein Laufzeitverhalten. Nach erfolgreichem Commit kann die Ableitung in einem separaten Paket unverändert als reine Utility mit dem Equipment-Objekt als Parameter ausgelagert werden.
