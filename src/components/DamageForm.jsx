import { useState, useEffect, useRef } from 'react'
import { Save, X, RotateCcw, Image, AlertTriangle, Map, Trash, CheckCircle, FileText, Mail, Folder, Plus, Camera, MapPin, Circle, Edit3 } from 'lucide-react'

import { swissPLZ } from '../data/swiss_plz';
import { DEVICE_INVENTORY } from '../data/device_inventory';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../supabaseClient';
import ImageEditor from './ImageEditor';
import EmailImportModal from './EmailImportModalV2';

const STEPS = ['Schadenaufnahme', 'Leckortung', 'Trocknung', 'Instandsetzung']

const statusColors = {
    'Schadenaufnahme': 'bg-gray-100',
    'Leckortung': 'bg-blue-100',
    'Trocknung': 'bg-yellow-100',
    'Instandsetzung': 'bg-green-100',
    'Abgeschlossen': 'bg-gray-200'
}

const ROOM_OPTIONS = [
    "Wohnzimmer",
    "Bad",
    "Dusche",
    "Flur",
    "Schlafzimmer",
    "Treppenhaus",
    "Keller",
    "Garage",
    "Küche",
    "Abstellkammer",
    "Gäste-WC",
    "Kinderzimmer",
    "Esszimmer",
    "Arbeitszimmer / Büro",
    "Hauswirtschaftsraum (HWR)",
    "Dachboden"
];

const getDaysDiff = (start, end) => {
    if (!start || !end) return 0;
    const date1 = new Date(start);
    const date2 = new Date(end);
    const diffTime = Math.abs(date2 - date1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

const addAnnotationToImage = (imgSrc, type = 'circle') => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (type === 'circle') {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = Math.max(5, Math.min(canvas.width, canvas.height) * 0.015); // Dynamic line width
                ctx.beginPath();
                const radius = Math.min(canvas.width, canvas.height) * 0.25;
                ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, 2 * Math.PI);
                ctx.stroke();
            }

            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => resolve(imgSrc); // Fallback
        img.src = imgSrc;
    });
};

export default function DamageForm({ onCancel, initialData, onSave, mode = 'desktop' }) {
    // Helper to parse address string if editing
    const parseAddress = (addr) => {
        if (!addr) return { street: '', zip: '', city: '' };
        // Simple heuristic: assumes "Street 123, 1234 City" or similar
        // We try to extract ZIP (4 or 5 digits)
        const zipMatch = addr.match(/\b\d{4,5}\b/);
        let zip = zipMatch ? zipMatch[0] : '';
        let street = '';
        let city = '';

        if (zip) {
            const parts = addr.split(zip);
            street = parts[0].replace(/,\s*$/, '').trim();
            city = parts[1] ? parts[1].trim() : '';
        } else {
            street = addr;
        }
        return { street, zip, city };
    }

    const initialAddressParts = parseAddress(initialData?.address);

    const [formData, setFormData] = useState(initialData ? {
        id: initialData.id, // Keep ID if editing
        projectTitle: initialData.projectTitle || initialData.id || '', // Include projectTitle
        client: initialData.client || '',
        locationDetails: initialData.locationDetails || '', // New field for Schadenort (e.g. "Wohnung ...")
        clientSource: initialData.clientSource || '',
        propertyType: initialData.propertyType || '',
        assignedTo: initialData.assignedTo || '',
        address: initialData.address || '', // Store full address as fallback
        street: initialAddressParts.street,
        zip: initialAddressParts.zip,
        city: initialAddressParts.city,

        contacts: initialData?.contacts || [
            { apartment: '', name: '', phone: '' },
            { apartment: '', name: '', phone: '' },
            { apartment: '', name: '', phone: '' },
            { apartment: '', name: '', phone: '' }
        ],
        notes: initialData?.notes || '',
        documents: initialData?.documents || [],

        damageType: initialData.type || '',
        status: initialData.status || 'Schadenaufnahme',
        description: initialData.description || '',
        dryingStarted: initialData.dryingStarted || null,
        dryingEnded: initialData.dryingEnded || null,
        equipment: Array.isArray(initialData.equipment) ? initialData.equipment : [],
        images: Array.isArray(initialData.images)
            ? initialData.images.map(img => typeof img === 'string' ? { preview: img, name: 'Existing Image', date: new Date().toISOString() } : img)
            : [],
        rooms: Array.isArray(initialData.rooms) ? initialData.rooms : []
    } : {
        id: null,
        projectTitle: '',
        client: '',
        locationDetails: '',
        clientSource: '',
        propertyType: '',
        assignedTo: '',
        street: '',
        zip: '',
        city: '',
        // address: '',
        contacts: [
            { apartment: '', name: '', phone: '' },
            { apartment: '', name: '', phone: '' },
            { apartment: '', name: '', phone: '' },
            { apartment: '', name: '', phone: '' }
        ],
        damageType: '',
        status: 'Schadenaufnahme',
        description: '',
        dryingStarted: null,
        dryingEnded: null,
        equipment: [],
        images: [],
        rooms: []
    })

    const [newRoom, setNewRoom] = useState({
        name: '',
        apartment: ''
    })

    const [editingImage, setEditingImage] = useState(null);
    const [showEmailImport, setShowEmailImport] = useState(false);

    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportCause, setReportCause] = useState(initialData && initialData.cause ? initialData.cause : '');

    // AUTO-SAVE: Save formData 1 second after last change
    // AND save on unmount/unfocus to prevent data loss

    // Ref to hold latest formData for unmount cleanup
    const latestFormData = useRef(formData);
    // Ref to hold last successfully saved data to prevent loops
    const lastSavedData = useRef(formData);

    useEffect(() => {
        latestFormData.current = formData;
    }, [formData]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (onSave) {
                // DIRTY CHECK: Only save if data has actually changed
                if (JSON.stringify(formData) !== JSON.stringify(lastSavedData.current)) {
                    console.log("Auto-Save triggered (Data Changed). Equipment:", formData.equipment.length);
                    // Pass true as second argument to indicate "silent" save
                    onSave(formData, true);
                    lastSavedData.current = formData;
                } else {
                    console.log("Auto-Save skipped (No structural changes)");
                }
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [formData, onSave]);

    // Save on Unmount
    useEffect(() => {
        return () => {
            console.log("Component Unmounting - Saving final state...");
            if (onSave && JSON.stringify(latestFormData.current) !== JSON.stringify(lastSavedData.current)) {
                onSave(latestFormData.current, true);
            }
        };
    }, [onSave]);

    const [newDevice, setNewDevice] = useState({
        deviceNumber: '',
        apartment: '',
        room: '',
        startDate: new Date().toISOString().split('T')[0], // Default to today
        counterStart: ''
    })

    const handleAddDevice = () => {
        if (!newDevice.deviceNumber || !newDevice.room) return

        console.log("handleAddDevice: Adding device...", newDevice);
        console.log("Current equipment length:", formData.equipment.length);

        const device = {
            id: Date.now(),
            deviceNumber: newDevice.deviceNumber,
            apartment: newDevice.apartment,
            room: newDevice.room,
            startDate: newDevice.startDate || new Date().toISOString().split('T')[0],
            endDate: '',
            hours: '',
            counterStart: newDevice.counterStart,
            counterEnd: ''
        }

        setFormData(prev => {
            const nextEquipment = [...prev.equipment, device];
            console.log("Updated equipment length will be:", nextEquipment.length);
            return {
                ...prev,
                equipment: nextEquipment
            };
        })

        // Reset form, but maybe keep date?
        setNewDevice({
            deviceNumber: '',
            apartment: '',
            room: '',
            startDate: new Date().toISOString().split('T')[0],
            counterStart: ''
        })
    }

    const handleRemoveDevice = (id) => {
        setFormData(prev => ({
            ...prev,
            equipment: prev.equipment.filter(item => item.id !== id)
        }))
    }

    // --- Contact Handler ---
    const handleAddContact = () => {
        setFormData(prev => ({
            ...prev,
            contacts: [...prev.contacts, { name: '', phone: '', apartment: '', role: 'Mieter' }]
        }));
    };

    const handleRemoveContact = (index) => {
        setFormData(prev => ({
            ...prev,
            contacts: prev.contacts.filter((_, i) => i !== index)
        }));
    };

    // --- Image Upload Handler (Supabase) ---
    const handleImageUpload = async (files, contextData = {}) => {
        if (!files || files.length === 0) return;

        const newImages = [];
        for (const file of files) {
            // Optimistic UI: Show local preview immediately
            const previewUrl = URL.createObjectURL(file);
            const tempId = Math.random().toString(36).substring(7);

            // Basic metadata
            const imageEntry = {
                id: tempId,
                file, // Keep file for potential retry or local usage
                preview: previewUrl,
                name: file.name,
                date: new Date().toISOString(),
                ...contextData,
                includeInReport: true, // Default to true
                uploading: true // Mark as uploading
            };

            // Add to state immediately (optimistic)
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, imageEntry]
            }));

            // Upload to Supabase if client exists
            if (supabase) {
                try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${formData.id || 'temp'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                    const { data, error } = await supabase.storage
                        .from('images')
                        .upload(fileName, file);

                    if (error) throw error;

                    // Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('images')
                        .getPublicUrl(fileName);

                    // Update state with real URL and remove uploading flag
                    setFormData(prev => ({
                        ...prev,
                        images: prev.images.map(img =>
                            img.id === tempId ? { ...img, preview: publicUrl, storagePath: fileName, uploading: false } : img
                        )
                    }));

                } catch (error) {
                    console.error('Upload failed:', error);
                    // Mark as error
                    setFormData(prev => ({
                        ...prev,
                        images: prev.images.map(img =>
                            img.id === tempId ? { ...img, error: true, uploading: false } : img
                        )
                    }));
                }
            } else {
                // Offline / No Supabase: Keep local preview, mark as not uploading (simulated success)
                setFormData(prev => ({
                    ...prev,
                    images: prev.images.map(img =>
                        img.id === tempId ? { ...img, uploading: false } : img
                    )
                }));
            }
        }
    };

    const handleRoomImageDrop = (e, room) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.color = 'var(--text-muted)';

        const files = Array.from(e.dataTransfer.files);
        handleImageUpload(files, {
            assignedTo: room.name,
            roomId: room.id
        });
    };

    const handleRoomImageSelect = (e, room) => {
        const files = Array.from(e.target.files);
        handleImageUpload(files, {
            assignedTo: room.name,
            roomId: room.id
        });
    };

    const handleCategoryDrop = (e, category) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.color = 'var(--text-muted)';

        const files = Array.from(e.dataTransfer.files);
        handleImageUpload(files, {
            assignedTo: category
        });
    };

    const handleCategorySelect = (e, category) => {
        const files = Array.from(e.target.files);
        handleImageUpload(files, {
            assignedTo: category
        });
    };

    const handleAddRoom = () => {
        if (!newRoom.name) return;

        const roomEntry = {
            id: Date.now(),
            name: newRoom.name,
            apartment: newRoom.apartment
        };

        setFormData(prev => ({
            ...prev,
            rooms: [...prev.rooms, roomEntry]
        }));

        setNewRoom({ name: '', apartment: '' });
    }

    const handleRemoveRoom = (id) => {
        setFormData(prev => ({
            ...prev,
            rooms: prev.rooms.filter(r => r.id !== id)
        }));
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleStartDrying = () => {
        const now = new Date().toISOString().split('T')[0]
        setFormData(prev => ({
            ...prev,
            dryingStarted: now,
            status: 'Trocknung'
        }))
    }

    const handleEndDrying = () => {
        // Validate input
        if (formData.equipment.length > 0) {
            const incompleteDevices = formData.equipment.filter(d => !d.counterEnd || !d.hours || !d.endDate);
            if (incompleteDevices.length > 0) {
                alert(`Bitte erfassen Sie zuerst für alle Geräte die End-Daten (End-Datum, Zähler Ende, Stunden).\n\nFehlende Einträge bei: ${incompleteDevices.map(d => '#' + d.deviceNumber).join(', ')}`);
                return;
            }
        }

        const now = new Date().toISOString().split('T')[0]
        setFormData(prev => ({
            ...prev,
            dryingEnded: now,
            // Optionally auto-advance status
        }))
    }




    const handleSubmit = (e) => {
        e.preventDefault()

        // Combine address parts
        const fullAddress = `${formData.street}, ${formData.zip} ${formData.city}`;

        // Map form data back to report structure
        const reportData = {
            ...formData,
            address: fullAddress, // Save standardized address string
            type: formData.damageType, // Map back to 'type'
            imageCount: formData.images.length
        }
        onSave(reportData)
    }

    const handleEmailImport = (data) => {
        // Prepare exactly 4 contacts, no matter what
        const importedContacts = data.contacts || [];

        // Debug Alert
        alert(`Formular hat Daten erhalten:\nKunde: ${data.client}\nKontakte: ${importedContacts.length} gefunden.`);

        const finalContacts = [
            importedContacts[0] || { name: '', phone: '', apartment: '' },
            importedContacts[1] || { name: '', phone: '', apartment: '' },
            importedContacts[2] || { name: '', phone: '', apartment: '' },
            importedContacts[3] || { name: '', phone: '', apartment: '' }
        ];

        // Ensure objects are clean
        finalContacts.forEach(c => {
            if (!c.name) c.name = '';
            if (!c.phone) c.phone = '';
            if (!c.apartment) c.apartment = '';
        });

        console.log("Setting State Contacts:", finalContacts);

        setFormData(prev => ({
            ...prev,
            projectTitle: data.projectTitle || prev.projectTitle,
            client: data.client || prev.client,
            street: data.street || prev.street,
            zip: data.zip || prev.zip,
            city: data.city || prev.city,
            description: data.description || prev.description,
            damageType: data.damageType || prev.damageType,
            contacts: finalContacts // HARD OVERWRITE
        }));
        setShowEmailImport(false);
    };

    const generatePDFContent = async () => {
        setIsGeneratingPDF(true);
        // Allow time for render
        setTimeout(async () => {
            try {
                const doc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 20; // 20mm margin
                const contentWidth = pageWidth - (margin * 2);

                let currentY = margin;

                // Helper to add footer
                const addFooter = (pdfDoc, pageNum) => {
                    pdfDoc.setFontSize(8);
                    pdfDoc.setTextColor(150, 150, 150); // Gray
                    const footerText = `Q-Service AG | Kriesbachstrasse 30, 8600 Dübendorf | www.q-service.ch | +41 43 819 14 18`;
                    const textWidth = pdfDoc.getTextWidth(footerText);
                    pdfDoc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 10);
                };

                // Get all sections marked for PDF generation
                const sections = document.querySelectorAll('#print-report .pdf-section');

                // Add initial footer
                addFooter(doc, 1);

                for (let i = 0; i < sections.length; i++) {
                    const section = sections[i];

                    // Capture section
                    const canvas = await html2canvas(section, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const imgHeight = (canvas.height * contentWidth) / canvas.width;

                    // Check if we need a new page
                    // Buffer of 10mm to be safe
                    if (currentY + imgHeight > pageHeight - margin) {
                        doc.addPage();
                        currentY = margin;
                        addFooter(doc);
                    }

                    doc.addImage(imgData, 'PNG', margin, currentY, contentWidth, imgHeight);

                    // Add some spacing after each section
                    currentY += imgHeight + 5;
                }

                // Generate Blob
                const pdfBlob = doc.output('blob');
                const pdfFile = new File([pdfBlob], `Schadensbericht_${formData.id || 'Neu'}.pdf`, { type: 'application/pdf' });

                // Add to Documents (Sonstiges)
                const reader = new FileReader();
                reader.readAsDataURL(pdfFile);
                reader.onloadend = () => {
                    // Only add if it doesn't exist (simple check by name to avoid dupes on multiple gens?)
                    // Actually user might want versions. We keep appending.
                    const newImage = {
                        file: pdfFile,
                        preview: null,
                        name: pdfFile.name,
                        assignedTo: 'Sonstiges',
                        roomId: null
                    };
                    setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, newImage]
                    }));
                };

                // Trigger download
                doc.save(`Schadensbericht_${formData.id || 'Neu'}.pdf`);

            } catch (err) {
                console.error("PDF Generation failed", err);
                alert("Fehler beim Erstellen des PDF Berichts.");
            } finally {
                setIsGeneratingPDF(false);
            }
        }, 500); // 500ms delay to ensure render
    }

    const handlePDFClick = () => {
        console.log("PDF Button Clicked - Opening Modal");
        setShowReportModal(true);
    }



    if (mode === 'technician') {
        return (
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--primary)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        {formData.projectTitle || 'Projekt'}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                            className="form-input"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem', width: 'auto' }}
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        >
                            {Object.keys(statusColors).map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <button onClick={onCancel} className="btn btn-ghost" style={{ padding: '0.5rem' }}>✕</button>
                    </div>
                </div>

                {/* 1. Address (Schadenort) */}
                <div style={{ marginBottom: '1.5rem', backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '8px', color: '#1F2937' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827' }}>
                        <MapPin size={18} /> Schadenort
                    </h3>
                    <div style={{ fontSize: '1rem', lineHeight: '1.4' }}>
                        {formData.street ? (
                            <>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{formData.client}</div>
                                {formData.locationDetails && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{formData.locationDetails}</div>}
                                {formData.street}<br />
                                {formData.zip} {formData.city}
                            </>
                        ) : (
                            formData.address || 'Keine Adresse'
                        )}
                    </div>
                </div>

                {/* 2. Contacts */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Kontakte</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {formData.contacts.map((contact, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', backgroundColor: 'white', border: '1px solid #E5E7EB', padding: '0.75rem', borderRadius: '8px', position: 'relative' }}>
                                {/* Row 1: Name & Role */}
                                <input
                                    type="text"
                                    placeholder="Name"
                                    className="form-input"
                                    value={contact.name}
                                    onChange={(e) => {
                                        const newContacts = [...formData.contacts];
                                        newContacts[idx].name = e.target.value;
                                        setFormData({ ...formData, contacts: newContacts });
                                    }}
                                    style={{ fontWeight: 600 }}
                                />
                                <select
                                    className="form-input"
                                    value={contact.role || 'Mieter'}
                                    onChange={(e) => {
                                        const newContacts = [...formData.contacts];
                                        newContacts[idx].role = e.target.value;
                                        setFormData({ ...formData, contacts: newContacts });
                                    }}
                                >
                                    <option value="Mieter">Mieter</option>
                                    <option value="Eigentümer">Eigentümer</option>
                                    <option value="Hauswart">Hauswart</option>
                                    <option value="Verwaltung">Verwaltung</option>
                                    <option value="Handwerker">Handwerker</option>
                                    <option value="Sonstiges">Sonstiges</option>
                                </select>

                                {/* Row 2: Apartment & Phone */}
                                <input
                                    type="text"
                                    placeholder="Wohnung / Etage"
                                    className="form-input"
                                    value={contact.apartment}
                                    onChange={(e) => {
                                        const newContacts = [...formData.contacts];
                                        newContacts[idx].apartment = e.target.value;
                                        setFormData({ ...formData, contacts: newContacts });
                                    }}
                                    style={{ fontSize: '0.9rem' }}
                                />
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Telefon"
                                        className="form-input"
                                        value={contact.phone}
                                        onChange={(e) => {
                                            const newContacts = [...formData.contacts];
                                            newContacts[idx].phone = e.target.value;
                                            setFormData({ ...formData, contacts: newContacts });
                                        }}
                                        style={{ flex: 1, fontSize: '0.9rem' }}
                                    />
                                    {contact.phone && (
                                        <a href={`tel:${contact.phone}`} className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--success)' }} title="Anrufen">
                                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                        </a>
                                    )}
                                </div>

                                {/* Delete Button (Absolute top-right or separate) */}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveContact(idx)}
                                    style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'white', border: '1px solid #EF4444', borderRadius: '50%', color: '#EF4444', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    title="Kontakt entfernen"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add Contact Button */}
                    <button
                        type="button"
                        onClick={handleAddContact}
                        style={{
                            marginTop: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--primary)',
                            background: 'none',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '0.25rem 0'
                        }}
                    >
                        <Plus size={18} />
                        Kontakt hinzufügen
                    </button>
                    <br />
                </div>

                {/* 3. Rooms & Photos */}
                <div style={{ marginBottom: '2rem' }}>
                    {formData.status !== 'Trocknung' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                Räume / Fotos
                            </h3>
                            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
                                <select
                                    value={newRoom.name}
                                    onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                                    className="form-input"
                                    style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                >
                                    <option value="">Raum wählen...</option>
                                    {ROOM_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    <option value="Sonstiges">Sonstiges</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Wohnung (Optional)"
                                    value={newRoom.apartment}
                                    onChange={(e) => setNewRoom(prev => ({ ...prev, apartment: e.target.value }))}
                                    className="form-input"
                                    style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                />
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleAddRoom}
                                disabled={!newRoom.name}
                                style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
                            >
                                <Plus size={16} /> Raum hinzufügen
                            </button>
                        </div>
                    )}

                    {formData.status !== 'Trocknung' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {formData.rooms.map(room => (
                                <div key={room.id} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
                                    <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1F2937' }}>
                                        <span style={{ fontWeight: 600 }}>{room.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>{room.apartment}</span>
                                    </div>
                                    <div style={{ padding: '0.75rem' }}>
                                        <>
                                            {/* Image List with Descriptions */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                                {formData.images.filter(img => img.roomId === room.id).map((img, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid #E5E7EB', padding: '0.5rem', borderRadius: '6px', backgroundColor: '#F9FAFB' }}>
                                                        {/* Thumbnail check */}
                                                        <div style={{ flex: '0 0 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                                            <div style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
                                                                <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => window.open(img.preview, '_blank')} />
                                                            </div>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', cursor: 'pointer', color: '#374151' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    style={{ accentColor: 'var(--primary)' }}
                                                                    checked={img.includeInReport !== false}
                                                                    onChange={(e) => {
                                                                        const isChecked = e.target.checked;
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            images: prev.images.map(i => i === img ? { ...i, includeInReport: isChecked } : i)
                                                                        }));
                                                                    }}
                                                                />
                                                                Bericht
                                                            </label>
                                                            <button
                                                                type="button"
                                                                title="Roten Kreis hinzufügen"
                                                                style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '2px', marginTop: '2px' }}
                                                                onClick={async () => {
                                                                    if (window.confirm('Möchten Sie einen roten Kreis in die Mitte dieses Bildes einfügen?')) {
                                                                        const newPreview = await addAnnotationToImage(img.preview);
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            images: prev.images.map(i => i === img ? { ...i, preview: newPreview } : i)
                                                                        }));
                                                                    }
                                                                }}
                                                            >
                                                                <Circle size={14} fill="none" strokeWidth={3} />
                                                            </button>
                                                        </div>

                                                        {/* File Info & Description */}
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {img.name}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Beschreibung hinzufügen..."
                                                                className="form-input"
                                                                style={{ fontSize: '0.9rem', padding: '0.4rem', width: '100%' }}
                                                                value={img.description || ''}
                                                                onChange={(e) => {
                                                                    const newDesc = e.target.value;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        images: prev.images.map(i => i === img ? { ...i, description: newDesc } : i)
                                                                    }));
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Actions: Delete */}
                                                        <div>
                                                            <button
                                                                type="button"
                                                                className="btn btn-ghost"
                                                                style={{ color: '#EF4444', padding: '0.25rem' }}
                                                                onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter(i => i !== img) }))}
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {formData.images.filter(img => img.roomId === room.id).length === 0 && (
                                                    <div style={{ fontSize: '0.85rem', color: '#9CA3AF', fontStyle: 'italic', marginBottom: '0.5rem' }}>Keine Bilder</div>
                                                )}
                                            </div>

                                            {/* Add Photo Button - Very Prominent */}
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                width: '100%',
                                                padding: '0.75rem',
                                                backgroundColor: 'var(--primary)',
                                                color: 'white',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}>
                                                <Camera size={20} />
                                                Foto hinzufügen
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    multiple
                                                    onChange={(e) => handleImageUpload(e, room.id)}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        </>
                                    </div>
                                </div>
                            ))}
                            {formData.rooms.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', border: '2px dashed #E5E7EB', borderRadius: '8px' }}>
                                    Noch keine Räume angelegt.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 4. Drying Equipment (Only in Trocknung) */}
                {
                    formData.status === 'Trocknung' && (
                        <div style={{ marginBottom: '2rem', borderTop: '1px solid #E5E7EB', paddingTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Trocknungsgeräte</h3>

                            {/* Add Device Form */}
                            <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Geräte-Nr."
                                        className="form-input"
                                        value={newDevice.deviceNumber}
                                        onChange={(e) => setNewDevice(prev => ({ ...prev, deviceNumber: e.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Wohnung (Optional)"
                                        className="form-input"
                                        value={newDevice.apartment || ''}
                                        onChange={(e) => setNewDevice(prev => ({ ...prev, apartment: e.target.value }))}
                                    />
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <select
                                        className="form-input"
                                        value={newDevice.room}
                                        onChange={(e) => {
                                            const selectedRoomName = e.target.value;
                                            const foundRoom = formData.rooms.find(r => r.name === selectedRoomName);
                                            setNewDevice(prev => ({
                                                ...prev,
                                                room: selectedRoomName,
                                                apartment: foundRoom?.apartment || prev.apartment || ''
                                            }));
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Raum wählen...</option>
                                        {formData.rooms.map(r => (
                                            <option key={r.id} value={r.name}>{r.name} {r.apartment ? `(${r.apartment})` : ''}</option>
                                        ))}
                                        <option value="Sonstiges">Sonstiges</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={newDevice.startDate}
                                        onChange={(e) => setNewDevice(prev => ({ ...prev, startDate: e.target.value }))}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Zählerstand Start"
                                        className="form-input"
                                        value={newDevice.counterStart}
                                        onChange={(e) => setNewDevice(prev => ({ ...prev, counterStart: e.target.value }))}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAddDevice}
                                    disabled={!newDevice.deviceNumber || !newDevice.room}
                                    style={{ width: '100%' }}
                                >
                                    <Plus size={16} /> Gerät hinzufügen
                                </button>
                            </div>

                            {/* Device List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {formData.equipment.map((device, idx) => (
                                    <div key={idx} style={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '0.75rem', color: '#1F2937' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 600 }}>#{device.deviceNumber}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                                                    {device.room}
                                                    {device.apartment && <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 400, marginLeft: '4px' }}>({device.apartment})</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#4B5563', display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid #F3F4F6', paddingTop: '0.5rem' }}>
                                            <span>Start: {device.startDate}</span>
                                            <span>Zähler: {device.counterStart} kWh</span>
                                        </div>
                                    </div>
                                ))}
                                {formData.equipment.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.9rem' }}>Keine Geräte installiert.</div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Save Button for Mobile */}
                <div style={{ position: 'sticky', bottom: '1rem', left: '0', right: '0', marginTop: '2rem' }}>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    >
                        Speichern
                    </button>
                </div>
            </div >
        )
    }

    return (
        <>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                            {formData.projectTitle || 'Projekt'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Status:</span>
                            <select
                                id="status-header"
                                name="status"
                                className={`status-badge ${statusColors[formData.status] || 'bg-gray-100'}`}
                                value={formData.status}
                                onChange={handleInputChange}
                                style={{
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    padding: '0.25rem 2rem 0.25rem 1rem',
                                    appearance: 'auto',
                                    maxWidth: '200px'
                                }}
                            >
                                {STEPS.map(step => (
                                    <option key={step} value={step} style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}>{step}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setShowEmailImport(true)}
                            title="Daten aus Email importieren"
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.75rem' }}
                        >
                            <Mail size={18} />
                            <span style={{ fontSize: '0.9rem' }}>Email Import</span>
                        </button>
                        {formData.status === 'Leckortung' && (
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handleGeneratePDF}
                                disabled={isGeneratingPDF}
                                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                            >
                                <FileText size={18} />
                                {isGeneratingPDF ? 'Erstelle...' : 'Bericht (PDF) & Speichern'}
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={onCancel} style={{ padding: '0.5rem' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                        {/* Auftraggeber */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="client">Auftraggeber</label>
                            <input
                                type="text"
                                id="client"
                                name="client"
                                className="form-input"
                                placeholder="Name des Auftraggebers"
                                value={formData.client}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        {/* Zuständig */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="assignedTo">Zuständig</label>
                            <input
                                type="text"
                                id="assignedTo"
                                name="assignedTo"
                                className="form-input"
                                placeholder="Name des Technikers / Zuständigen"
                                value={formData.assignedTo}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Kunde von */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="clientSource">Kunde von</label>
                            <select
                                id="clientSource"
                                name="clientSource"
                                className="form-input"
                                value={formData.clientSource}
                                onChange={handleInputChange}
                            >
                                <option value="">Bitte wählen...</option>
                                <option value="Xhemil Ademi">Xhemil Ademi</option>
                                <option value="Adi Shala">Adi Shala</option>
                                <option value="Andreas Strehler">Andreas Strehler</option>
                            </select>
                        </div>

                        {/* Art der Liegenschaft */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="propertyType">Art der Liegenschaft</label>
                            <select
                                id="propertyType"
                                name="propertyType"
                                className="form-input"
                                value={formData.propertyType}
                                onChange={handleInputChange}
                            >
                                <option value="">Bitte wählen...</option>
                                <optgroup label="Wohnimmobilien">
                                    <option value="Einfamilienhaus">Einfamilienhaus</option>
                                    <option value="Mehrfamilienhaus">Mehrfamilienhaus</option>
                                    <option value="Doppelhaushälfte">Doppelhaushälfte</option>
                                    <option value="Reihenhaus">Reihenhaus</option>
                                    <option value="Eigentumswohnung">Eigentumswohnung</option>
                                    <option value="Mietwohnung">Mietwohnung</option>
                                    <option value="Ferienhaus">Ferienhaus</option>
                                </optgroup>
                                <optgroup label="Gewerbeimmobilien">
                                    <option value="Büro / Praxis">Büro / Praxis</option>
                                    <option value="Einzelhandel">Einzelhandel</option>
                                    <option value="Hotel / Gastronomie">Hotel / Gastronomie</option>
                                    <option value="Industrie / Lagerhalle">Industrie / Lagerhalle</option>
                                </optgroup>
                                <optgroup label="Sonstige">
                                    <option value="Öffentliches Gebäude">Öffentliches Gebäude</option>
                                    <option value="Sonstiges">Sonstiges</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    {/* Schadenort & Adresse */}
                    <div className="form-group">
                        <label className="form-label">Schadenort</label>
                        <input
                            type="text"
                            name="locationDetails"
                            className="form-input"
                            placeholder="z.B. Wohnung Meier, 2. OG links"
                            value={formData.locationDetails}
                            onChange={handleInputChange}
                            style={{ marginBottom: '0.5rem' }}
                        />

                        <label className="form-label" style={{ marginTop: '0.5rem' }}>Adresse</label>

                        {/* Straße & Hausnummer */}
                        <div style={{ marginBottom: '0.5rem' }}>
                            <input
                                type="text"
                                name="street"
                                className="form-input"
                                placeholder="Straße & Hausnummer"
                                value={formData.street}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, street: e.target.value }));
                                }}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* PLZ */}
                            <div style={{ flex: '0 0 100px' }}>
                                <input
                                    type="text"
                                    name="zip"
                                    list="plz-list"
                                    className="form-input"
                                    placeholder="PLZ"
                                    value={formData.zip}
                                    onChange={(e) => {
                                        const val = e.target.value;

                                        // Auto-fill City if PLZ known
                                        const match = swissPLZ.find(entry => entry.plz === val.trim());
                                        if (match) {
                                            setFormData(prev => ({ ...prev, zip: val, city: match.city }));
                                        } else {
                                            setFormData(prev => ({ ...prev, zip: val }));
                                        }
                                    }}
                                    required
                                />
                                <datalist id="plz-list">
                                    {swissPLZ.map((entry, idx) => (
                                        <option key={idx} value={entry.plz}>{entry.city}</option>
                                    ))}
                                </datalist>
                            </div>

                            {/* Ort */}
                            <div style={{ flex: 1, position: 'relative' }}>
                                <input
                                    type="text"
                                    name="city"
                                    list="city-list"
                                    className="form-input"
                                    placeholder="Ort"
                                    value={formData.city}
                                    onChange={(e) => {
                                        const val = e.target.value;

                                        // Try to find a match for the city
                                        // We find ALL matches to check if current ZIP is valid
                                        const matches = swissPLZ.filter(entry => entry.city.toLowerCase() === val.trim().toLowerCase());

                                        if (matches.length > 0) {
                                            // Check if current zip is among the matches
                                            const currentZipIsValid = matches.some(m => m.plz === formData.zip);

                                            // If current zip is not valid for this city, take the first one
                                            if (!currentZipIsValid) {
                                                setFormData(prev => ({ ...prev, city: val, zip: matches[0].plz }));
                                            } else {
                                                setFormData(prev => ({ ...prev, city: val }));
                                            }
                                        } else {
                                            setFormData(prev => ({ ...prev, city: val }));
                                        }
                                    }}
                                    required
                                />
                                <datalist id="city-list">
                                    {Array.from(new Set(swissPLZ.map(e => e.city))).sort().map(city => (
                                        <option key={city} value={city} />
                                    ))}
                                </datalist>
                            </div>


                        </div>
                    </div>

                    {/* Map Integration */}
                    {(formData.street || formData.city || formData.zip) && (
                        <div className="form-group" style={{ marginTop: '0rem', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '100%',
                                height: '300px',
                                borderRadius: 'var(--radius)',
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    scrolling="no"
                                    marginHeight="0"
                                    marginWidth="0"
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(`${formData.street}, ${formData.zip} ${formData.city}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                    title="Standort"
                                ></iframe>
                            </div>
                        </div>
                    )}

                    {/* Kontakte */}
                    <div className="form-group">
                        <label className="form-label">Kontakte (Name / Wohnung / Tel.Nr)</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {formData.contacts.map((contact, index) => (
                                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Name"
                                        value={contact.name}
                                        onChange={(e) => {
                                            const newContacts = [...formData.contacts];
                                            newContacts[index].name = e.target.value;
                                            setFormData(prev => ({ ...prev, contacts: newContacts }));
                                        }}
                                    />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Wohnung"
                                        value={contact.apartment}
                                        onChange={(e) => {
                                            const newContacts = [...formData.contacts];
                                            newContacts[index].apartment = e.target.value;
                                            setFormData(prev => ({ ...prev, contacts: newContacts }));
                                        }}
                                    />
                                    <input
                                        type="text" // or type="tel"
                                        className="form-input"
                                        placeholder="Tel.Nr"
                                        value={contact.phone}
                                        onChange={(e) => {
                                            const newContacts = [...formData.contacts];
                                            newContacts[index].phone = e.target.value;
                                            setFormData(prev => ({ ...prev, contacts: newContacts }));
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        {/* Art des Schadens */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="damageType">Art des Schadens</label>
                            <input
                                type="text"
                                id="damageType"
                                name="damageType"
                                className="form-input"
                                placeholder="z.B. Rohrbruch, Leckage..."
                                value={formData.damageType}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    </div>

                    {/* Trocknung Protokoll - Nur sichtbar wenn Status = Trocknung */}
                    {formData.status === 'Trocknung' && (
                        <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid var(--border)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--primary)' }}>Trocknung</h3>

                            {/* Equipment Selection */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ color: 'var(--primary)' }}>Eingesetzte Geräte</label>

                                {/* List of added devices grouped by Apartment + Room */}
                                {formData.equipment.length > 0 && (
                                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {Object.entries(
                                            formData.equipment.reduce((acc, item) => {
                                                const key = item.apartment ? `${item.apartment} - ${item.room}` : item.room;
                                                (acc[key] = acc[key] || []).push(item);
                                                return acc;
                                            }, {})
                                        ).map(([groupKey, devices]) => (
                                            <div key={groupKey} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                                <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Bereich: {groupKey}</h4>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm"
                                                        style={{ backgroundColor: '#0EA5E9', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                                        onClick={() => {
                                                            const incomplete = devices.filter(d => !d.endDate || !d.counterEnd || !d.hours);
                                                            if (incomplete.length > 0) {
                                                                alert(`Bitte für alle Geräte in "${groupKey}" die End-Daten erfassen (End-Datum, Zähler Ende, Stunden).\n\nFehlend bei: ${incomplete.map(d => '#' + d.deviceNumber).join(', ')}`);
                                                            } else {
                                                                alert(`Trocknung im Bereich "${groupKey}" ist vollständig erfasst.`);
                                                                // Logic to lock room or mark visual check could go here
                                                            }
                                                        }}
                                                    >
                                                        Bereich fertigmelden
                                                    </button>
                                                </div>

                                                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {devices.map((item) => {
                                                        const consumption = (item.counterEnd && item.counterStart)
                                                            ? (parseFloat(item.counterEnd) - parseFloat(item.counterStart)).toFixed(2)
                                                            : null;

                                                        // Find original index in formData.equipment to update correctly
                                                        const originalIndex = formData.equipment.findIndex(i => i.id === item.id);

                                                        return (
                                                            <div key={item.id} style={{ border: '1px solid #E2E8F0', borderRadius: 'var(--radius)', padding: '1rem', backgroundColor: 'var(--surface)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>Gerät #{item.deviceNumber}</h4>
                                                                    <button type="button" onClick={() => handleRemoveDevice(item.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                                        <X size={16} />
                                                                    </button>
                                                                </div>

                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                                                                    {/* Row 1: Dates */}
                                                                    <div>
                                                                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '2px' }}>Start-Datum</label>
                                                                        <input
                                                                            type="date"
                                                                            className="form-input"
                                                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                                            value={item.startDate || ''}
                                                                            onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                                                                            onChange={(e) => {
                                                                                const newEquipment = [...formData.equipment];
                                                                                newEquipment[originalIndex].startDate = e.target.value;
                                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '2px' }}>End-Datum</label>
                                                                        <input
                                                                            type="date"
                                                                            className="form-input"
                                                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                                            value={item.endDate || ''}
                                                                            onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                                                                            onChange={(e) => {
                                                                                const newEquipment = [...formData.equipment];
                                                                                newEquipment[originalIndex].endDate = e.target.value;
                                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Row 2: Counters */}
                                                                    <div>
                                                                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '2px' }}>Zähler Start (kWh)</label>
                                                                        <input
                                                                            type="number"
                                                                            className="form-input"
                                                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                                            value={item.counterStart || ''}
                                                                            onChange={(e) => {
                                                                                const newEquipment = [...formData.equipment];
                                                                                newEquipment[originalIndex].counterStart = e.target.value;
                                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '2px' }}>Zähler Ende (kWh)</label>
                                                                        <input
                                                                            type="number"
                                                                            className="form-input"
                                                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                                            value={item.counterEnd || ''}
                                                                            onChange={(e) => {
                                                                                const newEquipment = [...formData.equipment];
                                                                                newEquipment[originalIndex].counterEnd = e.target.value;
                                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Row 3: Hours & Consumption */}
                                                                    <div>
                                                                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '2px' }}>Betriebs-Stunden</label>
                                                                        <input
                                                                            type="number"
                                                                            className="form-input"
                                                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                                            value={item.hours || ''}
                                                                            onChange={(e) => {
                                                                                const newEquipment = [...formData.equipment];
                                                                                newEquipment[originalIndex].hours = e.target.value;
                                                                                setFormData(prev => ({ ...prev, equipment: newEquipment }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '2px' }}>Verbrauch (kWh)</label>
                                                                        <div style={{ padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                                                            {consumption ? `${consumption} kWh` : '-'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add new device form */}
                                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', marginTop: 0 }}>Neues Gerät hinzufügen</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Geräte-Nr.</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                placeholder="z.B. 1"
                                                value={newDevice.deviceNumber || ''}
                                                onChange={(e) => setNewDevice(prev => ({ ...prev, deviceNumber: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Wohnung</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Optional"
                                                value={newDevice.apartment || ''}
                                                onChange={(e) => setNewDevice(prev => ({ ...prev, apartment: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Raum</label>
                                            <select
                                                className="form-input"
                                                value={newDevice.room}
                                                onChange={(e) => setNewDevice(prev => ({ ...prev, room: e.target.value }))}
                                            >
                                                <option value="">Wählen...</option>
                                                <option value="Wohnzimmer">Wohnzimmer</option>
                                                <option value="Bad">Bad</option>
                                                <option value="Dusche">Dusche</option>
                                                <option value="Flur">Flur</option>
                                                <option value="Schlafzimmer">Schlafzimmer</option>
                                                <option value="Kinderzimmer">Kinderzimmer</option>
                                                <option value="Treppenhaus">Treppenhaus</option>
                                                <option value="Keller">Keller</option>
                                                <option value="Garage">Garage</option>
                                                <option value="Küche">Küche</option>
                                                <option value="Sonstiges">Sonstiges (Eigene Eingabe)</option>
                                            </select>
                                            {/* Show input if "Sonstiges" is selected OR if current value is not in the list */}
                                            {(newDevice.room === 'Sonstiges' || (newDevice.room && !['Wohnzimmer', 'Bad', 'Dusche', 'Flur', 'Schlafzimmer', 'Kinderzimmer', 'Treppenhaus', 'Keller', 'Garage', 'Küche'].includes(newDevice.room))) && (
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    style={{ marginTop: '0.25rem' }}
                                                    placeholder="Raum-Name eingeben"
                                                    value={newDevice.room === 'Sonstiges' ? '' : newDevice.room}
                                                    onChange={(e) => setNewDevice(prev => ({ ...prev, room: e.target.value }))}
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Geräte-Start</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={newDevice.startDate || ''}
                                                onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                                                onChange={(e) => setNewDevice(prev => ({ ...prev, startDate: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Zähler Start</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                placeholder="kWh"
                                                value={newDevice.counterStart || ''}
                                                onChange={(e) => setNewDevice(prev => ({ ...prev, counterStart: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleAddDevice}
                                        disabled={!newDevice.deviceNumber || !newDevice.room}
                                        style={{ width: '100%' }}
                                    >
                                        Gerät hinzufügen
                                    </button>
                                </div>
                            </div>




                        </div>
                    )}

                    {/* Interne Notizen */}
                    <div className="form-group">
                        <label className="form-label">Interne Notizen</label>

                        {/* Notes Textarea */}
                        <textarea
                            name="notes"
                            className="form-input"
                            style={{ minHeight: '100px', resize: 'vertical', marginBottom: '1rem' }}
                            placeholder="Notizen, Besonderheiten, Absprachen..."
                            value={formData.notes || ''}
                            onChange={handleInputChange}
                        />


                    </div>

                    {/* Document Categories */}
                    <div style={{ marginTop: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                            Bilder & Dokumente
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>


                            {/* Dynamic Room Categories for Erste Begehung & Leckortung */}
                            {(formData.status === 'Schadenaufnahme' || formData.status === 'Leckortung') && (
                                <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                                    {/* Room Management UI */}
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)' }}>Räume verwalten</h4>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Raum auswählen</label>
                                                <select
                                                    className="form-input"
                                                    value={newRoom.name}
                                                    onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                                                >
                                                    <option value="">Bitte wählen...</option>
                                                    {ROOM_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Wohnung (Optional)</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="z.B. EG Links"
                                                    value={newRoom.apartment}
                                                    onChange={(e) => setNewRoom(prev => ({ ...prev, apartment: e.target.value }))}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={handleAddRoom}
                                                disabled={!newRoom.name}
                                                style={{ height: '38px' }}
                                            >
                                                <Plus size={18} />
                                                Raum hinzufügen
                                            </button>
                                        </div>

                                        {/* List of Added Rooms */}
                                        {formData.rooms.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {formData.rooms.map(room => (
                                                    <div key={room.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                        backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0EA5E9',
                                                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem'
                                                    }}>
                                                        <span>{room.apartment ? `${room.apartment} - ` : ''}{room.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveRoom(room.id)}
                                                            style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'flex' }}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload Zones for each Room */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                        {formData.rooms.map(room => {
                                            const roomLabel = room.apartment ? `${room.apartment} - ${room.name}` : room.name;
                                            return (
                                                <div key={room.id} className="card" style={{ border: '1px solid var(--border)' }}>
                                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Folder size={18} />
                                                        {roomLabel}
                                                    </h3>

                                                    <div
                                                        style={{
                                                            border: '2px dashed var(--border)',
                                                            borderRadius: 'var(--radius)',
                                                            padding: '2rem 1rem',
                                                            textAlign: 'center',
                                                            cursor: 'pointer',
                                                            backgroundColor: 'rgba(255,255,255,0.02)',
                                                            transition: 'all 0.2s',
                                                            marginBottom: '1rem',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'var(--text-muted)'
                                                        }}
                                                        onClick={() => document.getElementById(`file-upload-${room.id}`).click()}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                                            e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
                                                            e.currentTarget.style.color = 'var(--primary)';
                                                        }}
                                                        onDragLeave={(e) => {
                                                            e.preventDefault();
                                                            e.currentTarget.style.borderColor = 'var(--border)';
                                                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                                                            e.currentTarget.style.color = 'var(--text-muted)';
                                                        }}
                                                        onDrop={(e) => handleRoomImageDrop(e, room)}
                                                    >
                                                        <Plus size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                                        <span style={{ fontSize: '0.85rem' }}>Bilder hochladen</span>

                                                        <input
                                                            id={`file-upload-${room.id}`}
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => handleRoomImageSelect(e, room)}
                                                        />
                                                    </div>

                                                    {/* Previews */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {formData.images.filter(img => img.roomId === room.id).map((item, idx) => (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                                                                <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                                                    <div style={{ width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>
                                                                        <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} cursor="pointer" onClick={() => window.open(item.preview, '_blank')} />
                                                                    </div>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', cursor: 'pointer', color: '#374151' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            style={{ accentColor: 'var(--primary)' }}
                                                                            checked={item.includeInReport !== false}
                                                                            onChange={(e) => {
                                                                                const isChecked = e.target.checked;
                                                                                setFormData(prev => ({
                                                                                    ...prev,
                                                                                    images: prev.images.map(img => img === item ? { ...img, includeInReport: isChecked } : img)
                                                                                }));
                                                                            }}
                                                                        />
                                                                        Bericht
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        title="Bearbeiten"
                                                                        style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}
                                                                        onClick={() => setEditingImage(item)}
                                                                    >
                                                                        <Edit3 size={16} />
                                                                    </button>
                                                                </div>
                                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                    <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                                        {item.name}
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                                                        placeholder="Beschreibung hinzufügen..."
                                                                        value={item.description || ''}
                                                                        onChange={(e) => {
                                                                            const newDesc = e.target.value;
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                images: prev.images.map(img => img === item ? { ...img, description: newDesc } : img)
                                                                            }));
                                                                        }}
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter(img => img !== item) }))}
                                                                    style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {
                                ['Messprotokolle', 'Emails', 'Pläne', 'Sonstiges'].map(category => (
                                    <div key={category} className="card" style={{ border: '1px solid var(--border)' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {category === 'Schadenfotos' && <Image size={18} />}
                                            {category === 'Messprotokolle' && <FileText size={18} />}
                                            {category === 'Emails' && <Mail size={18} />}
                                            {category === 'Pläne' && <Map size={18} />}
                                            {category === 'Sonstiges' && <Folder size={18} />}
                                            {category}
                                        </h3>

                                        <div
                                            style={{
                                                border: '2px dashed var(--border)',
                                                borderRadius: 'var(--radius)',
                                                padding: '2rem 1rem',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                backgroundColor: 'rgba(255,255,255,0.02)',
                                                transition: 'all 0.2s',
                                                marginBottom: '1rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--text-muted)'
                                            }}
                                            onClick={() => document.getElementById(`file-upload-${category}`).click()}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
                                                e.currentTarget.style.color = 'var(--primary)';
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                            }}
                                            onDrop={(e) => handleCategoryDrop(e, category)}
                                        >
                                            <Plus size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                            <span style={{ fontSize: '0.85rem' }}>Upload / Drop</span>

                                            <input
                                                id={`file-upload-${category}`}
                                                type="file"
                                                multiple
                                                accept="image/*,application/pdf"
                                                style={{ display: 'none' }}
                                                onChange={(e) => handleCategorySelect(e, category)}
                                            />
                                        </div>

                                        {/* Preview for this category */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {formData.images.filter(img => img.assignedTo === category || (category === 'Schadenfotos' && !img.assignedTo)).map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                                                    {/* Icon/Preview */}
                                                    {/* Icon/Preview */}
                                                    {/* Content based on type */}
                                                    {(item.file && item.file.type === 'application/pdf') || (item.name && item.name.toLowerCase().endsWith('.pdf')) ? (
                                                        // PDF / Document Layout
                                                        <div
                                                            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                                                            onClick={() => {
                                                                if (item.file) {
                                                                    const pdfUrl = URL.createObjectURL(item.file);
                                                                    window.open(pdfUrl, '_blank');
                                                                } else if (item.preview) {
                                                                    window.open(item.preview, '_blank');
                                                                } else {
                                                                    // Fallback for PDF without preview URL (e.g. just generated but lost blob)
                                                                    alert("PDF Vorschau nicht verfügbar (wurde gespeichert).");
                                                                }
                                                            }}
                                                        >
                                                            <div style={{ padding: '0.5rem', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>
                                                                <FileText size={24} color="#64748B" />
                                                            </div>
                                                            <div style={{ fontSize: '1rem', color: '#1E293B', fontWeight: 500, textDecoration: 'underline' }}>
                                                                {item.name}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Image Layout
                                                        <>
                                                            <div style={{ width: '200px', height: '200px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>
                                                                <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                                            </div>
                                                            <div style={{ flex: 1, fontSize: '0.9rem', color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 0.5rem' }} title={item.name}>
                                                                {item.name}
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Edit - Hide for PDFs */}
                                                    {!((item.file && item.file.type === 'application/pdf') || (item.name && item.name.toLowerCase().endsWith('.pdf'))) && (
                                                        <button
                                                            type="button"
                                                            title="Bearbeiten"
                                                            style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}
                                                            onClick={() => setEditingImage(item)}
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                    )}

                                                    {/* Delete */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm('Möchten Sie diese Datei wirklich löschen?')) {
                                                                setFormData(prev => ({ ...prev, images: prev.images.filter(img => img !== item) }));
                                                            }
                                                        }}
                                                        style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>


                    {/* Summary Table (Moved to bottom) */}
                    {formData.equipment.some(d => d.endDate && d.counterEnd) && (
                        <div style={{ marginTop: '3rem', borderTop: '2px solid var(--border)', paddingTop: '2rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1rem' }}>Zusammenfassung Trocknung</h2>
                            <div className="table-container">
                                <table className="data-table" style={{ width: '100%', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Wohnung</th>
                                            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Raum</th>
                                            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Geräte-Nr.</th>
                                            <th style={{ textAlign: 'right', padding: '0.75rem' }}>Dauer</th>
                                            <th style={{ textAlign: 'right', padding: '0.75rem' }}>Betriebsstd.</th>
                                            <th style={{ textAlign: 'right', padding: '0.75rem' }}>Verbrauch</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.equipment
                                            .filter(d => d.endDate && d.counterEnd)
                                            .map(item => {
                                                const days = getDaysDiff(item.startDate, item.endDate);
                                                const consumption = (parseFloat(item.counterEnd) - parseFloat(item.counterStart)).toFixed(2);
                                                return (
                                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '0.75rem' }}>{item.apartment || '-'}</td>
                                                        <td style={{ padding: '0.75rem' }}>{item.room}</td>
                                                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>#{item.deviceNumber}</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{days} Tage</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{item.hours} h</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{consumption} kWh</td>
                                                    </tr>
                                                );
                                            })}
                                        {(() => {
                                            const finished = formData.equipment.filter(d => d.endDate && d.counterEnd);
                                            const totalHours = finished.reduce((acc, curr) => acc + (parseFloat(curr.hours) || 0), 0);
                                            const totalKwh = finished.reduce((acc, curr) => acc + ((parseFloat(curr.counterEnd) || 0) - (parseFloat(curr.counterStart) || 0)), 0);

                                            return (
                                                <tr style={{ backgroundColor: 'var(--bg-muted)', fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                                                    <td style={{ padding: '0.75rem' }} colSpan={4}>Gesamt</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalHours} h</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalKwh.toFixed(2)} kWh</td>
                                                </tr>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                        {formData.status !== 'Abgeschlossen' ? (
                            <button
                                type="button"
                                className="btn"
                                style={{ backgroundColor: '#EF4444', color: 'white', display: 'flex', gap: '0.5rem' }}
                                onClick={() => {
                                    if (window.confirm('Möchten Sie dieses Projekt wirklich abschließen und ins Archiv verschieben?')) {
                                        onSave({ ...formData, status: 'Abgeschlossen' });
                                    }
                                }}
                            >
                                <CheckCircle size={18} />
                                Projekt beenden
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn"
                                style={{ backgroundColor: '#F59E0B', color: 'white', display: 'flex', gap: '0.5rem' }}
                                onClick={() => {
                                    if (window.confirm('Möchten Sie dieses Projekt wieder aktivieren? (Status wird auf "Instandsetzung" gesetzt)')) {
                                        onSave({ ...formData, status: 'Instandsetzung' });
                                    }
                                }}
                            >
                                <RotateCcw size={18} />
                                Projekt reaktivieren
                            </button>
                        )}

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handlePDFClick}
                                style={{ color: '#365E7D', borderColor: '#365E7D' }}
                            >
                                <FileText size={18} />
                                Bericht konfigurieren
                            </button>
                            <button type="button" className="btn btn-outline" onClick={onCancel}>Abbrechen</button>
                            <button type="submit" className="btn btn-primary">
                                <Save size={18} />
                                Speichern
                            </button>
                        </div>
                    </div>
                </form>

                {editingImage && (
                    <ImageEditor
                        image={editingImage}
                        onSave={(newPreview) => {
                            setFormData(prev => ({
                                ...prev,
                                images: prev.images.map(img => img === editingImage ? { ...img, preview: newPreview } : img)
                            }));
                            setEditingImage(null);
                        }}
                        onCancel={() => setEditingImage(null)}
                    />
                )}

                {showEmailImport && (
                    <EmailImportModal
                        onClose={() => setShowEmailImport(false)}
                        onImport={handleEmailImport}
                    />
                )}
            </div>

            {/* Report Configuration Modal */}
            {showReportModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
                }}>
                    <div className="card" style={{ width: '500px', padding: '2rem', backgroundColor: 'white' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Bericht erstellen</h3>

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                                Schadenursache (wird im Bericht angezeigt)
                            </label>
                            <textarea
                                className="form-input"
                                rows={4}
                                value={reportCause}
                                onChange={(e) => setReportCause(e.target.value)}
                                placeholder="Beschreiben Sie hier die Ursache des Schadens..."
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #ddd' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowReportModal(false)}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowReportModal(false);
                                    // Save cause to form data state implicitly via closure? 
                                    // No, update form data state so it persists
                                    setFormData(prev => ({ ...prev, cause: reportCause }));
                                    // Trigger PDF logic
                                    generatePDFContent();
                                }}
                            >
                                PDF erstellen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Report Template - Hidden on Screen unless generating */}
            <div
                id="print-report"
                className="print-only"
                style={{
                    display: isGeneratingPDF ? 'block' : 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '210mm', // A4 width
                    minHeight: '297mm', // A4 height
                    backgroundColor: 'white',
                    zIndex: -1000, // Hide behind everything
                    padding: '20mm', // Print margins
                    color: 'black',
                    fontFamily: 'Arial, sans-serif'
                }}
            >
                <div className="pdf-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '2px solid #365E7D', paddingBottom: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '24pt', fontWeight: 'bold', margin: 0, color: '#365E7D' }}>Schadensbericht</h1>
                        <div style={{ fontSize: '12pt', marginTop: '0.5rem' }}>Datum: {new Date().toLocaleDateString('de-DE')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <img src="/logo.png" style={{ height: '60px', marginBottom: '0.5rem', objectFit: 'contain' }} alt="Logo" />
                        <div style={{ fontWeight: 'bold', fontSize: '14pt', color: '#365E7D' }}>Q-Service AG</div>
                        <div style={{ fontSize: '10pt' }}>Kriesbachstrasse 30, 8600 Dübendorf</div>
                        <div style={{ fontSize: '10pt' }}>Tel: 043 819 14 18</div>
                    </div>
                </div>

                <div className="pdf-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    <div>
                        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '12pt' }}>Projektdaten</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', fontSize: '11pt' }}>
                            {formData.projectTitle && (
                                <>
                                    <strong>Projekt:</strong> <span>{formData.projectTitle}</span>
                                </>
                            )}
                            <strong>Auftraggeber:</strong> <span>{formData.client}</span>
                            <strong>Zuständig:</strong> <span>{formData.assignedTo}</span>
                            <strong>Schadenort:</strong> <span>{formData.street}, {formData.zip} {formData.city}</span>
                        </div>
                    </div>
                    <div>
                        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '12pt' }}>Schaden</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', fontSize: '11pt' }}>
                            <strong>Art:</strong> <span>{formData.damageType}</span>
                        </div>
                    </div>
                </div>

                {formData.description && (
                    <div className="pdf-section" style={{ marginBottom: '2rem' }}>
                        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '12pt' }}>Beschreibung / Feststellungen</h3>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '11pt', lineHeight: 1.4 }}>
                            {formData.description}
                        </div>
                    </div>
                )}

                {/* Cause Section */}
                {reportCause && (
                    <>
                        <div style={{ borderTop: '2px solid #365E7D', margin: '0 0 2rem 0' }}></div>
                        <div className="pdf-section" style={{ marginBottom: '2rem', breakInside: 'avoid' }}>
                            <h3 style={{
                                fontSize: '14pt',
                                borderBottom: '1px solid #ddd',
                                paddingBottom: '0.5rem',
                                marginBottom: '1rem',
                                color: '#333',
                                fontWeight: 'bold',
                                marginTop: '1rem'
                            }}>
                                Schadenursache
                            </h3>
                            <div style={{ whiteSpace: 'pre-wrap', fontSize: '11pt', lineHeight: 1.5, color: '#374151' }}>
                                {reportCause}
                            </div>
                        </div>
                    </>
                )}

                <div className="print-break-inside-avoid">
                    <h3 className="pdf-section" style={{ borderBottom: '2px solid #365E7D', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '14pt' }}>Dokumentation & Bilder</h3>

                    {/* Loop through rooms that have images */}
                    {/* Loop through rooms that have images MARKED FOR REPORT */}
                    {formData.rooms
                        .filter(room => formData.images.some(img => img.roomId === room.id && img.includeInReport !== false))
                        .map(room => (
                            <div key={room.id} style={{ marginBottom: '0' }}>
                                <h4 className="pdf-section" style={{ fontSize: '14pt', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#333', marginTop: '1rem' }}>
                                    {room.apartment ? `${room.apartment} - ` : ''}{room.name}
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                                    {formData.images
                                        .filter(img => img.roomId === room.id && img.includeInReport !== false)
                                        .map((img, idx) => (
                                            <div key={idx} className="pdf-section" style={{ border: '1px solid #eee', padding: '1rem', breakInside: 'avoid', backgroundColor: '#fff', marginBottom: '1rem' }}>
                                                <div style={{ height: '400px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', backgroundColor: '#f9f9f9', border: '1px solid #f0f0f0' }}>
                                                    <img src={img.preview} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                </div>
                                                {img.description && (
                                                    <div style={{ fontSize: '10pt', padding: '0.25rem', fontStyle: 'italic', color: '#555' }}>
                                                        {img.description}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}


                </div>
            </div >
        </>
    )
}
