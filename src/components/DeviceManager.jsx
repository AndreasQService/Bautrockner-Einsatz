import React, { useState, useEffect } from 'react';
import { Plus, Trash, Edit, X, Search, Monitor, Fan, Wind, Thermometer, Wrench } from 'lucide-react';

const DEVICE_TYPES = [
    'Kondenstrockner',
    'Adsorptionstrockner',
    'Seitenkanalverdichter',
    'HEPA-Filter',
    'Ventilator',
    'Infrarotplatte',
    'Estrich-Dämmschichttrocknung',
    'Sonstiges'
];

// Simple icons mapping
const DEVICE_ICONS = {
    'Kondenstrockner': <Monitor size={20} />,
    'Adsorptionstrockner': <Monitor size={20} />,
    'Seitenkanalverdichter': <Wind size={20} />,
    'HEPA-Filter': <Wind size={20} />,
    'Ventilator': <Fan size={20} />,
    'Infrarotplatte': <Thermometer size={20} />,
    'Estrich-Dämmschichttrocknung': <Wrench size={20} />,
    'Sonstiges': <Wrench size={20} />
};

export default function DeviceManager({ onBack }) {
    const [devices, setDevices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentDevice, setCurrentDevice] = useState(null);

    // Initial load
    useEffect(() => {
        try {
            const savedDevices = localStorage.getItem('qservice_devices');
            if (savedDevices) {
                const parsed = JSON.parse(savedDevices);
                if (Array.isArray(parsed)) {
                    setDevices(parsed);
                } else {
                    throw new Error("Invalid format");
                }
            } else {
                // Initial Seed
                const initial = [
                    { id: '1', number: '1', type: 'Kondenstrockner', model: 'Trotec TTK 100', status: 'Verfügbar' },
                    { id: '2', number: '2', type: 'Seitenkanalverdichter', model: 'Trotec VE 4', status: 'Verfügbar' }
                ];
                setDevices(initial);
                localStorage.setItem('qservice_devices', JSON.stringify(initial));
            }
        } catch (e) {
            console.error("Error loading devices:", e);
            // Fallback to empty or seed
            setDevices([]);
        }
    }, []);

    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    const handleSave = () => {
        if (!currentDevice || !currentDevice.number || !currentDevice.type) return;

        let newDevices;
        if (currentDevice.id) {
            // Update
            newDevices = devices.map(d => d.id === currentDevice.id ? currentDevice : d);
        } else {
            // Create
            newDevices = [...devices, { ...currentDevice, id: generateId(), status: 'Verfügbar' }];
        }

        setDevices(newDevices);
        localStorage.setItem('qservice_devices', JSON.stringify(newDevices));
        setIsEditing(false);
        setCurrentDevice(null);
    };

    const handleDelete = (id) => {
        if (window.confirm('Gerät wirklich löschen?')) {
            const newDevices = devices.filter(d => d.id !== id);
            setDevices(newDevices);
            localStorage.setItem('qservice_devices', JSON.stringify(newDevices));
        }
    };

    // Safe filter
    const filteredDevices = devices.filter(d => {
        if (!d) return false;
        const num = d.number ? String(d.number).toLowerCase() : '';
        const mod = d.model ? String(d.model).toLowerCase() : '';
        const typ = d.type ? String(d.type).toLowerCase() : '';
        const search = searchTerm.toLowerCase();
        return num.includes(search) || mod.includes(search) || typ.includes(search);
    });

    return (
        <div className="container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>Geräteverwaltung</h1>
                <button onClick={onBack} className="btn btn-outline">Zurück zum Dashboard</button>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            style={{ paddingLeft: '3rem' }}
                            placeholder="Suche nach Nummer, Modell oder Typ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setCurrentDevice({ number: '', type: 'Kondenstrockner', model: '', status: 'Verfügbar' });
                            setIsEditing(true);
                        }}
                    >
                        <Plus size={20} style={{ marginRight: '0.5rem' }} />
                        Neues Gerät
                    </button>
                </div>

                <div className="table-container">
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Nr.</th>
                                <th style={{ textAlign: 'left' }}>Typ</th>
                                <th style={{ textAlign: 'left' }}>Modell / Bezeichnung</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'right' }}>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDevices.map(device => (
                                <tr key={device.id}>
                                    <td style={{ fontWeight: 'bold' }}>#{device.number}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {DEVICE_ICONS[device.type] || <Wrench size={20} />}
                                            {device.type}
                                        </div>
                                    </td>
                                    <td>{device.model || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            backgroundColor: device.status === 'Verfügbar' ? '#DCFCE7' : '#FEE2E2',
                                            color: device.status === 'Verfügbar' ? '#166534' : '#991B1B',
                                            fontSize: '0.8rem',
                                            fontWeight: 600
                                        }}>
                                            {device.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ color: 'var(--primary)', padding: '0.5rem' }}
                                            onClick={() => {
                                                setCurrentDevice(device);
                                                setIsEditing(true);
                                            }}
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ color: '#EF4444', padding: '0.5rem' }}
                                            onClick={() => handleDelete(device.id)}
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredDevices.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Keine Geräte gefunden.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Edit/Create */}
            {isEditing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {currentDevice.id ? 'Gerät bearbeiten' : 'Neues Gerät'}
                            </h2>
                            <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Geräte-Nummer (Inventar-Nr.)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={currentDevice.number}
                                onChange={(e) => setCurrentDevice(prev => ({ ...prev, number: e.target.value }))}
                                placeholder="z.B. 101"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Typ</label>
                            <select
                                className="form-input"
                                value={currentDevice.type}
                                onChange={(e) => setCurrentDevice(prev => ({ ...prev, type: e.target.value }))}
                            >
                                {DEVICE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Hersteller / Modell</label>
                            <input
                                type="text"
                                className="form-input"
                                value={currentDevice.model}
                                onChange={(e) => setCurrentDevice(prev => ({ ...prev, model: e.target.value }))}
                                placeholder="z.B. Trotec TTK 100"
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-outline" onClick={() => setIsEditing(false)}>Abbrechen</button>
                            <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
