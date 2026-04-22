import React, { useState, useEffect } from 'react';
import { X, Plus, Trash, Settings, Thermometer, Camera, Activity, PenTool, Tv, Box, Check } from 'lucide-react';

const CATEGORIES = [
    { id: 'moisture', label: 'Feuchtigkeitsmessgerät', icon: <Activity /> },
    { id: 'thermal', label: 'Thermokamera', icon: <Thermometer /> },
    { id: 'pipe', label: 'Rohrkamera', icon: <Camera /> },
    { id: 'mini', label: 'Minikamera', icon: <Tv /> }, // Using TV as proxy for screen-based cam
    { id: 'smoke', label: 'Rauchgasgenerator', icon: <Activity /> }, // Generic activity
    { id: 'roof', label: 'Roofscanner', icon: <PenTool /> },
    { id: 'other', label: 'Sonstiges', icon: <Box /> }
];

const MeasurementDeviceManager = ({ onClose }) => {
    // Data Structure: { 'moisture': [{ id: 1, name: 'Trotec T 3000' }], ... }
    const [devices, setDevices] = useState(() => {
        const defaultDevices = {
            moisture: [{ id: 1, name: 'Trotec T 3000' }],
            thermal: [],
            pipe: [],
            mini: [],
            smoke: [],
            roof: [],
            other: []
        };

        try {
            const saved = localStorage.getItem('qtool_measurement_devices');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure all keys exist
                return { ...defaultDevices, ...parsed };
            }
        } catch (e) {
            console.error("Failed to load devices", e);
        }
        return defaultDevices;
    });

    useEffect(() => {
        localStorage.setItem('qtool_measurement_devices', JSON.stringify(devices));
    }, [devices]);

    const [showSuccess, setShowSuccess] = useState(false);

    const [activeTab, setActiveTab] = useState('moisture');
    const [newItemName, setNewItemName] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItemName.trim()) return;

        setDevices(prev => ({
            ...prev,
            [activeTab]: [...(prev[activeTab] || []), { id: Date.now(), name: newItemName.trim() }]
        }));
        setNewItemName('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    const handleDelete = (categoryId, itemId) => {
        if (window.confirm('Eintrag löschen?')) {
            setDevices(prev => ({
                ...prev,
                [categoryId]: prev[categoryId].filter(item => item.id !== itemId)
            }));
        }
    };

    if (typeof document === 'undefined') return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'var(--surface)',
                width: '800px', maxWidth: '95%', height: '80vh',
                borderRadius: '8px',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={24} /> Messgeräte Verwaltung
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Sidebar / Tabs */}
                    <div style={{ width: '250px', borderRight: '1px solid var(--border)', overflowY: 'auto', backgroundColor: 'var(--background)' }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(cat.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    width: '100%', padding: '1rem', border: 'none',
                                    backgroundColor: activeTab === cat.id ? 'var(--surface)' : 'transparent',
                                    color: activeTab === cat.id ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: activeTab === cat.id ? 600 : 400,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderLeft: activeTab === cat.id ? '3px solid var(--primary)' : '3px solid transparent'
                                }}
                            >
                                {React.cloneElement(cat.icon, { size: 18 })}
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--primary)' }}>
                            {CATEGORIES.find(c => c.id === activeTab)?.label}
                        </h3>

                        {/* Add Form */}
                        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                            <input
                                type="text"
                                className="form-input"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder={activeTab === 'other' ? 'z.B. UV Farbe' : 'Typ / Modell eingeben...'}
                                style={{ flex: 1 }}
                                autoFocus
                            />
                            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {showSuccess ? <Check size={18} /> : <Plus size={18} />}
                                {showSuccess ? 'Gespeichert' : 'Hinzufügen'}
                            </button>
                        </form>

                        {/* List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {devices[activeTab] && devices[activeTab].length > 0 ? (
                                devices[activeTab].map(item => (
                                    <div key={item.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1rem', backgroundColor: 'var(--background)',
                                        border: '1px solid var(--border)', borderRadius: '6px'
                                    }}>
                                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                                        <button
                                            onClick={() => handleDelete(activeTab, item.id)}
                                            className="btn btn-ghost"
                                            style={{ color: '#EF4444' }}
                                            title="Löschen"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '6px' }}>
                                    Keine Geräte in dieser Kategorie.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeasurementDeviceManager;
