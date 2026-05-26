import React, { useState, useRef, useEffect } from 'react';
import { 
    Plus, 
    X, 
    ChevronDown, 
    Calendar, 
    Info, 
    Trash2, 
    Save, 
    RotateCcw,
    Mail,
    Check,
    Camera,
    Move,
    Sun,
    Moon,
    Pen
} from 'lucide-react';
import MeasurementSketchCanvas from '../MeasurementSketchCanvas';

// Pre-drawn premium SVGs for Bathroom Sanierung sketches
const INITIAL_SKETCHES = [
    {
        id: 'sketch1',
        title: 'Grundriss – Bestandsaufnahme',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="#1E293B" stroke-width="3"/>
            <!-- Wände & Türen -->
            <path d="M20 140H60" stroke="#1E293B" stroke-width="3"/>
            <path d="M60 140C60 160 40 180 20 180" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="2 2"/>
            <line x1="60" y1="140" x2="20" y2="180" stroke="#3B82F6" stroke-width="2"/>
            <!-- Waschtisch Bestand -->
            <rect x="220" y="60" width="40" height="30" rx="3" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
            <circle cx="240" cy="75" r="5" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
            <!-- Badewanne Bestand -->
            <rect x="20" y="20" width="100" height="50" rx="4" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
            <ellipse cx="70" cy="45" rx="40" ry="18" fill="none" stroke="#CBD5E1" stroke-width="1"/>
            <!-- Bemassung -->
            <line x1="20" y1="190" x2="280" y2="190" stroke="#EF4444" stroke-width="1"/>
            <path d="M20 187V193M280 187V193" stroke="#EF4444" stroke-width="1"/>
            <text x="150" y="197" fill="#EF4444" font-family="monospace" font-size="9" text-anchor="middle">3.20 m</text>
            <text x="150" y="105" fill="#94A3B8" font-family="sans-serif" font-size="11" text-anchor="middle">Badezimmer Altbestand</text>
        </svg>`)
    },
    {
        id: 'sketch2',
        title: 'Grundriss – Neuplanung',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="#1E293B" stroke-width="3"/>
            <!-- Dusche neu -->
            <rect x="20" y="20" width="80" height="80" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/>
            <line x1="20" y1="20" x2="100" y2="100" stroke="#3B82F6" stroke-width="1" stroke-dasharray="3 3"/>
            <line x1="100" y1="20" x2="20" y2="100" stroke="#3B82F6" stroke-width="1" stroke-dasharray="3 3"/>
            <circle cx="60" cy="60" r="4" fill="#3B82F6"/>
            <!-- WC neu -->
            <rect x="230" y="120" width="30" height="40" rx="4" fill="none" stroke="#1E6DB7" stroke-width="1.5"/>
            <rect x="225" y="110" width="40" height="10" rx="1" fill="none" stroke="#1E6DB7" stroke-width="1.5"/>
            <text x="150" y="105" fill="#1E6DB7" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Dusche &amp; WC neu platziert</text>
        </svg>`)
    },
    {
        id: 'sketch3',
        title: 'Sanitär – Anschlüsse',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="#1E293B" stroke-width="2" stroke-dasharray="8 4"/>
            <!-- Kaltwasser (Blau) -->
            <path d="M40 180V120H180V60" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="180" cy="60" r="6" fill="#2563EB"/>
            <!-- Warmwasser (Rot) -->
            <path d="M55 180V135H195V60" stroke="#DC2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="195" cy="60" r="6" fill="#DC2626"/>
            <text x="120" y="110" fill="#2563EB" font-family="sans-serif" font-size="10" font-weight="bold">KW Ø16</text>
            <text x="210" y="110" fill="#DC2626" font-family="sans-serif" font-size="10" font-weight="bold">WW Ø16</text>
            <text x="150" y="35" fill="#1E293B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Anschlussleitung Höhe 55cm</text>
        </svg>`)
    }
];

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

export default function DisponentMockup() {
    const [viewRole, setViewRole] = useState('Disponent'); // 'Disponent' or 'Handwerker'

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
    const [priority, setPriority] = useState(savedState?.priority || 'Hoch');
    const [status, setStatus] = useState(savedState?.status || 'In Arbeit');
    const [startDate, setStartDate] = useState(savedState?.startDate || '2024-05-27');
    const [endDate, setEndDate] = useState(savedState?.endDate || '2024-06-14');
    const [plannedDuration, setPlannedDuration] = useState(savedState?.plannedDuration || '40');
    const [plannedDurationUnit, setPlannedDurationUnit] = useState(savedState?.plannedDurationUnit || 'Stunden');

    // Handwerker-Zuweisung
    const [assignedHandwerker, setAssignedHandwerker] = useState(savedState?.assignedHandwerker || ['Blerim Hasan', 'Vigan Buduri']);
    const [showHandwerkerDropdown, setShowHandwerkerDropdown] = useState(false);
    const availableHandwerker = ['Blerim Hasan', 'Vigan Buduri', 'Arben Krasniqi', 'Luan Gashi'];

    // Photos state
    const [photos, setPhotos] = useState(savedState?.photos || []);

    // Sketches state
    const [sketches, setSketches] = useState(savedState?.sketches || INITIAL_SKETCHES);

    // Drawing canvas state
    const [showCanvasModal, setShowCanvasModal] = useState(false);
    const [canvasTitle, setCanvasTitle] = useState('');
    const [editingSketchId, setEditingSketchId] = useState(null);

    // Zoom / Fullscreen Modal state
    const [showZoomModal, setShowZoomModal] = useState(false);
    const [zoomedSketch, setZoomedSketch] = useState(null);

    // Outlook simulation Modal state
    const [showOutlookModal, setShowOutlookModal] = useState(false);
    const [location, setLocation] = useState(savedState?.location || 'Musterstrasse 12, 8000 Zürich');

    // Time entries state (shared and interactive in both views)
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

    const toggleHandwerker = (name) => {
        if (assignedHandwerker.includes(name)) {
            setAssignedHandwerker(prev => prev.filter(h => h !== name));
        } else {
            setAssignedHandwerker(prev => [...prev, name]);
        }
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

    // Hours tracker helpers
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

    // Click outside handler for Handwerker Zuweisung dropdown
    const handwerkerDropdownRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (handwerkerDropdownRef.current && !handwerkerDropdownRef.current.contains(e.target)) {
                setShowHandwerkerDropdown(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, []);

    // ── SEPARATE ISOLATED STORAGE FUNCTIONS (AUTOSAVE) ──
    useEffect(() => {
        try {
            const stateToSave = {
                orderNumber,
                projectTitle,
                description,
                priority,
                status,
                startDate,
                endDate,
                plannedDuration,
                plannedDurationUnit,
                assignedHandwerker,
                photos,
                sketches,
                location,
                timeEntries
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to autosave mockup state to localStorage:", e);
        }
    }, [
        orderNumber,
        projectTitle,
        description,
        priority,
        status,
        startDate,
        endDate,
        plannedDuration,
        plannedDurationUnit,
        assignedHandwerker,
        photos,
        sketches,
        location,
        timeEntries
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

    // Outlook invite ICS generation
    const downloadIcsFile = () => {
        try {
            const formattedStart = startDate.replace(/-/g, '');
            const formattedEnd = endDate.replace(/-/g, '');
            
            const attendeeString = assignedHandwerker.map(name => {
                const email = name.toLowerCase().replace(' ', '.') + '@q-service.ch';
                return `ATTENDEE;CN="${name}":mailto:${email}`;
            }).join('\r\n');

            const descriptionText = `Hallo,
   
du bist fuer diesen Auftrag eingeteilt.
   
Details zum Einsatz:
- Auftragsnummer: ${orderNumber}
- Standort: ${location}
- Zeitraum: ${startDate} bis ${endDate}
- Zeitaufwand: ${plannedDuration} ${plannedDurationUnit}
   
Beschreibung:
${description.replace(/\n/g, ' ')}
   
Link zum Auftrag:
https://qtool.q-service.ch/project/${orderNumber}`;

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Q-Service//QTool Mockup//DE',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'BEGIN:VEVENT',
                `UID:${orderNumber}-${Date.now()}@q-service.ch`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                `DTSTART:${formattedStart}T080000`,
                `DTEND:${formattedEnd}T170000`,
                `SUMMARY:Arbeitsauftrag ${orderNumber}: ${projectTitle}`,
                `LOCATION:${location.replace(/,/g, '\\,')}`,
                `DESCRIPTION:${descriptionText.replace(/\n/g, '\\n')}`,
                attendeeString,
                `URL;VALUE=URI:https://qtool.q-service.ch/project/${orderNumber}`,
                'END:VEVENT',
                'END:VCALENDAR'
            ].filter(Boolean).join('\r\n');

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `Arbeitsauftrag_${orderNumber}.ics`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Failed to generate ICS file:", e);
            alert("Fehler bei der ICS-Generierung: " + e.message);
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                            {projectTitle}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'nowrap' }}>
                            <span style={{ 
                                fontSize: '0.85rem', 
                                color: 'var(--primary)', 
                                backgroundColor: 'var(--color-primary-soft)', 
                                fontWeight: 800, 
                                padding: '0.2rem 0.6rem', 
                                borderRadius: '4px',
                                border: '1px solid var(--color-border-strong)',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.02em'
                            }}>
                                {orderNumber}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
                            <span 
                                className="status-badge bg-green-100"
                                style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    padding: '0.2rem 0.6rem', 
                                    borderRadius: '20px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {status}
                            </span>
                        </div>
                    </div>
                    
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
                
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0 }}>
                    <button 
                        onClick={() => alert("Neuer Auftrag erstellen ist in diesem isolierten Mockup nicht aktiv.")}
                        className="btn btn-primary"
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.4rem', 
                            padding: '0.5rem 0.9rem', 
                            fontSize: '0.82rem', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            height: '38px',
                            boxSizing: 'border-box'
                        }}
                    >
                        <Plus size={14} /> Neuer Auftrag
                    </button>
                    <span style={{ 
                        fontSize: '0.78rem', 
                        color: 'var(--text-muted)', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.3rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        marginRight: '0.2rem'
                    }}>
                        🟢 Auto-Save
                    </span>

                    {viewRole === 'Disponent' && (
                        <>
                            <button 
                                onClick={() => setShowOutlookModal(true)}
                                className="btn btn-outline"
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.4rem', 
                                    padding: '0.5rem 0.9rem', 
                                    fontSize: '0.82rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    height: '38px',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <Mail size={14} /> Outlook
                            </button>

                        </>
                    )}
                </div>
            </header>

            {/* ── 2. TWO COLUMN WORKSPACE (SWITCHABLE ROLE) ── */}
            {viewRole === 'Handwerker' ? (
                /* ── SIMULATED HANDWERKER PORTAL PREVIEW ── */
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
                                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Titel</span>
                                    <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 700 }}>{projectTitle}</h3>
                                </div>

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
                        
                        {/* PHOTOS CARD */}
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
            ) : (
                /* ── COMPLETE DISPONENT / PLANNER VIEW ── */
                <main style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.1fr 0.9fr', 
                    gap: '1.5rem',
                    alignItems: 'start'
                }}>
                    
                    {/* LEFT COLUMN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* ARBEITSAUFTRAG-KARTE */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <h2 className="section-header" style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Arbeitsauftrag
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Dummy input to absorb password manager / LastPass icon injection */}
                                <input 
                                    type="text" 
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: -1 }} 
                                    tabIndex={-1} 
                                />

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Auftragsnummer</label>
                                        <input 
                                            type="text" 
                                            name="auftragsnummer"
                                            id="auftragsnummer"
                                            className="form-input"
                                            value={orderNumber} 
                                            onChange={(e) => setOrderNumber(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box' }}
                                            data-lpignore="true"
                                            data-1p-ignore="true"
                                            data-bwignore="true"
                                            autocomplete="off"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Titel</label>
                                        <input 
                                            type="text" 
                                            className="form-input"
                                            value={projectTitle} 
                                            onChange={(e) => setProjectTitle(e.target.value)}
                                            style={{ width: '100%', fontWeight: 600, boxSizing: 'border-box' }}
                                            data-lpignore="true"
                                            autocomplete="off"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Standort / Einsatzadresse</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={location} 
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="z. B. Hauptstrasse 45, 9000 St. Gallen"
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        data-lpignore="true"
                                        autocomplete="off"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Beschreibung</label>
                                    <textarea 
                                        className="form-input"
                                        value={description} 
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        style={{ width: '100%', fontFamily: 'var(--font-desktop)', lineHeight: 1.4, boxSizing: 'border-box', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Priorität</label>
                                        <select 
                                            className="form-input"
                                            value={priority} 
                                            onChange={(e) => setPriority(e.target.value)}
                                            style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                        >
                                            <option value="Niedrig">Niedrig</option>
                                            <option value="Mittel">Mittel</option>
                                            <option value="Hoch">Hoch</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Status</label>
                                        <select 
                                            className="form-input"
                                            value={status} 
                                            onChange={(e) => setStatus(e.target.value)}
                                            style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                        >
                                            <option value="In Arbeit">In Arbeit</option>
                                            <option value="Abgeschlossen">Abgeschlossen</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Gewünschter Start</label>
                                        <div style={{ position: 'relative' }}>
                                            <input 
                                                type="date" 
                                                className="form-input"
                                                value={startDate} 
                                                onChange={(e) => setStartDate(e.target.value)}
                                                style={{ width: '100%', paddingLeft: '2.2rem', boxSizing: 'border-box' }}
                                            />
                                            <Calendar size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Fertigstellung bis</label>
                                        <div style={{ position: 'relative' }}>
                                            <input 
                                                type="date" 
                                                className="form-input"
                                                value={endDate} 
                                                onChange={(e) => setEndDate(e.target.value)}
                                                style={{ width: '100%', paddingLeft: '2.2rem', boxSizing: 'border-box' }}
                                            />
                                            <Calendar size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Geplanter Zeitaufwand</label>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <input 
                                            type="number" 
                                            className="form-input"
                                            value={plannedDuration} 
                                            onChange={(e) => setPlannedDuration(e.target.value)}
                                            style={{ width: '100px' }}
                                        />
                                        <select 
                                            className="form-input"
                                            value={plannedDurationUnit} 
                                            onChange={(e) => setPlannedDurationUnit(e.target.value)}
                                            style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}
                                        >
                                            <option value="Stunden">Stunden</option>
                                            <option value="Arbeitstage">Arbeitstage</option>
                                        </select>
                                        <Info size={16} style={{ color: 'var(--primary)', cursor: 'help' }} title="Geschätzter Zeitaufwand für die Durchführung" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* HANDWERKER-ZUWEISUNG */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <h2 className="section-header" style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Handwerker Zuweisung
                            </h2>

                            <div ref={handwerkerDropdownRef} style={{ position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Handwerker</label>
                                
                                <div 
                                    onClick={() => setShowHandwerkerDropdown(!showHandwerkerDropdown)}
                                    className="form-input"
                                    style={{ 
                                        display: 'flex', 
                                        flexWrap: 'wrap', 
                                        gap: '0.4rem', 
                                        padding: '0.5rem 0.75rem', 
                                        minHeight: '44px',
                                        cursor: 'pointer',
                                        alignItems: 'center',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    {assignedHandwerker.length === 0 && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Keine Handwerker zugewiesen...</span>
                                    )}
                                    {assignedHandwerker.map(name => (
                                        <span 
                                            key={name}
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                setAssignedHandwerker(prev => prev.filter(h => h !== name));
                                            }}
                                            style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: '0.25rem', 
                                                backgroundColor: 'var(--color-primary-soft)', 
                                                color: 'var(--primary)', 
                                                padding: '0.25rem 0.6rem', 
                                                borderRadius: '4px', 
                                                fontSize: '0.85rem', 
                                                fontWeight: 600,
                                                border: '1px solid var(--color-border-strong)'
                                            }}
                                        >
                                            {name}
                                            <X size={12} style={{ opacity: 0.8, cursor: 'pointer' }} />
                                        </span>
                                    ))}
                                    <ChevronDown size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                                </div>

                                {showHandwerkerDropdown && (
                                    <div style={{ 
                                        position: 'absolute', 
                                        top: '100%', 
                                        left: 0, 
                                        right: 0, 
                                        backgroundColor: 'var(--surface)', 
                                        border: '1.5px solid var(--border)', 
                                        borderRadius: '4px', 
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                                        zIndex: 50,
                                        marginTop: '0.25rem',
                                        overflow: 'hidden'
                                    }}>
                                        {availableHandwerker.map(name => {
                                            const isChecked = assignedHandwerker.includes(name);
                                            return (
                                                <div 
                                                    key={name}
                                                    onClick={() => toggleHandwerker(name)}
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'space-between', 
                                                        padding: '0.75rem 1rem', 
                                                        fontSize: '0.9rem',
                                                        cursor: 'pointer',
                                                        backgroundColor: isChecked ? 'var(--color-row-hover)' : 'transparent',
                                                        color: 'var(--text-main)',
                                                        fontWeight: isChecked ? 600 : 500,
                                                        borderBottom: '1px solid var(--border)'
                                                    }}
                                                >
                                                    <span>{name}</span>
                                                    {isChecked && <Check size={16} color="var(--primary)" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* FOTOS-KARTE */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <h2 className="section-header" style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Fotos
                            </h2>

                            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                {photos.map(photo => (
                                    <div 
                                        key={photo.id}
                                        style={{ 
                                            width: '120px', 
                                            height: '120px', 
                                            borderRadius: '6px', 
                                            overflow: 'hidden', 
                                            border: '1.5px solid var(--border)', 
                                            position: 'relative',
                                            flexShrink: 0
                                        }}
                                    >
                                        <img 
                                            src={photo.src} 
                                            alt={photo.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div style={{ 
                                            position: 'absolute', 
                                            bottom: 0, 
                                            left: 0, 
                                            right: 0, 
                                            backgroundColor: 'rgba(15,23,42,0.75)', 
                                            color: '#FFFFFF', 
                                            fontSize: '0.65rem', 
                                            padding: '0.2rem 0.4rem', 
                                            textAlign: 'center',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden'
                                        }}>
                                            {photo.title}
                                        </div>
                                        
                                        <button 
                                            onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4,
                                                backgroundColor: 'rgba(239,68,68,0.9)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: 18,
                                                height: 18,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}

                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept="image/*" 
                                    style={{ display: 'none' }}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn-outline"
                                    style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        width: '120px', 
                                        height: '120px', 
                                        borderRadius: '6px', 
                                        border: '2px dashed var(--border)', 
                                        cursor: 'pointer', 
                                        color: 'var(--primary)', 
                                        backgroundColor: 'transparent',
                                        flexShrink: 0,
                                        gap: '0.4rem',
                                        boxShadow: 'none'
                                    }}
                                >
                                    <Camera size={20} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Foto hinzufügen</span>
                                </button>
                            </div>
                        </section>

                        {/* SKIZZEN-KARTE */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                    Skizzen & Pläne
                                </h2>
                                
                                <button 
                                    onClick={() => {
                                        setEditingSketchId(null);
                                        setCanvasTitle('');
                                        setShowCanvasModal(true);
                                    }}
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        padding: '0.4rem 0.8rem', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={14} /> Neue Skizze
                                </button>
                            </div>

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
                                            height: '110px', 
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
                                            padding: '0.5rem', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            color: 'var(--text-main)',
                                            whiteSpace: 'nowrap',
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden'
                                        }}>
                                            {sketch.title}
                                        </div>

                                        {/* Edit sketch button */}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                setEditingSketchId(sketch.id);
                                                setCanvasTitle(sketch.title);
                                                setShowCanvasModal(true);
                                            }}
                                            title="Skizze bearbeiten"
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 26,
                                                backgroundColor: 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: 18,
                                                height: 18,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            <Pen size={9} />
                                        </button>

                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                setSketches(prev => prev.filter(s => s.id !== sketch.id));
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4,
                                                backgroundColor: 'rgba(239,68,68,0.9)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: 18,
                                                height: 18,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem', fontStyle: 'italic' }}>
                                Klicke auf eine Skizze, um sie zu bearbeiten oder im Detail zu betrachten.
                            </div>
                        </section>
                    </div>
                </main>
            )}

            {/* ── 3. SKETCH CREATOR CANVAS ── */}
            <MeasurementSketchCanvas
                isOpen={showCanvasModal}
                onClose={() => {
                    setShowCanvasModal(false);
                    setCanvasTitle('');
                    setEditingSketchId(null);
                }}
                onSave={({ canvasImage, galleryPhotos, title }) => {
                    if (editingSketchId) {
                        setSketches(prev => prev.map(s => s.id === editingSketchId ? { ...s, title: title || 'Neue Skizze', src: canvasImage } : s));
                    } else {
                        const newSketch = {
                            id: `sketch_${Date.now()}`,
                            title: title || 'Neue Skizze',
                            src: canvasImage
                        };
                        setSketches(prev => [...prev, newSketch]);
                    }
                    setShowCanvasModal(false);
                    setCanvasTitle('');
                    setEditingSketchId(null);
                }}
                title={canvasTitle}
                showTitleInput={true}
                initialGalleryPhotos={[]}
                initialCanvasImage={editingSketchId ? sketches.find(s => s.id === editingSketchId)?.src : null}
            />

            {/* ── 4. ZOOM MODAL ── */}
            {showZoomModal && zoomedSketch && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.9)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div className="card" style={{ 
                        backgroundColor: 'var(--surface)', 
                        width: '100%', 
                        maxWidth: '750px', 
                        padding: '1.5rem', 
                        border: '1.5px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {zoomedSketch.title}
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowZoomModal(false);
                                    setZoomedSketch(null);
                                }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div style={{ 
                            backgroundColor: '#FFFFFF', 
                            borderRadius: '6px', 
                            border: '1.5px solid var(--border)', 
                            padding: '1rem',
                            display: 'block',
                            overflow: 'auto',
                            minHeight: '350px',
                            maxHeight: '500px'
                        }}>
                            <img 
                                src={zoomedSketch.src} 
                                alt={zoomedSketch.title} 
                                style={{ 
                                    display: 'block',
                                    maxWidth: '100%', 
                                    maxHeight: '420px', 
                                    width: 'auto',
                                    height: 'auto',
                                    margin: '0 auto',
                                    objectFit: 'contain' 
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button 
                                onClick={() => {
                                    setSketches(prev => prev.filter(s => s.id !== zoomedSketch.id));
                                    setShowZoomModal(false);
                                    setZoomedSketch(null);
                                }}
                                className="btn"
                                style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backgroundColor: 'transparent', 
                                    color: 'var(--danger)', 
                                    border: '1.5px solid var(--danger)', 
                                    padding: '0.6rem 1.2rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={16} /> Skizze löschen
                            </button>
                            <button 
                                onClick={() => {
                                    setEditingSketchId(zoomedSketch.id);
                                    setCanvasTitle(zoomedSketch.title);
                                    setShowZoomModal(false);
                                    setShowCanvasModal(true);
                                }}
                                className="btn btn-outline"
                                style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.6rem 1.2rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    borderColor: 'var(--primary)',
                                    color: 'var(--primary)'
                                }}
                            >
                                <Pen size={16} /> Skizze bearbeiten
                            </button>
                            <button 
                                onClick={() => {
                                    setShowZoomModal(false);
                                    setZoomedSketch(null);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                            >
                                Schliessen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 5. OUTLOOK SIMULATION MODAL ── */}
            {showOutlookModal && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.85)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div className="card" style={{ 
                        backgroundColor: 'var(--surface)', 
                        width: '100%', 
                        maxWidth: '650px', 
                        padding: '1.75rem', 
                        border: '1.5px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Mail size={20} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    Outlook Kalendereinträge generieren
                                </h3>
                            </div>
                            <button 
                                onClick={() => setShowOutlookModal(false)} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {assignedHandwerker.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Info size={32} style={{ color: 'var(--warning)', marginBottom: '0.75rem' }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>Keine Handwerker zugewiesen!</p>
                                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Bitte weise unter dem Abschnitt "Handwerker Zuweisung" zuerst mindestens einen Handwerker zu.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--color-primary-soft)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)' }}>
                                    <strong>Outlook-Mockup Integration:</strong> Es werden separate Kalender-Termine (.ics Format) für die zugewiesenen Handwerker generiert und der Standort automatisch aus dem Auftrag extrahiert.
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Betreff:</span>
                                    <span>Arbeitsauftrag {orderNumber}: {projectTitle}</span>
                                    
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Standort:</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{location || 'Kein Standort angegeben'}</span>
                                    
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Zeitraum:</span>
                                    <span>{startDate} bis {endDate}</span>
                                    
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Direktlink:</span>
                                    <span style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}>https://qtool.q-service.ch/project/{orderNumber}</span>
                                </div>

                                <h4 style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generierte Einladungen</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {assignedHandwerker.map(name => (
                                        <div key={name} style={{ backgroundColor: 'var(--background)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                                                <strong style={{ color: 'var(--text-main)' }}>{name}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>{name.toLowerCase().replace(' ', '.') + '@q-service.ch'}</span>
                                            </div>
                                            <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-muted)', lineHeight: 1.3 }}>
{`Betreff: Einteilung - ${projectTitle} (${orderNumber})
Ort: ${location}
Termin: ${startDate} bis ${endDate}

Hallo ${name.split(' ')[0]},
du bist für diesen Auftrag eingeteilt.

Link zum Auftrag:
https://qtool.q-service.ch/project/${orderNumber}`}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                            <button 
                                onClick={() => setShowOutlookModal(false)}
                                className="btn btn-outline"
                                style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                            >
                                Schliessen
                            </button>
                            {assignedHandwerker.length > 0 && (
                                <>
                                    <button 
                                        onClick={downloadIcsFile}
                                        className="btn btn-outline"
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.4rem',
                                            padding: '0.6rem 1.2rem', 
                                            fontWeight: 700, 
                                            borderColor: 'var(--primary)',
                                            color: 'var(--primary)',
                                            cursor: 'pointer' 
                                        }}
                                    >
                                        <Calendar size={16} /> .ics Kalenderdatei
                                    </button>
                                    <button 
                                        onClick={() => {
                                            alert("Erfolgreich simulierte Kalendereinträge!\n\nKalendereinträge im Hintergrund erstellt und per Mail-Einladung an alle zugewiesenen Handwerker geschickt.");
                                            setShowOutlookModal(false);
                                        }}
                                        className="btn btn-primary"
                                        style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                                    >
                                        Einträge senden (Simuliert)
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 6. TIME BOOKING MODAL (STUNDENERFASSUNG) ── */}
            {showTimeModal && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.85)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <form 
                        onSubmit={handleAddTimeEntry}
                        className="card" 
                        style={{ 
                            backgroundColor: 'var(--surface)', 
                            width: '100%', 
                            maxWidth: '450px', 
                            padding: '1.5rem', 
                            border: '1.5px solid var(--border)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={18} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                    Arbeitsstunden buchen
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowTimeModal(false)} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Date Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Datum</label>
                            <input 
                                type="date" 
                                required
                                className="form-input"
                                value={newTimeDate}
                                onChange={(e) => setNewTimeDate(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Start & End Times */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Startzeit</label>
                                <input 
                                    type="time" 
                                    required
                                    className="form-input"
                                    value={newTimeStart}
                                    onChange={(e) => setNewTimeStart(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Endzeit</label>
                                <input 
                                    type="time" 
                                    required
                                    className="form-input"
                                    value={newTimeEnd}
                                    onChange={(e) => setNewTimeEnd(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        {/* Break */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Pause (in Stunden)</label>
                            <select 
                                className="form-input"
                                value={newTimeBreak}
                                onChange={(e) => setNewTimeBreak(e.target.value)}
                                style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                            >
                                <option value="0.0">Keine Pause</option>
                                <option value="0.25">15 Minuten (0.25 Std.)</option>
                                <option value="0.5">30 Minuten (0.50 Std.)</option>
                                <option value="0.75">45 Minuten (0.75 Std.)</option>
                                <option value="1.0">1 Stunde (1.00 Std.)</option>
                                <option value="1.5">1.5 Stunden (1.50 Std.)</option>
                            </select>
                        </div>

                        {/* Task Activity Description */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Ausgeführte Tätigkeit</label>
                            <input 
                                type="text" 
                                required
                                className="form-input"
                                placeholder="z. B. Fliesen verlegt und gereinigt"
                                value={newTimeTask}
                                onChange={(e) => setNewTimeTask(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button 
                                type="button" 
                                onClick={() => setShowTimeModal(false)} 
                                className="btn btn-outline"
                            >
                                Abbrechen
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                            >
                                Buchen
                            </button>
                        </div>
                    </form>
                </div>
            )}

        </div>
    );
}
