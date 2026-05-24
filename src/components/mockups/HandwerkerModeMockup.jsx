import React, { useState, useRef, useEffect } from 'react';
import { 
    Plus, 
    X, 
    ChevronDown, 
    Calendar, 
    Info, 
    Trash2, 
    Image, 
    Camera, 
    Save, 
    RotateCcw,
    Mail
} from 'lucide-react';

// Pre-defined premium SVGs as mock data for Bathroom Sanierung photos
const MOCK_PHOTOS = [
    {
        id: 'photo1',
        title: 'Rohbau Badezimmer',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="%23E2E8F0"/>
            <path d="M50 40H250V160H50V40Z" stroke="%2394A3B8" stroke-width="2" stroke-dasharray="4 4"/>
            <line x1="120" y1="40" x2="120" y2="160" stroke="%2394A3B8" stroke-width="2"/>
            <line x1="50" y1="120" x2="250" y2="120" stroke="%23CBD5E1" stroke-width="1.5"/>
            <rect x="70" y="60" width="30" height="60" fill="%2394A3B8" opacity="0.3"/>
            <circle cx="85" cy="90" r="8" fill="%23EF4444" opacity="0.5"/>
            <text x="150" y="105" fill="%2364748B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Bestand / Abbruch</text>
        </svg>`
    },
    {
        id: 'photo2',
        title: 'Sanitär Leitungen',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="%23F1F5F9"/>
            <path d="M80 160V80H220V160" stroke="%233B82F6" stroke-width="4" stroke-linecap="round"/>
            <path d="M100 160V100H200V160" stroke="%23EF4444" stroke-width="4" stroke-linecap="round"/>
            <circle cx="150" cy="80" r="10" fill="%23CBD5E1" stroke="%23475569" stroke-width="2"/>
            <text x="150" y="130" fill="%23475569" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Rohinstallation Wasser</text>
        </svg>`
    },
    {
        id: 'photo3',
        title: 'Estrich & Dämmung',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="%23F8FAFC"/>
            <rect x="40" y="140" width="220" height="30" fill="%2394A3B8" rx="2"/>
            <rect x="40" y="110" width="220" height="25" fill="%23CBD5E1" rx="2"/>
            <line x1="40" y1="135" x2="260" y2="135" stroke="%23FFFFFF" stroke-width="2"/>
            <text x="150" y="70" fill="%2364748B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Bodenaufbau fertiggestellt</text>
        </svg>`
    }
];

// Pre-drawn premium SVGs for Bathroom Sanierung sketches
const INITIAL_SKETCHES = [
    {
        id: 'sketch1',
        title: 'Grundriss – Bestandsaufnahme',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="%231E293B" stroke-width="3"/>
            <!-- Wände & Türen -->
            <path d="M20 140H60" stroke="%231E293B" stroke-width="3"/>
            <path d="M60 140C60 160 40 180 20 180" stroke="%233B82F6" stroke-width="1.5" stroke-dasharray="2 2"/>
            <line x1="60" y1="140" x2="20" y2="180" stroke="%233B82F6" stroke-width="2"/>
            <!-- Waschtisch Bestand -->
            <rect x="220" y="60" width="40" height="30" rx="3" fill="none" stroke="%2394A3B8" stroke-width="1.5"/>
            <circle cx="240" cy="75" r="5" fill="none" stroke="%2394A3B8" stroke-width="1.5"/>
            <!-- Badewanne Bestand -->
            <rect x="20" y="20" width="100" height="50" rx="4" fill="none" stroke="%2394A3B8" stroke-width="1.5"/>
            <ellipse cx="70" cy="45" rx="40" ry="18" fill="none" stroke="%23CBD5E1" stroke-width="1"/>
            <!-- Bemassung -->
            <line x1="20" y1="190" x2="280" y2="190" stroke="%23EF4444" stroke-width="1"/>
            <path d="M20 187V193M280 187V193" stroke="%23EF4444" stroke-width="1"/>
            <text x="150" y="197" fill="%23EF4444" font-family="monospace" font-size="9" text-anchor="middle">3.20 m</text>
            <text x="150" y="105" fill="%2394A3B8" font-family="sans-serif" font-size="11" text-anchor="middle">Badezimmer Altbestand</text>
        </svg>`
    },
    {
        id: 'sketch2',
        title: 'Grundriss – Neuplanung',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="%231E293B" stroke-width="3"/>
            <!-- Dusche neu -->
            <rect x="20" y="20" width="80" height="80" fill="%23EFF6FF" stroke="%233B82F6" stroke-width="2"/>
            <line x1="20" y1="20" x2="100" y2="100" stroke="%233B82F6" stroke-width="1" stroke-dasharray="3 3"/>
            <line x1="100" y1="20" x2="20" y2="100" stroke="%233B82F6" stroke-width="1" stroke-dasharray="3 3"/>
            <circle cx="60" cy="60" r="4" fill="%233B82F6"/>
            <!-- WC neu -->
            <rect x="230" y="120" width="30" height="40" rx="4" fill="none" stroke="%231E6DB7" stroke-width="1.5"/>
            <rect x="225" y="110" width="40" height="10" rx="1" fill="none" stroke="%231E6DB7" stroke-width="1.5"/>
            <text x="150" y="105" fill="%231E6DB7" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Dusche &amp; WC neu platziert</text>
        </svg>`
    },
    {
        id: 'sketch3',
        title: 'Sanitär – Anschlüsse',
        src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="%231E293B" stroke-width="2" stroke-dasharray="8 4"/>
            <!-- Kaltwasser (Blau) -->
            <path d="M40 180V120H180V60" stroke="%232563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="180" cy="60" r="6" fill="%232563EB"/>
            <!-- Warmwasser (Rot) -->
            <path d="M55 180V135H195V60" stroke="%23DC2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="195" cy="60" r="6" fill="%23DC2626"/>
            <text x="120" y="110" fill="%232563EB" font-family="sans-serif" font-size="10" font-weight="bold">KW Ø16</text>
            <text x="210" y="110" fill="%23DC2626" font-family="sans-serif" font-size="10" font-weight="bold">WW Ø16</text>
            <text x="150" y="35" fill="%231E293B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Anschlussleitung Höhe 55cm</text>
        </svg>`
    }
];

export default function HandwerkerModeMockup() {
    // ── STATE ──
    const [activeTab, setActiveTab] = useState('Arbeitsauftrag');
    const [orderNumber, setOrderNumber] = useState('BA-2024-015');
    const [projectTitle, setProjectTitle] = useState('Badezimmer Sanierung');
    const [description, setDescription] = useState(
        'Komplette Sanierung des Badezimmers inkl. Fliesenarbeiten, Sanitär, Elektro und Malerarbeiten. Neue Dusche, Waschtisch und WC.'
    );
    const [priority, setPriority] = useState('Hoch');
    const [status, setStatus] = useState('In Arbeit');
    const [startDate, setStartDate] = useState('2024-05-27');
    const [endDate, setEndDate] = useState('2024-06-14');
    const [plannedDuration, setPlannedDuration] = useState('40');
    const [plannedDurationUnit, setPlannedDurationUnit] = useState('Stunden');

    // Handwerker-Zuweisung
    const [assignedHandwerker, setAssignedHandwerker] = useState(['Blerim Hasan', 'Vigan Buduri']);
    const [showHandwerkerDropdown, setShowHandwerkerDropdown] = useState(false);
    const availableHandwerker = ['Blerim Hasan', 'Vigan Buduri', 'Arben Krasniqi', 'Luan Gashi'];

    // Photos state
    const [photos, setPhotos] = useState(MOCK_PHOTOS);

    // Sketches state
    const [sketches, setSketches] = useState(INITIAL_SKETCHES);

    // Canvas drawing modal state
    const [showCanvasModal, setShowCanvasModal] = useState(false);
    const [canvasTitle, setCanvasTitle] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingColor, setDrawingColor] = useState('#1E6DB7');
    
    // Zoom / Fullscreen Modal state
    const [showZoomModal, setShowZoomModal] = useState(false);
    const [zoomedSketch, setZoomedSketch] = useState(null);

    // Canvas Refs
    const canvasRef = useRef(null);
    const contextRef = useRef(null);

    // ── CANVAS DRAWING LOGIC ──
    useEffect(() => {
        if (showCanvasModal && canvasRef.current) {
            const canvas = canvasRef.current;
            
            // Set canvas display size
            canvas.width = 600 * 2; // For Retina screens
            canvas.height = 400 * 2;
            canvas.style.width = '600px';
            canvas.style.height = '400px';
            
            const context = canvas.getContext('2d');
            context.scale(2, 2);
            context.lineCap = 'round';
            context.lineWidth = 3;
            context.strokeStyle = drawingColor;
            contextRef.current = context;

            // Draw a white background grid initially (paper logic: always white grid background)
            drawGrid(context, 600, 400);
        }
    }, [showCanvasModal]);

    // Update color on ref when state updates
    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = drawingColor;
        }
    }, [drawingColor]);

    const drawGrid = (ctx, w, h) => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 20; x < w; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 20; y < h; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        
        // Re-set default path styles
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 3;
    };

    // Mouse events
    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        contextRef.current.beginPath();
        contextRef.current.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    };

    const stopDrawing = () => {
        contextRef.current.closePath();
        setIsDrawing(false);
    };

    const getCoordinates = (nativeEvent) => {
        // Handle touch coordinates
        if (nativeEvent.touches && nativeEvent.touches.length > 0) {
            const rect = canvasRef.current.getBoundingClientRect();
            return {
                offsetX: nativeEvent.touches[0].clientX - rect.left,
                offsetY: nativeEvent.touches[0].clientY - rect.top
            };
        }
        // Handle mouse coordinates
        return {
            offsetX: nativeEvent.offsetX,
            offsetY: nativeEvent.offsetY
        };
    };

    const clearCanvas = () => {
        if (canvasRef.current && contextRef.current) {
            drawGrid(contextRef.current, 600, 400);
        }
    };

    const saveCanvas = () => {
        if (!canvasTitle.trim()) {
            alert('Bitte gib einen Titel für die Skizze ein.');
            return;
        }
        const dataUrl = canvasRef.current.toDataURL();
        const newSketch = {
            id: `sketch_${Date.now()}`,
            title: canvasTitle.trim(),
            src: dataUrl
        };
        setSketches(prev => [...prev, newSketch]);
        setShowCanvasModal(false);
        setCanvasTitle('');
    };

    // ── HANDWERKER ASSIGNMENT UTILS ──
    const toggleHandwerker = (name) => {
        if (assignedHandwerker.includes(name)) {
            setAssignedHandwerker(prev => prev.filter(h => h !== name));
        } else {
            setAssignedHandwerker(prev => [...prev, name]);
        }
    };

    // ── HANDLERS FOR MOCK BUTTONS ──
    const handleOutlookClick = () => {
        alert("Outlook-Funktion ist im Mockup noch nicht integriert.\n\nIn der finalen Version wird hierüber der Arbeitsauftrag BA-2024-015 direkt als formatierte E-Mail an die zugewiesenen Handwerker übergeben.");
    };

    const handleNewOrderClick = () => {
        alert("Ein neuer Arbeitsauftrag kann in diesem isolierten Mockup nicht erstellt werden.");
    };

    const handleAddPhotoClick = () => {
        alert("Upload im Mockup nicht integriert.\n\nIn der produktiven Version öffnet dieser Button die Kamera des iPads oder die Fotogalerie zum Hochladen von Schadenbildern.");
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
            
            {/* ── 1. HEADER (Styled exactly like QTool Modulboxen/Cards) ── */}
            <header className="card" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '1rem 1.5rem', 
                marginBottom: '1.5rem',
                border: '1.5px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{projectTitle}</h1>
                    <span 
                        className="status-badge bg-green-100"
                        style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: 700, 
                            padding: '0.3rem 0.8rem', 
                            borderRadius: '20px'
                        }}
                    >
                        {status}
                    </span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        onClick={handleOutlookClick}
                        className="btn btn-outline"
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            padding: '0.6rem 1.2rem', 
                            fontSize: '0.9rem', 
                            fontWeight: 700, 
                            cursor: 'pointer'
                        }}
                    >
                        <Mail size={16} /> Outlook
                    </button>
                    <button 
                        onClick={handleNewOrderClick}
                        className="btn btn-primary"
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            padding: '0.6rem 1.2rem', 
                            fontSize: '0.9rem', 
                            fontWeight: 700, 
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={16} /> Neuer Auftrag
                    </button>
                </div>
            </header>

            {/* ── 2. TABS (Styled matching standard tabs) ── */}
            <nav style={{ 
                display: 'flex', 
                gap: '0.25rem', 
                borderBottom: '2px solid var(--border)', 
                marginBottom: '1.5rem',
                paddingBottom: '0.1rem'
            }}>
                {['Übersicht', 'Arbeitsauftrag', 'Fotos', 'Skizzen', 'Handwerker', 'Fortschritt'].map(tab => {
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                padding: '0.75rem 1.25rem',
                                fontSize: '0.95rem',
                                fontWeight: isActive ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                                marginBottom: '-3px'
                            }}
                        >
                            {tab}
                        </button>
                    );
                })}
            </nav>

            {/* ── 3. MAIN WORKSPACE (TWO COLUMNS) ── */}
            <main style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.1fr 0.9fr', 
                gap: '1.5rem',
                alignItems: 'start'
            }}>
                
                {/* ── LEFT COLUMN ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* ARBEITSAUFTRAG-KARTE */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <h2 className="section-header" style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Arbeitsauftrag
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Row 1: Auftragsnummer & Titel */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Auftragsnummer</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={orderNumber} 
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box' }}
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
                                    />
                                </div>
                            </div>

                            {/* Row 2: Beschreibung */}
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

                            {/* Row 3: Priorität & Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Priorität</label>
                                    <select 
                                        className="form-input"
                                        value={priority} 
                                        onChange={(e) => setPriority(e.target.value)}
                                        style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    >
                                        <option value="Niedrig" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Niedrig</option>
                                        <option value="Mittel" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Mittel</option>
                                        <option value="Hoch" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Hoch</option>
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
                                        <option value="Schadenaufnahme" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Schadenaufnahme</option>
                                        <option value="Leckortung" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Leckortung</option>
                                        <option value="Trocknung" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Trocknung</option>
                                        <option value="In Arbeit" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>In Arbeit</option>
                                        <option value="Abgeschlossen" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Abgeschlossen</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 4: Start & Fertigstellung */}
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

                            {/* Row 5: Geplanter Zeitaufwand */}
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
                                        <option value="Stunden" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Stunden</option>
                                        <option value="Arbeitstage" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>Arbeitstage</option>
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

                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Handwerker</label>
                            
                            {/* Customized Multi-Select Input Field matching standard input styling */}
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
                                            e.stopPropagation(); // Avoid opening dropdown
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

                            {/* Dropdown Menu */}
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

                {/* ── RIGHT COLUMN ── */}
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
                                    
                                    {/* Delete photo locally */}
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

                            {/* "Weitere hinzufügen" card button */}
                            <button
                                onClick={handleAddPhotoClick}
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
                                <Plus size={20} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Weitere hinzufügen</span>
                            </button>
                        </div>
                    </section>

                    {/* SKIZZEN-KARTE */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                Skizzen
                            </h2>
                            
                            <button 
                                onClick={() => setShowCanvasModal(true)}
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

                        {/* Sketches Grid */}
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
                                    {/* Preview Sketch Content */}
                                    <div style={{ 
                                        height: '110px', 
                                        backgroundColor: '#FFFFFF', // Sketches are sheets of paper, keeping light bg
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

                                    {/* Local delete sketch button */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation(); // Avoid zooming
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
                            Klicke auf eine Skizze, um sie zu öffnen und zu betrachten.
                        </div>
                    </section>
                </div>
            </main>

            {/* ── 4. CANVAS DRAWING MODAL (LOCAL SKETCH FUNCTION) ── */}
            {showCanvasModal && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.85)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div className="card" style={{ 
                        backgroundColor: 'var(--surface)', 
                        width: '100%', 
                        maxWidth: '640px', 
                        padding: '1.5rem', 
                        border: '1.5px solid var(--border)',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Neue Skizze zeichnen</h3>
                            <button 
                                onClick={() => {
                                    setShowCanvasModal(false);
                                    setCanvasTitle('');
                                }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Title Input */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Titel der Skizze *</label>
                            <input 
                                type="text"
                                className="form-input"
                                placeholder="z.B. Waschtisch Detail"
                                value={canvasTitle}
                                onChange={(e) => setCanvasTitle(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Toolbar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-surface-alt)', borderRadius: '4px', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stiftfarbe:</span>
                                {['#1E6DB7', '#000000', '#EF4444', '#10B981'].map(col => (
                                    <button 
                                        key={col}
                                        onClick={() => setDrawingColor(col)}
                                        style={{ 
                                            width: '24px', 
                                            height: '24px', 
                                            borderRadius: '50%', 
                                            backgroundColor: col, 
                                            border: drawingColor === col ? '2px solid #FFFFFF' : 'none',
                                            boxShadow: drawingColor === col ? '0 0 0 2px var(--primary)' : 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                ))}
                            </div>

                            <button 
                                onClick={clearCanvas}
                                className="btn"
                                style={{ 
                                    marginLeft: 'auto',
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.4rem', 
                                    backgroundColor: 'transparent', 
                                    color: 'var(--danger)', 
                                    border: '1.5px solid var(--border)', 
                                    padding: '0.4rem 0.8rem', 
                                    fontSize: '0.8rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer'
                                }}
                            >
                                <RotateCcw size={14} /> Löschen
                            </button>
                        </div>

                        {/* Canvas Wrapper */}
                        <div style={{ 
                            border: '1.5px solid var(--border)', 
                            borderRadius: '6px', 
                            overflow: 'hidden', 
                            backgroundColor: '#FFFFFF',
                            touchAction: 'none',
                            display: 'flex',
                            justifyContent: 'center'
                        }}>
                            <canvas 
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                style={{ display: 'block', cursor: 'crosshair', backgroundColor: '#FFFFFF' }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button 
                                onClick={() => {
                                    setShowCanvasModal(false);
                                    setCanvasTitle('');
                                }}
                                className="btn btn-outline"
                                style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                            >
                                Schliessen
                            </button>
                            <button 
                                onClick={saveCanvas}
                                className="btn btn-primary"
                                style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.6rem 1.2rem', 
                                    fontWeight: 700 
                                }}
                            >
                                <Save size={16} /> Speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 5. ZOOM / FULLSCREEN MODAL ── */}
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
                        {/* Modal Header */}
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

                        {/* Zoomed Image */}
                        <div style={{ 
                            backgroundColor: '#FFFFFF', // Sketches are sheets of paper, keeping light bg
                            borderRadius: '6px', 
                            border: '1.5px solid var(--border)', 
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '350px',
                            maxHeight: '500px',
                            overflow: 'hidden'
                        }}>
                            <img 
                                src={zoomedSketch.src} 
                                alt={zoomedSketch.title} 
                                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain' }}
                            />
                        </div>

                        {/* Modal Footer Actions */}
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
        </div>
    );
}
