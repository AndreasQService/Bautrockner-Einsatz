import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { X, ArrowRight, Mail, Settings, Check, RotateCw, FileUp } from 'lucide-react';
import { swissPLZ } from '../data/swiss_plz';

const EmailImportModalV2 = ({ onClose, onImport, audioDevices, selectedDeviceId, onSelectDeviceId, initialShowSettings = false, onRefreshDevices, deviceError }) => {
    console.log("EmailImportModalV2 Loaded - VERSION 2026.1.1 (Gemini-1.5-Flash)");
    const [text, setText] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(initialShowSettings);
    const [loading, setLoading] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileUpload({ target: { files: [files[0]] } });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Basic placeholder since full PDF text extraction requires a library like pdf.js
        // For now, alert that text needs to be pasted or full impl needed
        alert("PDF-Textextraktion erfordert zusätzliche Bibliotheken. Bitte kopieren Sie den Text direkt aus dem PDF.");
    };

    useEffect(() => {
        const storedKey = localStorage.getItem('google_api_key');
        const envKey = import.meta.env.VITE_GOOGLE_API_KEY;

        if (storedKey) {
            setApiKey(storedKey);
        } else if (envKey) {
            setApiKey(envKey);
        } else {
            setShowSettings(true); // Prompts user to enter key first time
        }
    }, []);

    const [previewData, setPreviewData] = useState(null);

    const saveApiKey = (key) => {
        setApiKey(key);
        localStorage.setItem('google_api_key', key);
        setShowSettings(false);
    };

    const parseWithAI = async () => {
        if (!apiKey) {
            alert("Bitte geben Sie zuerst einen Google Gemini API Key in den Einstellungen ein.");
            setShowSettings(true);
            return;
        }

        setLoading(true);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);

            const prompt = `Du bist der spezialisierte KI-Assistent für die Antigravity (AG) Wasserschaden-App. 
Deine Aufgabe ist das präzise Parsing von Daten in die vorgegebene UI-Maske.

1. STRIKTE ADRESS-TRENNUNG (EIGENTÜMER):
   - FELD 'EIGENTÜMER': Darf NUR den Firmennamen/Namen enthalten.
   - CUT-OFF BEFEHL: Sobald im Text 'Strasse', 'Str.', eine Hausnummer, eine PLZ oder ein Ort erscheint, STOPPE das Feld 'EIGENTÜMER'.
   - PFLICHT-VERSCHIEBUNG: Alle Adressdaten (z.B. 'Zollstrasse 42', '8005', 'Zürich') MÜSSEN in die dafür vorgesehenen Felder 'STRASSE & NR.', 'PLZ' und 'ORT' verschoben werden. Das Adressfeld darf NIEMALS leer bleiben, wenn im Quelltext Adressdaten stehen.

2. ROLLEN-ZUWEISUNG (NUR DIESE KATEGORIEN):
   Weise Kontakten EXKLUSIV eines der folgenden Kürzel zu:
   - 'Mieter': Bewohner der betroffenen Wohnung.
   - 'Eig.': Eigentümer der Liegenschaft.
   - 'HW': Hauswart / Hausmeister.
   - 'Verw.': Verwaltungen (z.B. CSL Immobilien, Weber + Schweizer).
   - 'Handw.': Externe Firmen/Techniker (z.B. Halter AG, Burkhalter). -> WICHTIG: Absender aus Firmen-Signaturen sind immer 'Handw.'.
   - 'Sonst.': Falls keine Zuordnung möglich ist.

3. KONTAKT-DETAILS:
   - Erstelle für jede Person eine Karte.
   - Formatiere Telefonnummern auf: +41 XX XXX XX XX.
   - Trenne Name und Firma sauber voneinander.

4. BEISPIEL-LOGIK:
   Input: "Eigentümer: Avadis Anlagestiftung Zollstrasse 42 8005 Zürich"
   -> RECHNUNGS_DETAILS.EIGENTÜMER: Avadis Anlagestiftung
   -> RECHNUNGS_DETAILS.STRASSE: Zollstrasse 42
   -> RECHNUNGS_DETAILS.PLZ_ORT: 8005 Zürich

5. QUALITÄTS-CHECK:
   - Verbot: Die Adresse darf nicht abgeschnitten im Namensfeld stehen (wie 'Zollstra...'). Sie muss nach rechts wandern.
   - Verbot: Ein Techniker von 'Halter' darf nicht als 'Mieter' markiert werden; er ist zwingend 'Handw.'.

AUSGABE-FORMAT (JSON):
{
  "projekt_daten": {
    "interne_id": "2026xxxx",
    "externe_ref": "string",
    "auftrags_nr": "string"
  },
  "auftrag_verwaltung": {
    "firma": "string",
    "sachbearbeiter": "string",
    "leistungsart": "Wasserschaden"
  },
  "rechnungs_details": {
    "eigentuemer": "string",
    "email_rechnung": "string",
    "vermerk": "string"
  },
  "schadenort": {
    "strasse_nr": "string",
    "plz_ort": "string",
    "etage_wohnung": "string"
  },
  "kontakte": [
    {
      "name": "string",
      "rolle": "Mieter | Eig. | HW | Verw. | Handw. | Sonst.",
      "telefon": "+41 XX XXX XX XX"
    }
  ],
  "gap_analysis": ["string"]
}

WICHTIG: Antworte NUR mit dem validen JSON-Code, ohne Markdown-Backticks.

INPUT DATEN:
${text}`;

            let result;
            // 1. DIAGNOSE: Frag Google, was dieser Key überhaupt darf
            let discoveryModels = [];
            try {
                const discRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const discData = await discRes.json();
                if (discData && discData.models) {
                    discoveryModels = discData.models
                        .map(m => m.name.replace('models/', ''))
                        .filter(name => name.includes('flash') || name.includes('pro'))
                        .filter(name => !name.includes('vision') && !name.includes('experimental'));
                    console.log("Dynamisch gefundene Modelle (Email):", discoveryModels);
                }
            } catch (e) { }

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
            aiContent = aiContent.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

            let parsedData;
            try {
                parsedData = JSON.parse(aiContent);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                parsedData = { kontakte: [] };
            }

            if (!parsedData.kontakte) parsedData.kontakte = [];
            setPreviewData(parsedData);

        } catch (error) {
            console.error("Full AI Analysis Error:", error);
            let errorMsg = error.message || "Unbekannter Fehler";
            if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('limit')) {
                errorMsg = "API-Limit erreicht. Bitte warten Sie eine Minute oder nutzen Sie einen bezahlten API-Key.";
            }
            alert("Fehler bei der Gemini-Analyse: " + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const parseWithRegex = () => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const data = {
            projectTitle: '', client: '', street: '', zip: '', city: '', description: lines.join('\n'), contacts: [], damageType: '', manager: ''
        };
        setPreviewData(data);
    };

    const handleAnalyze = () => {
        if (useAI && apiKey) {
            parseWithAI();
        } else {
            parseWithRegex();
        }
    };

    // --- PREVIEW UI RENDERER ---
    if (previewData) {
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
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>Vorschau & Korrektur (Gemini)</h2>
                        <button onClick={() => setPreviewData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Projekt & Auftrag */}
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
                        <button onClick={() => setPreviewData(null)} className="btn btn-outline" style={{ minWidth: '120px' }}>Zurück</button>
                        <button onClick={() => {
                            onImport(previewData);
                            setPreviewData(null);
                        }} className="btn btn-primary" style={{ minWidth: '180px', backgroundColor: '#10b981', border: 'none' }}>Daten übernehmen</button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // --- INPUT UI (Default) ---
    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '8px',
                width: '700px', maxWidth: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail size={24} />
                        Projekt aus Email / PDF importieren
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="btn btn-ghost"
                            style={{ padding: '0.5rem', color: useAI && apiKey ? 'var(--primary)' : 'var(--text-muted)' }}
                            title="KI Einstellungen"
                        >
                            <Settings size={20} />
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {showSettings && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Google Gemini API Key</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="password"
                                placeholder="AIza..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="form-input"
                                style={{ flex: 1 }}
                            />
                            <button onClick={() => saveApiKey(apiKey)} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                                Speichern
                            </button>
                        </div>
                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Mikrofon auswählen</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    className="form-input"
                                    value={selectedDeviceId || ''}
                                    onChange={(e) => onSelectDeviceId && onSelectDeviceId(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    {audioDevices && audioDevices.length > 0 ? (
                                        audioDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Mikrofon ${device.deviceId.slice(0, 5)}...`}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">Keine Mikrofone gefunden</option>
                                    )}
                                </select>
                                <button
                                    type="button"
                                    onClick={onRefreshDevices}
                                    className="btn btn-outline"
                                    title="Liste aktualisieren"
                                    style={{ padding: '0.5rem' }}
                                >
                                    <RotateCw size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    style={{
                        position: 'relative',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.2s ease',
                        border: isDragging ? '2px dashed var(--primary)' : '1px solid transparent',
                        borderRadius: '4px'
                    }}
                >
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Email Text hier einfügen oder PDF Drag & Drop..."
                        className="form-input"
                        style={{
                            flex: 1, minHeight: '300px', width: '100%', padding: '1rem',
                            border: '1px solid var(--border)', borderRadius: '4px', resize: 'none',
                            fontFamily: 'monospace', fontSize: '0.9rem',
                            backgroundColor: isDragging ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--background)',
                            color: 'var(--text-main)'
                        }}
                    />
                    {isDragging && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(var(--primary-active), 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10, pointerEvents: 'none',
                            color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem',
                            flexDirection: 'column', gap: '0.5rem'
                        }}>
                            <FileUp size={48} style={{ marginBottom: '1rem' }} />
                            <span>Lassen Sie los zum Importieren</span>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} className="btn btn-outline">Abbrechen</button>
                    <button
                        onClick={handleAnalyze}
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px', justifyContent: 'center' }}
                    >
                        {loading ? <RotateCw className="spin" size={18} /> : <ArrowRight size={18} />}
                        {loading ? 'Analysieren...' : (useAI && apiKey ? 'KI Analysieren' : 'Regex Analysieren')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EmailImportModalV2;
