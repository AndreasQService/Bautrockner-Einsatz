import * as pdfjsLib from 'pdfjs-dist';

// Use UNPKG for worker to avoid complicated Vite setup.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const convertPdfToImages = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const images = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better resolution

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Convert canvas to Data URL (PNG)
            const dataUrl = canvas.toDataURL('image/png');
            images.push({
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                preview: dataUrl,
                description: `Messprotokoll Seite ${i}`,
                includeInReport: true
            });
        }
        return images;
    } catch (error) {
        console.error("Error converting PDF to images: ", error);
        throw error;
    }
};
