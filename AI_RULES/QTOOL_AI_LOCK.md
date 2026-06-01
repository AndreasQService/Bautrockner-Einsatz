# AI-LOCK: QTool Measurement Sketch + Supabase deleted_at Fallback

> [!IMPORTANT]
> **ABSOLUTE AI-LOCK REGEL / STRICT MODE**
> Diese Fixes und Code-Bereiche sind ab jetzt vollständig **GESPERRT**. Sie dürfen unter keinen Umständen verändert, refactored, vereinfacht, optimiert, verschoben oder neu strukturiert werden.

## GESPERRTE BEREICHE & FUNKTIONEN

1. **Measurement Sketch Speicherung**
2. **measurementData.canvasImage Persistenz**
3. **Merge-Logik zwischen rooms und measurementRooms**
4. **Supabase deleted_at Fallback**
5. **report_data JSONB Save/Load**
6. **Defensive Preserve-Logik für canvasImage / sketch**

---

## GESCHÜTZTE DATEIEN & BEREICHE

### 1. `src/App.jsx`
- `sanitizeMeasurementStorage`
- `handleSaveReport`
- `fetchReports` / Projektlisten-Load
- `deleted_at` Fallback-Abfrage
- `report_data` Save/Load Logic

### 2. `src/components/DamageForm.jsx`
- Deep Merge zwischen `rooms` und `measurementRooms`
- Initialisierung von `measurementRooms`
- Synchronisation von `initialData` zu `formData`
- `MeasurementModal` `onSave` Handler
- Defensive `canvasImage` / `sketch` Preserve-Logik

---

## VERBOTEN (ABSOLUTES VERBOT)
- Keine Änderung an Measurement Sketch Save-Logik
- Keine Änderung an `canvasImage` Feldnamen
- Keine Änderung an `measurementData.canvasImage`
- Keine Änderung an `report_data` Speicherort
- Keine neue Supabase Spalte
- Keine Migration für `deleted_at`
- Keine neue Tabelle
- Keine Änderung an Supabase Schema
- Kein Umbau auf relationale Sketch-Speicherung
- Kein Entfernen des `deleted_at` Fallbacks
- Kein Entfernen der Defensiven Merge-Logik
- Kein flacher Merge von `measurementData`
- Kein Überschreiben von `canvasImage` mit `null`/`undefined`/leeren Daten
- Keine Änderung an `MeasurementModal` Canvas/Zeichenlogik
- Keine Änderung an PointerEvents / TouchEvents / Stiftlogik
- Keine PDF-Änderung
- Keine UI-Änderung
- Kein RoomManager-Refactor
- Keine Cleanup-Aktionen in diesen Bereichen

---

## ERLAUBT NUR BEI REPRODUZIERBAREM BUG
Nur wenn ein konkret reproduzierbarer Fehler exakt in diesen Bereichen nachgewiesen wird, darf ein minimaler Patch vorgeschlagen werden.
**Es gilt das folgende Protokoll:**
1. Erst Diagnose mit exakter Datei und Zeile
2. Erst Diff-Vorschlag zeigen
3. Keine Umsetzung ohne explizite Freigabe
4. Kein Refactor
5. Kein Scope-Drift

---

## WICHTIGE TECHNISCHE REGELN

### Skizzen-Speicherort bleibt:
`damage_reports.report_data.measurementRooms[i].measurementData.canvasImage`
- `canvasImage`, `sketch`, `measurementData` und `measurementRooms` dürfen **NICHT** als echte Supabase-Spalten behandelt werden!
- **Richtig:**
  ```javascript
  update({ report_data: sanitizedData })
  ```
- **Falsch:**
  ```javascript
  update({ canvasImage: ..., sketch: ..., measurementData: ... })
  ```

### Deep-Merge-Regel:
`measurementData` muss tief gemerged werden:
- **Richtig:**
  ```javascript
  measurementData: {
    ...existingRoom.measurementData,
    ...incomingRoom.measurementData,
    canvasImage: incomingCanvas || existingCanvas
  }
  ```
- **Falsch:**
  ```javascript
  measurementData: incomingRoom.measurementData
  ```

### deleted_at Regel:
QTool muss mit beiden DB-Versionen funktionieren:
- **A)** `damage_reports` mit `deleted_at`
- **B)** `damage_reports` ohne `deleted_at`
Der Fallback ohne `deleted_at` darf nicht entfernt werden.

---

## TESTPFLICHT BEI JEDEM EINGRIFF
Nach jeder Änderung außerhalb dieses Locks muss geprüft werden:
1. `npm run build` läuft fehlerfrei durch
2. Projektliste lädt ohne Supabase Fehler `42703`
3. Measurement Mode öffnet sich korrekt
4. Skizze zeichnen
5. Speichern
6. Projekt neu laden
7. Skizze bleibt sichtbar
8. Raum umbenennen
9. Speichern
10. Neu laden
11. Skizze bleibt sichtbar
