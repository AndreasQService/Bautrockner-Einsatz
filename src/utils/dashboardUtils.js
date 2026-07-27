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

export const getDryingStartDate = (report) => {
    if (report.dryingStarted) return report.dryingStarted;
    if (report.equipment && report.equipment.length > 0) {
        const dates = report.equipment.map(e => e.startDate).filter(d => d).sort();
        if (dates.length > 0) return dates[0];
    }
    return report.date;
};

export const formatEquipmentDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
};

export const formatCompletedEquipmentRuntime = (startDateStr, endDateStr) => {
    if (!startDateStr) return '-';
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return '-';
    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) return '-';
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    const diffTime = end - start;
    return `${Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))} d`;
};

export const formatActiveEquipmentRuntime = (startDateStr, referenceDate) => {
    if (!startDateStr) return '-';
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return '-';
    const end = new Date(referenceDate);
    if (isNaN(end.getTime())) return '-';
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    const diffTime = end - start;
    return `${Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))} d`;
};

export const formatEquipmentTypeModel = (equipment) =>
    [equipment.type, equipment.model].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' - ');

export const formatEquipmentLocation = (equipment) => {
    if (!equipment.room) return '';
    return `${equipment.apartment ? `${equipment.apartment} - ` : ''}${equipment.room}`;
};

export const formatEquipmentProjectAddress = (report) => ({
    street: report.street || 'Keine Strasse',
    details: `${[report.zip, report.city].filter(Boolean).join(' ')} ${report.projectNumber ? `(${report.projectNumber})` : ''}`,
});

export const getEquipmentStatus = (equipment) => {
    const isAktiv = !equipment.endDate;
    const statusStyle = isAktiv ? {
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#10B981',
        border: '1px solid rgba(16, 185, 129, 0.25)'
    } : {
        bg: 'rgba(59, 130, 246, 0.15)',
        color: '#3B82F6',
        border: '1px solid rgba(59, 130, 246, 0.25)'
    };

    return {
        isAktiv,
        label: isAktiv ? 'Aktiv' : 'Deinstalliert',
        statusStyle
    };
};
