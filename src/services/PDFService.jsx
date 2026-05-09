
import { pdf } from '@react-pdf/renderer';
import DamageReportDocument from '../components/pdf/DamageReportDocument';
import { urlToDataUrl } from '../components/DamageForm/DamageForm.utils';
import React from 'react';

/**
 * Service to generate and handle PDF reports
 */
export const PDFService = {
    /**
     * Generates a PDF report from form data
     * @param {Object} formData 
     * @param {Object} supabase 
     * @returns {Promise<{blob: Blob, fileName: string}>}
     */
    generateReport: async (formData, supabase) => {
        // Load Logo
        let logoData = null;
        try {
            const logoResp = await fetch(window.location.origin + '/1080p.jpg');
            if (logoResp.ok) {
                const blob = await logoResp.blob();
                logoData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch (e) {
            console.error("PDF Service: Logo load error", e);
        }

        // Process images – convert all to base64, skip non-renderables
        const tempProcessedImages = await Promise.all(
            (formData.images || []).map(async (img) => {
                const category = String(img.assignedTo || '').trim().toLowerCase();
                const isDocCategory = ['schadensbericht', 'arbeitsrapporte', 'messprotokolle'].includes(category);
                const isProbablyPDF = img.preview?.toLowerCase().includes('.pdf') || img.type?.includes('pdf');

                if (img.includeInReport === false || isDocCategory || isProbablyPDF) {
                    return { ...img, isRenderable: false };
                }

                try {
                    const base64 = await urlToDataUrl(img.preview, img, supabase);
                    if (base64) {
                        return { ...img, preview: base64, isRenderable: true };
                    } else {
                        console.warn(`PDF Service: Bild konnte nicht geladen werden: ${img.preview}`);
                        return { ...img, isRenderable: false };
                    }
                } catch (e) {
                    console.warn(`PDF Service: Fehler beim Laden von ${img.preview}:`, e);
                    return { ...img, isRenderable: false };
                }
            })
        );

        // Vorab-Validierung: Prüfen ob alle Pflicht-Bilder geladen wurden
        const expectedImages = (formData.images || []).filter(img => {
            const category = String(img.assignedTo || '').trim().toLowerCase();
            const isDocCategory = ['schadensbericht', 'arbeitsrapporte', 'messprotokolle'].includes(category);
            const isProbablyPDF = img.preview?.toLowerCase().includes('.pdf') || img.type?.includes('pdf');
            return img.includeInReport !== false && !isDocCategory && !isProbablyPDF;
        });
        const failedImages = tempProcessedImages.filter(img =>
            img.includeInReport !== false && img.isRenderable === false &&
            !['schadensbericht', 'arbeitsrapporte', 'messprotokolle'].includes(String(img.assignedTo || '').trim().toLowerCase())
        );

        if (failedImages.length > 0 && expectedImages.length > 0) {
            const ratio = failedImages.length / expectedImages.length;
            if (ratio > 0.5) {
                // Mehr als 50% der Bilder nicht geladen – Fehler werfen
                throw new Error(
                    `${failedImages.length} von ${expectedImages.length} Bildern konnten nicht geladen werden. ` +
                    `Bitte Internetverbindung prüfen und erneut versuchen.`
                );
            }
        }

        const processedImages = tempProcessedImages.filter(img => img.isRenderable);
        const causePhotos = processedImages.filter(img => img.assignedTo === 'Schadenfotos');
        const processedHeroImages = causePhotos.map(img => img.preview);

        let processedExteriorPhoto = formData.exteriorPhoto;
        if (processedExteriorPhoto) {
            try {
                const base64Exterior = await urlToDataUrl(processedExteriorPhoto, null, supabase);
                if (base64Exterior) processedExteriorPhoto = base64Exterior;
            } catch (e) {
                console.warn("PDF Service: Exterior photo error", e);
            }
        }

        // Load Google Static Map
        let staticMapUrl = null;
        try {
            if (formData.customMapImage) {
                staticMapUrl = formData.customMapImage;
            } else {
                const mapAddress = formData.street
                    ? `${formData.street}, ${formData.zip || ''} ${formData.city || ''}`
                    : formData.address;
                if (mapAddress) {
                    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                    const params = new URLSearchParams({
                        center: mapAddress,
                        zoom: '15',
                        size: '640x300',
                        scale: '2',
                        maptype: 'roadmap',
                        markers: `color:red|${mapAddress}`,
                        key: apiKey,
                        language: 'de',
                    });
                    const resp = await fetch(`/google-staticmap?${params.toString()}`);
                    if (resp.ok) {
                        const blob = await resp.blob();
                        staticMapUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                }
            }
        } catch (e) { 
            const errorMsg = e.message || '';
            const maskedMsg = errorMsg.replace(/key=AIza[^&]*/g, 'key=AIza...REDACTED');
            console.warn('PDF Service: Google Static Map error', maskedMsg); 
        }

        const docData = {
            ...formData,
            damageType: formData.damageCategory || '-',
            images: processedImages,
            damageTypeImages: processedHeroImages,
            damageTypeImage: processedHeroImages[0] || null,
            exteriorPhoto: processedExteriorPhoto,
            logo: logoData,
            staticMapUrl,
        };

        const blob = await pdf(<DamageReportDocument data={docData} />).toBlob();

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const dateStr = now.toLocaleDateString('de-CH').replace(/\./g, '-');
        const projNum = formData.projectNumber || formData.projectTitle || 'Project';
        const location = formData.locationDetails || formData.city || 'Schadenort';
        const fileName = `${projNum}_${location}_${dateStr}_${timeStr}.pdf`;

        return { blob, fileName };
    },

    // Chrome-kompatibler Download: <a download> statt saveAs()
    downloadBlob: (blob, fileName) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        // Kurz warten damit Chrome den Download starten kann, dann aufräumen
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 500);
    },

    /**
     * MASTER-PFAD: Erzeugt einen vollständigen Schadensbericht inkl. Bildverarbeitung,
     * Map-Integration und optionalen Uploads. Basiert auf der bewährten DamageForm-Logik.
     * 
     * @param {Object} formData - Die Projektdaten
     * @param {Object} options - Instanzen, Callbacks und Flags
     */
    generateCompleteDamageReport: async (formData, options = {}) => {
        console.log("[PDFService Master] Starte vollständigen PDF-Export...");
        const {
            supabase,
            uploadToOneDrive = false,
            uploadToApp = false,
            getPhotoDownloadUrl,
            uploadReport,
            handleImageUpload,
            buildProjectFolderName,
            onProgress = () => {},
            fileName: customFileName
        } = options;

        const dataToUse = formData;

        // --- SCHRITT 2: MAP & BILD-FILTERUNG (1:1 AUS MASTER) ---

        // 1. Map Processing
        let staticMapUrl = null;
        try {
            if (dataToUse.customMapImage) {
                staticMapUrl = dataToUse.customMapImage;
            } else {
                let mapAddress = dataToUse.street
                    ? `${dataToUse.street}, ${dataToUse.zip || ''} ${dataToUse.city || ''}`
                    : dataToUse.address;
                
                // Clean up address (remove leading/trailing commas, extra spaces)
                mapAddress = (mapAddress || '').trim().replace(/^,+/, '').replace(/,+$/, '').trim();
                if (mapAddress) {
                    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                    const params = new URLSearchParams({
                        center: mapAddress,
                        zoom: '15',
                        size: '640x300',
                        scale: '2',
                        maptype: 'roadmap',
                        markers: `color:red|${mapAddress}`,
                        key: apiKey,
                        language: 'de',
                    });
                    const googleMapUrl = `/google-staticmap?${params.toString()}`;
                    const resp = await fetch(googleMapUrl);
                    if (resp.ok) {
                        const blob = await resp.blob();
                        
                        if (blob.type.startsWith('image/')) {
                            staticMapUrl = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        }
                    }
                }
            }
        } catch (e) { 
            const errorMsg = e.message || '';
            const maskedMsg = errorMsg.replace(/key=AIza[^&]*/g, 'key=AIza...REDACTED');
            console.error('[PDFService Master] Google Static Map error', maskedMsg); 
        }

        // 2. Pre-process images - Filter out PDFs and non-renderable documents
        console.log("[PDFService Master] Starte Bild-Filterung...");
        const tempProcessedImages = await Promise.all(
            (dataToUse.images || []).map(async (img) => {
                const category = String(img.assignedTo || '').trim().toLowerCase();
                const isDocCategory = ['schadensbericht', 'arbeitsrapporte', 'messprotokolle', 'sonstiges', 'pläne', 'lieferantenrechnungen'].includes(category);
                const isProbablyPDF = img.preview?.toLowerCase().includes('.pdf') || img.type?.includes('pdf');

                const isImageFile = img.preview && /\.(jpg|jpeg|png|gif|webp|heic|heif)/i.test(img.preview);

                if (img.includeInReport === false || isProbablyPDF || (isDocCategory && !isImageFile)) {
                    return { ...img, isRenderable: false };
                }

                try {
                    // OneDrive-Bild: frische URL holen falls getPhotoDownloadUrl vorhanden
                    let previewUrl = img.preview;
                    if (img.oneDriveItemId && getPhotoDownloadUrl) {
                        const freshUrl = await getPhotoDownloadUrl(img.oneDriveItemId).catch(() => null);
                        if (freshUrl) previewUrl = freshUrl;
                    }

                    // --- INTERNE HELPER AUS DAMAGEFORM (MASTER-LOGIK) ---
                    // (Bereits in Schritt 1 definiert)
                    const base64 = await internalUrlToDataUrl(previewUrl, img);
                    if (base64) {
                        return { ...img, preview: base64, isRenderable: true };
                    } else {
                        return { ...img, isRenderable: false };
                    }
                } catch (e) {
                    return { ...img, isRenderable: false };
                }
            })
        );

        // Final list for the PDF Document (only images)
        const processedImages = tempProcessedImages.filter(img => img.isRenderable);
        console.log(`[PDFService Master] Bild-Filterung abgeschlossen: ${processedImages.length} Bilder renderbar.`);

        // 3. Process Hero Images (Cause Photos marked for report)
        const causePhotos = processedImages.filter(img => img.assignedTo === 'Schadenfotos' && img.includeInReport !== false);
        const processedHeroImages = causePhotos.map(img => img.preview);

        // 4. Process Exterior Photo
        let processedExteriorPhoto = dataToUse.exteriorPhoto;
        if (processedExteriorPhoto) {
            try {
                const base64Exterior = await internalUrlToDataUrl(processedExteriorPhoto);
                if (base64Exterior) processedExteriorPhoto = base64Exterior;
            } catch (e) { console.warn("[PDFService Master] Failed to convert exterior photo:", e); }
        }

        // 5. Process Custom Map Image
        let processedCustomMapImage = dataToUse.customMapImage;
        if (processedCustomMapImage) {
            try {
                const base64CustomMap = await internalUrlToDataUrl(processedCustomMapImage);
                if (base64CustomMap) processedCustomMapImage = base64CustomMap;
            } catch (e) { console.warn("[PDFService Master] Failed to convert custom map image:", e); }
        }

        // 6. Etagen-Anreicherung (Rooms)
        const liveContacts = dataToUse.contacts || [];
        const enrichedRooms = (dataToUse.rooms || []).map(room => {
            const apt = (room.apartment || '').toLowerCase().trim();
            const match = liveContacts.find(c => {
                const cn = (c.name || '').toLowerCase().trim();
                return cn && apt && (cn.includes(apt) || apt.includes(cn));
            });
            const floor = (match?.floor || '').trim();
            return floor ? { ...room, stockwerk: floor } : room;
        });

        // 7. Prepare Data for Document Component
        const docData = {
            ...dataToUse,
            rooms: enrichedRooms,
            damageType: dataToUse.damageCategory || '-',
            images: processedImages,
            damageTypeImages: processedHeroImages,
            damageTypeImage: processedHeroImages[0] || null,
            exteriorPhoto: processedExteriorPhoto,
            customMapImage: processedCustomMapImage,
            staticMapUrl: staticMapUrl || null,
        };

        console.log("[PDFService Master] Generiere PDF-Blob...");
        onProgress("Generiere PDF-Dokument...");

        // 8. Generate Blob using @react-pdf
        const rawBlob = await pdf(<DamageReportDocument key={Math.random()} data={docData} />).toBlob();
        if (!rawBlob || rawBlob.size === 0) {
            throw new Error('PDF Blob ist leer - Layout-Fehler in react-pdf');
        }

        const blob = new Blob([rawBlob], { type: 'application/pdf' });
        
        // 9. Filename Logic
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const dateStr = now.toLocaleDateString('de-CH').replace(/\./g, '-');
        const projNum = dataToUse.projectNumber || dataToUse.projectTitle || 'Project';
        const location = dataToUse.locationDetails || dataToUse.city || 'Schadenort';
        let fileName = customFileName || `${projNum}_${location}_${dateStr}_${timeStr}.pdf`;
        if (!fileName.toLowerCase().endsWith('.pdf')) {
            fileName = `${fileName}.pdf`;
        }

        console.log(`[PDFService Master] PDF erfolgreich generiert: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        
        return { blob, fileName, docData };
    }
};
