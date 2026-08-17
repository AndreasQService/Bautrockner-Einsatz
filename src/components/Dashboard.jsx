import { useState, useEffect, useMemo } from 'react'
import { Filter, MapPin, Calendar, ArrowRight, Search, Trash2, FileText, RotateCcw, LogOut, Archive, Folder } from 'lucide-react'
import InboxTodo from './InboxTodo'
import WorkflowStatusOverview from './WorkflowStatusOverview'
import TodoMonitor from './TodoMonitor'
import RightSidebar from './RightSidebar'
import DashboardReportTableHeader from './DashboardReportTableHeader'
import DashboardTechnicianProjectInfo from './DashboardTechnicianProjectInfo'
import OfficeProjectsPage from '../features/projects/OfficeProjectsPage'
import { formatDate } from '../utils/formatUtils'
import { isVisibleProjectRow } from '../utils/projectVisibility.js'
import { formatActiveEquipmentRuntime, formatCompletedEquipmentRuntime, formatEquipmentDate, formatEquipmentLocation, formatEquipmentProjectAddress, formatEquipmentTypeModel, getDryingStartDate, getEquipmentStatus } from '../utils/dashboardUtils'
import { DASHBOARD_STATUS_COLORS as statusColors } from '../config/dashboardConfig'
import { registerDomainMutation } from '../lib/offline/domainMutationAdapter'

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

const DryingMonitor = ({ reports, onSelectReport, onDeleteReport, workflowStore = {} }) => {
    // Only active dryings with active equipment/devices are relevant
    const dryingReports = reports.filter(r => {
        const eqList = (Array.isArray(r.equipment) && r.equipment.length > 0)
            ? r.equipment
            : ((Array.isArray(r.devices) && r.devices.length > 0)
                ? r.devices
                : (Array.isArray(r.report_data?.equipment)
                    ? r.report_data.equipment
                    : (Array.isArray(r.dryingData?.equipment) ? r.dryingData.equipment : (r.equipment || []))));

        const hasActiveDevices = eqList.some(item => !item.endDate);
        if (!hasActiveDevices) return false;

        // Filter out if the workflow milestone 'trocknung' is set to done or skip
        const sd = workflowStore[`${r.id}__trocknung`] || {};
        const isMilestoneDone = sd.status === 'done' || sd.status === 'skip';
        return !isMilestoneDone;
    });

    // Sort by duration desc (using new helper)
    dryingReports.sort((a, b) => getDaysDiff(getDryingStartDate(b)) - getDaysDiff(getDryingStartDate(a)));

    return (
        <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid #F59E0B' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)' }}></div>
                Aktive Trocknungen
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {dryingReports.length > 0 ? (
                    dryingReports.map(report => {
                        const startDate = getDryingStartDate(report);
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.15rem', letterSpacing: '0.01em', wordBreak: 'break-all', paddingRight: '0.5rem' }}>
                                            {report.projectNumber || report.projectTitle || '---'}
                                        </div>
                                        {onDeleteReport && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteReport(report);
                                                }}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: '#EF4444', padding: '0.2rem', borderRadius: '4px',
                                                    display: 'flex', alignItems: 'center', transition: 'background-color 0.2s',
                                                    marginTop: '-2px', marginRight: '-2px'
                                                }}
                                                onMouseEnter={(ev) => ev.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                                onMouseLeave={(ev) => ev.currentTarget.style.backgroundColor = 'transparent'}
                                                title="Projekt löschen"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
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
                                    {(() => {
                                        const streetPart = report.street || (report.address ? report.address.split(',')[0] : 'Keine Adresse');
                                        const locationParts = [report.zip, report.city].filter(Boolean).join(' ').trim();
                                        return locationParts ? `${streetPart}, ${locationParts}` : streetPart;
                                    })()}
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



const CompactDeviceInventoryList = ({ reports, onSelectReport }) => {
    const devicesList = useMemo(() => {
        const list = [];
        reports.forEach(report => {
            const eqList = (Array.isArray(report.equipment) && report.equipment.length > 0)
                ? report.equipment
                : ((Array.isArray(report.devices) && report.devices.length > 0)
                    ? report.devices
                    : (Array.isArray(report.report_data?.equipment)
                        ? report.report_data.equipment
                        : (Array.isArray(report.dryingData?.equipment) ? report.dryingData.equipment : (report.equipment || []))));

            if (Array.isArray(eqList)) {
                eqList.forEach(item => {
                    const { isAktiv } = getEquipmentStatus(item);
                    if (isAktiv) {
                        list.push({ report, item });
                    }
                });
            }
        });
        
        return list.sort((a, b) => {
            const dateA = a.item.startDate ? new Date(a.item.startDate) : new Date(0);
            const dateB = b.item.startDate ? new Date(b.item.startDate) : new Date(0);
            return dateB - dateA;
        });
    }, [reports]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }}></div>
                    Aktive Geräte ({devicesList.length})
                </h2>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600 }}>Gerät / Adresse</th>
                            <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600, width: '90px' }}>Inv.-Nr.</th>
                            <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600, width: '60px', textAlign: 'right' }}>Laufzeit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {devicesList.length === 0 ? (
                            <tr>
                                <td colSpan={3} style={{ padding: '1rem 0.4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Keine aktiven Geräte.</td>
                            </tr>
                        ) : (
                            devicesList.map(({ report, item }, idx) => {
                                const typeModel = formatEquipmentTypeModel(item);
                                const addressObj = formatEquipmentProjectAddress(report);
                                const projectAddressStr = (typeof report.street === 'string' && report.street.trim())
                                    ? report.street
                                    : ((typeof report.address === 'string' && report.address.trim())
                                        ? report.address
                                        : (addressObj.street || report.projectTitle || 'Keine Adresse'));
                                const days = item.startDate ? Math.floor((new Date() - new Date(item.startDate)) / (1000 * 60 * 60 * 24)) : 0;

                                return (
                                    <tr
                                        key={`${report.id}-${idx}`}
                                        onClick={() => onSelectReport(report)}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease'
                                        }}
                                        className="hover-row"
                                    >
                                        <td style={{ padding: '0.5rem 0.4rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 700 }}>{typeModel || 'Unbekannt'}</span>
                                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                                    {projectAddressStr}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.4rem', color: 'var(--text-muted)' }}>
                                            {item.deviceNumber || '—'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', fontWeight: 600 }}>
                                            {days} {days === 1 ? 'Tag' : 'Tage'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const DeviceInventoryList = ({ reports, onSelectReport }) => {
    const devicesList = useMemo(() => {
        const list = [];
        reports.forEach(report => {
            const eqList = (Array.isArray(report.equipment) && report.equipment.length > 0)
                ? report.equipment
                : ((Array.isArray(report.devices) && report.devices.length > 0)
                    ? report.devices
                    : (Array.isArray(report.report_data?.equipment)
                        ? report.report_data.equipment
                        : (Array.isArray(report.dryingData?.equipment) ? report.dryingData.equipment : (report.equipment || []))));

            if (Array.isArray(eqList)) {
                eqList.forEach(item => {
                    const { isAktiv } = getEquipmentStatus(item);
                    if (isAktiv) {
                        list.push({ report, item });
                    }
                });
            }
        });
        
        return list.sort((a, b) => {
            const dateA = a.item.startDate ? new Date(a.item.startDate) : new Date(0);
            const dateB = b.item.startDate ? new Date(b.item.startDate) : new Date(0);
            return dateB - dateA;
        });
    }, [reports]);

    const getDaysRunning = (startDateStr, endDateStr) => {
        if (endDateStr) return formatCompletedEquipmentRuntime(startDateStr, endDateStr);
        return formatActiveEquipmentRuntime(startDateStr, new Date());
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
                                const typeModel = formatEquipmentTypeModel(item);
                                const projectAddress = formatEquipmentProjectAddress(report);
                                const { label: statusLabel, statusStyle } = getEquipmentStatus(item);

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
                                                {projectAddress.street}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {projectAddress.details}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>
                                            {item.room ? (
                                                <span>{formatEquipmentLocation(item)}</span>
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
                                                {statusLabel}
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

export default function Dashboard({ reports, onSelectReport, onDeleteReport, mode, supabase, currentUser, users, onReportsChanged, lockedProjectIds, onLogout, isActuallyOffline }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [casesSearchTerm, setCasesSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedSidebarReport, setSelectedSidebarReport] = useState(null);
    const [savingProjectIds, setSavingProjectIds] = useState(new Set());
    const [projectToDelete, setProjectToDelete] = useState(null);

    const executeDeleteProject = async (report) => {
        if (!report) return;
        setSavingProjectIds(prev => {
            const next = new Set(prev);
            next.add(report.id);
            return next;
        });
        try {
            let success = false;
            let errMsg = '';
            const now = new Date().toISOString();
            const userEmail = currentUser?.email || currentUser?.name || 'Unbekannt';
            if (supabase) {
                await registerDomainMutation({
                    projectId: report.id, type: 'project.delete', entityId: report.id,
                    payload: { tombstone: true, deletedAt: now, deletedBy: userEmail },
                    snapshot: { ...report, tombstone: true, deletedAt: now }, tombstone: true
                });
                const { data: fullReport, error: fetchError } = await supabase
                    .from('damage_reports')
                    .select('report_data')
                    .eq('id', report.id)
                    .single();
                if (!fetchError && fullReport) {
                    const updatedReportData = {
                        ...(fullReport.report_data || {}),
                        deletedAt: now,
                        deletedBy: userEmail
                    };
                    const { error: updateError } = await supabase
                        .from('damage_reports')
                        .update({
                            report_data: updatedReportData
                        })
                        .eq('id', report.id);
                    if (!updateError) {
                        success = true;
                    } else {
                        errMsg = updateError.message;
                    }
                } else {
                    errMsg = fetchError?.message || 'Fehler beim Laden des Berichts';
                }
            } else {
                success = true; // Offline / Mock mode
            }
            if (success) {
                if (onReportsChanged) {
                    await onReportsChanged(report.id, { deletedAt: now, deletedBy: userEmail });
                }
                alert('Projekt erfolgreich gelöscht.');
            } else {
                alert('Fehler beim Löschen: ' + errMsg);
            }
        } catch (err) {
            console.error(err);
            alert('Fehler beim Löschen: ' + err.message);
        } finally {
            setSavingProjectIds(prev => {
                const next = new Set(prev);
                next.delete(report.id);
                return next;
            });
            if (fetchReports) {
                await fetchReports().catch(() => {});
            }
        }
    };


    const [workflowStore, setWorkflowStore] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('qtool_wf_v4') || '{}');
        } catch {
            return {};
        }
    });
    const itemsPerPage = 20;
    const [showArchive, setShowArchive] = useState(false);
    const [showWorkflow, setShowWorkflow] = useState(() => {
        try {
            const saved = localStorage.getItem('qtool_show_workflow');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });
    const [showDrying, setShowDrying] = useState(() => {
        try {
            const saved = localStorage.getItem('qtool_show_drying');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });
    const [showDevices, setShowDevices] = useState(() => {
        try {
            const saved = localStorage.getItem('qtool_show_devices');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });
    const [showAllCases, setShowAllCases] = useState(() => {
        try {
            const saved = localStorage.getItem('qtool_show_all_cases');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('qtool_show_all_cases', JSON.stringify(showAllCases));
        } catch (e) {
            console.error(e);
        }
    }, [showAllCases]);

    useEffect(() => {
        try {
            localStorage.setItem('qtool_show_workflow', JSON.stringify(showWorkflow));
        } catch (e) {
            console.error(e);
        }
    }, [showWorkflow]);

    useEffect(() => {
        try {
            localStorage.setItem('qtool_show_drying', JSON.stringify(showDrying));
        } catch (e) {
            console.error(e);
        }
    }, [showDrying]);

    useEffect(() => {
        try {
            localStorage.setItem('qtool_show_devices', JSON.stringify(showDevices));
        } catch (e) {
            console.error(e);
        }
    }, [showDevices]);

    const lockedIds = lockedProjectIds instanceof Set ? lockedProjectIds : new Set();

    // Filter Logic
    const filteredReports = useMemo(() => reports.filter(r => {
        if (!isVisibleProjectRow(r)) return false;

        // Exclude soft-deleted projects
        if (r.deletedAt || r.deleted_at || r.report_data?.deletedAt) return false;

        // Archive Filter
        if (showArchive) {
            if (r.status !== 'Abgeschlossen') return false;
        } else {
            if (r.status === 'Abgeschlossen') return false;
        }

        const lowerSearch = searchTerm.toLowerCase();

        // Basic fields
        if (r.projectNumber?.toString().toLowerCase().includes(lowerSearch)) return true;
        if (r.report_data?.projectNumber?.toString().toLowerCase().includes(lowerSearch)) return true;
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

    }), [reports, showArchive, searchTerm]);

    const sidebarFilteredReports = useMemo(() => {
        if (!casesSearchTerm) return filteredReports;
        const lower = casesSearchTerm.toLowerCase();
        return filteredReports.filter(r => 
            String(r.projectNumber || '').toLowerCase().includes(lower) ||
            String(r.report_data?.projectNumber || '').toLowerCase().includes(lower) ||
            String(r.report_data?.sorba_number || '').toLowerCase().includes(lower) ||
            String(r.projectTitle || '').toLowerCase().includes(lower) ||
            String(r.client || '').toLowerCase().includes(lower) ||
            String(r.address || '').toLowerCase().includes(lower) ||
            String(r.street || '').toLowerCase().includes(lower) ||
            String(r.zip || '').toLowerCase().includes(lower) ||
            String(r.city || '').toLowerCase().includes(lower)
        );
    }, [filteredReports, casesSearchTerm]);

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
                    {/* Workflow/Drying/Devices Toggles */}
                    {!showArchive && mode !== 'technician' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.75rem', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={showWorkflow}
                                    onChange={(e) => setShowWorkflow(e.target.checked)}
                                    style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }}
                                />
                                <span>Workflow</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={showAllCases}
                                    onChange={(e) => setShowAllCases(e.target.checked)}
                                    style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }}
                                />
                                <span>Alle Fälle</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={showDrying}
                                    onChange={(e) => setShowDrying(e.target.checked)}
                                    style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }}
                                />
                                <span>Trocknungen</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={showDevices}
                                    onChange={(e) => setShowDevices(e.target.checked)}
                                    style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }}
                                />
                                <span>Geräte</span>
                            </label>
                        </div>
                    )}
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
                <div className="dashboard-layout-wrap" style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', flexWrap: 'nowrap', width: '100%' }}>
                    <style>{`
                        @media (max-width: 1024px) {
                            .dashboard-layout-wrap {
                                flex-direction: column !important;
                            }
                            .dashboard-side-col {
                                width: 100% !important;
                                position: static !important;
                                max-height: none !important;
                            }
                        }
                    `}</style>
                    {/* Left Column: Monitors */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
                        <TodoMonitor reports={reports} users={users || []} currentUser={currentUser} onSelectReport={onSelectReport} onReportsChanged={onReportsChanged} />
                        {showWorkflow && (
                            <WorkflowStatusOverview reports={reports} onSelectReport={onSelectReport} currentUser={currentUser} users={users || []} searchTerm={searchTerm} store={workflowStore} onStoreChange={setWorkflowStore} />
                        )}
                        {showDrying && (
                            <DryingMonitor reports={filteredReports} onSelectReport={onSelectReport} onDeleteReport={setProjectToDelete} workflowStore={workflowStore} />
                        )}
                    </div>

                    {/* Right Column: All Projects & Compact Devices List */}
                    {(showAllCases || showDevices) && (
                        <div className="dashboard-side-col" style={{
                            width: '400px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            position: 'sticky',
                            top: '1rem',
                            maxHeight: 'calc(100vh - 120px)',
                            overflowY: 'auto'
                        }}>
                            {/* All Projects List */}
                            {showAllCases && (
                                <div style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                                            <Folder size={18} style={{ color: 'var(--q-primary, #1e6db7)' }} />
                                            Alle Projekte ({sidebarFilteredReports.length === filteredReports.length ? filteredReports.length : `${sidebarFilteredReports.length}/${filteredReports.length}`})
                                        </h2>
                                    </div>

                                    {/* Sidebar Search Field */}
                                    <div style={{ position: 'relative', width: '100%', marginBottom: '0.25rem' }}>
                                        <input
                                            type="text"
                                            placeholder="Projekte durchsuchen..."
                                            value={casesSearchTerm}
                                            onChange={e => setCasesSearchTerm(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.65rem 0.35rem 1.8rem',
                                                fontSize: '0.78rem',
                                                border: '1px solid var(--border)',
                                                borderRadius: '6px',
                                                backgroundColor: 'var(--surface-hover, rgba(0,0,0,0.02))',
                                                color: 'var(--text-main)',
                                                outline: 'none',
                                            }}
                                        />
                                        <Search
                                            size={12}
                                            style={{
                                                position: 'absolute',
                                                left: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: 'var(--text-muted)'
                                            }}
                                        />
                                        {casesSearchTerm && (
                                            <button
                                                onClick={() => setCasesSearchTerm('')}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    padding: '0.1rem 0.3rem'
                                                }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>

                                    {/* Table Area */}
                                    <div style={{ overflowX: 'hidden', marginTop: '0.5rem' }}>
                                        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                                    <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600, width: 'calc(100% - 56px)' }}>Projekt-Nr. / Adresse</th>
                                                    <th style={{ padding: '0.5rem 0.4rem', width: '56px', textAlign: 'right' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sidebarFilteredReports.map(report => {
                                                    const isLocked = lockedIds.has(report.id);
                                                    return (
                                                        <tr
                                                            key={report.id}
                                                            onClick={() => { if (!isLocked) onSelectReport(report); }}
                                                            style={{
                                                                borderBottom: '1px solid var(--border)',
                                                                cursor: isLocked ? 'not-allowed' : 'pointer',
                                                                opacity: isLocked ? 0.75 : 1,
                                                                transition: 'background-color 0.15s ease'
                                                            }}
                                                            className="hover-row"
                                                        >
                                                            {/* Project Number / Adresse */}
                                                            <td style={{ padding: '0.5rem 0.4rem', width: 'calc(100% - 56px)', overflow: 'hidden' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: '100%' }}>
                                                                    <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {isLocked && <span style={{ marginRight: '0.2rem' }}>🔒</span>}
                                                                        {report.projectNumber || report.projectTitle || report.id}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={(() => {
                                                                        const streetPart = report.street || (report.address ? report.address.split(',')[0] : 'Keine Strasse');
                                                                        const locationParts = [report.zip, report.city].filter(Boolean).join(' ').trim();
                                                                        return locationParts ? `${streetPart}, ${locationParts}` : streetPart;
                                                                    })()}>
                                                                        {(() => {
                                                                            const streetPart = report.street || (report.address ? report.address.split(',')[0] : 'Keine Strasse');
                                                                            const locationParts = [report.zip, report.city].filter(Boolean).join(' ').trim();
                                                                            return locationParts ? `${streetPart}, ${locationParts}` : streetPart;
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Actions Column */}
                                                            <td style={{ padding: '0.5rem 0.2rem', textAlign: 'right', width: '56px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        disabled={savingProjectIds.has(report.id)}
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            const streetPart = report.street || (report.address ? report.address.split(',')[0] : 'Keine Strasse');
                                                                            const cityPart = report.city || (() => {
                                                                                const parts = (report.address || '').split(',');
                                                                                return parts.length > 1 ? parts[1].trim().replace(/^\d+\s*/, '') : '';
                                                                            })();
                                                                            const addressStr = cityPart ? `${streetPart}, ${cityPart}` : streetPart;
                                                                            const projectLabel = [report.projectNumber, addressStr].filter(Boolean).join(' - ') || report.projectTitle || report.id;

                                                                            if (window.confirm(`Projekt "${projectLabel}" wirklich archivieren (auf Abgeschlossen setzen)?`)) {
                                                                                setSavingProjectIds(prev => {
                                                                                    const next = new Set(prev);
                                                                                    next.add(report.id);
                                                                                    return next;
                                                                                });
                                                                                try {
                                                                                    const previousStatus = report.status || report.report_data?.status || 'Eingang';
                                                                                    const snapshot = { ...report, status: 'Abgeschlossen', archivePreviousStatus: previousStatus, report_data: report.report_data ? { ...report.report_data, status: 'Abgeschlossen', archivePreviousStatus: previousStatus } : report.report_data };
                                                                                    await registerDomainMutation({
                                                                                        projectId: report.id, type: 'project.archive', entityId: report.id,
                                                                                        payload: { status: 'Abgeschlossen', previousStatus }, snapshot,
                                                                                        actor: currentUser?.id || currentUser?.email || currentUser?.name || null,
                                                                                        baseVersion: report.version || report.updated_at || null
                                                                                    });
                                                                                    if (onReportsChanged) {
                                                                                        await onReportsChanged(report.id, { status: 'Abgeschlossen' });
                                                                                    }
                                                                                } catch (err) {
                                                                                    console.error(err);
                                                                                    alert('Fehler beim Archivieren: ' + err.message);
                                                                                } finally {
                                                                                    setSavingProjectIds(prev => {
                                                                                        const next = new Set(prev);
                                                                                        next.delete(report.id);
                                                                                        return next;
                                                                                    });
                                                                                }
                                                                            }
                                                                        }}
                                                                        title={isActuallyOffline ? "Projekt lokal archivieren – Cloud-Synchronisation folgt" : "Projekt archivieren (auf Abgeschlossen setzen)"}
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            cursor: savingProjectIds.has(report.id) ? 'not-allowed' : 'pointer',
                                                                            color: 'var(--text-main, #F1F5F9)',
                                                                            padding: '0.2rem',
                                                                            borderRadius: '4px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            opacity: savingProjectIds.has(report.id) ? 0.3 : 0.8,
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseEnter={e => { if (!savingProjectIds.has(report.id)) e.currentTarget.style.opacity = 1; }}
                                                                        onMouseLeave={e => { if (!savingProjectIds.has(report.id)) e.currentTarget.style.opacity = 0.8; }}
                                                                    >
                                                                        <Archive size={14} />
                                                                    </button>

                                                                    <button
                                                                        disabled={savingProjectIds.has(report.id) || isActuallyOffline}
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if (isActuallyOffline) {
                                                                                alert('Offline – Änderungen derzeit nicht möglich');
                                                                                return;
                                                                            }
                                                                            const streetPart = report.street || (report.address ? report.address.split(',')[0] : 'Keine Strasse');
                                                                             e.stopPropagation();
                                                                             if (isActuallyOffline) {
                                                                                 alert('Offline – Änderungen derzeit nicht möglich');
                                                                                 return;
                                                                             }
                                                                             setProjectToDelete(report);
                                                                         }}
                                                                        title={isActuallyOffline ? "Offline – Änderungen derzeit nicht möglich" : "Projekt löschen"}
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            cursor: (savingProjectIds.has(report.id) || isActuallyOffline) ? 'not-allowed' : 'pointer',
                                                                            color: '#DC2626',
                                                                            padding: '0.2rem',
                                                                            borderRadius: '4px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            opacity: (savingProjectIds.has(report.id) || isActuallyOffline) ? 0.3 : 0.8,
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseEnter={e => { if (!savingProjectIds.has(report.id) && !isActuallyOffline) e.currentTarget.style.opacity = 1; }}
                                                                        onMouseLeave={e => { if (!savingProjectIds.has(report.id) && !isActuallyOffline) e.currentTarget.style.opacity = 0.8; }}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Compact Device List */}
                            {showDevices && (
                                <div style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <CompactDeviceInventoryList reports={reports} onSelectReport={onSelectReport} />
                                </div>
                            )}
                        </div>
                    )}
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
                                <DashboardTechnicianProjectInfo report={report} lockedIds={lockedIds} />
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
                (showArchive && showAllCases) && (
                    <div className="card" style={{ padding: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Alle Fälle ({filteredReports.length})</h3>
                        <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                            <Filter size={13} /> Filter
                        </button>
                    </div>

                    <div className="table-container" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                        <table className="data-table">
                            <DashboardReportTableHeader />
                            <tbody>
                                {paginatedReports.map((report) => {
                                    const activeDevices = report.equipment ? report.equipment.length : 0;
                                    const hasLieferantenrechnung = report.images?.some(img => img.assignedTo === 'Sonstiges');
                                    const isLocked = lockedIds.has(report.id);
                                    return (
                                        <tr key={report.id} onClick={() => onSelectReport(report)} style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.75 : 1 }}>
                                            <td style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                {currentUser?.role === 'admin' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setProjectToDelete(report);
                                                        }}
                                                        disabled={savingProjectIds.has(report.id)}
                                                        title="Projekt löschen"
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: savingProjectIds.has(report.id) ? 'not-allowed' : 'pointer',
                                                            color: '#dc3545',
                                                            padding: '0.2rem',
                                                            borderRadius: '4px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            opacity: savingProjectIds.has(report.id) ? 0.3 : 0.6
                                                        }}
                                                        onMouseEnter={e => { if (!savingProjectIds.has(report.id)) e.currentTarget.style.opacity = 1; }}
                                                        onMouseLeave={e => { if (!savingProjectIds.has(report.id)) e.currentTarget.style.opacity = 0.6; }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
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
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!window.confirm(`Projekt "${report.projectTitle || report.projectNumber || report.id}" wiederherstellen?`)) return;
                                                            setSavingProjectIds(prev => new Set(prev).add(report.id));
                                                            try {
                                                                const restoreStatus = report.archivePreviousStatus || report.report_data?.archivePreviousStatus || 'Eingang';
                                                                const restoredReportData = report.report_data ? { ...report.report_data, status: restoreStatus } : report.report_data;
                                                                if (restoredReportData) delete restoredReportData.archivePreviousStatus;
                                                                const snapshot = { ...report, status: restoreStatus, report_data: restoredReportData };
                                                                delete snapshot.archivePreviousStatus;
                                                                await registerDomainMutation({
                                                                    projectId: report.id,
                                                                    type: 'project.restore',
                                                                    entityId: report.id,
                                                                    payload: { status: restoreStatus },
                                                                    snapshot,
                                                                    actor: currentUser?.id || currentUser?.email || currentUser?.name || null,
                                                                    baseVersion: report.version || report.updated_at || null
                                                                });
                                                                if (onReportsChanged) await onReportsChanged(report.id, { status: restoreStatus, archivePreviousStatus: undefined });
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('Fehler beim Wiederherstellen: ' + err.message);
                                                            } finally {
                                                                setSavingProjectIds(prev => {
                                                                    const next = new Set(prev);
                                                                    next.delete(report.id);
                                                                    return next;
                                                                });
                                                            }
                                                        }}
                                                        disabled={savingProjectIds.has(report.id)}
                                                        className="btn btn-sm btn-ghost"
                                                        style={{ color: '#22C55E', padding: '0.25rem' }}
                                                        title={isActuallyOffline ? 'Projekt lokal wiederherstellen – Cloud-Synchronisation folgt' : 'Projekt wiederherstellen'}
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setProjectToDelete(report);
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
            )
        )}
        
        {projectToDelete && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                animation: 'fadeIn 0.2s ease-out'
            }} onClick={() => setProjectToDelete(null)}>
                <div style={{
                    background: 'var(--surface, #1E293B)',
                    border: '1px solid var(--border, #334155)',
                    borderRadius: '12px',
                    padding: '1.75rem',
                    maxWidth: '500px',
                    width: '90%',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                    animation: 'slideUp 0.25s ease-out'
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ⚠️ Projekt löschen?
                    </h3>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: 'var(--text-main, #F1F5F9)', lineHeight: 1.5 }}>
                        Wollen Sie das Projekt wirklich löschen?
                    </p>
                    
                    {/* Project Details Box */}
                    <div style={{
                        background: 'var(--hover-bg, rgba(0, 0, 0, 0.15))',
                        border: '1px solid var(--border, #334155)',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.85rem'
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                            Projekt-Nr: {projectToDelete.projectNumber || '---'}
                        </div>
                        <div style={{ color: 'var(--text-muted, #94A3B8)' }}>
                            {(() => {
                                const streetPart = projectToDelete.street || (projectToDelete.address ? projectToDelete.address.split(',')[0] : 'Keine Strasse');
                                const locationParts = [projectToDelete.zip, projectToDelete.city].filter(Boolean).join(' ').trim();
                                return locationParts ? `${streetPart}, ${locationParts}` : streetPart;
                            })()}
                        </div>
                        {projectToDelete.projectTitle && (
                            <div style={{ color: 'var(--text-muted, #94A3B8)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                {projectToDelete.projectTitle}
                            </div>
                        )}
                    </div>

                    <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.4 }}>
                        Das Projekt wird aus der Projektliste entfernt. Die gespeicherten Daten und Bilder werden nicht physisch gelöscht.
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-outline"
                            onClick={() => setProjectToDelete(null)}
                            style={{ padding: '0.5rem 1.25rem', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                            Abbrechen
                        </button>
                        <button
                            onClick={async () => {
                                const target = projectToDelete;
                                setProjectToDelete(null);
                                await executeDeleteProject(target);
                            }}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: '20px',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                background: '#EF4444',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 600,
                                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                            }}
                        >
                            Unwiderruflich löschen
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    )
}
