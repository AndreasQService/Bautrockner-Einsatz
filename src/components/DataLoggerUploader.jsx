import React, { useRef, useState } from 'react';
import { Upload, X, Trash, Phone, FileText } from 'lucide-react';
import { convertPdfToImages } from '../utils/pdfToImages';

const DataLoggerUploader = ({ images = [], onChange }) => {
    const [isConverting, setIsConverting] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Bitte nur PDF-Dateien für Messprotokolle verwenden.');
            return;
        }

        setIsConverting(true);
        try {
            const newImages = await convertPdfToImages(file);
            onChange([...images, ...newImages]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            alert('Fehler bei der Umwandlung der PDF: ' + error.message);
        } finally {
            setIsConverting(false);
        }
    };

    const handleDelete = (id) => {
        onChange(images.filter(img => img.id !== id));
    };

    const handleToggleInclude = (id) => {
        onChange(images.map(img => img.id === id ? { ...img, includeInReport: !img.includeInReport } : img));
    };

    const handleDescriptionChange = (id, newDesc) => {
        onChange(images.map(img => img.id === id ? { ...img, description: newDesc } : img));
    };

    return (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="section-header" style={{ marginBottom: 0 }}>
                    <FileText size={18} /> Datenlogger / Messprotokolle
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Alle Seiten der hochgeladenen PDFs werden als Bilder eingefügt und im Bericht als Anhang aufgeführt.
                </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                {images.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {images.map((img, idx) => (
                            <div key={img.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'var(--background)' }}>
                                <div style={{ flex: '0 0 120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '120px', height: '160px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#E5E7EB', border: '1px solid var(--border)' }}>
                                        <img src={img.preview} alt={`Seite ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(img.preview, '_blank')} />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                                        <input
                                            type="checkbox"
                                            checked={img.includeInReport !== false}
                                            onChange={() => handleToggleInclude(img.id)}
                                            style={{ accentColor: '#10B981', transform: 'scale(1.1)' }}
                                        />
                                        Im Bericht
                                    </label>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <textarea
                                        className="form-input"
                                        style={{ width: '100%', minHeight: '80px', fontSize: '0.9rem', resize: 'vertical' }}
                                        placeholder="Bemerkung zum Messprotokoll..."
                                        value={img.description || ''}
                                        onChange={(e) => handleDescriptionChange(img.id, e.target.value)}
                                    />
                                </div>
                                <div>
                                    <button
                                        onClick={() => { if (window.confirm("Bist du sicher?")) handleDelete(img.id) }}
                                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                        title="Löschen"
                                    >
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isConverting}
                        className="btn-glass"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '2px dashed var(--border)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            width: '100%',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            backgroundColor: 'rgba(255,255,255,0.02)'
                        }}
                    >
                        {isConverting ? (
                            <span>Konvertiere PDF in Bilder... (Bitte warten)</span>
                        ) : (
                            <>
                                <Upload size={18} /> Datenlogger PDF hochladen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataLoggerUploader;
