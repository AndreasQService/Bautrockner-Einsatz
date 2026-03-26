import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Upload, FileText, X, Image as ImageIcon } from "lucide-react";
import { createPortal } from 'react-dom';
import { GoogleGenerativeAI } from "@google/generative-ai";

function safeName(filename) {
  return filename.replace(/[^\w.\-]+/g, "_");
}

/*
 * UploadPanel - "Smart Universal Dropzone"
 * - Akzeptiert: PDF, MSG, TXT (Analyse) UND Bilder (JPG, PNG) (Direkt-Upload)
 * - Verarbeitet alles automatisch (Client-Side AI Analysis)
 */
export default function UploadPanel({ caseId, onCaseCreated, onExtractionComplete, onImagesUploaded }) {
  console.log("UploadPanel Loaded - VERSION 2026.1.1 (Gemini-1.5-Flash)");
  const [files, setFiles] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // --- Helper: Ensure Case ID ---
  async function ensureCaseId() {
    console.log("ensureCaseId called, current caseId:", caseId);
    if (caseId) return caseId;
    const newId = "TMP-" + Date.now();
    console.log("Creating temporary caseId:", newId);

    const { error } = await supabase
      .from("damage_reports")
      .insert({ id: newId, report_data: {} });

    if (error) {
      console.error("ensureCaseId insert error:", error);
      throw error;
    }

    onCaseCreated?.(newId);
    return newId;
  }


  // --- CLIENT SIDE AI ANALYSIS HELPER ---
  const analyzeWithAI = async (textContext) => {
    const apiKey = (localStorage.getItem('gemini_api_key') || localStorage.getItem('google_api_key') || import.meta.env.VITE_GOOGLE_API_KEY || '').trim();
    if (!apiKey) {
      alert("Kein Google Gemini API Key gefunden.");
      return null;
    }
    console.log("Using API Key starting with:", apiKey.substring(0, 8) + "...");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      console.log("Analyzing with AI. Text length:", textContext.length);

      const prompt = `Du bist ein technischer Daten-Parser für die AG-App (Q-Service).

Deine Aufgabe ist es, unstrukturierte Texte aus E-Mails, PDF-Inhalten oder kopierten Schadensmeldungen in exakt ein valides JSON-Objekt zu überführen.

WICHTIG:
- Gib ausschliesslich valides JSON zurück.
- Keine Erklärungen.
- Keine Markdown-Backticks.
- Keine Kommentare.
- Keine Platzhalter wie "string", "unknown", "n/a", null oder ähnliche Werte.
- Fehlende Werte immer als leerer String "" ausgeben.
- Erfinde niemals Informationen.
- Alle Felder der vorgegebenen JSON-Struktur müssen immer vorhanden sein.
- Keine zusätzlichen Felder erzeugen.
- Wenn mehrere mögliche Werte vorhanden sind, wähle den direktesten und eindeutigigsten Wert aus dem Text.
- Wenn eine Information nicht eindeutig zuordenbar ist, Feld leer lassen.
- Leere Arrays sind erlaubt, wenn keine Einträge vorhanden sind.

ROLLENLOGIK
Nur diese Rollen sind erlaubt:
- "Handw." = Firmen, Techniker, Sanitär, Handwerker
- "Verw." = Verwaltung, Bewirtschaftung, Immobilienfirma
- "Mieter" = Bewohner oder Nutzer des Objekts
- "Eig." = Eigentümer
- "HW" = Hauswart

ALLGEMEINE ZUORDNUNGSREGEL
- Trenne konsequent zwischen Firma und Person:
  - "firma" = Firmenname / Organisation
  - "name" = Vorname + Nachname der Kontaktperson
- Wenn es sich um eine Privatperson handelt:
  - "firma" = ""
  - "name" = Vorname + Nachname
- Wenn keine Kontaktperson genannt ist:
  - "name" = ""
- Rollen nur gemäss der erlaubten Rollenlogik setzen.

AUFTRAGGEBER-REGEL
Der Auftraggeber ist immer die Partei, die Q-Service direkt kontaktiert und den Einsatz auslöst.
Massgebend ist der direkte Absender bzw. die Partei, die Q-Service zur Intervention auffordert.

Für "auftraggeber" gilt:
- "firma" = Firmenname, wenn der Auftraggeber eine Firma oder Organisation ist
- "firma" = "" wenn der Auftraggeber eine Privatperson ist
- "name" = Vorname + Nachname der direkten Kontaktperson
- "rolle" = gemäss Rollenlogik
- "telefon" = Haupttelefonnummer des Auftraggebers
- "email" = Haupt-E-Mail-Adresse des Auftraggebers
- "strasse_nr" = Strasse + Hausnummer des Auftraggebers
- "plz" = PLZ des Auftraggebers
- "ort" = Ort des Auftraggebers
- Niemals kombiniert als "plz_ort"

WICHTIG:
- Eigentümer ist nicht automatisch Auftraggeber.
- Verwaltung ist nicht automatisch Auftraggeber.
- Wenn eine Sanitärfirma / Handwerker Q-Service direkt kontaktiert:
  → Auftraggeber = diese Firma, Rolle = "Handw."
- Wenn eine Verwaltung Q-Service direkt kontaktiert:
  → Auftraggeber = diese Verwaltung, Rolle = "Verw."
- Wenn ein Mieter Q-Service direkt kontaktiert:
  → Auftraggeber = dieser Mieter, Rolle = "Mieter"
- Wenn mehrere Telefonnummern vorhanden sind, nimm die wichtigste direkte Kontaktnummer.
- Wenn mehrere E-Mails vorhanden sind, nimm die direkte Hauptadresse der Kontaktpartei.
- Wenn mehrere Adressen vorhanden sind, nimm die Adresse des direkten Auftraggebers.
- Die Adresse des Auftraggebers stammt häufig aus der E-Mail-Signatur.
- Auftraggeberadresse und Schadenort strikt getrennt halten.

VERWALTUNG
Für "verwaltung" gilt:
- "firma" = Name der Verwaltungsfirma
- "name" = Vorname + Nachname der Ansprechperson in der Verwaltung
- "rolle" = "Verw."
- "telefon" = direkte Telefonnummer oder Hauptnummer
- "email" = direkte E-Mail oder Hauptadresse

MIETER-REGEL
- Es können mehrere Mieter vorhanden sein.
- Jeden Mieter separat im Array "mieter" erfassen.
- Wohnungsangaben niemals in "name" integrieren.
- "wohnung" = Wohnungsangabe (z.B. "EG links", "2. OG rechts", "Attika", "B1804")
- "firma" = "", "rolle" = "Mieter"
- Wenn keine Wohnungsangabe: "wohnung" = ""

EIGENTÜMER-REGEL
- "firma" = Firmenname / Organisation (leer bei Privatperson)
- "name" = nur der Personenname, keine Adresse
- "rolle" = "Eig."

HAUSWART-REGEL
- "firma" = Firmenname wenn vorhanden, sonst ""
- "rolle" = "HW"

HANDWERKER-REGEL
- Weitere Handwerker/Sanitärfirmen (nicht Auftraggeber) als Array in "handwerker"
- "rolle" = "Handw."

SCHADENORT-REGEL
- Der Schadenort hat Vorrang gegenüber Absenderadresse/Verwaltungsadresse.
- "bezeichnung" = Wohnungs- oder Lagebezeichnung (z.B. "B1804 Penthouse", "2. OG links")
- "plz" = PLZ des Schadenorts – niemals kombiniert als "plz_ort"
- "ort" = Ort des Schadenorts – niemals kombiniert als "plz_ort"
- Schadenort nicht aus Eigentümer- oder Verwaltungsadresse ableiten.
- PLZ/Ort DÜRFEN aus deinem Wissen über Schweizer Geographie ergänzt werden, wenn die Strasse eindeutig einem Ort zugeordnet werden kann (z.B. Leutschenbachstrasse → PLZ 8050, Ort Zürich). Nur wenn wirklich keine Zuordnung möglich ist, Felder leer lassen.

SCHADEN-REGEL
- "art" = kurze Bezeichnung (z.B. "Wasserschaden", "Leckage", "Rohrbruch")
- "beschreibung" = kurze sachliche Zusammenfassung

TELEFONFORMAT: +41 XX XXX XX XX (079 123 45 67 → +41 79 123 45 67)

AUSGABEREGELN
- Gib ausschliesslich ein einziges valides JSON-Objekt zurück
- Keine Einleitung, kein Nachsatz, keine Kommentare
- Leere Arrays verwenden, wenn keine Einträge vorhanden sind

Verwende exakt diese JSON-Struktur:
{
  "auftraggeber": {
    "firma": "",
    "name": "",
    "rolle": "",
    "telefon": "",
    "email": "",
    "strasse_nr": "",
    "plz": "",
    "ort": ""
  },
  "verwaltung": {
    "firma": "",
    "name": "",
    "rolle": "Verw.",
    "telefon": "",
    "email": ""
  },
  "mieter": [],
  "eigentuemer": {
    "firma": "",
    "name": "",
    "rolle": "Eig.",
    "telefon": "",
    "email": ""
  },
  "hauswart": {
    "firma": "",
    "name": "",
    "rolle": "HW",
    "telefon": "",
    "email": ""
  },
  "handwerker": [],
  "schadenort": {
    "bezeichnung": "",
    "strasse_nr": "",
    "plz": "",
    "ort": ""
  },
  "schaden": {
    "art": "",
    "beschreibung": ""
  }
}

INPUT DATEN:
${textContext}`;

      let result;
      // Modell-Erkennung: einmal pro Session gecacht → kein wiederholter Discovery-Call
      let attempts;
      const cachedModel = sessionStorage.getItem('gemini_working_model');
      if (cachedModel) {
        attempts = [JSON.parse(cachedModel)];
        console.log("Verwende gecachtes Modell:", cachedModel);
      } else {
        // Einmalige Discovery um das richtige Modell zu finden
        let discoveredModels = [];
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const data = await res.json();
          if (data?.models) {
            discoveredModels = data.models
              .map(m => m.name.replace('models/', ''))
              .filter(n => n.includes('flash') && !n.includes('vision') && !n.includes('exp'));
            console.log("Verfügbare Flash-Modelle:", discoveredModels);
          }
        } catch (e) { console.warn("Discovery fehlgeschlagen:", e); }

        // Fallback-Reihenfolge wenn Discovery nichts liefert
        const fallback = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"];
        const modelList = discoveredModels.length > 0 ? discoveredModels : fallback;
        attempts = modelList.slice(0, 4).flatMap(m => [
          { model: m, version: "v1beta" },
          { model: m, version: "v1" }
        ]);
      }

      let lastError;
      let hasQuotaError = false;

      for (const attempt of attempts) {
        try {
          console.log(`Versuch: ${attempt.model} (${attempt.version})...`);
          const model = genAI.getGenerativeModel({ model: attempt.model }, { apiVersion: attempt.version });
          result = await model.generateContent(prompt);
          if (result) {
            console.log(`ERFOLG! Antwort von ${attempt.model} (${attempt.version})`);
            // Erfolgreiches Modell für diese Session cachen → kein Discovery mehr nötig
            sessionStorage.setItem('gemini_working_model', JSON.stringify(attempt));
            break;
          }
        } catch (err) {
          lastError = err;
          const msg = err.message || "";
          console.warn(`Fehlgeschlagen: ${attempt.model} (${attempt.version})`, msg);

          if (msg.includes('429') || msg.includes('Quota') || msg.includes('limit')) {
            hasQuotaError = true;
            continue;
          } else if (msg.includes('404') || msg.includes('not found') || msg.includes('supported') || msg.includes('available')) {
            continue;
          } else {
            throw err;
          }
        }
      }

      if (!result) {
        if (hasQuotaError) throw new Error("API-Limit erreicht. Bitte eine Minute warten.");
        throw lastError;
      }

      const response = await result.response;
      let aiContent = response.text().trim();

      // Cleanup for JSON (sometimes models add backticks anyway)
      aiContent = aiContent.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

      const parsedData = JSON.parse(aiContent);
      console.log('[UploadPanel] parsedData:', { auftraggeber: parsedData.auftraggeber, schadenort: parsedData.schadenort });
      return parsedData;

    } catch (e) {
      console.error("Gemini Analysis Failed", e);
      let errorMsg = e.message || "Unbekannter Fehler";
      if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('limit')) {
        errorMsg = "API-Limit erreicht (Free Tier). Bitte warten Sie ca. 60 Sekunden, bevor Sie es erneut versuchen.";
      }
      setStatus("❌ Fehler bei der KI-Analyse: " + errorMsg);
      return null;
    }
  };

  // --- PDF PARSER HELPER ---
  const processPdfFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs = await import('pdfjs-dist/build/pdf');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Seite ${i} ---\n${pageText}\n\n`;
      }
      return fullText;
    } catch (e) {
      console.error("PDF Parse Error", e);
      throw new Error("PDF konnte nicht gelesen werden.");
    }
  };

  // --- Auto-Start Workflows ---
  // 1. Files Trigger
  useEffect(() => {
    console.log("Files change effect triggered. Count:", files.length, "Loading:", loading);
    if (files.length > 0 && !loading) {
      console.log("Auto-starting handleUploadFiles...");
      handleUploadFiles();
    }
  }, [files]);

  // 2. Text: Nur per Button-Klick analysieren (kein Auto-Debounce = weniger API-Calls)


  // --- File Handling ---
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    console.log("File drop event detected!");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      console.log("Dropped files to set:", droppedFiles.map(f => f.name));
      setFiles(droppedFiles);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log("Manual file select detected.");
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };


  // --- Action: Upload & Analyze Files (Smart Handling) ---
  const handleUploadFiles = async () => {
    if (!files || files.length === 0) return;
    console.log("handleUploadFiles execution started.");
    setLoading(true);
    setStatus("⏳ Verarbeite Dateien...");

    try {
      const id = await ensureCaseId();
      console.log("Using Case ID:", id);
      let newImages = [];
      let combinedClientText = "";
      let extractionResults = [];

      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        console.log("Processing item:", lowerName);

        // --- TYPE 1: BILDER ---
        if (lowerName.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/)) {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filePath = `cases/${id}/images/${timestamp}_${safeName(file.name)}`;
            console.log("Uploading image:", filePath);
            await supabase.storage.from("case-files").upload(filePath, file);
            const { data: { publicUrl } } = supabase.storage.from("case-files").getPublicUrl(filePath);

            newImages.push({
              preview: publicUrl,
              name: file.name,
              description: 'Anhang',
              date: new Date().toISOString(),
              assignedTo: 'Sonstiges'
            });
          } catch (e) { console.error("Image upload failed", e); }
        }

        // --- TYPE 2: DOKUMENTE ---
        else if (lowerName.match(/\.(pdf|msg|txt)$/)) {
          console.log("Handling document:", lowerName);
          try {
            const isPdf = lowerName.endsWith(".pdf");
            const isMsg = lowerName.endsWith(".msg");
            const isTxt = lowerName.endsWith(".txt");

            const fileTypeLabel = isPdf ? "pdf" : (isMsg ? "msg" : "txt");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filePath = `cases/${id}/original/${timestamp}_${safeName(file.name)}`;

            console.log("Uploading original to:", filePath);
            const { error: uploadError } = await supabase.storage.from("case-files").upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;

            // --- PFLICHT: DB Eintrag in case_documents ---
            console.log("Creating DB record in case_documents...");
            const { data: docRecord, error: dbError } = await supabase
              .from("case_documents")
              .insert({
                case_id: id,
                file_path: filePath,
                file_type: isPdf ? 'pdf' : (isMsg ? 'msg' : 'txt'),
                original_filename: file.name,
                extraction_status: 'pending'
              })
              .select()
              .single();

            if (dbError) {
              console.warn("Could not create case_documents record:", dbError);
            }

            // --- TRIGGER EXTRACTION ---
            if ((isPdf || isMsg || isTxt) && docRecord) {
              setStatus(`⏳ Analysiere ${file.name} (Edge Function)...`);
              console.log("Invoking 'extract' function for doc:", docRecord.id);

              const { data: extraction, error: funcError } = await supabase.functions.invoke("extract", {
                body: { document_id: docRecord.id }
              });

              if (funcError) {
                console.error("Edge Function Error:", funcError);
                // Fallback to client-side if server fails
                if (isPdf) combinedClientText += await processPdfFile(file) + "\n\n";
              } else if (extraction?.success && extraction.data) {
                console.log("Edge Function extraction success!");
                extractionResults.push(extraction.data);
              }
            }
            else if (isTxt) {
              combinedClientText += await file.text() + "\n\n";
            }
            else if (isPdf && !docRecord) {
              // Fallback client-side PDF parsing if no DB record
              combinedClientText += await processPdfFile(file) + "\n\n";
            }
          } catch (e) { console.error("Doc processing failed", e); }
        }
      }

      // --- AGGREGATE RESULTS ---
      let finalResult = null;

      // If we have Edge Function results, use the first one (or merge if needed)
      if (extractionResults.length > 0) {
        finalResult = extractionResults[0]; // Simple approach: take first
        // TODO: Implement smart merge if multiple docs
      }

      // If we have additional text (pasted or fallback), augment with Gemini
      if (combinedClientText.trim()) {
        console.log("Text gathered for client-side analysis. Calling AI...");
        const aiResult = await analyzeWithAI(combinedClientText);
        if (aiResult) {
          // If we had no Edge result, take Gemini. If we have both, maybe merge?
          if (!finalResult) {
            finalResult = aiResult;
          } else {
            console.log("Both Server and Client results available. Keeping Server as primary.");
          }
        }
      }

      if (finalResult) {
        setPreviewData(finalResult);
        setStatus("✅ Dokumente analysiert.");
      } else if (newImages.length > 0) {
        setStatus("✅ Bilder hochgeladen.");
      } else {
        setStatus("ℹ️ Keine extrahierbaren Daten gefunden.");
      }

      if (newImages.length > 0 && onImagesUploaded) {
        onImagesUploaded(newImages);
      }

      setFiles([]);

    } catch (err) {
      console.error("handleUploadFiles error:", err);
      setStatus(`❌ Fehler: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  // --- Action: Analyze Text Input ---
  const handleAnalyzeText = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setStatus("⏳ Analysiere Text...");

    try {
      const aiResult = await analyzeWithAI(textInput);
      if (aiResult) {
        setStatus("✅ Analyse bereit.");
        setPreviewData(aiResult);
        setTextInput("");
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ Fehler: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- PREVIEW RENDERER (Overlay) ---
  const renderPreview = () => {
    if (!previewData) return null;
    const upd = (key, field, val) => setPreviewData(p => ({ ...p, [key]: { ...p[key], [field]: val } }));
    const updMieter = (idx, field, val) => setPreviewData(p => ({
      ...p, mieter: (Array.isArray(p.mieter) ? p.mieter : [p.mieter]).map((m, i) => i === idx ? { ...m, [field]: val } : m)
    }));
    const singleRoles = [
      { key: 'auftraggeber', label: 'Auftraggeber', color: '#3b82f6', fields: [['firma', 'Firma'], ['name', 'Ansprechperson'], ['telefon', 'Telefon'], ['email', 'E-Mail']] },
      { key: 'verwaltung', label: 'Verwaltung', color: '#f59e0b', fields: [['firma', 'Firma'], ['name', 'Ansprechperson'], ['telefon', 'Telefon'], ['email', 'E-Mail']] },
      { key: 'eigentuemer', label: 'Eigentümer', color: '#8b5cf6', fields: [['name', 'Name'], ['telefon', 'Telefon'], ['email', 'E-Mail']] },
      { key: 'handwerker', label: 'Handwerker', color: '#ef4444', fields: [['name', 'Name'], ['telefon', 'Telefon'], ['email', 'E-Mail']] },
      { key: 'hauswart', label: 'Hauswart', color: '#94a3b8', fields: [['name', 'Name'], ['telefon', 'Telefon'], ['email', 'E-Mail']] },
    ];
    const mieterList = Array.isArray(previewData.mieter) ? previewData.mieter : (previewData.mieter?.name ? [previewData.mieter] : []);

    return createPortal(
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '16px', width: '920px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>KI-Analyse Ergebnis</h2>
            <button onClick={() => setPreviewData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
          </div>

          {/* Schadenort + Schaden */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h4 style={{ marginTop: 0, color: '#ef4444', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schadenort</h4>
              {[['bezeichnung', 'Bezeichnung / Wohnung'], ['strasse_nr', 'Strasse & Nr.'], ['plz', 'PLZ'], ['ort', 'Ort']].map(([f, l]) => (
                <div key={f} style={{ marginBottom: '0.6rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>{l}</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.schadenort?.[f] || ''} onChange={e => upd('schadenort', f, e.target.value)} />
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: 'rgba(139,92,246,0.08)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <h4 style={{ marginTop: 0, color: '#8b5cf6', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schaden</h4>
              {[['art', 'Art des Schadens'], ['beschreibung', 'Beschreibung']].map(([f, l]) => (
                <div key={f} style={{ marginBottom: '0.6rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>{l}</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.schaden?.[f] || ''} onChange={e => upd('schaden', f, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Kontakte – Einzelrollen */}
          <h4 style={{ color: '#10b981', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Kontakte</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {singleRoles.map(({ key, label, color, fields }) => (
              <div key={key} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '10px', borderLeft: `3px solid ${color}` }}>
                {/* Überschrift = Dropdown zur Rollenkorrektur */}
                <select
                  value={previewData[key]?._blockRolle || key}
                  onChange={e => upd(key, '_blockRolle', e.target.value)}
                  style={{
                    fontSize: '0.75rem', fontWeight: 700, color, marginBottom: '0.6rem',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: 'transparent', border: 'none', borderBottom: `1px solid ${color}`,
                    cursor: 'pointer', width: '100%', padding: '0 0 2px 0',
                    appearance: 'auto', outline: 'none'
                  }}
                >
                  <option value="auftraggeber">AUFTRAGGEBER (AG)</option>
                  <option value="verwaltung">VERWALTUNG (Verw.)</option>
                  <option value="eigentuemer">EIGENTÜMER (Eig.)</option>
                  <option value="hauswart">HAUSWART (HW)</option>
                  <option value="handwerker">HANDWERKER (Handw.)</option>
                  <option value="mieter">MIETER</option>
                </select>
                {fields.map(([f, l]) => (
                  <div key={f} style={{ marginBottom: '0.4rem' }}>
                    <label style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', marginBottom: '1px' }}>{l}</label>
                    <input className="form-input" style={{ width: '100%', fontSize: '0.85rem', padding: '0.3rem 0.5rem' }} value={previewData[key]?.[f] || ''} onChange={e => upd(key, f, e.target.value)} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Mieter – Array */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Mieter ({mieterList.length})</div>
            {mieterList.map((m, idx) => (
              <div key={idx} style={{ backgroundColor: 'rgba(16,185,129,0.06)', padding: '0.75rem', borderRadius: '10px', borderLeft: '3px solid #10b981', marginBottom: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 120px 1fr 1fr', gap: '0.5rem' }}>
                {[['name', 'Name'], ['wohnung', 'Wohnung'], ['telefon', 'Telefon'], ['email', 'E-Mail']].map(([f, l]) => (
                  <div key={f}>
                    <label style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', marginBottom: '1px' }}>{l}</label>
                    <input className="form-input" style={{ width: '100%', fontSize: '0.85rem', padding: '0.3rem 0.5rem' }} value={m[f] || ''} onChange={e => updMieter(idx, f, e.target.value)} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.25rem' }}>
            <button onClick={() => setPreviewData(null)} className="btn btn-outline" style={{ minWidth: '120px' }}>Abbrechen</button>
            <button onClick={() => { if (onExtractionComplete) onExtractionComplete(previewData); setPreviewData(null); }} className="btn btn-primary" style={{ minWidth: '180px', backgroundColor: '#10b981', border: 'none' }}>Daten übernehmen</button>
          </div>
        </div>
      </div>,
      document.body
    );
  };


  return (
    <>
      {renderPreview()}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: 16 }}>
        {/* --- Drag & Drop Zone (Smart) --- */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? '#2563eb' : '#4b5563'}`,
            borderRadius: "8px",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: dragActive ? "rgba(37, 99, 235, 0.1)" : "transparent",
            transition: "all 0.2s ease",
            cursor: "pointer",
            position: "relative"
          }}
          onClick={() => document.getElementById('file-upload-input').click()}
        >
          <input
            id="file-upload-input"
            type="file"
            multiple
            accept=".pdf,.msg,.txt,.jpg,.jpeg,.png,.gif,.heic,.heif,application/pdf,image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
            <Upload size={32} style={{ color: "var(--text-muted)" }} />
            <ImageIcon size={32} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ margin: 0, fontWeight: 500, color: "var(--text-main)" }}>
            Alles hier ablegen: Dokumente & Bilder
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            PDF, MSG, TXT (Analyse) + JPG, PNG (Galerie)
          </p>

          {files.length > 0 && (
            <div style={{ marginTop: "1rem", width: "100%", maxWidth: "300px" }} onClick={(e) => e.stopPropagation()}>
              {files.map((f, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--surface)", padding: "0.5rem", borderRadius: "4px", marginBottom: "0.25rem",
                  border: "1px solid var(--border)"
                }}>
                  <span style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </span>
                  <button onClick={() => removeFile(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={handleUploadFiles}
                disabled={loading}
                style={{
                  width: "100%", marginTop: "0.5rem", padding: "0.5rem",
                  backgroundColor: "var(--primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? "Verarbeite ..." : "Starten (Alles autom.)"}
              </button>
            </div>
          )}
        </div>

        {/* --- Text Input Area --- */}
        <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "8px", backgroundColor: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <FileText size={18} style={{ color: "var(--text-muted)" }} />
            <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>Projektimport</strong>
          </div>

          {/* PDF Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.08)'; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
            onDrop={async (e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
              const file = e.dataTransfer.files[0];
              if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
              setStatus('⏳ PDF wird gelesen...');
              try {
                const text = await processPdfFile(file);
                setTextInput(prev => prev ? prev + '\n\n' + text : text);
                setStatus('✅ PDF-Text extrahiert — jetzt analysieren');
              } catch {
                setStatus('❌ PDF konnte nicht gelesen werden');
              }
            }}
            onClick={() => document.getElementById('pdf-text-input').click()}
            style={{
              border: '1.5px dashed rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '0.6rem 1rem',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              backgroundColor: 'rgba(255,255,255,0.03)',
              cursor: 'pointer', marginBottom: '0.75rem',
              fontSize: '0.8rem', color: 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            <input id="pdf-text-input" type="file" accept=".pdf" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setStatus('⏳ PDF wird gelesen...');
              try {
                const text = await processPdfFile(file);
                setTextInput(prev => prev ? prev + '\n\n' + text : text);
                setStatus('✅ PDF-Text extrahiert — jetzt analysieren');
              } catch {
                setStatus('❌ PDF konnte nicht gelesen werden');
              }
              e.target.value = '';
            }} />
            <FileText size={16} />
            <span>PDF hier droppen oder klicken → Text wird extrahiert</span>
          </div>

          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Kopieren Sie hier E-Mail Text oder Notizen hinein..."
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--text-main)",
              resize: "vertical",
              fontFamily: "inherit",
              fontSize: "0.9rem"
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: status.startsWith('❌') ? '#ef4444' : '#10b981' }}>{status}</span>
            <button
              onClick={handleAnalyzeText}
              disabled={loading || !textInput.trim()}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: !textInput.trim() ? "var(--muted)" : "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: !textInput.trim() ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "..." : "Text analysieren"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
