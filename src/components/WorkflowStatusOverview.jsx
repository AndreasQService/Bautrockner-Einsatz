import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, Calendar, X, ChevronRight, AlertTriangle, Clock,
  CheckCircle2, Zap, StickyNote, MinusCircle, Check,
  Minus, CalendarDays, MessageSquare, Activity
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { id: 'meldung',         label: 'Eingang',       icon: '📋', fullLabel: 'Eingang der Meldung',  fixed: true },
  { id: 'kontakt',         label: 'Kontakt',       icon: '📞', fullLabel: 'Kontakt aufgenommen'               },
  { id: 'schadenaufnahme', label: 'Aufnahme',      icon: '🔍', fullLabel: 'Schadenaufnahme'                   },
  { id: 'leckortung',      label: 'Leckortung',   icon: '💧', fullLabel: 'Leckortung'                         },
  { id: 'bericht',         label: 'Bericht',       icon: '📄', fullLabel: 'Bericht erstellt'                   },
  { id: 'trocknung',       label: 'Trocknung',     icon: '🌬️', fullLabel: 'Trocknung'                         },
  { id: 'instandstellung', label: 'Instandst.',    icon: '🔧', fullLabel: 'Instandstellung'                    },
  { id: 'rechnung',        label: 'Rechnung',      icon: '💰', fullLabel: 'Rechnung gestellt'                  },
  { id: 'abschluss',       label: 'Abschluss',     icon: '✅', fullLabel: 'Abschluss'                         },
]

const STATUS_TO_IDX = {
  'Schadenaufnahme': 2,
  'Leckortung':      3,
  'Trocknung':       5,
  'Instandsetzung':  6,
  'Instandstellung': 6,
  'Abgeschlossen':   8,
}

const STORAGE_KEY = 'qtool_wf_v3'

// ─── Storage helpers ──────────────────────────────────────────────────────────

const loadData = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}
const saveData = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d))

// ─── Date / time helpers ──────────────────────────────────────────────────────

const fmtShort = (ds) => {
  if (!ds) return null
  const d = new Date(ds); if (isNaN(d)) return null
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)}`
}

const today0 = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
const daysFrom = (ds) => {
  if (!ds) return null
  const d = new Date(ds); d.setHours(0,0,0,0)
  return Math.ceil((d - today0()) / 86400000)
}

// Get urgency color for a date
const dateUrgency = (ds) => {
  const days = daysFrom(ds)
  if (days === null) return null
  if (days < -7) return { color: '#DC2626', label: `${Math.abs(days)}T über`, badge: '#DC2626' }
  if (days < 0)  return { color: '#EF4444', label: `${Math.abs(days)}T über`, badge: '#EF4444' }
  if (days === 0) return { color: '#F59E0B', label: 'Heute',    badge: '#F59E0B' }
  if (days <= 2)  return { color: '#F59E0B', label: `${days}T`,  badge: '#F59E0B' }
  if (days <= 5)  return { color: '#3B82F6', label: `${days}T`,  badge: '#3B82F6' }
  return { color: '#3B82F6', label: `${days}T`, badge: '#3B82F6' }
}

// ─── Step data accessor ───────────────────────────────────────────────────────
// stepData: { status: 'done'|'skip'|'date'|null, date: string|null, note: string }

const getStepData = (store, reportId, stepId) => {
  const raw = store[`${reportId}__${stepId}`]
  if (!raw) return { status: null, date: null, note: '' }
  return raw
}

const setStepData = (store, reportId, stepId, data) => {
  const next = { ...store }
  next[`${reportId}__${stepId}`] = data
  return next
}

const isComplete = (sd) => sd.status === 'done' || sd.status === 'skip'

// Determine active step index for a report
const getActiveIdx = (report, store) => {
  const base = STATUS_TO_IDX[report.status] ?? 0
  // Walk forward while steps are complete
  let idx = base
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    const sd = getStepData(store, report.id, WORKFLOW_STEPS[i].id)
    if (isComplete(sd)) { idx = Math.max(idx, i + 1) }
  }
  return Math.min(idx, WORKFLOW_STEPS.length - 1)
}

// ─── StepPopover ──────────────────────────────────────────────────────────────

function StepPopover({ reportId, step, stepData, onSave, onClose, anchorRect }) {
  const [mode, setMode]   = useState(stepData.status || 'date') // 'done'|'skip'|'date'
  const [date, setDate]   = useState(stepData.date || '')
  const [note, setNote]   = useState(stepData.note || '')
  const ref = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Position relative to anchor
  const style = {
    position: 'fixed',
    zIndex: 9999,
    backgroundColor: '#1A2332',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '14px',
    padding: '1rem',
    width: '240px',
    boxShadow: '0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
    animation: 'wfFadeIn 0.12s ease',
  }

  // Smart positioning
  if (anchorRect) {
    const winH = window.innerHeight
    const popH = 280
    if (anchorRect.bottom + popH < winH) {
      style.top  = anchorRect.bottom + 6
      style.left = Math.min(anchorRect.left, window.innerWidth - 256)
    } else {
      style.bottom = winH - anchorRect.top + 6
      style.left   = Math.min(anchorRect.left, window.innerWidth - 256)
    }
  }

  const handleSave = () => {
    if (mode === 'date' && !date) return
    onSave({ status: mode, date: mode === 'date' ? date : null, note })
    onClose()
  }

  const handleClear = () => {
    onSave({ status: null, date: null, note: '' })
    onClose()
  }

  const btnBase = (active, accent) => ({
    flex: 1, padding: '0.45rem 0.5rem', borderRadius: '8px',
    border: `1.5px solid ${active ? accent : 'rgba(255,255,255,0.08)'}`,
    backgroundColor: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
    color: active ? accent : '#64748B',
    fontWeight: active ? 700 : 500, fontSize: '0.75rem',
    cursor: 'pointer', transition: 'all 0.12s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  })

  return (
    <div ref={ref} style={style} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#CBD5E1' }}>
          {step.icon} {step.fullLabel}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, display:'flex' }}>
          <X size={14} />
        </button>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
        <button style={btnBase(mode==='done','#10B981')} onClick={() => setMode('done')}>
          <Check size={13} /> Erledigt
        </button>
        <button style={btnBase(mode==='skip','#64748B')} onClick={() => setMode('skip')}>
          <Minus size={13} /> Nicht nötig
        </button>
        <button style={btnBase(mode==='date','#3B82F6')} onClick={() => setMode('date')}>
          <CalendarDays size={13} /> Datum
        </button>
      </div>

      {/* Date input — only when mode=date */}
      {mode === 'date' && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
            Fälligkeit / Termin
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px',
              border: `1px solid ${date ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
              backgroundColor: '#0F1929', color: 'white',
              fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Note */}
      <div style={{ marginBottom: '0.85rem' }}>
        <label style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
          Notiz (optional)
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Kurze Notiz…"
          rows={2}
          style={{
            width: '100%', padding: '0.4rem 0.6rem', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: '#0F1929', color: '#CBD5E1',
            fontSize: '0.78rem', resize: 'none', boxSizing: 'border-box',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button
          onClick={handleSave}
          disabled={mode === 'date' && !date}
          style={{
            flex: 1, padding: '0.45rem', borderRadius: '8px', border: 'none',
            backgroundColor: mode === 'done' ? '#10B981' : mode === 'skip' ? '#475569' : '#3B82F6',
            color: 'white', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
            opacity: (mode === 'date' && !date) ? 0.4 : 1,
            transition: 'opacity 0.12s',
          }}
        >
          Speichern
        </button>
        {stepData.status && (
          <button
            onClick={handleClear}
            style={{
              padding: '0.45rem 0.7rem', borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.3)',
              backgroundColor: 'rgba(239,68,68,0.08)',
              color: '#EF4444', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            Löschen
          </button>
        )}
      </div>
    </div>
  )
}

// ─── StepCell ─────────────────────────────────────────────────────────────────

function StepCell({ report, step, stepIdx, activeIdx, store, onOpenPopover, openPopoverId }) {
  const btnRef = useRef(null)
  const sd = getStepData(store, report.id, step.id)
  const isFixed = step.fixed

  // Determine visual state
  let state = 'pending'
  if (sd.status === 'done') state = 'done'
  else if (sd.status === 'skip') state = 'skip'
  else if (sd.status === 'date') state = 'date'
  else if (stepIdx < activeIdx) state = 'done' // inherited from report status
  else if (stepIdx === activeIdx) state = 'active'

  const urgency = sd.status === 'date' ? dateUrgency(sd.date) : null
  const hasNote = !!sd.note

  // BG / color logic
  const styles = {
    done:    { bg: 'rgba(16,185,129,0.12)',  fg: '#10B981', border: 'transparent' },
    skip:    { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'transparent' },
    date:    {
      bg:     urgency?.color === '#DC2626' ? 'rgba(220,38,38,0.13)'
            : urgency?.color === '#EF4444' ? 'rgba(239,68,68,0.12)'
            : urgency?.color === '#F59E0B' ? 'rgba(245,158,11,0.12)'
            : 'rgba(59,130,246,0.12)',
      fg:     urgency?.color || '#3B82F6',
      border: (urgency?.color || '#3B82F6') + '55',
    },
    active:  { bg: 'rgba(59,130,246,0.15)', fg: '#60A5FA', border: 'rgba(59,130,246,0.45)' },
    pending: { bg: 'rgba(255,255,255,0.02)', fg: '#334155', border: 'transparent' },
  }
  const s = styles[state]
  const isOpen = openPopoverId === `${report.id}__${step.id}`

  const handleClick = (e) => {
    if (isFixed) return
    e.stopPropagation()
    const rect = btnRef.current?.getBoundingClientRect()
    onOpenPopover(report.id, step.id, rect)
  }

  // Fixed "Eingang" cell
  if (isFixed) {
    const entryDate = fmtShort(report.date)
    return (
      <td style={{ padding: '2px 1px', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', minHeight: 36,
          borderRadius: 6,
          backgroundColor: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.2)',
          boxSizing: 'border-box',
        }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 800, color: '#10B981',
            lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
          }}>
            {entryDate || '—'}
          </span>
        </div>
      </td>
    )
  }

  return (
    <td style={{ padding: '2px 1px', textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}>
      <div style={{ position: 'relative', display: 'block' }}>
        <button
          ref={btnRef}
          onClick={handleClick}
          title={step.fullLabel}
          style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', minHeight: 36,
            borderRadius: 6, border: `1.5px solid ${isOpen ? '#3B82F6' : s.border || 'transparent'}`,
            cursor: 'pointer', gap: 1, transition: 'all 0.12s',
            backgroundColor: s.bg,
            color: s.fg,
            fontWeight: state === 'active' ? 700 : 500,
            fontSize: '0.58rem',
            opacity: state === 'skip' ? 0.5 : 1,
            outline: isOpen ? '2px solid rgba(59,130,246,0.35)' : 'none',
            outlineOffset: 1,
          }}
        >
          {/* Button content — no labels, only state indicator */}
          {state === 'done' && <CheckCircle2 size={14} />}
          {state === 'skip' && <MinusCircle  size={13} />}
          {state === 'date' && (
            <span style={{ fontSize: '0.82rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {urgency?.label || '—'}
            </span>
          )}
          {state === 'active' && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: '#3B82F6',
              boxShadow: '0 0 6px #3B82F6aa',
              animation: 'wfPulse 2s ease-in-out infinite',
            }} />
          )}
          {/* pending: intentionally empty */}

          {/* Note badge — top right, tiny dot with note icon */}
          {hasNote && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              width: 14, height: 14, borderRadius: '50%',
              backgroundColor: '#8B5CF6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 6px rgba(139,92,246,0.6)',
              pointerEvents: 'none',
            }}>
              <MessageSquare size={7} color="white" />
            </div>
          )}

          {/* Active drying badge */}
          {step.id === 'trocknung' && report.equipment?.some(e => !e.endDate) && (
            <div style={{
              position: 'absolute', top: -4, left: -4,
              width: 14, height: 14, borderRadius: '50%',
              backgroundColor: '#F59E0B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'wfDryPulse 1.8s ease-in-out infinite',
              pointerEvents: 'none',
            }}>
              <Zap size={7} fill="white" strokeWidth={0} color="white" />
            </div>
          )}
        </button>
      </div>
    </td>
  )
}

// ─── ProjectRow ───────────────────────────────────────────────────────────────

function ProjectRow({ report, store, onUpdate, onSelect, openPopover, onOpenPopover }) {
  const activeIdx = getActiveIdx(report, store)

  // Address split: line1 = street, line2 = zip+city, line3 = ref+client
  const addrStreet = report.street || (report.address ? report.address.split(',')[0].trim() : null) || report.projectTitle || '—'
  const addrCity   = [report.zip, report.city].filter(Boolean).join(' ') || null
  const addrSub    = [report.projectNumber || report.id, report.client].filter(Boolean).join(' · ')
  const fullAddr   = [addrStreet, addrCity, addrSub].filter(Boolean).join(', ')

  return (
    <tr
      onClick={() => onSelect(report)}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background-color 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* Project info */}
      <td
        title={fullAddr}
        style={{ padding: '4px 0.75rem', verticalAlign: 'middle', minWidth: 200 }}
      >
        {/* Strasse + Nummer */}
        <div style={{
          fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)',
          lineHeight: 1.3, wordBreak: 'break-word',
        }}>
          {addrStreet}
        </div>
        {/* PLZ + Ort */}
        {addrCity && (
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.2, marginTop: 1 }}>
            {addrCity}
          </div>
        )}
        {/* Referenz + Kunde */}
        <div style={{ fontSize: '0.62rem', color: '#475569', marginTop: 1, lineHeight: 1.2 }}>
          {addrSub}
        </div>
      </td>

      {/* Step cells */}
      {WORKFLOW_STEPS.map((step, idx) => (
        <StepCell
          key={step.id}
          report={report}
          step={step}
          stepIdx={idx}
          activeIdx={activeIdx}
          store={store}
          openPopoverId={openPopover}
          onOpenPopover={onOpenPopover}
        />
      ))}
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowStatusOverview({ reports, onSelectReport }) {
  const [store, setStore]         = useState(loadData)
  const [collapsed, setCollapsed] = useState(false)
  const [popover, setPopover]     = useState(null) // { reportId, stepId, rect }
  const tableWrapRef              = useRef(null)

  const activeReports = reports
    .filter(r => r.status !== 'Abgeschlossen')
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  // Count overdue and soon
  const overdueCount = activeReports.reduce((acc, r) => {
    WORKFLOW_STEPS.forEach(step => {
      const sd = getStepData(store, r.id, step.id)
      if (sd.status === 'date' && daysFrom(sd.date) !== null && daysFrom(sd.date) < 0) acc++
    })
    return acc
  }, 0)

  const soonCount = activeReports.reduce((acc, r) => {
    WORKFLOW_STEPS.forEach(step => {
      const sd = getStepData(store, r.id, step.id)
      const d = daysFrom(sd.date)
      if (sd.status === 'date' && d !== null && d >= 0 && d <= 2) acc++
    })
    return acc
  }, 0)

  const handleSave = useCallback((reportId, stepId, data) => {
    setStore(prev => {
      const next = setStepData(prev, reportId, stepId, data)
      saveData(next)
      return next
    })
  }, [])

  const handleOpenPopover = useCallback((reportId, stepId, rect) => {
    setPopover(prev =>
      prev?.reportId === reportId && prev?.stepId === stepId
        ? null
        : { reportId, stepId, rect }
    )
  }, [])

  const handleClosePopover = useCallback(() => setPopover(null), [])

  if (activeReports.length === 0) return null

  const openKey = popover ? `${popover.reportId}__${popover.stepId}` : null
  const popoverStep = popover ? WORKFLOW_STEPS.find(s => s.id === popover.stepId) : null
  const popoverSd   = popover ? getStepData(store, popover.reportId, popover.stepId) : null

  return (
    <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid #3B82F6' }}>

      {/* ── Panel-Header ─────────────────────────────────────────────── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          marginBottom: collapsed ? 0 : '1rem',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3B82F6', flexShrink: 0 }} />
          Workflow-Statusübersicht
          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#475569' }}>
            {activeReports.length} aktive Projekte
          </span>
        </h2>

        {overdueCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444',
            borderRadius: '999px', padding: '0.18rem 0.6rem',
            fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)',
          }}>
            <AlertTriangle size={10} /> {overdueCount} überfällig
          </span>
        )}
        {soonCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B',
            borderRadius: '999px', padding: '0.18rem 0.6rem',
            fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <Bell size={10} /> {soonCount} bald fällig
          </span>
        )}

        <ChevronRight size={15} color="#475569" style={{
          transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          transition: 'transform 0.2s',
        }} />
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div
          ref={tableWrapRef}
          style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '520px', position: 'relative' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '220px' }} />
              {WORKFLOW_STEPS.map(s => (
                <col key={s.id} />
              ))}
            </colgroup>

            {/* Sticky thead */}
            <thead>
              <tr style={{
                position: 'sticky', top: 0, zIndex: 20,
                backgroundColor: '#141E2E',
                borderBottom: '2px solid rgba(255,255,255,0.09)',
              }}>
                {/* Project column header */}
                <th style={{
                  padding: '0.65rem 0.75rem',
                  textAlign: 'left',
                  fontSize: '0.7rem', fontWeight: 700,
                  color: '#94A3B8',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                }}>
                  Projekt / Objekt
                </th>

                {/* Step column headers */}
                {WORKFLOW_STEPS.map(step => (
                  <th key={step.id} style={{
                    padding: '0.6rem 1px',
                    textAlign: 'center',
                    fontSize: '0.62rem', fontWeight: 600,
                    color: '#94A3B8',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{step.icon}</span>
                      <span style={{ fontSize: '0.59rem', fontWeight: 700, color: '#94A3B8' }}>{step.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {activeReports.map(report => (
                <ProjectRow
                  key={report.id}
                  report={report}
                  store={store}
                  onUpdate={handleSave}
                  onSelect={onSelectReport}
                  openPopover={openKey}
                  onOpenPopover={handleOpenPopover}
                />
              ))}
            </tbody>
          </table>

          {/* Legend bar */}
          <div style={{
            padding: '0.5rem 1rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.6rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Legende:
            </span>
            {[
              { color: '#10B981',  icon: <CheckCircle2 size={10} />, label: 'Erledigt' },
              { color: '#475569',  icon: <MinusCircle  size={10} />, label: 'Nicht nötig' },
              { color: '#3B82F6',  icon: <CalendarDays size={10} />, label: 'Termin gesetzt' },
              { color: '#F59E0B',  icon: <Clock        size={10} />, label: 'Bald fällig' },
              { color: '#EF4444',  icon: <AlertTriangle size={10} />, label: 'Überfällig' },
              { color: '#8B5CF6',  icon: <MessageSquare size={10} />, label: 'Notiz vorhanden' },
            ].map(({ color, icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.63rem', color: '#64748B' }}>
                <span style={{ color }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step popover (rendered in fixed position) ─────────────────── */}
      {popover && popoverStep && popoverSd && (
        <StepPopover
          reportId={popover.reportId}
          step={popoverStep}
          stepData={popoverSd}
          anchorRect={popover.rect}
          onSave={(data) => handleSave(popover.reportId, popover.stepId, data)}
          onClose={handleClosePopover}
        />
      )}

      <style>{`
        @keyframes wfFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wfPulse {
          0%, 100% { box-shadow: 0 0 4px #3B82F6aa; transform: scale(1); }
          50%       { box-shadow: 0 0 10px #3B82F6ff; transform: scale(1.15); }
        }
        @keyframes wfDryPulse {
          0%, 100% { box-shadow: 0 0 4px #F59E0Baa; transform: scale(1); }
          50%       { box-shadow: 0 0 10px #F59E0Bff; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
