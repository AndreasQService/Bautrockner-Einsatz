import { useState, useEffect, useRef } from 'react'
import { Bell, Calendar, X, ChevronRight, AlertTriangle, Clock, CheckCircle2, Zap } from 'lucide-react'

// Format date as dd.mm.yy
const fmtShort = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return '—'
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)}`
}

// ─── Workflow steps ────────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { id: 'meldung',        label: 'Eingang',      fullLabel: 'Eingang der Meldung' },
  { id: 'kontakt',        label: 'Kontakt',       fullLabel: 'Kontakt' },
  { id: 'schadenaufnahme',label: 'Aufnahme',      fullLabel: 'Schadenaufnahme' },
  { id: 'leckortung',     label: 'Leckortung',    fullLabel: 'Leckortung' },
  { id: 'bericht',        label: 'Bericht',       fullLabel: 'Bericht' },
  { id: 'trocknung',      label: 'Trocknung',     fullLabel: 'Trocknung' },
  { id: 'instandstellung',label: 'Instand.',      fullLabel: 'Instandstellung' },
  { id: 'rechnung',       label: 'Rechnung',      fullLabel: 'Rechnung' },
]

// Map report.status → workflow step id
const STATUS_TO_STEP = {
  'Schadenaufnahme': 'schadenaufnahme',
  'Leckortung':      'leckortung',
  'Trocknung':       'trocknung',
  'Instandsetzung':  'instandstellung',
  'Instandstellung': 'instandstellung',
  'Abgeschlossen':   'rechnung',
}

const STORAGE_KEY = 'qtool_workflow_reminders_v1'

const loadReminders = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}
const saveReminders = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.ceil((d - today()) / 86400000)
}

const stepIndex = (stepId) => WORKFLOW_STEPS.findIndex(s => s.id === stepId)

const getCurrentStep = (report) => {
  const mapped = STATUS_TO_STEP[report.status]
  return mapped || 'meldung'
}

// ─── DatePopover ──────────────────────────────────────────────────────────────
function DatePopover({ reportId, stepId, reminders, onSave, onClose, anchorRef }) {
  const key = `${reportId}__${stepId}`
  const existing = reminders[key] || ''
  const [date, setDate] = useState(existing)
  const [note, setNote] = useState(reminders[`${key}__note`] || '')
  const [skipped, setSkipped] = useState(!!reminders[`${key}__skip`])
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const step = WORKFLOW_STEPS.find(s => s.id === stepId)

  return (
    <div
      ref={ref}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', zIndex: 9999,
        top: '110%', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: '#1E293B',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        padding: '1rem',
        width: '220px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        animation: 'fadeInDown 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94A3B8' }}>{step?.fullLabel}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0 }}>
          <X size={14} />
        </button>
      </div>

      {/* Nicht zutreffend Checkbox */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        fontSize: '0.75rem', color: skipped ? '#F59E0B' : '#64748B',
        marginBottom: '0.75rem', cursor: 'pointer',
        padding: '0.4rem 0.5rem',
        borderRadius: '7px',
        backgroundColor: skipped ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${skipped ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.15s'
      }}>
        <input
          type="checkbox"
          checked={skipped}
          onChange={e => setSkipped(e.target.checked)}
          style={{ accentColor: '#F59E0B', width: 14, height: 14 }}
        />
        Nicht zutreffend
      </label>

      {/* Date & note only shown when not skipped */}
      {!skipped && (
        <>
          <label style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>Fälligkeit</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', borderRadius: '7px',
              border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#0F172A',
              color: 'white', fontSize: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box'
            }}
          />
          <label style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>Notiz</label>
          <input
            type="text"
            value={note}
            placeholder="Optional..."
            onChange={e => setNote(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', borderRadius: '7px',
              border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#0F172A',
              color: 'white', fontSize: '0.8rem', marginBottom: '0.75rem', boxSizing: 'border-box'
            }}
          />
        </>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: skipped ? 0 : undefined }}>
        <button
          onClick={() => onSave(key, skipped ? '' : date, skipped ? '' : note, skipped)}
          style={{
            flex: 1, padding: '0.4rem', borderRadius: '7px', border: 'none',
            backgroundColor: skipped ? '#F59E0B' : '#3B82F6',
            color: 'white', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer'
          }}
        >Speichern</button>
        {(existing || reminders[`${key}__skip`]) && (
          <button
            onClick={() => onSave(key, '', '', false)}
            style={{
              padding: '0.4rem 0.6rem', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'transparent', color: '#EF4444', fontSize: '0.78rem', cursor: 'pointer'
            }}
          >Löschen</button>
        )}
      </div>
    </div>
  )
}

// ─── ProjectRow ───────────────────────────────────────────────────────────────
function ProjectRow({ report, reminders, onSaveReminder, onSelect }) {
  const [popover, setPopover] = useState(null) // stepId
  const btnRefs = useRef({})
  const currentStep = getCurrentStep(report)
  const currentIdx = stepIndex(currentStep)

  const handleStepClick = (stepId, e) => {
    e.stopPropagation()
    setPopover(prev => prev === stepId ? null : stepId)
  }

  const handleSave = (key, date, note, skipped) => {
    onSaveReminder(key, date, note, skipped)
    setPopover(null)
  }

  return (
    <tr
      onClick={() => onSelect(report)}
      style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* Project name + number + Schadenort */}
      <td style={{ padding: '0.6rem 0.75rem', minWidth: '170px', verticalAlign: 'middle' }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '165px' }}>
          {report.street
            ? `${report.street}, ${report.zip ? report.zip + ' ' : ''}${report.city || ''}`
            : report.address
              ? report.address.split(',')[0]
              : report.locationDetails || report.projectTitle || '—'}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {report.projectNumber || report.id || '—'}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '165px', marginTop: '1px' }}>
          {report.client || report.projectTitle || '—'}
        </div>
      </td>

      {/* Workflow steps */}
      {WORKFLOW_STEPS.map((step, idx) => {
        const key = `${report.id}__${step.id}`
        const isEingang = step.id === 'meldung'
        const isKontakt = step.id === 'kontakt'
        const isTrocknung = step.id === 'trocknung'
        const isSkipped = !isEingang && !!reminders[`${key}__skip`]
        const hasNoContacts = isKontakt && !isSkipped && (!report.contacts || report.contacts.length === 0)
        const hasActiveDrying = isTrocknung && report.equipment && report.equipment.some(e => !e.endDate)
        const dueDate = isEingang ? null : reminders[key]
        const note = reminders[`${key}__note`] || ''
        const days = daysUntil(dueDate)
        const isDone = idx < currentIdx
        const isActive = idx === currentIdx

        // reminder states (suppressed if skipped)
        let reminderColor = null
        let reminderIcon = null
        if (!isSkipped) {
          if (dueDate) {
            if (days < 0) { reminderColor = '#EF4444'; reminderIcon = <AlertTriangle size={9} /> }
            else if (days === 0) { reminderColor = '#F59E0B'; reminderIcon = <Clock size={9} /> }
            else if (days <= 3) { reminderColor = '#F59E0B'; reminderIcon = <Bell size={9} /> }
            else { reminderColor = '#3B82F6'; reminderIcon = <Calendar size={9} /> }
          }
          if (hasNoContacts) { reminderColor = '#EF4444'; reminderIcon = <AlertTriangle size={9} /> }
          if (!isEingang && isActive && !dueDate) { reminderColor = '#EF4444'; reminderIcon = <AlertTriangle size={9} /> }
        }

        // ── EINGANG: fixed date cell ──────────────────────────────────────────
        if (isEingang) {
          return (
            <td
              key={step.id}
              style={{ padding: '0.4rem 0.25rem', textAlign: 'center', verticalAlign: 'middle' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                width: '54px', minHeight: '38px', justifyContent: 'center', gap: '3px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16,185,129,0.12)',
                padding: '4px 2px'
              }}>
                <CheckCircle2 size={13} color="#10B981" />
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#10B981' }}>Eingang</span>
                <span style={{ fontSize: '0.58rem', color: '#64748B', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {fmtShort(report.date)}
                </span>
              </div>
            </td>
          )
        }

        // ── All other steps: clickable ────────────────────────────────────────
        return (
          <td
            key={step.id}
            style={{ padding: '0.4rem 0.25rem', textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                ref={el => btnRefs.current[step.id] = el}
                onClick={e => handleStepClick(step.id, e)}
                title={isSkipped ? `${step.fullLabel} — Nicht zutreffend` : `${step.fullLabel}${dueDate ? ` — Fälligkeit: ${dueDate}` : ' — Fälligkeit setzen'}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                  width: '54px', minHeight: '38px',
                  borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '0.62rem', fontWeight: isActive && !isSkipped ? 800 : 500,
                  gap: '2px',
                  transition: 'all 0.15s',
                  opacity: isSkipped ? 0.45 : 1,
                  backgroundColor: isSkipped
                    ? 'rgba(255,255,255,0.02)'
                    : isDone
                      ? 'rgba(16,185,129,0.12)'
                      : isActive
                        ? 'rgba(59,130,246,0.2)'
                        : 'rgba(255,255,255,0.03)',
                  color: isSkipped
                    ? '#334155'
                    : isDone
                      ? '#10B981'
                      : isActive
                        ? '#60A5FA'
                        : '#475569',
                  boxShadow: !isSkipped && (isActive ? '0 0 0 1.5px rgba(59,130,246,0.5)' : reminderColor ? `0 0 0 1.5px ${reminderColor}55` : 'none'),
                  outline: popover === step.id ? `2px solid #3B82F6` : 'none',
                }}
              >
                {isSkipped
                  ? <span style={{ fontSize: '0.7rem', color: '#475569' }}>—</span>
                  : isDone
                    ? <CheckCircle2 size={13} />
                    : isActive
                      ? <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3B82F6', boxShadow: '0 0 6px #3B82F6' }} />
                      : <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#334155' }} />
                }
                <span style={{ textDecoration: isSkipped ? 'line-through' : 'none' }}>{step.label}</span>
              </button>

              {/* Trocknung: aktives Gerät → gelbes ⚡ Badge oben links */}
              {hasActiveDrying && (
                <div style={{
                  position: 'absolute', top: -4, left: -4,
                  backgroundColor: '#F59E0B',
                  color: 'white', borderRadius: '50%',
                  width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', pointerEvents: 'none',
                  boxShadow: '0 0 8px #F59E0Bcc',
                  animation: 'dryingPulse 1.8s ease-in-out infinite'
                }}>
                  <Zap size={8} fill="white" strokeWidth={0} />
                </div>
              )}

              {/* Reminder badge (oben rechts) */}
              {reminderColor && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  backgroundColor: reminderColor,
                  color: 'white', borderRadius: '50%',
                  width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: 700, pointerEvents: 'none',
                  boxShadow: `0 0 6px ${reminderColor}88`
                }}>
                  {reminderIcon}
                </div>
              )}

              {/* Days label below */}
              {dueDate && (
                <div style={{ fontSize: '0.59rem', color: reminderColor, fontWeight: 700, marginTop: '1px', lineHeight: 1 }}>
                  {days === 0 ? 'Heute' : days < 0 ? `${Math.abs(days)}d über` : `${days}d`}
                </div>
              )}

              {/* Popover */}
              {popover === step.id && (
                <DatePopover
                  reportId={report.id}
                  stepId={step.id}
                  reminders={reminders}
                  onSave={handleSave}
                  onClose={() => setPopover(null)}
                  anchorRef={{ current: btnRefs.current[step.id] }}
                />
              )}
            </div>
          </td>
        )
      })}
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WorkflowStatusOverview({ reports, onSelectReport }) {
  const [reminders, setReminders] = useState(loadReminders)
  const [collapsed, setCollapsed] = useState(false)

  // only active, non-archived
  const activeReports = reports
    .filter(r => r.status !== 'Abgeschlossen')
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  // count overdue reminders across all projects (exclude skipped steps)
  const overdueCount = Object.entries(reminders)
    .filter(([k, v]) => !k.endsWith('__note') && !k.endsWith('__skip') && v && daysUntil(v) < 0)
    .length

  const soonCount = Object.entries(reminders)
    .filter(([k, v]) => !k.endsWith('__note') && !k.endsWith('__skip') && v && daysUntil(v) !== null && daysUntil(v) >= 0 && daysUntil(v) <= 3)
    .length

  const handleSaveReminder = (key, date, note, skipped) => {
    setReminders(prev => {
      const next = { ...prev }
      if (date) { next[key] = date } else { delete next[key] }
      if (note) { next[`${key}__note`] = note } else { delete next[`${key}__note`] }
      if (skipped) { next[`${key}__skip`] = true } else { delete next[`${key}__skip`] }
      saveReminders(next)
      return next
    })
  }

  if (activeReports.length === 0) return null

  return (
    <div style={{
      marginBottom: '1.5rem',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      backgroundColor: 'var(--surface)',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.9rem 1.25rem',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(16,185,129,0.04) 100%)',
          userSelect: 'none'
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', flex: 1 }}>
          Workflow-Statusübersicht
          <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#64748B', marginLeft: '0.6rem' }}>
            {activeReports.length} aktive Projekte
          </span>
        </span>

        {/* Alert badges */}
        {overdueCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444',
            borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700,
            border: '1px solid rgba(239,68,68,0.3)'
          }}>
            <AlertTriangle size={11} /> {overdueCount} überfällig
          </span>
        )}
        {soonCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B',
            borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700,
            border: '1px solid rgba(245,158,11,0.3)'
          }}>
            <Bell size={11} /> {soonCount} bald fällig
          </span>
        )}

        {/* Collapse chevron */}
        <ChevronRight
          size={16}
          style={{
            color: '#64748B',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform 0.2s'
          }}
        />
      </div>

      {/* Table */}
      {!collapsed && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Projekt
                </th>
                {WORKFLOW_STEPS.map(step => (
                  <th key={step.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', fontSize: '0.62rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeReports.map(report => (
                <ProjectRow
                  key={report.id}
                  report={report}
                  reminders={reminders}
                  onSaveReminder={handleSaveReminder}
                  onSelect={onSelectReport}
                />
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{
            padding: '0.6rem 1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>LEGENDE:</span>
            {[
              { color: '#10B981', label: 'Erledigt' },
              { color: '#3B82F6', label: 'Aktuell' },
              { color: '#334155', label: 'Ausstehend' },
              { color: '#EF4444', label: 'Überfällig' },
              { color: '#F59E0B', label: '≤ 3 Tage' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', color: '#64748B' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                {label}
              </div>
            ))}
            <span style={{ fontSize: '0.63rem', color: '#334155', marginLeft: 'auto', fontStyle: 'italic' }}>
              Klicke auf einen Schritt → Fälligkeit setzen
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes dryingPulse {
          0%, 100% { box-shadow: 0 0 4px #F59E0Baa; transform: scale(1); }
          50%       { box-shadow: 0 0 10px #F59E0Bff; transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
