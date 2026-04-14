import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { swissPLZ } from '../data/swiss_plz';

/**
 * PlzOrtInput — Wiederverwendbare PLZ + Ort Eingabe mit Autofill
 *
 * Props:
 *   plz        {string}   — aktueller PLZ-Wert
 *   ort        {string}   — aktueller Ort-Wert
 *   onChangePlz(val)      — Callback wenn PLZ sich ändert
 *   onChangeOrt(val)      — Callback wenn Ort sich ändert
 *   onAutofill(plz, ort)  — Callback wenn Autofill ausgelöst wird (beide Felder)
 *   labelPlz   {string}   — Label für PLZ-Feld (default: "PLZ")
 *   labelOrt   {string}   — Label für Ort-Feld (default: "Ort")
 *   inputStyle {object}   — Extra-Styles für Inputs
 *   labelStyle {object}   — Extra-Styles für Labels
 *   gap        {string}   — Gap zwischen PLZ & Ort (default: "0.5rem")
 *   plzWidth   {string}   — Breite des PLZ-Feldes (default: "90px")
 *   dark       {boolean}  — Dunkles Dropdown (default: true)
 */
const PlzOrtInput = ({
    plz = '',
    ort = '',
    onChangePlz,
    onChangeOrt,
    onAutofill,
    labelPlz = 'PLZ',
    labelOrt = 'Ort',
    inputStyle = {},
    labelStyle = {},
    gap = '0.5rem',
    plzWidth = '90px',
    dark = true,
}) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSug, setShowSug]         = useState(false);
    const [activeIdx, setActiveIdx]     = useState(-1);
    const [mode, setMode]               = useState('plz');
    const [dropPos, setDropPos]         = useState({ top: 0, left: 0, width: 220 });
    const containerRef                  = useRef(null);
    const uniqueId                      = useRef(`plz-${Math.random().toString(36).slice(2)}`).current;

    // Click outside → close
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSug(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Auto-fill on mount or when values change externally:
    // If Ort is set but PLZ is empty → find PLZ
    // If PLZ is set but Ort is empty → find Ort
    useEffect(() => {
        if (ort && !plz) {
            const match = swissPLZ.find(e => e.city.toLowerCase() === ort.toLowerCase().trim());
            if (match) {
                onAutofill ? onAutofill(match.plz, match.city) : onChangePlz && onChangePlz(match.plz);
            }
        } else if (plz && !ort) {
            const match = swissPLZ.find(e => e.plz === plz.trim());
            if (match) {
                onAutofill ? onAutofill(match.plz, match.city) : onChangeOrt && onChangeOrt(match.city);
            }
        }
        // Only run on mount or when the values flip from empty↔filled
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const search = (val, searchMode) => {
        if (!val || val.length < 2) { setSuggestions([]); setShowSug(false); return; }
        const v = val.toLowerCase().trim();
        let results;
        if (searchMode === 'plz') {
            results = swissPLZ.filter(e => e.plz.startsWith(v)).slice(0, 8);
        } else {
            results = swissPLZ.filter(e => e.city.toLowerCase().startsWith(v)).slice(0, 8);
        }
        // Calculate dropdown position from container bounding rect
        if (containerRef.current && results.length > 0) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropPos({
                top:   rect.bottom + window.scrollY + 4,
                left:  rect.left  + window.scrollX,
                width: Math.max(rect.width, 220),
            });
        }
        setSuggestions(results);
        setShowSug(results.length > 0);
        setActiveIdx(-1);
    };

    const apply = (entry) => {
        setShowSug(false);
        setSuggestions([]);
        if (onAutofill) {
            onAutofill(entry.plz, entry.city);
        } else {
            onChangePlz && onChangePlz(entry.plz);
            onChangeOrt && onChangeOrt(entry.city);
        }
    };

    const handleKeyDown = (e) => {
        if (!showSug || suggestions.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); apply(suggestions[activeIdx]); }
        if (e.key === 'Escape') { setShowSug(false); }
    };

    const dropBg  = dark ? '#1A2332' : '#ffffff';
    const dropFg  = dark ? '#CBD5E1' : '#1e293b';
    const dropHov = dark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)';

    const labelCombined = { fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600, ...labelStyle };
    const inputCombined = { width: '100%', ...inputStyle };

    return (
        <div ref={containerRef} style={{ display: 'flex', gap, alignItems: 'flex-end', position: 'relative' }}>

            {/* PLZ */}
            <div style={{ width: plzWidth, flexShrink: 0 }}>
                <label style={labelCombined}>{labelPlz}</label>
                <input
                    className="form-input"
                    placeholder="PLZ"
                    value={plz}
                    maxLength={4}
                    inputMode="numeric"
                    style={inputCombined}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChangePlz && onChangePlz(val);
                        setMode('plz');
                        // Direct match → autofill immediately
                        const exact = swissPLZ.find(entry => entry.plz === val.trim());
                        if (exact) {
                            setShowSug(false);
                            onChangeOrt && onChangeOrt(exact.city);
                            onAutofill && onAutofill(exact.plz, exact.city);
                        } else {
                            search(val, 'plz');
                        }
                    }}
                    onFocus={() => { if (plz.length >= 2) search(plz, 'plz'); }}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    list={uniqueId}
                />
                {/* Datalist fallback for browsers */}
                <datalist id={uniqueId}>
                    {swissPLZ.map((e, i) => (
                        <option key={i} value={e.plz}>{e.city}</option>
                    ))}
                </datalist>
            </div>

            {/* Ort */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <label style={labelCombined}>{labelOrt}</label>
                <input
                    className="form-input"
                    placeholder="Ort"
                    value={ort}
                    style={inputCombined}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChangeOrt && onChangeOrt(val);
                        setMode('ort');
                        // Exact match (case-insensitive) → autofill PLZ immediately
                        const exact = swissPLZ.find(entry => entry.city.toLowerCase() === val.toLowerCase().trim());
                        if (exact) {
                            setShowSug(false);
                            onAutofill ? onAutofill(exact.plz, exact.city) : onChangePlz && onChangePlz(exact.plz);
                        } else {
                            search(val, 'ort');
                        }
                    }}
                    onFocus={() => { if (ort.length >= 2) search(ort, 'ort'); }}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                />
            </div>

            {/* Dropdown — portal into body so it's never clipped */}
            {showSug && suggestions.length > 0 && createPortal(
                <div style={{
                    position: 'fixed',
                    top:  dropPos.top,
                    left: dropPos.left,
                    width: dropPos.width,
                    zIndex: 999999,
                    backgroundColor: dropBg,
                    border: '1px solid rgba(59,130,246,0.35)',
                    borderRadius: '10px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                }}>
                    {suggestions.map((entry, i) => (
                        <div
                            key={i}
                            onMouseDown={() => apply(entry)}
                            style={{
                                padding: '0.5rem 0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'center',
                                backgroundColor: i === activeIdx ? dropHov : 'transparent',
                                color: dropFg,
                                fontSize: '0.82rem',
                                transition: 'background 0.1s',
                                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            }}
                            onMouseEnter={() => setActiveIdx(i)}
                        >
                            <span style={{ fontWeight: 700, color: '#3B82F6', minWidth: 38 }}>{entry.plz}</span>
                            <span>{entry.city}</span>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default PlzOrtInput;
