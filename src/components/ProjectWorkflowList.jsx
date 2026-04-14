/**
 * ProjectWorkflowList.jsx
 * Responsive Projektliste mit Workflow-Schrittübersicht.
 * Vollständig mit Tailwind CSS — Inline-Styles nur für dynamische Farbwerte.
 * Desktop (≥ md): Adresse links + 9 Schritte über Restbreite.
 * Mobile: gestapelt, Workflow-Leiste horizontal scrollbar.
 */

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Schritt-Definitionen ──────────────────────────────────────────────────────

const STEPS = [
  { key: 'eingang',         label: 'Eingang',      short: 'EIN' },
  { key: 'kontakt',         label: 'Kontakt',       short: 'KON' },
  { key: 'schadenaufnahme', label: 'Aufnahme',      short: 'AUF' },
  { key: 'leckortung',      label: 'Leckortung',    short: 'LEK' },
  { key: 'bericht',         label: 'Bericht',       short: 'BER' },
  { key: 'trocknung',       label: 'Trocknung',     short: 'TRO' },
  { key: 'instandstellung', label: 'Instandst.',    short: 'INS' },
  { key: 'rechnung',        label: 'Rechnung',      short: 'REC' },
  { key: 'abschluss',       label: 'Abschluss',     short: 'ABS' },
]

// ─── Beispieldaten ─────────────────────────────────────────────────────────────

function s(overrides = {}) {
  return { status: 'open', days: null, note: '', dueState: 'normal', ...overrides }
}

const SAMPLE = [
  {
    id: 'p1', street: 'Rütiwisstrasse 22', zip: '8500', city: 'Frauenfeld', client: 'Muster Verwaltung AG',
    workflowSteps: {
      eingang:         s({ status: 'done',       days: 14 }),
      kontakt:         s({ status: 'done',       days: 13 }),
      schadenaufnahme: s({ status: 'done',       days: 10 }),
      leckortung:      s({ status: 'done',       days: 8  }),
      bericht:         s({ status: 'done',       days: 6,  note: 'Bericht per Mail versandt' }),
      trocknung:       s({ status: 'open',       days: 3,  dueState: 'warning' }),
      instandstellung: s(),
      rechnung:        s(),
      abschluss:       s(),
    },
  },
  {
    id: 'p2', street: 'Zelgweg 19',  zip: '8370', city: 'Sirnach', client: 'Weber Immobilien GmbH',
    workflowSteps: {
      eingang:         s({ status: 'done',       days: 22 }),
      kontakt:         s({ status: 'done',       days: 20 }),
      schadenaufnahme: s({ status: 'done',       days: 18 }),
      leckortung:      s({ status: 'not_needed' }),
      bericht:         s({ status: 'done',       days: 15 }),
      trocknung:       s({ status: 'open',       days: 1,  dueState: 'danger', note: 'Geräte noch vor Ort!' }),
      instandstellung: s(),
      rechnung:        s(),
      abschluss:       s(),
    },
  },
  {
    id: 'p3', street: 'Hauptstrasse 4', zip: '9300', city: 'Wittenbach', client: 'Privat',
    workflowSteps: {
      eingang:         s({ status: 'done',       days: 5 }),
      kontakt:         s({ status: 'done',       days: 4 }),
      schadenaufnahme: s({ status: 'open',       days: 2, dueState: 'warning' }),
      leckortung:      s(),
      bericht:         s(),
      trocknung:       s(),
      instandstellung: s(),
      rechnung:        s(),
      abschluss:       s(),
    },
  },
]

// ─── Chip-Klassen (vollständige Strings → werden von Tailwind JIT gescannt) ────

// WICHTIG: Diese Strings dürfen NICHT dynamisch zusammengebaut werden,
// sonst scannt Tailwind sie nicht.

const CHIP = {
  done:         'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400',
  not_needed:   'bg-sky-500/10    border border-sky-400/25      text-sky-400 opacity-70',
  open_normal:  'bg-rose-500/10   border border-rose-500/20     text-rose-400',
  open_warning: 'bg-amber-500/15  border border-amber-500/35   text-amber-400',
  open_danger:  'bg-red-500/15    border border-red-500/35     text-red-400',
}

function chipCls(status, dueState) {
  if (status === 'done')       return CHIP.done
  if (status === 'not_needed') return CHIP.not_needed
  if (dueState === 'danger')   return CHIP.open_danger
  if (dueState === 'warning')  return CHIP.open_warning
  return CHIP.open_normal
}

// Status-Button Klassen im Popover
const SB = {
  done_on:        'border-emerald-400 bg-emerald-400/20 text-emerald-400',
  done_off:       'border-white/10 text-slate-500 hover:border-white/20',
  not_needed_on:  'border-sky-400 bg-sky-400/20 text-sky-400',
  not_needed_off: 'border-white/10 text-slate-500 hover:border-white/20',
  open_on:        'border-rose-400 bg-rose-400/10 text-rose-400',
  open_off:       'border-white/10 text-slate-500 hover:border-white/20',
}

// ─── WorkflowStepChip ──────────────────────────────────────────────────────────

function WorkflowStepChip({ stepDef, stepData, isDesktop, onChange }) {
  const [open, setOpen] = useState(false)
  const [editNote, setEditNote] = useState('')
  const popRef = useRef(null)
  const btnRef = useRef(null)

  // Popover per Aussenklick schliessen
  useEffect(() => {
    if (!open) return
    const handle = e => {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [open])

  function openPop() { setEditNote(stepData.note || ''); setOpen(o => !o) }
  function applyStatus(s) { onChange({ ...stepData, status: s, note: editNote }); setOpen(false) }
  function saveNote()     { onChange({ ...stepData, note: editNote }); setOpen(false) }

  const cls = chipCls(stepData.status, stepData.dueState)
  const { status, days, note, dueState } = stepData

  return (
    <div className="relative flex-1">
      {/* ── Chip ── */}
      <button
        ref={btnRef}
        onClick={openPop}
        title={`${stepDef.label}${note ? ` — ${note}` : ''}`}
        className={[
          cls,
          'w-full rounded-md cursor-pointer transition-all duration-100',
          'flex flex-col items-center justify-center gap-px',
          'active:scale-95 select-none',
          isDesktop ? 'h-9 text-[0.7rem]' : 'h-11 text-xs',
        ].join(' ')}
      >
        {/* Hauptinhalt */}
        {status === 'done' && (
          <span className={isDesktop ? 'text-sm' : 'text-base'}>✓</span>
        )}
        {status === 'not_needed' && (
          <span className={`line-through ${isDesktop ? 'text-sm' : 'text-base'}`}>–</span>
        )}
        {status === 'open' && days != null && (
          <span className={`font-extrabold tracking-tight leading-none ${isDesktop ? 'text-[0.8rem]' : 'text-base'}`}>
            {days}T
          </span>
        )}
        {status === 'open' && days == null && (
          <span className="opacity-30 text-xs leading-none">·</span>
        )}

        {/* Notiz-Badge */}
        {note && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_4px_rgba(139,92,246,0.7)]" />
        )}
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          ref={popRef}
          className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 w-52 rounded-xl border border-white/10 bg-slate-800 shadow-2xl p-3 flex flex-col gap-2"
          onClick={e => e.stopPropagation()}
        >
          {/* Titel */}
          <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">
            {stepDef.label}
          </div>

          {/* Status-Buttons */}
          <div className="flex gap-1">
            {[
              { s: 'done',       label: 'Erledigt',    on: SB.done_on,       off: SB.done_off       },
              { s: 'not_needed', label: 'Nicht nötig', on: SB.not_needed_on, off: SB.not_needed_off },
              { s: 'open',       label: 'Offen',       on: SB.open_on,       off: SB.open_off       },
            ].map(({ s, label, on, off }) => (
              <button
                key={s}
                onClick={() => applyStatus(s)}
                className={[
                  'flex-1 py-1.5 text-[0.6rem] font-bold rounded border cursor-pointer transition-all min-h-[34px]',
                  status === s ? on : off,
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Notiz */}
          <textarea
            value={editNote}
            onChange={e => setEditNote(e.target.value)}
            placeholder="Notiz..."
            rows={2}
            className="w-full resize-none text-[0.75rem] rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white placeholder-slate-500 outline-none focus:border-sky-500/50"
          />

          {/* Speichern */}
          <button
            onClick={saveNote}
            className="w-full py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[0.72rem] font-bold cursor-pointer transition-colors min-h-[32px]"
          >
            Speichern
          </button>
        </div>
      )}
    </div>
  )
}

// ─── ProjectWorkflowRow ────────────────────────────────────────────────────────

function ProjectWorkflowRow({ project, isDesktop, onStepChange }) {
  const addr1 = project.street
  const addr2 = [project.zip, project.city].filter(Boolean).join(' ')
  const sub   = project.client || ''

  if (isDesktop) {
    return (
      <div className="flex items-stretch border-b border-white/[0.05] hover:bg-white/[0.025] transition-colors">
        {/* Adresse */}
        <div className="shrink-0 w-52 px-3 py-1.5 flex flex-col justify-center border-r border-white/[0.05]">
          <span className="font-bold text-[0.78rem] text-slate-100 leading-snug break-words">{addr1}</span>
          {addr2 && <span className="text-[0.65rem] text-slate-400 mt-0.5">{addr2}</span>}
          {sub   && <span className="text-[0.6rem]  text-slate-500 mt-0.5">{sub}</span>}
        </div>

        {/* Workflow */}
        <div className="flex-1 flex items-center gap-0.5 px-1.5 py-1.5 min-w-0">
          {STEPS.map(step => (
            <WorkflowStepChip
              key={step.key}
              stepDef={step}
              stepData={project.workflowSteps[step.key]}
              isDesktop={true}
              onChange={data => onStepChange(project.id, step.key, data)}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Mobile ──
  return (
    <div className="border-b border-white/[0.07] px-3 py-2.5">
      {/* Adresse */}
      <div className="mb-2">
        <div className="font-bold text-[0.88rem] text-slate-100 leading-snug break-words">{addr1}</div>
        {addr2 && <div className="text-[0.72rem] text-slate-400 mt-0.5">{addr2}</div>}
        {sub   && <div className="text-[0.65rem] text-slate-500 mt-0.5">{sub}</div>}
      </div>

      {/* Workflow — horizontaler Scroll nur hier, NICHT an der Seite */}
      <div className="flex gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] pb-0.5">
        {STEPS.map(step => (
          <div key={step.key} className="shrink-0 w-12 flex flex-col items-center">
            <WorkflowStepChip
              stepDef={step}
              stepData={project.workflowSteps[step.key]}
              isDesktop={false}
              onChange={data => onStepChange(project.id, step.key, data)}
            />
            <span className="text-[0.52rem] text-slate-600 mt-0.5 leading-none">{step.short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ProjectWorkflowList ───────────────────────────────────────────────────────

export default function ProjectWorkflowList({ reports }) {
  const containerRef = useRef(null)
  const [isDesktop, setIsDesktop] = useState(true)
  const [projects, setProjects] = useState(() => reports || SAMPLE)

  // Responsive: Container-Breite beobachten (kein Viewport!)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setIsDesktop(entries[0].contentRect.width >= 700)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleStepChange = useCallback((pid, key, data) => {
    setProjects(prev => prev.map(p =>
      p.id === pid ? { ...p, workflowSteps: { ...p.workflowSteps, [key]: data } } : p
    ))
  }, [])

  return (
    <div
      ref={containerRef}
      className="card mb-8 !p-0 overflow-hidden border-t-4 border-t-sky-500"
    >
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 bg-slate-900/95 border-b-2 border-b-white/[0.09] backdrop-blur-sm">
        {isDesktop ? (
          <div className="flex items-stretch">
            {/* Adress-Kopf */}
            <div className="shrink-0 w-52 px-3 py-2 text-[0.58rem] font-bold text-slate-500 uppercase tracking-widest border-r border-white/[0.07] flex items-center">
              Projekt / Objekt
            </div>
            {/* Schritt-Köpfe */}
            <div className="flex-1 flex px-1.5 gap-0.5">
              {STEPS.map(step => (
                <div key={step.key} className="flex-1 py-2 text-center text-[0.57rem] font-bold text-slate-500 uppercase tracking-tight truncate">
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[0.72rem] font-bold text-slate-400 uppercase tracking-wider">
              Projekte / Workflow
            </span>
            <span className="text-[0.62rem] text-slate-600">{projects.length} aktiv</span>
          </div>
        )}
      </div>

      {/* ── Projektzeilen ── */}
      <div>
        {projects.map(p => (
          <ProjectWorkflowRow
            key={p.id}
            project={p}
            isDesktop={isDesktop}
            onStepChange={handleStepChange}
          />
        ))}
        {projects.length === 0 && (
          <div className="py-8 text-center text-slate-600 text-sm italic">
            Keine aktiven Projekte
          </div>
        )}
      </div>

      {/* ── Legende (nur Desktop) ── */}
      {isDesktop && (
        <div className="flex flex-wrap gap-4 px-3 py-1.5 border-t border-white/[0.05] bg-black/15">
          {[
            { cls: 'bg-emerald-400',  label: 'Erledigt'    },
            { cls: 'bg-sky-400',      label: 'Nicht nötig' },
            { cls: 'bg-rose-400',     label: 'Offen'       },
            { cls: 'bg-amber-400',    label: 'Bald fällig' },
            { cls: 'bg-red-400',      label: 'Überfällig'  },
            { cls: 'bg-violet-500',   label: 'Notiz'       },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${cls}`} />
              <span className="text-[0.6rem] text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
