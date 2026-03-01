import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, X, PenTool, Circle as CircleIcon, Undo, Eraser, Loader2, Mic } from 'lucide-react';

const ImageEditor = ({ image, onSave, onCancel }) => {
    const canvasRef = useRef(null);            // Stable Drawing Layer
    const previewCanvasRef = useRef(null);     // Active Drawing Layer (Realtime)
    const bgCanvasRef = useRef(null);

    // Context Caching
    const ctxRef = useRef(null);
    const pCtxRef = useRef(null);
    const bgCtxRef = useRef(null);

    // Draw Throttling
    const rafRef = useRef(null);
    const lastCoords = useRef(null);

    const [tool, setTool] = useState('pen'); // 'pen', 'circle', 'eraser'
    const [color, setColor] = useState('#EF4444'); // Red by default
    const [lineWidth, setLineWidth] = useState(5);
    const [history, setHistory] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [localDescription, setLocalDescription] = useState(image?.description || '');
    const [isRecording, setIsRecording] = useState(false);

    const startPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (image) {
            // Lock body scroll ONLY - DO NOT SCROLL TO TOP. It's too jarring.
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [image]);

    useEffect(() => {
        if (!image || !image.preview) {
            console.error("Editor opened without valid image preview.");
            setIsInitializing(false);
            return;
        }

        const img = new window.Image();
        // Skip crossOrigin for data URLs to avoid potential CORS issues
        if (image.preview.startsWith('data:')) {
            // Already a data URL, no CORS needed
        } else {
            img.crossOrigin = 'Anonymous';
        }

        img.onload = () => {
            const initTask = () => {
                if (!canvasRef.current || !bgCanvasRef.current || !previewCanvasRef.current) {
                    setTimeout(initTask, 30); // Robust retry for refs
                    return;
                }

                let width = img.naturalWidth;
                let height = img.naturalHeight;

                const maxSize = 1200;
                if (width > maxSize || height > maxSize) {
                    const ratio = width / height;
                    if (width > height) {
                        width = maxSize;
                        height = maxSize / ratio;
                    } else {
                        height = maxSize;
                        width = maxSize * ratio;
                    }
                }

                // Setup Layers
                bgCanvasRef.current.width = width;
                bgCanvasRef.current.height = height;
                bgCtxRef.current = bgCanvasRef.current.getContext('2d', { alpha: false });
                bgCtxRef.current.drawImage(img, 0, 0, width, height);

                canvasRef.current.width = width;
                canvasRef.current.height = height;
                ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
                ctxRef.current.lineCap = 'round';
                ctxRef.current.lineJoin = 'round';

                previewCanvasRef.current.width = width;
                previewCanvasRef.current.height = height;
                pCtxRef.current = previewCanvasRef.current.getContext('2d');
                pCtxRef.current.lineCap = 'round';
                pCtxRef.current.lineJoin = 'round';

                setHistory([null]);
                setIsInitializing(false);
            };

            // Use a stable, non-idle dependent timeout for critical UI initialization
            setTimeout(initTask, 10);
        };

        img.onerror = () => {
            console.error("Failed to load image for editor", image.preview);
            setIsInitializing(false); // Fail gracefully so user isn't stuck
            alert("Fehler beim Laden des Bildes.");
        };

        img.src = image.preview;
    }, [image]);

    const getCoordinates = (e) => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        if (e.cancelable) e.preventDefault();
        const coords = getCoordinates(e);
        startPos.current = coords;
        lastCoords.current = coords;
        setIsDrawing(true);

        const pCtx = pCtxRef.current;
        pCtx.strokeStyle = color;
        pCtx.lineWidth = tool === 'eraser' ? 30 : lineWidth;
        pCtx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

        if (tool === 'pen') {
            pCtx.beginPath();
            pCtx.moveTo(coords.x, coords.y);
        }
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();

        lastCoords.current = getCoordinates(e);

        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(renderStroke);
        }
    };

    const renderStroke = () => {
        rafRef.current = null;
        if (!isDrawing || !lastCoords.current) return;

        const coords = lastCoords.current;
        const pCtx = pCtxRef.current;
        const ctx = ctxRef.current;

        if (tool === 'pen') {
            pCtx.lineTo(coords.x, coords.y);
            pCtx.stroke();
        } else if (tool === 'circle') {
            pCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
            pCtx.beginPath();
            const radius = Math.sqrt(Math.pow(coords.x - startPos.current.x, 2) + Math.pow(coords.y - startPos.current.y, 2));
            pCtx.arc(startPos.current.x, startPos.current.y, radius, 0, 2 * Math.PI);
            pCtx.stroke();
        } else if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 30;
            ctx.beginPath();
            ctx.moveTo(startPos.current.x, startPos.current.y);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            startPos.current = coords;
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;

        const ctx = ctxRef.current;
        const pCanvas = previewCanvasRef.current;
        const pCtx = pCtxRef.current;

        if (tool !== 'eraser') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(pCanvas, 0, 0);
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
        }

        // Extremely limited history to prevent memory hang on tablets
        const newState = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHistory(prev => {
            const next = [...prev, newState];
            return next.length > 5 ? next.slice(-5) : next;
        });
    };

    const handleUndo = () => {
        if (history.length <= 1) return;
        const ctx = ctxRef.current;
        const newHistory = history.slice(0, -1);
        const previousState = newHistory[newHistory.length - 1];

        if (previousState === null) {
            // Initial state: clear the canvas
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        } else {
            ctx.putImageData(previousState, 0, 0);
        }
        setHistory(newHistory);
    };

    const handleSave = () => {
        if (!canvasRef.current || !bgCanvasRef.current) return;

        const mergeCanvas = document.createElement('canvas');
        const width = bgCanvasRef.current.width;
        const height = bgCanvasRef.current.height;
        mergeCanvas.width = width;
        mergeCanvas.height = height;
        const mergeCtx = mergeCanvas.getContext('2d', { alpha: false });

        mergeCtx.drawImage(bgCanvasRef.current, 0, 0);
        mergeCtx.drawImage(canvasRef.current, 0, 0);

        const dataUrl = mergeCanvas.toDataURL('image/jpeg', 0.82);
        onSave(dataUrl, localDescription);
    };

    const startVoice = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setLocalDescription(prev => prev ? `${prev} ${transcript}` : transcript);
        };
        recognition.start();
    };

    const editorBody = (
        <div style={{
            position: 'fixed',
            inset: 0, // Works better than top/left/width/height on some browsers
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            zIndex: 99999999, // Absolute max
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            touchAction: 'none'
        }}>
            {/* Header / Tools */}
            <div style={{
                flexShrink: 0,
                padding: '0.75rem 1rem',
                backgroundColor: '#1E293B',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
            }}>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.4rem' }}>
                    <X size={28} />
                </button>

                <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: '12px' }}>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); setTool('pen'); }}
                        style={{ padding: '0.6rem', borderRadius: '8px', border: 'none', background: tool === 'pen' ? '#3B82F6' : 'transparent', color: 'white', cursor: 'pointer' }}
                    >
                        <PenTool size={22} />
                    </button>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); setTool('circle'); }}
                        style={{ padding: '0.6rem', borderRadius: '8px', border: 'none', background: tool === 'circle' ? '#3B82F6' : 'transparent', color: 'white', cursor: 'pointer' }}
                    >
                        <CircleIcon size={22} />
                    </button>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); setTool('eraser'); }}
                        style={{ padding: '0.6rem', borderRadius: '8px', border: 'none', background: tool === 'eraser' ? '#3B82F6' : 'transparent', color: 'white', cursor: 'pointer' }}
                    >
                        <Eraser size={22} />
                    </button>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); handleUndo(); }}
                        disabled={history.length <= 1}
                        style={{ padding: '0.6rem', borderRadius: '8px', border: 'none', background: 'transparent', color: history.length > 1 ? 'white' : 'rgba(255,255,255,0.2)', cursor: 'pointer' }}
                    >
                        <Undo size={22} />
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.6rem', borderRadius: '12px' }}>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '28px', height: '28px', border: '2px solid white', borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
                </div>
            </div>

            {/* Viewport */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', overflow: 'hidden', position: 'relative' }}>
                    {isInitializing && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 20 }}>
                            <Loader2 className="animate-spin" size={40} color="#3B82F6" />
                            <p style={{ color: 'white', marginTop: '1rem', fontWeight: 600 }}>Editor wird geladen...</p>
                        </div>
                    )}
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isInitializing ? 0 : 1
                    }}>
                        <div style={{
                            position: 'relative',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                            maxWidth: '96%',
                            maxHeight: '96%',
                            aspectRatio: bgCanvasRef.current ? `${bgCanvasRef.current.width}/${bgCanvasRef.current.height}` : 'auto'
                        }}>
                            <canvas ref={bgCanvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 6, pointerEvents: 'none' }} />
                            <canvas
                                ref={previewCanvasRef}
                                onPointerDown={startDrawing}
                                onPointerMove={draw}
                                onPointerUp={stopDrawing}
                                onPointerLeave={stopDrawing}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 7, touchAction: 'none', cursor: 'crosshair' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Integrated Description Area */}
                <div style={{
                    flexShrink: 0,
                    backgroundColor: '#1E293B',
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600 }}>BESCHREIBUNG</span>
                        <button
                            onPointerDown={(e) => { e.stopPropagation(); startVoice(); }}
                            style={{ background: isRecording ? '#EF4444' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '20px', padding: '0.2rem 0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            <Mic size={14} className={isRecording ? 'animate-pulse' : ''} />
                            {isRecording ? 'Hört zu...' : 'Sprechen'}
                        </button>
                    </div>
                    <textarea
                        value={localDescription}
                        onChange={(e) => setLocalDescription(e.target.value)}
                        placeholder="Hier Beschreibung eingeben oder oben sprechen..."
                        style={{
                            width: '100%',
                            backgroundColor: '#0F172A',
                            border: '1px solid #334155',
                            color: 'white',
                            borderRadius: '8px',
                            padding: '0.6rem',
                            fontSize: '0.9rem',
                            minHeight: '60px',
                            maxHeight: '120px',
                            resize: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Footer */}
            <div style={{
                flexShrink: 0,
                padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))',
                backgroundColor: '#1E293B',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
            }}>
                <button onClick={handleSave} style={{ padding: '0.75rem 2.5rem', borderRadius: '12px', border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                    <Save size={24} /> Speichern
                </button>
            </div>
        </div>
    );

    return createPortal(editorBody, document.body);
};

export default ImageEditor;
