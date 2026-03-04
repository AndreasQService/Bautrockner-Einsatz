import React, { useState, useRef } from 'react';
import { ClipboardList, Mic, MicOff, Eye } from 'lucide-react';
import { PdfIcon } from '../DamageForm.constants.jsx';

const MeasuresSection = ({
    formData,
    setFormData,
    mode,
    handleGeneratePDF,
    isGeneratingPDF
}) => {
    const [isListeningMeasures, setIsListeningMeasures] = useState(false);
    const recognitionRefMeasures = useRef(null);

    const toggleMeasuresListening = () => {
        if (isListeningMeasures) {
            recognitionRefMeasures.current?.stop();
            setIsListeningMeasures(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Ihr Browser unterstützt keine Spracherkennung.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => setIsListeningMeasures(true);
        recognition.onend = () => setIsListeningMeasures(false);
        recognition.onerror = (event) => {
            console.error("Speech error", event.error);
            setIsListeningMeasures(false);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                const current = formData.measures ? formData.measures + ' ' : '';
                setFormData(prev => ({ ...prev, measures: current + transcript }));
            }
        };

        recognitionRefMeasures.current = recognition;
        recognition.start();
    };

    if (mode !== 'technician' || (formData.status !== 'Schadenaufnahme' && formData.status !== 'Leckortung')) {
        return null;
    }

    return (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 className="section-header">
                <Eye size={18} /> Feststellungen & Massnahmen
            </h3>

            {/* Feststellungen Section */}
            <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>Feststellungen</label>
                <textarea
                    className="form-input"
                    style={{ minHeight: '120px', resize: 'vertical', width: '100%' }}
                    placeholder="Feststellungen eingeben"
                    value={formData.findings || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
                />
            </div>

            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', fontWeight: 600 }}>Massnahmen (Schnellauswahl)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    "Trocknung",
                    "Schimmelbehandlung",
                    "Organisation externer Handwerker",
                    "Instandstellung"
                ].map((item) => (
                    <label key={item} style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '1rem',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        backgroundColor: (formData.selectedMeasures?.includes(item)) ? 'rgba(14, 165, 233, 0.15)' : 'rgba(255,255,255,0.02)',
                        borderColor: (formData.selectedMeasures?.includes(item)) ? 'var(--primary)' : 'var(--border)',
                        transition: 'all 0.2s ease'
                    }}>
                        <input
                            type="checkbox"
                            checked={formData.selectedMeasures?.includes(item) || false}
                            onChange={() => {
                                setFormData(prev => {
                                    const current = prev.selectedMeasures || [];
                                    if (current.includes(item)) {
                                        return { ...prev, selectedMeasures: current.filter(i => i !== item) };
                                    } else {
                                        return { ...prev, selectedMeasures: [...current, item] };
                                    }
                                });
                            }}
                            style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: (formData.selectedMeasures?.includes(item)) ? 'var(--text-main)' : 'var(--text-muted)' }}>{item}</span>
                    </label>
                ))}
            </div>

            {/* Freitext & Mikrofon */}
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>Eigener Text / Ergänzungen</label>
                    <button
                        type="button"
                        className="btn-glass"
                        onClick={toggleMeasuresListening}
                        style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: isListeningMeasures ? '#EF4444' : 'var(--primary)',
                            borderRadius: '10px',
                            fontWeight: 700
                        }}
                    >
                        {isListeningMeasures ? <MicOff size={16} /> : <Mic size={16} />}
                        {isListeningMeasures ? 'Stop' : 'Diktieren'}
                    </button>
                </div>
                <textarea
                    className="form-input"
                    value={formData.measures || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, measures: e.target.value }))}
                    placeholder="Zusätzliche Massnahmen beschreiben..."
                    style={{ width: '100%', minHeight: '100px', fontFamily: 'inherit', lineHeight: '1.5' }}
                />
            </div>

        </div>
    );
};

export default MeasuresSection;
