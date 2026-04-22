
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

// Section 2: Technischer Daten-Parser (Master-Prompt)
doc.setFontSize(16);
doc.setTextColor(30, 41, 59);
doc.text("2. Master-Prompt (Technical Parser Rules)", 20, nextY + 10);
doc.setFontSize(10);
nextY = addList([
    "ADRESS-SPLIT (PFLICHT): Harter Cut-Off bei Eigentümer sobald Adresse folgt.",
    "MAPPING: Cut-Off Bestandteile MÜSSEN in Strasse/PLZ/Ort verschoben werden.",
    "PLATZHALTER-VERBOT: Ausgabe von 'string' ist strengstens untersagt.",
    "REALDATEN-PFLICHT: Felder ohne Daten bleiben leer (\"\") statt Platzhalter.",
    "FORMATIERUNG: Telefon auf +41 XX XXX XX XX formatieren, Namen trennen."
], nextY + 17);

// Section 3: Rollen-Mapping (Exklusiv)
doc.setFontSize(16);
doc.setTextColor(30, 41, 59);
doc.text("3. Rollen-Mapping (Exklusive Werte)", 20, nextY + 10);
doc.setFontSize(10);
nextY = addList([
    "Mieter: Bewohner vor Ort / im Objekt.",
    "Eig.: Eigentümer der Liegenschaft (Entität aus Eigentümer-Feld).",
    "HW: Hauswart.",
    "Verw.: Verwaltung / Bewirtschaftung.",
    "Handw.: Externe Firmen & Techniker (Meldung/Behebung des Schadens)."
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
