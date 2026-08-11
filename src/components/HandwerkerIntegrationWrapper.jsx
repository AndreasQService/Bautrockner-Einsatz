import React, { useState } from 'react';
import { Hammer, Search, ArrowLeft, Folder, Image as ImageIcon, Info, MapPin, Phone, Mail, User, Clock, Check, Plus, Trash2 } from 'lucide-react';
import { isVisibleProjectRow } from '../utils/projectVisibility.js';

export default function HandwerkerIntegrationWrapper({ reports = [], onBack }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [localTechnicianPhotos, setLocalTechnicianPhotos] = useState([]);

    // targetFolderName configuration as strictly required
    const targetFolderName = "Instandstellung";

    // 1. Filter reports locally based on search query
    const filteredReports = reports.filter(project => {
        if (!isVisibleProjectRow(project)) return false;
        const query = searchQuery.toLowerCase();
        return (
            (project.projectTitle && project.projectTitle.toLowerCase().includes(query)) ||
            (project.projectNumber && project.projectNumber.toLowerCase().includes(query)) ||
            (project.orderNumber && project.orderNumber.toLowerCase().includes(query)) ||
            (project.address && project.address.toLowerCase().includes(query)) ||
            (project.client && project.client.toLowerCase().includes(query)) ||
            (project.city && project.city.toLowerCase().includes(query))
        );
    });

    // 2. Retrieve selected project
    const selectedProject = filteredReports.find(p => p.id === selectedProjectId);

    // 3. Local simulation photo handler
    const handleLocalPhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLocalTechnicianPhotos(prev => [
                    ...prev,
                    {
                        id: `local_tech_${Date.now()}_${Math.random()}`,
                        title: file.name.split('.')[0] || 'Foto Baustelle',
                        src: reader.result
                    }
                ]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease', color: 'var(--text-main)' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={onBack} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', height: '34px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ArrowLeft size={16} /> Dashboard
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Hammer size={18} style={{ color: 'var(--q-primary)' }} /> Handwerker-Bereich (Read-Only)
                    </h2>
                </div>

                {/* targetFolderName status badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1.5px solid rgba(99, 102, 241, 0.25)',
                    color: 'var(--q-primary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700
                }}>
                    <Folder size={14} />
                    <span>Zielordner: /{targetFolderName}</span>
                </div>
            </div>

            {/* Selection & Search Bar */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1.5px solid var(--border)' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                    🔍 Projekt auswählen
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Search Field */}
                    <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Projekt suchen (Name, Adresse, Nummer, Auftraggeber)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                                fontSize: '0.85rem',
                                borderRadius: '6px',
                                border: '1.5px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                color: 'var(--text-main)',
                                outline: 'none',
                                boxSizing: 'border-box',
                                height: '36px'
                            }}
                        />
                    </div>

                    {/* Dropdown Selector */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => {
                                setSelectedProjectId(e.target.value);
                                setLocalTechnicianPhotos([]); // Reset simulated uploads for new project
                            }}
                            style={{
                                width: '100%',
                                padding: '0.45rem 0.75rem',
                                fontSize: '0.85rem',
                                borderRadius: '6px',
                                border: '1.5px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                color: 'var(--text-main)',
                                outline: 'none',
                                height: '36px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">-- Projekt aus Liste wählen --</option>
                            {filteredReports.map(project => (
                                <option key={project.id} value={project.id}>
                                    {project.projectTitle || 'Unbenanntes Projekt'} {project.projectNumber ? `(${project.projectNumber})` : ''} - {project.city || ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Read-Only Project View */}
            {selectedProject ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
                    {/* Left Column: Mapped Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* 1. Mapped Project details card */}
                        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    📋 Projektdetails (Schreibgeschützt)
                                </h3>
                                <span style={{
                                    backgroundColor: 'var(--q-primary)',
                                    color: 'white',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800
                                }}>
                                    {selectedProject.projectNumber || selectedProject.orderNumber || 'Keine Nummer'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', rowGap: '1.25rem' }}>
                                {/* Title */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Projektname / Auftragstitel</span>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.15rem' }}>{selectedProject.projectTitle || 'Nicht vorhanden'}</div>
                                </div>

                                {/* Address */}
                                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px dashed var(--border)', paddingBottom: '0.75rem' }}>
                                    <MapPin size={16} style={{ color: 'var(--q-primary)' }} />
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Schadenadresse & Ort</span>
                                        {selectedProject.street || ''}{selectedProject.zip || selectedProject.city ? `, ${selectedProject.zip || ''} ${selectedProject.city || ''}` : 'Nicht erfasst'}
                                    </div>
                                </div>

                                {/* Client */}
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Auftraggeber</span>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.15rem' }}>{selectedProject.client || 'Nicht vorhanden'}</div>
                                    {selectedProject.clientEmail && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📧 {selectedProject.clientEmail}</div>}
                                    {selectedProject.clientPhone && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📞 {selectedProject.clientPhone}</div>}
                                </div>

                                {/* Contact Person / Admin */}
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verwaltung / Ansprechperson</span>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.15rem' }}>{selectedProject.assignedTo || 'Nicht zugewiesen'}</div>
                                </div>

                                {/* Owner / Tenant details if mapped */}
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Eigentümer / Mieter</span>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.15rem' }}>{selectedProject.ownerName || 'Nicht vorhanden'}</div>
                                    {selectedProject.ownerEmail && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📧 {selectedProject.ownerEmail}</div>}
                                </div>

                                {/* Phone Numbers & Emails */}
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Einsatz-Kontakte</span>
                                    <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.15rem' }}>
                                        {selectedProject.contacts && selectedProject.contacts.length > 0 ? (
                                            selectedProject.contacts.map((c, idx) => (
                                                <div key={idx} style={{ padding: '0.25rem', backgroundColor: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                                    <strong>{c.name}</strong> ({c.role})
                                                    {c.phone && <div style={{ fontSize: '0.72rem' }}>📞 {c.phone}</div>}
                                                    {c.email && <div style={{ fontSize: '0.72rem' }}>📧 {c.email}</div>}
                                                </div>
                                            ))
                                        ) : (
                                            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Keine separaten Kontakte.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Work instructions / Description */}
                                <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Schadenbeschreibung / Arbeitsanweisung</span>
                                    <p style={{
                                        margin: '0.25rem 0 0 0',
                                        fontSize: '0.85rem',
                                        lineHeight: 1.45,
                                        whiteSpace: 'pre-wrap',
                                        backgroundColor: 'var(--background)',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border)'
                                    }}>
                                        {selectedProject.description || 'Keine Schadenbeschreibung vorhanden.'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 2. Mapped Rooms & Measurement details */}
                        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1.5px solid var(--border)' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                                🚪 Erfasste Räume & Geräte
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Rooms */}
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Räume</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        {selectedProject.rooms && selectedProject.rooms.length > 0 ? (
                                            selectedProject.rooms.map(room => (
                                                <span key={room.id || room.name} style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                                                    🚪 {room.name || room.roomName || 'Wohnraum'}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine Räume erfasst.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Installed Equipment */}
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Trocknungsgeräte</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        {(() => {
                                             const eqList = (Array.isArray(selectedProject?.equipment) && selectedProject.equipment.length > 0) ? selectedProject.equipment : ((Array.isArray(selectedProject?.devices) && selectedProject.devices.length > 0) ? selectedProject.devices : []);
                                             return eqList.length > 0 ? (
                                                 eqList.map((eq, idx) => (
                                                     <span key={idx} style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                                                         ⚙️ {eq.type || eq.deviceType || eq.model || eq.name || 'Trockner'} (#{eq.deviceNumber || idx})
                                                     </span>
                                                 ))
                                             ) : (
                                                 <span style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine Geräte installiert.</span>
                                             );
                                         })()}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Pre-existing Images & Technician Simulated Uploads */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* 1. Mapped Original Damage Photos (Read-Only) */}
                        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1.5px solid var(--border)' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                                📷 Schadensbilder / Skizzen (Schreibgeschützt)
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                {selectedProject.images && selectedProject.images.length > 0 ? (
                                    selectedProject.images.map((img, idx) => (
                                        <div key={idx} style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            backgroundColor: '#FFFFFF',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            height: '110px'
                                        }}>
                                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <img src={img.preview || img.src} alt={img.name || 'Schadenbild'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                            <div style={{ padding: '0.25rem', fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'var(--background)', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                {img.name || `Schadenbild ${idx + 1}`}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Keine originalen Schadenbilder im Projekt vorhanden.
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 2. Simulated On-Site Photos (Local state only, NO actual Supabase/OneDrive saves) */}
                        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                                    📸 Neue Bilder Instandstellung
                                </h3>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Bilder werden später im OneDrive-Projektordner unter „{targetFolderName}“ gespeichert.
                                </span>
                            </div>

                            {/* Upload simulation area */}
                            <div>
                                <input
                                    type="file"
                                    id="tech-local-simulation-input"
                                    multiple
                                    accept="image/*"
                                    onChange={handleLocalPhotoUpload}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    htmlFor="tech-local-simulation-input"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '90px',
                                        border: '2.5px dashed var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: 'var(--background)',
                                        transition: 'all 0.2s ease',
                                        color: 'var(--text-muted)',
                                        gap: '0.35rem'
                                    }}
                                >
                                    <span style={{ fontSize: '1.4rem' }}>📷</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Foto aufnehmen / Bild hinzufügen</span>
                                </label>
                            </div>

                            {/* Simulated photos preview list */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                {localTechnicianPhotos.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Keine Bilder erfasst
                                    </div>
                                ) : (
                                    localTechnicianPhotos.map(photo => (
                                        <div key={photo.id} style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            backgroundColor: '#FFFFFF',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            height: '110px',
                                            position: 'relative'
                                        }}>
                                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <img src={photo.src} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                            <div style={{ padding: '0.25rem', fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'var(--background)', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                {photo.title}
                                            </div>

                                            {/* Local delete simulated photo */}
                                            <button
                                                onClick={() => {
                                                    setLocalTechnicianPhotos(prev => prev.filter(p => p.id !== photo.id));
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '4px',
                                                    right: '4px',
                                                    backgroundColor: '#EF4444',
                                                    color: 'white',
                                                    border: '1.5px solid white',
                                                    borderRadius: '50%',
                                                    width: '18px',
                                                    height: '18px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    padding: 0
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            ) : (
                <div className="card" style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    border: '1.5px dashed var(--border)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ fontSize: '2rem' }}>🔨</span>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Kein Projekt ausgewählt</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', maxWidth: '380px', lineHeight: 1.45 }}>
                        Bitte wähle oben über die Suche oder das Dropdown-Menü ein Projekt aus, um relevante Daten und Dokumentationsanweisungen anzuzeigen.
                    </p>
                </div>
            )}
        </div>
    );
}
