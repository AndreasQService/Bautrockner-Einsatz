import React, { useState, useEffect } from 'react';
import {
    Image, Plus, X, FileText, MapPin, Map, Camera,
    Folder, ChevronDown, Phone, Trash, Edit3,
    AlertTriangle, Check, Table, Settings, RotateCcw, CheckCircle,
    ChevronUp, Mic, MicOff, Star, GripVertical
} from 'lucide-react';
import { RoomService } from '../../../services/RoomService';

export default function RoomManager({
    formData,
    setFormData,
    mode,
    ROOM_OPTIONS,
    setEditingImage,
    setGlobalPreviewImage,
    generateMeasurementExcel,
    setShowMeasurementModal,
    setActiveRoomForMeasurement,
    setIsNewMeasurement,
    setIsMeasurementReadOnly,
    handleRemoveRoom,
    handleAddRoom,
    handleCategorySelect,
    handleCategoryDrop,
    handleRoomImageSelect,
    handleRoomImageDrop,
    newRoom,
    setNewRoom,
    showAddRoomForm,
    setShowAddRoomForm,
    showAddDeviceForm,
    setShowAddDeviceForm
}) {
    // Local state for toggling room image visibility (if needed, or pass from parent)
    const [visibleRoomImages, setVisibleRoomImages] = useState({});
    const [dragImageIndex, setDragImageIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [dragRoomId, setDragRoomId] = useState(null);
    const [isDictating, setIsDictating] = useState(false);
    const [isRoomsExpanded, setIsRoomsExpanded] = useState(true);
    const [isCauseExpanded, setIsCauseExpanded] = useState(true);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [dragRoomIndex, setDragRoomIndex] = useState(null);
    const [dragOverRoomIndex, setDragOverRoomIndex] = useState(null);
    const recognitionRef = React.useRef(null);
    const accumulatedTextRef = React.useRef('');
    const isDictatingRef = React.useRef(false);

    const startDictation = (onResult) => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            alert('Diktat wird von diesem Browser nicht unterstützt.');
            return;
        }
        // Sicherheitskontext prüfen (iOS braucht HTTPS)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            alert('Diktat benötigt eine HTTPS-Verbindung. Bitte die App über die Vercel-URL öffnen.');
            return;
        }
        // Diktat stoppen wenn aktiv
        if (isDictatingRef.current) {
            isDictatingRef.current = false;
            recognitionRef.current?.stop();
            accumulatedTextRef.current = '';
            setIsDictating(false);
            return;
        }

        isDictatingRef.current = true;
        accumulatedTextRef.current = '';
        setIsDictating(true);

        const startSession = () => {
            if (!isDictatingRef.current) return;
            const rec = new SR();
            rec.lang = 'de-CH';
            rec.continuous = false; // iOS Safari unterstützt continuous nicht zuverlässig
            rec.interimResults = false;
            rec.maxAlternatives = 1;

            rec.onresult = (e) => {
                const newText = Array.from(e.results).map(r => r[0].transcript).join(' ');
                accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + newText).trim();
                onResult(accumulatedTextRef.current);
            };
            rec.onerror = (e) => {
                if (e.error === 'not-allowed') {
                    alert('Mikrofon-Zugriff verweigert. Bitte in den iPad-Einstellungen erlauben.');
                    isDictatingRef.current = false;
                    setIsDictating(false);
                } else if (e.error !== 'aborted') {
                    // Bei anderen Fehlern kurz warten und neu starten
                    setTimeout(startSession, 300);
                }
            };
            rec.onend = () => {
                // iOS stoppt automatisch nach Pause → sofort neu starten
                if (isDictatingRef.current) {
                    setTimeout(startSession, 150);
                } else {
                    setIsDictating(false);
                }
            };

            recognitionRef.current = rec;
            try { rec.start(); } catch (e) { /* bereits gestartet */ }
        };

        startSession();
    };


    const toggleRoomImages = (roomId) => {
        setVisibleRoomImages(prev => ({
            ...prev,
            [roomId]: !prev[roomId]
        }));
    };

    const handleImageDragStart = (e, globalIndex, roomId) => {
        setDragImageIndex(globalIndex);
        setDragRoomId(roomId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleImageDragOver = (e, globalIndex) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(globalIndex);
    };

    const handleImageDrop = (e, targetGlobalIndex) => {
        e.preventDefault();
        if (dragImageIndex === null || dragImageIndex === targetGlobalIndex) {
            setDragImageIndex(null);
            setDragOverIndex(null);
            setDragRoomId(null);
            return;
        }
        setFormData(prev => {
            const images = [...prev.images];
            const [moved] = images.splice(dragImageIndex, 1);
            images.splice(targetGlobalIndex, 0, moved);
            return { ...prev, images };
        });
        setDragImageIndex(null);
        setDragOverIndex(null);
        setDragRoomId(null);
    };

    const handleRoomDragStart = (e, index) => {
        setDragRoomIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleRoomDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverRoomIndex(index);
    };

    const handleRoomDrop = (e, targetIndex) => {
        e.preventDefault();
        if (dragRoomIndex === null || dragRoomIndex === targetIndex) {
            setDragRoomIndex(null);
            setDragOverRoomIndex(null);
            return;
        }
        setFormData(prev => {
            const rooms = [...prev.rooms];
            const [moved] = rooms.splice(dragRoomIndex, 1);
            rooms.splice(targetIndex, 0, moved);
            return { ...prev, rooms };
        });
        setDragRoomIndex(null);
        setDragOverRoomIndex(null);
    };

    return (
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
                {mode !== 'technician' && (
                    <div
                        onClick={() => setIsRoomsExpanded(prev => !prev)}
                        style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            marginBottom: '1rem', cursor: 'pointer', userSelect: 'none',
                            padding: '0.5rem 0.75rem', borderRadius: '10px',
                            transition: 'background 0.2s',
                        }}
                    >
                        <h3 className="section-header" style={{ marginBottom: 0, border: 'none' }}>
                            <Image size={20} /> Räume / Fotos
                            {!isRoomsExpanded && formData.rooms?.length > 0 && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                    ({formData.rooms.length} vorhanden)
                                </span>
                            )}
                        </h3>
                        <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{isRoomsExpanded ? 'Einklappen' : 'Ausklappen'}</span>
                            <ChevronDown size={20} style={{ transform: isRoomsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                        </div>
                    </div>
                )}

                {mode === 'technician' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* NEW: Schadenursache Section (Technician) */}
                        <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <AlertTriangle size={18} /> Schadenursache
                                </h4>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Beschreibung der Ursache</label>
                                    <button
                                        type="button"
                                        onClick={() => startDictation(text => setFormData(prev => ({ ...prev, cause: (prev.cause ? prev.cause + ' ' : '') + text })))}
                                        title={isDictating ? 'Diktat stoppen' : 'Diktieren'}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                                            padding: '0.3rem 0.7rem', borderRadius: '6px', border: 'none',
                                            backgroundColor: isDictating ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.12)',
                                            color: isDictating ? '#ef4444' : '#38bdf8',
                                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                            animation: isDictating ? 'pulse 1s infinite' : 'none'
                                        }}
                                    >
                                        {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
                                        {isDictating ? 'Stopp' : 'Diktieren'}
                                    </button>
                                </div>
                                <textarea
                                    className="form-input"
                                    value={formData.cause || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, cause: e.target.value }))}
                                    placeholder="Wie ist der Schaden entstanden?"
                                    style={{ width: '100%', minHeight: '100px', fontFamily: 'inherit', lineHeight: '1.5' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>Fotos zur Ursache</label>

                                <div
                                    style={{
                                        border: '2px dashed var(--border)', borderRadius: '8px', padding: '1.5rem',
                                        textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-secondary)',
                                        marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                                    }}
                                    onClick={() => document.getElementById('cause-upload-input').click()}
                                >
                                    <Plus size={24} color="var(--text-muted)" />
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Schadenfoto hochladen / Drop</div>
                                </div>
                                <input
                                    id="cause-upload-input"
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    capture={mode === 'technician' ? 'environment' : undefined}
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleCategorySelect(e, 'Schadenfotos')}
                                />

                                {formData.images.filter(img => img.assignedTo === 'Schadenfotos').length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                        Keine Schadenfotos vorhanden.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', minHeight: '100px' }}>
                                        {formData.images.filter(img => img.assignedTo === 'Schadenfotos').map((img, idx) => (
                                            <div key={idx} style={{
                                                position: 'relative',
                                                width: '100px',
                                                flexShrink: 0,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px'
                                            }}>
                                                <div style={{
                                                    position: 'relative',
                                                    width: '100px',
                                                    height: '100px',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    border: img.includeInReport !== false ? '2px solid #0F6EA3' : '1px solid var(--border)'
                                                }}>
                                                    <img
                                                        src={img.preview}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                                                        onClick={() => setLightboxImage(img.preview)}
                                                        title="Klicken zum Vergrössern"
                                                    />

                                                    {/* Include in Report Toggle */}
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: '2px',
                                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                                            borderRadius: '2px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: '2px',
                                                            zIndex: 10
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                images: prev.images.map(i => i === img ? { ...i, includeInReport: !img.includeInReport } : i)
                                                            }));
                                                        }}
                                                        title="Im Bericht anzeigen"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={img.includeInReport !== false}
                                                            onChange={() => { }}
                                                            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#0F6EA3' }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Löschen-Button – volle Breite, gut tappbar auf iPad */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Bild wirklich löschen?')) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                images: prev.images.filter(i => i !== img),
                                                                damageTypeImage: prev.damageTypeImage === img.preview ? null : prev.damageTypeImage
                                                            }));
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '5px 0',
                                                        backgroundColor: 'rgba(239,68,68,0.15)',
                                                        color: '#EF4444',
                                                        border: '1px solid rgba(239,68,68,0.4)',
                                                        borderRadius: '4px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                        cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700
                                                    }}
                                                >
                                                    <X size={12} /> Löschen
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            className={`btn ${showAddRoomForm ? 'btn-ghost' : 'btn-primary'}`}
                            onClick={() => setShowAddRoomForm(!showAddRoomForm)}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', color: showAddRoomForm ? '#EF4444' : undefined, borderColor: showAddRoomForm ? '#EF4444' : undefined }}
                        >
                            {showAddRoomForm ? <X size={16} /> : <Plus size={16} />}
                            {showAddRoomForm ? " Abbrechen" : " Raum hinzufügen"}
                        </button>

                        {showAddRoomForm && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <select
                                        className="form-input"
                                        value={newRoom.apartment || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__neue__') {
                                                setNewRoom(prev => ({ ...prev, apartment: '__neue__', apartmentCustom: '', stockwerk: '' }));
                                            } else if (val) {
                                                const matchingContact = (formData.contacts || []).find(c => c.name === val);
                                                const existingRoom = formData.rooms.find(r => r.apartment === val);
                                                const stock = matchingContact?.floor || matchingContact?.apartment || existingRoom?.stockwerk || '';
                                                setNewRoom(prev => ({ ...prev, apartment: val, stockwerk: stock }));
                                            } else {
                                                setNewRoom(prev => ({ ...prev, apartment: '', stockwerk: '' }));
                                            }
                                        }}
                                        style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                    >
                                        <option value="">Mieter / Wohnung wählen...</option>
                                        {/* Bestehende Räume */}
                                        {formData.rooms.map(r => r.apartment).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).sort().map(apt => (
                                            <option key={apt} value={apt}>{apt}</option>
                                        ))}
                                        {/* Kontakte (Mieter/Eigentümer) – Name + Etage */}
                                        {(formData.contacts || [])
                                            .filter(c => (c.role === 'Mieter' || c.role === 'Eigentümer') && c.name)
                                            .filter((c, i, a) => a.findIndex(x => x.name === c.name) === i)
                                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                            .map(c => {
                                                const etage = c.floor || c.apartment || '';
                                                const label = etage ? `${c.name} (${etage})` : c.name;
                                                return (
                                                    <option key={c.name} value={c.name}>{label}</option>
                                                );
                                            })
                                        }
                                        <option value="__neue__">Neue Wohnung eingeben...</option>
                                    </select>

                                    {/* Manuelle Eingabe wenn "Neue Wohnung" gewählt */}
                                    {newRoom.apartment === '__neue__' && (
                                        <input
                                            type="text"
                                            placeholder="Mieter / Wohnungsbezeichnung eingeben"
                                            value={newRoom.apartmentCustom || ''}
                                            onChange={(e) => setNewRoom(prev => ({ ...prev, apartmentCustom: e.target.value }))}
                                            className="form-input"
                                            style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <input
                                    type="text"
                                    placeholder="Stockwerk"
                                    value={newRoom.stockwerk}
                                    onChange={(e) => setNewRoom(prev => ({ ...prev, stockwerk: e.target.value }))}
                                    className="form-input"
                                    style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                />

                                <select
                                    value={newRoom.name}
                                    onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                                    className="form-input"
                                    style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                >
                                    <option value="">Raum wählen...</option>
                                    {ROOM_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    <option value="Sonstiges">Sonstiges / Eigener Name</option>
                                </select>

                                {((newRoom.name === 'Sonstiges') || (newRoom.name === 'Sonstiges / Eigener Name') || (newRoom.name && !ROOM_OPTIONS.includes(newRoom.name))) && (
                                    <input
                                        type="text"
                                        placeholder="Raum-Name eingeben"
                                        value={newRoom.name === 'Sonstiges' || newRoom.name === 'Sonstiges / Eigener Name' ? '' : newRoom.name}
                                        onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                                        className="form-input"
                                        style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                        autoFocus
                                    />
                                )}

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        handleAddRoom();
                                        setShowAddRoomForm(false);
                                    }}
                                    disabled={!newRoom.name || newRoom.name === 'Sonstiges'}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    <Check size={16} /> Speichern
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {mode === 'technician' && (
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '2rem', marginBottom: '0.5rem' }}>
                        Räume / Fotos
                    </h3>
                )}
            </div>

            {/* Schadenursache + Raumliste: in Desktop-Modus ein/ausklappbar */}
            {(mode !== 'desktop' || isRoomsExpanded) && (
                <>

                    {/* Schadenursache - Cause & Photos (Desktop Only) */}
                    {mode === 'desktop' && (
                        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--border)', padding: '1.5rem', backgroundColor: 'var(--surface)' }}>
                            {/* Collapsible Header */}
                            <div
                                onClick={() => setIsCauseExpanded(prev => !prev)}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    cursor: 'pointer', userSelect: 'none',
                                    marginBottom: isCauseExpanded ? '1.5rem' : 0,
                                    paddingBottom: isCauseExpanded ? '1rem' : 0,
                                    borderBottom: isCauseExpanded ? '1px solid var(--border)' : 'none',
                                    transition: 'margin 0.2s, padding 0.2s'
                                }}
                            >
                                <h3 style={{ marginBottom: 0, border: 'none', fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <AlertTriangle size={18} /> Schadenursache
                                    {!isCauseExpanded && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                            {formData.images?.filter(img => img.assignedTo === 'Schadenfotos').length > 0
                                                ? `(${formData.images.filter(img => img.assignedTo === 'Schadenfotos').length} Fotos)`
                                                : formData.cause ? '(Ausgefüllt)' : ''}
                                        </span>
                                    )}
                                </h3>
                                <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{isCauseExpanded ? 'Einklappen' : 'Ausklappen'}</span>
                                    <ChevronDown size={20} style={{ transform: isCauseExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                                </div>
                            </div>

                            {/* Collapsible Content */}
                            {isCauseExpanded && (<>

                            {/* Cause / Description */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Schadenursache</span>
                                        <button
                                            type="button"
                                            onClick={() => startDictation(text => setFormData(prev => ({ ...prev, cause: (prev.cause ? prev.cause + ' ' : '') + text })))}
                                            title={isDictating ? 'Diktat stoppen' : 'Diktieren'}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                padding: '0.3rem 0.7rem', borderRadius: '6px', border: 'none',
                                                backgroundColor: isDictating ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.12)',
                                                color: isDictating ? '#ef4444' : '#38bdf8',
                                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
                                            }}
                                        >
                                            {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
                                            {isDictating ? 'Stopp' : 'Diktieren'}
                                        </button>
                                    </div>
                                    <textarea
                                        className="form-input"
                                        rows={3}
                                        value={formData.cause || ''}
                                        onChange={e => setFormData({ ...formData, cause: e.target.value })}
                                        placeholder="Beschreibung der Ursache..."
                                    />
                                </label>
                            </div>

                            {/* Photos (Schadenfotos) */}
                            <div>
                                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Fotos zur Ursache</h4>

                                {/* Upload Zone */}
                                <div
                                    style={{
                                        border: '2px dashed var(--border)',
                                        borderRadius: 'var(--radius)',
                                        padding: '2rem 1rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        backgroundColor: 'rgba(255,255,255,0.02)',
                                        transition: 'all 0.2s',
                                        marginBottom: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)'
                                    }}
                                    onClick={() => document.getElementById('file-upload-Schadenfotos-desktop').click()}
                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                    onDrop={(e) => handleCategoryDrop(e, 'Schadenfotos')}
                                >
                                    <Plus size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                    <span style={{ fontSize: '0.85rem' }}>Schadenfoto hochladen / Drop</span>
                                    <input id="file-upload-Schadenfotos-desktop" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={(e) => handleCategorySelect(e, 'Schadenfotos')} />
                                </div>

                                {/* List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {formData.images.filter(img => img.assignedTo === 'Schadenfotos').map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '6px', backgroundColor: 'var(--background)' }}>
                                            {/* Thumbnail + Controls */}
                                            <div style={{ flex: '0 0 140px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '140px', height: '140px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                                    <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setEditingImage(item)} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px', alignItems: 'center' }}>
                                                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                                                        <input
                                                            type="checkbox"
                                                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                            checked={item.includeInReport !== false}
                                                            onChange={(e) => setFormData(prev => ({
                                                                ...prev,
                                                                images: prev.images.map(i => i === item ? { ...i, includeInReport: e.target.checked } : i)
                                                            }))}
                                                        />
                                                        <span style={{ fontWeight: 600 }}>Bericht</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        title="Bearbeiten"
                                                        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-main)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        onClick={() => setEditingImage(item)}
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Description + Delete */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '140px' }}>
                                                <textarea
                                                    placeholder="Beschreibung..."
                                                    className="form-input"
                                                    style={{ fontSize: '0.9rem', padding: '0.5rem', flex: 1, width: '100%', resize: 'none', backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}
                                                    value={item.description || ''}
                                                    onChange={(e) => {
                                                        const newDesc = e.target.value;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            images: prev.images.map(i => i.preview === item.preview ? { ...i, description: newDesc } : i)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            {/* Delete */}
                                            <div style={{ display: 'flex', flexDirection: 'column', height: '140px', justifyContent: 'flex-start' }}>
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter(i => i !== item) }))} style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            </>)}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {formData.rooms.map((room, roomIndex) => (
                            <div
                                key={room.id}
                                className="card"
                                onDragOver={(e) => handleRoomDragOver(e, roomIndex)}
                                onDrop={(e) => handleRoomDrop(e, roomIndex)}
                                onDragEnd={() => { setDragRoomIndex(null); setDragOverRoomIndex(null); }}
                                style={{
                                    padding: 0,
                                    overflow: 'hidden',
                                    border: dragOverRoomIndex === roomIndex && dragRoomIndex !== roomIndex
                                        ? '2px solid var(--primary)'
                                        : '1px solid rgba(255,255,255,0.08)',
                                    opacity: dragRoomIndex === roomIndex ? 0.5 : 1,
                                    transition: 'border-color 0.15s, opacity 0.15s',
                                    cursor: 'default'
                                }}
                            >
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, paddingRight: '1rem', flexWrap: 'wrap' }}>
                                        <div
                                            draggable
                                            onDragStart={(e) => { e.stopPropagation(); handleRoomDragStart(e, roomIndex); }}
                                            style={{ display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0, color: 'var(--text-muted)', opacity: 0.6, padding: '4px' }}
                                            title="Raum verschieben"
                                        >
                                            <GripVertical size={18} />
                                        </div>
                                        <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{room.name}</span>
                                        {room.stockwerk && (
                                            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', opacity: 0.75, whiteSpace: 'nowrap' }}>• {room.stockwerk}</span>
                                        )}
                                        {room.apartment && (
                                            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', opacity: 0.75, whiteSpace: 'nowrap' }}>• {room.apartment}</span>
                                        )}
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: mode === 'technician' ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))',
                                        gap: '0.6rem',
                                        alignItems: 'stretch',
                                        minWidth: mode === 'technician' ? '240px' : 'auto',
                                        flexShrink: 0
                                    }}>
                                        {room.measurementData ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveRoomForMeasurement(room);
                                                        setIsNewMeasurement(true);
                                                        setIsMeasurementReadOnly(false);
                                                        setShowMeasurementModal(true);
                                                    }}
                                                    style={{
                                                        padding: mode === 'technician' ? '0.75rem 0.5rem' : '0.4rem 0.6rem',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #D97706',
                                                        backgroundColor: 'rgba(217, 119, 6, 0.1)',
                                                        color: '#F59E0B',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.4rem',
                                                        fontSize: mode === 'technician' ? '0.9rem' : '0.75rem',
                                                        cursor: 'pointer',
                                                        flex: 1,
                                                        minHeight: mode === 'technician' ? '44px' : '44px',
                                                        fontWeight: 800
                                                    }}
                                                >
                                                    <Plus size={16} /> Neue Messreihe
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveRoomForMeasurement(room);
                                                        setIsNewMeasurement(false);
                                                        setIsMeasurementReadOnly(false);
                                                        setShowMeasurementModal(true);
                                                    }}
                                                    style={{
                                                        padding: mode === 'technician' ? '0.75rem 0.5rem' : '0.4rem 0.6rem',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #059669',
                                                        backgroundColor: 'rgba(5, 150, 105, 0.1)',
                                                        color: '#10B981',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.4rem',
                                                        fontSize: mode === 'technician' ? '0.9rem' : '0.75rem',
                                                        cursor: 'pointer',
                                                        flex: 1,
                                                        minHeight: mode === 'technician' ? '44px' : '44px',
                                                        fontWeight: 800,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <FileText size={16} /> Messreihe fortsetzen
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveRoomForMeasurement(room);
                                                    setIsNewMeasurement(false);
                                                    setIsMeasurementReadOnly(false);
                                                    setShowMeasurementModal(true);
                                                }}
                                                style={{
                                                    padding: mode === 'technician' ? '0.8rem 0.5rem' : '0.4rem 0.6rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid #059669',
                                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                                    color: '#34d399',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.4rem',
                                                    fontSize: mode === 'technician' ? '1rem' : '0.75rem',
                                                    cursor: 'pointer',
                                                    flex: 1,
                                                    minHeight: mode === 'technician' ? '50px' : '44px',
                                                    fontWeight: 700,
                                                    gridColumn: mode === 'technician' ? 'span 2' : 'auto'
                                                }}
                                            >
                                                <Plus size={18} /> Messung starten
                                            </button>
                                        )}



                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Sind Sie sicher, dass Sie den Raum "${room.name}" löschen möchten? Alle zugehörigen Bilder und Messdaten gehen verloren.`)) {
                                                    handleRemoveRoom(room.id);
                                                }
                                            }}
                                            title="Raum löschen"
                                            style={{
                                                padding: mode === 'technician' ? '0.6rem' : '0.4rem',
                                                borderRadius: '6px',
                                                border: '1px solid #b91c1c',
                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                color: '#f87171',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                minHeight: mode === 'technician' ? '44px' : '44px',
                                                gridColumn: mode === 'technician' && !(room.measurementHistory && room.measurementHistory.length > 0) ? 'span 1' : 'auto'
                                            }}
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Room Images & Details Section */}
                                <div style={{ padding: '1rem 1.25rem' }}>
                                    {/* Room Header Info (Mobile View) */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => toggleRoomImages(room.id)}
                                                style={{
                                                    background: 'none', border: 'none', color: 'var(--primary)',
                                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0
                                                }}
                                            >
                                                <Image size={18} />
                                                {RoomService.getRoomImages(room, formData.images).length} Bilder
                                                {visibleRoomImages[room.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {room.measurementData && (
                                                <button
                                                    type="button"
                                                    onClick={() => generateMeasurementExcel(room)}
                                                    className="btn-glass"
                                                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '6px' }}
                                                >
                                                    <Table size={14} /> Excel
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Images Grid */}
                                    {(visibleRoomImages[room.id] || mode === 'desktop') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                            {RoomService.getRoomImages(room, formData.images).map((img) => {
                                                const globalIdx = formData.images.indexOf(img);
                                                if (globalIdx === -1) return null;
                                                return (
                                                <div
                                                    key={globalIdx}
                                                    draggable={mode === 'desktop'}
                                                    onDragStart={(e) => { e.stopPropagation(); handleImageDragStart(e, globalIdx, room.id); }}
                                                    onDragOver={(e) => { e.stopPropagation(); handleImageDragOver(e, globalIdx); }}
                                                    onDrop={(e) => { e.stopPropagation(); handleImageDrop(e, globalIdx); }}
                                                    onDragEnd={(e) => { e.stopPropagation(); setDragImageIndex(null); setDragOverIndex(null); }}
                                                    style={{
                                                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                                        border: dragOverIndex === globalIdx && dragRoomId === room.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                        padding: '0.5rem', borderRadius: '6px',
                                                        backgroundColor: dragImageIndex === globalIdx ? 'rgba(56, 189, 248, 0.08)' : 'var(--background)',
                                                        opacity: dragImageIndex === globalIdx ? 0.5 : 1,
                                                        cursor: mode === 'desktop' ? 'grab' : 'default',
                                                        transition: 'border-color 0.15s, opacity 0.15s'
                                                    }}
                                                >
                                                    {/* Drag Handle (Desktop only) */}
                                                    {mode === 'desktop' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'grab', paddingTop: '2px', flexShrink: 0 }} title="Ziehen zum Sortieren">
                                                            <GripVertical size={18} />
                                                        </div>
                                                    )}
                                                    {/* Thumbnail & Toggles */}
                                                    <div style={{ flex: '0 0 140px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ width: '140px', height: '140px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                                            <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setEditingImage(img)} />
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px', alignItems: 'center' }}>
                                                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                                    checked={img.includeInReport !== false}
                                                                    onChange={(e) => {
                                                                        const isChecked = e.target.checked;
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            images: prev.images.map(i => i === img ? { ...i, includeInReport: isChecked } : i)
                                                                        }));
                                                                    }}
                                                                />
                                                                <span style={{ fontWeight: 600 }}>Bericht</span>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                title="Bearbeiten"
                                                                style={{
                                                                    border: '1px solid var(--border)',
                                                                    backgroundColor: 'var(--surface)',
                                                                    color: 'var(--text-main)',
                                                                    cursor: 'pointer',
                                                                    padding: '6px',
                                                                    borderRadius: '6px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onClick={() => setEditingImage(img)}
                                                            >
                                                                <Edit3 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* File Info & Description */}
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '140px' }}>
                                                        <textarea
                                                            placeholder="Beschreibung..."
                                                            className="form-input"
                                                            style={{
                                                                fontSize: '0.9rem',
                                                                padding: '0.5rem',
                                                                flex: 1,
                                                                width: '100%',
                                                                resize: 'none',
                                                                backgroundColor: 'var(--surface)',
                                                                color: 'var(--text-main)'
                                                            }}
                                                            value={img.description || ''}
                                                            onChange={(e) => {
                                                                const newDesc = e.target.value;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    images: prev.images.map(i => i.preview === img.preview ? { ...i, description: newDesc } : i)
                                                                }));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Actions: Delete */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', height: mode === 'technician' ? 'auto' : '140px', justifyContent: 'flex-start' }}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost"
                                                            title="Bild löschen"
                                                            style={{
                                                                color: '#EF4444',
                                                                padding: mode === 'technician' ? '0 0.5rem' : '0',
                                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                borderRadius: '6px',
                                                                width: mode === 'technician' ? 'auto' : '32px',
                                                                minWidth: '32px',
                                                                height: mode === 'technician' ? '44px' : '32px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '6px',
                                                                cursor: 'pointer',
                                                                fontWeight: 700,
                                                                fontSize: '0.8rem',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                            onClick={() => {
                                                                if (window.confirm('Bild wirklich löschen?')) {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        images: prev.images.filter(i => i !== img)
                                                                    }));
                                                                }
                                                            }}
                                                        >
                                                            <Trash size={16} />
                                                            {mode === 'technician' && 'Löschen'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add Image Button for Room */}
                                            <label style={{
                                                width: '100%', height: '50px',
                                                border: '2px dashed var(--border)', borderRadius: '8px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                cursor: 'pointer', backgroundColor: 'var(--surface-hover)',
                                                color: 'var(--text-muted)', transition: 'all 0.2s', marginTop: '0.25rem'
                                            }}
                                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; }}
                                                onDrop={(e) => handleRoomImageDrop(e, room)}
                                            >
                                                <Plus size={20} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Foto hinzufügen / Dropzone</span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    capture={mode === 'technician' ? 'environment' : undefined}
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleRoomImageSelect(e, room)}
                                                />
                                            </label>
                                        </div>
                                    )}

                                    {/* Room Findings / Notes */}
                                    <div style={{ marginTop: '1rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                                            Feststellungen / Notizen
                                        </label>
                                        <textarea
                                            className="form-input"
                                            value={room.findings || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    rooms: prev.rooms.map(r => r.id === room.id ? { ...r, findings: val } : r)
                                                }));
                                            }}
                                            placeholder="Besonderheiten in diesem Raum..."
                                            style={{ width: '100%', minHeight: '80px', fontSize: '0.9rem', lineHeight: '1.4' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {formData.rooms.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Noch keine Räume erfasst.</div>
                                {mode === 'desktop' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRoomForm(true)}
                                        className="btn btn-outline"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Plus size={18} /> Raum hinzufügen
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Desktop Room Add Dialog (Alternative to inline technician version) */}
                    {mode === 'desktop' && showAddRoomForm && (
                        <div style={{
                            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
                            backdropFilter: 'blur(8px)'
                        }}>
                            <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Neuen Raum hinzufügen</h3>
                                    <button onClick={() => setShowAddRoomForm(false)} className="btn-ghost" style={{ padding: '0.5rem' }}><X size={20} /></button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Wohnung / Objekt</label>
                                        <select
                                            className="form-input"
                                            value={newRoom.apartment}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'Sonstiges') {
                                                    setNewRoom(prev => ({ ...prev, apartment: 'Sonstiges', apartmentCustom: '' }));
                                                } else {
                                                    let relatedStockwerk = '';
                                                    const matchingContact = (formData.contacts || []).find(c => c.name && c.name.trim().split(/\s+/).pop() === val);
                                                    if (matchingContact) {
                                                        relatedStockwerk = matchingContact.floor || matchingContact.apartment || '';
                                                    } else {
                                                        const existingRoom = formData.rooms.find(r => r.apartment === val);
                                                        if (existingRoom) {
                                                            relatedStockwerk = existingRoom.stockwerk || '';
                                                        }
                                                    }
                                                    setNewRoom(prev => ({ ...prev, apartment: val, stockwerk: relatedStockwerk || prev.stockwerk }));
                                                }
                                            }}
                                        >
                                            <option value="">Wohnung wählen... (Optional)</option>
                                            {[...new Set([...formData.rooms.map(r => r.apartment).filter(Boolean), ...(formData.contacts || []).map(c => c.name ? (c.name.toLowerCase().includes('whg') || c.name.toLowerCase().includes('wohnung') ? c.name.trim().split(/\s+/).pop() : 'Whg. ' + c.name.trim().split(/\s+/).pop()) : '').filter(Boolean)])].sort().map(apt => (
                                                <option key={apt} value={apt}>{apt}</option>
                                            ))}
                                            <option value="Sonstiges">Handeingabe...</option>
                                        </select>
                                        {newRoom.apartment === 'Sonstiges' && (
                                            <input
                                                type="text"
                                                placeholder="Wohnungsbezeichnung"
                                                value={newRoom.apartmentCustom || ''}
                                                onChange={(e) => setNewRoom(prev => ({ ...prev, apartmentCustom: e.target.value }))}
                                                className="form-input"
                                                autoFocus
                                            />
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Stockwerk</label>
                                        <input
                                            type="text"
                                            placeholder="Stockwerk (z.B. EG, 1. OG)"
                                            value={newRoom.stockwerk}
                                            onChange={(e) => setNewRoom(prev => ({ ...prev, stockwerk: e.target.value }))}
                                            className="form-input"
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Raum-Typ</label>
                                        <select
                                            value={newRoom.name}
                                            onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                                            className="form-input"
                                        >
                                            <option value="">Typ wählen...</option>
                                            {ROOM_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                            <option value="Sonstiges / Eigener Name">Sonstiges / Eigener Name</option>
                                        </select>
                                    </div>

                                    {newRoom.name === "Sonstiges / Eigener Name" && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Eigener Name</label>
                                            <input
                                                type="text"
                                                placeholder="Raumbezeichnung"
                                                value={newRoom.customName}
                                                onChange={(e) => setNewRoom(prev => ({ ...prev, customName: e.target.value }))}
                                                className="form-input"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <button type="button" onClick={() => setShowAddRoomForm(false)} className="btn btn-outline" style={{ flex: 1 }}>Abbrechen</button>
                                        <button
                                            type="button"
                                            disabled={!newRoom.name}
                                            onClick={() => {
                                                handleAddRoom();
                                                setShowAddRoomForm(false);
                                            }}
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                        >
                                            <Check size={18} /> Speichern
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Lightbox Overlay */}
            {lightboxImage && (
                <div
                    onClick={() => setLightboxImage(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        backgroundColor: 'rgba(0,0,0,0.92)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out',
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    <img
                        src={lightboxImage}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '92vw', maxHeight: '92vh',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                            cursor: 'default'
                        }}
                    />
                    <button
                        onClick={() => setLightboxImage(null)}
                        style={{
                            position: 'fixed', top: '1.5rem', right: '1.5rem',
                            background: 'rgba(255,255,255,0.15)', border: 'none',
                            color: 'white', borderRadius: '50%',
                            width: '44px', height: '44px',
                            fontSize: '1.4rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(4px)',
                            transition: 'background 0.2s'
                        }}
                        title="Schliessen"
                    >✕</button>
                </div>
            )}
        </div>
    );
}
