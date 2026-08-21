import { useState, useEffect } from 'react';
import {
    Plus, Trash, Edit, X, Search, Monitor, Fan, Wind,
    Thermometer, Wrench, Download, Loader2, LogOut,
    ExternalLink, Package, Zap, Hash, Activity, MapPin
} from 'lucide-react';
import generatedDevices from '../data/imported_devices.json';
import { supabase } from '../supabaseClient';
import { canDeleteData, canUnregisterDevice } from '../lib/permissions.js';

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

export default function DeviceManager({ onBack, onNavigateToReport, reports = [], currentUser = null }) {
    const [activeTab, setActiveTab] = useState('inventar'); // 'inventar' oder 'typen'
    const [devices, setDevices] = useState([]);
    const [rentalDevices, setRentalDevices] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    
    // Form states
    const [currentDevice, setCurrentDevice] = useState(null); // { id, number, catalog_id, status }
    const [currentModel, setCurrentModel] = useState(null);   // { id, geraetetyp, customGeraetetyp, hersteller, modell, anschlusswert }
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDevices();
        fetchRentalDevices();
        fetchCatalog();
    }, []);

    const fetchDevices = async () => {
        if (!supabase) {
            setError("Supabase ist nicht konfiguriert.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('devices')
                .select('*')
                .order('number', { ascending: true });

            if (error) throw error;
            setDevices(data || []);
        } catch (e) {
            console.error("Error loading devices:", e);
            setError("Fehler beim Laden der Geräte: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRentalDevices = async () => {
        if (!supabase) {
            setError("Supabase ist nicht konfiguriert.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('rental_devices')
                .select('id, report_id, device_number, device_type, catalog_id, apartment, room, start_date, end_date, counter_start, runtime_hours, notes, created_at, updated_at')
                .order('device_number', { ascending: true });

            if (error) throw error;
            setRentalDevices(data || []);
        } catch (e) {
            console.error("Error loading rental devices:", e);
            setError("Fehler beim Laden der Mietgeräte: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

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

    const handleSaveDevice = async () => {
        if (!currentDevice || !currentDevice.number) return;
        
        const trimmedNumber = currentDevice.number.trim();
        if (!trimmedNumber) {
            setError("Bitte geben Sie eine Inventarnummer ein.");
            return;
        }

        const selectedCatalog = catalog.find(c => c.id === currentDevice.catalog_id);
        if (!selectedCatalog) {
            setError("Bitte wählen Sie ein Gerätemodell aus.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // Check if inventory number already exists for another device
            const { data: existing, error: checkError } = await supabase
                .from('devices')
                .select('id, number')
                .eq('number', trimmedNumber);

            if (checkError) throw checkError;
            if (existing && existing.some(d => d.id !== currentDevice.id)) {
                setError(`Ein Gerät mit der Inventarnummer "${trimmedNumber}" existiert bereits im Inventar! Es kann kein doppeltes Inventar angelegt werden.`);
                setIsLoading(false);
                return;
            }

            const row = {
                number: trimmedNumber,
                catalog_id: currentDevice.catalog_id,
                status: currentDevice.status || 'Aktiv',
                // Copy fields for backward compatibility
                type: selectedCatalog.geraetetyp || 'Unbekannt',
                model: `${selectedCatalog.hersteller || ''} ${selectedCatalog.modell || ''}`.trim(),
                energy_consumption: selectedCatalog.anschlusswert || null,
                is_rental: false,
                rental_provider: null,
                rental_cost_daily: 0,
                rental_start: null,
                rental_end_planned: null
            };

            if (currentDevice.id) {
                const { error } = await supabase
                    .from('devices')
                    .update(row)
                    .eq('id', currentDevice.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('devices')
                    .insert([row]);
                if (error) throw error;
            }

            await fetchDevices();
            setIsEditing(false);
            setCurrentDevice(null);
        } catch (e) {
            console.error("Error saving device:", e);
            setError("Fehler beim Speichern: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveModel = async () => {
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

    const handleDeleteDevice = async (id) => {
        if (!canDeleteData(currentUser)) {
            setError('Nur Administratoren dürfen Geräte löschen. Geräte abmelden bleibt erlaubt.');
            return;
        }
        const dev = devices.find(d => d.id === id);
        if (dev && dev.current_report_id) {
            alert(`Das Gerät ${dev.number} ist noch im Projekt "${dev.current_project}" im Einsatz und kann nicht gelöscht/ausgebucht werden!`);
            return;
        }
        const confirmMsg = dev && dev.is_rental 
            ? `Mietgerät ${dev.number} wirklich ausbuchen (löschen)? Die historischen Projektdaten bleiben erhalten.`
            : 'Gerät wirklich löschen?';
        if (window.confirm(confirmMsg)) {
            setIsLoading(true);
            try {
                const { error } = await supabase
                    .from('devices')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                await fetchDevices();
            } catch (e) {
                setError("Fehler beim Löschen: " + e.message);
                setIsLoading(false);
            }
        }
    };

    const handleDeleteModel = async (id) => {
        if (!canDeleteData(currentUser)) {
            setError('Nur Administratoren dürfen Gerätetypen löschen.');
            return;
        }
        if (window.confirm('Gerätetyp wirklich löschen? Hinweis: Physische Geräte, die diesen Typ verwenden, bleiben bestehen, sind jedoch nicht mehr korrekt verknüpft.')) {
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

    const handleReleaseDevice = async (id, projectName) => {
        if (!canUnregisterDevice(currentUser)) return;
        if (window.confirm(`Möchten Sie das Gerät wirklich aus dem Projekt "${projectName}" freigeben?`)) {
            setIsLoading(true);
            try {
                const { error } = await supabase
                    .from('devices')
                    .update({ current_project: null, current_report_id: null })
                    .eq('id', id);

                if (error) throw error;
                await fetchDevices();
            } catch (e) {
                setError("Fehler beim Freigeben: " + e.message);
                setIsLoading(false);
            }
        }
    };

    const handleReturnRentalDevice = async (device) => {
        if (!canUnregisterDevice(currentUser)) return;
        const confirmMsg = `Mietgerät "${device.number}" (${device.type || 'Mietgerät'}) wirklich abmelden und aus dem Inventar löschen? Die Projektdaten bleiben im Schadensbericht vollständig erhalten.`;
        if (window.confirm(confirmMsg)) {
            setIsLoading(true);
            try {
                const { error } = await supabase
                    .from('devices')
                    .delete()
                    .eq('id', device.id);

                if (error) throw error;
                await fetchDevices();
            } catch (e) {
                setError("Fehler beim Abmelden des Mietgeräts: " + e.message);
                setIsLoading(false);
            }
        }
    };

    const handleReactivateRentalDevice = async (device) => {
        if (window.confirm(`Möchten Sie das Mietgerät "${device.number}" wieder aktivieren?`)) {
            setIsLoading(true);
            try {
                const { error } = await supabase
                    .from('devices')
                    .update({ status: 'Aktiv' })
                    .eq('id', device.id);

                if (error) throw error;
                await fetchDevices();
            } catch (e) {
                setError("Fehler beim Aktivieren des Mietgeräts: " + e.message);
                setIsLoading(false);
            }
        }
    };

    const handleImportStandardDevices = async () => {
        if (window.confirm('Möchten Sie die Standard-Geräteliste importieren? Hinweis: Es werden passende Modelle im Katalog vorausgesetzt oder erstellt.')) {
            setIsLoading(true);
            try {
                // First ensure models exist in catalog
                const { data: existingCatalog } = await supabase.from('device_catalog').select('id, geraetetyp, hersteller, modell');
                const catalogMap = new Map(existingCatalog?.map(c => 
                    [`${c.geraetetyp.toLowerCase()}|${c.hersteller.toLowerCase()}|${c.modell.toLowerCase()}`, c.id]
                ));

                const { data: existingDevices } = await supabase.from('devices').select('number');
                const existingNumbers = new Set(existingDevices?.map(d => d.number));

                const devicesToImport = [];
                for (const d of generatedDevices) {
                    if (existingNumbers.has(d.number)) continue;

                    const type = d.type || 'Sonstiges';
                    const { hersteller, typ: modell } = parseModel(d.model);
                    const key = `${type.toLowerCase()}|${hersteller.toLowerCase()}|${modell.toLowerCase()}`;
                    
                    let catalogId = catalogMap.get(key);
                    if (!catalogId) {
                        // Create catalog item first
                        const { data: newCat, error: catErr } = await supabase
                            .from('device_catalog')
                            .insert([{ geraetetyp: type, hersteller, modell, anschlusswert: 0.0 }])
                            .select();
                        if (catErr) throw catErr;
                        catalogId = newCat[0].id;
                        catalogMap.set(key, catalogId);
                    }

                    devicesToImport.push({
                        number: d.number,
                        catalog_id: catalogId,
                        type: type,
                        model: `${hersteller} ${modell}`.trim(),
                        status: d.status || 'Aktiv'
                    });
                }

                if (devicesToImport.length === 0) {
                    alert('Keine neuen Geräte zum Importieren gefunden.');
                } else {
                    const { error } = await supabase.from('devices').insert(devicesToImport);
                    if (error) throw error;
                    alert(`${devicesToImport.length} Geräte erfolgreich importiert.`);
                    await fetchDevices();
                    await fetchCatalog();
                }
            } catch (e) {
                setError("Fehler beim Import: " + e.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleImportStandardModels = async () => {
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
                    const anschlusswert = 0.0;

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

    // Filter lists based on tab and search term
    const filteredDevices = devices.filter(d => {
        if (!d) return false;

        if (activeTab !== 'inventar') return false;

        const num = d.number ? String(d.number).toLowerCase() : '';
        const mod = d.model ? String(d.model).toLowerCase() : '';
        const typ = d.type ? String(d.type).toLowerCase() : '';
        const provider = d.rental_provider ? String(d.rental_provider).toLowerCase() : '';
        const search = searchTerm.toLowerCase();
        return num.includes(search) || mod.includes(search) || typ.includes(search) || provider.includes(search);
    });

    const filteredRentalDevices = rentalDevices.filter(device => {
        const search = searchTerm.trim().toLowerCase();
        if (!search) return true;
        return [device.device_number, device.device_type, device.apartment, device.room, device.report_id]
            .some(value => String(value || '').toLowerCase().includes(search));
    });

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
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '1.5rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(10px)'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Geräteverwaltung
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Zentrale Übersicht, Inventarliste und Pflege der Gerätetypen
                    </p>
                </div>
                <button onClick={onBack} className="btn btn-outline" style={{ borderRadius: '9999px', padding: '0.6rem 1.5rem' }}>
                    Dashboard
                </button>
            </div>

            {/* Tabs Selector Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => { setActiveTab('inventar'); setSearchTerm(''); setError(null); }}
                    style={{
                        padding: '0.6rem 1.5rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        border: '1.5px solid var(--primary)',
                        backgroundColor: activeTab === 'inventar' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'inventar' ? '#fff' : 'var(--primary)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Package size={16} />
                    Inventarliste
                </button>
                <button
                    onClick={() => { setActiveTab('mietgeraete'); setSearchTerm(''); setError(null); }}
                    style={{
                        padding: '0.6rem 1.5rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        border: '1.5px solid var(--primary)',
                        backgroundColor: activeTab === 'mietgeraete' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'mietgeraete' ? '#fff' : 'var(--primary)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Wrench size={16} />
                    Mietgeräte
                </button>
                <button
                    onClick={() => { setActiveTab('typen'); setSearchTerm(''); setError(null); }}
                    style={{
                        padding: '0.6rem 1.5rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        border: '1.5px solid var(--primary)',
                        backgroundColor: activeTab === 'typen' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'typen' ? '#fff' : 'var(--primary)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Activity size={16} />
                    Gerätetypen (Katalog)
                </button>
            </div>

            {/* Main Card */}
            <div className="card" style={{
                border: '1px solid var(--border)',
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                padding: '1.5rem'
            }}>
                {/* Search & Action Bar */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
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
                            placeholder={activeTab === 'typen' ? "Gerätetyp, Hersteller oder Modell durchsuchen..." : "Inventar-Nr., Modell oder Typ durchsuchen..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className="btn btn-outline"
                            onClick={activeTab === 'typen' ? handleImportStandardModels : handleImportStandardDevices}
                            style={{ borderRadius: '9999px', fontSize: '0.9rem' }}
                            disabled={isLoading || activeTab === 'mietgeraete'}
                        >
                            <Download size={18} />
                            Import
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setError(null);
                                if (activeTab === 'inventar') {
                                    setCurrentDevice({ 
                                        number: '', 
                                        catalog_id: catalog[0]?.id || '', 
                                        status: 'Aktiv',
                                        is_rental: false,
                                        rental_provider: '',
                                        rental_cost_daily: 0,
                                        rental_start: new Date().toISOString().split('T')[0],
                                        rental_end_planned: ''
                                    });
                                } else if (activeTab === 'mietgeraete') {
                                    return;
                                } else {
                                    setCurrentModel({ geraetetyp: 'Kondenstrockner', customGeraetetyp: '', hersteller: '', modell: '', anschlusswert: '' });
                                }
                                setIsEditing(true);
                            }}
                            style={{ borderRadius: '9999px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(15, 110, 163, 0.3)' }}
                            disabled={isLoading || activeTab === 'mietgeraete'}
                        >
                            <Plus size={18} />
                            {activeTab === 'typen' ? 'Gerätetyp hinzufügen' : activeTab === 'mietgeraete' ? 'Im Auftrag erfassen' : 'Gerät hinzufügen'}
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

                {/* Data Table */}
                <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                    {isLoading ? (
                        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" size={40} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                            <p style={{ fontWeight: 500 }}>Aktualisiere Daten...</p>
                        </div>
                    ) : activeTab === 'mietgeraete' ? (
                        /* MIETGERÄTE DASHBOARD UND TABELLE */
                        <div>
                            {/* Dashboard Cards */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                                <div className="card" style={{ flex: 1, minWidth: '220px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(96, 165, 250, 0.1)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Wrench size={22} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aktive Mietgeräte</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {rentalDevices.filter(d => !d.end_date).length} / {rentalDevices.length}
                                        </div>
                                    </div>
                                </div>
                                <div className="card" style={{ flex: 1, minWidth: '220px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Zap size={22} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Beendete Einsätze</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981' }}>
                                            {rentalDevices.filter(d => !!d.end_date).length}
                                        </div>
                                    </div>
                                </div>
                                <div className="card" style={{ flex: 1, minWidth: '220px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Activity size={22} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Vorläufige Typen</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#EF4444' }}>
                                            {rentalDevices.filter(d => catalog.find(c => c.id === d.catalog_id)?.catalog_status === 'provisional').length}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nr.</th>
                                        <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Typ / Modell</th>
                                        <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bereich / Raum</th>
                                        <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Installation</th>
                                        <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>Status</th>
                                        <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Projekt</th>
                                        <th style={{ background: 'transparent', textAlign: 'right' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRentalDevices.map(device => {
                                        const report = reports.find(r => r.id === device.report_id);
                                        const catalogItem = catalog.find(c => c.id === device.catalog_id);

                                        return (
                                            <tr key={device.id} style={{ transition: 'background 0.2s' }} className="report-row">
                                                <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Hash size={14} style={{ opacity: 0.5 }} />
                                                        {device.device_number}
                                                    </div>
                                                </td>
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
                                                            {DEVICE_ICONS[device.device_type] || <Package size={18} />}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{device.device_type}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{catalogItem?.catalog_status === 'provisional' ? 'Vorläufiger Typ' : `${catalogItem?.hersteller || ''} ${catalogItem?.modell || ''}`.trim() || '-'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{device.apartment || 'Allgemeiner Bereich'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{device.room || 'Kein Raum zugeordnet'}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{device.start_date ? new Date(device.start_date).toLocaleDateString('de-CH') : '-'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zähler: {device.counter_start ?? '-'}</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                                                        {device.end_date ? (
                                                            <span style={{
                                                                padding: '0.25rem 0.75rem',
                                                                borderRadius: '9999px',
                                                                background: 'rgba(148, 163, 184, 0.2)',
                                                                color: '#94A3B8',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                border: '1px solid rgba(148, 163, 184, 0.3)'
                                                            }}>
                                                                ABGEMELDET
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                padding: '0.25rem 0.75rem',
                                                                borderRadius: '9999px',
                                                                background: 'rgba(16, 185, 129, 0.1)',
                                                                color: '#10B981',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                                            }}>
                                                                IM EINSATZ
                                                            </span>
                                                        )}
                                                        {device.end_date && (
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                abgemeldet am {new Date(device.end_date).toLocaleDateString('de-CH')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {device.report_id ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                            {report ? (
                                                                <button
                                                                    onClick={() => onNavigateToReport && onNavigateToReport(device.report_id)}
                                                                    style={{
                                                                        color: 'var(--text-main)',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.85rem',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        padding: 0,
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left'
                                                                    }}
                                                                    title="Zum Projekt springen"
                                                                >
                                                                    {report.projectTitle || device.report_id}
                                                                    <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                                                </button>
                                                            ) : (
                                                                <div style={{ color: '#FCA5A5', fontWeight: 700, fontSize: '0.85rem' }}>
                                                                    {device.report_id}
                                                                </div>
                                                            )}
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                                {report?.locationDetails || 'Ort nicht definiert'}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', opacity: 0.6 }}>
                                                            Kein Projekt zugeordnet
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                                                        <button
                                                            className="btn btn-outline"
                                                            style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#EF4444', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                                                            onClick={(e) => { e.stopPropagation(); onNavigateToReport && onNavigateToReport(device.report_id); }}
                                                            title="Mietgerät im zugehörigen Auftrag abmelden"
                                                        >
                                                            <ExternalLink size={14} /> Zum Auftrag
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredRentalDevices.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                                                    <Wrench size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                                                        Keine aktiven Mietgeräte registriert.
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'inventar' ? (
                        /* INVENTAR TABELLE */
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nr.</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Typ</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Modell / kW</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>Status</th>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Aktueller Einsatz</th>
                                    <th style={{ background: 'transparent', textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDevices.map(device => {
                                    const report = device.current_project ? reports.find(r => r.id === device.current_project || r.projectTitle === device.current_project) : null;

                                    return (
                                        <tr key={device.id} style={{ transition: 'background 0.2s' }} className="report-row">
                                            <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Hash size={14} style={{ opacity: 0.5 }} />
                                                    {device.number}
                                                </div>
                                            </td>
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
                                                        {DEVICE_ICONS[device.type] || <Package size={18} />}
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{device.type}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{device.model || '-'}</div>
                                                {!['Datenlogger', 'Messgeräte'].includes(device.type) && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Zap size={12} /> {device.energy_consumption || '0.0'} kW
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '0.35rem 1rem',
                                                    borderRadius: '9999px',
                                                    background: device.current_project ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                    color: device.current_project ? '#FCA5A5' : '#10B981',
                                                    border: `1px solid ${device.current_project ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'} `,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em'
                                                }}>
                                                    <div style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: 'currentColor',
                                                        marginRight: '0.5rem',
                                                        boxShadow: '0 0 8px currentColor'
                                                    }}></div>
                                                    {device.current_project ? 'IM EINSATZ' : 'VERFÜGBAR'}
                                                </span>
                                            </td>
                                            <td>
                                                {device.current_project ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                        {report ? (
                                                            <button
                                                                onClick={() => onNavigateToReport && onNavigateToReport(device.current_project)}
                                                                style={{
                                                                    color: 'var(--text-main)',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.85rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem',
                                                                    padding: 0,
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left'
                                                                }}
                                                                title="Zum Projekt springen"
                                                            >
                                                                {report.projectTitle || device.current_project}
                                                                <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                                            </button>
                                                        ) : (
                                                            <div style={{
                                                                color: '#FCA5A5',
                                                                fontWeight: 700,
                                                                fontSize: '0.85rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem'
                                                            }}>
                                                                {device.current_project} <span style={{fontSize: '0.7rem', opacity: 0.8}}>(Nicht gefunden)</span>
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            fontSize: '0.75rem',
                                                            color: 'var(--primary)',
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}>
                                                            <MapPin size={10} />
                                                            {report?.locationDetails || 'Schadenort nicht definiert'}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                            {report?.client || 'Kein Kunde'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', opacity: 0.6 }}>Lager</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                    {device.current_project && (
                                                        <button
                                                            className="btn btn-ghost"
                                                            style={{ color: '#F59E0B', padding: '0.5rem', borderRadius: '8px' }}
                                                            onClick={(e) => { e.stopPropagation(); handleReleaseDevice(device.id, device.current_project); }}
                                                            title="Freigeben"
                                                        >
                                                            <LogOut size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-ghost"
                                                        style={{ color: 'var(--primary)', padding: '0.5rem', borderRadius: '8px' }}
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setCurrentDevice({
                                                                ...device,
                                                                is_rental: device.is_rental || false,
                                                                rental_provider: device.rental_provider || '',
                                                                rental_cost_daily: device.rental_cost_daily || 0,
                                                                rental_start: device.rental_start || new Date().toISOString().split('T')[0],
                                                                rental_end_planned: device.rental_end_planned || ''
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
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.id); }}
                                                        title="Löschen"
                                                    >
                                                        <Trash size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredDevices.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '5rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                                                <Package size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                                <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                                                    Keine Geräte im Inventar gefunden.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        /* GERÄTETYPEN TABELLE */
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Geräteart</th>
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
                                                <Zap size={14} /> {item.anschlusswert !== null && item.anschlusswert !== undefined ? item.anschlusswert : '0.0'} kW
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
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteModel(item.id); }}
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
                                                <Package size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                                <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                                                    Keine Gerätetypen im Katalog gefunden.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* MODAL FÜR INVENTAR (GERÄT) ERSTELLEN / BEARBEITEN */}
            {isEditing && currentDevice && (
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
                            onClick={() => { setIsEditing(false); setCurrentDevice(null); }}
                            style={{
                                position: 'absolute', top: '1.5rem', right: '1.5rem',
                                background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer',
                                width: '32px', height: '32px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-muted)', transition: 'all 0.2s'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                {currentDevice.id ? 'Inventar anpassen' : 'Neues Inventar anlegen'}
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Verknüpfen Sie ein Modell aus dem Gerätekatalog mit einer Inventarnummer.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Modell auswählen *</label>
                                <select
                                    className="form-input"
                                    value={currentDevice.catalog_id}
                                    onChange={(e) => setCurrentDevice(prev => ({ ...prev, catalog_id: e.target.value }))}
                                    style={{ background: 'rgba(15, 23, 42, 0.3)', width: '100%', color: 'white' }}
                                >
                                    <option value="" disabled>-- Modell aus Katalog wählen --</option>
                                    {catalog.map(cat => (
                                        <option key={cat.id} value={cat.id} style={{ backgroundColor: 'var(--surface)' }}>
                                            [{cat.geraetetyp}] {cat.hersteller} - {cat.modell} ({cat.anschlusswert || 0} kW)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Inventar-Nr. (Eindeutige ID) *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={currentDevice.number}
                                    onChange={(e) => setCurrentDevice(prev => ({ ...prev, number: e.target.value }))}
                                    placeholder={currentDevice.is_rental ? "z.B. M-101 (Mietgeräte müssen mit M beginnen)" : "z.B. QS-101"}
                                    style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Status</label>
                                <select
                                    className="form-input"
                                    value={currentDevice.status}
                                    onChange={(e) => setCurrentDevice(prev => ({ ...prev, status: e.target.value }))}
                                    style={{ background: 'rgba(15, 23, 42, 0.3)', width: '100%', color: 'white' }}
                                >
                                    <option value="Aktiv" style={{ backgroundColor: 'var(--surface)' }}>Aktiv</option>
                                    <option value="Verfügbar" style={{ backgroundColor: 'var(--surface)' }}>Verfügbar</option>
                                    <option value="Defekt" style={{ backgroundColor: 'var(--surface)' }}>Defekt</option>
                                    <option value="Abgemeldet" style={{ backgroundColor: 'var(--surface)' }}>Abgemeldet / Zurückgegeben</option>
                                </select>
                            </div>

                            {/* Mietgeräte Checkbox */}
                            {(!currentDevice.id || currentDevice.is_rental) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0' }}>
                                    <input
                                        type="checkbox"
                                        id="is_rental_checkbox"
                                        checked={currentDevice.is_rental || false}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setCurrentDevice(prev => {
                                                let num = prev.number;
                                                if (isChecked && !num.toUpperCase().startsWith('M')) {
                                                    num = 'M-' + num;
                                                }
                                                return {
                                                    ...prev,
                                                    is_rental: isChecked,
                                                    number: num
                                                };
                                            });
                                        }}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="is_rental_checkbox" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                                        Dieses Gerät ist ein Mietgerät
                                    </label>
                                </div>
                            )}

                            {/* Mietgeräte Zusatzfelder */}
                            {currentDevice.is_rental && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                        <label className="form-label" style={{ opacity: 0.8, fontSize: '0.8rem' }}>Vermieter / Partner *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={currentDevice.rental_provider || ''}
                                            onChange={(e) => setCurrentDevice(prev => ({ ...prev, rental_provider: e.target.value }))}
                                            placeholder="z.B. Boels, Zeppelin"
                                            style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ opacity: 0.8, fontSize: '0.8rem' }}>Mietgebühr pro Tag (€) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={currentDevice.rental_cost_daily || 0}
                                            onChange={(e) => setCurrentDevice(prev => ({ ...prev, rental_cost_daily: parseFloat(e.target.value) || 0 }))}
                                            placeholder="z.B. 12.50"
                                            style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ opacity: 0.8, fontSize: '0.8rem' }}>Mietbeginn *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={currentDevice.rental_start || ''}
                                            onChange={(e) => setCurrentDevice(prev => ({ ...prev, rental_start: e.target.value }))}
                                            style={{ background: 'rgba(15, 23, 42, 0.3)', color: 'white' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                        <label className="form-label" style={{ opacity: 0.8, fontSize: '0.8rem' }}>Geplantes Mietende</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={currentDevice.rental_end_planned || ''}
                                            onChange={(e) => setCurrentDevice(prev => ({ ...prev, rental_end_planned: e.target.value }))}
                                            style={{ background: 'rgba(15, 23, 42, 0.3)', color: 'white' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                            <button className="btn btn-outline" onClick={() => { setIsEditing(false); setCurrentDevice(null); }} style={{ flex: 1, borderRadius: '9999px' }}>
                                Abbrechen
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveDevice} disabled={isLoading || !currentDevice.number || !currentDevice.catalog_id} style={{ flex: 2, borderRadius: '9999px', fontWeight: 700 }}>
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (currentDevice.id ? 'Speichern' : 'Anlegen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FÜR GERÄTETYP ERSTELLEN / BEARBEITEN */}
            {isEditing && currentModel && (
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
                            onClick={() => { setIsEditing(false); setCurrentModel(null); }}
                            style={{
                                position: 'absolute', top: '1.5rem', right: '1.5rem',
                                background: 'rgba(255, 255, 255, 0.05)', border: 'none', cursor: 'pointer',
                                width: '32px', height: '32px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-muted)'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                {currentModel.id ? 'Gerätetyp bearbeiten' : 'Neuen Gerätetyp anlegen'}
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Definieren Sie die Modell- und Leistungsdaten im Katalog.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ opacity: 0.8 }}>Geräteart (Gerätetyp)</label>
                                <select
                                    className="form-input"
                                    value={currentModel.geraetetyp}
                                    onChange={(e) => setCurrentModel(prev => ({ ...prev, geraetetyp: e.target.value }))}
                                    style={{ background: 'rgba(15, 23, 42, 0.3)', width: '100%', color: 'white' }}
                                >
                                    {DEVICE_TYPES.map(type => (
                                        <option key={type} value={type} style={{ backgroundColor: 'var(--surface)' }}>{type}</option>
                                    ))}
                                    <option value="Sonstiges" style={{ backgroundColor: 'var(--surface)' }}>Eigene Eingabe...</option>
                                </select>
                            </div>

                            {currentModel.geraetetyp === 'Sonstiges' && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ opacity: 0.8, color: '#60A5FA' }}>Eigene Geräteart *</label>
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
                                <label className="form-label" style={{ opacity: 0.8 }}>Hersteller *</label>
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
                                <label className="form-label" style={{ opacity: 0.8 }}>Modell *</label>
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
                                <label className="form-label" style={{ opacity: 0.8 }}>Anschlusswert (kW) *</label>
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
                            <button className="btn btn-primary" onClick={handleSaveModel} disabled={isLoading} style={{ flex: 2, borderRadius: '9999px', fontWeight: 700 }}>
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (currentModel.id ? 'Speichern' : 'Hinzufügen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
