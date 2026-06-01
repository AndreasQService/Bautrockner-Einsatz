import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Eraser, Pen, Undo, Trash2, Camera, Image, Move, PenOff, ChevronDown, Hand } from 'lucide-react';

const DEFAULT_POSITIONS = [
    { x: 2, y: 2 }, { x: 52, y: 2 },
    { x: 2, y: 52 }, { x: 52, y: 52 },
];

const DraggablePhoto = ({ photo, index, selected, onSelect, onDeselect, onDelete, onUpdate, activeTool, onDrawStart, onDraw, onDrawEnd, stylusOnlyMode }) => {
    const isDrawMode = activeTool === 'pen' || activeTool === 'eraser';
    const [pos, setPos] = useState(photo.pos || DEFAULT_POSITIONS[index] || { x: 5, y: 5 });
    const [size, setSize] = useState(photo.size || { w: 44, h: 44 }); // %

    // Sync state with props to ensure proper resets when galleryPhotos resets in parent
    useEffect(() => {
        if (photo.pos) setPos(photo.pos);
        if (photo.size) setSize(photo.size);
    }, [photo.pos, photo.size]);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragRef = useRef(null);
    const didMove = useRef(false);

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
        const aspect = startSize.h / startSize.w;
        const onMove = (me) => {
            const dx = ((me.clientX - startX) / pw) * 100;
            const newW = Math.max(8, Math.min(98 - pos.x, startSize.w + dx));
            const newH = Math.max(8, Math.min(98 - pos.y, newW * aspect));
            
            // Adjust width to match clamped height bounds
            const finalW = newH / aspect;
            const ns = { w: finalW, h: newH };
            
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
                zIndex: selected ? 50 : 40,
                pointerEvents: 'auto',
                touchAction: 'none',
                cursor: isDrawMode ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : (selected ? (isDragging ? 'grabbing' : 'move') : 'grab'),
                outline: selected ? `2px solid ${active ? '#3B82F6' : 'rgba(59,130,246,0.7)'}` : 'none',
                boxShadow: selected
                    ? (active ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.4)')
                    : '0 3px 12px rgba(0,0,0,0.25)',
                borderRadius: 3, overflow: 'visible',
                transition: active ? 'none' : 'box-shadow 0.15s, outline 0.1s',
            }}
            onPointerDown={(e) => {
                if (e.pointerType === 'pen') {
                    e.preventDefault();
                    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
                    onDrawStart(e);
                    return;
                }
                if (e.target.closest('[data-resize]') || e.target.closest('[data-action]')) return;
                e.preventDefault(); e.stopPropagation();
                onSelect();
                handlePointerDown(e);
            }}
            onPointerMove={(e) => { if (e.pointerType === 'pen') { onDraw(e); } }}
            onPointerUp={(e) => { if (e.pointerType === 'pen') { onDrawEnd(e); } }}
            onPointerLeave={(e) => { if (e.pointerType === 'pen') { onDrawEnd(e); } }}
            onPointerCancel={(e) => { if (e.pointerType === 'pen') { onDrawEnd(e); } }}>
            <img src={photo.src} data-id={photo.id} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 2, pointerEvents: 'none', userSelect: 'none' }} />

            {selected && (<>
                <button data-action="true" onClick={(e) => { e.stopPropagation(); onDeselect(); }}
                    style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#10B981', border: '2px solid white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 25, color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', fontSize: 14, fontWeight: 'bold' }}
                    title="Fertig">&#x2713;</button>
                <button data-action="true" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    style={{ position: 'absolute', top: -12, right: -12, background: '#EF4444', border: '2px solid white', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 25, color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                    <X size={12} />
                </button>
                <div data-resize="true" onPointerDown={(e) => { if (stylusOnlyMode && e.pointerType === 'touch') return; startResize(e); }}
                    style={{ position: 'absolute', bottom: -12, right: -12, width: 26, height: 26, background: '#3B82F6', cursor: 'se-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25, borderRadius: '50%', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', touchAction: 'none' }}>
                    <Move size={12} color="white" />
                </div>
            </>)}

            {!selected && (
                <div
                    onPointerDown={(e) => { if (stylusOnlyMode && e.pointerType === 'touch') return; e.preventDefault(); e.stopPropagation(); onSelect(); }}
                    style={{ position: 'absolute', top: -1, left: -1, width: 28, height: 28, background: 'rgba(59,130,246,0.75)', borderRadius: '3px 0 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 25, pointerEvents: 'auto', touchAction: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                    title="Foto auswählen">
                    <Move size={13} color="white" />
                </div>
            )}
        </div>
    );
};

export default function MeasurementSketchCanvas({
    isOpen,
    onClose,
    onSave,
    initialCanvasImage = null,
    initialGalleryPhotos = [],
    title = '',
    showTitleInput = false,
    stylusOnlyMode = true
}) {
    const [canvasTitle, setCanvasTitle] = useState(title);
    const [activeTool, setActiveTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [selectedPhotoId, setSelectedPhotoId] = useState(null);
    const [galleryPhotos, setGalleryPhotos] = useState(initialGalleryPhotos);
    const [isDrawing, setIsDrawing] = useState(false);
    const isDrawMode = activeTool === 'pen' || activeTool === 'eraser';

    // History stack for Undo
    const [history, setHistory] = useState([]);
    const [historyStep, setHistoryStep] = useState(-1);

    const gridCanvasRef = useRef(null);
    const photoCanvasRef = useRef(null);
    const canvasRef = useRef(null);
    const hiddenCanvasRef = useRef(null);
    const isDrawingRef = useRef(false);

    const activeToolRef = useRef(activeTool);
    const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
    const activePointersRef = useRef({});
    const lastTouchDistanceRef = useRef(null);
    const lastTouchCenterRef = useRef(null);
    const isPanningRef = useRef(false);
    const viewportRef = useRef(null);
    const portalRef = useRef(null);
    const colorRef = useRef(color);
    const lineWidthRef = useRef(lineWidth);

    useEffect(() => { activeToolRef.current = activeTool === 'photo' ? 'pen' : activeTool; }, [activeTool]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);

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

    const stripWhiteBackground = (img, w, h) => {
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (r > 150 && g > 150 && b > 150) {
                d[i + 3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return tmp;
    };

    const saveParamsToHistory = (canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev.slice(0, historyStep + 1), imageData]);
        setHistoryStep(prev => prev + 1);
    };

    const handleUndo = () => {
        if (historyStep > 0) {
            const newStep = historyStep - 1;
            const imageData = history[newStep];
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.putImageData(imageData, 0, 0);
            setHistoryStep(newStep);
        }
    };

    const initCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHistory([]);
        setHistoryStep(-1);
        saveParamsToHistory(canvas);
    };

    useEffect(() => {
        if (!isOpen) return;

        // Clean slate reset of all modal state variables on open
        setGalleryPhotos(initialGalleryPhotos || []);
        setCanvasTitle(title || '');
        setSelectedPhotoId(null);
        setActiveTool('pen');
        setViewport({ scale: 1, x: 0, y: 0 });
        setColor('#000000');
        setLineWidth(2);

        let initTimer = setTimeout(() => {
            const gc = gridCanvasRef.current;
            drawGridLayer(gc);

            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (initialCanvasImage) {
                const img = new window.Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const stripped = stripWhiteBackground(img, canvas.width, canvas.height);
                    ctx.drawImage(stripped, 0, 0);
                    setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
                    setHistoryStep(0);
                };
                img.src = initialCanvasImage;
            } else {
                initCanvas();
            }
        }, 100);

        return () => clearTimeout(initTimer);
    }, [isOpen, initialCanvasImage]);

    // Lock body scroll when fullscreen sketch modal is active
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            const originalPosition = document.body.style.position;
            const originalWidth = document.body.style.width;
            const originalHeight = document.body.style.height;

            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';

            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.position = originalPosition;
                document.body.style.width = originalWidth;
                document.body.style.height = originalHeight;
            };
        }
    }, [isOpen]);

    // Neutralize iOS Safari native touch zoom, pan, and context menus completely in the viewport via vanilla non-passive listeners
    useEffect(() => {
        const portalEl = portalRef.current;
        if (!portalEl || !isOpen) return;

        const isInteractiveElement = (target) => {
            if (!target) return false;
            return target.closest('button, input, select, textarea, [data-action], [data-resize]') !== null;
        };

        const handleTouchStart = (e) => {
            // Only lock finger touches if active tool is drawing (pen/eraser)
            const isDrawingTool = activeTool === 'pen' || activeTool === 'eraser';
            if (!isDrawingTool) return;

            const isStylus = e.touches && e.touches[0] && e.touches[0].touchType === 'stylus';
            if (isStylus) return; // Allow Apple Pencil

            if (!isInteractiveElement(e.target)) {
                e.preventDefault();
            }
        };

        const handleTouchMove = (e) => {
            // Block native scrolling and rubber-banding globally inside the portal container
            const isDrawingTool = activeTool === 'pen' || activeTool === 'eraser';
            if (isDrawingTool && !isInteractiveElement(e.target)) {
                e.preventDefault();
            }
        };

        portalEl.addEventListener('touchstart', handleTouchStart, { passive: false });
        portalEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        portalEl.addEventListener('gesturestart', handleTouchMove, { passive: false });
        portalEl.addEventListener('gesturechange', handleTouchMove, { passive: false });

        return () => {
            portalEl.removeEventListener('touchstart', handleTouchStart);
            portalEl.removeEventListener('touchmove', handleTouchMove);
            portalEl.removeEventListener('gesturestart', handleTouchMove);
            portalEl.removeEventListener('gesturechange', handleTouchMove);
        };
    }, [isOpen, activeTool]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

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

    const handleViewportPointerDown = (e) => {
        // If stylus is active, block ALL touch viewport interactions
        if (isDrawingRef.current) return;

        // If active tool is drawing (pen/eraser), touch/finger should NEVER pan or zoom!
        // This is pure, absolute palm rejection.
        if (e.pointerType === 'touch' && (activeTool === 'pen' || activeTool === 'eraser')) {
            e.preventDefault();
            return;
        }

        // Pen should always draw, not pan!
        // Mouse draws when not in pan mode, so only pan when tool is 'pan' or if it is touch.
        const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
        if (isPen) return;

        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}

        activePointersRef.current[e.pointerId] = {
            clientX: e.clientX,
            clientY: e.clientY
        };

        const pointerIds = Object.keys(activePointersRef.current);
        if (pointerIds.length === 1) {
            // Single finger pan is ONLY allowed if activeTool is 'pan' or 'photo' (Verschieben)
            isPanningRef.current = activeTool === 'pan' || activeTool === 'photo';
        } else if (pointerIds.length === 2) {
            const p1 = activePointersRef.current[pointerIds[0]];
            const p2 = activePointersRef.current[pointerIds[1]];
            lastTouchDistanceRef.current = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
            lastTouchCenterRef.current = {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2
            };
        }
    };

    const handleViewportPointerMove = (e) => {
        if (isDrawingRef.current) return;

        // If active tool is drawing (pen/eraser), touch/finger should NEVER pan or zoom!
        if (e.pointerType === 'touch' && (activeTool === 'pen' || activeTool === 'eraser')) {
            e.preventDefault();
            return;
        }

        if (!activePointersRef.current[e.pointerId]) return;

        // Pen should not pan/zoom
        const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
        if (isPen) return;

        const currentPointer = activePointersRef.current[e.pointerId];
        const dx = e.clientX - currentPointer.clientX;
        const dy = e.clientY - currentPointer.clientY;

        // Update active pointer coordinate
        activePointersRef.current[e.pointerId] = {
            clientX: e.clientX,
            clientY: e.clientY
        };

        const pointerIds = Object.keys(activePointersRef.current);
        if (pointerIds.length === 1 && isPanningRef.current) {
            // Single finger pan is ONLY allowed if activeTool is 'pan' or 'photo' (Verschieben)
            const canSingleFingerPan = activeTool === 'pan' || activeTool === 'photo';
            if (!canSingleFingerPan) return;

            // Pan
            setViewport(prevV => ({
                ...prevV,
                x: prevV.x + dx,
                y: prevV.y + dy
            }));
        } else if (pointerIds.length === 2) {
            // Pinch to zoom and center-pan
            const p1 = activePointersRef.current[pointerIds[0]];
            const p2 = activePointersRef.current[pointerIds[1]];

            const currentDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
            const currentCenter = {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2
            };

            if (lastTouchDistanceRef.current && lastTouchCenterRef.current) {
                const scaleFactor = currentDist / lastTouchDistanceRef.current;
                const newScale = Math.max(0.3, Math.min(5, viewport.scale * scaleFactor));

                const centerDx = currentCenter.x - lastTouchCenterRef.current.x;
                const centerDy = currentCenter.y - lastTouchCenterRef.current.y;

                setViewport(prevV => ({
                    scale: newScale,
                    x: prevV.x + centerDx,
                    y: prevV.y + centerDy
                }));
            }

            lastTouchDistanceRef.current = currentDist;
            lastTouchCenterRef.current = currentCenter;
        }
    };

    const handleViewportPointerUp = (e) => {
        delete activePointersRef.current[e.pointerId];
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

        const pointerIds = Object.keys(activePointersRef.current);
        if (pointerIds.length < 2) {
            lastTouchDistanceRef.current = null;
            lastTouchCenterRef.current = null;
        }
        if (pointerIds.length === 0) {
            isPanningRef.current = false;
        }
    };

    const handleViewportWheel = (e) => {
        e.preventDefault();
        const zoomIntensity = 0.05;
        const delta = e.deltaY < 0 ? 1 : -1;
        setViewport(prevV => {
            const newScale = Math.max(0.3, Math.min(5, prevV.scale + delta * zoomIntensity));
            return {
                ...prevV,
                scale: parseFloat(newScale.toFixed(2))
            };
        });
    };

    const startDrawing = (e) => {
        if (!isOpen || activeTool === 'photo') return;
        if (stylusOnlyMode && e.pointerType === 'touch') return;
        if (stylusOnlyMode && e.pointerType !== 'pen') return;
        try { (e.currentTarget || e.target).setPointerCapture(e.pointerId); } catch (_) { }
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
        try { e?.target?.releasePointerCapture(e.pointerId); } catch (_) { }
        saveParamsToHistory(canvasRef.current);
    };

    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const newId = Date.now() + Math.random();
                setGalleryPhotos(prev => {
                    const defaultPos = DEFAULT_POSITIONS[prev.length % DEFAULT_POSITIONS.length] || { x: 5, y: 5 };
                    return [...prev, { 
                        id: newId, 
                        src: ev.target.result,
                        pos: defaultPos,
                        size: { w: 44, h: 44 }
                    }];
                });
                setActiveTool('photo');
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveParamsToHistory(canvas);
    };

    const handleSave = () => {
        const fc = canvasRef.current;
        if (!fc) return;

        // Create flattened compiler canvas
        const comp = document.createElement('canvas');
        comp.width = fc.width;
        comp.height = fc.height;
        const cCtx = comp.getContext('2d');

        // Draw grid background on compiler
        cCtx.fillStyle = '#ffffff';
        cCtx.fillRect(0, 0, comp.width, comp.height);
        cCtx.strokeStyle = '#e0e0e0';
        cCtx.lineWidth = 1;
        for (let x = 0; x <= comp.width; x += 40) { cCtx.beginPath(); cCtx.moveTo(x, 0); cCtx.lineTo(x, comp.height); cCtx.stroke(); }
        for (let y = 0; y <= comp.height; y += 40) { cCtx.beginPath(); cCtx.moveTo(0, y); cCtx.lineTo(comp.width, y); cCtx.stroke(); }

        // Draw photo overlays directly from React state (never relies on fragile DOM queries!)
        const promises = galleryPhotos.map(photo => {
            return new Promise((resolve) => {
                const px = (photo.pos?.x !== undefined ? photo.pos.x : 5) / 100 * comp.width;
                const py = (photo.pos?.y !== undefined ? photo.pos.y : 5) / 100 * comp.height;
                const pw = (photo.size?.w !== undefined ? photo.size.w : 44) / 100 * comp.width;
                const ph = (photo.size?.h !== undefined ? photo.size.h : 44) / 100 * comp.height;
                
                const imgObj = new window.Image();
                imgObj.onload = () => {
                    cCtx.drawImage(imgObj, px, py, pw, ph);
                    resolve();
                };
                imgObj.onerror = () => {
                    resolve(); // Resolve on failure to prevent locking the save process
                };
                imgObj.src = photo.src;
            });
        });

        Promise.all(promises).then(() => {
            // Draw transparent ink drawing layer
            cCtx.drawImage(fc, 0, 0);

            // Get compilation as DataURL
            const compiledDataUrl = comp.toDataURL('image/png');

            onSave({
                canvasImage: compiledDataUrl,
                galleryPhotos: galleryPhotos,
                title: canvasTitle
            });
        });
    };

    const activateTool = (tool) => {
        activeToolRef.current = tool === 'photo' ? 'pen' : tool;
        setActiveTool(tool);
        setSelectedPhotoId(null);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    };

    if (!isOpen) return null;

    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
    const btnBg = isLightMode ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)';
    const btnBorder = isLightMode ? '1px solid rgba(15,23,42,0.15)' : '1px solid rgba(255,255,255,0.15)';
    const btnTextColor = isLightMode ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94A3B8)';
    const toolbarBg = isLightMode ? '#ffffff' : 'var(--surface, #1E293B)';
    const toolbarBorder = isLightMode ? '1px solid #e2e8f0' : '1px solid var(--border, #334155)';
    const dividerColor = isLightMode ? '#cbd5e1' : 'var(--border, #334155)';

    return createPortal(
        <div 
            ref={portalRef}
            className="qtool-sketch-lock"
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
                position: 'fixed', 
                inset: 0, 
                zIndex: 99999, 
                backgroundColor: 'var(--background, #0F172A)', 
                display: 'flex', 
                flexDirection: 'column', 
                touchAction: 'none', 
                color: 'var(--text-main, #E2E8F0)', 
                fontFamily: 'sans-serif',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
                boxSizing: 'border-box',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none'
            }}>
            <style>{`
                .qtool-sketch-lock, .qtool-sketch-lock * {
                    -webkit-user-select: none !important;
                    user-select: none !important;
                    -webkit-touch-callout: none !important;
                }
            `}</style>
            {/* Header / Toolbar (Adaptive styling for high contrast in Light/Dark modes) */}
            <div style={{ flexShrink: 0, padding: '0.75rem 1rem', backgroundColor: toolbarBg, borderBottom: toolbarBorder, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 100 }}>
                {showTitleInput && (
                    <input
                        type="text"
                        placeholder="Skizzentitel eingeben..."
                        value={canvasTitle}
                        onChange={(e) => setCanvasTitle(e.target.value)}
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: 'var(--background, #0F172A)',
                            border: '1px solid var(--border, #334155)',
                            color: 'var(--text-main, #E2E8F0)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            marginRight: '0.75rem',
                            width: '200px'
                        }}
                    />
                )}
                
                {/* Tools */}
                <button onClick={() => { activateTool('pen'); setColor('#000000'); setLineWidth(2); }} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#000000') ? 'var(--primary, #3B82F6)' : btnBg, border: btnBorder, color: (activeTool === 'pen' && color === '#000000') ? 'white' : btnTextColor, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}><Pen size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Stift</span></button>
                <button onClick={() => { activateTool('pen'); setColor('#ef4444'); setLineWidth(3); }} style={{ padding: '0.5rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#ef4444') ? 'rgba(239,68,68,0.2)' : btnBg, border: (activeTool === 'pen' && color === '#ef4444') ? '1px solid #ef4444' : btnBorder, color: '#ef4444', cursor: 'pointer' }} title="Rot"><Pen size={16} /></button>
                <button onClick={() => { activateTool('pen'); setColor('#3b82f6'); setLineWidth(3); }} style={{ padding: '0.5rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#3b82f6') ? 'rgba(59,130,246,0.2)' : btnBg, border: (activeTool === 'pen' && color === '#3b82f6') ? '1px solid #3b82f6' : btnBorder, color: '#3b82f6', cursor: 'pointer' }} title="Blau"><Pen size={16} /></button>
                <button onClick={() => { activateTool('pen'); setColor('#22c55e'); setLineWidth(3); }} style={{ padding: '0.5rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#22c55e') ? 'rgba(34,197,94,0.2)' : btnBg, border: (activeTool === 'pen' && color === '#22c55e') ? '1px solid #22c55e' : btnBorder, color: '#22c55e', cursor: 'pointer' }} title="Grün"><Pen size={16} /></button>
                <button onClick={() => { activateTool('pen'); setColor('#eab308'); setLineWidth(3); }} style={{ padding: '0.5rem', borderRadius: '6px', background: (activeTool === 'pen' && color === '#eab308') ? 'rgba(234,179,8,0.2)' : btnBg, border: (activeTool === 'pen' && color === '#eab308') ? '1px solid #eab308' : btnBorder, color: '#eab308', cursor: 'pointer' }} title="Gelb"><Pen size={16} /></button>
                <button onClick={() => activateTool('eraser')} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: (activeTool === 'eraser') ? (isLightMode ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.15)') : btnBg, border: btnBorder, color: btnTextColor, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}><Eraser size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Radierer</span></button>
                
                <div style={{ width: '1px', height: '24px', background: dividerColor, margin: '0 0.5rem' }} />

                <button onClick={() => setViewport({ scale: 1, x: 0, y: 0 })} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: btnBg, border: btnBorder, color: btnTextColor, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} title="Zoom & Pan zurücksetzen">
                    <Undo size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reset Zoom</span>
                </button>

                <button onClick={() => activateTool('pan')} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: (activeTool === 'pan') ? 'rgba(59,130,246,0.2)' : btnBg, border: btnBorder, color: activeTool === 'pan' ? '#3B82F6' : btnTextColor, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} title="Ausschnitt verschieben (Hand)">
                    <Hand size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hand</span>
                </button>

                <button onClick={() => activateTool('photo')} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: (activeTool === 'photo') ? 'rgba(59,130,246,0.2)' : btnBg, border: btnBorder, color: activeTool === 'photo' ? '#3B82F6' : btnTextColor, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} title="Bilder verschieben">
                    <Image size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Verschieben</span>
                </button>

                <button onClick={() => document.getElementById('sketch-canvas-photo-upload').click()} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: btnBg, border: btnBorder, color: btnTextColor, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}><Camera size={16} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+ Bilder</span></button>
                <input id="sketch-canvas-photo-upload" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
                
                <button onClick={handleUndo} disabled={historyStep <= 0} style={{ padding: '0.5rem', borderRadius: '4px', background: 'transparent', border: btnBorder, color: historyStep <= 0 ? (isLightMode ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)') : btnTextColor, opacity: historyStep <= 0 ? 0.5 : 1, cursor: historyStep <= 0 ? 'default' : 'pointer' }}><Undo size={16} /></button>

                <button onClick={() => { if (window.confirm('Möchten Sie die Skizze und alle Bilder komplett löschen?')) { clearCanvas(); setGalleryPhotos([]); } }} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}><Trash2 size={16} />Löschen</button>
                
                <button onClick={handleSave} style={{ marginLeft: 'auto', padding: '0.5rem 1.25rem', borderRadius: '8px', background: '#10B981', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Save size={16} />Speichern</button>
                <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '8px', background: isLightMode ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.07)', border: btnBorder, color: btnTextColor, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* 3-Layer Canvas Stack (Centered & Aspect-Ratio locked to 960x600 to prevent any stretching/distortion on iPad) */}
            <div ref={viewportRef} style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: '#f1f5f9', 
                padding: '1rem', 
                overflow: 'hidden',
                touchAction: 'none'
            }}
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handleViewportPointerMove}
                onPointerUp={handleViewportPointerUp}
                onPointerCancel={handleViewportPointerUp}
                onWheel={handleViewportWheel}
            >
                <div style={{ 
                    position: 'relative', 
                    width: 'min(calc(100vw - 2rem), calc((100vh - 120px) * 1.6))',
                    height: 'min(calc((100vw - 2rem) / 1.6), calc(100vh - 120px))',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                    transformOrigin: 'center center',
                    touchAction: 'none'
                }}>
                    <canvas ref={gridCanvasRef} width={960} height={600} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', display: 'block' }} />
                    <canvas ref={photoCanvasRef} width={960} height={600} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', display: 'none' }} />
                    <canvas ref={canvasRef} width={960} height={600} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 60, display: 'block', backgroundColor: 'transparent', pointerEvents: 'none', touchAction: 'none' }} />
                    
                    {/* Pointer interaction overlay */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 30, backgroundColor: 'transparent', touchAction: 'none', cursor: isDrawMode ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : (activeTool === 'photo' ? 'move' : 'default') }}
                        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onPointerDown={(e) => {
                            const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
                            if (!isPen) return;
                            e.stopPropagation();
                            e.preventDefault();
                            setSelectedPhotoId(null);
                            startDrawing(e);
                        }}
                        onPointerMove={(e) => {
                            const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
                            if (!isPen) return;
                            e.stopPropagation();
                            e.preventDefault();
                            draw(e);
                        }}
                        onPointerUp={(e) => {
                            const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
                            if (!isPen) return;
                            e.stopPropagation();
                            stopDrawing(e);
                        }}
                        onPointerLeave={(e) => {
                            const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
                            if (!isPen) return;
                            e.stopPropagation();
                            stopDrawing(e);
                        }}
                        onPointerCancel={(e) => {
                            const isPen = e.pointerType === 'pen' || (e.pointerType === 'mouse' && activeTool !== 'pan');
                            if (!isPen) return;
                            e.stopPropagation();
                            stopDrawing(e);
                        }}
                    />

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
                            stylusOnlyMode={stylusOnlyMode}
                        />
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
