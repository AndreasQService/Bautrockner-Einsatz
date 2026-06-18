import { useState, useEffect } from 'react';
import {
    Plus, Trash, Edit, X, Search, Monitor, Fan, Wind,
    Thermometer, Wrench, Download, Loader2, Package, Zap, Activity
} from 'lucide-react';
import generatedDevices from '../data/imported_devices.json';
import { supabase } from '../supabaseClient';

const DEVICE_TYPES = [
    'Kondenstrockner',
    'Adsorptionstrockner',
    'Seitenkanalverdichter',
    'HEPA-Filter',
    'Ventilator',
    'Infrarotplatte',
    'Estrich-Dämmschichttrocknung',
    'Bautrockner',
    'Turbine',
    'Wasserabscheider',
    'Messgeräte',
    'Datenlogger'
];

const DEVICE_ICONS = {
    'Kondenstrockner': <Monitor size={18} />,
    'Adsorptionstrockner': <Activity size={18} />,
    'Seitenkanalverdichter': <Wind size={18} />,
    'HEPA-Filter': <Wind size={18} />,
    'Ventilator': <Fan size={18} />,
    'Infrarotplatte': <Zap size={18} />,
    'Estrich-Dämmschichttrocknung': <Wrench size={18} />,
    'Messgeräte': <Thermometer size={18} />,
    'Bautrockner': <Monitor size={18} />,
    'Turbine': <Wind size={18} />,
    'Wasserabscheider': <Package size={18} />,
    'Datenlogger': <Activity size={18} />,
    'Sonstiges': <Wrench size={18} />
};

const KNOWN_MANUFACTURERS = ['Corroventa', 'Trotec', 'Heylo', 'Gann', 'Wilms', 'El-Björn', 'Munters', 'Drieaz'];

function parseModel(modelStr) {
    if (!modelStr) return { hersteller: 'Sonstiges', typ: 'Standard' };
    const trimmed = modelStr.trim();
    
    // Check known manufacturers
    for (const man of KNOWN_MANUFACTURERS) {
        if (new RegExp('^' + man + '\\b', 'i').test(trimmed)) {
            const typPart = trimmed.substring(man.length).trim();
            return {
                hersteller: man,
                typ: typPart || 'Standard'
            };
        }
    }
    
    // Fallback: Split by first space
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx > 0) {
        return {
            hersteller: trimmed.substring(0, spaceIdx).trim(),
            typ: trimmed.substring(spaceIdx + 1).trim()
        };
    }
    
    return {
        hersteller: trimmed,
        typ: 'Standard'
    };
}

export default function DeviceManager({ onBack, onNavigateToReport, reports = [] }) {
    const [catalog, setCatalog] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentModel, setCurrentModel] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCatalog();
    }, []);

    const fetchCatalog = async () => {
        if (!supabase) {
            setError("Supabase ist nicht konfiguriert.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('device_catalog')
                .select('*')
                .order('hersteller', { ascending: true });

            if (error) throw error;
            setCatalog(data || []);
        } catch (e) {
            console.error("Error loading catalog:", e);
            setError("Fehler beim Laden des Gerätekatalogs: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentModel) return;

        const finalGeraetetyp = currentModel.geraetetyp === 'Sonstiges' ? currentModel.customGeraetetyp : currentModel.geraetetyp;
        if (!finalGeraetetyp || !finalGeraetetyp.trim()) {
            setError("Bitte geben Sie eine Geräteart (Gerätetyp) ein.");
            return;
        }
        if (!currentModel.hersteller || !currentModel.hersteller.trim()) {
            setError("Bitte geben Sie einen Hersteller ein.");
            return;
        }
        if (!currentModel.modell || !currentModel.modell.trim()) {
            setError("Bitte geben Sie ein Modell ein.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const row = {
                geraetetyp: finalGeraetetyp.trim(),
                hersteller: currentModel.hersteller.trim(),
                modell: currentModel.modell.trim(),
                anschlusswert: currentModel.anschlusswert ? parseFloat(currentModel.anschlusswert) : 0
            };

            if (currentModel.id) {
                const { error } = await supabase
                    .from('device_catalog')
                    .update(row)
                    .eq('id', currentModel.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('device_catalog')
                    .insert([row]);
                if (error) throw error;
            }
            await fetchCatalog();
            setIsEditing(false);
            setCurrentModel(null);
        } catch (e) {
            setError("Fehler beim Speichern: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Gerätetyp wirklich löschen?')) {
            setIsLoading(true);
            try {
                const { error } = await supabase
                    .from('device_catalog')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                await fetchCatalog();
            } catch (e) {
                setError("Fehler beim Löschen: " + e.message);
                setIsLoading(false);
            }
        }
    };

    const handleImportStandard = async () => {
        if (window.confirm('Möchten Sie die Standard-Gerätetypen in den Katalog importieren?')) {
            setIsLoading(true);
            try {
                const { data: existingCatalog } = await supabase.from('device_catalog').select('geraetetyp, hersteller, modell');
                const existingKeys = new Set(existingCatalog?.map(c => 
                    `${c.geraetetyp.toLowerCase()}|${c.hersteller.toLowerCase()}|${c.modell.toLowerCase()}`
                ));

                const itemsToInsert = [];
                for (const d of generatedDevices) {
                    const geraetetyp = d.type || 'Sonstiges';
                    const { hersteller, typ } = parseModel(d.model);
                    const modell = typ;
                    const anschlusswert = 0;

                    const key = `${geraetetyp.toLowerCase()}|${hersteller.toLowerCase()}|${modell.toLowerCase()}`;
                    if (!existingKeys.has(key)) {
                        itemsToInsert.push({
                            geraetetyp,
                            hersteller,
                            modell,
                            anschlusswert
                        });
                        existingKeys.add(key);
                    }
                }

                if (itemsToInsert.length === 0) {
                    alert('Keine neuen Gerätetypen zum Importieren gefunden.');
                } else {
                    const { error } = await supabase.from('device_catalog').insert(itemsToInsert);
                    if (error) throw error;
                    alert(`${itemsToInsert.length} Gerätetypen erfolgreich in den Katalog importiert.`);
                    await fetchCatalog();
                }
            } catch (e) {
                setError("Fehler beim Import: " + e.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const filteredCatalog = catalog.filter(c => {
        if (!c) return false;
        const typ = c.geraetetyp ? String(c.geraetetyp).toLowerCase() : '';
        const hersteller = c.hersteller ? String(c.hersteller).toLowerCase() : '';
        const modell = c.modell ? String(c.modell).toLowerCase() : '';
        const search = searchTerm.toLowerCase();
        return typ.includes(search) || hersteller.includes(search) || modell.includes(search);
    });

    return (
        <div className="container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '1.5rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(10px)'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Gerätetypen verwalten
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Zentrale Übersicht und Pflege der Gerätemodelle im Katalog
                    </p>
                </div>
                <button onClick={onBack} className="btn btn-outline" style={{ borderRadius: '9999px', padding: '0.6rem 1.5rem' }}>
                    Dashboard
                </button>
            </div>

            <div className="card" style={{
                border: '1px solid var(--border)',
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            style={{
                                paddingLeft: '3.5rem',
                                borderRadius: '9999px',
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid var(--border)'
                            }}
                            placeholder="Gerätetyp, Hersteller oder Modell durchsuchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className="btn btn-outline"
                            onClick={handleImportStandard}
                            style={{ borderRadius: '9999px', fontSize: '0.9rem' }}
                            disabled={isLoading}
                        >
                            <Download size={18} />
                            Standard-Modelle importieren
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setCurrentModel({ geraetetyp: 'Kondenstrockner', customGeraetetyp: '', hersteller: '', modell: '', anschlusswert: '' });
                                setIsEditing(true);
                            }}
                            style={{ borderRadius: '9999px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(15, 110, 163, 0.3)' }}
                            disabled={isLoading}
                        >
                            <Plus size={18} />
                            Gerät hinzufügen
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#FCA5A5',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        {error}
                    </div>
                )}

                <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                    {isLoading ? (
                        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" size={40} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                            <p style={{ fontWeight: 500 }}>Aktualisiere Katalogliste...</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gerätetyp</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hersteller</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Modell</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>Anschlusswert</th>
                                    <th style={{ background: 'transparent', textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCatalog.map(item => (
                                    <tr key={item.id} style={{ transition: 'background 0.2s' }} className="report-row">
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--primary)'
                                                }}>
                                                    {DEVICE_ICONS[item.geraetetyp] || <Package size={18} />}
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.geraetetyp}</div>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                                            {item.hersteller}
                                        </td>
                                        <td style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                                            {item.modell}
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)' }}>
                                                <Zap size={14} /> {item.anschlusswert !== null && item.anschlusswert !== undefined ? item.anschlusswert : '0.0'} kWh
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-ghost"
                                                    style={{ color: 'var(--primary)', padding: '0.5rem', borderRadius: '8px' }}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setCurrentModel({
                                                            id: item.id,
                                                            geraetetyp: DEVICE_TYPES.includes(item.geraetetyp) ? item.geraetetyp : 'Sonstiges',
                                                            customGeraetetyp: DEVICE_TYPES.includes(item.geraetetyp) ? '' : item.geraetetyp,
                                                            hersteller: item.hersteller,
                                                            modell: item.modell,
                                                            anschlusswert: String(item.anschlusswert || '')
                                                        }); 
                                                        setIsEditing(true); 
                                                    }}
                                                    title="Bearbeiten"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    className="btn btn-ghost"
                                                    style={{ color: 'rgba(239, 68, 68, 0.7)', padding: '0.5rem', borderRadius: '8px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                    title="Löschen"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCatalog.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '5rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                                                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }}>
                                                    <Package size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                                                    Keine Gerätetypen in diesem Filter gefunden.
                                                </div>
                                                <button
                                                    className="btn btn-outline"
                                                    onClick={handleImportStandard}
                                                    style={{ borderRadius: '9999px' }}
                                                >
                                                    Standardliste importieren
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isEditing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2.5rem',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setCurrentModel(null);
                            }}
                            style={{
                                position: 'absolute', top: '1.5rem', right: '1.5rem',
                                background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer',
                                width: '32px', height: '32px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-muted)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'white'}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                {currentModel.id ? 'Gerätetyp bearbeiten' : 'Neuen Gerätetyp anlegen'}
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Erfassen Sie die technischen Details für das Inventarsystem.
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#FCA5A5',
                                borderRadius: 'var(--radius)',
                                marginBottom: '1.25rem',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                fontSize: '0.85rem'
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Geräteart (Gerätetyp)</label>
                                <select
                                    className="form-input"
                                    value={currentModel.geraetetyp}
                                    onChange={(e) => setCurrentModel(prev => ({ ...prev, geraetetyp: e.target.value }))}
                                    style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                >
                                    {DEVICE_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                    <option value="Sonstiges">Eigene Eingabe...</option>
                                </select>
                            </div>

                            {currentModel.geraetetyp === 'Sonstiges' && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ opacity: 0.8, color: '#60A5FA' }}>Eigene Geräteart</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={currentModel.customGeraetetyp}
                                        onChange={(e) => setCurrentModel(prev => ({ ...prev, customGeraetetyp: e.target.value }))}
                                        placeholder="z.B. Spezial-Trockner"
                                        style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                    />
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Hersteller</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={currentModel.hersteller}
                                    onChange={(e) => setCurrentModel(prev => ({ ...prev, hersteller: e.target.value }))}
                                    placeholder="z.B. Corroventa"
                                    style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Modell</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={currentModel.modell}
                                    onChange={(e) => setCurrentModel(prev => ({ ...prev, modell: e.target.value }))}
                                    placeholder="z.B. K3 mit Pumpe"
                                    style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Anschlusswert (kWh)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    value={currentModel.anschlusswert}
                                    onChange={(e) => setCurrentModel(prev => ({ ...prev, anschlusswert: e.target.value }))}
                                    placeholder="z.B. 0.45"
                                    style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                            <button className="btn btn-outline" onClick={() => { setIsEditing(false); setCurrentModel(null); }} style={{ flex: 1, borderRadius: '9999px' }}>
                                Abbrechen
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={isLoading} style={{ flex: 2, borderRadius: '9999px', fontWeight: 700 }}>
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (currentModel.id ? 'Speichern' : 'Hinzufügen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
