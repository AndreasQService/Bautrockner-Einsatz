﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Eraser, Pen, Undo, Trash2, FileText, Loader, Check, Hand, ChevronUp, ChevronDown, Plus, Edit3, RotateCcw, PenOff, Camera, Image, Move } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CameraCaptureModal from './CameraCaptureModal';

// Default starting positions for up to 4 photos (in %)
const DEFAULT_POSITIONS = [
    { x: 2, y: 2 }, { x: 52, y: 2 },
    { x: 2, y: 52 }, { x: 52, y: 52 },
];

/* GoodNotes-style photo overlay:
   - Tap photo â†’ selected (shows handles, draggable/resizable)
   - Tap canvas empty area â†’ deselects, pen works everywhere
   - No global mode toggle needed */
const DraggablePhoto = ({ photo, index, selected, onSelect, onDeselect, onDelete, onUpdate, activeTool, onDrawStart, onDraw, onDrawEnd }) => {
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
                    try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
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
            <img src={photo.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 2, pointerEvents: 'none', userSelect: 'none' }} />

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
            </> )}




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

const MeasurementModal = ({ isOpen, onClose, onSave, rooms, projectTitle, initialData, readOnly, measurementHistory }) => {

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
    const isDrawMode   = activeTool === 'pen' || activeTool === 'eraser';
    const isPhotoMode  = activeTool === 'photo';
    const isScrollMode = activeTool === 'pan';
    const [measurements, setMeasurements] = useState([]);
    const [history, setHistory] = useState([]); // Array of ImageData
    const [historyStep, setHistoryStep] = useState(-1);
    const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
    const [isSketchLocked, setIsSketchLocked] = useState(true);
    const [isSketchFullscreen, setIsSketchFullscreen] = useState(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState(null); // GoodNotes: welches Foto ist selektiert
    const [previewSnapshot, setPreviewSnapshot] = useState(null);
    const [globalSettings, setGlobalSettings] = useState({
        date: new Date().toISOString().split('T')[0],
        temp: '',
        humidity: '',
        device: ''
    });
    const [availableDevices, setAvailableDevices] = useState([]);

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
    const [galleryPhotos, setGalleryPhotos] = useState([]); // Messprotokoll-Fotos (2-Spalten-Grid)

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
        const allPointNames = new Set(['Messpunkt 1', 'Messpunkt 2', 'Messpunkt 3', 'Messpunkt 4']); // Ensure at least 4 default points

        // Add current measurements (the "capture" template) to ensure they are visible
        if (measurements && measurements.length > 0) {
            measurements.forEach(m => {
                if (m.pointName) allPointNames.add(m.pointName);
            });
        }

        measurementHistory.forEach(entry => {
            if (entry && Array.isArray(entry.measurements)) {
                entry.measurements.forEach(m => {
                    if (m && m.pointName) allPointNames.add(m.pointName);
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
                const currM = entryMeasurements.find(m => m && m.pointName === mpName);
                if (!currM) return; // No data for this MP in this entry

                const cell = {
                    w_value: currM.w_value,
                    b_value: currM.b_value,
                    w_color: 'inherit',
                    b_color: 'inherit'
                };

                // Compare with previous
                if (prevEntry) {
                    const prevM = prevMeasurements.find(m => m && m.pointName === mpName);
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
            if (r > 230 && g > 230 && b > 230) {
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
                setMeasurements(roomData.measurements || []);
                setGlobalSettings(roomData.globalSettings || {
                    date: new Date().toISOString().split('T')[0],
                    temp: '',
                    humidity: '',
                    device: ''
                });
                if (roomData.galleryPhotos) setGalleryPhotos(roomData.galleryPhotos);

                if (roomData.canvasImage) {
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
                    { id: `p${Date.now()}`, pointName: 'Messpunkt 1', w_value: '', b_value: '', notes: '' },
                    { id: `p${Date.now() + 1}`, pointName: 'Messpunkt 2', w_value: '', b_value: '', notes: '' },
                    { id: `p${Date.now() + 2}`, pointName: 'Messpunkt 3', w_value: '', b_value: '', notes: '' },
                    { id: `p${Date.now() + 3}`, pointName: 'Messpunkt 4', w_value: '', b_value: '', notes: '' }
                ];
                setMeasurements(initial);
                setGlobalSettings({
                    date: new Date().toISOString().split('T')[0],
                    temp: '',
                    humidity: '',
                    device: ''
                });
                initCanvas();
            }
        };

        // Start initialization
        performInit();

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
        try { (e.currentTarget || e.target).setPointerCapture(e.pointerId); } catch (_) {}
        const coords = getCoordinates(e);
        const ctx = getCtx();
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        isDrawingRef.current = true;
        setIsDrawing(true);
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
        try { e?.target?.releasePointerCapture(e.pointerId); } catch (_) {}
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
            // Build composited canvas: weiss + Grid + Zeichnungen (hiddenCanvas ist nur Zeichnungs-Layer)
            const canvasDataUrl = (() => {
                if (!toggleCanvas) return null;
                const comp = document.createElement('canvas');
                comp.width = toggleCanvas.width; comp.height = toggleCanvas.height;
                const cCtx = comp.getContext('2d');
                cCtx.fillStyle = '#ffffff'; cCtx.fillRect(0, 0, comp.width, comp.height);
                cCtx.strokeStyle = '#e0e0e0'; cCtx.lineWidth = 1;
                for (let x = 0; x <= comp.width; x += 40) { cCtx.beginPath(); cCtx.moveTo(x,0); cCtx.lineTo(x,comp.height); cCtx.stroke(); }
                for (let y = 0; y <= comp.height; y += 40) { cCtx.beginPath(); cCtx.moveTo(0,y); cCtx.lineTo(comp.width,y); cCtx.stroke(); }
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
            setTimeout(() => {
                setIsSuccess(false);
                setIsSaving(false);
                onClose();
            }, 1000);

        } catch (err) {
            console.error("Error saving sketch:", err);
            alert("Fehler beim Speichern der Skizze.");
            setIsSaving(false);
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
            pointName: `Messpunkt ${measurements.length + 1}`,
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

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem'
        }}>
            <div ref={containerRef} style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '8px',
                width: '95vw',
                maxWidth: '1100px',
                height: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: 'var(--text-main)',
                border: '1px solid var(--border)'
            }}>
                {/* Header */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background)' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Messprotokoll</h3>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {projectTitle} {rooms.length === 1 && ` - ${rooms[0].name}`}
                        </div>
                    </div>
                    <div className="no-print" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {/* <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} />
                            </button> */}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`btn ${isSuccess ? 'btn-success' : 'btn-primary'}`}
                            style={{
                                display: 'flex', gap: '0.5rem', alignItems: 'center',
                                backgroundColor: isSuccess ? '#10B981' : undefined,
                                borderColor: isSuccess ? '#10B981' : undefined
                            }}
                        >
                            {isSaving ? (
                                <Loader size={18} className="animate-spin" />
                            ) : isSuccess ? (
                                <Check size={18} />
                            ) : (
                                // saveAsPdf ? <FileText size={18} /> : <Save size={18} />
                                null
                            )}
                            {isSaving ? 'Speichert...' : isSuccess ? 'Gespeichert!' : (readOnly ? 'Schliessen' : 'Fertig')}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

                    {/* Toolbar & Canvas - Sticky */}
                    {/* Toolbar & Canvas - Sticky - Hidden in History View */}
                    {/* Canvas Fullscreen-Overlay beim Bearbeiten */}
                    {isSketchFullscreen && createPortal(
                        <div style={{
                            position: 'fixed', inset: 0, zIndex: 99999,
                            backgroundColor: '#0F172A',
                            display: 'flex', flexDirection: 'column',
                            touchAction: 'none'
                        }}>

                            {/* Fullscreen Toolbar */}
                            <div style={{ flexShrink:0, padding:'0.75rem 1rem', backgroundColor:'#1E293B', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap', position:'relative', zIndex:100 }}>
                                <button onClick={()=>{activateTool('pen');setColor('#000000');setLineWidth(2);}} style={{padding:'0.5rem 0.75rem',borderRadius:'6px',background:(activeTool==='pen'&&color==='#000000')?'var(--primary)':'rgba(255,255,255,0.05)',border:(activeTool==='pen'&&color==='#000000')?'1px solid var(--primary)':'1px solid rgba(255,255,255,0.15)',color:(activeTool==='pen'&&color==='#000000')?'white':'#CBD5E1',display:'flex',alignItems:'center',gap:'0.4rem'}}><Pen size={16}/><span style={{fontSize:'0.8rem',fontWeight:600}}>Stift</span></button>
                                <button onClick={()=>{activateTool('pen');setColor('#ef4444');setLineWidth(3);}} style={{padding:'0.5rem',borderRadius:'6px',background:(activeTool==='pen'&&color==='#ef4444')?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.05)',border:(activeTool==='pen'&&color==='#ef4444')?'1px solid #ef4444':'1px solid rgba(255,255,255,0.15)',color:'#ef4444'}}><Pen size={16}/></button>
                                <button onClick={()=>{activateTool('pen');setColor('#3b82f6');setLineWidth(3);}} style={{padding:'0.5rem',borderRadius:'6px',background:(activeTool==='pen'&&color==='#3b82f6')?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.05)',border:(activeTool==='pen'&&color==='#3b82f6')?'1px solid #3b82f6':'1px solid rgba(255,255,255,0.15)',color:'#3b82f6'}}><Pen size={16}/></button>
                                <button onClick={()=>activateTool('eraser')} style={{padding:'0.5rem 0.75rem',borderRadius:'6px',background:(activeTool==='eraser')?'#f1f5f9':'rgba(255,255,255,0.05)',border:(activeTool==='eraser')?'1px solid #cbd5e1':'1px solid rgba(255,255,255,0.15)',color:'#94A3B8',display:'flex',alignItems:'center',gap:'0.4rem'}}><Eraser size={16}/><span style={{fontSize:'0.8rem',fontWeight:600}}>Radierer</span></button>
                                
                                <button onClick={()=>document.getElementById('sketch-photo-upload-fs').click()} style={{padding:'0.5rem',borderRadius:'6px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.15)',color:'#CBD5E1',display:'flex',alignItems:'center',gap:'0.4rem'}}><Image size={16}/><span style={{fontSize:'0.8rem',fontWeight:600}}>Bilder</span></button>
                                <input id="sketch-photo-upload-fs" type="file" accept="image/*,.heic,.heif" multiple style={{display:'none'}} onChange={(e)=>{const files=Array.from(e.target.files||[]);files.forEach(file=>{const reader=new FileReader();reader.onload=(ev)=>{setGalleryPhotos(prev=>[...prev,{id:Date.now()+Math.random(),src:ev.target.result}]);activateTool('photo');};reader.readAsDataURL(file);});e.target.value='';}} />
                                <button onClick={handleUndo} disabled={historyStep<=0} style={{padding:'0.5rem',borderRadius:'4px',background:'transparent',border:'1px solid rgba(255,255,255,0.15)',color:historyStep<=0?'rgba(255,255,255,0.2)':'#CBD5E1',opacity:historyStep<=0?0.5:1}}><Undo size={16}/></button>
                                
                                
                                <button onClick={() => {
                                    if (canvasRef.current && hiddenCanvasRef.current) {
                                        const fc = canvasRef.current;
                                        const hc = hiddenCanvasRef.current;
                                        // Sync Layer 2 -> hiddenCanvas (nur Zeichnungen, transparent!)
                                        hc.width = fc.width; hc.height = fc.height;
                                        const hCtx = hc.getContext('2d');
                                        hCtx.clearRect(0, 0, hc.width, hc.height);
                                        hCtx.drawImage(fc, 0, 0);
                                        // Preview: weiss + Grid + Zeichnungen zusammen rendern
                                        const previewC = document.createElement('canvas');
                                        previewC.width = fc.width; previewC.height = fc.height;
                                        const pCtx = previewC.getContext('2d');
                                        pCtx.fillStyle = '#ffffff'; pCtx.fillRect(0, 0, previewC.width, previewC.height);
                                        pCtx.strokeStyle = '#e0e0e0'; pCtx.lineWidth = 1;
                                        for (let x = 0; x <= previewC.width; x += 40) { pCtx.beginPath(); pCtx.moveTo(x,0); pCtx.lineTo(x,previewC.height); pCtx.stroke(); }
                                        for (let y = 0; y <= previewC.height; y += 40) { pCtx.beginPath(); pCtx.moveTo(0,y); pCtx.lineTo(previewC.width,y); pCtx.stroke(); }
                                        pCtx.drawImage(fc, 0, 0);
                                        setPreviewSnapshot(previewC.toDataURL());
                                        // galleryPhotos bleiben erhalten (GoodNotes-Stil)
                                    }
                                    setIsSketchFullscreen(false); setIsSketchLocked(true);
                                }} style={{ marginLeft: 'auto', padding: '0.5rem 1.25rem', borderRadius: '8px', background: '#10B981', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PenOff size={16} />Fertig</button>
                            </div>
                            {/* 3-Layer Canvas Stack */}
                            <div style={{flex:1, position:'relative', overflow:'hidden', backgroundColor:'#f8f8f8'}}>
                                {/* Layer 1: Grid + weisser Hintergrund (permanent, unzerstÃ¶rbar) */}
                                <canvas ref={gridCanvasRef} width={960} height={600}
                                    style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:1,pointerEvents:'none',display:'block'}} />
                                {/* Layer 1.5: Fotos (radierer-GESCHUETZT - Radierer beruehrt diesen Layer NIEMALS) */}
                                <canvas ref={photoCanvasRef} width={960} height={600}
                                    style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2,pointerEvents:'none',display:'block'}} />
                                {/* Layer 2 Display: Zeichnungen UEBER Fotos (pointerEvents:none) */}
                                <canvas
                                    ref={canvasRef}
                                    width={960}
                                    height={600}
                                    style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',
                                        zIndex:60,display:'block',backgroundColor:'transparent',
                                        pointerEvents:'none',touchAction:'none'}}
                                />
                                {/* Pen Hit Area: Pencil-Events fuer leere Bereiche (unter Fotos) */}
                                <div
                                    style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',
                                        zIndex:30,backgroundColor:'transparent',touchAction:'none',
                                        cursor:isDrawMode?'crosshair':'default'}}
                                    onPointerDown={(e) => {
                                        if (e.pointerType !== 'pen') return;
                                                        setSelectedPhotoId(null); startDrawing(e);
                                    }}
                                    onPointerMove={(e) => { if (e.pointerType === 'pen') draw(e); }}
                                    onPointerUp={(e) => { if (e.pointerType === 'pen') stopDrawing(e); }}
                                    onPointerLeave={(e) => { if (e.pointerType === 'pen') stopDrawing(e); }}
                                    onPointerCancel={(e) => { if (e.pointerType === 'pen') stopDrawing(e); }}
                                />
                                                                {/* Layer 3: Foto-Overlays (zIndex 10+, Ã¼ber beiden Canvas-Layern) */}
                                {galleryPhotos.slice(0, 4).map((photo, index) => (
                                    <DraggablePhoto
                                        key={photo.id}
                                        photo={photo}
                                        index={index}
                                        selected={selectedPhotoId === photo.id}
                                        activeTool={activeTool}
                                        onDrawStart={startDrawing}
                                        onDraw={draw}
                                        onDrawEnd={stopDrawing}
                                        onSelect={() => setSelectedPhotoId(photo.id)}
                                        onDeselect={() => setSelectedPhotoId(null)}
                                        onDelete={() => { setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id)); setSelectedPhotoId(null); }}
                                        onUpdate={(id, updates) => setGalleryPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))}
                                    />

                                ))}
                            </div>
                        </div>,
                        document.body
                    )}

                    {!readOnly && (
                        <div style={{
                            padding: '1rem',
                            borderBottom: '1px solid var(--border)',
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'var(--surface)',
                            zIndex: 10
                        }}>
                            <div className="no-print" style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Werkzeuge:</span>

                                {isSketchLocked ? (
                                    <button
                                        onClick={() => {
                                            // Sync hidden canvas -> fullscreen drawing layer
                                            setTimeout(() => {
                                                // Layer 1: weiss + Grid (permanent, unzerstoerbar)
                                                drawGridLayer(gridCanvasRef.current);
                                                // Layer 2: Zeichnungen aus hiddenCanvas (transparent, kein weisser Fill!)
                                                const fc = canvasRef.current;
                                                const hc = hiddenCanvasRef.current;
                                                if (fc && hc) {
                                                    fc.width = hc.width;
                                                    fc.height = hc.height;
                                                    const fCtx = fc.getContext('2d');
                                                    fCtx.clearRect(0, 0, fc.width, fc.height);
                                                    // stripWhiteBackground: weisse Pixel -> transparent
                                                    // Damit bleibt das Grid (Layer 1) durch canvasRef (Layer 2) sichtbar
                                                    const stripped = stripWhiteBackground(hc, hc.width, hc.height);
                                                    fCtx.drawImage(stripped, 0, 0);
                                                }
                                            }, 100);
                                            setIsSketchLocked(false); setIsSketchFullscreen(true);
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '4px',
                                            background: 'var(--primary)',
                                            border: '1px solid var(--primary)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.9rem',
                                            fontWeight: 500
                                        }}
                                        title="Zeichnen aktivieren"
                                    >
                                        <Edit3 size={16} /> Skizze bearbeiten
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => { activateTool('pen'); setColor('#000000'); setLineWidth(2); }}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '6px',
                                                background: (activeTool === 'pen' && color === '#000000') ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                border: (activeTool === 'pen' && color === '#000000') ? '1px solid var(--primary)' : '1px solid var(--border)',
                                                color: (activeTool === 'pen' && color === '#000000') ? 'white' : 'var(--text-main)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                            title="Stift Schwarz"
                                        >
                                            <Pen size={16} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Stift</span>
                                        </button>
                                        <button
                                            onClick={() => { activateTool('pen'); setColor('#ef4444'); setLineWidth(2); }}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                background: (activeTool === 'pen' && color === '#ef4444') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                                                border: (activeTool === 'pen' && color === '#ef4444') ? '1px solid #ef4444' : '1px solid var(--border)',
                                                color: '#ef4444'
                                            }}
                                            title="Stift Rot"
                                        >
                                            <Pen size={16} />
                                        </button>
                                        <button
                                            onClick={() => { activateTool('pen'); setColor('#3b82f6'); setLineWidth(2); }}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                background: (activeTool === 'pen' && color === '#3b82f6') ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                                border: (activeTool === 'pen' && color === '#3b82f6') ? '1px solid #3b82f6' : '1px solid var(--border)',
                                                color: '#3b82f6'
                                            }}
                                            title="Stift Blau"
                                        >
                                            <Pen size={16} />
                                        </button>
                                        <button
                                            onClick={() => activateTool('eraser')}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '6px',
                                                background: (activeTool === 'eraser') ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                                                border: (activeTool === 'eraser') ? '1px solid #cbd5e1' : '1px solid var(--border)',
                                                color: '#475569',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                            title="Radiergummi"
                                        >
                                            <Eraser size={16} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Radierer</span>
                                        </button>
                                        <button
                                            onClick={() => setShowCamera(true)}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-main)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                            title="Kamera starten"
                                        >
                                            <Camera size={16} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Foto</span>
                                        </button>

                                        <button
                                            onClick={() => document.getElementById('sketch-photo-upload').click()}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-main)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                            title="Bild aus Galerie laden"
                                        >
                                            <Image size={16} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bilder</span>
                                        </button>

                                        <input
                                            id="sketch-photo-upload"
                                            type="file"
                                            accept="image/*,.heic,.heif"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length === 0) return;
                                                files.forEach(file => {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        setGalleryPhotos(prev => [...prev, { id: Date.now() + Math.random(), src: ev.target.result }]);
                                                        activateTool('photo');
                                                    };
                                                    reader.readAsDataURL(file);
                                                });
                                                e.target.value = '';
                                            }}
                                        />

                                        <button
                                            onClick={() => { setIsSketchLocked(true); setIsSketchFullscreen(false); }}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '6px',
                                                background: 'rgba(16, 185, 129, 0.15)',
                                                border: '1px solid #10B981',
                                                color: '#10B981',
                                                marginLeft: '0.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                            title="Skizze sperren"
                                        >
                                            <PenOff size={16} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sperren</span>
                                        </button>
                                    </>
                                )}

                                <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }}></div>

                                <button
                                    onClick={() => setStylusOnlyMode(!stylusOnlyMode)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        background: stylusOnlyMode ? '#F59E0B' : 'rgba(255,255,255,0.05)',
                                        border: stylusOnlyMode ? '1px solid #F59E0B' : '1px solid var(--border)',
                                        color: stylusOnlyMode ? 'white' : 'var(--text-main)',
                                        marginRight: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        fontWeight: 600,
                                        fontSize: '0.8rem'
                                    }}
                                    disabled={isSketchLocked}
                                    title={stylusOnlyMode ? "Nur Stift (Handballen ignorieren)" : "Touch & Stift"}
                                >
                                    <Pen size={16} />
                                    <span>{stylusOnlyMode ? "Nur Stift" : "Stift & Hand"}</span>
                                </button>

                                <button
                                    onClick={() => activateTool(isScrollMode ? 'pen' : 'pan')}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        background: isScrollMode ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                        border: isScrollMode ? '1px solid var(--primary)' : '1px solid var(--border)',
                                        color: isScrollMode ? 'white' : 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                    title={isScrollMode ? "Scrollen aktiv (Zeichnen deaktiviert)" : "Zeichnen aktiv"}
                                >
                                    <Hand size={16} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Scrollen</span>
                                </button>

                                <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }}></div>

                                <button onClick={handleUndo} disabled={historyStep <= 0 || isSketchLocked} style={{ padding: '0.5rem', borderRadius: '4px', background: 'transparent', border: '1px solid var(--border)', color: historyStep <= 0 || isSketchLocked ? 'var(--text-muted)' : 'var(--text-main)', opacity: historyStep <= 0 || isSketchLocked ? 0.5 : 1 }} title="RÃ¼ckgÃ¤ngig"><Undo size={16} /></button>

                                <button
                                    onClick={() => setIsCanvasExpanded(!isCanvasExpanded)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        marginLeft: 'auto',
                                        color: 'var(--text-main)'
                                    }}
                                    title={isCanvasExpanded ? "Skizze einklappen" : "Skizze ausklappen"}
                                >
                                    {isCanvasExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>

                            {/* Hidden canvas â€” immer im DOM fÃ¼r Init/Save */}
                            <canvas ref={hiddenCanvasRef} width={960} height={600} style={{ display: 'none' }} />

                            {/* Kleine Vorschau â€” img Snapshot, Canvas nur im Fullscreen */}
                            <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'white', backgroundImage: `linear-gradient(to right, #e0e0e0 1px, transparent 1px), linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)`, backgroundSize: '40px 40px', height: '130px' }}>
                                {previewSnapshot
                                    ? <img src={previewSnapshot} style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }} alt="Skizze" />
                                    : <div style={{ width: '100%', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>Noch keine Skizze</div>
                                }
                            </div>
                        </div>
                    )}

                    {/* Room Name Header */}
                    <div style={{ padding: '1rem 1rem 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', margin: 0 }}>
                            {rooms.length === 1 ? rooms[0].name : 'Unbekannter Raum'}
                        </h2>
                    </div>

                    {/* Global Room Info */}
                    {/* Global Room Info - Hidden in History View */}
                    {!readOnly && (
                        <div style={{ padding: '0.5rem 1rem 0 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Datum</label>
                                <input
                                    type="date"
                                    value={globalSettings.date}
                                    onChange={e => setGlobalSettings({ ...globalSettings, date: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%', padding: '0.6rem', minHeight: '40px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Raumtemp. (Â°C)</label>
                                <input
                                    type="number"
                                    step="any"
                                    inputMode="decimal"
                                    value={globalSettings.temp}
                                    onChange={e => setGlobalSettings({ ...globalSettings, temp: e.target.value })}
                                    className="form-input no-spinner"
                                    style={{ width: '100%', padding: '0.6rem', minHeight: '40px' }}
                                    placeholder="20.5"
                                    autoComplete="off"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Luftfeuchte (%)</label>
                                <input
                                    type="number"
                                    step="any"
                                    inputMode="decimal"
                                    value={globalSettings.humidity}
                                    onChange={e => setGlobalSettings({ ...globalSettings, humidity: e.target.value })}
                                    className="form-input no-spinner"
                                    style={{ width: '100%', padding: '0.6rem', minHeight: '40px' }}
                                    placeholder="55"
                                    autoComplete="off"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>MessgerÃ¤t</label>
                                <input
                                    type="text"
                                    list="available-devices"
                                    value={globalSettings.device}
                                    onChange={e => setGlobalSettings({ ...globalSettings, device: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%', padding: '0.6rem', minHeight: '40px' }}
                                    placeholder="z.B. Trotec"
                                />
                                <datalist id="available-devices">
                                    {availableDevices.map((d, i) => (
                                        <option key={i} value={d} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    )}

                    {/* Measurements Table */}
                    <div style={{ padding: '1rem' }}>
                        {/* Current Measurements Table (Only if not readOnly) */}
                        {!readOnly && (
                            <div style={{ marginBottom: '2rem', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', width: '30%', color: 'var(--text-muted)' }}>Messpunkt</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', width: '20%', color: 'var(--text-muted)' }}>Wand</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', width: '20%', color: 'var(--text-muted)' }}>Boden</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Bemerkung</th>
                                            <th style={{ padding: '0.5rem', width: '40px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {measurements.map((row, idx) => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        type="text"
                                                        value={row.pointName}
                                                        onChange={(e) => updateMeasurement(idx, 'pointName', e.target.value)}
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', minHeight: '44px', userSelect: 'text', WebkitUserSelect: 'text' }}
                                                        autoComplete="off"
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={row.w_value}
                                                        onChange={(e) => updateMeasurement(idx, 'w_value', e.target.value)}
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', minHeight: '44px', touchAction: 'manipulation', userSelect: 'text', WebkitUserSelect: 'text' }}
                                                        placeholder="Wert..."
                                                        autoComplete="off"
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={row.b_value}
                                                        onChange={(e) => updateMeasurement(idx, 'b_value', e.target.value)}
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', minHeight: '44px', touchAction: 'manipulation', userSelect: 'text', WebkitUserSelect: 'text' }}
                                                        placeholder="Wert..."
                                                        autoComplete="off"
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        type="text"
                                                        value={row.notes}
                                                        onChange={(e) => updateMeasurement(idx, 'notes', e.target.value)}
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', minHeight: '44px', userSelect: 'text', WebkitUserSelect: 'text' }}
                                                        placeholder="..."
                                                        autoComplete="off"
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => removeMeasurement(idx)}
                                                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                                                        title="Messpunkt lÃ¶schen"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <button
                                    onClick={addMeasurement}
                                    className="no-print"
                                    style={{
                                        marginTop: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        minHeight: '44px',
                                        background: 'transparent',
                                        border: '1px dashed var(--border)',
                                        borderRadius: '4px',
                                        color: 'var(--primary)',
                                        cursor: 'pointer',
                                        width: '100%',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Plus size={16} /> weiteren Messpunkt hinzufÃ¼gen
                                </button>
                            </div>
                        )}

                        {/* History Comparison Table */}
                        {historyRows.length > 0 && readOnly && (
                            <div style={{ marginTop: (!readOnly ? '2rem' : '0') }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <RotateCcw size={16} /> Bisherige MessverlÃ¤ufe
                                </h4>
                                <div style={{ overflowX: 'auto' }}>
                                    {historyColumns.length >= 8 ? (
                                        /* Transposed View for many points (Points in Rows, Dates in Columns) */
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', minWidth: '150px', position: 'sticky', left: 0, backgroundColor: 'var(--background)', zIndex: 11 }}>Messbereich / Punkt</th>
                                                    {[...historyRows].reverse().map(row => (
                                                        <th key={row.id} style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)', minWidth: '100px', backgroundColor: 'var(--background)' }}>
                                                            {row.date ? new Date(row.date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                                            <div style={{ fontSize: '0.7em', fontWeight: 'normal', marginTop: '2px' }}>(W / B)</div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyColumns.map(col => (
                                                    <tr key={col} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--primary)', position: 'sticky', left: 0, backgroundColor: 'var(--surface)', zIndex: 10, borderRight: '1px solid var(--border)' }}>
                                                            {col}
                                                        </td>
                                                        {[...historyRows].reverse().map(row => {
                                                            const cell = row.points[col];
                                                            return (
                                                                <td key={row.id} style={{ padding: '0.5rem', textAlign: 'center', backgroundColor: row.id === 'current' ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                                                                    {cell ? (
                                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                                            <span style={{
                                                                                color: cell.w_color,
                                                                                fontWeight: cell.w_color !== 'inherit' && cell.w_color !== 'var(--text-main)' ? 'bold' : 'normal',
                                                                                minWidth: '25px',
                                                                                textAlign: 'right'
                                                                            }}>
                                                                                {cell.w_value || '-'}
                                                                            </span>
                                                                            <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>/</span>
                                                                            <span style={{
                                                                                color: cell.b_color,
                                                                                fontWeight: cell.b_color !== 'inherit' && cell.b_color !== 'var(--text-main)' ? 'bold' : 'normal',
                                                                                minWidth: '25px',
                                                                                textAlign: 'left'
                                                                            }}>
                                                                                {cell.b_value || '-'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {/* Protocol Row Removed */}
                                            </tbody>
                                        </table>
                                    ) : (
                                        /* Original View for few points (Dates in Rows, Points in Columns) */
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)', minWidth: '100px' }}>Datum</th>
                                                    {historyColumns.map(col => (
                                                        <th key={col} style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)', minWidth: '100px' }}>
                                                            {col}<br />
                                                            <span style={{ fontSize: '0.7em', fontWeight: 'normal' }}>(W / B)</span>
                                                        </th>
                                                    ))}
                                                    {/* Protocol Header Removed */}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyRows.map(row => (
                                                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: row.id === 'current' ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                                                        <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                                                            {row.date ? new Date(row.date).toLocaleDateString('de-CH') : '-'}
                                                        </td>
                                                        {historyColumns.map(col => {
                                                            const cell = row.points[col];
                                                            return (
                                                                <td key={col} style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                                    {cell ? (
                                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                                            <span style={{
                                                                                color: cell.w_color,
                                                                                fontWeight: cell.w_color !== 'inherit' && cell.w_color !== 'var(--text-main)' ? 'bold' : 'normal',
                                                                                minWidth: '25px',
                                                                                textAlign: 'right'
                                                                            }}>
                                                                                {cell.w_value || '-'}
                                                                            </span>
                                                                            <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</span>
                                                                            <span style={{
                                                                                color: cell.b_color,
                                                                                fontWeight: cell.b_color !== 'inherit' && cell.b_color !== 'var(--text-main)' ? 'bold' : 'normal',
                                                                                minWidth: '25px',
                                                                                textAlign: 'left'
                                                                            }}>
                                                                                {cell.b_value || '-'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        {/* Protocol Cell Removed */}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        {historyRows.length === 0 && readOnly && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <RotateCcw size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p>Keine historischen Daten vorhanden.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showCamera && (
                <CameraCaptureModal
                    onClose={() => setShowCamera(false)}
                    onCapture={handleCameraCapture}
                />
            )}
        </div>
        , document.body);
};

export default MeasurementModal;
