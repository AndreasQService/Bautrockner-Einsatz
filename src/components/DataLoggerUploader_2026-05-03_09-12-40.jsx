import React, { useRef, useState } from 'react';
import { Upload, Trash, FileText, Check } from 'lucide-react';
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
        if (window.confirm('Dieses Messprotokoll-Bild wirklich löschen?')) {
            onChange(images.filter(img => img.id !== id));
        }
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
                    PDF wird automatisch in Bilder umgewandelt
                </span>
            </div>

            {images.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                }}>
                    {images.map((img, idx) => {
                        const included = img.includeInReport !== false;
                        return (
                            <div
                                key={img.id}
                                style={{
                                    border: `1px solid ${included ? 'var(--primary)' : 'var(--border)'}`,
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    backgroundColor: 'var(--background)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                {/* Image with delete overlay */}
                                <div style={{ position: 'relative', flex: '0 0 auto' }}>
                                    <img
                                        src={img.preview}
                                        alt={`Seite ${idx + 1}`}
                                        style={{
                                            width: '100%',
                                            height: '200px',
                                            objectFit: 'contain',
                                            backgroundColor: 'var(--surface)',
                                            display: 'block',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => window.open(img.preview, '_blank')}
                                    />

                                    {/* Delete button – top right overlay */}
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(img.id)}
                                        title="Löschen"
                                        style={{
                                            position: 'absolute',
                                            top: '6px',
                                            right: '6px',
                                            background: 'rgba(239,68,68,0.9)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                                        }}
                                    >
                                        <Trash size={14} />
                                    </button>

                                    {/* Include-in-report toggle – top left overlay */}
                                    <button
                                        type="button"
                                        onClick={() => handleToggleInclude(img.id)}
                                        title={included ? 'Aus Bericht entfernen' : 'In Bericht aufnehmen'}
                                        style={{
                                            position: 'absolute',
                                            top: '6px',
                                            left: '6px',
                                            background: included ? 'rgba(16,185,129,0.9)' : 'rgba(0,0,0,0.5)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '3px 7px',
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                        }}
                                    >
                                        {included && <Check size={10} />}
                                        Bericht
                                    </button>
                                </div>

                                {/* Description */}
                                <textarea
                                    className="form-input"
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        fontSize: '0.8rem',
                                        resize: 'none',
                                        border: 'none',
                                        borderTop: '1px solid var(--border)',
                                        borderRadius: 0,
                                        padding: '0.5rem',
                                        boxSizing: 'border-box',
                                        backgroundColor: 'transparent',
                                    }}
                                    placeholder="Bemerkung..."
                                    value={img.description || ''}
                                    onChange={(e) => handleDescriptionChange(img.id, e.target.value)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Button */}
            <input
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <button
                type="button"
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
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    opacity: isConverting ? 0.7 : 1,
                }}
            >
                {isConverting ? (
                    <span>Konvertiere PDF in Bilder… (Bitte warten)</span>
                ) : (
                    <>
                        <Upload size={18} /> Datenlogger PDF hochladen
                    </>
                )}
            </button>
        </div>
    );
};

export default DataLoggerUploader;
