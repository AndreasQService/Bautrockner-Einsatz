import { ArrowLeft, Plus, Trash } from 'lucide-react';

export default function TechnicianMeasurementPage({
    measurementRooms,
    onBackToTiles,
    onContinueMeasurement,
    onNewRoom,
    onDeleteRoom
}) {
    return (
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    <button onClick={onBackToTiles} style={{ background: 'var(--color-primary, #1E6DB7)', border: '1px solid var(--color-primary-hover, #175394)', color: '#FFFFFF', cursor: 'pointer', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '1.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                        <ArrowLeft size={18} /> Zurück zu Kacheln
                    </button>
                </div>
                <div style={{ flex: 2, textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Messen</h2>
                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>Messräume & Messprotokolle</p>
                </div>
                <div style={{ flex: 1 }}></div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '2px solid var(--border)', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>Räume</h3>
                </div>

                {(!measurementRooms || measurementRooms.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{ color: 'var(--text-main)', fontWeight: 500, fontSize: '1.1rem', marginBottom: '1.5rem' }}>Noch keine Räume angelegt.</div>
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

                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', width: '100%' }}>
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
                                        {onDeleteRoom && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm(`Sind Sie sicher, dass Sie den Raum "${room.name || 'Unbenannter Raum'}" löschen möchten? Alle zugehörigen Bilder und Messdaten gehen verloren.`)) {
                                                        onDeleteRoom(room.id);
                                                    }
                                                }}
                                                title="Raum löschen"
                                                style={{
                                                    padding: '0.85rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid #b91c1c',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                    color: '#f87171',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    width: '44px',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        )}
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
