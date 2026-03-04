import React, { useState } from 'react';
import {
    Settings, Plus, X, Save, Check, FileText,
    Database, RotateCcw, CheckCircle, Trash
} from 'lucide-react';
import { PdfIcon, ROOM_OPTIONS } from '../DamageForm.constants.jsx';

const DryingManager = ({
    formData,
    setFormData,
    mode,
    supabase,
    availableDevices,
    setAvailableDevices,
    deviceFetchError,
    generateEnergyReport,
    getDaysDiff,
    totalDryingHours,
    totalDryingKwh
}) => {
    const [showAddDeviceForm, setShowAddDeviceForm] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [unsubscribeStates, setUnsubscribeStates] = useState({});
    const [newDevice, setNewDevice] = useState({
        deviceNumber: '',
        apartment: '',
        room: '',
        startDate: new Date().toISOString().split('T')[0],
        counterStart: '',
        energyConsumption: ''
    });

    const handleAddDevice = async () => {
        if (!newDevice.room || !newDevice.apartment || !newDevice.deviceNumber || newDevice.counterStart === '') {
            alert("Bitte füllen Sie alle Pflichtfelder aus (Gerätestand Start, Raum, Wohnung).");
            return false;
        }

        let deviceToAdd = {
            id: Date.now(),
            deviceNumber: newDevice.deviceNumber,
            type: selectedDevice ? selectedDevice.type : 'Unbekannt',
            model: selectedDevice ? selectedDevice.model : '',
            apartment: newDevice.apartment,
            room: newDevice.room,
            startDate: newDevice.startDate || new Date().toISOString().split('T')[0],
            endDate: '',
            hours: '',
            counterStart: newDevice.counterStart,
            counterEnd: '',
            energyConsumption: newDevice.energyConsumption,
            dbId: selectedDevice ? selectedDevice.id : null
        };

        if (selectedDevice && supabase) {
            const { error } = await supabase
                .from('devices')
                .update({
                    current_report_id: formData.id,
                    current_project: formData.projectTitle || formData.client
                })
                .eq('id', selectedDevice.id);

            if (error) {
                console.error("Failed to update device status:", error);
                alert("Fehler beim Aktualisieren des Gerätestatus: " + error.message);
                return false;
            }
            setAvailableDevices(prev => prev.filter(d => d.id !== selectedDevice.id));
        }

        setFormData(prev => ({
            ...prev,
            equipment: [...prev.equipment, deviceToAdd]
        }));

        setSelectedDevice(null);
        setNewDevice(prev => ({
            ...prev,
            deviceNumber: '',
            counterStart: ''
        }));
        return true;
    };

    return (
        <>
            {/* 4. Drying Equipment - Visible ONLY in 'Trocknung' status */}
            {formData.status === 'Trocknung' && (
                <div style={{ marginBottom: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', ...(mode === 'desktop' ? { display: 'flex', flexDirection: 'column' } : {}) }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                        <Settings size={24} />
                        Trocknungsgeräte
                    </h2>

                    {/* Add Device Form */}
                    <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)', ...(mode === 'desktop' ? { order: 3, marginTop: '2rem' } : {}) }}>
                        <button
                            type="button"
                            className={`btn ${showAddDeviceForm ? 'btn-ghost' : 'btn-primary'}`}
                            onClick={() => setShowAddDeviceForm(!showAddDeviceForm)}
                            style={{ width: '100%', marginBottom: showAddDeviceForm ? '1rem' : '0', color: showAddDeviceForm ? '#EF4444' : 'white', borderColor: showAddDeviceForm ? '#EF4444' : 'transparent' }}
                        >
                            {showAddDeviceForm ? <X size={16} /> : <Plus size={16} />}
                            {showAddDeviceForm ? " Abbrechen" : " Gerät hinzufügen"}
                        </button>

                        {showAddDeviceForm && (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {deviceFetchError ? (
                                        <div style={{ color: '#EF4444', fontSize: '0.9rem', marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #EF4444', borderRadius: '4px' }}>
                                            Ladefehler: {deviceFetchError}
                                        </div>
                                    ) : (
                                        <select
                                            className="form-input"
                                            value={selectedDevice ? selectedDevice.id : ''}
                                            onChange={(e) => {
                                                const devId = e.target.value;
                                                if (!devId) {
                                                    setSelectedDevice(null);
                                                    setNewDevice(prev => ({ ...prev, deviceNumber: '' }));
                                                } else {
                                                    const dev = availableDevices.find(d => d.id.toString() === devId);
                                                    if (dev) {
                                                        setSelectedDevice(dev);
                                                        setNewDevice(prev => ({ ...prev, deviceNumber: dev.number }));
                                                    }
                                                }
                                            }}
                                            style={{ marginBottom: '0.5rem' }}
                                        >
                                            <option value="">-- Gerät aus Lager wählen --</option>
                                            {Array.isArray(availableDevices) && availableDevices.length > 0 ? (
                                                availableDevices.map(device => (
                                                    <option key={device.id} value={device.id}>
                                                        #{device.number} - {device.type} {device.model ? `(${device.model})` : ''}
                                                    </option>
                                                ))
                                            ) : (
                                                <option disabled>Keine verfügbaren Geräte gefunden</option>
                                            )}
                                        </select>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Geräte-Nr. (oder oben wählen)"
                                        className="form-input"
                                        value={newDevice.deviceNumber}
                                        onChange={(e) => {
                                            setNewDevice(prev => ({ ...prev, deviceNumber: e.target.value }));
                                            setSelectedDevice(null);
                                        }}
                                    />

                                    <select
                                        className="form-input"
                                        value={newDevice.apartment || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNewDevice(prev => ({ ...prev, apartment: val }));
                                        }}
                                        style={{ borderColor: !newDevice.apartment ? '#F87171' : '' }}
                                    >
                                        <option value="">Wohnung wählen... (Pflicht)</option>
                                        {[...new Set([...formData.rooms.map(r => r.apartment).filter(Boolean), ...(formData.contacts || []).map(c => c.name ? c.name.trim().split(/\s+/).pop() : '').filter(Boolean)])].sort().map(apt => (
                                            <option key={apt} value={apt}>{apt}</option>
                                        ))}
                                        <option value="Sonstiges">Neue Wohnung eingeben...</option>
                                    </select>

                                    {((newDevice.apartment && ![...new Set([...formData.rooms.map(r => r.apartment).filter(Boolean), ...(formData.contacts || []).map(c => c.name ? c.name.trim().split(/\s+/).pop() : '').filter(Boolean)])].sort().includes(newDevice.apartment)) || !formData.rooms.some(r => r.apartment)) && (
                                        <input
                                            type="text"
                                            placeholder="Wohnung eingeben (Pflicht)"
                                            className="form-input"
                                            value={newDevice.apartment || ''}
                                            onChange={(e) => setNewDevice(prev => ({ ...prev, apartment: e.target.value }))}
                                            style={{ marginTop: '0.25rem' }}
                                        />
                                    )}
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <select
                                        className="form-input"
                                        value={newDevice.isManualRoom ? 'Sonstiges' : newDevice.room}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Sonstiges') {
                                                setNewDevice(prev => ({ ...prev, isManualRoom: true, room: '' }));
                                            } else {
                                                const linkedRoom = formData.rooms.find(r => r.name === val);
                                                if (linkedRoom && linkedRoom.apartment) {
                                                    setNewDevice(prev => ({
                                                        ...prev,
                                                        isManualRoom: false,
                                                        room: val,
                                                        apartment: linkedRoom.apartment,
                                                        isManualApartment: false
                                                    }));
                                                } else {
                                                    setNewDevice(prev => ({ ...prev, isManualRoom: false, room: val }));
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Raum wählen...</option>
                                        <optgroup label="Projekträume">
                                            {[...new Set(formData.rooms.map(r => r.name))].map(rName => (
                                                <option key={rName} value={rName}>{rName}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Standard">
                                            {ROOM_OPTIONS.filter(opt => !formData.rooms.some(r => r.name === opt)).map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </optgroup>
                                        <option value="Sonstiges">Manuelle Eingabe</option>
                                    </select>

                                    {newDevice.isManualRoom && (
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ marginTop: '0.5rem' }}
                                            placeholder="Raum eingeben..."
                                            value={newDevice.room}
                                            onChange={(e) => setNewDevice(prev => ({ ...prev, room: e.target.value }))}
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={newDevice.startDate}
                                        onChange={(e) => setNewDevice(prev => ({ ...prev, startDate: e.target.value }))}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Zählerstand Start *"
                                        className="form-input"
                                        value={newDevice.counterStart}
                                        onChange={(e) => setNewDevice(prev => ({ ...prev, counterStart: e.target.value }))}
                                        style={{ borderColor: !newDevice.counterStart && newDevice.deviceNumber ? '#F87171' : '' }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                    disabled={!newDevice.deviceNumber || !newDevice.room || !newDevice.apartment || newDevice.counterStart === ''}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleAddDevice();
                                    }}
                                >
                                    <Save size={16} /> Speichern
                                </button>
                            </>
                        )}
                    </div>

                    {/* Energy Report Button */}
                    {mode === 'desktop' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', position: 'relative', zIndex: 10, ...(mode === 'desktop' ? { order: 2 } : {}) }}>
                            <button
                                type="button"
                                onClick={generateEnergyReport}
                                className="btn btn-outline"
                                style={{
                                    borderColor: 'var(--success)',
                                    color: 'var(--success)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                title="Energieprotokoll erstellen"
                            >
                                <PdfIcon size={18} />
                                <span>Energieprotokoll (PDF)</span>
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', ...(mode === 'desktop' ? { order: 1 } : {}) }}>
                        {formData.equipment
                            .map((d, i) => ({ ...d, _originalIndex: i }))
                            .sort((a, b) => {
                                const aDone = !!a.endDate;
                                const bDone = !!b.endDate;
                                if (aDone === bDone) return 0;
                                return aDone ? 1 : -1;
                            })
                            .map((device) => {
                                const idx = device._originalIndex;
                                const isUnsubscribing = !!unsubscribeStates[idx];
                                const isAbgemeldet = !!device.endDate;
                                const draft = unsubscribeStates[idx] || {};

                                return (
                                    <div key={idx} style={{ backgroundColor: '#1E293B', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'white' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--primary)', minWidth: '40px' }}>#{device.deviceNumber}</span>
                                            <div style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                                                    {device.room}
                                                    {device.apartment && <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 400, marginLeft: '4px' }}>({device.apartment})</span>}
                                                </div>
                                            </div>
                                            <div style={{ minWidth: '40px' }}></div>
                                        </div>

                                        <div style={{ fontSize: '0.9rem', color: '#94A3B8', display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span>Start: {device.startDate}</span>
                                            <span>Start-Zähler: {device.counterStart} kWh</span>
                                        </div>

                                        {isAbgemeldet ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                                    <div style={{ gridColumn: 'span 3' }}>
                                                        <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Abmelde-Datum</label>
                                                        <input
                                                            type="date"
                                                            className="form-input"
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem', width: '100%' }}
                                                            value={device.endDate}
                                                            onChange={(e) => {
                                                                const newEquipment = [...formData.equipment];
                                                                newEquipment[idx].endDate = e.target.value;
                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ gridColumn: 'span 2' }}>
                                                        <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Zähler Ende</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                            value={device.counterEnd || ''}
                                                            onChange={(e) => {
                                                                const newEquipment = [...formData.equipment];
                                                                newEquipment[idx].counterEnd = e.target.value;
                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Laufzeit/Std.</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                            value={device.hours || ''}
                                                            onChange={(e) => {
                                                                const newEquipment = [...formData.equipment];
                                                                newEquipment[idx].hours = e.target.value;
                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    style={{
                                                        flex: 1, fontSize: '0.9rem', padding: '0.5rem', fontWeight: 600,
                                                        color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                                        border: '1px solid #10B981', borderRadius: '4px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: 'pointer', textTransform: 'uppercase'
                                                    }}
                                                    onClick={() => {
                                                        if (window.confirm("Abmeldung rückgängig machen?")) {
                                                            const newEquipment = [...formData.equipment];
                                                            newEquipment[idx].endDate = '';
                                                            newEquipment[idx].counterEnd = '';
                                                            newEquipment[idx].hours = '';
                                                            setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                        }
                                                    }}
                                                >
                                                    <Check size={16} /> Abgemeldet
                                                </button>
                                            </div>
                                        ) : isUnsubscribing ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                                    <div style={{ gridColumn: 'span 3' }}>
                                                        <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Abmelde-Datum</label>
                                                        <input
                                                            type="date"
                                                            className="form-input"
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem', width: '100%' }}
                                                            value={draft.endDate || ''}
                                                            onChange={(e) => setUnsubscribeStates(prev => ({ ...prev, [idx]: { ...prev[idx], endDate: e.target.value } }))}
                                                        />
                                                    </div>
                                                    <div style={{ gridColumn: 'span 2' }}>
                                                        <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Zähler Ende</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            placeholder="Endstand"
                                                            autoFocus
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                            value={draft.counterEnd || ''}
                                                            onChange={(e) => setUnsubscribeStates(prev => ({ ...prev, [idx]: { ...prev[idx], counterEnd: e.target.value } }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Laufzeit/Std.</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            placeholder="Std."
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                            value={draft.hours || ''}
                                                            onChange={(e) => setUnsubscribeStates(prev => ({ ...prev, [idx]: { ...prev[idx], hours: e.target.value } }))}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        style={{ flex: 1, color: '#94A3B8', border: '1px solid var(--border)' }}
                                                        onClick={() => {
                                                            const newStates = { ...unsubscribeStates };
                                                            delete newStates[idx];
                                                            setUnsubscribeStates(newStates);
                                                        }}
                                                    >
                                                        Abbrechen
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        style={{ flex: 1 }}
                                                        onClick={() => {
                                                            const newEquipment = [...formData.equipment];
                                                            newEquipment[idx].endDate = draft.endDate;
                                                            newEquipment[idx].counterEnd = draft.counterEnd;
                                                            newEquipment[idx].hours = draft.hours;
                                                            setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                            const newStates = { ...unsubscribeStates };
                                                            delete newStates[idx];
                                                            setUnsubscribeStates(newStates);
                                                        }}
                                                    >
                                                        Speichern
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    style={{
                                                        width: '100%', fontSize: '0.9rem', padding: '0.5rem', fontWeight: 600,
                                                        color: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                        border: '1px solid #F59E0B', borderRadius: '4px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: 'pointer', textTransform: 'uppercase'
                                                    }}
                                                    onClick={() => {
                                                        setUnsubscribeStates(prev => ({
                                                            ...prev,
                                                            [idx]: {
                                                                endDate: new Date().toISOString().split('T')[0],
                                                                counterEnd: '',
                                                                hours: ''
                                                            }
                                                        }));
                                                    }}
                                                >
                                                    Abmelden
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        {formData.equipment.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.9rem' }}>Keine Geräte installiert.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Zusammenfassung Trocknung */}
            {(mode === 'desktop' || !['Schadenaufnahme', 'Leckortung'].includes(formData.status)) && formData.equipment?.length > 0 && (
                <div style={{ marginBottom: '1.5rem', backgroundColor: 'var(--surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-main)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)' }}>
                        <Database size={18} /> Zusammenfassung Trocknung
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Gerät</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>Dauer (Tage)</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>Betriebsstunden</th>
                                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Verbrauch (kWh)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.equipment.filter(d => d.endDate).map((device, idx) => {
                                    const hasMeter = device.counterEnd && device.counterStart;
                                    const hasKw = device.energyConsumption && device.hours;
                                    let consumption = 0;
                                    if (hasMeter) {
                                        consumption = parseFloat(device.counterEnd) - parseFloat(device.counterStart);
                                    } else if (hasKw) {
                                        consumption = parseFloat(device.energyConsumption) * parseFloat(device.hours);
                                    }

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.75rem' }}>#{device.deviceNumber} ({device.room})</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{getDaysDiff(device.startDate, device.endDate)}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{device.hours} h</td>
                                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                                                {consumption.toFixed(2)}
                                                {!hasMeter && hasKw && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '2px' }}>*</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {formData.equipment.filter(d => d.endDate).length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Keine abgeschlossenen Trocknungen vorhanden.</td>
                                    </tr>
                                )}
                                <tr style={{ fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '0.75rem' }}>Gesamt</td>
                                    <td style={{ textAlign: 'center', padding: '0.75rem' }}>-</td>
                                    <td style={{ textAlign: 'center', padding: '0.75rem' }}>{totalDryingHours.toFixed(1)} h</td>
                                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>{totalDryingKwh.toFixed(2)} kWh</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};

export default DryingManager;
