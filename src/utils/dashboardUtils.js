export const formatTechnicianLocation = (report) => {
    const streetPart = report.street?.trim();
    const cityPart = [report.zip, report.city].filter(p => p && p.trim()).join(' ');
    let loc = [streetPart, cityPart].filter(Boolean).join(', ');
    if (!loc || loc === ', , ' || loc === ',') {
        loc = report.address ? report.address.split(',')[0] : 'Keine Adresse';
    }
    return loc;
};

export const formatTechnicianProjectReference = (report) => {
    const isId = (s) => typeof s === 'string' && (s.match(/-/g) || []).length >= 3 && !s.includes(' ');
    const parts = [report.projectNumber, report.projectTitle].filter(s => s && s.trim() && !isId(s));
    return parts.length > 0 ? parts.join(' - ') : '-';
};
