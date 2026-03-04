
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { parseAddress } from '../components/DamageForm/DamageForm.utils';
import { PDFService } from '../services/PDFService';

export const useDamageForm = (initialData, onSave, mode = 'desktop') => {
    const initialAddressParts = parseAddress(initialData?.address);

    const [formData, setFormData] = useState(() => (initialData ? {
        id: initialData.id,
        projectTitle: (initialData.projectTitle && !initialData.projectTitle.startsWith('TMP-')) ? initialData.projectTitle : (initialData.id && !initialData.id.startsWith('TMP-') ? initialData.id : ''),
        client: initialData.client || '',
        locationDetails: initialData.locationDetails || '',
        extractedData: initialData?.extractedData || null,
        exteriorPhoto: initialData.exteriorPhoto || null,
        clientSource: initialData.clientSource || '',
        propertyType: initialData.propertyType || '',
        damageCategory: initialData.damageCategory || 'Wasserschaden',
        assignedTo: initialData.assignedTo || '',
        address: initialData.address || '',
        street: initialData.street || initialAddressParts.street,
        zip: initialData.zip || initialAddressParts.zip,
        city: initialData.city || initialAddressParts.city,
        clientStreet: initialData.clientStreet || '',
        clientZip: initialData.clientZip || '',
        clientCity: initialData.clientCity || '',
        ownerName: initialData.ownerName || '',
        ownerStreet: initialData.ownerStreet || '',
        ownerZip: initialData.ownerZip || '',
        ownerCity: initialData.ownerCity || '',
        invoiceReference: initialData.invoiceReference || '',
        ownerEmail: initialData.ownerEmail || '',
        contacts: (initialData?.contacts && initialData.contacts.filter(c => c.name || c.phone).length > 0)
            ? initialData.contacts.filter(c => c.name || c.phone)
            : [
                { apartment: '', name: '', phone: '', role: 'Mieter' },
                { apartment: '', name: '', phone: '', role: 'Mieter' },
                { apartment: '', name: '', phone: '', role: 'Mieter' }
            ],
        notes: initialData?.notes || '',
        documents: initialData?.documents || [],
        damageType: initialData.type || '',
        damageTypeImage: initialData.damageTypeImage || null,
        status: initialData.status || 'Schadenaufnahme',
        cause: initialData.cause || '',
        description: initialData.description || '',
        findings: initialData.findings || '',
        dryingStarted: initialData.dryingStarted || null,
        dryingEnded: initialData.dryingEnded || null,
        equipment: Array.isArray(initialData.equipment) ? initialData.equipment : [],
        images: Array.isArray(initialData.images)
            ? initialData.images.map(img => typeof img === 'string' ? { preview: img, name: 'Existing Image', date: new Date().toISOString() } : img)
            : [],
        projectNumber: initialData.projectNumber || '',
        orderNumber: initialData.orderNumber || '',
        damageNumber: initialData.damageNumber || '',
        insurance: initialData.insurance || '',
        damageReportDate: initialData.damageReportDate || '',
        measures: initialData.measures || '',
        selectedMeasures: Array.isArray(initialData.selectedMeasures) ? initialData.selectedMeasures : [],
        includeDescriptionInReport: initialData.includeDescriptionInReport !== false,
        rooms: Array.isArray(initialData.rooms) ? initialData.rooms : []
    } : {
        id: null,
        projectTitle: '',
        projectNumber: '',
        orderNumber: '',
        damageNumber: '',
        insurance: '',
        damageReportDate: '',
        client: '',
        locationDetails: '',
        clientSource: '',
        propertyType: '',
        damageCategory: 'Wasserschaden',
        assignedTo: '',
        street: '',
        zip: '',
        city: '',
        clientStreet: '',
        clientZip: '',
        clientCity: '',
        ownerName: '',
        ownerStreet: '',
        ownerZip: '',
        ownerCity: '',
        invoiceReference: '',
        ownerEmail: '',
        contacts: [
            { apartment: '', name: '', phone: '', role: 'Mieter' },
            { apartment: '', name: '', phone: '', role: 'Mieter' },
            { apartment: '', name: '', phone: '', role: 'Mieter' }
        ],
        notes: '',
        documents: [],
        damageType: '',
        damageTypeImage: null,
        status: 'Schadenaufnahme',
        cause: '',
        description: '',
        findings: '',
        dryingStarted: null,
        dryingEnded: null,
        equipment: [],
        images: [],
        exteriorPhoto: null,
        measures: '',
        selectedMeasures: [],
        includeDescriptionInReport: true,
        rooms: []
    }));

    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [conflicts, setConflicts] = useState({});
    const [availableDevices, setAvailableDevices] = useState([]);
    const [deviceFetchError, setDeviceFetchError] = useState(null);
    const [extractedData, setExtractedData] = useState(null);

    // Auto-Save Effect
    useEffect(() => {
        if (!formData.projectTitle && !formData.id) return;

        const timer = setTimeout(async () => {
            if (!formData.projectTitle && !formData.id) return;

            setIsSaving(true);
            const fullAddress = `${formData.street}, ${formData.zip} ${formData.city}`;
            const reportData = {
                ...formData,
                address: fullAddress,
                type: formData.damageType,
                imageCount: formData.images.length
            };

            try {
                const savedReport = await onSave(reportData, true);
                if (savedReport && savedReport.id && !formData.id) {
                    setFormData(prev => ({ ...prev, id: savedReport.id }));
                }
            } catch (err) {
                console.error("Auto-save failed", err);
            } finally {
                setIsSaving(false);
                setLastSaved(new Date());
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [formData, onSave]);

    // Fetch available devices
    useEffect(() => {
        if (!supabase) {
            setDeviceFetchError("Supabase connection missing");
            return;
        }
        const fetchAvail = async () => {
            const { data, error } = await supabase
                .from('devices')
                .select('*')
                .is('current_report_id', null)
                .order('number', { ascending: true });

            if (error) {
                console.error("Error fetching devices:", error);
                setDeviceFetchError(error.message);
            } else {
                setAvailableDevices(data || []);
            }
        };
        fetchAvail();
    }, []);

    // Ensure 3 contacts exist
    useEffect(() => {
        if (mode === 'desktop' && formData.contacts && formData.contacts.length < 3) {
            setFormData(prev => {
                const current = prev.contacts || [];
                if (current.length >= 3) return prev;
                const needed = 3 - current.length;
                const extras = Array(needed).fill(null).map(() => ({
                    name: '', role: 'Mieter', apartment: '', floor: '', phone: ''
                }));
                return { ...prev, contacts: [...current, ...extras] };
            });
        }
    }, [formData.contacts, mode]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleEmailImport = useCallback((data) => {
        if (!data) return;
        setFormData(prev => {
            const newConflicts = { ...conflicts };
            const nextData = { ...prev };
            const mergeField = (path, newVal) => {
                if (!newVal) return;
                const currentVal = prev[path];
                if (!currentVal || currentVal.toString().trim() === "") {
                    nextData[path] = newVal;
                } else if (currentVal.toString().trim() !== newVal.toString().trim()) {
                    newConflicts[path] = { original: currentVal, newValue: newVal };
                    nextData[path] = newVal;
                }
            };

            if (data.projekt_daten) {
                mergeField('projectNumber', data.projekt_daten.interne_id);
                mergeField('orderNumber', data.projekt_daten.externe_ref);
                mergeField('damageNumber', data.projekt_daten.auftrags_nr);
            }
            if (data.auftrag_verwaltung) {
                mergeField('client', data.auftrag_verwaltung.firma);
                mergeField('assignedTo', data.auftrag_verwaltung.sachbearbeiter);
                if (data.auftrag_verwaltung.leistungsart) {
                    mergeField('damageCategory', data.auftrag_verwaltung.leistungsart);
                }
            }
            if (data.rechnungs_details) {
                mergeField('ownerName', data.rechnungs_details.eigentuemer);
                mergeField('ownerEmail', data.rechnungs_details.email_rechnung);
                mergeField('invoiceReference', data.rechnungs_details.vermerk);
            }
            if (data.schadenort) {
                mergeField('street', data.schadenort.strasse_nr);
                mergeField('locationDetails', data.schadenort.etage_wohnung);
                if (data.schadenort.plz_ort) {
                    const parts = data.schadenort.plz_ort.trim().split(/\s+/);
                    if (parts.length >= 1) {
                        const zipCandidate = parts[0];
                        if (zipCandidate.length === 4 && /^\d+$/.test(zipCandidate)) {
                            mergeField('zip', zipCandidate);
                            mergeField('city', parts.slice(1).join(' '));
                        } else {
                            mergeField('city', data.schadenort.plz_ort);
                        }
                    }
                }
            }

            let currentContacts = [...(prev.contacts || [])];
            if (data.kontakte && Array.isArray(data.kontakte)) {
                data.kontakte.forEach(newContact => {
                    const existingIdx = currentContacts.findIndex(c =>
                        c.name && newContact.name &&
                        c.name.trim().toLowerCase() === newContact.name.trim().toLowerCase()
                    );
                    if (existingIdx !== -1) {
                        currentContacts[existingIdx] = {
                            ...currentContacts[existingIdx],
                            phone: currentContacts[existingIdx].phone || newContact.telefon,
                            role: currentContacts[existingIdx].role || newContact.rolle,
                        };
                    } else {
                        currentContacts.push({
                            name: newContact.name,
                            phone: newContact.telefon,
                            role: newContact.rolle || 'Mieter',
                            apartment: ''
                        });
                    }
                });
            }
            nextData.contacts = currentContacts;
            setConflicts(newConflicts);
            return nextData;
        });
    }, [conflicts]);

    const handleAddRoom = useCallback((roomData) => {
        if (!roomData.name && !roomData.customName) return;
        const finalName = roomData.name === "Sonstiges / Eigener Name" ? roomData.customName : roomData.name;
        if (!finalName) return;

        const roomEntry = {
            id: Date.now(),
            name: finalName,
            apartment: roomData.apartment,
            stockwerk: roomData.stockwerk
        };
        setFormData(prev => ({ ...prev, rooms: [...prev.rooms, roomEntry] }));
    }, []);

    const handleRemoveRoom = useCallback((id) => {
        setFormData(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
    }, []);

    const handleImageUpload = async (files, contextData = {}) => {
        if (!files || files.length === 0) return;

        for (const file of files) {
            const previewUrl = URL.createObjectURL(file);
            const tempId = Math.random().toString(36).substring(7);
            const fileExt = file.name.split('.').pop().toLowerCase();
            const isDoc = ['pdf', 'msg', 'txt'].includes(fileExt);

            const imageEntry = {
                id: tempId,
                file,
                preview: previewUrl,
                name: file.name,
                date: new Date().toISOString(),
                ...contextData,
                includeInReport: true,
                uploading: true,
                type: isDoc ? 'document' : 'image',
                fileType: fileExt
            };

            setFormData(prev => ({
                ...prev,
                images: [...prev.images, imageEntry]
            }));

            if (supabase) {
                try {
                    const fileName = `cases/${formData.id || 'temp'}/images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                    const { error } = await supabase.storage.from('case-files').upload(fileName, file);
                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage.from('case-files').getPublicUrl(fileName);

                    setFormData(prev => ({
                        ...prev,
                        images: prev.images.map(img =>
                            img.id === tempId ? { ...img, preview: publicUrl, storagePath: fileName, uploading: false } : img
                        )
                    }));
                } catch (error) {
                    console.error('Upload failed:', error);
                    setFormData(prev => ({
                        ...prev,
                        images: prev.images.map(img =>
                            img.id === tempId ? { ...img, error: true, uploading: false } : img
                        )
                    }));
                }
            } else {
                setFormData(prev => ({
                    ...prev,
                    images: prev.images.map(img =>
                        img.id === tempId ? { ...img, uploading: false } : img
                    )
                }));
            }
        }
    };

    const handleCategoryDrop = useCallback((e, category) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        handleImageUpload(files, { assignedTo: category });
    }, []);

    const handleCategorySelect = useCallback((e, category) => {
        const files = Array.from(e.target.files);
        handleImageUpload(files, { assignedTo: category });
    }, []);

    const handleRoomImageDrop = useCallback((e, room) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        handleImageUpload(files, { assignedTo: room.name, roomId: room.id });
    }, []);

    const handleRoomImageSelect = useCallback((e, room) => {
        const files = Array.from(e.target.files);
        handleImageUpload(files, { assignedTo: room.name, roomId: room.id });
    }, []);

    const generatePDFExport = async (customFormData = null) => {
        const dataToUse = customFormData || formData;
        setIsGeneratingPDF(true);
        try {
            const { blob, fileName } = await PDFService.generateReport(dataToUse, supabase);
            PDFService.downloadBlob(blob, fileName);
            const file = new File([blob], fileName, { type: 'application/pdf' });
            await handleImageUpload([file], { assignedTo: 'Schadensbericht' });
        } catch (error) {
            console.error("PDF Export failed", error);
            alert("Fehler beim Erstellen des PDFs: " + error.message);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleExteriorPhotoUpload = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setFormData(prev => ({ ...prev, exteriorPhoto: reader.result }));
        reader.readAsDataURL(file);
    }, []);

    const removeExteriorPhoto = useCallback(() => {
        setFormData(prev => ({ ...prev, exteriorPhoto: null }));
    }, []);

    const totalDryingHours = (formData.equipment || []).reduce((acc, dev) => acc + (parseFloat(dev.hours) || 0), 0);
    const totalDryingKwh = (formData.equipment || []).reduce((acc, dev) => {
        let val = 0;
        if (dev.counterEnd && dev.counterStart) {
            val = parseFloat(dev.counterEnd) - parseFloat(dev.counterStart);
        } else if (dev.energyConsumption && dev.hours) {
            val = parseFloat(dev.energyConsumption) * parseFloat(dev.hours);
        }
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return {
        formData,
        setFormData,
        isSaving,
        lastSaved,
        isGeneratingPDF,
        setIsGeneratingPDF,
        conflicts,
        setConflicts,
        availableDevices,
        setAvailableDevices,
        deviceFetchError,
        extractedData,
        setExtractedData,
        handleImageUpload,
        generatePDFExport,
        handleInputChange,
        handleEmailImport,
        handleAddRoom,
        handleRemoveRoom,
        handleCategoryDrop,
        handleCategorySelect,
        handleRoomImageDrop,
        handleRoomImageSelect,
        handleExteriorPhotoUpload,
        removeExteriorPhoto,
        totalDryingHours,
        totalDryingKwh
    };
};
