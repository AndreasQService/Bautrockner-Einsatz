import React from 'react';
import { ArrowLeft, Plus } from 'lucide-react';

export default function TechnicianMeasurementPage({
    measurementRooms,
    onBackToTiles,
    onContinueMeasurement,
    onNewRoom
}) {
    return (
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={onBackToTiles} style={{ background: 'var(--surface)', border: '1px solid rgba(96, 165, 250, 0.3)', color: '#60A5FA', cursor: 'pointer', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', fontWeight: 600 }}>
                        <ArrowLeft size={18} /> Kacheln
                    </button>
                    <div style={{ marginLeft: '1rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Messen</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>Messräume & Messprotokolle</p>
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '2px solid var(--border)', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>Messräume</h3>
                </div>

                {(!measurementRooms || measurementRooms.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{ color: 'var(--text-main)', fontWeight: 500, fontSize: '1.1rem', marginBottom: '1.5rem' }}>Noch keine Messräume angelegt.</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {measurementRooms.map(room => {
                            // Calculate latest date
                            let dateStr = '-';
                            if (room.measurementData?.globalSettings?.date) {
                                dateStr = new Date(room.measurementData.globalSettings.date).toLocaleDateString('de-CH');
                            } else if (Array.isArray(room.measurementHistory) && room.measurementHistory.length > 0) {
                                const dates = room.measurementHistory.map(h => h.date || h.datum || h.timestamp || h.createdAt || h.globalSettings?.date).filter(Boolean);
                                if (dates.length > 0) {
                                    const latest = dates.sort((a, b) => new Date(b) - new Date(a))[0];
                                    dateStr = new Date(latest).toLocaleDateString('de-CH');
                                }
                            }

                            return (
                                <div key={room.id} style={{
                                    background: 'var(--surface)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    border: '1px solid var(--border)',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                                                {room.name || 'Unbenannter Raum'}
                                            </div>
                                            {room.apartment && (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{room.apartment}</div>
                                            )}
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                                Letzte Messung: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{dateStr}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                        <button
                                            className="btn-glass"
                                            onClick={() => onContinueMeasurement(room)}
                                            style={{
                                                flex: 1,
                                                padding: '0.85rem',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                fontSize: '0.95rem',
                                                color: 'var(--text-main)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            Messung fortsetzen
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ marginTop: '1.5rem' }}>
                    <button
                        className="btn-primary"
                        onClick={onNewRoom}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} /> + Neuer Raum
                    </button>
                </div>
            </div>
        </div>
    );
}
