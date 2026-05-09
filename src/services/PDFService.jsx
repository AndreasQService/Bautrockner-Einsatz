
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

        // --- INTERNE HELPER AUS DAMAGEFORM (MASTER-LOGIK) ---
        
        const internalUrlToDataUrl = async (url, imgObj = null) => {
            if (!url) return null;

            const resizeImage = async (dataUrl) => {
                if (!dataUrl) return null;
                return new Promise((resolve) => {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        const MAX_SIZE = 1200; 
                        let width = img.width;
                        let height = img.height;
                        if (width > height) {
                            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                        } else {
                            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    };
                    img.onerror = () => resolve(dataUrl.startsWith('data:') ? dataUrl : null);
                    img.src = dataUrl;
                });
            };

            if (url.startsWith('data:')) return await resizeImage(url);

            // Method A: Supabase
            if (supabase && (url.includes('supabase.co') || imgObj?.storagePath)) {
                try {
                    let path = imgObj?.storagePath || (url.includes('case-files/') ? url.split('case-files/').pop()?.split('?')[0] : null);
                    if (path) {
                        const { data, error } = await supabase.storage.from('case-files').download(path);
                        if (data && !error) {
                            const raw = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(data);
                            });
                            return await resizeImage(raw);
                        }
                    }
                } catch (e) { console.warn("[PDFService Master] Supabase error", e); }
            }

            // Method B: Fetch
            try {
                const response = await fetch(url, { cache: 'no-cache' });
                if (response.ok) {
                    const blob = await response.blob();
                    const raw = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    return await resizeImage(raw);
                }
            } catch (err) { }

            // Method C: Canvas Backup
            try {
                const raw = await new Promise((resolve) => {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/jpeg', 0.9));
                        } catch (e) { resolve(null); }
                    };
                    img.onerror = () => resolve(null);
                    img.src = url;
                });
                if (raw) return await resizeImage(raw);
            } catch (err) { }
            return await resizeImage(url);
        };

        // --- STRUKTURELLER CONTAINER ENDE ---
        console.log("[PDFService Master] Struktur bereit. Logik wird in Schritt 2 implementiert.");
        return null;
    }
};
