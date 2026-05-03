import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Eraser, Pen, Undo, Trash2, FileText, Loader, Check, Hand, ChevronUp, ChevronDown, Plus, Edit3, RotateCcw, PenOff, Camera, Image, Move, LayoutGrid, Delete, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CameraCaptureModal from './CameraCaptureModal';
import { ROOM_OPTIONS } from './DamageForm/DamageForm.constants';

// Default starting positions for up to 4 photos (in %)
const DEFAULT_POSITIONS = [
    { x: 2, y: 2 }, { x: 52, y: 2 },
    { x: 2, y: 52 }, { x: 52, y: 52 },
];

/* GoodNotes-style photo overlay:
   - Tap photo â†’ selected (shows handles, draggable/resizable)
   - Tap canvas empty area â†’ deselects, pen works everywhere
   - No global mode toggle needed */
const DraggablePhoto = ({ photo, index, selected, onSelect, onDeselect, onDelete, onUpdate, activeTool, onDrawStart, onDraw, onDrawEnd, stylusOnlyMode }) => {
    // Photo-interne Logik: activeTool entscheidet Draw vs Drag
    const isDrawMode = activeTool === 'pen' || activeTool === 'eraser';
    const [pos, setPos] = useState(photo.pos || DEFAULT_POSITIONS[index] || { x: 5, y: 5 });
    const [size, setSize] = useState(photo.size || { w: 44, h: 44 }); // %
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragRef = useRef(null);
    const didMove = useRef(false);

    // GoodNotes-Style: direkte Funktion ohne useCallback
    // Kein stale-closure-Problem, immer frische pos/size/onUpdate Werte
    const handlePointerDown = (e) => {
        didMove.current = false;
        setIsDragging(true);
        const startX = e.clientX, startY = e.clientY;
        const startPos = { ...pos };
        const parent = dragRef.current?.parentElement;
        if (!parent) { setIsDragging(false); return; }
        const pw = parent.offsetWidth, ph = parent.offsetHeight;

        const onMove = (me) => {
            const dx = ((me.clientX - startX) / pw) * 100;
            const dy = ((me.clientY - startY) / ph) * 100;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) didMove.current = true;
            const np = {
                x: Math.max(0, Math.min(100 - size.w, startPos.x + dx)),
                y: Math.max(0, Math.min(100 - size.h, startPos.y + dy))
            };
            setPos(np);
            onUpdate(photo.id, { pos: np, size });
        };
        const onUp = () => {
            setIsDragging(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const startResize = useCallback((e) => {
        e.preventDefault(); e.stopPropagation();
        setIsResizing(true);
        const startX = e.clientX, startY = e.clientY;
        const startSize = { ...size };
        const parent = dragRef.current?.parentElement;
        if (!parent) return;
        const pw = parent.offsetWidth, ph = parent.offsetHeight;
        const onMove = (me) => {
            const ns = {
                w: Math.max(8, Math.min(98 - pos.x, startSize.w + ((me.clientX - startX) / pw) * 100)),
                h: Math.max(8, Math.min(98 - pos.y, startSize.h + ((me.clientY - startY) / ph) * 100))
            };
            setSize(ns);
            onUpdate(photo.id, { pos, size: ns });
        };
        const onUp = () => { setIsResizing(false); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [pos, size, photo.id, onUpdate]);

    const active = isDragging || isResizing;

    return (
        <div ref={dragRef}
            style={{
                position: 'absolute',
                left: `${pos.x}%`, top: `${pos.y}%`,
                width: `${size.w}%`, height: `${size.h}%`,
                // Foto immer UEBER canvasRef (zIndex:10) - DraggablePhoto ist Event-Hub
                // Draw oder Drag wird intern entschieden, nie durch pointerEvents blockiert
                zIndex: selected ? 50 : 40,
                pointerEvents: 'auto',
                touchAction: 'none',
                cursor: isDrawMode ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : (selected ? (isDragging ? 'grabbing' : 'move') : 'grab'),
                outline: selected ? `2px solid ${active ? '#3B82F6' : 'rgba(59,130,246,0.7)'}` : 'none',
                boxShadow: selected
                    ? (active ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.4)')
                    : '0 3px 12px rgba(0,0,0,0.25)', // immer sichtbarer Schatten = Schwebegefuehl
                borderRadius: 3, overflow: 'visible',
                transition: active ? 'none' : 'box-shadow 0.15s, outline 0.1s',
            }}
            onPointerDown={(e) => {
                // GoodNotes-Modell: pointerType entscheidet - kein Modus-Toggle noetig
                // Apple Pencil (pointerType='pen') → immer zeichnen, durch Foto hindurch
                // Finger (pointerType='touch') oder Maus → immer Foto verschieben
                if (e.pointerType === 'pen') {
                    e.preventDefault();
                    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
                    onDrawStart(e);
                    return;
                }
                // Finger / Maus: Foto-Interaktion
                if (e.target.closest('[data-resize]') || e.target.closest('[data-action]')) return;
                e.preventDefault(); e.stopPropagation();
                onSelect();
                handlePointerDown(e);
            }}
            onPointerMove={(e) => { if (e.pointerType === 'pen') { onDraw(e); } }}
            onPointerUp={(e) => { if (e.pointerType === 'pen') { onDrawEnd(e); } }}
            onPointerLeave={(e) => { if (e.pointerType === 'pen') { onDrawEnd(e); } }}
            onPointerCancel={(e) => { if (e.pointerType === 'pen') { onDrawEnd(e); } }}>
            <img src={photo.src} data-id={photo.id} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 2, pointerEvents: 'none', userSelect: 'none' }} />

            {selected && (<>
                {/* Fertig (gruener Haken) -- schliesst Handles, Foto bleibt als bewegliches Overlay */}
                <button data-action="true" onClick={(e) => { e.stopPropagation(); onDeselect(); }}
                    style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#10B981', border: '2px solid white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 25, color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', fontSize: 14, fontWeight: 'bold' }}
                    title="Fertig">&#x2713;</button>
                {/* Loeschen -- oben-rechts */}
                <button data-action="true" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    style={{ position: 'absolute', top: -12, right: -12, background: '#EF4444', border: '2px solid white', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 25, color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                    <X size={12} />
                </button>
                {/* Resize -- bottom-right */}
                <div data-resize="true" onPointerDown={startResize}
                    style={{ position: 'absolute', bottom: -12, right: -12, width: 26, height: 26, background: '#3B82F6', cursor: 'se-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25, borderRadius: '50%', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', touchAction: 'none' }}>
                    <Move size={12} color="white" />
                </div>
            </>)}




            {/* Auswahl-Tab -- nur im Foto-Modus sichtbar */}
            {!selected && (
                <div
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); }}
                    style={{ position: 'absolute', top: -1, left: -1, width: 28, height: 28, background: 'rgba(59,130,246,0.75)', borderRadius: '3px 0 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 25, pointerEvents: 'auto', touchAction: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                    title="Foto auswählen">
                    <Move size={13} color="white" />
                </div>
            )}
        </div>
    );
};

const MeasurementModal = ({ isTechnicianMode, isOpen, onClose, onSave, onStartNew, onBackToDashboard, rooms, allRooms = [], projectTitle, address, apartments = [], initialData, readOnly, measurementHistory }) => {

    const dynamicRoomOptions = Array.from(new Set([
        ...(ROOM_OPTIONS || []),
        ...(allRooms || []).map(r => r?.name).filter(n => n && n !== 'Ganze Wohnung' && n !== 'Sonstiges')
    ]));

    const isNewRoom = rooms && rooms.length > 0 && String(rooms[0].id).startsWith('temp_');

    const canvasRef = useRef(null);       // Layer 2: Zeichnungen (Radierer wirkt NUR hier)
    const gridCanvasRef = useRef(null);   // Layer 1: Grid + weiss (permanent, unzerstoerbar)
    const photoCanvasRef = useRef(null);  // Layer 1.5: Fotos (radierer-geschuetzt, permanent)
    const hiddenCanvasRef = useRef(null); // Persistenz / Save
    const containerRef = useRef(null);
    const isInitializedRef = useRef(null); // Track initialization per session
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    // SINGLE SOURCE OF TRUTH: 'pen' | 'eraser' | 'photo' | 'pan'
    const [activeTool, setActiveTool] = useState('pen');
    // Derived - korrekte Logik:
    const isDrawMode = activeTool === 'pen' || activeTool === 'eraser';
    const isPhotoMode = activeTool === 'photo';
    const isScrollMode = activeTool === 'pan';
    const [measurements, setMeasurements] = useState([]);
    const [history, setHistory] = useState([]); // Array of ImageData
    const [historyStep, setHistoryStep] = useState(-1);
    const [showHistoryOverlay, setShowHistoryOverlay] = useState(false);
    const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
    const [isSketchLocked, setIsSketchLocked] = useState(true);
    const [isSketchFullscreen, setIsSketchFullscreen] = useState(false);
    const [zoomScale, setZoomScale] = useState(1);
    const [selectedPhotoId, setSelectedPhotoId] = useState(null); // GoodNotes: welches Foto ist selektiert
    const [previewSnapshot, setPreviewSnapshot] = useState(null);
    const [globalSettings, setGlobalSettings] = useState({
        date: new Date().toISOString().split('T')[0],
        temp: '',
        humidity: '',
        device: ''
    });
    const [isCustomRoom, setIsCustomRoom] = useState(false);
    const [isCustomApartment, setIsCustomApartment] = useState(false);
    const [availableDevices, setAvailableDevices] = useState([]);
    const [activeNumpadField, setActiveNumpadField] = useState(null);
    const [numpadPos, setNumpadPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 350 : 100, y: typeof window !== 'undefined' ? 80 : 100 });
    const numpadDragRef = useRef(false);
    const numpadStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const savedDevices = localStorage.getItem('qtool_measurement_devices');
        if (savedDevices) {
            try {
                const parsed = JSON.parse(savedDevices);
                // Safer way to flatten for older browsers
                let flattened = [];
                Object.keys(parsed).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        parsed[key].forEach(d => {
                            if (d && d.name) flattened.push(d.name);
                        });
                    }
                });
                setAvailableDevices(Array.from(new Set(flattened))); // unique names
            } catch (e) {
                console.error("Error loading devices for modal", e);
            }
        }
    }, [isOpen]);
    const [saveAsPdf, setSaveAsPdf] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [stylusOnlyMode, setStylusOnlyMode] = useState(true); // Palm Rejection standardmÃ¤ÃŸig AN
    const [showCamera, setShowCamera] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [galleryPhotos, setGalleryPhotos] = useState([]); // Messprotokoll-Fotos (2-Spalten-Grid)

    const handleNumpadPress = (key) => {
        if (!activeNumpadField) return;
        
        let newVal = activeNumpadField.value || '';
        if (key === 'DEL') {
            newVal = newVal.slice(0, -1);
        } else if (key === ',') {
            if (!newVal.includes(',')) newVal += ',';
        } else {
            newVal += key;
        }
        
        setActiveNumpadField({ ...activeNumpadField, value: newVal });

        if (activeNumpadField.idx !== undefined) {
            updateMeasurement(activeNumpadField.idx, activeNumpadField.field, newVal);
        } else {
            setGlobalSettings(prev => ({ ...prev, [activeNumpadField.field]: newVal }));
        }
    };

    const isSetupPhaseRef = useRef(true);
    useEffect(() => {
        if (!isOpen) return;
        isSetupPhaseRef.current = true;
        const t = setTimeout(() => { isSetupPhaseRef.current = false; setHasUnsavedChanges(false); }, 500);
        return () => clearTimeout(t);
    }, [isOpen, rooms, initialData]);

    useEffect(() => {
        if (!isOpen || isSuccess || isSetupPhaseRef.current) return;
        setHasUnsavedChanges(true);
    }, [globalSettings, measurements, galleryPhotos]);

    // Always lock the sketch by default when the modal opens
    useEffect(() => {
        if (isOpen) {
            setIsSketchLocked(true);
            setStylusOnlyMode(true); // Palm Rejection beim Reset aktiv lassen
        }
    }, [isOpen]);

    // Calculate History View Data
    // Calculate History View Data - PIVOT
    const { historyColumns, historyRows } = React.useMemo(() => {
        if (!measurementHistory || measurementHistory.length === 0) return { historyColumns: [], historyRows: [] };

        // 1. Get all unique MP names
        const allPointNames = new Set(); // Only show points that were actually used

        const normalizeName = (name) => name ? name.replace(/^Messpunkt\s+(\d+)$/i, 'MP $1') : name;

        // Add current measurements (the "capture" template) to ensure they are visible
        if (measurements && measurements.length > 0) {
            measurements.forEach((m, idx) => {
                const name = m.pointName || `MP ${idx + 1}`;
                allPointNames.add(normalizeName(name));
            });
        }

        measurementHistory.forEach(entry => {
            if (entry && Array.isArray(entry.measurements)) {
                entry.measurements.forEach((m, idx) => {
                    if (m) {
                        const name = m.pointName || `MP ${idx + 1}`;
                        allPointNames.add(normalizeName(name));
                    }
                });
            }
        });

        // Sort columns naturally (MP 1, MP 2, MP 10)
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        const sortedColumns = Array.from(allPointNames).sort(collator.compare);

        // 2. Sort history by Date Descending (Newest first)
        const sortedHistory = [...measurementHistory].sort((a, b) =>
            new Date(b.date || 0) - new Date(a.date || 0)
        );

        // 3. Build Rows
        const rows = sortedHistory.map((entry, idx) => {
            if (!entry) return null;
            const entryDate = entry.globalSettings?.date || entry.date;

            // Find "previous" (older) entry for comparison
            // Since sorted Descending, previous is at idx + 1
            const prevEntry = sortedHistory[idx + 1];

            const rowData = {
                id: entry.id || `hist_${idx}`,
                date: entryDate,
                points: {},
                protocolUrl: entry.protocolUrl
            };

            const entryMeasurements = Array.isArray(entry.measurements) ? entry.measurements : [];
            const prevMeasurements = (prevEntry && Array.isArray(prevEntry.measurements)) ? prevEntry.measurements : [];

            sortedColumns.forEach(mpName => {
                const currM = entryMeasurements.find((m, idx) => {
                    if (!m) return false;
                    const name = m.pointName || `MP ${idx + 1}`;
                    return normalizeName(name) === mpName;
                });
                if (!currM) return; // No data for this MP in this entry

                const cell = {
                    w_value: currM.w_value,
                    b_value: currM.b_value,
                    w_color: 'inherit',
                    b_color: 'inherit'
                };

                // Compare with previous
                if (prevEntry) {
                    const prevM = prevMeasurements.find((m, idx) => {
                        if (!m) return false;
                        const name = m.pointName || `MP ${idx + 1}`;
                        return normalizeName(name) === mpName;
                    });
                    if (prevM) {
                        const parse = (v) => parseFloat(String(v).replace(',', '.'));

                        const wc = parse(currM.w_value);
                        const wp = parse(prevM.w_value);
                        if (!isNaN(wc) && !isNaN(wp)) {
                            if (wc < wp) cell.w_color = '#10B981'; // Good
                            if (wc > wp) cell.w_color = '#EF4444'; // Bad
                        }

                        const bc = parse(currM.b_value);
                        const bp = parse(prevM.b_value);
                        if (!isNaN(bc) && !isNaN(bp)) {
                            if (bc < bp) cell.b_color = '#10B981';
                            if (bc > bp) cell.b_color = '#EF4444';
                        }
                    }
                }
                rowData.points[mpName] = cell;
            });
            return rowData;
        }).filter(Boolean);

        return { historyColumns: sortedColumns, historyRows: rows };

    }, [measurementHistory, measurements]);



    /**
     * stripWhiteBackground:
     * Wandelt alte canvasImage-Daten (weisser Hintergrund + Grid + Striche) in
     * reine Annotationsdaten um (nur Striche, transparenter Hintergrund).
     *
     * Regel: Pixel mit R>230 AND G>230 AND B>230 = Hintergrund → alpha=0
     * Farbige Striche (schwarz, rot, blau) haben mindestens einen Kanal < 200
     * und bleiben vollständig erhalten.
     */
    const stripWhiteBackground = (img, w, h) => {
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            // Weiss und Hellgrau (Grid-Linien #e0e0e0) → transparent
            // Stift-Farben (Schwarz, Rot #ef4444, Blau #3b82f6) haben immer mind. einen Kanal < 150.
            if (r > 150 && g > 150 && b > 150) {
                d[i + 3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return tmp;
    };

    // Initialize measurements based on rooms or initialData
    useEffect(() => {
        if (!isOpen) {
            isInitializedRef.current = null;
            // Clear history on close to prevent carry-over if key doesn't change
            setHistory([]);
            setHistoryStep(-1);
            return;
        }

        if (isSuccess) return;

        const currentRoomId = rooms && rooms.length > 0 ? rooms[0].id : null;
        if (!currentRoomId) return;

        if (isInitializedRef.current === currentRoomId) return;
        isInitializedRef.current = currentRoomId;

        let initTimer = null;
        const roomData = initialData ? initialData[currentRoomId] : null;

        const performInit = () => {
            const canvas = hiddenCanvasRef.current; // Always use hidden canvas for init
            if (!canvas) {
                initTimer = setTimeout(performInit, 50);
                return;
            }

            if (roomData) {
                const migrateNames = (ms) => (ms || []).map(m => ({
                    ...m,
                    pointName: m.pointName?.replace(/^Messpunkt\s+(\d+)$/i, 'MP $1') ?? m.pointName
                }));
                setMeasurements(migrateNames(roomData.measurements));
                const gs = roomData.globalSettings || {
                    date: new Date().toISOString().split('T')[0],
                    temp: '',
                    humidity: '',
                    device: '',
                    apartment: rooms && rooms.length > 0 ? (rooms[0].apartment || '') : '',
                    room: rooms && rooms.length > 0 ? (rooms[0].name || '') : ''
                };
                setGlobalSettings(gs);
                const rm = gs.room || '';
                setIsCustomRoom(rm && rm !== 'Ganze Wohnung' && !dynamicRoomOptions.includes(rm));
                if (roomData.galleryPhotos) setGalleryPhotos(roomData.galleryPhotos);

                if (roomData.canvasImage) {
                    setPreviewSnapshot(roomData.canvasImage);
                    const img = new window.Image();
                    img.onload = () => {
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        // stripWhiteBackground: migriert alte Daten (weiss+Grid+Striche)
                        // zu reinen Annotationsdaten (nur Striche, transparent).
                        // Neue Saves sind bereits transparent und bleiben unverändert.
                        const stripped = stripWhiteBackground(img, canvas.width, canvas.height);
                        ctx.drawImage(stripped, 0, 0);
                        saveParamsToHistory(canvas);
                    };
                    img.src = roomData.canvasImage;
                } else {
                    initCanvas();
                }
            } else {
                // Default measurements
                const initial = [
                    { id: `p${Date.now()}`, pointName: 'MP 1', w_value: '', b_value: '', notes: '' },
                    { id: `p${Date.now() + 1}`, pointName: 'MP 2', w_value: '', b_value: '', notes: '' },
                    { id: `p${Date.now() + 2}`, pointName: 'MP 3', w_value: '', b_value: '', notes: '' },
                    { id: `p${Date.now() + 3}`, pointName: 'MP 4', w_value: '', b_value: '', notes: '' }
                ];
                setMeasurements(initial);
                const gs = {
                    date: new Date().toISOString().split('T')[0],
                    temp: '',
                    humidity: '',
                    device: '',
                    apartment: rooms && rooms.length > 0 ? (rooms[0].apartment || '') : '',
                    room: rooms && rooms.length > 0 ? (rooms[0].name || '') : ''
                };
                setGlobalSettings(gs);
                const rm = gs.room || '';
                setIsCustomRoom(rm && rm !== 'Ganze Wohnung' && !dynamicRoomOptions.includes(rm));
                initCanvas();
            }
        };

        // Start initialization
        performInit();
        setTimeout(() => setHasUnsavedChanges(false), 100);

        return () => {
            if (initTimer) clearTimeout(initTimer);
        };
    }, [isOpen, rooms, initialData, isSuccess]);


    const drawGridLayer = (gc) => {
        if (!gc) return;
        gc.width = 960; gc.height = 600;
        const gCtx = gc.getContext('2d');
        gCtx.fillStyle = '#ffffff';
        gCtx.fillRect(0, 0, gc.width, gc.height);
        gCtx.strokeStyle = '#e0e0e0';
        gCtx.lineWidth = 1;
        for (let x = 0; x <= gc.width; x += 40) { gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, gc.height); gCtx.stroke(); }
        for (let y = 0; y <= gc.height; y += 40) { gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(gc.width, y); gCtx.stroke(); }
    };

    const initCanvas = () => {
        // Layer 2 startet TRANSPARENT -- weiss kommt nur von Layer 1 (gridCanvasRef)
        const canvas = hiddenCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveParamsToHistory(canvas);
    };


    const saveParamsToHistory = (canvas) => {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev.slice(0, historyStep + 1), imageData]);
        setHistoryStep(prev => prev + 1);
    };

    // Fotos werden jetzt als draggable Overlays verwaltet (nicht mehr auf Canvas gezeichnet)
    // useEffect fÃ¼r automatisches Canvas-Zeichnen ist deaktiviert


    const handleUndo = () => {
        if (historyStep > 0) {
            const newStep = historyStep - 1;
            const imageData = history[newStep];
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);
            setHistoryStep(newStep);
        }
    };



    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    // --- Drawing Engine (simple, no RAF, no caching â€” bulletproof for iPad/WebKit) ---
    const isDrawingRef = useRef(false);
    const activeToolRef = useRef('pen');
    const colorRef = useRef(color);
    const lineWidthRef = useRef(lineWidth);
    // colorRef and lineWidthRef sync via useEffect is fine (no immediate draw after color change)
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
    // Zentrale Tool-Aktivierung: setzt activeTool + activeToolRef atomar
    const activateTool = (tool) => {
        console.log('[QTOOL] activateTool ->', tool);
        activeToolRef.current = tool === 'photo' || tool === 'pan' ? 'pen' : tool;
        setActiveTool(tool);
        setSelectedPhotoId(null);
        // globalCompositeOperation explizit setzen
        const ctx = canvasRef.current?.getContext('2d');
        // Alle Non-Eraser Tools: source-over; Eraser: destination-out
        if (ctx) ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    };
    // Compat-Alias
    const setTool = activateTool;

    const getCtx = () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (activeToolRef.current === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = 30;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = colorRef.current;
            ctx.lineWidth = lineWidthRef.current;
        }
        return ctx;
    };

    const startDrawing = (e) => {
        if (!isOpen || isSketchLocked) return;
        // pointerType-Regel: Finger/touch -> immer Foto-Overlay, nie zeichnen
        if (e.pointerType === 'touch') return;
        if (stylusOnlyMode && e.pointerType !== 'pen') return;
        try { (e.currentTarget || e.target).setPointerCapture(e.pointerId); } catch (_) { }
        const coords = getCoordinates(e);
        const ctx = getCtx();
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        isDrawingRef.current = true;
        setIsDrawing(true);
        setHasUnsavedChanges(true);
    };

    const draw = (e) => {
        if (!isDrawingRef.current) return;
        if (stylusOnlyMode && e.pointerType !== 'pen') return;
        const coords = getCoordinates(e);
        const ctx = getCtx();
        if (!ctx) return;
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    };

    const stopDrawing = (e) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        setIsDrawing(false);
        try { e?.target?.releasePointerCapture(e.pointerId); } catch (_) { }
        saveParamsToHistory(canvasRef.current);
    };

    // Fotos gehen IMMER als Overlays in galleryPhotos (nie direkt auf Canvas gemalt)
    // Damit kann der Radierer sie NIEMALS beruhren
    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setGalleryPhotos(prev => [...prev, { id: Date.now() + Math.random(), src: ev.target.result }]);
                activateTool('photo');
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveParamsToHistory(canvas);
    };

    const handleCameraCapture = (file) => {
        setShowCamera(false);
        const reader = new FileReader();
        reader.onload = (event) => {
            setGalleryPhotos(prev => [...prev, { id: Date.now() + Math.random(), src: event.target.result }]);
            activateTool('photo');
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!containerRef.current || isSaving) return;

        setIsSaving(true);
        try {
            // Capture the entire modal content (sketch + table)
            const canvas = await html2canvas(containerRef.current, {
                scale: 2, // Higher resolution
                backgroundColor: '#ffffff'
            });

            // Capture canvas state as DataURL for restoration
            const toggleCanvas = hiddenCanvasRef.current;
            const canvasDataUrl = previewSnapshot || (() => {
                if (!toggleCanvas) return null;
                const comp = document.createElement('canvas');
                comp.width = toggleCanvas.width; comp.height = toggleCanvas.height;
                const cCtx = comp.getContext('2d');
                cCtx.fillStyle = '#ffffff'; cCtx.fillRect(0, 0, comp.width, comp.height);
                cCtx.strokeStyle = '#e0e0e0'; cCtx.lineWidth = 1;
                for (let x = 0; x <= comp.width; x += 40) { cCtx.beginPath(); cCtx.moveTo(x, 0); cCtx.lineTo(x, comp.height); cCtx.stroke(); }
                for (let y = 0; y <= comp.height; y += 40) { cCtx.beginPath(); cCtx.moveTo(0, y); cCtx.lineTo(comp.width, y); cCtx.stroke(); }
                cCtx.drawImage(toggleCanvas, 0, 0);
                return comp.toDataURL();
            })();

            if (saveAsPdf) {
                // Generate PDF
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgData = canvas.toDataURL('image/png');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

                // Create PDF Blob
                const pdfBlob = pdf.output('blob');
                const file = new File([pdfBlob], `Messprotokoll_${projectTitle || 'Neu'}_${rooms[0]?.name || ''}.pdf`, { type: 'application/pdf' });

                await onSave({
                    file,
                    measurements,
                    globalSettings,
                    canvasImage: canvasDataUrl,
                    galleryPhotos
                });
            } else {
                // Standard Image Save
                await new Promise((resolve) => {
                    canvas.toBlob(async (blob) => {
                        const file = new File([blob], `Messprotokoll_${projectTitle || 'Neu'}_${Date.now()}.png`, { type: 'image/png' });

                        await onSave({
                            file,
                            measurements,
                            globalSettings,
                            canvasImage: canvasDataUrl
                        });
                        resolve();
                    }, 'image/png');
                });
            }

            // Show success state briefly
            setIsSuccess(true);
            setHasUnsavedChanges(false);
            setTimeout(() => {
                setIsSuccess(false);
                setIsSaving(false);
                // Clear data fields after saving as requested
                setMeasurements(prev => prev.map(m => ({ ...m, w_value: '', b_value: '' })));
                if (globalSettings) {
                    setGlobalSettings(prev => ({ ...prev, temp: '', humidity: '' }));
                }
            }, 1500);

        } catch (err) {
            console.error("Error saving sketch:", err);
            // FALLBACK: If canvas capture fails (common on iPad Safari due to memory/taint), save the data anyway!
            try {
                await onSave({
                    file: null,
                    measurements,
                    globalSettings,
                    canvasImage: null,
                    galleryPhotos: galleryPhotos || []
                });
                setIsSuccess(true);
                setHasUnsavedChanges(false);
                setTimeout(() => {
                    setIsSuccess(false);
                    setIsSaving(false);
                    setMeasurements(prev => prev.map(m => ({ ...m, w_value: '', b_value: '' })));
                    if (globalSettings) {
                        setGlobalSettings(prev => ({ ...prev, temp: '', humidity: '' }));
                    }
                }, 1500);
            } catch (fallbackErr) {
                console.error("Fallback save also failed:", fallbackErr);
                alert("Fehler beim Speichern der Messung.");
                setIsSaving(false);
            }
        }
    };

    const updateMeasurement = (index, field, value) => {
        const newMeasurements = [...measurements];
        newMeasurements[index][field] = value;
        setMeasurements(newMeasurements);
    };

    const addMeasurement = () => {
        // Use Date.now() for unique IDs
        const newPoint = {
            id: `p${Date.now()}`,
            pointName: `MP ${measurements.length + 1}`,
            w_value: '',
            b_value: '',
            notes: ''
        };
        setMeasurements([...measurements, newPoint]);
    };

    const removeMeasurement = (index) => {
        const newMeasurements = measurements.filter((_, i) => i !== index);
        setMeasurements(newMeasurements);
    };

    if (!isOpen) return null;

    const S = { // shared micro-styles
        label: { display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem' },
        input: { width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.875rem', outline: 'none', minHeight: '44px', boxSizing: 'border-box', touchAction: 'manipulation' },
    };

    const handleClose = () => {
        if (hasUnsavedChanges && !isSuccess) {
            if (window.confirm('Du hast ungespeicherte Änderungen. Möchtest du wirklich schließen, ohne zu speichern?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    return createPortal(
        <div className={isTechnicianMode ? 'force-dark-mode' : ''} style={{ position: 'fixed', inset: 0, backgroundColor: isTechnicianMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
            <div ref={containerRef} style={{ backgroundColor: 'var(--background)', borderRadius: '14px', width: '98vw', maxWidth: '1240px', height: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text-main)', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.1)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>

                {/* ── HEADER ── */}
                <div style={{ flexShrink: 0, padding: '0.7rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)' }}>
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>Messprotokoll</div>
                        <div style={{ fontSize: '0.9rem', marginTop: '0.15rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {(() => {
                                const isId = (s) => s && (s.match(/-/g) || []).length >= 3 && !s.includes(' ');
                                const title = !isId(projectTitle) ? projectTitle : null;

                                const activeRoom = rooms && rooms.length > 0 ? rooms[0] : null;
                                const aptName = isNewRoom ? (globalSettings.apartment || '') : (activeRoom?.apartment || '');
                                const roomName = isNewRoom ? (globalSettings.room || 'Neuer Raum') : (activeRoom?.name || 'Ohne Namen');

                                return (
                                    <>
                                        {activeRoom && (
                                            <span style={{ color: '#60A5FA', fontWeight: 700 }}>
                                                {aptName ? `${aptName} — ` : ''}{roomName}
                                            </span>
                                        )}
                                        {activeRoom && (title || address) && <span style={{ color: 'var(--text-muted)' }}>|</span>}
                                        {title && <span style={{ color: 'var(--border)', fontWeight: 600 }}>{title}</span>}
                                        {address && <span style={{ color: '#94A3B8', fontWeight: 500 }}>{title ? '·' : ''} {address}</span>}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>


                        <button onClick={handleSave} disabled={isSaving} style={{ padding: '0.55rem 1.2rem', borderRadius: '8px', background: isSuccess ? '#10B981' : '#2563EB', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: '42px', boxShadow: isSuccess ? '0 0 0 3px rgba(16,185,129,0.25)' : '0 0 0 3px rgba(37,99,235,0.25)' }}>
                            {isSaving ? <Loader size={16} className="animate-spin" /> : isSuccess ? <Check size={16} /> : <Save size={16} />}
                            {isSaving ? 'Speichert…' : isSuccess ? 'Gespeichert!' : (readOnly ? 'Schliessen' : 'Speichern')}
                        </button>
                        <button onClick={async () => {
                            if (hasUnsavedChanges) {
                                await handleSave();
                            }
                            if (onBackToDashboard) onBackToDashboard();
                        }} style={{ padding: '0.55rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.1)', color: '#94A3B8', cursor: 'pointer', minHeight: '42px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <LayoutGrid size={16} /> <span className="hide-mobile">Kacheln</span>
                        </button>
                        <button onClick={handleClose} style={{ padding: '0.55rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.1)', color: '#94A3B8', cursor: 'pointer', minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Schließen"><X size={18} /></button>
                    </div>
                </div>

                {/* ── BODY: SPLIT VIEW ── */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                    {/* ─── LEFT: SKETCH ─── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)', minWidth: 0 }}>
                        {/* Hidden canvas always in DOM for init/save */}
                        <canvas ref={hiddenCanvasRef} width={960} height={600} style={{ display: 'none' }} />

                        {/* Preview Area */}
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {previewSnapshot ? (
                                <img src={previewSnapshot} alt="Skizze" style={{ maxWidth: `${zoomScale * 100}%`, maxHeight: `${zoomScale * 100}%`, objectFit: 'contain', display: 'block', transition: 'max-width 0.2s, max-height 0.2s', borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#64748B' }}>
                                    <div style={{ width: '75%', maxWidth: 380, height: 200, backgroundImage: 'linear-gradient(to right,rgba(0,0,0,0.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.05) 1px,transparent 1px)', backgroundSize: '40px 40px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Noch keine Skizze vorhanden</span>
                                </div>
                            )}

                            {/* --- HISTORY OVERLAY --- */}
                            {showHistoryOverlay && (
                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '2rem', overflow: 'hidden', backdropFilter: 'blur(8px)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
                                        <h3 style={{ color: '#60A5FA', margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <RotateCcw size={20} /> Bisherige Messverläufe
                                        </h3>
                                        <button onClick={() => setShowHistoryOverlay(false)} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <X size={18} /> Schliessen
                                        </button>
                                    </div>
                                    <div style={{ background: 'var(--text-main)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.1)', overflow: 'auto', flex: 1 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead style={{ position: 'sticky', top: 0, background: 'var(--text-main)', zIndex: 10, boxShadow: '0 1px 0 rgba(255,255,255,0.08)' }}>
                                                <tr>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94A3B8', whiteSpace: 'nowrap', width: '100px' }}>Messpunkt</th>
                                                    {[...historyRows].reverse().map(row => (
                                                        <th key={row.id} style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#94A3B8', whiteSpace: 'nowrap', minWidth: 80 }}>
                                                            {row.date ? new Date(row.date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyColumns.map(mpName => (
                                                    <tr key={mpName} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', height: '40px' }}>
                                                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-main)', whiteSpace: 'nowrap', fontWeight: 700 }}>
                                                            {mpName} <span style={{ fontSize: '0.8em', fontWeight: 'normal', color: '#94A3B8' }}>(W/B)</span>
                                                        </td>
                                                        {[...historyRows].reverse().map(row => {
                                                            const cell = row.points[mpName];
                                                            return (
                                                                <td key={row.id} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                    {cell ? (
                                                                        <span>
                                                                            <span style={{ color: cell.w_color, fontWeight: 700 }}>{cell.w_value || '-'}</span>
                                                                            <span style={{ color: '#475569', margin: '0 3px' }}>/</span>
                                                                            <span style={{ color: cell.b_color, fontWeight: 700 }}>{cell.b_value || '-'}</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom Bar: Zoom + Skizze bearbeiten */}
                        {!readOnly && (
                            <div style={{ flexShrink: 0, padding: '0.55rem 1rem', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <button onClick={() => setZoomScale(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--border)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 38, textAlign: 'center' }}>{Math.round(zoomScale * 100)}%</span>
                                    <button onClick={() => setZoomScale(z => Math.min(2, +(z + 0.1).toFixed(1)))} style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--border)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                </div>
                                <button onClick={() => { setTimeout(() => { drawGridLayer(gridCanvasRef.current); const fc = canvasRef.current, hc = hiddenCanvasRef.current; if (fc && hc) { fc.width = hc.width; fc.height = hc.height; const fCtx = fc.getContext('2d'); fCtx.clearRect(0, 0, fc.width, fc.height); fCtx.drawImage(stripWhiteBackground(hc, hc.width, hc.height), 0, 0); } }, 100); setIsSketchLocked(false); setIsSketchFullscreen(true); }} style={{ marginLeft: 'auto', padding: '0.5rem 1.1rem', borderRadius: 8, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)', color: '#60A5FA', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 36 }}>
                                    <Edit3 size={15} /> Skizze bearbeiten
                                </button>
                                <button onClick={async () => {
                                    if (!previewSnapshot) return alert('Keine Skizze vorhanden.');
                                    try {
                                        const { ExportService } = await import('../services/ExportService');
                                        const dummyData = { projectNumber: projectTitle, street: address, zip: '', city: '' };
                                        const rName = globalSettings?.room || initialData?.name || 'Unbekannt';
                                        await ExportService.generateSketchPdf(dummyData, { name: rName }, { src: previewSnapshot, label: 'Messprotokoll-Skizze' });
                                    } catch(err) {
                                        alert('Fehler beim PDF Export: ' + err.message);
                                    }
                                }} style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34D399', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 36, marginLeft: '0.5rem' }}>
                                    <Download size={15} /> PDF Export
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ─── RIGHT: SIDEBAR ─── */}
                    <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface)', position: 'relative' }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '40vh', display: 'flex', flexDirection: 'column', gap: '0.85rem', WebkitOverflowScrolling: 'touch' }}>
                            {!readOnly && (<>
                                {/* Messmittel */}
                                <div>
                                    <label style={S.label}>Messmittel</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="text" list="available-devices" value={globalSettings.device} onChange={e => setGlobalSettings({ ...globalSettings, device: e.target.value })} style={{ ...S.input, paddingRight: '2rem' }} placeholder="z.B. Gann Hydromette" autoComplete="off" />
                                        <ChevronDown size={14} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                                        <datalist id="available-devices">{availableDevices.map((d, i) => <option key={i} value={d} />)}</datalist>
                                    </div>
                                </div>

                                {/* Wohnung – Bereich (nur bei komplett neuem Raum) */}
                                {isNewRoom && (
                                    <div>
                                        <label style={S.label}>Wohnung / Bereich</label>
                                        <div style={{ position: 'relative', marginBottom: isCustomApartment ? '0.5rem' : '0' }}>
                                            <select 
                                                value={isCustomApartment ? 'Sonstiges' : (globalSettings.apartment || '')} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === 'Sonstiges') {
                                                        setIsCustomApartment(true);
                                                        setGlobalSettings({ ...globalSettings, apartment: '' });
                                                    } else {
                                                        setIsCustomApartment(false);
                                                        setGlobalSettings({ ...globalSettings, apartment: val });
                                                    }
                                                }} 
                                                style={{ ...S.input, paddingRight: '2rem', appearance: 'none', backgroundColor: 'transparent' }}
                                            >
                                                <option value="" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>Bitte wählen...</option>
                                                <option value="Sonstiges" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>Sonstiges / Eigene Eingabe</option>
                                                <option value="Allgemeiner Bereich" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>Allgemeiner Bereich</option>
                                                {(apartments || []).map((a, i) => <option key={i} value={a} style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>{a}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                                        </div>
                                        {isCustomApartment && (
                                            <input
                                                type="text"
                                                value={globalSettings.apartment || ''}
                                                onChange={e => setGlobalSettings({ ...globalSettings, apartment: e.target.value })}
                                                style={S.input}
                                                placeholder="z.B. Treppenhaus EG"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Raum (nur bei komplett neuem Raum) */}
                                {isNewRoom && (
                                    <div>
                                        <label style={S.label}>Raum</label>
                                        <div style={{ position: 'relative', marginBottom: isCustomRoom ? '0.5rem' : '0' }}>
                                            <select
                                                value={isCustomRoom ? 'Sonstiges' : (globalSettings.room || '')}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === 'Sonstiges') {
                                                        setIsCustomRoom(true);
                                                        setGlobalSettings({ ...globalSettings, room: '' });
                                                    } else {
                                                        setIsCustomRoom(false);
                                                        setGlobalSettings({ ...globalSettings, room: val });
                                                    }
                                                }}
                                                style={{ ...S.input, appearance: 'none', paddingRight: '2rem', backgroundColor: 'transparent' }}
                                            >
                                                <option value="" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>Raum wählen...</option>
                                                <option value="Sonstiges" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>Sonstiges / Eigener Name</option>
                                                <option value="Ganze Wohnung" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>Ganze Wohnung</option>
                                                {dynamicRoomOptions.map((opt, i) => <option key={i} value={opt} style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>{opt}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                                        </div>
                                        {isCustomRoom && (
                                            <input
                                                type="text"
                                                value={globalSettings.room || ''}
                                                onChange={e => setGlobalSettings({ ...globalSettings, room: e.target.value })}
                                                style={S.input}
                                                placeholder="Eigener Raumname"
                                                autoFocus
                                                autoComplete="off"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Datum / Temp / Feuchte */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.85fr 0.85fr', gap: '0.4rem' }}>
                                    {[
                                        { lbl: 'Datum', type: 'date', key: 'date', ph: '' },
                                        { lbl: 'Temp °C', type: 'text', key: 'temp', ph: '20', isNumeric: true },
                                        { lbl: 'Feuchte %', type: 'text', key: 'humidity', ph: '55', isNumeric: true },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label style={{ ...S.label, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{f.lbl}</label>
                                            {f.isNumeric ? (
                                                <div 
                                                    onClick={() => setActiveNumpadField({ field: f.key, value: globalSettings[f.key] || '' })}
                                                    style={{ ...S.input, padding: '0.4rem 0.2rem', fontSize: '1rem', minHeight: 40, textAlign: 'center', background: activeNumpadField?.field === f.key ? '#3B82F6' : 'var(--background)', color: activeNumpadField?.field === f.key ? '#FFFFFF' : 'var(--text-main)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                                                >
                                                    {globalSettings[f.key] || <span style={{color:'#94A3B8'}}>{f.ph}</span>}
                                                </div>
                                            ) : (
                                                <input
                                                    type={f.type}
                                                    value={globalSettings[f.key] || ''}
                                                    onChange={e => setGlobalSettings({ ...globalSettings, [f.key]: e.target.value })}
                                                    style={{ ...S.input, padding: '0.4rem 0.2rem', fontSize: '1rem', minHeight: 40, textAlign: 'center' }}
                                                    placeholder={f.ph}
                                                    autoComplete="off"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ borderTop: '1px solid var(--border)' }} />

                                {/* MP Header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 28px', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem', position: 'sticky', top: 0, backgroundColor: 'var(--background)', zIndex: 1 }}>
                                    <span style={{ ...S.label, marginBottom: 0 }}>MP</span>
                                    <span style={{ ...S.label, marginBottom: 0, textAlign: 'center', color: 'var(--text-muted)' }}>W</span>
                                    <span style={{ ...S.label, marginBottom: 0, textAlign: 'center', color: 'var(--text-muted)' }}>B</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>{measurements.length}/10</span>
                                </div>

                                {/* MP List */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {measurements.map((row, idx) => (
                                        <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 28px', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem', borderRadius: 8, marginBottom: 3, background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 44 }}>
                                            <span style={{ color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 800, userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.pointName || `MP ${idx + 1}`}</span>
                                            <div 
                                                onClick={() => setActiveNumpadField({ idx, field: 'w_value', value: row.w_value || '' })}
                                                style={{ width: '100%', padding: '0.4rem 0.5rem', background: (activeNumpadField?.idx === idx && activeNumpadField?.field === 'w_value') ? '#3B82F6' : 'var(--background)', border: '1px solid var(--border)', color: (activeNumpadField?.idx === idx && activeNumpadField?.field === 'w_value') ? '#FFFFFF' : 'var(--text-main)', fontSize: '1rem', fontWeight: 700, textAlign: 'center', height: 40, boxSizing: 'border-box', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            >
                                                {row.w_value || ''}
                                            </div>
                                            <div 
                                                onClick={() => setActiveNumpadField({ idx, field: 'b_value', value: row.b_value || '' })}
                                                style={{ width: '100%', padding: '0.4rem 0.5rem', background: (activeNumpadField?.idx === idx && activeNumpadField?.field === 'b_value') ? '#3B82F6' : 'var(--background)', border: '1px solid var(--border)', color: (activeNumpadField?.idx === idx && activeNumpadField?.field === 'b_value') ? '#FFFFFF' : 'var(--text-main)', fontSize: '1rem', fontWeight: 700, textAlign: 'center', height: 40, boxSizing: 'border-box', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            >
                                                {row.b_value || ''}
                                            </div>
                                            <button onClick={() => removeMeasurement(idx)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                                        </div>
                                    ))}
                                </div>

                                {/* + Messpunkt */}
                                <button onClick={addMeasurement} style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: 10, background: 'rgba(37,99,235,0.12)', border: '1px dashed rgba(59,130,246,0.5)', color: '#60A5FA', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                                    <Plus size={16} /> MP hinzufügen
                                </button>
                            </>)}


                        </div>

                        {activeNumpadField && (
                            <div style={{ marginTop: '1rem', background: 'var(--surface)', borderRadius: 12, padding: '0.75rem', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.2rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Tastatur ({activeNumpadField.field})</span>
                                    <button onClick={() => setActiveNumpadField(null)} style={{ background: 'transparent', border: 'none', color: '#1E6DB7', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, padding: 0 }}>Fertig</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'DEL'].map(k => (
                                        <button
                                            key={k}
                                            onClick={() => handleNumpadPress(k === '.' ? ',' : k)}
                                            style={{
                                                background: k === 'DEL' ? 'rgba(239,68,68,0.15)' : 'var(--background)',
                                                color: k === 'DEL' ? '#EF4444' : 'var(--text-main)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 8,
                                                height: 48,
                                                fontSize: '1.25rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {k === 'DEL' ? <Delete size={20} /> : k}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── FULLSCREEN SKETCH OVERLAY (unverändert) ── */}
            {isSketchFullscreen && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column', touchAction: 'none' }}>
                    <div style={{ flexShrink: 0, padding: '0.75rem 1rem', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 100 }}>
                        <button onClick={() => { activateTool('pen'); setColor('#000000'); setLineWidth(2); }} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#000000') ? 'var(--primary)' : 'rgba(255,255,255,0.05)', border: (activeTool === 'pen' && color === '#000000') ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.15)', color: (activeTool === 'pen' && color === '#000000') ? 'white' : '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Pen size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Stift</span></button>
                        <button onClick={() => { activateTool('pen'); setColor('#ef4444'); setLineWidth(3); }} style={{ padding: '0.5rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#ef4444') ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: (activeTool === 'pen' && color === '#ef4444') ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)', color: '#ef4444' }}><Pen size={16} /></button>
                        <button onClick={() => { activateTool('pen'); setColor('#3b82f6'); setLineWidth(3); }} style={{ padding: '0.5rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#3b82f6') ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', border: (activeTool === 'pen' && color === '#3b82f6') ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)', color: '#3b82f6' }}><Pen size={16} /></button>
                        <button onClick={() => activateTool('eraser')} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: (activeTool === 'eraser') ? 'var(--color-panel-bg)' : 'rgba(255,255,255,0.05)', border: (activeTool === 'eraser') ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.15)', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Eraser size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Radierer</span></button>
                        <button onClick={() => document.getElementById('sketch-photo-upload-fs').click()} style={{ padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Image size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bilder</span></button>
                        <input id="sketch-photo-upload-fs" type="file" accept="image/*,.heic,.heif" multiple style={{ display: 'none' }} onChange={(e) => { const files = Array.from(e.target.files || []); files.forEach(file => { const reader = new FileReader(); reader.onload = (ev) => { setGalleryPhotos(prev => [...prev, { id: Date.now() + Math.random(), src: ev.target.result }]); activateTool('photo'); }; reader.readAsDataURL(file); }); e.target.value = ''; }} />
                        <button onClick={handleUndo} disabled={historyStep <= 0} style={{ padding: '0.5rem', borderRadius: '4px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: historyStep <= 0 ? 'rgba(255,255,255,0.2)' : '#94A3B8', opacity: historyStep <= 0 ? 0.5 : 1 }}><Undo size={16} /></button>

                        <button onClick={() => { if (window.confirm('Möchten Sie die Skizze und alle Bilder komplett löschen?')) { clearCanvas(); setGalleryPhotos([]); } }} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}><Trash2 size={16} />Löschen</button>
                        <button onClick={() => { if (canvasRef.current && hiddenCanvasRef.current) { const fc = canvasRef.current, hc = hiddenCanvasRef.current; hc.width = fc.width; hc.height = fc.height; const hCtx = hc.getContext('2d'); hCtx.clearRect(0, 0, hc.width, hc.height); hCtx.drawImage(fc, 0, 0); const previewC = document.createElement('canvas'); previewC.width = fc.width; previewC.height = fc.height; const pCtx = previewC.getContext('2d'); pCtx.fillStyle = '#ffffff'; pCtx.fillRect(0, 0, previewC.width, previewC.height); pCtx.strokeStyle = '#e0e0e0'; pCtx.lineWidth = 1; for (let x = 0; x <= previewC.width; x += 40) { pCtx.beginPath(); pCtx.moveTo(x, 0); pCtx.lineTo(x, previewC.height); pCtx.stroke(); } for (let y = 0; y <= previewC.height; y += 40) { pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(previewC.width, y); pCtx.stroke(); } galleryPhotos.forEach(photo => { const img = document.querySelector(`img[data-id="${photo.id}"]`); if (img && img.parentElement) { const parent = img.parentElement; const px = parseFloat(parent.style.left) / 100 * fc.width; const py = parseFloat(parent.style.top) / 100 * fc.height; const pw = parseFloat(parent.style.width) / 100 * fc.width; const ph = parseFloat(parent.style.height) / 100 * fc.height; pCtx.drawImage(img, px, py, pw, ph); } }); pCtx.drawImage(fc, 0, 0); setPreviewSnapshot(previewC.toDataURL()); } setIsSketchFullscreen(false); setIsSketchLocked(true); }} style={{ marginLeft: 'auto', padding: '0.5rem 1.25rem', borderRadius: '8px', background: '#10B981', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PenOff size={16} />Fertig</button>
                    </div>
                    {/* 3-Layer Canvas Stack */}
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#f8f8f8' }}>
                        <canvas ref={gridCanvasRef} width={960} height={600} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', display: 'block' }} />
                        <canvas ref={photoCanvasRef} width={960} height={600} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', display: 'block' }} />
                        <canvas ref={canvasRef} width={960} height={600} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 60, display: 'block', backgroundColor: 'transparent', pointerEvents: 'none', touchAction: 'none' }} />
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 30, backgroundColor: 'transparent', touchAction: 'none', cursor: isDrawMode ? 'crosshair' : 'default' }}
                            onPointerDown={(e) => { if (e.pointerType !== 'pen') return; setSelectedPhotoId(null); startDrawing(e); }}
                            onPointerMove={(e) => { if (e.pointerType === 'pen') draw(e); }}
                            onPointerUp={(e) => { if (e.pointerType === 'pen') stopDrawing(e); }}
                            onPointerLeave={(e) => { if (e.pointerType === 'pen') stopDrawing(e); }}
                            onPointerCancel={(e) => { if (e.pointerType === 'pen') stopDrawing(e); }}
                        />
                        {galleryPhotos.slice(0, 4).map((photo, index) => (
                            <DraggablePhoto key={photo.id} photo={photo} index={index} selected={selectedPhotoId === photo.id} activeTool={activeTool} onDrawStart={startDrawing} onDraw={draw} onDrawEnd={stopDrawing} onSelect={() => setSelectedPhotoId(photo.id)} onDeselect={() => setSelectedPhotoId(null)} onDelete={() => { setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id)); setSelectedPhotoId(null); }} onUpdate={(id, updates) => setGalleryPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))} stylusOnlyMode={stylusOnlyMode} />
                        ))}
                    </div>
                </div>,
                document.body
            )}

            {showCamera && <CameraCaptureModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
        </div>,
        document.body
    );
};

export default MeasurementModal;
