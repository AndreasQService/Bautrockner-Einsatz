import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Plus, 
    X, 
    ChevronDown, 
    Calendar, 
    Info, 
    Trash2, 
    Image, 
    Camera, 
    Save, 
    RotateCcw,
    Mail,
    Pen,
    Eraser,
    Undo,
    PenOff,
    Move,
    Check,
    Sun,
    Moon
} from 'lucide-react';
import MeasurementSketchCanvas from '../MeasurementSketchCanvas';

// Default starting positions for draggable photos (in %)
const DEFAULT_POSITIONS = [
    { x: 5, y: 5 }, { x: 50, y: 5 },
    { x: 5, y: 50 }, { x: 50, y: 50 },
];

// Pre-defined premium SVGs as mock data for Bathroom Sanierung photos
const MOCK_PHOTOS = [
    {
        id: 'photo1',
        title: 'Rohbau Badezimmer',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#E2E8F0"/>
            <path d="M50 40H250V160H50V40Z" stroke="#94A3B8" stroke-width="2" stroke-dasharray="4 4"/>
            <line x1="120" y1="40" x2="120" y2="160" stroke="#94A3B8" stroke-width="2"/>
            <line x1="50" y1="120" x2="250" y2="120" stroke="#CBD5E1" stroke-width="1.5"/>
            <rect x="70" y="60" width="30" height="60" fill="#94A3B8" opacity="0.3"/>
            <circle cx="85" cy="90" r="8" fill="#EF4444" opacity="0.5"/>
            <text x="150" y="105" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Bestand / Abbruch</text>
        </svg>`)
    },
    {
        id: 'photo2',
        title: 'Sanitär Leitungen',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#F1F5F9"/>
            <path d="M80 160V80H220V160" stroke="#3B82F6" stroke-width="4" stroke-linecap="round"/>
            <path d="M100 160V100H200V160" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/>
            <circle cx="150" cy="80" r="10" fill="#CBD5E1" stroke="#475569" stroke-width="2"/>
            <text x="150" y="130" fill="#475569" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Rohinstallation Wasser</text>
        </svg>`)
    },
    {
        id: 'photo3',
        title: 'Estrich & Dämmung',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#F8FAFC"/>
            <rect x="40" y="140" width="220" height="30" fill="#94A3B8" rx="2"/>
            <rect x="40" y="110" width="220" height="25" fill="#CBD5E1" rx="2"/>
            <line x1="40" y1="135" x2="260" y2="135" stroke="#FFFFFF" stroke-width="2"/>
            <text x="150" y="70" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Bodenaufbau fertiggestellt</text>
        </svg>`)
    }
];

// Pre-drawn premium SVGs for Bathroom Sanierung sketches
const INITIAL_SKETCHES = [
    {
        id: 'sketch1',
        title: 'Grundriss – Bestandsaufnahme',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="#1E293B" stroke-width="3"/>
            <!-- Wände & Türen -->
            <path d="M20 140H60" stroke="#1E293B" stroke-width="3"/>
            <path d="M60 140C60 160 40 180 20 180" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="2 2"/>
            <line x1="60" y1="140" x2="20" y2="180" stroke="#3B82F6" stroke-width="2"/>
            <!-- Waschtisch Bestand -->
            <rect x="220" y="60" width="40" height="30" rx="3" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
            <circle cx="240" cy="75" r="5" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
            <!-- Badewanne Bestand -->
            <rect x="20" y="20" width="100" height="50" rx="4" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
            <ellipse cx="70" cy="45" rx="40" ry="18" fill="none" stroke="#CBD5E1" stroke-width="1"/>
            <!-- Bemassung -->
            <line x1="20" y1="190" x2="280" y2="190" stroke="#EF4444" stroke-width="1"/>
            <path d="M20 187V193M280 187V193" stroke="#EF4444" stroke-width="1"/>
            <text x="150" y="197" fill="#EF4444" font-family="monospace" font-size="9" text-anchor="middle">3.20 m</text>
            <text x="150" y="105" fill="#94A3B8" font-family="sans-serif" font-size="11" text-anchor="middle">Badezimmer Altbestand</text>
        </svg>`)
    },
    {
        id: 'sketch2',
        title: 'Grundriss – Neuplanung',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="#1E293B" stroke-width="3"/>
            <!-- Dusche neu -->
            <rect x="20" y="20" width="80" height="80" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/>
            <line x1="20" y1="20" x2="100" y2="100" stroke="#3B82F6" stroke-width="1" stroke-dasharray="3 3"/>
            <line x1="100" y1="20" x2="20" y2="100" stroke="#3B82F6" stroke-width="1" stroke-dasharray="3 3"/>
            <circle cx="60" cy="60" r="4" fill="#3B82F6"/>
            <!-- WC neu -->
            <rect x="230" y="120" width="30" height="40" rx="4" fill="none" stroke="#1E6DB7" stroke-width="1.5"/>
            <rect x="225" y="110" width="40" height="10" rx="1" fill="none" stroke="#1E6DB7" stroke-width="1.5"/>
            <text x="150" y="105" fill="#1E6DB7" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Dusche &amp; WC neu platziert</text>
        </svg>`)
    },
    {
        id: 'sketch3',
        title: 'Sanitär – Anschlüsse',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none">
            <rect width="300" height="200" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
            <rect x="20" y="20" width="260" height="160" fill="none" stroke="#1E293B" stroke-width="2" stroke-dasharray="8 4"/>
            <!-- Kaltwasser (Blau) -->
            <path d="M40 180V120H180V60" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="180" cy="60" r="6" fill="#2563EB"/>
            <!-- Warmwasser (Rot) -->
            <path d="M55 180V135H195V60" stroke="#DC2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="195" cy="60" r="6" fill="#DC2626"/>
            <text x="120" y="110" fill="#2563EB" font-family="sans-serif" font-size="10" font-weight="bold">KW Ø16</text>
            <text x="210" y="110" fill="#DC2626" font-family="sans-serif" font-size="10" font-weight="bold">WW Ø16</text>
            <text x="150" y="35" fill="#1E293B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Anschlussleitung Höhe 55cm</text>
        </svg>`)
    }
];

// Pre-drawn premium SVGs for existing project photos (damage report pool)
const PROJECT_PHOTOS_POOL = [
    {
        id: 'proj_photo_1',
        room: 'Badezimmer',
        title: 'Leckage unter Waschtisch',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
            <rect width="600" height="400" fill="#F1F5F9"/>
            <rect x="50" y="50" width="500" height="300" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
            <rect x="200" y="150" width="200" height="150" fill="#E2E8F0" stroke="#475569" stroke-width="3"/>
            <line x1="300" y1="150" x2="300" y2="300" stroke="#475569" stroke-width="2"/>
            <path d="M290 100v60c0 15 20 15 20 30v40" fill="none" stroke="#94A3B8" stroke-width="8"/>
            <ellipse cx="310" cy="230" rx="30" ry="8" fill="#3B82F6" opacity="0.7"/>
            <path d="M310 190l-5 15h10z" fill="#3B82F6"/>
            <path d="M308 165l-4 10h8z" fill="#3B82F6"/>
            <text x="300" y="380" fill="#475569" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Originalaufnahme: Leckage Siphon (Badezimmer)</text>
        </svg>`)
    },
    {
        id: 'proj_photo_2',
        room: 'Badezimmer',
        title: 'Feuchtigkeit Wand unten',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
            <rect width="600" height="400" fill="#F1F5F9"/>
            <rect x="50" y="50" width="500" height="300" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
            <line x1="50" y1="200" x2="550" y2="200" stroke="#CBD5E1" stroke-width="1"/>
            <line x1="50" y1="280" x2="550" y2="280" stroke="#CBD5E1" stroke-width="1"/>
            <line x1="180" y1="50" x2="180" y2="350" stroke="#CBD5E1" stroke-width="1"/>
            <line x1="360" y1="50" x2="360" y2="350" stroke="#CBD5E1" stroke-width="1"/>
            <path d="M220 350c-30-10-50-40-50-60 0-30 40-50 80-50s90 30 90 60c0 20-30 40-60 50z" fill="#D97706" opacity="0.45"/>
            <path d="M240 330c-15-5-25-20-25-30 0-15 20-25 40-25s45 15 45 30c0 10-15 20-30 25z" fill="#B45309" opacity="0.6"/>
            <text x="300" y="380" fill="#475569" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Originalaufnahme: Feuchtigkeitsausbreitung (Badezimmer)</text>
        </svg>`)
    },
    {
        id: 'proj_photo_3',
        room: 'Küche',
        title: 'Wasserschaden Küchenzeile',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
            <rect width="600" height="400" fill="#F1F5F9"/>
            <rect x="50" y="50" width="500" height="300" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
            <rect x="50" y="220" width="500" height="30" fill="#D8B4FE" stroke="#6B21A8" stroke-width="2"/>
            <rect x="150" y="210" width="120" height="10" fill="#94A3B8" stroke="#475569"/>
            <path d="M100 220c10-30 40-50 80-50s90 20 110 50z" fill="#D97706" opacity="0.4"/>
            <path d="M320 220c5-15 20-25 40-25s35 10 45 25z" fill="#D97706" opacity="0.3"/>
            <text x="300" y="380" fill="#475569" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Originalaufnahme: Feuchte Küchenrückwand (Küche)</text>
        </svg>`)
    },
    {
        id: 'proj_photo_4',
        room: 'Keller',
        title: 'Bodenüberschwemmung Technik',
        src: `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
            <rect width="600" height="400" fill="#F1F5F9"/>
            <rect x="50" y="50" width="500" height="300" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
            <rect x="120" y="80" width="100" height="200" rx="10" fill="#94A3B8" stroke="#475569" stroke-width="3"/>
            <circle cx="170" cy="150" r="15" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2"/>
            <text x="170" y="154" fill="#FFFFFF" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">52°C</text>
            <path d="M50 320c100-10 200-5 300-15 100-10 150 10 200 5v40H50z" fill="#3B82F6" opacity="0.6"/>
            <ellipse cx="280" cy="300" rx="60" ry="10" fill="#2563EB" opacity="0.4"/>
            <text x="300" y="380" fill="#475569" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Originalaufnahme: Wasseraustritt Boiler (Keller)</text>
        </svg>`)
    }
];

// DraggablePhoto is now handled internally inside MeasurementSketchCanvas

const STORAGE_KEY = 'qtool_handwerker_mode_mockup_v1';

const getInitialState = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load mockup state from localStorage:", e);
    }
    return null;
};

const getQueryRole = () => {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('role');
    } catch (e) {
        return null;
    }
};

const savedState = getInitialState();

export default function HandwerkerModeMockup() {
    // ── STATE ──
    const [activeTab, setActiveTab] = useState(savedState?.activeTab || 'Arbeitsauftrag');
    const [orderNumber, setOrderNumber] = useState(savedState?.orderNumber || 'BA-2024-015');
    const [projectTitle, setProjectTitle] = useState(savedState?.projectTitle || 'Badezimmer Sanierung');
    const [description, setDescription] = useState(
        savedState?.description !== undefined ? savedState.description : 'Komplette Sanierung des Badezimmers inkl. Fliesenarbeiten, Sanitär, Elektro und Malerarbeiten. Neue Dusche, Waschtisch und WC.'
    );
    const [priority, setPriority] = useState(savedState?.priority || 'Hoch');
    const [status, setStatus] = useState(savedState?.status || 'In Arbeit');
    const [startDate, setStartDate] = useState(savedState?.startDate || '2024-05-27');
    const [endDate, setEndDate] = useState(savedState?.endDate || '2024-06-14');
    const [plannedDuration, setPlannedDuration] = useState(savedState?.plannedDuration || '40');
    const [plannedDurationUnit, setPlannedDurationUnit] = useState(savedState?.plannedDurationUnit || 'Stunden');

    // Handwerker-Zuweisung
    const [assignedHandwerker, setAssignedHandwerker] = useState(savedState?.assignedHandwerker || ['Blerim Hasan', 'Vigan Buduri']);
    const [showHandwerkerDropdown, setShowHandwerkerDropdown] = useState(false);
    const availableHandwerker = ['Blerim Hasan', 'Vigan Buduri', 'Arben Krasniqi', 'Luan Gashi'];

    // Photos state
    const [photos, setPhotos] = useState(savedState?.photos || []);

    // Sketches state
    const [sketches, setSketches] = useState(savedState?.sketches || INITIAL_SKETCHES);

    // Project Photos Selection & Room Filtering states
    const [selectedRoomFilter, setSelectedRoomFilter] = useState('');
    const [selectedPhotoId, setSelectedPhotoId] = useState('');
    const [selectedProjectPhotos, setSelectedProjectPhotos] = useState(savedState?.selectedProjectPhotos || []);
    const [customProjectPhotos, setCustomProjectPhotos] = useState(savedState?.customProjectPhotos || []);
    const [canvasBackgroundPhoto, setCanvasBackgroundPhoto] = useState(null);

    // Custom photo library import modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importRoom, setImportRoom] = useState('Badezimmer');
    const [importFile, setImportFile] = useState(null);
    const [importFilePreview, setImportFilePreview] = useState(null);

    const projectPhotosPool = [...PROJECT_PHOTOS_POOL, ...customProjectPhotos];

    const projectPhotoInputRef = useRef(null);

    // ── 3-LAYER DRAWING CANVAS STATE ──
    const [showCanvasModal, setShowCanvasModal] = useState(false);
    const [canvasTitle, setCanvasTitle] = useState('');
    const [editingSketchId, setEditingSketchId] = useState(null);

    // Zoom / Fullscreen Modal state
    const [showZoomModal, setShowZoomModal] = useState(false);
    const [zoomedSketch, setZoomedSketch] = useState(null);

    // Outlook simulation Modal state
    const [showOutlookModal, setShowOutlookModal] = useState(false);
    const [location, setLocation] = useState(savedState?.location || 'Musterstrasse 12, 8000 Zürich');

    // Role state based on URL parameter (?role=handwerker) or localStorage
    const queryRole = getQueryRole()?.toLowerCase();
    const savedRole = savedState?.userRole?.toLowerCase();
    const initialRole = queryRole === 'handwerker' ? 'Handwerker' : 
                        (queryRole === 'disponent' ? 'Disponent' : 
                        (savedRole === 'handwerker' ? 'Handwerker' : 'Disponent'));
    const [userRole, setUserRole] = useState(initialRole);
    const isUrlLocked = queryRole !== null;
    const isHandwerkerMode = userRole?.toLowerCase() === 'handwerker';

    // Dark / Light Mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('qtool_dark_mode');
        return saved !== null ? saved === 'true' : false;
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        localStorage.setItem('qtool_dark_mode', String(isDarkMode));
    }, [isDarkMode]);

    // Time tracking states for daily hours (Handwerker View)
    const [timeEntries, setTimeEntries] = useState(savedState?.timeEntries || [
        { id: 1, date: '2024-05-27', start: '07:30', end: '16:30', breakTime: '1.0', total: 8.0, task: 'Baustelle eingerichtet, Abbruch begonnen' },
        { id: 2, date: '2024-05-28', start: '07:30', end: '16:00', breakTime: '0.5', total: 8.0, task: 'Abbruch fertiggestellt, Leitungen verlegt' }
    ]);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [newTimeDate, setNewTimeDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTimeStart, setNewTimeStart] = useState('07:30');
    const [newTimeEnd, setNewTimeEnd] = useState('16:30');
    const [newTimeBreak, setNewTimeBreak] = useState('1.0');
    const [newTimeTask, setNewTimeTask] = useState('');

    const calculateHours = (start, end, breakHrs) => {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const diffMins = (eh * 60 + em) - (sh * 60 + sm);
        const diffHrs = diffMins / 60;
        return Math.max(0, diffHrs - parseFloat(breakHrs || 0));
    };

    const handleAddTimeEntry = (e) => {
        e.preventDefault();
        const total = calculateHours(newTimeStart, newTimeEnd, newTimeBreak);
        const entry = {
            id: Date.now(),
            date: newTimeDate,
            start: newTimeStart,
            end: newTimeEnd,
            breakTime: newTimeBreak,
            total: parseFloat(total.toFixed(2)),
            task: newTimeTask || 'Arbeitsleistung erbracht'
        };
        setTimeEntries(prev => [...prev, entry]);
        setShowTimeModal(false);
        setNewTimeTask('');
    };

    // Photo upload reference and handler for live photo capture (Handwerker View)
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newPhoto = {
                    id: `photo_${Date.now()}`,
                    title: file.name.split('.')[0] || 'Foto vor Ort',
                    src: reader.result
                };
                setPhotos(prev => [...prev, newPhoto]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProjectPhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newProjPhoto = {
                    id: `custom_proj_photo_${Date.now()}`,
                    room: selectedRoomFilter || 'Badezimmer',
                    title: file.name.split('.')[0] || 'Foto Mediathek',
                    src: reader.result
                };
                setCustomProjectPhotos(prev => [...prev, newProjPhoto]);
                setSelectedPhotoId(newProjPhoto.id);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    // Click outside handler for Handwerker Zuweisung dropdown
    const handwerkerDropdownRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (handwerkerDropdownRef.current && !handwerkerDropdownRef.current.contains(e.target)) {
                setShowHandwerkerDropdown(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, []);

    // ── HANDWERKER ASSIGNMENT UTILS ──
    const toggleHandwerker = (name) => {
        if (assignedHandwerker.includes(name)) {
            setAssignedHandwerker(prev => prev.filter(h => h !== name));
        } else {
            setAssignedHandwerker(prev => [...prev, name]);
        }
    };

    // ── SEPARATE ISOLATED STORAGE FUNCTIONS (AUTOSAVE & LIVE SYNC) ──
    useEffect(() => {
        try {
            const stateToSave = {
                activeTab,
                orderNumber,
                projectTitle,
                description,
                priority,
                status,
                startDate,
                endDate,
                plannedDuration,
                plannedDurationUnit,
                assignedHandwerker,
                photos,
                sketches,
                location,
                userRole,
                timeEntries,
                selectedProjectPhotos,
                customProjectPhotos
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to autosave mockup state to localStorage:", e);
        }
    }, [
        activeTab,
        orderNumber,
        projectTitle,
        description,
        priority,
        status,
        startDate,
        endDate,
        plannedDuration,
        plannedDurationUnit,
        assignedHandwerker,
        photos,
        sketches,
        location,
        userRole,
        timeEntries,
        selectedProjectPhotos,
        customProjectPhotos
    ]);

    // Live cross-tab sync via storage events
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    if (data.photos) setPhotos(data.photos);
                    if (data.timeEntries) setTimeEntries(data.timeEntries);
                    if (data.status) setStatus(data.status);
                    if (data.selectedProjectPhotos) setSelectedProjectPhotos(data.selectedProjectPhotos);
                    if (data.customProjectPhotos) setCustomProjectPhotos(data.customProjectPhotos);
                    if (data.sketches) setSketches(data.sketches);
                    if (data.orderNumber) setOrderNumber(data.orderNumber);
                    if (data.projectTitle) setProjectTitle(data.projectTitle);
                    if (data.description) setDescription(data.description);
                    if (data.startDate) setStartDate(data.startDate);
                    if (data.endDate) setEndDate(data.endDate);
                    if (data.plannedDuration) setPlannedDuration(data.plannedDuration);
                    if (data.plannedDurationUnit) setPlannedDurationUnit(data.plannedDurationUnit);
                    if (data.assignedHandwerker) setAssignedHandwerker(data.assignedHandwerker);
                    if (data.location) setLocation(data.location);
                    if (data.priority) setPriority(data.priority);
                    if (data.userRole) setUserRole(data.userRole);
                    if (data.activeTab) setActiveTab(data.activeTab);
                } catch (err) {
                    console.error("Error parsing storage sync data:", err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const handleResetState = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            alert('Mockup-Speicher gelöscht. Standard-Testdaten werden neu geladen...');
            window.location.reload();
        } catch (e) {
            console.error("Failed to reset mockup state:", e);
            alert('Fehler beim Zurücksetzen: ' + e.message);
        }
    };

    // ── OUTLOOK ICS CALENDAR GENERATION ──
    const downloadIcsFile = () => {
        try {
            const formattedStart = startDate.replace(/-/g, '');
            const formattedEnd = endDate.replace(/-/g, '');
            
            const attendeeString = assignedHandwerker.map(name => {
                const email = name.toLowerCase().replace(' ', '.') + '@q-service.ch';
                return `ATTENDEE;CN="${name}":mailto:${email}`;
            }).join('\r\n');

            const descriptionText = `Hallo,

du bist fuer diesen Auftrag eingeteilt.

Details zum Einsatz:
- Auftragsnummer: ${orderNumber}
- Standort: ${location}
- Zeitraum: ${startDate} bis ${endDate}
- Zeitaufwand: ${plannedDuration} ${plannedDurationUnit}

Beschreibung:
${description.replace(/\n/g, ' ')}

Link zum Auftrag:
https://qtool.q-service.ch/project/${orderNumber}`;

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Q-Service//QTool Mockup//DE',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'BEGIN:VEVENT',
                `UID:${orderNumber}-${Date.now()}@q-service.ch`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                `DTSTART:${formattedStart}T080000`,
                `DTEND:${formattedEnd}T170000`,
                `SUMMARY:Arbeitsauftrag ${orderNumber}: ${projectTitle}`,
                `LOCATION:${location.replace(/,/g, '\\,')}`,
                `DESCRIPTION:${descriptionText.replace(/\n/g, '\\n')}`,
                attendeeString,
                `URL;VALUE=URI:https://qtool.q-service.ch/project/${orderNumber}`,
                'END:VEVENT',
                'END:VCALENDAR'
            ].filter(Boolean).join('\r\n');

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `Arbeitsauftrag_${orderNumber}.ics`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Failed to generate ICS file:", e);
            alert("Fehler bei der ICS-Generierung: " + e.message);
        }
    };

    // ── HANDLERS FOR MOCK BUTTONS ──
    const handleOutlookClick = () => {
        setShowOutlookModal(true);
    };

    const handleNewOrderClick = () => {
        alert("Ein neuer Arbeitsauftrag kann in diesem isolierten Mockup nicht erstellt werden.");
    };

    const handleAddPhotoClick = () => {
        alert("Upload im Mockup nicht integriert.\n\nIn der produktiven Version öffnet dieser Button die Kamera des iPads oder die Fotogalerie zum Hochladen von Schadenbildern.");
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: 'var(--background)', 
            color: 'var(--text-main)', 
            fontFamily: 'var(--font-desktop)',
            padding: '1.5rem',
            boxSizing: 'border-box'
        }}>
            
            {/* ── 1. HEADER (Styled exactly like QTool Modulboxen/Cards) ── */}
            <header className="card" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '1rem 1.5rem', 
                marginBottom: '1.5rem',
                border: '1.5px solid var(--border)'
            }}>
                {isHandwerkerMode ? (
                    // ── Simplified Handwerker Header ──
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span>📍</span>
                                <span>{location}</span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '1.1rem', marginLeft: '0.5rem' }}>({orderNumber})</span>
                            </h1>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ 
                                fontSize: '0.8rem', 
                                color: 'var(--text-muted)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.3rem',
                                fontWeight: 600
                            }}>
                                🟢 Automatisch gespeichert
                            </span>
                            
                            {/* Theme Switcher (Light / Dark Mode Toggle) */}
                            <div style={{ 
                                display: 'flex', 
                                backgroundColor: 'var(--color-input-bg)', 
                                borderRadius: '4px', 
                                padding: '0.2rem',
                                border: '1.5px solid var(--border)',
                                marginLeft: '0.5rem'
                            }}>
                                <button
                                    onClick={() => setIsDarkMode(false)}
                                    style={{
                                        background: !isDarkMode ? 'var(--primary)' : 'none',
                                        color: !isDarkMode ? 'white' : 'var(--text-muted)',
                                        border: 'none',
                                        borderRadius: '3px',
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Sun size={14} /> Hell
                                </button>
                                <button
                                    onClick={() => setIsDarkMode(true)}
                                    style={{
                                        background: isDarkMode ? 'var(--primary)' : 'none',
                                        color: isDarkMode ? 'white' : 'var(--text-muted)',
                                        border: 'none',
                                        borderRadius: '3px',
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Moon size={14} /> Dunkel
                                </button>
                            </div>

                            {!isUrlLocked && (
                                <button 
                                    onClick={() => setUserRole('Disponent')}
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        padding: '0.4rem 0.8rem', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer',
                                        borderColor: 'var(--primary)',
                                        color: 'var(--primary)',
                                        marginLeft: '0.5rem'
                                    }}
                                >
                                    🔄 Zur Disponenten-Ansicht
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    // ── Full Disponent Header ──
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                    {projectTitle}
                                </h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'nowrap' }}>
                                    <span style={{ 
                                        fontSize: '0.85rem', 
                                        color: 'var(--primary)', 
                                        backgroundColor: 'var(--color-primary-soft)', 
                                        fontWeight: 800, 
                                        padding: '0.2rem 0.6rem', 
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border-strong)',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '0.02em'
                                    }}>
                                        {orderNumber}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
                                    <span 
                                        className="status-badge bg-green-100"
                                        style={{ 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            padding: '0.2rem 0.6rem', 
                                            borderRadius: '20px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {status}
                                    </span>
                                </div>
                            </div>
 
                            {/* Theme Switcher Toggle Button */}
                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="btn btn-outline"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '38px',
                                    height: '38px',
                                    padding: 0,
                                    cursor: 'pointer',
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-muted)',
                                    borderRadius: '4px',
                                    marginLeft: '0.5rem',
                                    flexShrink: 0
                                }}
                                title={isDarkMode ? "In den hellen Modus wechseln" : "In den dunklen Modus wechseln"}
                            >
                                {isDarkMode ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} />}
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0 }}>
                            {!isUrlLocked && (
                                <button 
                                    onClick={() => setUserRole('Handwerker')}
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        padding: '0.5rem 0.9rem', 
                                        fontSize: '0.82rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer',
                                        borderColor: 'var(--primary)',
                                        color: 'var(--primary)',
                                        whiteSpace: 'nowrap',
                                        height: '38px',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    🛠️ Handwerker-Ansicht
                                </button>
                            )}
                            {isUrlLocked && (
                                <button 
                                    onClick={() => window.open(window.location.pathname + '?role=handwerker', '_blank')}
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        padding: '0.5rem 0.9rem', 
                                        fontSize: '0.82rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer',
                                        borderColor: 'var(--primary)',
                                        color: 'var(--primary)',
                                        whiteSpace: 'nowrap',
                                        height: '38px',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <Info size={14} /> Link vorschauen
                                </button>
                            )}
                            <span style={{ 
                                fontSize: '0.78rem', 
                                color: 'var(--text-muted)', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.3rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                marginRight: '0.2rem'
                            }}>
                                🟢 Auto-Save
                            </span>

                            <button 
                                onClick={handleOutlookClick}
                                className="btn btn-outline"
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.4rem', 
                                    padding: '0.5rem 0.9rem', 
                                    fontSize: '0.82rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    height: '38px',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <Mail size={14} /> Outlook
                            </button>
                            <button 
                                onClick={handleNewOrderClick}
                                className="btn btn-outline"
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    width: '38px',
                                    height: '38px',
                                    padding: 0,
                                    cursor: 'pointer',
                                    opacity: 0.5,
                                    flexShrink: 0,
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-muted)',
                                    boxSizing: 'border-box'
                                }}
                                title="Neuer Auftrag (inaktiv)"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </>
                )}
            </header>

            {/* ── 2. TABS (Styled matching standard tabs) ── */}
            {!isHandwerkerMode && (
                <nav style={{ 
                    display: 'flex', 
                    gap: '0.25rem', 
                    borderBottom: '2px solid var(--border)', 
                    marginBottom: '1.5rem',
                    paddingBottom: '0.1rem'
                }}>
                    {['Übersicht', 'Arbeitsauftrag', 'Fotos', 'Skizzen', 'Handwerker', 'Fortschritt'].map(tab => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                    padding: '0.75rem 1.25rem',
                                    fontSize: '0.95rem',
                                    fontWeight: isActive ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.12s',
                                    marginBottom: '-3px'
                                }}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </nav>
            )}

            {/* ── 3. MAIN WORKSPACE (TWO COLUMNS / ROLE SPECIFIC) ── */}
            {isHandwerkerMode ? (
                /* ── HANDWERKER / RECIPIENT VIEW (SEPARATE INTERFACE) ── */
                <main style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.1fr 0.9fr', 
                    gap: '1.5rem',
                    alignItems: 'start'
                }}>
                    {/* LEFT COLUMN: Read-Only Order Card & Daily Time Tracking Sheet */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                        Auftrag: {orderNumber}
                                    </h2>
                                    <button 
                                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`, '_blank')}
                                        className="btn btn-outline"
                                        style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.4rem', 
                                            padding: '0.4rem 0.8rem', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            cursor: 'pointer',
                                            borderColor: 'var(--primary)',
                                            color: 'var(--primary)'
                                        }}
                                    >
                                        <Move size={12} /> Google Maps Route
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>


                                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adresse:</span>
                                    <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{location}</p>
                                </div>

                                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Beschreibung</span>
                                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', lineHeight: 1.4, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{description}</p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Zeitfenster</span>
                                        <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, fontSize: '0.85rem' }}>{startDate} bis {endDate}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Geplanter Aufwand</span>
                                        <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, fontSize: '0.85rem' }}>{plannedDuration} {plannedDurationUnit}</p>
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Dein Team vor Ort</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {assignedHandwerker.length === 0 ? (
                                            <span style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Keine Kollegen zugewiesen.</span>
                                        ) : (
                                            assignedHandwerker.map(name => (
                                                <span 
                                                    key={name}
                                                    style={{ 
                                                        backgroundColor: 'var(--color-primary-soft)', 
                                                        color: 'var(--primary)', 
                                                        padding: '0.3rem 0.75rem', 
                                                        borderRadius: '4px', 
                                                        fontSize: '0.8rem', 
                                                        fontWeight: 700,
                                                        border: '1px solid var(--color-border-strong)'
                                                    }}
                                                >
                                                    👤 {name}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* STUNDENERFASSUNG (DAILY TIME TRACKING SHEET) */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                    Tägliche Stundenerfassung
                                </h2>
                                <button 
                                    onClick={() => setShowTimeModal(true)}
                                    className="btn btn-primary"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.5rem', 
                                        padding: '0.6rem 1.5rem', 
                                        fontWeight: 700, 
                                        height: '42px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={16} /> Stunden buchen
                                </button>
                            </div>

                            {timeEntries.length === 0 ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                    Keine Stunden erfasst. Klicken Sie auf „Stunden buchen“, um Ihren heutigen Aufwand zu erfassen.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1.5px solid var(--border)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700 }}>
                                                <th style={{ padding: '0.5rem' }}>Datum</th>
                                                <th style={{ padding: '0.5rem' }}>Arbeitszeit</th>
                                                <th style={{ padding: '0.5rem' }}>Pause</th>
                                                <th style={{ padding: '0.5rem' }}>Gesamt</th>
                                                <th style={{ padding: '0.5rem' }}>Tätigkeit</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'center' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {timeEntries.map(entry => (
                                                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                                                    <td style={{ padding: '0.6rem 0.5rem' }}>{entry.date}</td>
                                                    <td style={{ padding: '0.6rem 0.5rem' }}>{entry.start} - {entry.end}</td>
                                                    <td style={{ padding: '0.6rem 0.5rem' }}>{entry.breakTime} Std.</td>
                                                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>{entry.total.toFixed(2)} Std.</td>
                                                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.task}>{entry.task}</td>
                                                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => setTimeEntries(prev => prev.filter(t => t.id !== entry.id))}
                                                            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ backgroundColor: 'var(--color-primary-soft)', fontWeight: 700 }}>
                                                <td colSpan="3" style={{ padding: '0.75rem 0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Gesamtstunden erfasst</td>
                                                <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
                                                    {timeEntries.reduce((sum, e) => sum + e.total, 0).toFixed(2)} Std.
                                                </td>
                                                <td colSpan="2" style={{ padding: '0.75rem 0.5rem' }}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* WORKFLOW ACTUATOR */}
                            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => {
                                        setStatus('Abgeschlossen');
                                        alert("Einsatz erfolgreich abgeschlossen! Alle erfassten Stunden und hochgeladenen Fotos wurden lokal gesichert.");
                                    }}
                                    className="btn btn-primary"
                                    style={{ padding: '0.6rem 1.5rem', fontWeight: 700, height: '42px' }}
                                >
                                    Einsatz beenden
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* RIGHT COLUMN: Photos & Sketches Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* PHOTOS CARD (WITH CAPTURE/UPLOAD SUPPORT!) */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                    Bilder Instandstellung
                               </h2>
                                <div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        accept="image/*" 
                                        style={{ display: 'none' }}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="btn btn-outline"
                                        style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.6rem', 
                                            padding: '0.75rem 1.5rem', 
                                            fontSize: '0.95rem', 
                                            fontWeight: 700, 
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Camera size={18} /> Foto aufnehmen
                                    </button>
                                </div>
                            </div>

                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                                gap: '1.25rem', 
                                padding: '0.5rem 0',
                                overflow: 'visible'
                            }}>
                                {photos.length === 0 ? (
                                    <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, gridColumn: '1 / -1' }}>Keine Bilder erfasst</p>
                                ) : (
                                    photos.map(photo => (
                                        <div 
                                            key={photo.id}
                                            style={{ 
                                                position: 'relative',
                                                borderRadius: '6px',
                                                border: '1.5px solid var(--border)',
                                                backgroundColor: '#FFFFFF',
                                                overflow: 'visible',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                height: '140px'
                                            }}
                                        >
                                            {/* White image container */}
                                            <div style={{ 
                                                flex: 1, 
                                                backgroundColor: '#FFFFFF', 
                                                borderTopLeftRadius: '5px', 
                                                borderTopRightRadius: '5px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                padding: '4px'
                                            }}>
                                                <img 
                                                    src={photo.src} 
                                                    alt={photo.title}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            </div>

                                            {/* Dark band at the bottom */}
                                            <div style={{ 
                                                backgroundColor: '#1E293B', 
                                                color: '#F8FAFC', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                padding: '0.4rem', 
                                                textAlign: 'center',
                                                borderBottomLeftRadius: '5px',
                                                borderBottomRightRadius: '5px',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                borderTop: '1px solid rgba(255,255,255,0.08)'
                                            }}>
                                                {photo.title}
                                            </div>

                                            {/* Overlapping red delete circle button */}
                                            <button 
                                                onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-8px',
                                                    right: '-8px',
                                                    backgroundColor: '#EF4444',
                                                    color: 'white',
                                                    border: '2px solid #1E293B',
                                                    borderRadius: '50%',
                                                    width: '22px',
                                                    height: '22px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                                    zIndex: 10
                                                }}
                                            >
                                                <X size={12} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* PLANNER CREATED SKETCHES CARD (READ ONLY) */}
                        <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                            <h2 className="section-header" style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Informationen
                            </h2>
                            {sketches.length === 0 && selectedProjectPhotos.length === 0 ? (
                                <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Keine Pläne oder Projektbilder hinterlegt.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    {/* 1. Render all assigned original project photos with green "Original" badge */}
                                    {projectPhotosPool.filter(p => selectedProjectPhotos.includes(p.id)).map(photo => (
                                        <div 
                                            key={photo.id}
                                            onClick={() => {
                                                setZoomedSketch({ id: photo.id, title: `${photo.title} (Original)`, src: photo.src });
                                                setShowZoomModal(true);
                                            }}
                                            className="card"
                                            style={{
                                                padding: 0,
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                border: '1.5px solid var(--border)'
                                            }}
                                        >
                                            <div style={{ 
                                                height: '100px', 
                                                backgroundColor: '#FFFFFF', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                borderBottom: '1px solid var(--border)',
                                                overflow: 'hidden'
                                            }}>
                                                <img 
                                                    src={photo.src} 
                                                    alt={photo.title} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            </div>
                                            <div style={{ 
                                                padding: '0.4rem', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                color: 'var(--text-main)',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>{photo.title}</span>
                                                <span style={{ 
                                                    fontSize: '0.65rem', 
                                                    color: '#065F46', 
                                                    backgroundColor: '#ECFDF5', 
                                                    padding: '0.1rem 0.4rem', 
                                                    borderRadius: '4px',
                                                    fontWeight: 800,
                                                    border: '1.5px solid #A7F3D0'
                                                }}>Original</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* 2. Render all sketches (including marked/edited photos) with blue/indigo badges */}
                                    {sketches.map(sketch => {
                                        const isMarked = sketch.title.toLowerCase().includes('markiert');
                                        const badgeText = isMarked ? 'Markiert' : 'Skizze';
                                        const badgeColor = isMarked ? '#1E40AF' : '#3730A3';
                                        const badgeBg = isMarked ? '#EFF6FF' : '#EEF2FF';
                                        const badgeBorder = isMarked ? '1.5px solid #BFDBFE' : '1.5px solid #C7D2FE';
                                        
                                        return (
                                            <div 
                                                key={sketch.id}
                                                onClick={() => {
                                                    setZoomedSketch(sketch);
                                                    setShowZoomModal(true);
                                                }}
                                                className="card"
                                                style={{
                                                    padding: 0,
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    border: '1.5px solid var(--border)'
                                                }}
                                            >
                                                <div style={{ 
                                                    height: '100px', 
                                                    backgroundColor: '#FFFFFF', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    borderBottom: '1px solid var(--border)',
                                                    overflow: 'hidden'
                                                }}>
                                                    <img 
                                                        src={sketch.src} 
                                                        alt={sketch.title} 
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                </div>
                                                <div style={{ 
                                                    padding: '0.4rem', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 700, 
                                                    color: 'var(--text-main)',
                                                    whiteSpace: 'nowrap',
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span>{sketch.title}</span>
                                                    <span style={{ 
                                                        fontSize: '0.65rem', 
                                                        color: badgeColor, 
                                                        backgroundColor: badgeBg, 
                                                        padding: '0.1rem 0.4rem', 
                                                        borderRadius: '4px',
                                                        fontWeight: 800,
                                                        border: badgeBorder
                                                    }}>{badgeText}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem', fontStyle: 'italic' }}>
                                Klicke auf einen Plan oder Bild, um es im Vollbild zu betrachten.
                            </div>
                        </section>
                    </div>
                </main>
            ) : (
                /* ── DISPONENT / PLANNER VIEW ── */
                <main style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.1fr 0.9fr', 
                    gap: '1.5rem',
                    alignItems: 'start'
                }}>
                
                {/* ── LEFT COLUMN ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* ARBEITSAUFTRAG-KARTE */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <h2 className="section-header" style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Arbeitsauftrag
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Dummy input to absorb password manager / LastPass icon injection */}
                            <input 
                                type="text" 
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: -1 }} 
                                tabIndex={-1} 
                            />

                            {/* Row 1: Auftragsnummer & Titel */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Auftragsnummer</label>
                                    <input 
                                        type="text" 
                                        name="auftragsnummer"
                                        id="auftragsnummer"
                                        className="form-input"
                                        value={orderNumber} 
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                        data-bwignore="true"
                                        autocomplete="off"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Titel</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={projectTitle} 
                                        onChange={(e) => setProjectTitle(e.target.value)}
                                        style={{ width: '100%', fontWeight: 600, boxSizing: 'border-box' }}
                                        data-lpignore="true"
                                        autocomplete="off"
                                    />
                                </div>
                            </div>

                            {/* Row: Standort / Einsatzadresse */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Standort / Einsatzadresse</label>
                                <input 
                                    type="text" 
                                    className="form-input"
                                    value={location} 
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="z. B. Hauptstrasse 45, 9000 St. Gallen"
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                    data-lpignore="true"
                                    autocomplete="off"
                                />
                            </div>

                            {/* Row 2: Beschreibung */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Beschreibung</label>
                                <textarea 
                                    className="form-input"
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    style={{ width: '100%', fontFamily: 'var(--font-desktop)', lineHeight: 1.4, boxSizing: 'border-box', resize: 'vertical' }}
                                />
                            </div>

                            {/* Row 3: Priorität & Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Priorität</label>
                                    <select 
                                        className="form-input"
                                        value={priority} 
                                        onChange={(e) => setPriority(e.target.value)}
                                        style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    >
                                        <option value="Niedrig">Niedrig</option>
                                        <option value="Mittel">Mittel</option>
                                        <option value="Hoch">Hoch</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Status</label>
                                    <select 
                                        className="form-input"
                                        value={status} 
                                        onChange={(e) => setStatus(e.target.value)}
                                        style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    >
                                        <option value="In Arbeit">In Arbeit</option>
                                        <option value="Abgeschlossen">Abgeschlossen</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 4: Start & Fertigstellung */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Gewünschter Start</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="date" 
                                            className="form-input"
                                            value={startDate} 
                                            onChange={(e) => setStartDate(e.target.value)}
                                            style={{ width: '100%', paddingLeft: '2.2rem', boxSizing: 'border-box' }}
                                        />
                                        <Calendar size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Fertigstellung bis</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="date" 
                                            className="form-input"
                                            value={endDate} 
                                            onChange={(e) => setEndDate(e.target.value)}
                                            style={{ width: '100%', paddingLeft: '2.2rem', boxSizing: 'border-box' }}
                                        />
                                        <Calendar size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Row 5: Geplanter Zeitaufwand */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Geplanter Zeitaufwand</label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <input 
                                        type="number" 
                                        className="form-input"
                                        value={plannedDuration} 
                                        onChange={(e) => setPlannedDuration(e.target.value)}
                                        style={{ width: '100px' }}
                                    />
                                    <select 
                                        className="form-input"
                                        value={plannedDurationUnit} 
                                        onChange={(e) => setPlannedDurationUnit(e.target.value)}
                                        style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}
                                    >
                                        <option value="Stunden">Stunden</option>
                                        <option value="Arbeitstage">Arbeitstage</option>
                                    </select>
                                    <Info size={16} style={{ color: 'var(--primary)', cursor: 'help' }} title="Geschätzter Zeitaufwand für die Durchführung" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* HANDWERKER-ZUWEISUNG */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)' }}>
                        <h2 className="section-header" style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Handwerker Zuweisung
                        </h2>

                        <div ref={handwerkerDropdownRef} style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Handwerker</label>
                            
                            {/* Customized Multi-Select Input Field matching standard input styling */}
                            <div 
                                onClick={() => setShowHandwerkerDropdown(!showHandwerkerDropdown)}
                                className="form-input"
                                style={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: '0.4rem', 
                                    padding: '0.5rem 0.75rem', 
                                    minHeight: '44px',
                                    cursor: 'pointer',
                                    alignItems: 'center',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {assignedHandwerker.length === 0 && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Keine Handwerker zugewiesen...</span>
                                )}
                                {assignedHandwerker.map(name => (
                                    <span 
                                        key={name}
                                        onClick={(e) => {
                                            e.stopPropagation(); // Avoid opening dropdown
                                            setAssignedHandwerker(prev => prev.filter(h => h !== name));
                                        }}
                                        style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.25rem', 
                                            backgroundColor: 'var(--color-primary-soft)', 
                                            color: 'var(--primary)', 
                                            padding: '0.25rem 0.6rem', 
                                            borderRadius: '4px', 
                                            fontSize: '0.85rem', 
                                            fontWeight: 600,
                                            border: '1px solid var(--color-border-strong)'
                                        }}
                                    >
                                        {name}
                                        <X size={12} style={{ opacity: 0.8, cursor: 'pointer' }} />
                                    </span>
                                ))}
                                <ChevronDown size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                            </div>

                            {/* Dropdown Menu */}
                            {showHandwerkerDropdown && (
                                <div style={{ 
                                    position: 'absolute', 
                                    top: '100%', 
                                    left: 0, 
                                    right: 0, 
                                    backgroundColor: 'var(--surface)', 
                                    border: '1.5px solid var(--border)', 
                                    borderRadius: '4px', 
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                                    zIndex: 50,
                                    marginTop: '0.25rem',
                                    overflow: 'hidden'
                                }}>
                                    {availableHandwerker.map(name => {
                                        const isChecked = assignedHandwerker.includes(name);
                                        return (
                                            <div 
                                                key={name}
                                                onClick={() => toggleHandwerker(name)}
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between', 
                                                    padding: '0.75rem 1rem', 
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    backgroundColor: isChecked ? 'var(--color-row-hover)' : 'transparent',
                                                    color: 'var(--text-main)',
                                                    fontWeight: isChecked ? 600 : 500,
                                                    borderBottom: '1px solid var(--border)'
                                                }}
                                            >
                                                <span>{name}</span>
                                                {isChecked && <Check size={16} color="var(--primary)" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* UNIFIED BILDER & SKIZZEN CARD */}
                    <section className="card" style={{ padding: '1.5rem', border: '1.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Main Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <h2 className="section-header" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', paddingBottom: 0 }}>
                                Bilder & Skizzen
                            </h2>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button 
                                    onClick={() => {
                                        setEditingSketchId(null);
                                        setCanvasTitle('');
                                        setShowCanvasModal(true);
                                    }}
                                    className="btn btn-primary"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.4rem', 
                                        padding: '0.4rem 0.8rem', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 700, 
                                        cursor: 'pointer',
                                        height: '34px'
                                    }}
                                >
                                    <Plus size={14} /> Neue Skizze
                                </button>
                            </div>
                        </div>

                        {/* PART 1: PROJECT PHOTO SELECTION DROPDOWNS (SCHADENAUFNAHME) */}
                        <div style={{ 
                            backgroundColor: 'var(--background)', 
                            padding: '1rem', 
                            borderRadius: '6px', 
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                                🔍 Vorhandene Projektbilder (Schadenaufnahme) auswählen
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                {/* Room Dropdown (now Bild wählen) */}
                                <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bild wählen:</span>
                                    <select 
                                        value={selectedRoomFilter} 
                                        onChange={(e) => {
                                            if (e.target.value === 'import_from_library') {
                                                setImportRoom(selectedRoomFilter || 'Badezimmer');
                                                setImportFile(null);
                                                setImportFilePreview(null);
                                                setShowImportModal(true);
                                            } else {
                                                setSelectedRoomFilter(e.target.value);
                                                setSelectedPhotoId('');
                                            }
                                        }}
                                        className="select"
                                        style={{ 
                                            padding: '0.25rem 0.5rem', 
                                            fontSize: '0.8rem', 
                                            borderRadius: '4px',
                                            border: '1.5px solid var(--border)',
                                            backgroundColor: 'var(--surface)',
                                            color: 'var(--text-main)',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            outline: 'none',
                                            height: '32px'
                                        }}
                                    >
                                        <option value="">-- Bild wählen --</option>
                                        <option value="Badezimmer">
                                            Badezimmer ({projectPhotosPool.filter(p => p.room === 'Badezimmer').length} Bild{projectPhotosPool.filter(p => p.room === 'Badezimmer').length === 1 ? '' : 'er'})
                                        </option>
                                        <option value="Küche">
                                            Küche ({projectPhotosPool.filter(p => p.room === 'Küche').length} Bild{projectPhotosPool.filter(p => p.room === 'Küche').length === 1 ? '' : 'er'})
                                        </option>
                                        <option value="Keller">
                                            Keller ({projectPhotosPool.filter(p => p.room === 'Keller').length} Bild{projectPhotosPool.filter(p => p.room === 'Keller').length === 1 ? '' : 'er'})
                                        </option>
                                        <option value="import_from_library" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                            📁 + Aus Fotomediathek...
                                        </option>
                                    </select>
                                </div>

                                {/* Photo Dropdown (now Detailbild wählen) */}
                                <div style={{ flex: 1.2, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Detailbild wählen:</span>
                                    <select 
                                        value={selectedPhotoId} 
                                        onChange={(e) => {
                                            setSelectedPhotoId(e.target.value);
                                        }}
                                        disabled={!selectedRoomFilter}
                                        className="select"
                                        style={{ 
                                            padding: '0.25rem 0.5rem', 
                                            fontSize: '0.8rem', 
                                            borderRadius: '4px',
                                            border: '1.5px solid var(--border)',
                                            backgroundColor: !selectedRoomFilter ? 'rgba(0,0,0,0.03)' : 'var(--surface)',
                                            color: 'var(--text-main)',
                                            cursor: !selectedRoomFilter ? 'not-allowed' : 'pointer',
                                            fontWeight: 600,
                                            outline: 'none',
                                            height: '32px',
                                            opacity: !selectedRoomFilter ? 0.6 : 1
                                        }}
                                    >
                                        <option value="">
                                            {!selectedRoomFilter ? '-- Zuerst Bild wählen --' : '-- Detailbild wählen --'}
                                        </option>
                                        {projectPhotosPool.filter(p => p.room === selectedRoomFilter).map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Preview Frame for selected project photo */}
                            {selectedPhotoId && selectedPhotoId !== 'import_from_library' ? (() => {
                                const selectedPhoto = projectPhotosPool.find(p => p.id === selectedPhotoId);
                                if (!selectedPhoto) return null;
                                const isSelected = selectedProjectPhotos.includes(selectedPhoto.id);
                                return (
                                    <div 
                                        style={{ 
                                            border: '1px solid var(--border)', 
                                            borderRadius: '4px', 
                                            padding: '0.5rem',
                                            backgroundColor: 'var(--surface)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem',
                                            animation: 'fadeIn 0.2s ease'
                                        }}
                                    >
                                        <div 
                                            onClick={() => {
                                                setZoomedSketch({ id: selectedPhoto.id, title: `${selectedPhoto.title} (Original)`, src: selectedPhoto.src });
                                                setShowZoomModal(true);
                                            }}
                                            style={{ 
                                                height: '140px', 
                                                backgroundColor: '#FFFFFF', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                borderRadius: '4px',
                                                border: '1px solid var(--border)',
                                                overflow: 'hidden',
                                                cursor: 'pointer'
                                            }}
                                            title="Großansicht"
                                        >
                                            <img 
                                                src={selectedPhoto.src} 
                                                alt={selectedPhoto.title} 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-main)' }}>{selectedPhoto.title}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Raum: 🚪 {selectedPhoto.room}</div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {/* Checkbox "Senden" */}
                                                <label 
                                                    style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '0.25rem', 
                                                        cursor: 'pointer', 
                                                        fontSize: '0.72rem', 
                                                        fontWeight: 700, 
                                                        color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                                        backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'transparent',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        border: isSelected ? '1px solid var(--color-border-strong)' : '1px solid var(--border)'
                                                    }}
                                                >
                                                    <input 
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (isSelected) {
                                                                setSelectedProjectPhotos(prev => prev.filter(id => id !== selectedPhoto.id));
                                                            } else {
                                                                setSelectedProjectPhotos(prev => [...prev, selectedPhoto.id]);
                                                            }
                                                        }}
                                                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                                                    />
                                                    <span>An Handwerker senden</span>
                                                </label>

                                                {/* Sketch button */}
                                                <button
                                                    onClick={() => {
                                                        setEditingSketchId(null);
                                                        setCanvasBackgroundPhoto(selectedPhoto.src);
                                                        setCanvasTitle(`${selectedPhoto.title} - markiert`);
                                                        setShowCanvasModal(true);
                                                    }}
                                                    className="btn btn-outline"
                                                    style={{ 
                                                        padding: '0.25rem 0.5rem', 
                                                        fontSize: '0.72rem', 
                                                        fontWeight: 700, 
                                                        height: '26px', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '0.2rem' 
                                                }}
                                                >
                                                    <Pen size={10} /> Für Auftrag skizzieren
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div style={{ 
                                    border: '1px dashed var(--border)', 
                                    borderRadius: '4px', 
                                    padding: '1rem', 
                                    textAlign: 'center',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.75rem',
                                    fontStyle: 'italic'
                                }}>
                                    Wähle oben einen Raum und ein Bild aus, um es anzusehen, für den Auftrag zu bearbeiten (skizzieren) oder freizugeben.
                                </div>
                            )}
                        </div>

                        {/* DIVIDER */}
                        <div style={{ borderTop: '1px dashed var(--border)' }}></div>

                        {/* PART 2: SECTION A - BILDER INSTANDSTELLUNG */}
                        <div>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>📷</span> Bilder Instandstellung ({photos.length})
                            </h3>
                            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                {photos.length === 0 ? (
                                    <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>Keine Bilder erfasst</p>
                                ) : (
                                    photos.map(photo => (
                                        <div 
                                            key={photo.id}
                                            style={{ 
                                                width: '120px', 
                                                height: '120px', 
                                                borderRadius: '6px', 
                                                overflow: 'hidden', 
                                                border: '1.5px solid var(--border)', 
                                                position: 'relative',
                                                flexShrink: 0
                                            }}
                                        >
                                            <img 
                                                src={photo.src} 
                                                alt={photo.title}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <div style={{ 
                                                position: 'absolute', 
                                                bottom: 0, 
                                                left: 0, 
                                                right: 0, 
                                                backgroundColor: 'rgba(15,23,42,0.75)', 
                                                color: '#FFFFFF', 
                                                fontSize: '0.65rem', 
                                                padding: '0.2rem 0.4rem', 
                                                textAlign: 'center',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden'
                                            }}>
                                                {photo.title}
                                            </div>
                                            
                                            
                                            </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* DIVIDER */}
                        <div style={{ borderTop: '1px dashed var(--border)' }}></div>

                        {/* PART 3: SECTION B - SKIZZEN & PLÄNE */}
                        <div>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>📐</span> Skizzen & Pläne ({sketches.length + selectedProjectPhotos.length})
                            </h3>
                            {sketches.length === 0 && selectedProjectPhotos.length === 0 ? (
                                <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>Keine Skizzen oder zugewiesenen Originalbilder vorhanden.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    {/* 1. Render all assigned original project photos with green "Original" badge */}
                                    {projectPhotosPool.filter(p => selectedProjectPhotos.includes(p.id)).map(photo => (
                                        <div 
                                            key={photo.id}
                                            onClick={() => {
                                                setZoomedSketch({ id: photo.id, title: `${photo.title} (Original)`, src: photo.src });
                                                setShowZoomModal(true);
                                            }}
                                            className="card"
                                            style={{
                                                padding: 0,
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                border: '1.5px solid var(--border)'
                                            }}
                                        >
                                            <div style={{ 
                                                height: '110px', 
                                                backgroundColor: '#FFFFFF', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                borderBottom: '1px solid var(--border)',
                                                overflow: 'hidden'
                                            }}>
                                                <img 
                                                    src={photo.src} 
                                                    alt={photo.title} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            </div>
                                            <div style={{ 
                                                padding: '0.5rem', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                color: 'var(--text-main)',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>{photo.title}</span>
                                                <span style={{ 
                                                    fontSize: '0.65rem', 
                                                    color: '#065F46', 
                                                    backgroundColor: '#ECFDF5', 
                                                    padding: '0.1rem 0.4rem', 
                                                    borderRadius: '4px',
                                                    fontWeight: 800,
                                                    border: '1.5px solid #A7F3D0'
                                                }}>Original</span>
                                            </div>

                                            {/* Disconnect/Deselect button for original image in Disponent View */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedProjectPhotos(prev => prev.filter(id => id !== photo.id));
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '6px',
                                                    right: '6px',
                                                    backgroundColor: '#EF4444',
                                                    color: 'white',
                                                    border: '2.5px solid var(--surface)',
                                                    borderRadius: '50%',
                                                    width: '20px',
                                                    height: '20px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                    zIndex: 10
                                                }}
                                                title="Zuweisung aufheben"
                                            >
                                                <X size={10} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* 2. Render all sketches/edited photos */}
                                    {sketches.map(sketch => {
                                        const isMarked = sketch.title.toLowerCase().includes('markiert');
                                        const badgeColor = isMarked ? '#1D4ED8' : '#4338CA';
                                        const badgeText = isMarked ? 'Markiert' : 'Skizze';
                                        const badgeBg = isMarked ? '#EFF6FF' : '#EEF2FF';
                                        const badgeBorder = isMarked ? '1.5px solid #BFDBFE' : '1.5px solid #C7D2FE';

                                        return (
                                            <div 
                                                key={sketch.id}
                                                onClick={() => {
                                                    setZoomedSketch(sketch);
                                                    setShowZoomModal(true);
                                                }}
                                                className="card"
                                                style={{
                                                    padding: 0,
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    border: '1.5px solid var(--border)'
                                                }}
                                            >
                                                <div style={{ 
                                                    height: '110px', 
                                                    backgroundColor: '#FFFFFF', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    borderBottom: '1px solid var(--border)',
                                                    overflow: 'hidden'
                                                }}>
                                                    <img 
                                                        src={sketch.src} 
                                                        alt={sketch.title} 
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                </div>
                                                <div style={{ 
                                                    padding: '0.5rem', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 700, 
                                                    color: 'var(--text-main)',
                                                    whiteSpace: 'nowrap',
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span>{sketch.title}</span>
                                                    <span style={{ 
                                                        fontSize: '0.65rem', 
                                                        color: badgeColor, 
                                                        backgroundColor: badgeBg, 
                                                        padding: '0.1rem 0.4rem', 
                                                        borderRadius: '4px',
                                                        fontWeight: 800,
                                                        border: badgeBorder
                                                        }}>{badgeText}</span>
                                                </div>

                                                {/* Edit pen button */}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingSketchId(sketch.id);
                                                        setCanvasBackgroundPhoto(sketch.src.startsWith('data:image/svg') ? null : sketch.src);
                                                        setCanvasTitle(sketch.title);
                                                        setShowCanvasModal(true);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '6px',
                                                        right: '30px',
                                                        backgroundColor: 'var(--primary)',
                                                        color: 'white',
                                                        border: '2.5px solid var(--surface)',
                                                        borderRadius: '50%',
                                                        width: '20px',
                                                        height: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        padding: 0,
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                        zIndex: 10
                                                    }}
                                                    title="Skizze bearbeiten"
                                                >
                                                    <Pen size={9} />
                                                </button>

                                                {/* Delete button */}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSketches(prev => prev.filter(s => s.id !== sketch.id));
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '6px',
                                                        right: '6px',
                                                        backgroundColor: '#EF4444',
                                                        color: 'white',
                                                        border: '2.5px solid var(--surface)',
                                                        borderRadius: '50%',
                                                        width: '20px',
                                                        height: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        padding: 0,
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                        zIndex: 10
                                                    }}
                                                    title="Skizze löschen"
                                                >
                                                    <X size={10} strokeWidth={3} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.73rem', marginTop: '1.25rem', fontStyle: 'italic' }}>
                            Klicke auf eine Skizze, um sie zu bearbeiten oder im Detail zu betrachten.
                        </div>
                    </section>
                </div>
            </main>
            )}

            {/* ── 4. REUSABLE 1:1 MEASUREMENT SKETCH CANVAS ── */}
            <MeasurementSketchCanvas
                isOpen={showCanvasModal}
                onClose={() => {
                    setShowCanvasModal(false);
                    setCanvasTitle('');
                    setEditingSketchId(null);
                    setCanvasBackgroundPhoto(null);
                }}
                onSave={({ canvasImage, galleryPhotos, title }) => {
                    if (editingSketchId) {
                        setSketches(prev => prev.map(s => s.id === editingSketchId ? { ...s, title: title || 'Neue Skizze', src: canvasImage } : s));
                    } else {
                        const newSketch = {
                            id: `sketch_${Date.now()}`,
                            title: title || 'Neue Skizze',
                            src: canvasImage
                        };
                        setSketches(prev => [...prev, newSketch]);
                    }
                    setShowCanvasModal(false);
                    setCanvasTitle('');
                    setEditingSketchId(null);
                    setCanvasBackgroundPhoto(null);
                }}
                title={canvasTitle}
                showTitleInput={true}
                initialGalleryPhotos={[]}
                initialCanvasImage={editingSketchId ? sketches.find(s => s.id === editingSketchId)?.src : canvasBackgroundPhoto}
            />

            {/* ── 5. ZOOM / FULLSCREEN MODAL ── */}
            {showZoomModal && zoomedSketch && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.9)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div className="card" style={{ 
                        backgroundColor: 'var(--surface)', 
                        width: '100%', 
                        maxWidth: '750px', 
                        padding: '1.5rem', 
                        border: '1.5px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {zoomedSketch.title}
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowZoomModal(false);
                                    setZoomedSketch(null);
                                }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Zoomed Image */}
                        <div style={{ 
                            backgroundColor: '#FFFFFF', // Sketches are sheets of paper, keeping light bg
                            borderRadius: '6px', 
                            border: '1.5px solid var(--border)', 
                            padding: '1rem',
                            display: 'block',
                            overflow: 'auto'
                        }}>
                            <img 
                                src={zoomedSketch.src} 
                                alt={zoomedSketch.title} 
                                style={{ 
                                    display: 'block',
                                    maxWidth: '100%', 
                                    maxHeight: '420px', 
                                    width: 'auto',
                                    height: 'auto',
                                    margin: '0 auto',
                                    objectFit: 'contain' 
                                }}
                            />
                        </div>

                        {/* Modal Footer Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button 
                                onClick={() => {
                                    setSketches(prev => prev.filter(s => s.id !== zoomedSketch.id));
                                    setShowZoomModal(false);
                                    setZoomedSketch(null);
                                }}
                                className="btn"
                                style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backgroundColor: 'transparent', 
                                    color: 'var(--danger)', 
                                    border: '1.5px solid var(--danger)', 
                                    padding: '0.6rem 1.2rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={16} /> Skizze löschen
                            </button>
                            <button 
                                onClick={() => {
                                    setEditingSketchId(zoomedSketch.id);
                                    setCanvasTitle(zoomedSketch.title);
                                    setShowZoomModal(false);
                                    setShowCanvasModal(true);
                                }}
                                className="btn btn-outline"
                                style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.6rem 1.2rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    borderColor: 'var(--primary)',
                                    color: 'var(--primary)'
                                }}
                            >
                                <Pen size={16} /> Skizze bearbeiten
                            </button>
                            <button 
                                onClick={() => {
                                    setShowZoomModal(false);
                                    setZoomedSketch(null);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                            >
                                Schliessen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CUSTOM PHOTO LIBRARY IMPORT MODAL ── */}
            {showImportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        backgroundColor: 'var(--surface)',
                        borderRadius: '12px',
                        border: '1.5px solid var(--border)',
                        width: '420px',
                        maxWidth: '90%',
                        padding: '1.5rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                                <span>📁</span> Foto aus Mediathek importieren
                            </h3>
                            <button 
                                onClick={() => setShowImportModal(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.2rem'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Room selection */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>1. ZUGEHÖRIGEN RAUM WÄHLEN:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                {['Badezimmer', 'Küche', 'Keller'].map(room => {
                                    const isSelected = importRoom === room;
                                    return (
                                        <button
                                            key={room}
                                            type="button"
                                            onClick={() => setImportRoom(room)}
                                            style={{
                                                padding: '0.5rem 0.25rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                borderRadius: '6px',
                                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'var(--background)',
                                                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {room === 'Badezimmer' ? '🚪 Bad' : room === 'Küche' ? '🍳 Küche' : '📦 Keller'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* File select area */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>2. BILD AUSWÄHLEN:</label>
                            <input 
                                type="file" 
                                id="modal-photo-library-input" 
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setImportFile(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setImportFilePreview(reader.result);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                style={{ display: 'none' }}
                            />
                            
                            {importFilePreview ? (
                                <div style={{
                                    position: 'relative',
                                    height: '160px',
                                    borderRadius: '8px',
                                    border: '1.5px solid var(--border)',
                                    overflow: 'hidden',
                                    backgroundColor: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        src={importFilePreview} 
                                        alt="Preview" 
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImportFile(null);
                                            setImportFilePreview(null);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            backgroundColor: 'rgba(0,0,0,0.6)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '24px',
                                            height: '24px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <X size={12} strokeWidth={2.5} />
                                    </button>
                                </div>
                            ) : (
                                <label 
                                    htmlFor="modal-photo-library-input"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '140px',
                                        border: '2px dashed var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: 'var(--background)',
                                        transition: 'all 0.2s ease',
                                        gap: '0.5rem',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    <span style={{ fontSize: '1.6rem' }}>📁</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Foto aus Mediathek wählen</span>
                                    <span style={{ fontSize: '0.62rem' }}>Unterstützt JPEG, PNG, WEBP</span>
                                </label>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowImportModal(false)}
                                className="btn btn-outline"
                                style={{ flex: 1, height: '36px', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                disabled={!importFilePreview}
                                onClick={() => {
                                    const newProjPhoto = {
                                        id: `custom_proj_photo_${Date.now()}`,
                                        room: importRoom,
                                        title: importFile ? importFile.name.split('.')[0] : 'Foto Mediathek',
                                        src: importFilePreview
                                    };
                                    setCustomProjectPhotos(prev => [...prev, newProjPhoto]);
                                    setSelectedRoomFilter(importRoom);
                                    setSelectedPhotoId(newProjPhoto.id);
                                    // Auto-assign to sketches & plans
                                    setSelectedProjectPhotos(prev => {
                                        if (prev.includes(newProjPhoto.id)) return prev;
                                        return [...prev, newProjPhoto.id];
                                    });
                                    setShowImportModal(false);
                                }}
                                className="btn btn-primary"
                                style={{ 
                                    flex: 1, 
                                    height: '36px', 
                                    fontSize: '0.78rem', 
                                    fontWeight: 700,
                                    opacity: !importFilePreview ? 0.6 : 1,
                                    cursor: !importFilePreview ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 6. OUTLOOK SIMULATION MODAL ── */}
            {showOutlookModal && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.85)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div className="card" style={{ 
                        backgroundColor: 'var(--surface)', 
                        width: '100%', 
                        maxWidth: '650px', 
                        padding: '1.75rem', 
                        border: '1.5px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Mail size={20} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    Outlook Kalendereinträge generieren
                                </h3>
                            </div>
                            <button 
                                onClick={() => setShowOutlookModal(false)} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {assignedHandwerker.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Info size={32} style={{ color: 'var(--warning)', marginBottom: '0.75rem' }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>Keine Handwerker zugewiesen!</p>
                                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Bitte weise unter dem Abschnitt "Handwerker Zuweisung" zuerst mindestens einen Handwerker zu.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--color-primary-soft)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)' }}>
                                    <strong>Outlook-Mockup Integration:</strong> Es werden separate Kalender-Termine (.ics Format) für die zugewiesenen Handwerker generiert und der Standort automatisch aus dem Auftrag extrahiert.
                                </div>

                                {/* General Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Betreff:</span>
                                    <span>Arbeitsauftrag {orderNumber}: {projectTitle}</span>
                                    
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Standort:</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{location || 'Kein Standort angegeben'}</span>
                                    
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Zeitraum:</span>
                                    <span>{startDate} bis {endDate}</span>
                                    
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Direktlink:</span>
                                    <span style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}>https://qtool.q-service.ch/project/{orderNumber}</span>
                                </div>

                                {/* Handwerker specific entries */}
                                <h4 style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generierte Einladungen</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {assignedHandwerker.map(name => (
                                        <div key={name} style={{ backgroundColor: 'var(--background)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                                                <strong style={{ color: 'var(--text-main)' }}>{name}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>{name.toLowerCase().replace(' ', '.') + '@q-service.ch'}</span>
                                            </div>
                                            <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-muted)', lineHeight: 1.3 }}>
{`Betreff: Einteilung - ${projectTitle} (${orderNumber})
Ort: ${location}
Termin: ${startDate} bis ${endDate}

Hallo ${name.split(' ')[0]},
du bist für diesen Auftrag eingeteilt.

Link zum Auftrag:
https://qtool.q-service.ch/project/${orderNumber}`}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                            <button 
                                onClick={() => setShowOutlookModal(false)}
                                className="btn btn-outline"
                                style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                            >
                                Schliessen
                            </button>
                            {assignedHandwerker.length > 0 && (
                                <>
                                    <button 
                                        onClick={downloadIcsFile}
                                        className="btn btn-outline"
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.4rem',
                                            padding: '0.6rem 1.2rem', 
                                            fontWeight: 700, 
                                            borderColor: 'var(--primary)',
                                            color: 'var(--primary)',
                                            cursor: 'pointer' 
                                        }}
                                    >
                                        <Calendar size={16} /> .ics Kalenderdatei
                                    </button>
                                    <button 
                                        onClick={() => {
                                            alert("Erfolgreich simulierte Kalendereinträge!\n\nIn der produktiven QTool-Umgebung werden nun über Microsoft Graph API und Outlook die Kalendereinträge im Hintergrund erstellt und per Mail-Einladung an alle zugewiesenen Handwerker geschickt.");
                                            setShowOutlookModal(false);
                                        }}
                                        className="btn btn-primary"
                                        style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
                                    >
                                        Einträge senden (Simuliert)
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 7. TIME BOOKING MODAL (STUNDENERFASSUNG) ── */}
            {showTimeModal && (
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    backgroundColor: 'rgba(15,23,42,0.85)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <form 
                        onSubmit={handleAddTimeEntry}
                        className="card" 
                        style={{ 
                            backgroundColor: 'var(--surface)', 
                            width: '100%', 
                            maxWidth: '450px', 
                            padding: '1.5rem', 
                            border: '1.5px solid var(--border)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={18} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                    Arbeitsstunden buchen
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowTimeModal(false)} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Date Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Datum</label>
                            <input 
                                type="date" 
                                required
                                className="form-input"
                                value={newTimeDate}
                                onChange={(e) => setNewTimeDate(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Start & End Times */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Startzeit</label>
                                <input 
                                    type="time" 
                                    required
                                    className="form-input"
                                    value={newTimeStart}
                                    onChange={(e) => setNewTimeStart(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Endzeit</label>
                                <input 
                                    type="time" 
                                    required
                                    className="form-input"
                                    value={newTimeEnd}
                                    onChange={(e) => setNewTimeEnd(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        {/* Break */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Pause (in Stunden)</label>
                            <select 
                                className="form-input"
                                value={newTimeBreak}
                                onChange={(e) => setNewTimeBreak(e.target.value)}
                                style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                            >
                                <option value="0.0">Keine Pause</option>
                                <option value="0.25">15 Minuten (0.25 Std.)</option>
                                <option value="0.5">30 Minuten (0.50 Std.)</option>
                                <option value="0.75">45 Minuten (0.75 Std.)</option>
                                <option value="1.0">1 Stunde (1.00 Std.)</option>
                                <option value="1.5">1.5 Stunden (1.50 Std.)</option>
                            </select>
                        </div>

                        {/* Task Activity Description */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Ausgeführte Tätigkeit</label>
                            <input 
                                type="text" 
                                required
                                className="form-input"
                                placeholder="z. B. Fliesen verlegt und gereinigt"
                                value={newTimeTask}
                                onChange={(e) => setNewTimeTask(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Modal Footer Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                            <button 
                                type="button"
                                onClick={() => setShowTimeModal(false)}
                                className="btn btn-outline"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                                Abbrechen
                            </button>
                            <button 
                                type="submit"
                                className="btn btn-primary"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                                Stunden eintragen
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
