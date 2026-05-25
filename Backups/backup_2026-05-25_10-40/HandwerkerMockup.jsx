import React, { useState, useRef, useEffect } from 'react';
import { 
    X, 
    Trash2, 
    Camera, 
    Save, 
    RotateCcw,
    Plus,
    Move,
    Sun,
    Moon
} from 'lucide-react';

const STORAGE_KEY = 'qtool_handwerker_mode_mockup_v1';

const getInitialState = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load mockup state from localStorage:", e);
    }
    return null;
};

const savedState = getInitialState();

export default function HandwerkerMockup() {
    // Dark / Light Mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('qtool_dark_mode');
        return saved !== null ? saved === 'true' : false;
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        localStorage.setItem('qtool_dark_mode', String(isDarkMode));
    }, [isDarkMode]);

    // ── STATE ──
    const [orderNumber, setOrderNumber] = useState(savedState?.orderNumber || 'BA-2024-015');
    const [projectTitle, setProjectTitle] = useState(savedState?.projectTitle || 'Badezimmer Sanierung');
    const [description, setDescription] = useState(
        savedState?.description !== undefined ? savedState.description : 'Komplette Sanierung des Badezimmers inkl. Fliesenarbeiten, Sanitär, Elektro und Malerarbeiten. Neue Dusche, Waschtisch und WC.'
    );
    const [status, setStatus] = useState(savedState?.status || 'In Arbeit');
    const [startDate, setStartDate] = useState(savedState?.startDate || '2024-05-27');
    const [endDate, setEndDate] = useState(savedState?.endDate || '2024-06-14');
    const [plannedDuration, setPlannedDuration] = useState(savedState?.plannedDuration || '40');
    const [plannedDurationUnit, setPlannedDurationUnit] = useState(savedState?.plannedDurationUnit || 'Stunden');
    const [assignedHandwerker, setAssignedHandwerker] = useState(savedState?.assignedHandwerker || ['Blerim Hasan', 'Vigan Buduri']);
    const [location, setLocation] = useState(savedState?.location || 'Musterstrasse 12, 8000 Zürich');

    // Photos state
    const [photos, setPhotos] = useState(savedState?.photos || []);

    // Sketches state
    const [sketches, setSketches] = useState(savedState?.sketches || []);

    // Zoom / Fullscreen Modal state
    const [showZoomModal, setShowZoomModal] = useState(false);
    const [zoomedSketch, setZoomedSketch] = useState(null);

    // Time tracking states for daily hours
    const [timeEntries, setTimeEntries] = useState(savedState?.timeEntries || [
        { id: 1, date: '2024-05-27', start: '07:30', end: '16:30', breakTime: '1.0', total: 8.0, task: 'Baustelle eingerichtet, Abbruch begonnen' },
        { id: 2, date: '2024-05-28', start: '07:30', end: '16:00', breakTime: '0.5', total: 8.0, task: 'Abbruch fertiggestellt, Leitungen verlegt' }
    ]);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [newTimeDate, setNewTimeDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTimeStart, setNewTimeStart] = useState('07:30');
    const [newTimeEnd, setNewTimeEnd] = useState('16:30');
    const [newTimeBreak, setNewTimeBreak] = useState('1.0');
    const [newTimeTask, setNewTimeTask] = useState('');

    const calculateHours = (start, end, breakHrs) => {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const diffMins = (eh * 60 + em) - (sh * 60 + sm);
        const diffHrs = diffMins / 60;
        return Math.max(0, diffHrs - parseFloat(breakHrs || 0));
    };

    const handleAddTimeEntry = (e) => {
        e.preventDefault();
        const total = calculateHours(newTimeStart, newTimeEnd, newTimeBreak);
        const entry = {
            id: Date.now(),
            date: newTimeDate,
            start: newTimeStart,
            end: newTimeEnd,
            breakTime: newTimeBreak,
            total: parseFloat(total.toFixed(2)),
            task: newTimeTask || 'Arbeitsleistung erbracht'
        };
        setTimeEntries(prev => [...prev, entry]);
        setShowTimeModal(false);
        setNewTimeTask('');
    };

    // Photo upload reference and handler for live photo capture
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newPhoto = {
                    id: `photo_${Date.now()}`,
                    title: file.name.split('.')[0] || 'Foto vor Ort',
                    src: reader.result
                };
                setPhotos(prev => [...prev, newPhoto]);
            };
            reader.readAsDataURL(file);
        }
    };

    // ── SEPARATE ISOLATED STORAGE FUNCTIONS (AUTOSAVE) ──
    useEffect(() => {
        try {
            const currentSaved = getInitialState() || {};
            const stateToSave = {
                ...currentSaved,
                photos,
                timeEntries,
                status
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to autosave mockup state to localStorage:", e);
        }
    }, [
        photos,
        timeEntries,
        status
    ]);

    const handleResetState = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            alert('Mockup-Speicher gelöscht. Standard-Testdaten werden neu geladen...');
            window.location.reload();
        } catch (e) {
            console.error("Failed to reset mockup state:", e);
            alert('Fehler beim Zurücksetzen: ' + e.message);
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: 'var(--background)', 
            color: 'var(--text-main)', 
            fontFamily: 'var(--font-desktop)',
            padding: '1.5rem',
            boxSizing: 'border-box'
        }}>
            
            {/* ── 1. HEADER ── */}
            <header className="card" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '1rem 1.5rem', 
                marginBottom: '1.5rem',
                border: '1.5px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span>📍</span>
                        <span>{location}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '1.1rem', marginLeft: '0.5rem' }}>({orderNumber})</span>
                    </h1>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ 
                        fontSize: '0.78rem', 
                        color: 'var(--text-muted)', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.3rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                    }}>
                        🟢 Auto-Save
                    </span>
                    
                    {/* Theme Switcher Toggle Button */}
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="btn btn-outline"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '38px',
                            height: '38px',
                            padding: 0,
                            cursor: 'pointer',
                            borderColor: 'var(--border)',
                            color: 'var(--text-muted)',
                            borderRadius: '4px',
                            marginLeft: '0.5rem',
                            flexShrink: 0
                        }}
                        title={isDarkMode ? "In den hellen Modus wechseln" : "In den dunklen Modus wechseln"}
                    >
                        {isDarkMode ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            {/* ── 2. TWO COLUMN WORKSPACE ── */}
            <main style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.1fr 0.9fr', 
                gap: '1.5rem',
                alignItems: 'start'
            }}>
                {/* LEFT COLUMN: Read-Only Order Card & Daily Time Tracking Sheet */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                    Auftrag: {orderNumber}
                                </h2>
                                <button 
                                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`, '_blank')}
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        padding: '0.4rem 0.8rem', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer',
                                        borderColor: 'var(--primary)',
                                        color: 'var(--primary)'
                                    }}
                                >
                                    <Move size={12} /> Google Maps Route
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>


                            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adresse:</span>
                                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{location}</p>
                            </div>

                            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Beschreibung</span>
                                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', lineHeight: 1.4, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{description}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Zeitfenster</span>
                                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, fontSize: '0.85rem' }}>{startDate} bis {endDate}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Geplanter Aufwand</span>
                                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, fontSize: '0.85rem' }}>{plannedDuration} {plannedDurationUnit}</p>
                                </div>
                            </div>

                            <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Dein Team vor Ort</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {assignedHandwerker.length === 0 ? (
                                        <span style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Keine Kollegen zugewiesen.</span>
                                    ) : (
                                        assignedHandwerker.map(name => (
                                            <span 
                                                key={name}
                                                style={{ 
                                                    backgroundColor: 'var(--color-primary-soft)', 
                                                    color: 'var(--primary)', 
                                                    padding: '0.3rem 0.75rem', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 700,
                                                    border: '1px solid var(--color-border-strong)'
                                                }}
                                            >
                                                👤 {name}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STUNDENERFASSUNG (DAILY TIME TRACKING SHEET) */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                Tägliche Stundenerfassung
                            </h2>
                            <button 
                                onClick={() => setShowTimeModal(true)}
                                className="btn btn-primary"
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem', 
                                    padding: '0.6rem 1.5rem', 
                                    fontWeight: 700, 
                                    height: '42px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Plus size={16} /> Stunden buchen
                            </button>
                        </div>

                        {timeEntries.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                Keine Stunden erfasst. Klicken Sie auf „Stunden buchen“, um Ihren heutigen Aufwand zu erfassen.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1.5px solid var(--border)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700 }}>
                                            <th style={{ padding: '0.5rem' }}>Datum</th>
                                            <th style={{ padding: '0.5rem' }}>Arbeitszeit</th>
                                            <th style={{ padding: '0.5rem' }}>Pause</th>
                                            <th style={{ padding: '0.5rem' }}>Gesamt</th>
                                            <th style={{ padding: '0.5rem' }}>Tätigkeit</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeEntries.map(entry => (
                                            <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                                                <td style={{ padding: '0.6rem 0.5rem' }}>{entry.date}</td>
                                                <td style={{ padding: '0.6rem 0.5rem' }}>{entry.start} - {entry.end}</td>
                                                <td style={{ padding: '0.6rem 0.5rem' }}>{entry.breakTime} Std.</td>
                                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>{entry.total.toFixed(2)} Std.</td>
                                                <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.task}>{entry.task}</td>
                                                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => setTimeEntries(prev => prev.filter(t => t.id !== entry.id))}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr style={{ backgroundColor: 'var(--color-primary-soft)', fontWeight: 700 }}>
                                            <td colSpan="3" style={{ padding: '0.75rem 0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Gesamtstunden erfasst</td>
                                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
                                                {timeEntries.reduce((sum, e) => sum + e.total, 0).toFixed(2)} Std.
                                            </td>
                                            <td colSpan="2" style={{ padding: '0.75rem 0.5rem' }}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* WORKFLOW ACTUATOR */}
                        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => {
                                    setStatus('Abgeschlossen');
                                    alert("Einsatz erfolgreich abgeschlossen! Alle erfassten Stunden und hochgeladenen Fotos wurden lokal gesichert.");
                                }}
                                className="btn btn-primary"
                                style={{ padding: '0.6rem 1.5rem', fontWeight: 700, height: '42px' }}
                            >
                                Einsatz beenden
                            </button>
                        </div>
                    </section>
                </div>

                {/* RIGHT COLUMN: Photos & Sketches Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* PHOTOS CARD (WITH CAPTURE/UPLOAD SUPPORT!) */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                Eigene Bilder
                            </h2>
                            <div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept="image/*" 
                                    style={{ display: 'none' }}
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.6rem', 
                                        padding: '0.75rem 1.5rem', 
                                        fontSize: '0.95rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Camera size={18} /> Foto aufnehmen
                                </button>
                            </div>
                        </div>

                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                            gap: '1.25rem', 
                            padding: '0.5rem 0',
                            overflow: 'visible'
                        }}>
                            {photos.length === 0 ? (
                                <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, gridColumn: '1 / -1' }}>Keine Bilder erfasst.</p>
                            ) : (
                                photos.map(photo => (
                                    <div 
                                        key={photo.id}
                                        style={{ 
                                            position: 'relative',
                                            borderRadius: '6px',
                                            border: '1.5px solid var(--border)',
                                            backgroundColor: '#FFFFFF',
                                            overflow: 'visible',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            height: '140px'
                                        }}
                                    >
                                        {/* White image container */}
                                        <div style={{ 
                                            flex: 1, 
                                            backgroundColor: '#FFFFFF', 
                                            borderTopLeftRadius: '5px', 
                                            borderTopRightRadius: '5px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            padding: '4px'
                                        }}>
                                            <img 
                                                src={photo.src} 
                                                alt={photo.title}
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                        </div>

                                        {/* Dark band at the bottom */}
                                        <div style={{ 
                                            backgroundColor: '#1E293B', 
                                            color: '#F8FAFC', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            padding: '0.4rem', 
                                            textAlign: 'center',
                                            borderBottomLeftRadius: '5px',
                                            borderBottomRightRadius: '5px',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            borderTop: '1px solid rgba(255,255,255,0.08)'
                                        }}>
                                            {photo.title}
                                        </div>

                                        {/* Overlapping red delete circle button */}
                                        <button 
                                            onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                                            style={{
                                                position: 'absolute',
                                                top: '-8px',
                                                right: '-8px',
                                                backgroundColor: '#EF4444',
                                                color: 'white',
                                                border: '2px solid #1E293B',
                                                borderRadius: '50%',
                                                width: '22px',
                                                height: '22px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0,
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                                zIndex: 10
                                            }}
                                        >
                                            <X size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* PLANNER CREATED SKETCHES CARD (READ ONLY) */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <h2 className="section-header" style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Informationen
                        </h2>
                        {sketches.length === 0 ? (
                            <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Keine Pläne hinterlegt.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                {sketches.map(sketch => (
                                    <div 
                                        key={sketch.id}
                                        onClick={() => {
                                            setZoomedSketch(sketch);
                                            setShowZoomModal(true);
                                        }}
                                        className="card"
                                        style={{
                                            padding: 0,
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            border: '1.5px solid var(--border)'
                                        }}
                                    >
                                        <div style={{ 
                                            height: '100px', 
                                            backgroundColor: '#FFFFFF', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            borderBottom: '1px solid var(--border)',
                                            overflow: 'hidden'
                                        }}>
                                            <img 
                                                src={sketch.src} 
                                                alt={sketch.title} 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                        </div>
                                        <div style={{ 
                                            padding: '0.4rem', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            color: 'var(--text-main)',
                                            whiteSpace: 'nowrap',
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden'
                                        }}>
                                            {sketch.title}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem', fontStyle: 'italic' }}>
                            Klicke auf einen Plan, um ihn im Vollbild zu betrachten.
                        </div>
                    </section>
                </div>
            </main>

            {/* ── 3. DAILY HOURS POPUP MODAL ── */}
            {showTimeModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', border: '1.5px solid var(--border)', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Stunden erfassen</h3>
                            <button onClick={() => setShowTimeModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAddTimeEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Datum</label>
                                <input type="date" required className="form-input" value={newTimeDate} onChange={(e) => setNewTimeDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr gap', gap: '1rem' }}>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Startzeit</label>
                                    <input type="time" required className="form-input" value={newTimeStart} onChange={(e) => setNewTimeStart(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Endzeit</label>
                                    <input type="time" required className="form-input" value={newTimeEnd} onChange={(e) => setNewTimeEnd(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Pause (in Stunden)</label>
                                <select className="form-input" value={newTimeBreak} onChange={(e) => setNewTimeBreak(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                                    <option value="0.0">Keine Pause</option>
                                    <option value="0.25">15 Minuten</option>
                                    <option value="0.5">30 Minuten</option>
                                    <option value="0.75">45 Minuten</option>
                                    <option value="1.0">1.0 Stunde</option>
                                    <option value="1.5">1.5 Stunden</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Durchgeführte Tätigkeit</label>
                                <textarea className="form-input" rows={3} value={newTimeTask} onChange={(e) => setNewTimeTask(e.target.value)} placeholder="z. B. Fliesen verlegt, Fugen gereinigt..." style={{ width: '100%', fontFamily: 'var(--font-desktop)', boxSizing: 'border-box', resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setShowTimeModal(false)} className="btn btn-outline">Abbrechen</button>
                                <button type="submit" className="btn btn-primary">Buchen</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── 4. PLAN ZOOM / LIGHTBOX MODAL ── */}
            {showZoomModal && zoomedSketch && (
                <div 
                    onClick={() => setShowZoomModal(false)}
                    style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        backgroundColor: 'rgba(15,23,42,0.92)', 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 200, 
                        padding: '2rem' 
                    }}
                >
                    <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1rem' }}>{zoomedSketch.title}</span>
                        <button 
                            onClick={() => setShowZoomModal(false)}
                            style={{ 
                                background: 'rgba(255,255,255,0.1)', 
                                border: 'none', 
                                color: '#FFFFFF', 
                                borderRadius: '50%', 
                                width: '36px', 
                                height: '36px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                cursor: 'pointer' 
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                            backgroundColor: '#FFFFFF', 
                            padding: '1rem', 
                            borderRadius: '8px', 
                            maxWidth: '90%', 
                            maxHeight: '80%', 
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                            overflow: 'auto',
                            display: 'block'
                        }}
                    >
                        <img 
                            src={zoomedSketch.src} 
                            alt={zoomedSketch.title} 
                            style={{ 
                                display: 'block',
                                maxWidth: '100%', 
                                maxHeight: '70vh', 
                                width: 'auto', 
                                height: 'auto', 
                                margin: '0 auto', 
                                objectFit: 'contain' 
                            }}
                        />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginTop: '1.5rem', textAlign: 'center' }}>
                        Dies ist eine schreibgeschützte Planungsansicht. Änderungen können nur vom Planer/Disponent vorgenommen werden.
                    </div>
                </div>
            )}

        </div>
    );
}
