
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
            const logoResp = await fetch(window.location.origin + '/logo.png');
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
        } catch (e) { console.warn('PDF Service: Google Static Map error', e); }

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
        const sanitize = (s) => String(s || '').replace(/[/\\?%*:|"<>]/g, '-').replace(/-+/g, '-').trim();
        const projNum = sanitize(formData.projectNumber || formData.projectTitle || 'Project');
        const location = sanitize(formData.locationDetails || formData.city || 'Schadenort');
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
    }
};
