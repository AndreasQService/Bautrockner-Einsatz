import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, X, PenTool, Circle as CircleIcon, Undo, Eraser } from 'lucide-react';

const ImageEditor = ({ image, onSave, onCancel }) => {
    const canvasRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const [context, setContext] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen'); // 'pen', 'circle', 'eraser'
    const [color, setColor] = useState('#EF4444'); // Red by default
    const [lineWidth, setLineWidth] = useState(5);
    const [history, setHistory] = useState([]);
    const startPos = useRef({ x: 0, y: 0 });
    const snapshot = useRef(null);

    useEffect(() => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        setContext(ctx);

        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.src = image.preview;

        img.onload = () => {
            // Give the browser a moment to settle
            setTimeout(() => {
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                const maxSize = 2000;
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

                // Setup Draw Canvas
                canvas.width = width;
                canvas.height = height;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.clearRect(0, 0, width, height);

                // Setup Background Canvas
                if (bgCanvasRef.current) {
                    const bgCanvas = bgCanvasRef.current;
                    bgCanvas.width = width;
                    bgCanvas.height = height;
                    const bgCtx = bgCanvas.getContext('2d');
                    bgCtx.drawImage(img, 0, 0, width, height);
                }

                const initialState = ctx.getImageData(0, 0, width, height);
                setHistory([initialState]);
            }, 50);
        };
    }, [image]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // PointerEvents (e.clientX) work for both mouse and touch
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        if (!context) return;
        // Prevent default to stop scrolling/gestures
        if (e.cancelable) e.preventDefault();

        const coords = getCoordinates(e);
        startPos.current = coords;
        setIsDrawing(true);

        snapshot.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (tool === 'pen' || tool === 'eraser') {
            context.beginPath();
            context.strokeStyle = color;
            context.lineWidth = tool === 'eraser' ? 30 : lineWidth;
            context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
            context.moveTo(coords.x, coords.y);
        }
    };

    const draw = (e) => {
        if (!isDrawing || !context) return;
        if (e.cancelable) e.preventDefault();

        const coords = getCoordinates(e);

        if (tool === 'pen' || tool === 'eraser') {
            context.lineTo(coords.x, coords.y);
            context.stroke();
        } else if (tool === 'circle') {
            if (snapshot.current) {
                context.putImageData(snapshot.current, 0, 0);
            }
            context.beginPath();
            context.strokeStyle = color;
            context.lineWidth = lineWidth;
            const radius = Math.sqrt(Math.pow(coords.x - startPos.current.x, 2) + Math.pow(coords.y - startPos.current.y, 2));
            context.arc(startPos.current.x, startPos.current.y, radius, 0, 2 * Math.PI);
            context.stroke();
        }
    };

    const stopDrawing = (e) => {
        if (!context) return;
        if (isDrawing) {
            if (tool === 'pen' || tool === 'eraser') {
                context.closePath();
            }
            setIsDrawing(false);
            const newState = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            setHistory(prev => [...prev, newState]);
        }
    };

    const handleUndo = () => {
        if (history.length <= 1 || !context) return;
        const newHistory = history.slice(0, -1);
        const previousState = newHistory[newHistory.length - 1];
        context.putImageData(previousState, 0, 0);
        setHistory(newHistory);
    };

    const handleSave = () => {
        if (!canvasRef.current) return;

        // Merge background image and canvas
        const mergeCanvas = document.createElement('canvas');
        const canvas = canvasRef.current;
        mergeCanvas.width = canvas.width;
        mergeCanvas.height = canvas.height;
        const mergeCtx = mergeCanvas.getContext('2d');

        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.src = image.preview;

        img.onload = () => {
            mergeCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
            mergeCtx.drawImage(canvas, 0, 0);
            const dataUrl = mergeCanvas.toDataURL('image/jpeg', 0.9);
            onSave(dataUrl);
        };
    };

    const editorContent = (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000',
            zIndex: 9999999,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', touchAction: 'none'
        }}>
            {/* Background Blur Layer */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${image.preview})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'blur(30px) brightness(0.2)',
                opacity: 0.8, zIndex: 0
            }} />

            {/* Header */}
            <div style={{
                position: 'relative', zIndex: 10,
                padding: 'calc(10px + env(safe-area-inset-top)) 1rem 1rem',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: '12px' }}>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); setTool('pen'); }}
                        style={{ padding: '0.5rem', borderRadius: '8px', border: 'none', background: tool === 'pen' ? '#3B82F6' : 'transparent', color: 'white', cursor: 'pointer' }}
                        title="Stift"
                    >
                        <PenTool size={20} />
                    </button>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); setTool('circle'); }}
                        style={{ padding: '0.5rem', borderRadius: '8px', border: 'none', background: tool === 'circle' ? '#3B82F6' : 'transparent', color: 'white', cursor: 'pointer' }}
                        title="Kreis"
                    >
                        <CircleIcon size={20} />
                    </button>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); setTool('eraser'); }}
                        style={{ padding: '0.5rem', borderRadius: '8px', border: 'none', background: tool === 'eraser' ? '#3B82F6' : 'transparent', color: 'white', cursor: 'pointer' }}
                        title="Radiergummi"
                    >
                        <Eraser size={20} />
                    </button>
                    <button
                        onPointerDown={(e) => { e.stopPropagation(); handleUndo(); }}
                        disabled={history.length <= 1}
                        style={{ padding: '0.5rem', borderRadius: '8px', border: 'none', background: 'transparent', color: history.length > 1 ? 'white' : 'rgba(255,255,255,0.2)', cursor: 'pointer' }}
                        title="Rückgängig"
                    >
                        <Undo size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '12px' }}>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '32px', height: '32px', border: '2px solid white', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', padding: 0 }} />
                </div>
            </div>

            {/* Canvas Container */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                overflow: 'hidden',
                zIndex: 5
            }}>
                <div style={{
                    position: 'relative',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                    backgroundColor: '#000',
                    lineHeight: 0,
                    width: 'fit-content',
                    height: 'fit-content'
                }}>
                    {/* Background Layer: The Photo */}
                    <canvas
                        ref={bgCanvasRef}
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '70vh',
                            width: 'auto',
                            height: 'auto',
                            display: 'block'
                        }}
                    />

                    {/* Drawing Layer: Transparent Overlay */}
                    <canvas
                        ref={canvasRef}
                        onPointerDown={startDrawing}
                        onPointerMove={draw}
                        onPointerUp={stopDrawing}
                        onPointerLeave={stopDrawing}
                        onPointerCancel={stopDrawing}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            touchAction: 'none',
                            cursor: 'crosshair',
                            zIndex: 6
                        }}
                    />
                </div>
            </div>

            {/* Footer */}
            <div style={{
                position: 'relative', zIndex: 10,
                padding: '1rem 1.5rem calc(1rem + env(safe-area-inset-bottom))',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <button onClick={onCancel} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <X size={18} /> Abbrechen
                </button>
                <button onClick={handleSave} style={{ padding: '0.75rem 2rem', borderRadius: '10px', border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <Save size={18} /> Speichern
                </button>
            </div>
        </div>
    );

    return createPortal(editorContent, document.body);
};

export default ImageEditor;
