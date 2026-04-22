# Kontroll- und Korrekturplan: Q-Service Upload & Extraktion

Dieser Plan stellt sicher, dass die Implementierung, vom Frontend bis zur Datenbank und KI-Analyse, korrekt und robust ist.

## 1. Frontend Integration (React)

### A. DamageForm.jsx (Hauptkomponente)
- [x] **Platzierung prüfen**: `UploadPanel` ist direkt unter dem Header (Projekt-Titel & Status) und *vor* dem "Auftrag & Verwaltung" Block platziert.
- [x] **State Management**:
    - `caseId` wird korrekt an `UploadPanel` übergeben.
    - Wenn `UploadPanel` eine neue `caseId` generiert (bei neuen Projekten), wird diese an `DamageForm` zurückgemeldet.
    - **WICHTIG**: Wenn die Extraktion fertig ist, werden die Daten (Adresse, Kontakte, etc.) in das `formData` des `DamageForm` übernommen (via `onExtractionComplete` Callback).

### B. UploadPanel.jsx
- [x] **Case ID Handling**: Sicherstellen, dass eine `caseId` existiert oder erstellt wird, bevor der Upload startet.
- [x] **Upload Logik**: Upload in Bucket `case-files` mit Pfad `cases/{caseId}/original/{filename}`.
- [x] **DB Eintrag**: Neuer Eintrag in `case_documents` mit Status `pending`.
- [x] **Trigger**: Aufruf der Edge Function `extract` via Supabase Client.
- [x] **Feedback Loop**:
    - Warten auf Antwort der Edge Function.
    - Bei Erfolg: Empfangene Daten (JSON) an `DamageForm` übergeben (via `onExtractionComplete`).
    - Status-Anzeige für den User aktualisieren.

## 2. Datenbank (Supabase)

### A. Tabellen & Speicher (Migration)
- [x] **Bucket**: `case-files` existiert und ist public/authenticated accessible.
- [x] **Tabelle**: `case_documents` (Tracking der Dateien).
- [x] **Tabelle**: `case_extractions` (Speichern der Rohergebnisse).
- [x] **RLS**: Policies auf `authenticated` UND `anon` (für Dev-Testing) gesetzt.

### B. Datenfluss
- [x] Prüfen, ob der User (auch anonym/lokal) Schreibrechte hat. *Korrektur: 'anon' Policies wurden hinzugefügt.*

## 3. Backend Logic (Edge Function)

### A. Funktion `extract`
- [x] **Imports**: Deno-Imports (URL-basierte Imports) sind korrekt.
- [x] **Ablauf**:
    1. `document_id` empfangen.
    2. Datei aus Storage laden.
    3. Text extrahieren (PDF Parsing via `pdf-parse`).
  4. KI-Analyse via Gemini (1.5-Flash) mit Unified Schema.
  5. Ergebnis in `case_extractions` speichern.
  6. Ergebnis als JSON Response zurückgeben.

## 4. Durchführung der Korrekturen

1. **UploadPanel.jsx erweitert**: DB-Einträge & Function-Trigger implementiert.
2. **DamageForm.jsx angepasst**: `UploadPanel` an der richtigen Stelle eingefügt und mit `handleEmailImport` verbunden.
3. **Edge Function Deploy**: Struktur und Schema für Gemini vereinheitlicht.

---

## Aktueller Status (2026-03-01)
Alle Punkte des Plans wurden erfolgreich implementiert. Die App ist nun bereit für den vollen Workflow: Upload -> DB-Logging -> Edge Function Extraction -> UI Preview -> Data Import.
