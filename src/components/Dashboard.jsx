import { useState, useEffect, useMemo } from 'react'
import { Filter, MapPin, Calendar, ArrowRight, Search, Trash2, FileText, RotateCcw, LogOut } from 'lucide-react'
import InboxTodo from './InboxTodo'
import WorkflowStatusOverview from './WorkflowStatusOverview'
import RightSidebar from './RightSidebar'
import OfficeProjectsPage from '../features/projects/OfficeProjectsPage'

// Helper to calculate days difference
const getDaysDiff = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = now - start; // removed Math.abs to allow negative check if needed, but simplified
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Helper to format date as tt/mm/jj hh:mm
const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const statusColors = {
    'Schadenaufnahme': 'bg-gray-100 text-gray-800',
    'Leckortung': 'bg-blue-100 text-blue-800',
    'Trocknung': 'bg-yellow-100 text-yellow-800',
    'Kontrolle*': 'bg-orange-100 text-orange-800',
    'Instandsetzung': 'bg-green-100 text-green-800',
    'Abgeschlossen': 'bg-gray-200 text-gray-600'
}

// Helper to find latest measurement date across all rooms (moved to global scope for reuse)
const getLatestMeasurementDays = (report) => {
    const allRooms = [
        ...(report.measurementRooms || []),
        ...(report.rooms || [])
    ];
    if (allRooms.length === 0) return null;

    let latestDate = null;

    allRooms.forEach(room => {
        if (!room) return;
        // 1. Check current data
        if (room.measurementData?.globalSettings?.date) {
            const d = new Date(room.measurementData.globalSettings.date);
            if (!isNaN(d.getTime())) {
                if (!latestDate || d > latestDate) latestDate = d;
            }
        }
        // 2. Check history
        if (room.measurementHistory && Array.isArray(room.measurementHistory)) {
            room.measurementHistory.forEach(hist => {
                const hDate = hist.date || hist.datum || hist.timestamp || hist.createdAt || hist.globalSettings?.date;
                if (hDate) {
                    const d = new Date(hDate);
                    if (!isNaN(d.getTime())) {
                        if (!latestDate || d > latestDate) latestDate = d;
                    }
                }
            });
        }
    });

    if (!latestDate) return null;
    return getDaysDiff(latestDate);
};

const getUrgencyStyle = (days, thresholds = [7, 10]) => {
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    const [t1, t2] = thresholds;
    
    if (days > t2) {
        return {
            bg: isLight ? '#FCE4E6' : 'rgba(239, 68, 68, 0.15)',
            color: isLight ? '#991B1B' : '#EF4444',
            border: isLight ? '1px solid #F87171' : '1px solid rgba(239, 68, 68, 0.25)'
        };
    } else if (days > t1) {
        return {
            bg: isLight ? '#FFF4C6' : 'rgba(245, 158, 11, 0.15)',
            color: isLight ? '#92400E' : '#F59E0B',
            border: isLight ? '1px solid #FBBF24' : '1px solid rgba(245, 158, 11, 0.25)'
        };
    } else {
        return {
            bg: isLight ? '#E8F4EA' : 'rgba(16, 185, 129, 0.15)',
            color: isLight ? '#065F46' : '#10B981',
            border: isLight ? '1px solid #34D399' : '1px solid rgba(16, 185, 129, 0.25)'
        };
    }
};

const DryingMonitor = ({ reports, onSelectReport, workflowStore = {} }) => {
    // Filter by status 'Trocknung' OR if there are active devices
    const dryingReports = reports.filter(r => {
        const isStatusDrying = r.status === 'Trocknung' || (r.equipment && r.equipment.length > 0);
        if (!isStatusDrying) return false;

        // Filter out if the workflow milestone 'trocknung' is set to done or skip
        const sd = workflowStore[`${r.id}__trocknung`] || {};
        const isMilestoneDone = sd.status === 'done' || sd.status === 'skip';
        return !isMilestoneDone;
    });

    // Helper to get start date (from first device or report date)
    const getStartDate = (report) => {
        if (report.dryingStarted) return report.dryingStarted;
        if (report.equipment && report.equipment.length > 0) {
            // Find earliest device start date
            const dates = report.equipment.map(e => e.startDate).filter(d => d).sort();
            if (dates.length > 0) return dates[0];
        }
        return report.date; // Fallback to report creation date
    };

    // Sort by duration desc (using new helper)
    dryingReports.sort((a, b) => getDaysDiff(getStartDate(b)) - getDaysDiff(getStartDate(a)));

    return (
        <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid #F59E0B' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)' }}></div>
                Aktive Trocknungen
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {dryingReports.length > 0 ? (
                    dryingReports.map(report => {
                        const startDate = getStartDate(report);
                        const days = getDaysDiff(startDate);
                        const uStyle = getUrgencyStyle(days, [15, 30]);

                        // Calculate equipment summary
                        const equipSummary = report.equipment && report.equipment.length > 0
                            ? report.equipment.reduce((acc, curr) => {
                                acc[curr.type] = (acc[curr.type] || 0) + 1;
                                return acc;
                            }, {})
                            : null;

                        return (
                            <div
                                key={report.id}
                                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', cursor: 'pointer', transition: 'transform 0.2s', backgroundColor: 'var(--surface)' }}
                                onClick={() => onSelectReport(report)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                            >
                                <div style={{ marginBottom: '0.6rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.15rem', letterSpacing: '0.01em' }}>
                                        {report.projectNumber || report.projectTitle || '---'}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-main)' }}>{report.locationDetails || report.client}</span>
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 600,
                                            padding: '0.15rem 0.5rem', borderRadius: '6px',
                                            backgroundColor: uStyle.bg, color: uStyle.color, border: uStyle.border
                                        }}>{days}d</span>
                                    </div>
                                </div>

                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={12} />
                                    {report.address ? report.address.split(',')[0] : 'Keine Adresse'}
                                </div>

                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {report.type}
                                </div>
                                {report.clientSource && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '0.5rem' }}>
                                        von: {report.clientSource}
                                    </div>
                                )}

                                {/* Equipment display */}
                                <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {report.equipment && report.equipment.length > 0 ? (
                                        report.equipment.map((item, idx) => {
                                            const itemStart = item.startDate ? item.startDate : report.dryingStarted;
                                            const itemEnd = item.endDate;
                                            const itemDays = getDaysDiff(itemStart);

                                            let currentDays = 0;
                                            if (item.endDate) {
                                                const start = new Date(itemStart);
                                                const end = new Date(item.endDate);
                                                const diffTime = Math.abs(end - start);
                                                currentDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                            } else {
                                                currentDays = getDaysDiff(itemStart);
                                            }

                                            let barColor = '#10B981'; // Default: Green
                                            if (!item.endDate) {
                                                if (currentDays > 30) {
                                                    barColor = '#EF4444'; // Red
                                                } else if (currentDays > 15) {
                                                    barColor = '#F59E0B'; // Orange
                                                } else {
                                                    barColor = '#10B981'; // Green
                                                }
                                            } else {
                                                barColor = '#3B82F6'; // Finished: Blue
                                            }

                                            return (
                                                <div key={idx} style={{ fontSize: '0.75rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#555' }}>
                                                        <span>{item.type} <span style={{ color: '#9CA3AF' }}>#{item.deviceNumber || (idx + 1)}</span></span>
                                                        <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                                                            {item.apartment ? `${item.apartment} - ` : ''}{item.room} ({currentDays} d)
                                                        </span>
                                                    </div>
                                                    <div style={{ height: '6px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${Math.min(currentDays / 40 * 100, 100)}%`,
                                                            backgroundColor: barColor,
                                                            borderRadius: '3px'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Keine Geräte erfasst</span>
                                    )}
                                </div>

                                {/* Kontrolle Trocknung (Days since last measurement) */}
                                {(() => {                                    const mDays = getLatestMeasurementDays(report);
                                    if (mDays === null) return null;
                                    const cStyle = getUrgencyStyle(mDays, [7, 10]);

                                    return (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.3rem 0.6rem',
                                            marginTop: '0.25rem',
                                            borderRadius: '3px',
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            border: '1px solid var(--border)',
                                            fontSize: '0.72rem'
                                        }}>
                                            <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Kontrolle Trocknung</span>
                                            <span style={{
                                                fontWeight: 600,
                                                padding: '0.15rem 0.4rem',
                                                borderRadius: '6px',
                                                backgroundColor: cStyle.bg,
                                                color: cStyle.color,
                                                border: cStyle.border
                                            }}>vor {mDays} {mDays === 1 ? 'Tag' : 'Tagen'}</span>
                                        </div>
                                    );
                                })()}
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                                    Seit {formatDate(report.dryingStarted)}
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div style={{ gridColumn: '1 / -1', padding: '1rem', color: '#64748B', fontStyle: 'italic' }}>
                        Keine aktiven Trocknungen für diesen Filter gefunden.
                    </div>
                )}
            </div>
        </div>
    )
}



const DeviceInventoryList = ({ reports, onSelectReport }) => {
    const devicesList = useMemo(() => {
        const list = [];
        reports.forEach(report => {
            if (report.equipment && Array.isArray(report.equipment)) {
                report.equipment.forEach(item => {
                    list.push({ report, item });
                });
            }
        });
        
        return list.sort((a, b) => {
            const dateA = a.item.startDate ? new Date(a.item.startDate) : new Date(0);
            const dateB = b.item.startDate ? new Date(b.item.startDate) : new Date(0);
            return dateB - dateA;
        });
    }, [reports]);

    const formatEquipmentDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}.${month}.${year}`;
    };

    const getDaysRunning = (startDateStr, endDateStr) => {
        if (!startDateStr) return '-';
        const start = new Date(startDateStr);
        if (isNaN(start.getTime())) return '-';
        const end = endDateStr ? new Date(endDateStr) : new Date();
        if (isNaN(end.getTime())) return '-';
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        const diffTime = end - start;
        return `${Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))} d`;
    };

    return (
        <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid #3B82F6' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3B82F6' }}></div>
                Geräte / Inventarliste
            </h2>
            <div style={{ overflowX: 'auto' }}>
                {devicesList.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Typ / Modell</th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Inventar-Nr.</th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Projekt / Adresse</th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Raum</th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Installiert am</th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Deinstalliert am</th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Tage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devicesList.map(({ report, item }, idx) => {
                                const typeModel = [item.type, item.model].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' - ');
                                const isAktiv = !item.endDate;
                                
                                const statusStyle = isAktiv ? {
                                    bg: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10B981',
                                    border: '1px solid rgba(16, 185, 129, 0.25)'
                                } : {
                                    bg: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3B82F6',
                                    border: '1px solid rgba(59, 130, 246, 0.25)'
                                };

                                return (
                                    <tr
                                        key={`${report.id}-${idx}`}
                                        onClick={() => onSelectReport(report)}
                                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{typeModel || 'Unbekanntes Gerät'}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {item.deviceNumber ? (
                                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>
                                                    {item.deviceNumber}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ohne Inventar-Nr.</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                                {report.street || 'Keine Strasse'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {[report.zip, report.city].filter(Boolean).join(' ')} {report.projectNumber ? `(${report.projectNumber})` : ''}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>
                                            {item.room ? (
                                                <span>{item.apartment ? `${item.apartment} - ` : ''}{item.room}</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>kein Raum zugeordnet</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>
                                            {formatEquipmentDate(item.startDate)}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>
                                            {formatEquipmentDate(item.endDate)}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '6px',
                                                backgroundColor: statusStyle.bg,
                                                color: statusStyle.color,
                                                border: statusStyle.border,
                                                display: 'inline-block'
                                            }}>
                                                {isAktiv ? 'Aktiv' : 'Deinstalliert'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {getDaysRunning(item.startDate, item.endDate)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Keine Geräte erfasst.
                    </div>
                )}
            </div>
        </div>
    );
};

export default function Dashboard({ reports, onSelectReport, onDeleteReport, mode, supabase, currentUser, users, onReportsChanged, lockedProjectIds, onLogout }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedSidebarReport, setSelectedSidebarReport] = useState(null);
    const [workflowStore, setWorkflowStore] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('qtool_wf_v4') || '{}');
        } catch {
            return {};
        }
    });
    const itemsPerPage = 20;
    const [showArchive, setShowArchive] = useState(false);
    const lockedIds = lockedProjectIds instanceof Set ? lockedProjectIds : new Set();

    // Filter Logic
    const filteredReports = useMemo(() => reports.filter(r => {
        // Archive Filter
        if (showArchive) {
            if (r.status !== 'Abgeschlossen') return false;
        } else {
            if (r.status === 'Abgeschlossen') return false;
        }

        const lowerSearch = searchTerm.toLowerCase();

        // Basic fields
        if (r.client?.toLowerCase().includes(lowerSearch)) return true;
        if (r.projectTitle?.toLowerCase().includes(lowerSearch)) return true; // Search inside projectTitle
        if (r.id?.toLowerCase().includes(lowerSearch)) return true;
        if (r.address?.toLowerCase().includes(lowerSearch)) return true;
        if (r.type?.toLowerCase().includes(lowerSearch)) return true;
        if (r.status?.toLowerCase().includes(lowerSearch)) return true;
        if (r.assignedTo?.toLowerCase().includes(lowerSearch)) return true;

        // Equipment (deep search)
        if (r.equipment) {
            const hasMatchingEquipment = r.equipment.some(e =>
                e.type?.toLowerCase().includes(lowerSearch) ||
                e.deviceNumber?.toString().includes(lowerSearch) ||
                e.room?.toLowerCase().includes(lowerSearch) ||
                e.apartment?.toLowerCase().includes(lowerSearch)
            );
            if (hasMatchingEquipment) return true;
        }

        // Additional info (optional fields if they exist)
        if (r.clientSource?.toLowerCase().includes(lowerSearch)) return true;

        return false;
    }), [reports, showArchive, searchTerm]);

    // Sort by last opened timestamp, falling back to report date
    const sortedReports = useMemo(() => {
        const lastOpenedMap = (() => {
            try {
                return JSON.parse(localStorage.getItem('qservice_last_opened') || '{}');
            } catch {
                return {};
            }
        })();

        return [...filteredReports].sort((a, b) => {
            const timeA = lastOpenedMap[a.id] ? new Date(lastOpenedMap[a.id]).getTime() : 0;
            const timeB = lastOpenedMap[b.id] ? new Date(lastOpenedMap[b.id]).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA; // Zuletzt geöffnet zuerst
            
            // Fallback auf Datum
            return new Date(b.date || b.updated_at).getTime() - new Date(a.date || a.updated_at).getTime();
        });
    }, [filteredReports]);

    // Pagination Logic
    const totalPages = Math.ceil(sortedReports.length / itemsPerPage);
    const paginatedReports = sortedReports.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (!reports) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade Daten...</div>
    }

    const handleSelectReport = (rep) => {
        setSelectedSidebarReport(rep);
        onSelectReport(rep);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Dashboard</h2>

                    {/* Archive Toggle */}
                    <div style={{ display: 'flex', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', padding: '2px', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setShowArchive(false)}
                            style={{
                                padding: '0.25rem 0.75rem',
                                minHeight: '28px',
                                borderRadius: '3px',
                                border: 'none',
                                fontSize: '0.78rem',
                                fontWeight: !showArchive ? 700 : 500,
                                backgroundColor: !showArchive ? '#1E6DB7' : 'transparent',
                                color: !showArchive ? '#FFFFFF' : 'var(--text-muted)',
                                transition: 'all 0.15s'
                            }}
                        >
                            Aktuell
                        </button>
                        <button
                            onClick={() => setShowArchive(true)}
                            style={{
                                padding: '0.25rem 0.75rem',
                                minHeight: '28px',
                                borderRadius: '3px',
                                border: 'none',
                                fontSize: '0.78rem',
                                fontWeight: showArchive ? 700 : 500,
                                backgroundColor: showArchive ? '#1E6DB7' : 'transparent',
                                color: showArchive ? '#FFFFFF' : 'var(--text-muted)',
                                transition: 'all 0.15s'
                            }}
                        >
                            Archiv
                        </button>
                    </div>
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative', width: '100%', maxWidth: mode === 'technician' ? '100%' : '280px' }} className={mode === 'technician' ? 'tech-search-bar' : ''}>
                    <input
                        type="text"
                        placeholder="Suche (Name, Adresse, Gerät...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.35rem 0.75rem 0.35rem 2rem',
                            minHeight: '30px',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            outline: 'none',
                            background: 'var(--surface)',
                            color: 'var(--text-main)'
                        }}
                    />
                    <Search
                        size={13}
                        style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                </div>
            </div>

            {/* Pass Filtered Reports to Monitors (only when not in Archive OR Technician Mode) */}
            {!showArchive && mode !== 'technician' && (
                <div>
                    <WorkflowStatusOverview reports={reports} onSelectReport={onSelectReport} currentUser={currentUser} users={users || []} searchTerm={searchTerm} store={workflowStore} onStoreChange={setWorkflowStore} />
                    <DryingMonitor reports={filteredReports} onSelectReport={onSelectReport} workflowStore={workflowStore} />
                    <DeviceInventoryList reports={filteredReports} onSelectReport={onSelectReport} />
                </div>
            )}

            {mode === 'technician' ? (
                <div data-testid="techniker-list" style={{ paddingBottom: '4rem', width: '100%' }}>
                    <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {paginatedReports.length} Projekte gefunden
                    </div>
                    <div className="tech-projects-grid">
                        {paginatedReports.map(report => (
                            <div
                                key={report.id}
                                onClick={() => onSelectReport(report)}
                                className="tech-project-card"
                                style={{ cursor: 'pointer', ...(lockedIds.has(report.id) ? { opacity: 0.7, cursor: 'not-allowed' } : {}) }}
                            >
                                <button style={{ opacity: 0, width: 1, height: 1, padding: 0, border: 'none', position: 'absolute', pointerEvents: 'none' }}>Messung</button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.15rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700, minWidth: 0 }}>
                                            <MapPin size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {(() => {
                                                    const streetPart = report.street?.trim();
                                                    const cityPart = [report.zip, report.city].filter(p => p && p.trim()).join(' ');
                                                    let loc = [streetPart, cityPart].filter(Boolean).join(', ');
                                                    if (!loc || loc === ', , ' || loc === ',') {
                                                        loc = report.address ? report.address.split(',')[0] : 'Keine Adresse';
                                                    }
                                                    return loc;
                                                })()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                                            {lockedIds.has(report.id) && (
                                                <span title="In anderem Tab geöffnet" style={{
                                                    fontSize: '0.65rem', padding: '0.1rem 0.4rem',
                                                    backgroundColor: 'rgba(239,68,68,0.15)',
                                                    color: '#EF4444', borderRadius: '6px',
                                                    fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)',
                                                    whiteSpace: 'nowrap'
                                                }}>🔒 In Bearbeitung</span>
                                            )}
                                            <span className={`status-badge ${statusColors[report.status] || 'bg-gray-100'}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', whiteSpace: 'nowrap' }}>
                                                {report.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {(() => {
                                            const isId = (s) => typeof s === 'string' && (s.match(/-/g) || []).length >= 3 && !s.includes(' ');
                                            const parts = [report.projectNumber, report.projectTitle].filter(s => s && s.trim() && !isId(s));
                                            return parts.length > 0 ? parts.join(' - ') : '-';
                                        })()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Projekt "${report.projectTitle || report.id}" wirklich löschen?`)) {
                                                onDeleteReport(report.id);
                                            }
                                        }}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#EF4444', padding: '0.3rem', borderRadius: '6px',
                                            display: 'flex', alignItems: 'center'
                                        }}
                                        title="Projekt löschen"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <ArrowRight size={18} style={{ color: lockedIds.has(report.id) ? '#EF4444' : 'var(--primary)' }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Simple Pagination for Mobile if needed, reuse same controls or simplify */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                style={{ flex: 1 }}
                            >
                                Zurück
                            </button>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{currentPage} / {totalPages}</span>
                            <button
                                className="btn btn-outline"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                style={{ flex: 1 }}
                            >
                                Weiter
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card" style={{ padding: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Alle Fälle ({filteredReports.length})</h3>
                        <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                            <Filter size={13} /> Filter
                        </button>
                    </div>

                    <div className="table-container" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '36px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)' }}></th>
                                    <th style={{ width: '100px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Nr.</th>
                                    <th style={{ width: '100px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Datum</th>
                                    <th style={{ minWidth: '150px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Schadenort</th>
                                    <th style={{ minWidth: '180px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Adresse</th>
                                    <th style={{ minWidth: '140px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Auftraggeber</th>
                                    <th style={{ minWidth: '110px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Bewirtschafter/in</th>
                                    <th style={{ minWidth: '140px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Schaden</th>
                                    <th style={{ width: '130px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</th>
                                    <th style={{ minWidth: '120px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Kunde von</th>

                                    <th style={{ width: '80px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Geräte</th>
                                    <th style={{ width: '90px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Rechnung</th>
                                    <th style={{ width: '80px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedReports.map((report) => {
                                    const activeDevices = report.equipment ? report.equipment.length : 0;
                                    const hasLieferantenrechnung = report.images?.some(img => img.assignedTo === 'Sonstiges');
                                    const isLocked = lockedIds.has(report.id);
                                    return (
                                        <tr key={report.id} onClick={() => onSelectReport(report)} style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.75 : 1 }}>
                                            <td style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Projekt löschen?`)) onDeleteReport(report.id);
                                                    }}
                                                    title="Projekt löschen"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '0.2rem', borderRadius: '4px', display: 'flex', alignItems: 'center', opacity: 0.6 }}
                                                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                    onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                                                ><Trash2 size={14} /></button>
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {isLocked && (
                                                        <span title="In anderem Tab geöffnet" style={{
                                                            fontSize: '0.6rem', padding: '0.1rem 0.35rem',
                                                            backgroundColor: 'rgba(239,68,68,0.15)',
                                                            color: '#EF4444', borderRadius: '5px',
                                                            fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)',
                                                            whiteSpace: 'nowrap', flexShrink: 0
                                                        }}>🔒</span>
                                                    )}
                                                    {report.projectNumber || report.projectTitle || report.id}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{formatDate(report.date)}</td>
                                            <td style={{ fontWeight: 500 }}>{report.locationDetails || '-'}</td>
                                            <td>
                                                {report.street ? `${report.street}, ${report.zip} ${report.city}` : (report.address ? report.address.split(',')[0] : '')}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{report.client}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                                                    <span>{report.assignedTo}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 500 }}>{report.damageCategory || 'Wasserschaden'}</span>
                                                    {report.type && (
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{report.type}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${statusColors[report.status] || 'bg-gray-100'}`} style={{ color: '#1F2937' }}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                                    <span>{report.clientSource || '-'}</span>
                                                    {report.clientSource && (
                                                        <button
                                                            className="btn btn-sm btn-ghost"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Logic to send WhatsApp message
                                                                const text = `Hallo ${report.clientSource || 'Partner'},\n\nhier ist ein neuer Auftrag:\nProjekt: ${report.projectTitle || report.id}\nKunde: ${report.client}\nAdresse: ${report.address}\nArt: ${report.type}\n\nBitte um Bestätigung.`;
                                                                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

                                                                if (confirm(`Auftrag an ${report.clientSource} senden via WhatsApp?`)) {
                                                                    window.open(whatsappUrl, '_blank');
                                                                }
                                                            }}
                                                            title="Auftrag via WhatsApp senden"
                                                            style={{ padding: '2px', color: '#25D366', height: 'auto' }}
                                                        >
                                                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            <td style={{ textAlign: 'center' }}>
                                                {activeDevices > 0 ? (
                                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                        {activeDevices}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--border)' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {hasLieferantenrechnung && (
                                                    <span title="Lieferantenrechnung vorhanden" style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        backgroundColor: 'rgba(245,158,11,0.15)',
                                                        color: '#F59E0B',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        border: '1px solid rgba(245,158,11,0.3)',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        <FileText size={11} /> Rechnung
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`Möchten Sie den Bericht "${report.projectTitle || report.id}" wirklich unwiderruflich löschen?`)) {
                                                                onDeleteReport(report.id);
                                                            }
                                                        }}
                                                        className="btn btn-sm btn-ghost"
                                                        style={{ color: '#EF4444', padding: '0.25rem' }}
                                                        title="Bericht löschen"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <ArrowRight size={16} className="text-muted" />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                style={{ padding: '0.25rem 0.5rem' }}
                            >
                                &lt;
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    className={`btn ${currentPage === page ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setCurrentPage(page)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                className="btn btn-outline"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                style={{ padding: '0.25rem 0.5rem' }}
                            >
                                &gt;
                            </button>
                        </div>
                    )}

                    {/* App neu laden / Programm beenden */}
                    <div style={{ marginTop: '3rem', paddingBottom: '5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                        <button
                            className="btn btn-outline"
                            onClick={() => window.location.reload()}
                            style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontSize: '0.9rem', width: '100%', maxWidth: '300px' }}
                        >
                            <RotateCcw size={16} /> Dashboard neu laden
                        </button>

                        {onLogout && (
                            <button
                                onClick={onLogout}
                                style={{
                                    padding: '0.75rem 2rem',
                                    borderRadius: '12px',
                                    fontSize: '0.9rem',
                                    width: '100%',
                                    maxWidth: '300px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#EF4444',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <LogOut size={16} /> Programm beenden
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
