
import { jsPDF } from 'jspdf';
import fs from 'fs';

const doc = new jsPDF();

// Hilfsfunktion fuer einfache Listen
function addList(items, startY) {
    let y = startY;
    items.forEach(item => {
        doc.text("- " + item, 25, y);
        y += 7;
    });
    return y;
}

// Header
doc.setFontSize(22);
doc.setTextColor(16, 185, 129); // QService Green
doc.text("Spezifikation: AG Wasserschaden-App", 20, 20);
doc.setFontSize(12);
doc.setTextColor(100, 116, 139);
doc.text("Version 2026.2 - Technisches Master-Sheet", 20, 30);

// Divider
doc.setDrawColor(226, 232, 240);
doc.line(20, 35, 190, 35);

// Section 1: Workflow-Logik
doc.setFontSize(16);
doc.setTextColor(30, 41, 59);
doc.text("1. Workflow-Logik (Auto-Start)", 20, 45);
doc.setFontSize(10);
doc.setTextColor(51, 65, 85);
let nextY = addList([
    "Trigger: Paste-Event (Sofort) oder Debounce (1500ms bei manueller Eingabe).",
    "Single-Source: Ein zentrales Feld für PDF-Upload (OCR) und Text-Paste.",
    "Discovery: Dynamisches Abrufen verfügbarer Gemini-Modelle pro API-Key."
], 52);

// Section 2: Daten-Extraktor (Master-Prompt)
doc.setFontSize(16);
doc.setTextColor(30, 41, 59);
doc.text("2. Master-Prompt (Data Extractor Rules)", 20, nextY + 10);
doc.setFontSize(10);
nextY = addList([
    "ADRESS-TRENNUNG: Harter Cut-Off bei Erkennung von Strasse, Nr, PLZ oder Ort.",
    "EIGENTÜMER-REINFALTS-SCHUTZ: Keine Adressdaten im Namensfeld erlaubt.",
    "PLATZHALTER-VERBOT: Niemals 'string' oder 'n/a' ausgeben - nur leere Strings (\"\").",
    "RECHNUNGS-REF: 2026er Nummern gehören nur in Projekt-ID, nicht in Vermerke.",
    "SIGNATUR-LOGIK: Personen aus Firmen-Signaturen sind immer 'Handw.'."
], nextY + 17);

// Section 3: Rollen-Mapping (Exklusiv)
doc.setFontSize(16);
doc.setTextColor(30, 41, 59);
doc.text("3. Rollen-Mapping (Kürzel)", 20, nextY + 10);
doc.setFontSize(10);
nextY = addList([
    "Mieter: Bewohner vor Ort.",
    "Eig.: Eigentümer der Liegenschaft.",
    "HW: Hauswart / Abwart.",
    "Verw.: Hausverwaltung / Immobilienmanagement.",
    "Handw.: Externe Firmen & Techniker (Sanitär, Trocknung etc.)."
], nextY + 17);

// Section 4: Validierung
doc.setFontSize(16);
doc.setTextColor(30, 41, 59);
doc.text("4. Validierung & Kontrolle", 20, nextY + 10);
doc.setFontSize(10);
nextY = addList([
    "CROSS-CHECK: Prüfe, ob STRASSE leer ist, obwohl im Text eine Adresse stand.",
    "FORMAT: Telefonnummern zwingend auf +41 XX XXX XX XX formatieren.",
    "GAP-ANALYSIS: Feld für fehlende Pflichtdaten am Ende des JSON Objekts."
], nextY + 17);

// Footer
doc.setFontSize(8);
doc.setTextColor(148, 163, 184);
doc.text("Dokumentation generiert von Antigravity Assistent - " + new Date().toLocaleString(), 20, 285);

// Save Path
const pdfData = doc.output();
fs.writeFileSync('C:/QTool/Spezifikation_AG_App_2026.pdf', pdfData, 'binary');

console.log('PDF erfolgreich in C:/QTool aktualisiert.');
