import React, { useState, useEffect } from "react";
// (Icon-Import für das UI – optional, kann auch durch Text ersetzt werden)
import { Check, X, AlertTriangle } from "lucide-react";

/**
 * AiSuggestionsPanel
 * 
 * Zeigt die extrahierten KI-Vorschläge an und erlaubt dem Nutzer,
 * Felder einzeln oder alle auf einmal zu übernehmen.
 * 
 * Props:
 *  - extractedData: Das Objekt mit den extrahierten Daten (z.B. { street: "Musterstr. 1", zip: "8000", ... })
 *  - currentFormData: Die aktuellen Formulardaten (zum Vergleich)
 *  - onApplyField: Callback (fieldName, value) -> wird aufgerufen, wenn ein einzelnes Feld übernommen wird
 *  - onApplyAll: Callback (allData) -> wird aufgerufen, wenn "Alle übernehmen" geklickt wird
 *  - onDismiss: Callback () -> Panel schließen/verwerfen
 */
export default function AiSuggestionsPanel({
    extractedData,
    currentFormData,
    onApplyField,
    onApplyAll,
    onDismiss
}) {
    if (!extractedData) return null;

    // Liste der Felder, die wir anzeigen/vergleichen wollen
    // Key = Feldname im extractedData UND im formData
    // Label = Anzeige für den Nutzer
    const fieldMapping = [
        { key: "projectTitle", label: "Projekttitel" },
        { key: "client", label: "Auftraggeber" },
        { key: "street", label: "Strasse" },
        { key: "zip", label: "PLZ" },
        { key: "city", label: "Ort" },
        { key: "description", label: "Schadenbeschreibung" },
    ];

    // Helper: Prüft, ob der Wert neu/anders ist als im Formular
    const isDifferent = (key) => {
        const newVal = extractedData[key];
        const oldVal = currentFormData[key];
        // Einfacher String-Vergleich (trimmen zur Sicherheit)
        return (newVal || "").toString().trim() !== (oldVal || "").toString().trim();
    };

    return (
        <div style={{
            marginTop: "1.25rem",
            padding: "1.25rem",
            backgroundColor: "var(--color-success-bg)",
            border: "1.5px solid #A8D5B1",
            borderRadius: "8px",
            color: "var(--color-text-primary)",
            boxShadow: 'var(--shadow-sm)'
        }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    ✨ KI-Vorschläge gefunden
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={() => onApplyAll(extractedData)}
                        className="btn btn-primary"
                        style={{
                            backgroundColor: "#16a34a",
                            border: "none",
                            padding: "0 1.25rem",
                            height: '32px'
                        }}
                    >
                        Alle übernehmen
                    </button>
                    <button
                        onClick={onDismiss}
                        className="btn btn-outline"
                        style={{
                            padding: "0",
                            width: '32px',
                            height: '32px',
                            color: "#dc2626",
                            borderColor: "#fca5a5"
                        }}
                        title="Vorschläge verwerfen"
                    >

                        <X size={20} />
                    </button>
                </div>
            </div>

            <div style={{ display: "grid", gap: "0.5rem" }}>
                {fieldMapping.map(({ key, label }) => {
                    const value = extractedData[key];
                    if (!value) return null; // Wenn KI nichts für dieses Feld hat, nicht anzeigen

                    const different = isDifferent(key);

                    return (
                        <div key={key} style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            padding: "0.6rem 0.8rem",
                            backgroundColor: different ? "var(--surface)" : "rgba(255,255,255,0.4)",
                            border: "1px solid",
                            borderColor: different ? "#86efac" : "var(--color-border)",
                            borderRadius: "4px",
                            transition: 'all 0.1s ease'
                        }}>

                            <div style={{ width: "140px", fontWeight: 600, fontSize: "0.9rem" }}>{label}:</div>

                            <div style={{ flex: 1, fontSize: "0.9rem", color: "#374151" }}>
                                {value}
                                {/* Optional: Zeige "ALT" Wert, wenn unterschiedlich */}
                                {different && currentFormData[key] && (
                                    <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" }}>
                                        (Aktuell: {currentFormData[key]})
                                    </span>
                                )}
                            </div>

                            {different ? (
                                <button
                                    onClick={() => onApplyField(key, value)}
                                    className="btn btn-outline"
                                    style={{
                                        padding: "0 0.75rem",
                                        height: '28px',
                                        fontSize: "0.75rem",
                                        backgroundColor: "#dcfce7",
                                        color: "#15803d",
                                        borderColor: "#86efac",
                                        fontWeight: 700
                                    }}
                                >
                                    Übernehmen <Check size={14} />
                                </button>
                            ) : (
                                <span style={{ fontSize: "0.8rem", color: "#16a34a", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>

                                    <Check size={14} /> Bereits aktuell
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* Kontakte extra behandeln, da Array */}
                {extractedData.contacts && extractedData.contacts.length > 0 && (
                    <div style={{ marginTop: "0.5rem", borderTop: "1px solid #bbf7d0", paddingTop: "0.5rem" }}>
                        <strong>Gefundene Kontakte ({extractedData.contacts.length}):</strong>
                        <ul style={{ margin: "0.5rem 0", paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
                            {extractedData.contacts.map((c, idx) => (
                                <li key={idx}>
                                    {c.role}: {c.name} {c.phone && `(${c.phone})`}
                                </li>
                            ))}
                        </ul>
                        <div style={{ fontSize: "0.8rem", color: "#166534", fontStyle: "italic" }}>
                            (Kontakte werden automatisch hinzugefügt beim "Alle übernehmen")
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
