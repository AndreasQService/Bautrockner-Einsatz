import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mail, PenLine, Mic, MicOff, Plus, Check, Trash2, RotateCcw, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';

const STORAGE_KEY = 'qtool_inbox_todos';

const loadTodos = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
};

const saveTodos = (todos) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
};

const formatShortDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export default function InboxTodo() {
    const [todos, setTodos] = useState(loadTodos);
    const [activeTab, setActiveTab] = useState('mail'); // 'mail' | 'write' | 'dictate'
    const [inputText, setInputText] = useState('');
    const [senderText, setSenderText] = useState('');
    const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showDone, setShowDone] = useState(false);
    const [lastDeleted, setLastDeleted] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const recognitionRef = useRef(null);
    const apiKey = localStorage.getItem('google_api_key') || import.meta.env.VITE_GOOGLE_API_KEY || '';

    useEffect(() => { saveTodos(todos); }, [todos]);

    // ── AI Analysis ──────────────────────────────────────────────────────────
    const analyzeWithAI = async (text) => {
        if (!text.trim() || !apiKey) return addManual(text);
        setIsAnalyzing(true);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const prompt = `Analysiere diesen Text (E-Mail / Notiz) und extrahiere:
1. Den Namen des Absenders (falls vorhanden, nur EINE Person – derjenige der uns schreibt)
2. Eine Liste konkreter To-Dos / Aufgaben die erledigt werden müssen

Antworte NUR mit validem JSON, kein Markdown:
{
  "absender": "Name oder leer",
  "todos": ["Aufgabe 1", "Aufgabe 2"]
}

TEXT:
${text}`;

            // Dynamic model discovery with fallback (same as EmailImportModalV2)
            let discoveryModels = [];
            try {
                const discRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const discData = await discRes.json();
                if (discData?.models) {
                    discoveryModels = discData.models
                        .map(m => m.name.replace('models/', ''))
                        .filter(n => n.includes('flash') || n.includes('pro'))
                        .filter(n => !n.includes('vision') && !n.includes('experimental'));
                }
            } catch (e) { }

            const baseModels = discoveryModels.length > 0 ? discoveryModels : ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b'];
            const attempts = [];
            baseModels.slice(0, 4).forEach(m => {
                attempts.push({ model: m, version: 'v1beta' });
                attempts.push({ model: m, version: 'v1' });
            });

            let result;
            for (const attempt of attempts) {
                try {
                    const model = genAI.getGenerativeModel({ model: attempt.model }, { apiVersion: attempt.version });
                    result = await model.generateContent(prompt);
                    if (result) break;
                } catch (err) {
                    const msg = err.message || '';
                    if (msg.includes('404') || msg.includes('429') || msg.includes('not found')) continue;
                    throw err;
                }
            }

            if (!result) throw new Error('Kein Modell verfügbar');

            const raw = result.response.text().trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(raw);
            const newTodos = (parsed.todos || []).map(t => ({
                id: Date.now() + Math.random(),
                text: t,
                sender: parsed.absender || senderText || '',
                date: dateText || new Date().toISOString().slice(0, 10),
                done: false,
                source: 'ai'
            }));
            if (newTodos.length > 0) {
                setTodos(prev => [...newTodos, ...prev]);
                setInputText('');
                setSenderText(parsed.absender || senderText || '');
            }
        } catch (e) {
            console.error('AI Todo error:', e);
            addManual(text);
        }
        setIsAnalyzing(false);
    };

    // ── Manual Add ───────────────────────────────────────────────────────────
    const addManual = (text) => {
        if (!text.trim()) return;
        setTodos(prev => [{
            id: Date.now(),
            text: text.trim(),
            sender: senderText.trim(),
            date: dateText || new Date().toISOString().slice(0, 10),
            done: false,
            source: 'manual'
        }, ...prev]);
        setInputText('');
        setSenderText('');
    };

    const handleAdd = () => {
        if (activeTab === 'mail') analyzeWithAI(inputText);
        else addManual(inputText);
    };

    // ── Todo Actions ─────────────────────────────────────────────────────────
    const toggleDone = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

    const deleteTodo = (id) => {
        const todo = todos.find(t => t.id === id);
        setLastDeleted(todo);
        setTodos(prev => prev.filter(t => t.id !== id));
        setTimeout(() => setLastDeleted(null), 8000);
    };

    const undoDelete = () => {
        if (!lastDeleted) return;
        setTodos(prev => [lastDeleted, ...prev]);
        setLastDeleted(null);
    };

    // ── Voice Input ──────────────────────────────────────────────────────────
    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert('Spracheingabe nicht unterstützt');
        const rec = new SpeechRecognition();
        rec.lang = 'de-CH';
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setInputText(prev => prev ? prev + ' ' + transcript : transcript);
        };
        rec.onend = () => setIsListening(false);
        rec.start();
        recognitionRef.current = rec;
        setIsListening(true);
    };

    // ── Drag & Drop ──────────────────────────────────────────────────────────
    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const text = e.dataTransfer.getData('text/plain');
        if (text) setInputText(text);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    const openTodos = todos.filter(t => !t.done);
    const doneTodos = todos.filter(t => t.done);

    const tabStyle = (tab) => ({
        padding: '0.4rem 0.9rem',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.82rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: activeTab === tab ? 'var(--q-primary)' : 'transparent',
        color: activeTab === tab ? '#fff' : 'var(--text-muted)',
        transition: 'all 0.15s'
    });

    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '1.2rem 1.4rem',
            marginBottom: '1.5rem',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Mail size={17} style={{ color: 'var(--q-primary)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Eingang & To-Dos</span>
                    {openTodos.length > 0 && (
                        <span style={{
                            background: '#ef4444', color: '#fff', borderRadius: '99px',
                            fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', minWidth: '20px', textAlign: 'center'
                        }}>{openTodos.length}</span>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--background)', borderRadius: '10px', padding: '0.25rem' }}>
                    <button style={tabStyle('mail')} onClick={() => setActiveTab('mail')}><Mail size={13} />Mail</button>
                    <button style={tabStyle('write')} onClick={() => setActiveTab('write')}><PenLine size={13} />Schreiben</button>
                    <button style={tabStyle('dictate')} onClick={() => setActiveTab('dictate')}><Mic size={13} />Diktieren</button>
                </div>
            </div>

            {/* Input Area */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        style={{
                            position: 'relative',
                            border: isDragging ? '2px dashed var(--q-primary)' : '1px solid var(--border)',
                            borderRadius: '8px',
                            background: isDragging ? 'rgba(15,110,163,0.05)' : 'var(--background)',
                            transition: 'all 0.15s'
                        }}
                    >
                        <textarea
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder={
                                activeTab === 'mail' ? 'E-Mail Text hier einfügen oder ablegen → KI extrahiert To-Dos automatisch…' :
                                activeTab === 'write' ? 'To-Do manuell eingeben…' :
                                'Auf Mikrofon klicken und sprechen…'
                            }
                            rows={3}
                            style={{
                                width: '100%', border: 'none', background: 'transparent',
                                padding: '0.6rem 0.75rem', resize: 'vertical', minHeight: '72px',
                                fontSize: '0.88rem', color: 'var(--text-main)', outline: 'none',
                                fontFamily: 'inherit', boxSizing: 'border-box'
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAdd(); }}
                        />
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                            className="form-input"
                            placeholder="Absender"
                            value={senderText}
                            onChange={e => setSenderText(e.target.value)}
                            style={{ flex: 2, fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
                        />
                        <input
                            type="date"
                            className="form-input"
                            value={dateText}
                            onChange={e => setDateText(e.target.value)}
                            style={{ flex: 1, fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
                        />
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                        onClick={handleAdd}
                        disabled={!inputText.trim() || isAnalyzing}
                        style={{
                            padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none',
                            background: 'var(--q-primary)', color: '#fff', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                            opacity: (!inputText.trim() || isAnalyzing) ? 0.5 : 1, whiteSpace: 'nowrap'
                        }}
                    >
                        {isAnalyzing ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                        {activeTab === 'mail' ? 'KI analysieren' : 'Hinzufügen'}
                    </button>

                    {activeTab === 'dictate' && (
                        <button
                            onClick={toggleVoice}
                            style={{
                                padding: '0.5rem', borderRadius: '8px',
                                border: `2px solid ${isListening ? '#ef4444' : 'var(--border)'}`,
                                background: isListening ? 'rgba(239,68,68,0.1)' : 'transparent',
                                color: isListening ? '#ef4444' : 'var(--text-muted)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: isListening ? 'pulse 1.5s infinite' : 'none'
                            }}
                            title={isListening ? 'Stop' : 'Diktieren starten'}
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                    )}

                    {inputText && (
                        <button
                            onClick={() => setInputText('')}
                            style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                            title="Leeren"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Undo Bar */}
            {lastDeleted && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: '8px', padding: '0.4rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.82rem'
                }}>
                    <span style={{ color: '#92400e' }}>To-Do gelöscht: <b>{lastDeleted.text.slice(0, 50)}…</b></span>
                    <button onClick={undoDelete} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem', border: 'none',
                        background: '#f59e0b', color: '#fff', borderRadius: '6px', padding: '0.25rem 0.6rem',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem'
                    }}>
                        <RotateCcw size={12} /> Rückgängig
                    </button>
                </div>
            )}

            {/* Open Todos */}
            {openTodos.length === 0 && doneTodos.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                    Keine offenen To-Dos
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {openTodos.map(todo => (
                    <TodoItem key={todo.id} todo={todo} onToggle={toggleDone} onDelete={deleteTodo} />
                ))}
            </div>

            {/* Done Todos Toggle */}
            {doneTodos.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                    <button
                        onClick={() => setShowDone(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem 0'
                        }}
                    >
                        {showDone ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {doneTodos.length} erledigte To-Do{doneTodos.length !== 1 ? 's' : ''}
                    </button>

                    {showDone && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem', opacity: 0.6 }}>
                            {doneTodos.map(todo => (
                                <TodoItem key={todo.id} todo={todo} onToggle={toggleDone} onDelete={deleteTodo} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TodoItem({ todo, onToggle, onDelete }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
            padding: '0.5rem 0.75rem',
            background: todo.done ? 'transparent' : 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
        }}>
            <button
                onClick={() => onToggle(todo.id)}
                style={{
                    width: '18px', height: '18px', minWidth: '18px', borderRadius: '5px',
                    border: `2px solid ${todo.done ? '#10b981' : 'var(--border)'}`,
                    background: todo.done ? '#10b981' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', marginTop: '2px'
                }}
            >
                {todo.done && <Check size={10} color="#fff" strokeWidth={3} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.88rem', color: 'var(--text-main)',
                    textDecoration: todo.done ? 'line-through' : 'none',
                    wordBreak: 'break-word'
                }}>
                    {todo.text}
                </div>
                {(todo.sender || todo.date) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '0.75rem' }}>
                        {todo.sender && <span>👤 {todo.sender}</span>}
                        {todo.date && <span>📅 {formatShortDate(todo.date)}</span>}
                        {todo.source === 'ai' && <span style={{ color: 'var(--q-primary)' }}>✨ KI</span>}
                    </div>
                )}
            </div>

            <button
                onClick={() => onDelete(todo.id)}
                style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: '2px', borderRadius: '4px', opacity: 0.5,
                    display: 'flex', alignItems: 'center'
                }}
                title="Löschen"
            >
                <Trash2 size={13} />
            </button>
        </div>
    );
}
