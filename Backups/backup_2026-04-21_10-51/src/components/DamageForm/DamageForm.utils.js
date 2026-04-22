export const getDaysDiff = (start, end) => {
    if (!start || !end) return 0;
    const date1 = new Date(start);
    const date2 = new Date(end);
    const diffTime = Math.abs(date2 - date1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

export const addAnnotationToImage = (imgSrc, type = 'circle') => {
    return new Promise((resolve) => {
        const img = new window.Image();
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

export const parseAddress = (addr) => {
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

export const resizeImage = async (dataUrl) => {
    if (!dataUrl) return null;
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const MAX_SIZE = 1000;
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
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(dataUrl.startsWith('data:') ? dataUrl : null);
        img.src = dataUrl;
    });
};

export const urlToDataUrl = async (url, imgObj = null, supabase = null) => {
    if (!url) return null;

    if (url.startsWith('data:')) return await resizeImage(url);

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
        } catch (e) { console.warn("PDF Utils: Supabase error", e); }
    }

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
