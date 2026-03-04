
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
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

        // Process images
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
                    return base64 ? { ...img, preview: base64, isRenderable: true } : { ...img, isRenderable: false };
                } catch (e) {
                    return { ...img, isRenderable: false };
                }
            })
        );

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

        const docData = {
            ...formData,
            damageType: formData.damageCategory || '-',
            images: processedImages,
            damageTypeImages: processedHeroImages,
            damageTypeImage: processedHeroImages[0] || null,
            exteriorPhoto: processedExteriorPhoto,
            logo: logoData,
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

    downloadBlob: (blob, fileName) => {
        saveAs(blob, fileName);
    }
};
