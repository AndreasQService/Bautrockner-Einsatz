import { MapPin } from 'lucide-react'
import { formatTechnicianLocation, formatTechnicianProjectReference } from '../utils/dashboardUtils'
import { DASHBOARD_STATUS_COLORS as statusColors } from '../config/dashboardConfig'

export default function DashboardTechnicianProjectInfo({ report, lockedIds }) {
    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700, minWidth: 0 }}>
                    <MapPin size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatTechnicianLocation(report)}
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
                {formatTechnicianProjectReference(report)}
            </div>
        </div>
    )
}
