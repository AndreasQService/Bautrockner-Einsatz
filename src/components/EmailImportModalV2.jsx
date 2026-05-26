import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { X, ArrowRight, Mail, Settings, Check, RotateCw, FileUp } from 'lucide-react';
import { swissPLZ } from '../data/swiss_plz';
import PlzOrtInput from './PlzOrtInput';

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

        const storedOpenAiKey = localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
        setOpenAiKey(storedOpenAiKey);
    }, []);

    const [previewData, setPreviewData] = useState(null);
    const [openAiKey, setOpenAiKey] = useState('');

    const saveApiKey = (key) => {
        setApiKey(key);
        localStorage.setItem('google_api_key', key);
        setShowSettings(false);
    };

    // --- RETRY HELPER: 503 / high demand ---
    const callWithRetry = async (fn, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (err) {
                const is503 = err.message?.includes('503') || err.message?.includes('high demand') || err.message?.includes('overloaded');
                if (is503 && i < retries - 1) {
                    const wait = 1000 * (i + 1);
                    console.warn(`503 überlastet — Retry ${i + 1}/${retries - 1} in ${wait}ms...`);
                    await new Promise(r => setTimeout(r, wait));
                } else {
                    throw err;
                }
            }
        }
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

            const prompt = `SYSTEM PROMPT – QTOOL PARSER V4
Schweizer Immobilien / Wasserschaden / Verwaltungen / Rollenlogik / Rechnungslogik

Du bist ein hochpräziser Business-Datenparser für Schadensmeldungen, Wasserschäden,
Leckortungen, Feuchtigkeitsprobleme, Schimmelmeldungen und Sanierungsaufträge
im Schweizer Immobilienumfeld.

Deine Aufgabe:
Unstrukturierte Texte (E-Mails, PDFs, Portale, Briefe, Notizen) in saubere,
geschäftslogisch korrekte JSON-Daten umwandeln.

==================================================
1. OBERSTE REGEL
==================================================

Nicht nur Wörter erkennen. Zuerst Geschäftslogik verstehen.

Analysiere immer zuerst:
1. Wer meldet den Schaden?
2. Wer ist Ansprechpartner?
3. Wer erteilt den Auftrag?
4. Wer verwaltet die Liegenschaft?
5. Wer ist Eigentümer?
6. Wer erhält die Rechnung?
7. Wer organisiert Zugang?
8. Wer wohnt dort?
9. Wo ist der Schadenort?
10. Was ist das Problem?
11. Wie dringend ist es?

Erst danach Felder befüllen.

==================================================
2. ROLLENLOGIK
==================================================

Unterscheide strikt:
- Auftraggeber / Verwaltung / Eigentümer / Rechnungsempfänger
- Kontaktperson / Hauswart / Mieter / Bewohner / Handwerker / Sonstige

Eine Person ist NICHT automatisch eine Firma.

Beispiel:
"Freundliche Grüsse / Angela Högger"
=> Kontaktperson, NICHT automatisch Auftraggeberfirma.

==================================================
3. AUFTRAGGEBER REGEL
==================================================

Wenn Verwaltung / Immobilienfirma / Treuhandfirma genannt:
=> Diese Firma bevorzugt als auftraggeber.firma
Personen darunter als auftraggeber.kontaktperson speichern.

Nur wenn keine Firma erkennbar: Person als Kontaktperson, Firma leer.

==================================================
4. RECHNUNGSLOGIK (HÖCHSTE PRIORITÄT)
==================================================

Wenn Text enthält Schlüsselwörter wie:
- Rechnung an / Rechnungsadresse / Faktura an
- Die Rechnung ist wie folgt zu erstellen
- Rechnung bitte an / Rechnungen senden an
- Rechnungsempfänger / invoice to

Dann diese Daten haben HÖCHSTE PRIORITÄT für rechnungs_details.*
Nie ignorieren.

Zusätzlich erfassen:
- E-Mail-Adresse für Rechnungen => rechnungs_details.email_rechnung
- Referenz-/Auftragsnummer => rechnungs_details.referenz

==================================================
5. EIGENTÜMER REGEL
==================================================

rechnungs_details.eigentuemer enthält NUR juristische Person / Organisation.

Richtig: PURE Funds AG / PURE Swiss Opportunity REF / c/o Truvag AG
Falsch: Angela Högger / Herr Meier / Mieterin Frau Keller

Personen NIE als Eigentümer speichern.

==================================================
6. C/O REGEL
==================================================

Wenn c/o vorkommt: zwingend Teil des Firmennamens.

Beispiel:
PURE Funds AG
PURE Swiss Opportunity REF
c/o Truvag AG
=> alle Zeilen zusammen in rechnungs_details.eigentuemer

==================================================
7. ADRESS-TRENNUNG
==================================================

Sobald Strasse / Hausnummer beginnt, endet Firmenblock.

Beispiel:
PURE Funds AG
c/o Truvag AG
Leopoldstrasse 6
6210 Sursee

=> eigentuemer = "PURE Funds AG\nc/o Truvag AG"
=> strasse = "Leopoldstrasse 6"
=> plz = "6210"
=> ort = "Sursee"

==================================================
8. KONTAKTPERSONEN ERKENNEN
==================================================

Wenn Firma + Person + Telefon in einem Satz:

Beispiel:
DomEX Hauswartungen GmbH, Herrn Szewczyk, Tel. 078 663 61 81

=> rolle = "hauswart", firma = "DomEX Hauswartungen GmbH"
=> name = "Herr Szewczyk", telefon = "078 663 61 81"

Nicht nur Nachname speichern.
Wenn Zugang / Schlüssel erwähnt: zweck = "Zugang"

==================================================
9. ERLAUBTE ROLLEN IN kontakte[]
==================================================

"verwaltung", "mieter", "eigentuemer", "rechnungsempfaenger",
"dienstleister", "handwerker", "sanitaer", "dachdecker", "hauswart", "sonstiges"

==================================================
10. DRINGLICHKEIT
==================================================

Wörter: dringend, eilt, sofort, rasch, schnellstmöglich, bald, umgehend
=> priority = "hoch"
Sonst: priority = ""

==================================================
11. BESCHREIBUNG
==================================================

Kurz, sachlich, max. 3 Sätze. Nur gesicherte Informationen.

Beispiel:
Starker Geruch im Heizungsraum. Massive Feuchtigkeit und Schimmelbildung vorhanden. Ursache unbekannt, Besichtigung dringend gewünscht.

==================================================
12. PROJEKTTITEL
==================================================

Kurz und sinnvoll. Beispiel: "Schimmel / Feuchtigkeit Heizungsraum Musterstrasse 10"

==================================================
13. VERBOTE
==================================================

- Nichts erfinden
- Keine Felder raten
- Person nicht als Firma speichern
- Kontaktperson nicht als Eigentümer speichern
- Rechnungsblock nie ignorieren
- Telefonnummern nicht verlieren
- Namen nicht kürzen
- Fehlende Werte immer als "" oder []

==================================================
14. AUSGABE – NUR DIESES JSON, KEINE BACKTICKS
==================================================

{
  "projektTitel": "",
  "auftraggeber": {
    "firma": "",
    "kontaktperson": "",
    "telefon": "",
    "email": ""
  },
  "rechnungs_details": {
    "eigentuemer": "",
    "strasse": "",
    "plz": "",
    "ort": "",
    "email_rechnung": "",
    "referenz": ""
  },
  "kontakte": [
    {
      "rolle": "",
      "firma": "",
      "name": "",
      "telefon": "",
      "email": "",
      "zweck": ""
    }
  ],
  "schadenort": {
    "strasse": "",
    "plz": "",
    "ort": "",
    "stockwerk": "",
    "wohnung": "",
    "raum": ""
  },
  "priority": "",
  "beschreibung": ""
}

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

            // Preferred models: 2.5-flash first, 2.0-flash as fallback, then legacy
            const PREFERRED = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];
            const legacyModels = discoveryModels.length > 0
                ? discoveryModels.filter(m => !PREFERRED.includes(m))
                : ["gemini-1.5-flash", "gemini-1.5-pro"];

            // Build ordered attempts: preferred first, then discovered/legacy
            const orderedModels = [
                ...PREFERRED,
                ...legacyModels.slice(0, 3),
            ];
            const attempts = [];
            orderedModels.forEach(m => {
                attempts.push({ model: m, version: "v1beta" });
            });

            let lastError;
            let hasQuotaError = false;

            for (const attempt of attempts) {
                try {
                    console.log(`Versuch: ${attempt.model} (${attempt.version})...`);
                    const model = genAI.getGenerativeModel({ model: attempt.model }, { apiVersion: attempt.version });
                    result = await callWithRetry(() => model.generateContent(prompt));
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
                    } else if (msg.includes('503') || msg.includes('high demand') || msg.includes('overloaded')) {
                        console.warn(`${attempt.model} dauerhaft überlastet — nächstes Modell...`);
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

    // --- PREVIEW UI RENDERER (V4) ---
    if (previewData) {
        return createPortal(
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)'
            }}>
                <div style={{
                    backgroundColor: '#FFFFFF', padding: '2rem', borderRadius: '16px',
                    width: '900px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto',
                    border: '1px solid #E2E8F0', boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    color: '#1E293B'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>Vorschau & Korrektur (Gemini V4)</h2>
                            {previewData.projektTitel && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>{previewData.projektTitel}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {previewData.priority === 'hoch' && (
                                <span style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid #ef4444', padding: '0.2rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ Dringend</span>
                            )}
                            <button onClick={() => setPreviewData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                    </div>

                    {/* Beschreibung */}
                    {(previewData.beschreibung || previewData.projekt_daten?.beschreibung) && (
                        <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', padding: '0.75rem 1rem', borderRadius: '10px', borderLeft: '3px solid #3b82f6', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#93c5fd' }}>
                            <strong style={{ color: '#3b82f6', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Beschreibung: </strong>
                            {previewData.beschreibung || previewData.projekt_daten?.beschreibung}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>

                        {/* Auftraggeber */}
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                            <h4 style={{ marginTop: 0, color: '#3b82f6', fontSize: '0.9rem', textTransform: 'uppercase' }}>Auftraggeber / Verwaltung</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Firma</label>
                                    <input className="form-input" style={{ width: '100%' }}
                                        value={previewData.auftraggeber?.firma || previewData.auftrag_verwaltung?.firma || ''}
                                        onChange={e => setPreviewData({ ...previewData, auftraggeber: { ...previewData.auftraggeber, firma: e.target.value } })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Kontaktperson</label>
                                    <input className="form-input" style={{ width: '100%' }}
                                        value={previewData.auftraggeber?.kontaktperson || previewData.auftrag_verwaltung?.ansprechperson || ''}
                                        onChange={e => setPreviewData({ ...previewData, auftraggeber: { ...previewData.auftraggeber, kontaktperson: e.target.value } })} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Telefon</label>
                                        <input className="form-input" style={{ width: '100%' }} placeholder="+41 XX XXX XX XX"
                                            value={previewData.auftraggeber?.telefon || previewData.auftrag_verwaltung?.telefon || ''}
                                            onChange={e => setPreviewData({ ...previewData, auftraggeber: { ...previewData.auftraggeber, telefon: e.target.value } })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>E-Mail</label>
                                        <input className="form-input" style={{ width: '100%' }} placeholder="email@firma.ch"
                                            value={previewData.auftraggeber?.email || previewData.auftrag_verwaltung?.email || ''}
                                            onChange={e => setPreviewData({ ...previewData, auftraggeber: { ...previewData.auftraggeber, email: e.target.value } })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rechnungsdetails */}
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                            <h4 style={{ marginTop: 0, color: '#f59e0b', fontSize: '0.9rem', textTransform: 'uppercase' }}>Rechnungsdetails</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Eigentümer / Rechnungsempfänger</label>
                                    <textarea className="form-input" rows={3} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                                        value={previewData.rechnungs_details?.eigentuemer || ''}
                                        onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, eigentuemer: e.target.value } })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Strasse</label>
                                    <input className="form-input" style={{ width: '100%' }}
                                        value={previewData.rechnungs_details?.strasse || ''}
                                        onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, strasse: e.target.value } })} />
                                </div>
                                <PlzOrtInput
                                    plz={previewData.rechnungs_details?.plz || ''}
                                    ort={previewData.rechnungs_details?.ort || ''}
                                    onAutofill={(p, o) => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, plz: p, ort: o } })}
                                    onChangePlz={v => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, plz: v } })}
                                    onChangeOrt={v => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, ort: v } })}
                                    labelPlz="PLZ" labelOrt="Ort"
                                />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>E-Mail Rechnung</label>
                                        <input className="form-input" style={{ width: '100%' }} placeholder="kreditoren@firma.ch"
                                            value={previewData.rechnungs_details?.email_rechnung || ''}
                                            onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, email_rechnung: e.target.value } })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Referenz</label>
                                        <input className="form-input" style={{ width: '100%' }} placeholder="z.B. PURE-5024"
                                            value={previewData.rechnungs_details?.referenz || ''}
                                            onChange={e => setPreviewData({ ...previewData, rechnungs_details: { ...previewData.rechnungs_details, referenz: e.target.value } })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Schadenort */}
                        <div style={{ gridColumn: 'span 2', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                            <h4 style={{ marginTop: 0, color: '#ef4444', fontSize: '0.9rem', textTransform: 'uppercase' }}>Schadenort</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Strasse</label>
                                    <input className="form-input" style={{ width: '100%' }}
                                        value={previewData.schadenort?.strasse || ''}
                                        onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, strasse: e.target.value } })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Stockwerk</label>
                                    <input className="form-input" style={{ width: '100%' }} placeholder="z.B. 2.OG"
                                        value={previewData.schadenort?.stockwerk || previewData.schadenort?.etage_wohnung || ''}
                                        onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, stockwerk: e.target.value } })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Wohnung</label>
                                    <input className="form-input" style={{ width: '100%' }} placeholder="z.B. Whg. 3"
                                        value={previewData.schadenort?.wohnung || ''}
                                        onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, wohnung: e.target.value } })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Raum</label>
                                    <input className="form-input" style={{ width: '100%' }} placeholder="z.B. Heizungsraum"
                                        value={previewData.schadenort?.raum || previewData.schadenort?.bereich?.[0] || ''}
                                        onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, raum: e.target.value } })} />
                                </div>
                                <div style={{ gridColumn: 'span 4' }}>
                                    <PlzOrtInput
                                        plz={previewData.schadenort?.plz || ''}
                                        ort={previewData.schadenort?.ort || ''}
                                        onAutofill={(p, o) => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, plz: p, ort: o } })}
                                        onChangePlz={v => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, plz: v } })}
                                        onChangeOrt={v => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, ort: v } })}
                                        labelPlz="PLZ" labelOrt="Ort"
                                        plzWidth="100px"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <h4 style={{ color: '#10b981', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Identifizierte Kontakte</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                        {previewData.kontakte && previewData.kontakte.map((c, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 140px 140px 40px', gap: '0.5rem', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                                <input className="form-input" placeholder="Rolle" value={c.rolle || ''} onChange={e => {
                                    const newC = [...previewData.kontakte]; newC[idx] = { ...newC[idx], rolle: e.target.value }; setPreviewData({ ...previewData, kontakte: newC });
                                }} />
                                <input className="form-input" placeholder="Name" value={c.name || ''} onChange={e => {
                                    const newC = [...previewData.kontakte]; newC[idx] = { ...newC[idx], name: e.target.value }; setPreviewData({ ...previewData, kontakte: newC });
                                }} />
                                <input className="form-input" placeholder="Firma" value={c.firma || ''} onChange={e => {
                                    const newC = [...previewData.kontakte]; newC[idx] = { ...newC[idx], firma: e.target.value }; setPreviewData({ ...previewData, kontakte: newC });
                                }} />
                                <input className="form-input" placeholder="Telefon" value={c.telefon || ''} onChange={e => {
                                    const newC = [...previewData.kontakte]; newC[idx] = { ...newC[idx], telefon: e.target.value }; setPreviewData({ ...previewData, kontakte: newC });
                                }} />
                                <input className="form-input" placeholder="Zweck (z.B. Zugang)" value={c.zweck || ''} onChange={e => {
                                    const newC = [...previewData.kontakte]; newC[idx] = { ...newC[idx], zweck: e.target.value }; setPreviewData({ ...previewData, kontakte: newC });
                                }} />
                                <button onClick={() => {
                                    const newC = previewData.kontakte.filter((_, i) => i !== idx);
                                    setPreviewData({ ...previewData, kontakte: newC });
                                }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', width: '38px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                        ))}
                        <button onClick={() => setPreviewData({ ...previewData, kontakte: [...(previewData.kontakte || []), { rolle: '', name: '', firma: '', telefon: '', zweck: '' }] })} className="btn btn-ghost" style={{ alignSelf: 'start', fontSize: '0.8rem' }}>+ Weiteren Kontakt hinzufügen</button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.5rem' }}>
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
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>OpenAI API Key (Diktat / Whisper)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="password"
                                    placeholder="sk-..."
                                    value={openAiKey}
                                    onChange={(e) => setOpenAiKey(e.target.value)}
                                    className="form-input"
                                    style={{ flex: 1 }}
                                />
                                <button onClick={() => {
                                    localStorage.setItem('openai_api_key', openAiKey.trim());
                                    setShowSettings(false);
                                }} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                                    Speichern
                                </button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Für Sprachdiktat (Whisper). Separat vom Gemini-Key.
                            </div>
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
