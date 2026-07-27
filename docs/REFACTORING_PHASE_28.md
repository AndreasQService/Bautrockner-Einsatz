# QTool Refactoring – Phase 28

## Umfang

- Ausgangscommit: `e31255d`
- Untersuchte Ableitung: Standort-/Raumbezeichnung in `DeviceInventoryList`
- Produktionscode: unverändert

## Eingabefelder und Priorität

Die Anzeige prüft zuerst `item.room`. Nur ein truthy Raum erzeugt eine Standortbezeichnung. `item.apartment` ist optional und wird ausschließlich bei vorhandenem Raum als Präfix verwendet. Ein allein vorhandenes Apartment beziehungsweise ein Standort ohne Raum erzeugt daher keine Bezeichnung.

Bei truthy `apartment` lautet das unveränderte Format `<apartment> - <room>`. Ohne Apartment wird nur der Raum ausgegeben. Es findet keine Deduplizierung, Trimmung oder Normalisierung statt; identische Werte und vorhandene Leerzeichen bleiben erhalten.

## Fallback

Wenn `room` leer, `null`, `undefined` oder nicht vorhanden ist, zeigt das bestehende JSX separat den Text `kein Raum zugeordnet`. Die charakterisierte reine Bezeichnungsableitung liefert für diesen nicht angezeigten Pfad den leeren String. Der sichtbare JSX-Fallback wurde nicht verändert.

## Tests und Mutation

Die 17 Tests decken vollständige Daten, nur Raum, nur Standort, leere, `null`-, `undefined`- und fehlende Eigenschaften, leeres Objekt, identische Werte, Sonderzeichen, realistische Bezeichnungen, erhaltene Leerzeichen und Nichtmutation ab.

## Nicht veränderte Bereiche

Keine Produktionsdatei wurde verändert. JSX, sichtbarer Fallback, Gerätezeilen, Sortierung, Filterung, Klickverhalten, Laufzeitberechnung, State, Hooks, Handler, Supabase, Speicherlogik, Abhängigkeiten sowie `package.json` und `package-lock.json` bleiben unverändert.

## Prüfungen

- Phase-28-Test zweimal: erfolgreich
- alle Refactoring-Tests: erfolgreich
- Guard-Test: erfolgreich
- Build: erfolgreich
- ESLint der Testdatei: ohne Befund
- `git diff --check`: ohne Befund

## Risiko und nächster Schritt

Phase 28 verändert kein Laufzeitverhalten. Nach erfolgreichem Commit kann die Bezeichnungsableitung separat als reine Utility ausgelagert werden, während die bestehende JSX-Bedingung und der sichtbare Fallback unverändert bleiben.
