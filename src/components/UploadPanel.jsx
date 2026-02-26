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

      const prompt = `Du bist ein Daten-Extraktor für die AG Wasserschaden-App. Deine Aufgabe ist das Mapping von Texten in JSON-Felder.

1. MUSTERBASIERTE ADRESS-TRENNUNG:
   - FELD 'EIGENTÜMER': Extrahiere NUR den Namen der juristischen oder natürlichen Person.
   - TRIGGER FÜR TRENNUNG: Sobald im Textfluss ein Wort auftaucht, das auf eine Adresse hindeutet (Strasse, Str., Weg, Platz, Gasse, Allee) ODER eine Postleitzahl (4-stellig) ODER eine Hausnummer folgt, beende das Feld 'EIGENTÜMER' sofort.
   - PFLICHT: Verschiebe alle nachfolgenden Adressdaten (Strasse/Nr, PLZ, Ort) zwingend in die dafür vorgesehenen separaten Felder. Ein Überlauf der Adresse in das Namensfeld ist strikt untersagt.

2. GENERISCHE ROLLEN-LOGIK (NUR DIESE KÜRZEL):
   - 'Handw.': Jede Person, die eine Firmen-Signatur (Handwerk, Sanitär, Technik) besitzt, die NICHT die Hausverwaltung ist.
   - 'Verw.': Firmen, die als Verwaltung, Immobilienmanagement oder Bewirtschaftung bezeichnet werden.
   - 'Mieter': Personen, die als Bewohner, Mieter oder 'vor Ort' lebend beschrieben werden.
   - 'Eig.': Die Person/Firma, die unter dem Label 'Eigentümer' steht.
   - 'HW': Personen, die als Hauswart oder Abwart bezeichnet werden.

3. VERBOT VON PLATZHALTERN:
   - Es dürfen NIEMALS Wörter wie "string", "n/a" oder "unbekannt" ausgegeben werden.
   - Ist ein Feld im Quelltext nicht vorhanden, ist ein leerer String ("") auszugeben. 

4. VALIDIERUNG:
   - Prüfe vor der Ausgabe: Ist das Feld 'STRASSE' leer, obwohl im Quelltext eine Adresse steht? Wenn ja, korrigiere das Mapping.

AUSGABE-FORMAT (JSON):
{
  "projekt_daten": {
    "interne_id": "2026xxxx",
    "externe_ref": "",
    "auftrags_nr": ""
  },
  "auftrag_verwaltung": {
    "firma": "",
    "sachbearbeiter": "",
    "leistungsart": "Wasserschaden"
  },
  "rechnungs_details": {
    "eigentuemer": "",
    "email_rechnung": "",
    "vermerk": ""
  },
  "schadenort": {
    "strasse_nr": "",
    "plz_ort": "",
    "etage_wohnung": ""
  },
  "kontakte": [
    {
      "name": "",
      "rolle": "Handw. | Verw. | Mieter | Eig. | HW",
      "telefon": "+41 XX XXX XX XX"
    }
  ],
  "gap_analysis": []
}

WICHTIG: Antworte NUR mit dem validen JSON-Code, ohne Markdown-Backticks.

INPUT DATEN:
${textContext}`;

      let result;
      let discoveryModels = [];
      try {
        const discoveryRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const discoveryData = await discoveryRes.json();
        if (discoveryData && discoveryData.models) {
          discoveryModels = discoveryData.models
            .map(m => m.name.replace('models/', ''))
            .filter(name => name.includes('flash') || name.includes('pro'))
            .filter(name => !name.includes('vision') && !name.includes('experimental'));
          console.log("Dynamisch gefundene Modelle:", discoveryModels);
        }
      } catch (e) {
        console.warn("Discovery failed, using hardcoded fallback...", e);
      }

      const baseModels = discoveryModels.length > 0 ? discoveryModels : ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"];
      const attempts = [];
      baseModels.slice(0, 6).forEach(m => {
        attempts.push({ model: m, version: "v1beta" });
        attempts.push({ model: m, version: "v1" });
      });

      let lastError;
      let hasQuotaError = false;

      for (const attempt of attempts) {
        try {
          console.log(`Versuch: ${attempt.model} (${attempt.version})...`);
          const model = genAI.getGenerativeModel({ model: attempt.model }, { apiVersion: attempt.version });
          result = await model.generateContent(prompt);
          if (result) {
            console.log(`ERFOLG! Antwort von ${attempt.model} (${attempt.version})`);
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
      console.log("Successfully parsed AI results:", parsedData.projekt_daten?.interne_id);
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

  // 2. Text Paste / Debounce Trigger
  useEffect(() => {
    if (!textInput.trim() || loading) return;

    const timer = setTimeout(() => {
      console.log("Auto-starting handleAnalyzeText...");
      handleAnalyzeText();
    }, 1500);

    return () => clearTimeout(timer);
  }, [textInput]);


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
      let combinedText = "";

      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        console.log("Processing item:", lowerName);

        // --- TYPE 1: BILDER ---
        if (lowerName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
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
          console.log("Extracting text from document...");
          try {
            const fileType = lowerName.endsWith(".pdf") ? "pdf" : (lowerName.endsWith(".txt") ? "txt" : "msg");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filePath = `cases/${id}/original/${timestamp}_${safeName(file.name)}`;

            console.log("Uploading original to:", filePath);
            await supabase.storage.from("case-files").upload(filePath, file, { upsert: true });

            if (fileType === 'pdf') {
              combinedText += await processPdfFile(file) + "\n\n";
            } else if (fileType === 'txt') {
              combinedText += await file.text() + "\n\n";
            }
          } catch (e) { console.error("Doc extraction failed", e); }
        }
      }

      // Final Analysis if text found
      if (combinedText.trim()) {
        console.log("Text gathered. Length:", combinedText.length, "Calling AI...");
        const aiResult = await analyzeWithAI(combinedText);
        if (aiResult) {
          console.log("AI extraction complete.");
          setPreviewData(aiResult);
        }
      } else {
        console.log("No text content found to analyze.");
      }

      if (newImages.length > 0 && onImagesUploaded) {
        onImagesUploaded(newImages);
      }

      setStatus("✅ Dokumente analysiert.");
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
    return createPortal(
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          backgroundColor: '#1e293b', padding: '2rem', borderRadius: '16px',
          width: '900px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>KI-Analyse Ergebnis (v2026.1)</h2>
            <button onClick={() => setPreviewData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Projekt & Verwaltung */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
              <h4 style={{ marginTop: 0, color: '#3b82f6', fontSize: '0.9rem', textTransform: 'uppercase' }}>Projekt & Auftrag</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Projekt-Nr (2026xxxx)</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.projekt_daten?.interne_id || ''} onChange={e => setPreviewData({ ...previewData, projekt_daten: { ...previewData.projekt_daten, interne_id: e.target.value } })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Auftraggeber (Firma)</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.auftrag_verwaltung?.firma || ''} onChange={e => setPreviewData({ ...previewData, auftrag_verwaltung: { ...previewData.auftrag_verwaltung, firma: e.target.value } })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Sachbearbeiter</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.auftrag_verwaltung?.sachbearbeiter || ''} onChange={e => setPreviewData({ ...previewData, auftrag_verwaltung: { ...previewData.auftrag_verwaltung, sachbearbeiter: e.target.value } })} />
                </div>
              </div>
            </div>

            {/* Rechnung */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
              <h4 style={{ marginTop: 0, color: '#f59e0b', fontSize: '0.9rem', textTransform: 'uppercase' }}>Rechnungs-Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Eigentümer / c/o</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.rechnungs_details?.eigentuemer || ''} onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, eigentuemer: e.target.value } })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>E-Mail Rechnung</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.rechnungs_details?.email_rechnung || ''} onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, email_rechnung: e.target.value } })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Rechnungsvermerk (Ref)</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.rechnungs_details?.vermerk || ''} onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, vermerk: e.target.value } })} />
                </div>
              </div>
            </div>

            {/* Schadenort */}
            <div style={{ gridColumn: 'span 2', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
              <h4 style={{ marginTop: 0, color: '#ef4444', fontSize: '0.9rem', textTransform: 'uppercase' }}>Schadenort</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Strasse & Nr.</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.schadenort?.strasse_nr || ''} onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, strasse_nr: e.target.value } })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Etage / Details</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.schadenort?.etage_wohnung || ''} onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, etage_wohnung: e.target.value } })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>PLZ & Ort</label>
                  <input className="form-input" style={{ width: '100%' }} value={previewData.schadenort?.plz_ort || ''} onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, plz_ort: e.target.value } })} />
                </div>
              </div>
            </div>
          </div>

          <h4 style={{ color: '#10b981', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Identifizierte Kontakte</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {previewData.kontakte && previewData.kontakte.map((c, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 180px 40px', gap: '0.75rem', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <input className="form-input" placeholder="Rolle" value={c.rolle || ''} onChange={e => {
                  const newC = [...previewData.kontakte]; newC[idx].rolle = e.target.value; setPreviewData({ ...previewData, kontakte: newC });
                }} />
                <input className="form-input" placeholder="Name" value={c.name || ''} onChange={e => {
                  const newC = [...previewData.kontakte]; newC[idx].name = e.target.value; setPreviewData({ ...previewData, kontakte: newC });
                }} />
                <input className="form-input" placeholder="Telefon" value={c.telefon || ''} onChange={e => {
                  const newC = [...previewData.kontakte]; newC[idx].telefon = e.target.value; setPreviewData({ ...previewData, kontakte: newC });
                }} />
                <button onClick={() => {
                  const newC = previewData.kontakte.filter((_, i) => i !== idx);
                  setPreviewData({ ...previewData, kontakte: newC });
                }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', width: '38px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            ))}
            <button onClick={() => setPreviewData({ ...previewData, kontakte: [...(previewData.kontakte || []), { rolle: '', name: '', telefon: '' }] })} className="btn btn-ghost" style={{ alignSelf: 'start', fontSize: '0.8rem' }}>+ Weiteren Kontakt hinzufügen</button>
          </div>

          {/* Gap Analysis */}
          {previewData.gap_analysis && previewData.gap_analysis.length > 0 && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h5 style={{ margin: 0, color: '#ef4444', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fehlende Daten (Gap Analysis)</h5>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem', color: '#fca5a5' }}>
                {previewData.gap_analysis.map((gap, i) => <li key={i}>{gap}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <button onClick={() => setPreviewData(null)} className="btn btn-outline" style={{ minWidth: '120px' }}>Abbrechen</button>
            <button onClick={() => {
              if (onExtractionComplete) onExtractionComplete(previewData);
              setPreviewData(null);
            }} className="btn btn-primary" style={{ minWidth: '180px', backgroundColor: '#10b981', border: 'none' }}>Daten übernehmen</button>
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
            accept=".pdf,.msg,.txt,.jpg,.jpeg,.png,.gif,application/pdf,image/*"
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <FileText size={18} style={{ color: "var(--text-muted)" }} />
            <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>Text direkt einfügen</strong>
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
