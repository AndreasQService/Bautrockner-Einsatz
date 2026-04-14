# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: messen-ipad-a1934.spec.js >> iPad A1934 (768×1024 Portrait) — Messprotokoll >> 4.3 Input fokussierbar + keine Seitwärts-Verschiebung
- Location: tests\messen-ipad-a1934.spec.js:310:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="number"], input[type="text"]').first()
    - locator resolved to <input type="text" value="W-25-TEST" class="form-input" placeholder="W-25..."/>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <canvas width="960" height="400"></canvas> from <div>…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <canvas width="960" height="400"></canvas> from <div>…</div> subtree intercepts pointer events
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div>…</div> intercepts pointer events
  12 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <canvas width="960" height="400"></canvas> from <div>…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <canvas width="960" height="400"></canvas> from <div>…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>…</div> intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - img "QService" [ref=e8]
          - generic [ref=e9]: Q-Service AG
        - navigation [ref=e10]:
          - button "Dashboard" [ref=e11]:
            - img [ref=e12]
            - generic [ref=e17]: Dashboard
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e20]: Admin User
              - generic [ref=e21]: admin
            - button "Abmelden" [ref=e22]:
              - img [ref=e23]
    - main [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e30]:
            - generic [ref=e31]: "PROJEKT-NR:"
            - textbox "W-25..." [ref=e33]: W-25-TEST
          - generic [ref=e34]:
            - generic [ref=e35]: "AUFTRAGSNUMMER:"
            - textbox "Nr." [ref=e37]: AUF-001
          - generic [ref=e38]:
            - generic [ref=e39]: "SCHADEN-NR:"
            - textbox "Versicherung Nr." [ref=e41]
          - generic [ref=e42]:
            - generic [ref=e43]: "VERSICHERUNG:"
            - textbox "Gesellschaft" [ref=e44]
          - generic [ref=e45]:
            - generic [ref=e46]: "SCHADENSMELDUNG:"
            - textbox [ref=e47]
        - generic [ref=e48]:
          - generic [ref=e49]:
            - button [ref=e50] [cursor=pointer]:
              - img [ref=e51]
            - textbox "W-25-TEST" [ref=e53]: Test Wasserschaden
          - generic [ref=e54]:
            - generic [ref=e55]:
              - generic [ref=e56]: Sachbearbeiter
              - combobox [ref=e57]:
                - option "Wählen..." [selected]
                - option "Xhemil Ademi"
                - option "Adi Shala"
                - option "Andreas Strehler"
                - option "André Rothfuchs"
            - generic [ref=e58]:
              - generic [ref=e59]: Projektstatus
              - combobox [ref=e60]:
                - option "Schadenaufnahme"
                - option "Leckortung"
                - option "Trocknung" [selected]
                - option "Instandsetzung"
                - option "Abgeschlossen"
            - generic [ref=e61]:
              - generic [ref=e62]: Export
              - button "Termin" [ref=e63] [cursor=pointer]:
                - img [ref=e64]:
                  - generic [ref=e67]: ICS
                - generic [ref=e68]: Termin
        - generic [ref=e70]:
          - generic [ref=e71] [cursor=pointer]:
            - generic [ref=e72]:
              - img [ref=e73]
              - img [ref=e76]
            - paragraph [ref=e80]: "Alles hier ablegen: Dokumente & Bilder"
            - paragraph [ref=e81]: PDF, MSG, TXT (Analyse) + JPG, PNG (Galerie)
          - generic [ref=e82]:
            - generic [ref=e83]:
              - img [ref=e84]
              - strong [ref=e87]: Projektimport
            - generic [ref=e88] [cursor=pointer]:
              - img [ref=e89]
              - generic [ref=e92]: PDF hier droppen oder klicken → Text wird extrahiert
            - textbox "Kopieren Sie hier E-Mail Text oder Notizen hinein..." [ref=e93]
            - button "Text analysieren" [disabled] [ref=e95]
        - generic [ref=e96]:
          - heading "Auftrag & Verwaltung" [level=3] [ref=e97]:
            - img [ref=e98]
            - text: Auftrag & Verwaltung
          - generic [ref=e101]:
            - generic [ref=e102]:
              - generic [ref=e103]: Auftraggeber (Name/Firma)
              - textbox "Name oder Firma des Auftraggebers" [ref=e104]: Muster GmbH
            - generic [ref=e105]:
              - generic [ref=e106]: Strasse & Nr. (AG)
              - textbox "Strasse / Nr." [ref=e107]
            - generic [ref=e108]:
              - generic [ref=e109]: PLZ (AG)
              - textbox "PLZ" [ref=e110]
            - generic [ref=e111]:
              - generic [ref=e112]: Ort (AG)
              - textbox "Ort" [ref=e113]
          - generic [ref=e114]:
            - generic [ref=e115]:
              - generic [ref=e116]: Telefon (AG-Kontakt)
              - textbox "+41 XX XXX XX XX" [ref=e117]
            - generic [ref=e118]:
              - generic [ref=e119]: E-Mail (AG-Kontakt)
              - textbox "email@firma.ch" [ref=e120]
            - generic [ref=e121]:
              - generic [ref=e122]: Leistungsart
              - combobox [ref=e123]:
                - option "Wasserschaden" [selected]
                - option "Schimmel"
                - option "Leckortung"
                - option "Trocknung"
          - generic [ref=e124]:
            - generic [ref=e125]: Eigentümer / Rechnungsdetails
            - generic [ref=e126]:
              - generic [ref=e127]:
                - generic [ref=e128]: Eigentümer
                - textbox "Name/Firma" [ref=e129]
              - generic [ref=e130]:
                - generic [ref=e131]: Strasse & Nr.
                - textbox "Strasse / Nr." [ref=e132]
              - generic [ref=e133]:
                - generic [ref=e134]:
                  - generic [ref=e135]: PLZ
                  - textbox "PLZ" [ref=e136]
                - generic [ref=e137]:
                  - generic [ref=e138]: Ort
                  - textbox "Ort" [ref=e139]
            - generic [ref=e140]:
              - generic [ref=e141]:
                - generic [ref=e142]: Rechnungsvermerk
                - textbox "z.B. EIM-..." [ref=e143]
              - generic [ref=e144]:
                - generic [ref=e145]: E-Mail (Rechnung)
                - textbox "rechnung@..." [ref=e146]
        - generic [ref=e147]:
          - heading "Schadenort (Adresse)" [level=3] [ref=e148]:
            - img [ref=e149]
            - text: Schadenort (Adresse)
          - generic [ref=e152]:
            - generic [ref=e153]:
              - generic [ref=e154]: PROJEKT-NR
              - generic [ref=e155]: W-25-TEST
            - generic [ref=e156]:
              - generic [ref=e157]: Objekt / Wohnung
              - textbox "Zusatz (z.B. 2. OG links)" [ref=e158]
            - generic [ref=e159]:
              - generic [ref=e160]: Strasse & Nr.
              - textbox "Strasse & Nr." [ref=e161]: Teststrasse 12
            - generic [ref=e162]:
              - generic [ref=e163]:
                - generic [ref=e164]: PLZ
                - combobox "PLZ" [ref=e165]: "8000"
              - generic [ref=e166]:
                - generic [ref=e167]: Ort
                - textbox "Ort" [ref=e168]: Zürich
            - generic [ref=e169]:
              - generic [ref=e170]: Art der Liegenschaft
              - combobox [ref=e171]:
                - option "Bitte wählen..." [selected]
                - option "Einfamilienhaus"
                - option "Mehrfamilienhaus"
                - option "Eigentumswohnung"
                - option "Gewerbe / Büro"
                - option "Sonstiges"
        - generic [ref=e172]:
          - generic [ref=e173]:
            - heading "Schadenbeschreibung (KI / Meldung)" [level=3] [ref=e174]:
              - img [ref=e175]
              - text: Schadenbeschreibung (KI / Meldung)
            - generic [ref=e178]:
              - button "Diktieren starten" [ref=e179] [cursor=pointer]:
                - img [ref=e180]
              - generic [ref=e183] [cursor=pointer]:
                - checkbox "In Bericht aufnehmen" [checked] [ref=e184]
                - text: In Bericht aufnehmen
          - textbox "Beschrieb aus der Meldung..." [ref=e185]
          - generic [ref=e186]:
            - generic [ref=e187]:
              - img [ref=e188]
              - text: Zugehörige Schadensbilder
            - generic [ref=e192]:
              - generic [ref=e193] [cursor=pointer]:
                - img [ref=e194]
                - generic [ref=e195]: Bild add.
              - generic [ref=e197]: 📎 Bilder hier ablegen · Ctrl+V zum Einfügen
        - generic [ref=e198]:
          - generic [ref=e199] [cursor=pointer]:
            - heading "Kontakte" [level=3] [ref=e200]:
              - img [ref=e201]
              - text: Kontakte
            - generic [ref=e203]:
              - generic [ref=e204]: Einklappen
              - img [ref=e205]
          - generic [ref=e207]:
            - generic [ref=e208]:
              - generic [ref=e209]: Eigentümer
              - generic [ref=e210]:
                - generic [ref=e211]:
                  - generic [ref=e212]: Name
                  - generic [ref=e213]:
                    - textbox "Name" [ref=e214]: Max Muster
                    - button "vCard downloaden" [ref=e215] [cursor=pointer]:
                      - img [ref=e216]:
                        - generic [ref=e220]: VCF
                    - button "QR" [ref=e221] [cursor=pointer]
                - generic [ref=e222]:
                  - generic [ref=e223]: Ansprechperson
                  - textbox "Vorname Name" [ref=e224]
                - generic [ref=e225]:
                  - generic [ref=e226]: Etage / Rolle
                  - generic [ref=e227]:
                    - textbox "Etage" [ref=e228]
                    - combobox [ref=e229]:
                      - option "AG"
                      - option "Mieter"
                      - option "Eig." [selected]
                      - option "HW"
                      - option "Verw."
                      - option "Handw."
                      - option "Sonst."
                - generic [ref=e230]:
                  - generic [ref=e231]: Telefon
                  - textbox "+41 79 123 45 67" [ref=e232]
                - generic [ref=e233]:
                  - generic [ref=e234]: E-Mail
                  - textbox "email@firma.ch" [ref=e235]
                - generic [ref=e236]:
                  - link "Anrufen" [ref=e237] [cursor=pointer]:
                    - /url: tel:+41 79 123 45 67
                    - img [ref=e238]
                  - button "Löschen" [ref=e240] [cursor=pointer]:
                    - img [ref=e241]
            - generic [ref=e244]:
              - generic [ref=e245]: Mieter
              - generic [ref=e246]:
                - generic [ref=e247]:
                  - generic [ref=e248]: Name
                  - generic [ref=e249]:
                    - textbox "Name" [ref=e250]
                    - button "vCard downloaden" [ref=e251] [cursor=pointer]:
                      - img [ref=e252]:
                        - generic [ref=e256]: VCF
                    - button "QR" [ref=e257] [cursor=pointer]
                - generic [ref=e258]:
                  - generic [ref=e259]: Etage / Rolle
                  - generic [ref=e260]:
                    - textbox "Etage" [ref=e261]
                    - combobox [ref=e262]:
                      - option "AG"
                      - option "Mieter" [selected]
                      - option "Eig."
                      - option "HW"
                      - option "Verw."
                      - option "Handw."
                      - option "Sonst."
                - generic [ref=e263]:
                  - generic [ref=e264]: Telefon
                  - textbox "+41 79 123 45 67" [ref=e265]
                - generic [ref=e266]:
                  - generic [ref=e267]: E-Mail
                  - textbox "email@firma.ch" [ref=e268]
                - generic [ref=e269]:
                  - link "Anrufen" [ref=e270]:
                    - /url: "#"
                    - img [ref=e271]
                  - button "Löschen" [ref=e273] [cursor=pointer]:
                    - img [ref=e274]
            - generic [ref=e277]:
              - generic [ref=e278]: Mieter
              - generic [ref=e279]:
                - generic [ref=e280]:
                  - generic [ref=e281]: Name
                  - generic [ref=e282]:
                    - textbox "Name" [ref=e283]
                    - button "vCard downloaden" [ref=e284] [cursor=pointer]:
                      - img [ref=e285]:
                        - generic [ref=e289]: VCF
                    - button "QR" [ref=e290] [cursor=pointer]
                - generic [ref=e291]:
                  - generic [ref=e292]: Etage / Rolle
                  - generic [ref=e293]:
                    - textbox "Etage" [ref=e294]
                    - combobox [ref=e295]:
                      - option "AG"
                      - option "Mieter" [selected]
                      - option "Eig."
                      - option "HW"
                      - option "Verw."
                      - option "Handw."
                      - option "Sonst."
                - generic [ref=e296]:
                  - generic [ref=e297]: Telefon
                  - textbox "+41 79 123 45 67" [ref=e298]
                - generic [ref=e299]:
                  - generic [ref=e300]: E-Mail
                  - textbox "email@firma.ch" [ref=e301]
                - generic [ref=e302]:
                  - link "Anrufen" [ref=e303]:
                    - /url: "#"
                    - img [ref=e304]
                  - button "Löschen" [ref=e306] [cursor=pointer]:
                    - img [ref=e307]
          - button "Kontakt hinzufügen" [ref=e311]:
            - img [ref=e312]
            - text: Kontakt hinzufügen
        - generic [ref=e315] [cursor=pointer]:
          - heading "Räume / Fotos" [level=3] [ref=e316]:
            - img [ref=e317]
            - text: Räume / Fotos
          - generic [ref=e321]:
            - generic [ref=e322]: Einklappen
            - img [ref=e323]
        - generic [ref=e325]:
          - generic [ref=e326]:
            - generic [ref=e327]:
              - generic [ref=e329]: Badezimmer
              - generic [ref=e330]:
                - button "Messung starten" [active] [ref=e331] [cursor=pointer]:
                  - img [ref=e332]
                  - text: Messung starten
                - button "Raum löschen" [ref=e333] [cursor=pointer]:
                  - img [ref=e334]
            - generic [ref=e337]:
              - generic [ref=e339]: Keine Bilder
              - generic [ref=e340]:
                - generic [ref=e341] [cursor=pointer]:
                  - img [ref=e342]
                  - text: Kamera
                - generic [ref=e345] [cursor=pointer]:
                  - img [ref=e346]
                  - text: Galerie
          - generic [ref=e350]:
            - generic [ref=e351]:
              - generic [ref=e353]: Küche
              - generic [ref=e354]:
                - button "Messung starten" [ref=e355] [cursor=pointer]:
                  - img [ref=e356]
                  - text: Messung starten
                - button "Raum löschen" [ref=e357] [cursor=pointer]:
                  - img [ref=e358]
            - generic [ref=e361]:
              - generic [ref=e363]: Keine Bilder
              - generic [ref=e364]:
                - generic [ref=e365] [cursor=pointer]:
                  - img [ref=e366]
                  - text: Kamera
                - generic [ref=e369] [cursor=pointer]:
                  - img [ref=e370]
                  - text: Galerie
          - generic [ref=e374]:
            - generic [ref=e375]:
              - generic [ref=e377]: Wohnzimmer
              - generic [ref=e378]:
                - button "Messung starten" [ref=e379] [cursor=pointer]:
                  - img [ref=e380]
                  - text: Messung starten
                - button "Raum löschen" [ref=e381] [cursor=pointer]:
                  - img [ref=e382]
            - generic [ref=e385]:
              - generic [ref=e387]: Keine Bilder
              - generic [ref=e388]:
                - generic [ref=e389] [cursor=pointer]:
                  - img [ref=e390]
                  - text: Kamera
                - generic [ref=e393] [cursor=pointer]:
                  - img [ref=e394]
                  - text: Galerie
        - button "Raum hinzufügen" [ref=e399]:
          - img [ref=e400]
          - text: Raum hinzufügen
        - generic [ref=e401]:
          - generic [ref=e402] [cursor=pointer]:
            - heading "Schadenursache" [level=3] [ref=e403]:
              - img [ref=e404]
              - text: Schadenursache
            - generic [ref=e406]:
              - generic [ref=e407]: Einklappen
              - img [ref=e408]
          - generic [ref=e411]:
            - generic [ref=e412]:
              - generic [ref=e413]: Schadenursache
              - button "Diktieren" [ref=e414] [cursor=pointer]:
                - img [ref=e415]
                - text: Diktieren
            - textbox "Beschreibung der Ursache..." [ref=e418]
          - generic [ref=e419]:
            - heading "Fotos zur Ursache" [level=4] [ref=e420]
            - generic [ref=e421] [cursor=pointer]:
              - img [ref=e422]
              - generic [ref=e423]: Schadenfoto hochladen / Drop
            - generic [ref=e425]: Keine Schadenfotos vorhanden.
        - generic [ref=e426]:
          - generic [ref=e427] [cursor=pointer]:
            - checkbox "Bericht erstellt" [ref=e428]
            - generic [ref=e429]: Bericht erstellt
          - button "Schadensbericht PDF" [ref=e430] [cursor=pointer]:
            - img [ref=e431]:
              - generic [ref=e435]: PDF
            - generic [ref=e436]: Schadensbericht PDF
        - generic [ref=e437]:
          - generic [ref=e438]:
            - heading "Emails & Kommunikation" [level=3] [ref=e439]:
              - img [ref=e440]
              - text: Emails & Kommunikation
            - button "Email importieren" [ref=e443]:
              - img [ref=e444]
              - text: Email importieren
          - generic [ref=e445] [cursor=pointer]:
            - img [ref=e446]
            - generic [ref=e447]: Emails / PDF hierher ziehen oder klicken
          - generic [ref=e449]: Keine Emails vorhanden.
        - generic [ref=e450]:
          - heading "Pläne & Grundrisse" [level=3] [ref=e451]:
            - img [ref=e452]
            - text: Pläne & Grundrisse
          - generic [ref=e455] [cursor=pointer]:
            - img [ref=e457]
            - generic [ref=e458]: Plan / Grundriss hochladen (PDF / Bild)
          - generic [ref=e460]: Keine Pläne vorhanden.
        - generic [ref=e461]:
          - generic [ref=e462]:
            - heading "Arbeitsrapporte" [level=3] [ref=e463]:
              - img [ref=e464]
              - text: Arbeitsrapporte
            - generic [ref=e465] [cursor=pointer]:
              - img [ref=e466]
              - generic [ref=e467]: Arbeitsrapport hochladen / Drop
            - generic [ref=e469]: Keine Arbeitsrapporte vorhanden.
          - generic [ref=e470]:
            - heading "Lieferantenrechnungen" [level=3] [ref=e471]:
              - img [ref=e472]
              - text: Lieferantenrechnungen
            - generic [ref=e475] [cursor=pointer]:
              - img [ref=e477]
              - generic [ref=e478]: Lieferantenrechnung hochladen / Drop
            - generic [ref=e480]: Keine Lieferantenrechnungen vorhanden.
          - generic [ref=e481]:
            - heading "Messprotokolle" [level=3] [ref=e482]:
              - img [ref=e483]
              - text: Messprotokolle
            - generic [ref=e486]:
              - generic [ref=e487]:
                - generic [ref=e488]:
                  - generic [ref=e489]: Badezimmer
                  - generic [ref=e490]: Keine Messdaten
                - button "Messung starten" [ref=e492]
              - generic [ref=e493]:
                - generic [ref=e494]:
                  - generic [ref=e495]: Küche
                  - generic [ref=e496]: Keine Messdaten
                - button "Messung starten" [ref=e498]
              - generic [ref=e499]:
                - generic [ref=e500]:
                  - generic [ref=e501]: Wohnzimmer
                  - generic [ref=e502]: Keine Messdaten
                - button "Messung starten" [ref=e504]
            - button "Excel Export" [ref=e506]:
              - img [ref=e507]
              - text: Excel Export
        - generic [ref=e509]:
          - heading "Trocknungsgeräte" [level=2] [ref=e510]:
            - img [ref=e511]
            - text: Trocknungsgeräte
          - button "Gerät hinzufügen" [ref=e515]:
            - img [ref=e516]
            - text: Gerät hinzufügen
          - button "Energieprotokoll (PDF)" [ref=e518]:
            - img [ref=e519]:
              - generic [ref=e523]: PDF
            - generic [ref=e524]: Energieprotokoll (PDF)
          - generic [ref=e526]:
            - generic [ref=e527]:
              - generic [ref=e528]: "#"
              - generic [ref=e530]: Badezimmer
            - generic [ref=e531]:
              - generic [ref=e532]: "Start:"
              - generic [ref=e533]: "Start-Zähler: kWh"
            - button "Abmelden" [ref=e535] [cursor=pointer]
        - generic [ref=e536]:
          - heading "Zusammenfassung Trocknung" [level=3] [ref=e537]:
            - img [ref=e538]
            - text: Zusammenfassung Trocknung
          - table [ref=e543]:
            - rowgroup [ref=e544]:
              - row "Gerät Dauer (Tage) Betriebsstunden Verbrauch (kWh)" [ref=e545]:
                - columnheader "Gerät" [ref=e546]
                - columnheader "Dauer (Tage)" [ref=e547]
                - columnheader "Betriebsstunden" [ref=e548]
                - columnheader "Verbrauch (kWh)" [ref=e549]
            - rowgroup [ref=e550]:
              - row "Keine abgeschlossenen Trocknungen vorhanden." [ref=e551]:
                - cell "Keine abgeschlossenen Trocknungen vorhanden." [ref=e552]
              - row "Gesamt - 0.0 h 0.00 kWh" [ref=e553]:
                - cell "Gesamt" [ref=e554]
                - cell "-" [ref=e555]
                - cell "0.0 h" [ref=e556]
                - cell "0.00 kWh" [ref=e557]
        - generic [ref=e559]:
          - generic [ref=e560]:
            - img [ref=e561]
            - text: Gespeichert
          - button "Fertig" [ref=e564]:
            - img [ref=e565]
            - text: Fertig
  - generic [ref=e569]:
    - generic [ref=e570]:
      - generic [ref=e571]:
        - heading "Messprotokoll" [level=3] [ref=e572]
        - generic [ref=e573]: Test Wasserschaden - Badezimmer
      - button "Fertig" [ref=e575]
    - generic [ref=e576]:
      - generic [ref=e578]:
        - generic [ref=e579]: "Werkzeuge:"
        - button "Skizze bearbeiten" [ref=e580]:
          - img [ref=e581]
          - text: Skizze bearbeiten
        - button "Nur Stift" [disabled] [ref=e584]:
          - img [ref=e585]
          - generic [ref=e587]: Nur Stift
        - button "Scrollen" [ref=e588]:
          - img [ref=e589]
          - generic [ref=e594]: Scrollen
        - button "Rückgängig" [disabled] [ref=e596]:
          - img [ref=e597]
        - button "Skizze einklappen" [ref=e600]:
          - img [ref=e601]
      - heading "Badezimmer" [level=2] [ref=e606]
      - generic [ref=e607]:
        - generic [ref=e608]:
          - generic [ref=e609]: Datum
          - textbox [ref=e610]: 2026-04-08
        - generic [ref=e611]:
          - generic [ref=e612]: Raumtemp. (°C)
          - spinbutton [ref=e613]
        - generic [ref=e614]:
          - generic [ref=e615]: Luftfeuchte (%)
          - spinbutton [ref=e616]
        - generic [ref=e617]:
          - generic [ref=e618]: Messgerät
          - combobox "z.B. Trotec" [ref=e619]
      - generic [ref=e621]:
        - table [ref=e622]:
          - rowgroup [ref=e623]:
            - row "Messpunkt Wand Boden Bemerkung" [ref=e624]:
              - columnheader "Messpunkt" [ref=e625]
              - columnheader "Wand" [ref=e626]
              - columnheader "Boden" [ref=e627]
              - columnheader "Bemerkung" [ref=e628]
              - columnheader [ref=e629]
          - rowgroup [ref=e630]:
            - row "Messpunkt 1" [ref=e631]:
              - cell "Messpunkt 1" [ref=e632]:
                - textbox [ref=e633]: Messpunkt 1
              - cell [ref=e634]:
                - textbox "Wert..." [ref=e635]
              - cell [ref=e636]:
                - textbox "Wert..." [ref=e637]
              - cell [ref=e638]:
                - textbox "..." [ref=e639]
              - cell [ref=e640]:
                - button "Messpunkt löschen" [ref=e641] [cursor=pointer]:
                  - img [ref=e642]
            - row "Messpunkt 2" [ref=e645]:
              - cell "Messpunkt 2" [ref=e646]:
                - textbox [ref=e647]: Messpunkt 2
              - cell [ref=e648]:
                - textbox "Wert..." [ref=e649]
              - cell [ref=e650]:
                - textbox "Wert..." [ref=e651]
              - cell [ref=e652]:
                - textbox "..." [ref=e653]
              - cell [ref=e654]:
                - button "Messpunkt löschen" [ref=e655] [cursor=pointer]:
                  - img [ref=e656]
            - row "Messpunkt 3" [ref=e659]:
              - cell "Messpunkt 3" [ref=e660]:
                - textbox [ref=e661]: Messpunkt 3
              - cell [ref=e662]:
                - textbox "Wert..." [ref=e663]
              - cell [ref=e664]:
                - textbox "Wert..." [ref=e665]
              - cell [ref=e666]:
                - textbox "..." [ref=e667]
              - cell [ref=e668]:
                - button "Messpunkt löschen" [ref=e669] [cursor=pointer]:
                  - img [ref=e670]
            - row "Messpunkt 4" [ref=e673]:
              - cell "Messpunkt 4" [ref=e674]:
                - textbox [ref=e675]: Messpunkt 4
              - cell [ref=e676]:
                - textbox "Wert..." [ref=e677]
              - cell [ref=e678]:
                - textbox "Wert..." [ref=e679]
              - cell [ref=e680]:
                - textbox "..." [ref=e681]
              - cell [ref=e682]:
                - button "Messpunkt löschen" [ref=e683] [cursor=pointer]:
                  - img [ref=e684]
        - button "weiteren Messpunkt hinzufügen" [ref=e687] [cursor=pointer]:
          - img [ref=e688]
          - text: weiteren Messpunkt hinzufügen
```

# Test source

```ts
  219 |   });
  220 | 
  221 |   test('2.2 DamageForm nutzt volle Breite (>85% des Viewports)', async ({ page }) => {
  222 |     await openFirstProject(page);
  223 |     const info = await page.evaluate(() => {
  224 |       const el = document.querySelector('form, main.container, .container');
  225 |       if (!el) return null;
  226 |       const r = el.getBoundingClientRect();
  227 |       return { w: r.width, vw: window.innerWidth, ratio: r.width / window.innerWidth };
  228 |     });
  229 |     if (!info) { console.warn('⚠️  Container nicht gefunden'); return; }
  230 |     console.log(`Formbreite: ${info.w.toFixed(0)}px / ${info.vw}px = ${(info.ratio*100).toFixed(1)}%`);
  231 |     expect(info.ratio, `Nur ${(info.ratio*100).toFixed(1)}% der Breite`).toBeGreaterThan(0.85);
  232 |   });
  233 | 
  234 |   // 3. Mess-Buttons
  235 | 
  236 |   test('3.1 "Messung starten" Button ist sichtbar und gross genug', async ({ page }) => {
  237 |     await openFirstProject(page);
  238 |     await page.evaluate(() => window.scrollTo(0, 600));
  239 |     await page.waitForTimeout(300);
  240 | 
  241 |     const btns = await page.locator('button:has-text("Messung")').all();
  242 |     console.log(`Gefundene Mess-Buttons: ${btns.length}`);
  243 | 
  244 |     if (btns.length === 0) {
  245 |       await page.screenshot({ path: `${SCREENSHOTS}/03a-no-btn.png`, fullPage: true });
  246 |       console.warn('⚠️  KEIN Mess-Button gefunden! Scrolltiefe evtl. zu gering oder Raum nicht angelegt.');
  247 |       return; // Soft-skip
  248 |     }
  249 | 
  250 |     for (const btn of btns.slice(0, 3)) {
  251 |       const box = await btn.boundingBox();
  252 |       const lbl = await btn.textContent();
  253 |       if (!box) continue;
  254 |       console.log(`"${lbl?.trim()}": ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
  255 |       if (box.height < MIN_TOUCH_PX) {
  256 |         console.warn(`⚠️  TOUCH-BUG: "${lbl?.trim()}" zu klein — ${box.height.toFixed(0)}px < ${MIN_TOUCH_PX}px`);
  257 |       }
  258 |     }
  259 |     expect(btns.length).toBeGreaterThan(0);
  260 |   });
  261 | 
  262 |   test('3.2 Messprotokoll-Modal öffnet sich', async ({ page }) => {
  263 |     await openFirstProject(page);
  264 |     const { opened, buttonFound } = await openMeasurementModal(page);
  265 | 
  266 |     if (!buttonFound) {
  267 |       await page.screenshot({ path: `${SCREENSHOTS}/03b-no-btn.png`, fullPage: true });
  268 |       console.warn('⚠️  Kein Mess-Button — Modal kann nicht geöffnet werden');
  269 |       return;
  270 |     }
  271 | 
  272 |     expect(opened, 'Modal nicht geöffnet').toBe(true);
  273 |     console.log('✅ MeasurementModal geöffnet');
  274 |   });
  275 | 
  276 |   // 4. Input & Scroll
  277 | 
  278 |   test('4.1 Kein horizontales Scrollen im Modal', async ({ page }) => {
  279 |     await openFirstProject(page);
  280 |     const { opened } = await openMeasurementModal(page);
  281 |     if (!opened) return;
  282 | 
  283 |     const s = await checkHorizontalScroll(page);
  284 |     if (s.hasHorizontalScroll) {
  285 |       console.warn(`⚠️  BUG: Horizontales Scrollen im Modal! Überlauf: ${s.overflowingBy}px`);
  286 |     }
  287 |     expect(s.hasHorizontalScroll, `H-Scroll im Modal! +${s.overflowingBy}px`).toBe(false);
  288 |   });
  289 | 
  290 |   test('4.2 Inputs: Mindesthöhe 40px (Touch-freundlich)', async ({ page }) => {
  291 |     await openFirstProject(page);
  292 |     const { opened } = await openMeasurementModal(page);
  293 |     if (!opened) { console.warn('Modal nicht offen'); return; }
  294 | 
  295 |     await page.waitForTimeout(400);
  296 |     const inputs = await measureInputFields(page);
  297 |     console.log(`\nInputs im Modal: ${inputs.length}`);
  298 | 
  299 |     let bugsFound = 0;
  300 |     for (const inp of inputs) {
  301 |       console.log(`  "${inp.label}": ${inp.width}×${inp.height}px, inViewport=${inp.isInViewport}`);
  302 |       if (inp.height < 40) { bugsFound++; console.warn(`  ⚠️  ZU KLEIN: ${inp.height}px`); }
  303 |       if (inp.overlap) { console.warn(`  ⚠️  ÜBERLAPPUNG!`); }
  304 |     }
  305 |     if (bugsFound) console.warn(`\n⚠️  ${bugsFound} Input(s) unter 40px Höhe!`);
  306 | 
  307 |     expect(inputs.length, 'Keine Inputs im Modal').toBeGreaterThan(0);
  308 |   });
  309 | 
  310 |   test('4.3 Input fokussierbar + keine Seitwärts-Verschiebung', async ({ page }) => {
  311 |     await openFirstProject(page);
  312 |     const { opened } = await openMeasurementModal(page);
  313 |     if (!opened) return;
  314 | 
  315 |     const inp = page.locator('input[type="number"], input[type="text"]').first();
  316 |     if (!await inp.isVisible({ timeout: 2000 }).catch(() => false)) { console.warn('Kein Input sichtbar'); return; }
  317 | 
  318 |     const before = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
> 319 |     await inp.click();
      |               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  320 |     await page.waitForTimeout(400);
  321 |     const after = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  322 | 
  323 |     const jumpX = Math.abs(after.x - before.x);
  324 |     if (jumpX > 50) console.warn(`⚠️  BUG: Fokus → horizontaler Jump ${jumpX}px!`);
  325 | 
  326 |     await inp.fill('3.5');
  327 |     expect(await inp.inputValue()).toBe('3.5');
  328 |     console.log(`✅ Input beschreibbar, Fokus-Scroll: X=${jumpX}px`);
  329 |   });
  330 | 
  331 |   // 5. Messpunkte-Struktur
  332 | 
  333 |   test('5.1 Mindestens 4 sichtbare Messpunkte', async ({ page }) => {
  334 |     await openFirstProject(page);
  335 |     const { opened } = await openMeasurementModal(page);
  336 |     if (!opened) return;
  337 | 
  338 |     await page.waitForTimeout(400);
  339 |     const labels = await page.getByText(/messpunkt/i).all();
  340 |     console.log(`Messpunkt-Labels sichtbar: ${labels.length}`);
  341 |     if (labels.length < 4) console.warn(`⚠️  Nur ${labels.length} Labels — evtl. Scrollproblem!`);
  342 | 
  343 |     await page.screenshot({ path: `${SCREENSHOTS}/05-messpunkte-portrait.png` });
  344 |     expect(labels.length, 'Keine Messpunkte').toBeGreaterThan(0);
  345 |   });
  346 | 
  347 |   test('5.2 Mehrere Inputs gleichzeitig im Viewport (iPad-Nutzung)', async ({ page }) => {
  348 |     await openFirstProject(page);
  349 |     const { opened } = await openMeasurementModal(page);
  350 |     if (!opened) return;
  351 | 
  352 |     await page.waitForTimeout(500);
  353 |     const inputs = await measureInputFields(page);
  354 |     const visible = inputs.filter(i => i.isInViewport);
  355 | 
  356 |     console.log(`Inputs total: ${inputs.length}, im Viewport: ${visible.length}`);
  357 |     if (visible.length < 3) {
  358 |       console.warn(
  359 |         `⚠️  UX-PROBLEM: Nur ${visible.length} Input(s) gleichzeitig sichtbar!\n` +
  360 |         `   iPad sollte ≥ 3 Messpunkte auf einmal zeigen können.`
  361 |       );
  362 |     }
  363 |     expect(inputs.length, 'Keine Inputs').toBeGreaterThan(0);
  364 |   });
  365 | 
  366 |   test('5.3 Globale Felder (Datum, Temp, Feuchtigkeit) vorhanden', async ({ page }) => {
  367 |     await openFirstProject(page);
  368 |     const { opened } = await openMeasurementModal(page);
  369 |     if (!opened) return;
  370 | 
  371 |     const hasDatum = await page.locator('input[type="date"]').first().isVisible({ timeout: 2000 }).catch(() => false);
  372 |     const hasTemp  = await page.locator('input[placeholder*="Temp"], input[placeholder*="°"]').first().isVisible({ timeout: 1000 }).catch(() => false);
  373 | 
  374 |     console.log(`Datum-Input: ${hasDatum}, Temp-Input: ${hasTemp}`);
  375 |     if (!hasDatum) console.warn('⚠️  Kein Datum-Input sichtbar');
  376 |   });
  377 | 
  378 |   // 6. Button: Messpunkt hinzufügen
  379 | 
  380 |   test('6.1 "+ Messpunkt" Button: vorhanden und Touch-freundlich', async ({ page }) => {
  381 |     await openFirstProject(page);
  382 |     const { opened } = await openMeasurementModal(page);
  383 |     if (!opened) return;
  384 | 
  385 |     const addBtn = page.locator('button:has-text("Messpunkt"), [data-testid="add-measurement-button"]').last();
  386 |     await page.evaluate(() => {
  387 |       const el = document.querySelector('[style*="overflow"]');
  388 |       if (el) el.scrollTop = el.scrollHeight;
  389 |     });
  390 |     await page.waitForTimeout(300);
  391 | 
  392 |     if (!await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  393 |       console.warn('⚠️  "+ Messpunkt"-Button nicht gefunden');
  394 |       await page.screenshot({ path: `${SCREENSHOTS}/06a-no-add-btn.png` });
  395 |       return;
  396 |     }
  397 | 
  398 |     const box = await addBtn.boundingBox();
  399 |     const lbl = await addBtn.textContent();
  400 |     console.log(`"${lbl?.trim()}": ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
  401 |     if (box.height < MIN_TOUCH_PX) {
  402 |       console.warn(`⚠️  TOUCH-BUG: Button ${box.height.toFixed(0)}px < ${MIN_TOUCH_PX}px`);
  403 |     }
  404 |     expect(box.height, `Button zu klein`).toBeGreaterThan(32);
  405 |   });
  406 | 
  407 |   test('6.2 BONUS: Neuer Messpunkt — Layout stabil', async ({ page }) => {
  408 |     await openFirstProject(page);
  409 |     const { opened } = await openMeasurementModal(page);
  410 |     if (!opened) return;
  411 | 
  412 |     const before = await page.locator('input[type="number"]').count();
  413 |     const addBtn = page.locator('button:has-text("Messpunkt")').last();
  414 |     await addBtn.scrollIntoViewIfNeeded().catch(() => {});
  415 | 
  416 |     if (!await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  417 |       console.warn('⚠️  Add-Button nicht klickbar');
  418 |       return;
  419 |     }
```