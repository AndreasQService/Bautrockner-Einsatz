import React from 'react';

/* Custom PDF Icon */
export const PdfIcon = ({ size = 24, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="14 2 14 8 20 8" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="11" width="18" height="7" rx="1.5" fill="#ef4444" />
        <text x="12" y="15.5" fill="white" fontSize="5.5" fontWeight="900" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Arial, sans-serif', userSelect: 'none' }}>PDF</text>
    </svg>
);

/* Custom VCF Icon */
export const VcfIcon = ({ size = 24, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white" stroke="#0F6EA3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="14 2 14 8 20 8" fill="none" stroke="#0F6EA3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="11" width="18" height="7" rx="1.5" fill="#0F6EA3" />
        <text x="12" y="15.5" fill="white" fontSize="5.5" fontWeight="900" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Arial, sans-serif', userSelect: 'none' }}>VCF</text>
    </svg>
);

/* Custom Calendar Icon */
export const CalendarIcon = ({ size = 24, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="white" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="11" width="18" height="7" rx="1" fill="#10B981" />
        <text x="12" y="15.5" fill="white" fontSize="5.5" fontWeight="900" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Arial, sans-serif', userSelect: 'none' }}>ICS</text>
    </svg>
);

export const STEPS = ['Schadenaufnahme', 'Leckortung', 'Trocknung', 'Instandsetzung', 'Abgeschlossen'];

export const statusColors = {
    'Schadenaufnahme': 'bg-gray-100',
    'Leckortung': 'bg-blue-100',
    'Trocknung': 'bg-yellow-100',
    'Instandsetzung': 'bg-green-100',
    'Abgeschlossen': 'bg-gray-200'
};

export const ROOM_OPTIONS = [
    "Wohnzimmer",
    "Bad",
    "Dusche",
    "Flur",
    "Schlafzimmer",
    "Treppenhaus",
    "Keller",
    "Garage",
    "Küche",
    "Abstellraum",
    "Gäste-WC",
    "Kinderzimmer 1",
    "Kinderzimmer 2",
    "Esszimmer",
    "Arbeitszimmer / Büro",
    "Hauswirtschaftsraum (HWR)",
    "Reduit",
    "Estrich",
    "Sonstiges / Eigener Name"
];
