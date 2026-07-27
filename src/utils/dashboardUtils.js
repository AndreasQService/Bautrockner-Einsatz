export const formatTechnicianLocation = (report) => {
    const streetPart = report.street?.trim();
    const cityPart = [report.zip, report.city].filter(p => p && p.trim()).join(' ');
    let loc = [streetPart, cityPart].filter(Boolean).join(', ');
    if (!loc || loc === ', , ' || loc === ',') {
        loc = report.address ? report.address.split(',')[0] : 'Keine Adresse';
    }
    return loc;
};
