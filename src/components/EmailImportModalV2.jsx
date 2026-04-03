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

    const parseWithAI = async () => {
        if (!apiKey) {
            alert("Bitte geben Sie zuerst einen Google Gemini API Key in den Einstellungen ein.");
            setShowSettings(true);
            return;
        }

        setLoading(true);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);

            const prompt = `Du bist ein technischer Daten-Parser. Deine einzige Aufgabe ist es, unstrukturierte Texte in ein JSON-Format zu überführen, das exakt auf die Felder der AG-App passt.

1. REGEL FÜR EIGENTÜMER-FELD (PFLICHT):
   - FELD 'rechnungs_details.eigentuemer': Enthält NUR den Firmennamen / Organisationsnamen des Eigentümers.
   - 'c/o'-Zeilen (z.B. 'c/o Avadis Vorsorge AG') gehören zum Organisationsnamen und müssen MITGENOMMEN werden (z.B. 'Avadis Anlagestiftung c/o Avadis Vorsorge AG').
   - CUT-OFF: Sobald ein Wort erscheint, das eine Strassen-Adresse einleitet (Strasse, Str., Weg, Hausnummer), MUSS dieses und alles danach aus dem Feld entfernt werden.
   - ADRESSE: Die Strassen-Adresse des Eigentümers kommt in 'rechnungs_details.strasse', die PLZ in 'rechnungs_details.plz', der Ort in 'rechnungs_details.ort'. Sie geht NICHT in 'schadenort'!
   - KONTROLLE: Wenn ein Block explizit mit 'Eigentümer:' beschriftet ist, MUSS der Organisationsname in 'rechnungs_details.eigentuemer' erscheinen.

2. AUFTRAGGEBER-LOGIK (PFLICHT):
   Der Auftraggeber ist die Person/Firma, die das Email AN Q-Service geschrieben hat.

   SCHRITT 1 – TRENNLINIE FINDEN:
   Suche nach der Trennlinie zum weitergeleiteten Teil: "Von:", "Gesendet:", "-----Ursprüngliche Nachricht-----", "From:".
   ALLES VOR dieser Trennlinie = das äussere/eigene Email des Absenders.
   ALLES NACH dieser Trennlinie = weitergeleitete Inhalte anderer Personen → IGNORIEREN für Auftraggeber-Erkennung.

   SCHRITT 2 – ABSENDER LESEN:
   Die E-Mail-Adresse und Kontaktdaten des Absenders bestimmen den Auftraggeber.
   Suche die Absender-Adresse in dieser Reihenfolge:
   a) Header-Zeile am Textanfang: "Von: name@firma.ch", "From: Vorname Name <name@firma.ch>"
   b) In der Signatur: jede Zeichenfolge mit @domain (z.B. sonja.streuli@matma.ch)
   c) Nach "E-Mail:", "Email:", "Mail:" gefolgt von einer Adresse
   AUSNAHME: datenschutz@, info@, noreply@ sind keine persönlichen Adressen → überspringen.
   → 'auftrag_verwaltung.firma' = Firmenname aus der Signatur (auch aus @domain ableitbar falls im Text erwähnt).
   → 'auftrag_verwaltung.sachbearbeiter' = Person aus der Signatur.
   → 'auftrag_verwaltung.telefon' = Telefon aus der Signatur.
   → 'auftrag_verwaltung.email' = E-Mail-Adresse wie oben gefunden.

   KONKRETES BEISPIEL:
   Text: "...Nikola Komani / Serviceleiter / Neukom Marzolo AG / Gewerbestrasse 13 / 8197 Rafz / nikola.komani@neukom-marzolo.ch
   Von: Susanne Waeckerlin ... Verwaltung/Auftraggeber: STUMP + PARTNER AG ..."
   → firma = "Neukom Marzolo AG" (aus der EIGENEN Signatur VOR "Von:")
   → NICHT "STUMP + PARTNER AG" (das ist im weitergeleiteten Teil)

   AUFTRAGGEBER-ADRESSE: Adresse der Auftraggeber-Firma gehört in 'auftrag_verwaltung.adresse', 'auftrag_verwaltung.plz' und 'auftrag_verwaltung.ort'. NICHT in 'schadenort'!

2b. SCHADENORT-EXTRAKTION (PFLICHT):
   - BETREFF als Quelle: Wenn der Email-Betreff eine Strasse enthält (Muster: "Wasserschaden Strassename Nr"), IST DAS DER SCHADENORT. Extrahiere Strasse + Hausnummer daraus. Wenn nach der Hausnummer noch ein Ortsname folgt (z.B. "Bühlwiesenstrasse 6, Dübendorf"), extrahiere diesen als schadenort.ort.
   - Beispiel: "Betreff: Wasserschaden Leutschenbachstrasse 30 B1804" → schadenort.strasse_nr = "Leutschenbachstrasse 30", schadenort.etage_wohnung = "B1804"
   - Beispiel: "Betreff: Wasser tropft Bühlwiesenstrasse 6, Dübendorf" → schadenort.strasse_nr = "Bühlwiesenstrasse 6", schadenort.ort = "Dübendorf"
   - WOHNUNGSNUMMERN erkennen: Codes wie "B1804", "EG", "3OG", "DG", "W12", "OG3", "C204" gehören in schadenort.etage_wohnung, NICHT in strasse_nr.
   - ETAGE_WOHNUNG – NUR EINE ANGABE: Dieses Feld darf NUR DIE PRIMÄRE/ERSTE Schadenlokalität enthalten. Wenn mehrere Wohnungen oder Etagen erwähnt werden (z.B. "3. OG rechts" UND "EG links"), nimm NUR die erstgenannte oder spezifischste. KEINE Komma-Listen! KEIN "3. OG rechts Wohnung Strehler, EG links" – nur "3. OG rechts Wohnung Strehler".
   - AUFLISTUNG MÖGLICHER WOHNUNGEN: Wenn eine Liste von "möglichen" oder "betroffenen" Wohnungen vorhanden ist (z.B. "EG rechts, Banz", "1 OG rechts, Gantner"), nimm immer die ERSTE in der Liste (z.B. "EG rechts"). Lass das Feld NIEMALS leer, wenn Wohnungsangaben im Text vorhanden sind.
   - PLZ/ORT: PLZ separat in schadenort.plz, Ort separat in schadenort.ort. Wenn die PLZ NICHT im Text steht, aber der Ort eindeutig identifizierbar ist, ergänze die Schweizer PLZ aus deinem Wissen (z.B. Dübendorf=8600, Zürich=8001, Winterthur=8400, Bern=3000, Basel=4051). NIEMALS kombiniert als plz_ort!
   - MEHRFACH-QUELLEN: Die Adresse kann auch in einer Signatur, Cc-Liste oder Weiterleitungszeile vorkommen ("Betreff:", "Subject:", "Objekt:").

3. KONTAKT-EXTRAKTION (VOLLSTÄNDIG – PFLICHT):
   Extrahiere ALLE im Text erwähnten Personen als separate Kontakteinträge. Jede Person mit Name UND/ODER Telefon muss als eigener Eintrag erscheinen.
   
   AUFLISTUNGEN: Wenn Personen nummeriert aufgelistet sind (1. Name Tel..., 2. Name Tel...), extrahiere JEDEN Eintrag separat.
   MEHRERE TELEFONNUMMERN: Wenn eine Person 2 Nummern hat (z.B. "076 390 96 05, 043 399 57 39"), nimm die Mobilnummer (076/079) als primäre Telefonnummer.

   ROLLEN-LOGIK (STRIKTE REGELN):
   Jede Person bekommt GENAU EINE Rolle. KEINE Doppelzuweisung erlaubt.
   Prioritätsreihenfolge bei Unklarheit: Handw. > Verw. > Eig. > HW > Mieter

   - 'Handw.': Techniker, Sanitär, Heizung, Monteure, Handwerker-Firmen – NUR wenn sie am Schaden gearbeitet haben UND NICHT der Auftraggeber sind.
   - 'Verw.': Firmen mit Bezeichnung Verwaltung, Bewirtschaftung, Immobilien AG, Partner.
   - 'Mieter': NUR Personen die EXPLIZIT als "Mieter" bezeichnet werden, oder die in der beschädigten Wohnung wohnen (erkenntlich an: "wohnt in", "Mieter:", "bewohnt").
   - 'Eig.': Personen/Firmen die explizit als "Eigentümer", "Eig.", "Stockwerkeigentümer", "Wohnungseigentümer" bezeichnet werden, ODER deren Wohnung/OG im Zusammenhang mit dem Schaden genannt wird (z.B. "1. OG: Bujar Morina", "2. OG: Peter Schmidlin").
   - 'HW': Hauswart.
   - FEHLER-KONTROLLE: Ein Sanitärtechniker ist KEIN Mieter. Eine Verwaltungsfirma ist kein Handwerker.
   
   ETAGE-FELD: Wenn die Etage/Wohnung der Person bekannt ist (z.B. "1. OG", "2. OG"), trage sie im Feld 'etage' ein.

4. VERBOT VON PLATZHALTERN:
   - Die Ausgabe des Wortes "string" ist strengstens untersagt. 
   - Falls eine Information im Text nicht existiert, gib einen leeren String ("") aus. 
   - Fülle JEDES Feld mit den Realdaten aus dem Text, niemals mit Platzhaltern.
   - Rechnungsvermerk: NUR echte Referenznummern (z.B. RIM-23, Ref: 2026xxx). KEINE Schadensbeschreibung.

5. FORMATIERUNG:
   - Telefon: +41 XX XXX XX XX.
   - Namen: Trenne Vorname und Nachname (falls möglich).

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
    "telefon": "",
    "email": "",
    "leistungsart": "Wasserschaden",
    "adresse": "",
    "plz": "",
    "ort": ""
  },
  "rechnungs_details": {
    "eigentuemer": "",
    "strasse": "",
    "plz": "",
    "ort": "",
    "email_rechnung": "",
    "vermerk": ""
  },
  "schadenort": {
    "strasse_nr": "",
    "plz": "",
    "ort": "",
    "etage_wohnung": ""
  },
  "kontakte": [
    {
      "name": "",
      "rolle": "Handw. | Verw. | Mieter | Eig. | HW",
      "telefon": "+41 XX XXX XX XX",
      "etage": "",
      "email": ""
    }
  ],
  "gap_analysis": []
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
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Telefon (AG)</label>
                                        <input className="form-input" style={{ width: '100%' }} placeholder="+41 XX XXX XX XX" value={previewData.auftrag_verwaltung?.telefon || ''} onChange={e => setPreviewData({ ...previewData, auftrag_verwaltung: { ...previewData.auftrag_verwaltung, telefon: e.target.value } })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>E-Mail (AG)</label>
                                        <input className="form-input" style={{ width: '100%' }} placeholder="email@firma.ch" value={previewData.auftrag_verwaltung?.email || ''} onChange={e => setPreviewData({ ...previewData, auftrag_verwaltung: { ...previewData.auftrag_verwaltung, email: e.target.value } })} />
                                    </div>
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
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>PLZ</label>
                                    <input className="form-input" style={{ width: '100%' }} value={previewData.schadenort?.plz || ''} onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, plz: e.target.value } })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>Ort</label>
                                    <input className="form-input" style={{ width: '100%' }} value={previewData.schadenort?.ort || ''} onChange={e => setPreviewData({ ...previewData, schadenort: { ...previewData.schadenort, ort: e.target.value } })} />
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
