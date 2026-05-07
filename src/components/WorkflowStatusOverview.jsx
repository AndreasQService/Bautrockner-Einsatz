import { useState, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { X, Check, Minus, CalendarDays, CheckCircle2, MinusCircle, MessageSquare, Zap, AlertTriangle, Bell, Clock, Search, MoreVertical } from "lucide-react"

// ─── Workflow Config ───────────────────────────────────────────────────────────
const STEPS = [
  { id: "meldung", label: "Eingang", icon: "📋", fixed: true, slaDays: null, from: null },
  { id: "kontakt", label: "Kontakt", icon: "📞", fixed: false, slaDays: 1, from: "meldung" },
  { id: "schadenaufnahme", label: "Aufnahme", icon: "🔍", fixed: false, slaDays: null, from: "kontakt" },
  { id: "bericht", label: "Aufn.-Bericht", icon: "📄", fixed: false, slaDays: 3, from: "schadenaufnahme" },
  { id: "leckortung", label: "Leckortung", icon: "💧", fixed: false, slaDays: 3, from: "bericht" },
  { id: "bericht_leck", label: "Leck-Bericht", icon: "📄", fixed: false, slaDays: 2, from: "leckortung" },
  { id: "trocknung", label: "Trocknung", icon: "🌬️", fixed: false, slaDays: 3, from: "bericht_leck" },
  { id: "kontrolle", label: "Kontrolle*", icon: "🔍", fixed: false, slaDays: 7, from: "trocknung" },
  { id: "instandstellung", label: "Instandst.", icon: "🔧", fixed: false, slaDays: 5, from: "kontrolle" },
  { id: "rechnung", label: "Rechnung", icon: "💰", fixed: false, slaDays: 5, from: "instandstellung" },
  { id: "abschluss", label: "Abschluss", icon: "✅", fixed: false, slaDays: 7, from: "rechnung" },
]

const STEP_IDX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]))
const STATUS_MAP = {
  "Schadenaufnahme": "schadenaufnahme", "Leckortung": "leckortung",
  "Trocknung": "trocknung", "Instandsetzung": "instandstellung",
  "Instandstellung": "instandstellung", "Abgeschlossen": "abschluss"
}
const KEY = "qtool_wf_v4"

// ─── Helpers ──────────────────────────────────────────────────────────────────
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") } catch { return {} } }
const save = d => localStorage.setItem(KEY, JSON.stringify(d))
const t0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const dFrom = ds => { if (!ds) return null; const d = new Date(ds); d.setHours(0, 0, 0, 0); return Math.ceil((d - t0()) / 86400000) }
const addD = (ds, n) => { if (!ds || !n) return null; const d = new Date(ds); if (isNaN(d)) return null; d.setDate(d.getDate() + n); return d.toISOString().split("T")[0] }
const fmt = ds => { if (!ds) return null; const d = new Date(ds); if (isNaN(d)) return null; return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)}` }
const getSd = (store, rid, sid) => store[`${rid}__${sid}`] || { status: null, date: null, note: "", installedAt: null }
const setSd = (store, rid, sid, data) => ({ ...store, [`${rid}__${sid}`]: data })
const isDone = (sd, sid) => {
  if (sd.status === "done" || sd.status === "skip") return true
  if (sid === "trocknung" && sd.installedAt) return true
  return false
}
const compDate = (store, rid, sid, rep) => {
  if (sid === "meldung") return rep.date || null
  const sd = getSd(store, rid, sid)
  if ((sd.status === "date" || sd.status === "done") && sd.date) return sd.date
  if (isDone(sd)) return new Date().toISOString().split("T")[0]
  return null
}
const getDryingStart = (r) => r.dryingStarted || (r.equipment?.length > 0 ? r.equipment.map(e => e.startDate).filter(Boolean).sort()[0] : null) || r.date
const getLastM = (r) => {
  if (!r.rooms) return null; let lat = null;
  r.rooms.forEach(rm => {
    if (rm.measurementData?.globalSettings?.date) {
      const d = new Date(rm.measurementData.globalSettings.date); d.setHours(0, 0, 0, 0);
      if (!lat || d > lat) lat = d;
    }
    (rm.measurementHistory || []).forEach(h => {
      if (h.date) {
        const d = new Date(h.date); d.setHours(0, 0, 0, 0);
        if (!lat || d > lat) lat = d;
      }
    });
  });
  return lat ? Math.floor((t0() - lat) / 86400000) : null;
}
const isDryDone = (r) => r.equipment?.length > 0 && r.equipment.every(e => e.endDate)

const getDeadline = (store, rid, step, rep) => {
  if (!step.slaDays || !step.from) return null
  const f = compDate(store, rid, step.from, rep)
  return f ? addD(f, step.slaDays) : null
}
const getActiveIdx = (rep, store) => {
  const b = STATUS_MAP[rep.status]; let idx = b ? (STEP_IDX[b] ?? 0) : 0
  for (let i = 0; i < STEPS.length; i++) if (isDone(getSd(store, rep.id, STEPS[i].id), STEPS[i].id)) idx = Math.max(idx, i + 1)
  return Math.min(idx, STEPS.length - 1)
}

// Ampellogik: 0-100% grün, 100-120% orange, >120% rot
const ampel = (days, slaDays) => {
  if (days === null || !slaDays) return "pending"
  if (days > 0) return "ok"
  const pct = Math.abs(days) / slaDays
  if (pct <= 1.2) return "warning"
  return "overdue"
}

const getStepState = (store, rep, step, si, ai) => {
  const sd = getSd(store, rep.id, step.id)
  if (step.fixed) return "done"
  if (sd.status === "skip") return "skip"
  if (isDone(sd, step.id)) return "done"
  if (si > ai) return "pending"

  if (step.id === "kontrolle") {
    // Erledigt wenn alle Geräte deinstalliert
    if (isDryDone(rep)) return "done"

    // Priorität 1: Manuelles Datum im Kontrolle-Popup
    const kDays = (sd.status === "date" && sd.date) ? (() => {
      const d = new Date(sd.date); d.setHours(0, 0, 0, 0)
      return Math.floor((t0() - d) / 86400000)
    })() : null

    // Priorität 2: Reset durch Messung
    const mDays = getLastM(rep)

    // Priorität 3: Basisdatum aus Trocknung-Popup (Installiert am)
    const sdTrocknung = getSd(store, rep.id, "trocknung")
    const installedAt = sdTrocknung.installedAt
    const iDays = (() => {
      if (!installedAt) return null
      const d = new Date(installedAt); d.setHours(0, 0, 0, 0)
      return Math.floor((t0() - d) / 86400000)
    })()

    // bDays = Tage seit letztem Ereignis (Manuell > Messung > Installation)
    let bDays = kDays
    if (bDays === null) bDays = mDays
    if (bDays === null) bDays = iDays

    if (bDays === null) return "pending"
    if (bDays >= 11) return "overdue"
    if (bDays >= 8) return "warning"
    return "ok" // 0-7 Tage
  }

  if (step.id === "trocknung") return "pending"

  // date set manually: future=green, today=warning, past=overdue/warning
  if (sd.status === "date" && sd.date) {
    const days = dFrom(sd.date)
    if (days > 0) return "done"
    if (days === 0) return "warning"
    const pct = step.slaDays ? Math.abs(days) / step.slaDays : 2
    return pct > 1.2 ? "overdue" : "warning"
  }

  if (si === ai) {
    const dl = getDeadline(store, rep.id, step, rep)
    const days = dl ? dFrom(dl) : null
    return ampel(days, step.slaDays)
  }
  const dl = getDeadline(store, rep.id, step, rep)
  const days = dl ? dFrom(dl) : null
  if (days !== null && days < 0) { const pct = Math.abs(days) / (step.slaDays || 3); return pct > 1.2 ? "overdue" : "warning" }
  return "done"
}

const STATE_STYLE = {
  done: { bg: "#10B981", border: "#10B981", icon: "✓", glow: false },
  ok: { bg: "transparent", border: "#3B82F6", icon: "", glow: true, pulse: true },
  warning: { bg: "transparent", border: "#F59E0B", icon: "!", glow: false },
  overdue: { bg: "transparent", border: "#EF4444", icon: "!", glow: false, blink: true },
  skip: { bg: "#334155", border: "#334155", icon: "−", glow: false },
  pending: { bg: "transparent", border: "#334155", icon: "", glow: false },
}

const getPriority = (rep, store) => {
  const ai = getActiveIdx(rep, store)
  for (let i = 0; i <= ai; i++) {
    const s = getStepState(store, rep, STEPS[i], i, ai)
    if (s === "overdue") return "red"
    if (s === "warning") return "orange"
  }
  return "green"
}

const getNextAction = (rep, store) => {
  const ai = getActiveIdx(rep, store)
  if (ai >= STEPS.length) return null
  const step = STEPS[ai]
  const sd = getSd(store, rep.id, step.id)
  if (isDone(sd)) return null
  // Prefer manually set date over auto-calculated SLA deadline
  const dl = sd.status === "date" && sd.date ? sd.date : getDeadline(store, rep.id, step, rep)
  const days = dl ? dFrom(dl) : null
  return { step, deadline: dl, days }
}

// ─── StepPopover ──────────────────────────────────────────────────────────────
function Popover({ rid, step, sd, onSave, onClose, rect }) {
  const [mode, setMode] = useState(sd.status || "date")
  const [date, setDate] = useState(sd.date || "")
  const [installedAt, setInstalledAt] = useState(sd.installedAt || "")
  const [note, setNote] = useState(sd.note || "")
  const ref = useRef(null)
  useState(() => {
    const hk = e => { if (e.key === "Escape") onClose() }
    const hc = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener("mousedown", hc); document.addEventListener("keydown", hk)
    return () => { document.removeEventListener("mousedown", hc); document.removeEventListener("keydown", hk) }
  }, [])
  const st = { position: "fixed", zIndex: 9999, background: "#1A2332", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "1rem", width: 240, boxShadow: "0 24px 56px rgba(0,0,0,0.55)", animation: "wfFade 0.12s ease", fontFamily: '"Segoe UI", "Roboto", Arial, sans-serif' }
  if (rect) { const wh = window.innerHeight, ww = window.innerWidth, ph = 320, pw = 248, lp = Math.min(Math.max(4, rect.left), ww - pw - 4); st[rect.bottom + ph + 8 < wh ? "top" : "top"] = rect.bottom + ph + 8 < wh ? rect.bottom + 6 : Math.max(8, rect.top - ph - 6); st.left = lp }
  const btn = (a, c) => ({ flex: 1, padding: "0.4rem", borderRadius: 8, border: `1.5px solid ${a ? c : "rgba(255,255,255,0.08)"}`, background: a ? `${c}22` : "rgba(255,255,255,0.03)", color: a ? c : "var(--text-muted, #64748B)", fontWeight: a ? 700 : 500, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 })
  return createPortal(
    <div ref={ref} style={st} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#CBD5E1" }}>{step.icon} {step.label}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 0, display: "flex" }}><X size={14} /></button>
      </div>
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem" }}>
        <button style={btn(mode === "done", "#10B981")} onClick={() => setMode("done")}><Check size={12} />Erledigt</button>
        <button style={btn(mode === "skip", "var(--text-muted, #64748B)")} onClick={() => setMode("skip")}><Minus size={12} />Entfällt</button>
        <button style={btn(mode === "date", "#3B82F6")} onClick={() => setMode("date")}><CalendarDays size={12} />Datum</button>
      </div>
      {mode === "date" && <div style={{ marginBottom: "0.65rem" }}><label style={{ fontSize: "0.68rem", color: "var(--text-muted, #64748B)", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Fälligkeit</label><input type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus style={{ width: "100%", padding: "0.4rem 0.55rem", borderRadius: 8, border: `1px solid ${date ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#0F1929", color: "white", fontSize: "0.82rem", boxSizing: "border-box", outline: "none" }} /></div>}
      {mode === "date" && step.id === "trocknung" && <div style={{ marginBottom: "0.65rem" }}><label style={{ fontSize: "0.68rem", color: "var(--text-muted, #64748B)", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Installiert am</label><input type="date" value={installedAt} onChange={e => setInstalledAt(e.target.value)} style={{ width: "100%", padding: "0.4rem 0.55rem", borderRadius: 8, border: `1px solid ${installedAt ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#0F1929", color: "white", fontSize: "0.82rem", boxSizing: "border-box", outline: "none" }} /></div>}
      <div style={{ marginBottom: "0.75rem" }}><label style={{ fontSize: "0.68rem", color: "var(--text-muted, #64748B)", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Notiz</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Kurze Notiz…" rows={2} style={{ width: "100%", padding: "0.35rem 0.55rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0F1929", color: "#CBD5E1", fontSize: "0.75rem", resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} /></div>
      <div style={{ display: "flex", gap: "0.35rem" }}>
        <button onClick={() => { onSave({ status: mode, date: mode === "date" ? date : null, note, installedAt: mode === "date" ? installedAt : null }); onClose() }} style={{ flex: 1, padding: "0.4rem", borderRadius: 8, border: "none", background: mode === "done" ? "#10B981" : mode === "skip" ? "#475569" : "#3B82F6", color: "white", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>Speichern</button>
        {sd.status && <button onClick={() => { onSave({ status: null, date: null, note: "", installedAt: null }); onClose() }} style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", fontSize: "0.75rem", cursor: "pointer" }}>×</button>}
      </div>
    </div>, document.body)
}

// ─── StepDot ──────────────────────────────────────────────────────────────────
function StepDot({ rep, store, step, i, ai, openKey, onOpen }) {
  const ref = useRef(null)
  const state = getStepState(store, rep, step, i, ai)
  const sd = getSd(store, rep.id, step.id)
  const dl = getDeadline(store, rep.id, step, rep)
  const days = dl ? dFrom(dl) : null
  const hasNote = !!sd.note
  const isOpen = openKey === `${rep.id}__${step.id}`
  // Spezialfarbe für Kontrolle* ok = grün
  const isKontrolleOk = step.id === "kontrolle" && state === "ok"
  const dotColor = (state === "done" || isKontrolleOk) ? "#10B981" : state === "ok" ? "#3B82F6" : state === "warning" ? "#F59E0B" : state === "overdue" ? "#EF4444" : state === "skip" ? "#94A3B8" : "#BAE6FD"
  const dotBg = (state === "done" || isKontrolleOk) ? "#10B981" : state === "ok" ? "rgba(59,130,246,0.15)" : state === "warning" ? "#F59E0B" : state === "overdue" ? "#EF4444" : state === "skip" ? "var(--border, #E2E8F0)" : "#F0F9FF"
  return (
    <div style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <button
          ref={ref}
          onClick={e => { if (step.fixed) return; e.stopPropagation(); const r = ref.current?.getBoundingClientRect(); onOpen(rep.id, step.id, r) }}
          title={`${step.label}${dl ? ` • fällig ${fmt(dl)}` : ""}`}
          style={{
            width: 30, height: 30, borderRadius: "50%",
            background: dotBg,
            border: `2px solid ${dotColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: step.fixed ? "default" : "pointer",
            flexShrink: 0,
            boxShadow: state === "ok" ? `0 0 8px ${dotColor}88` : state === "overdue" && Math.abs(days || 0) / step.slaDays > 1.5 ? `0 0 10px ${dotColor}cc` : "none",
            outline: isOpen ? `2px solid ${dotColor}44` : "none",
            outlineOffset: 2,
            transition: "all 0.15s",
            animation: state === "overdue" && Math.abs(days || 0) / step.slaDays > 1.5 ? "wfBlink 1.2s ease-in-out infinite" : "none",
            position: "relative",
          }}>
          {state === "done" && <Check size={14} color="white" strokeWidth={3} />}
          {state === "skip" && <Minus size={13} color="var(--text-muted, #64748B)" strokeWidth={2.5} />}
          {(state === "warning" || state === "overdue") && <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "white" }}>!</span>}
          {state === "ok" && <div style={{ width: 9, height: 9, borderRadius: "50%", background: isKontrolleOk ? "#10B981" : "#3B82F6", boxShadow: isKontrolleOk ? `0 0 7px #10B981` : "0 0 7px #3B82F6", animation: "wfPulse 2s ease-in-out infinite" }} />}
        </button>
        <span style={{ fontSize: "0.6rem", color: state === "pending" ? "#94A3B8" : state === "done" ? "#10B981" : dotColor, fontWeight: state === "pending" ? 500 : 700, marginTop: 3, whiteSpace: "nowrap", lineHeight: 1, textAlign: "center" }}>{step.label}</span>
        {hasNote && <span style={{ fontSize: "0.6rem", color: "var(--text-muted, #6B7280)", marginTop: 2, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 2 }}>📝 Notiz</span>}
      </div>
      {i < STEPS.length - 1 && (
        (() => {
          const nextStep = STEPS[i + 1]
          const nextState = getStepState(store, rep, nextStep, i + 1, ai)
          let bg = i < ai ? "#10B981" : "var(--border, #E2E8F0)"

          if (nextStep.id === "kontrolle" && i < ai) {
            if (nextState === "warning") bg = "#F59E0B"
            else if (nextState === "overdue") bg = "#EF4444"
            else if (nextState === "ok") bg = "#10B981"
            else if (nextState === "pending") bg = "var(--border, #E2E8F0)"
          } else if (i === ai - 1) {
            bg = "linear-gradient(90deg,#10B981,var(--border, #E2E8F0))"
          }

          return <div style={{ flex: 1, height: 2, background: bg, margin: "0 2px", marginBottom: 14, minWidth: 4 }} />
        })()
      )}
    </div>
  )
}

// ─── WorkflowTimeline ─────────────────────────────────────────────────────────
function WorkflowTimeline({ rep, store, openKey, onOpen }) {
  const ai = getActiveIdx(rep, store)
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "6px 0" }}>
      {STEPS.map((step, i) => (
        <StepDot key={step.id} rep={rep} store={store} step={step} i={i} ai={ai} openKey={openKey} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ─── DeadlineBadge ────────────────────────────────────────────────────────────
function DeadlineBadge({ days, slaDays }) {
  if (days === null) return null
  const pct = slaDays ? Math.abs(days) / slaDays : 0
  let color, bg, txt
  if (days > 0) { color = "#10B981"; bg = "rgba(16,185,129,0.1)"; txt = `in ${days}T` }
  else if (pct <= 1.2) { color = "#F59E0B"; bg = "rgba(245,158,11,0.12)"; txt = days === 0 ? "heute" : `+${Math.abs(days)}T` }
  else { color = "#EF4444"; bg = "rgba(239,68,68,0.12)"; txt = `+${Math.abs(days)}T` }
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 8, background: bg, color, fontSize: "0.65rem", fontWeight: 700, whiteSpace: "nowrap" }}><Clock size={9} />{txt}</span>
}

// ─── NextActionCell ───────────────────────────────────────────────────────────
function NextActionCell({ rep, store }) {
  const next = getNextAction(rep, store)
  if (!next) return <span style={{ color: "#9CA3AF", fontSize: "0.78rem" }}>—</span>
  const { step, deadline, days } = next
  
  const nextStepIndex = STEPS.findIndex(s => s.id === step.id)
  const ai = getActiveIdx(rep, store)
  const state = getStepState(store, rep, step, nextStepIndex, ai)
  
  const color = (state === "done" || state === "ok") ? "#10B981" 
              : state === "warning" ? "#F59E0B" 
              : state === "overdue" ? "#EF4444" 
              : "var(--text-muted, #64748B)"

  const actions = {
    meldung: "Eingang erfassen", kontakt: "Kontakt aufnehmen", schadenaufnahme: "Aufnahme durchführen",
    bericht: "Bericht erstellen", leckortung: "Leckortung planen", trocknung: "Trocknung starten",
    kontrolle: "Messung durchführen",
    instandstellung: "Instandstellung beauftragen", rechnung: "Rechnung erstellen", abschluss: "Abschluss",
  }
  const label = actions[step.id] || step.label
  return (
    <div>
      <div style={{ 
        fontSize: "13px", 
        fontWeight: 700, 
        color, 
        fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
        opacity: 1,
        letterSpacing: "0.01em",
        lineHeight: 1.3, 
        marginBottom: 3 
      }}>{label}</div>
      {deadline && <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "12px", color: "var(--text-muted, #6B7280)" }}><CalendarDays size={10} />Fällig: {fmt(deadline)}</div>}
      <DeadlineBadge days={days} slaDays={step.slaDays} />
    </div>
  )
}

// ─── ProjectRow ───────────────────────────────────────────────────────────────
function ProjectRow({ rep, store, onSave, onSelect, openKey, onOpen }) {
  const pri = getPriority(rep, store)
  const isUUID = s => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s || "")
  const street = rep.street || (rep.address ? rep.address.split(",")[0].trim() : null) || rep.projectTitle || "—"
  const city = [rep.zip, rep.city].filter(Boolean).join(" ") || null
  const projNum = rep.projectNumber && !isUUID(rep.projectNumber) ? rep.projectNumber : null
  const client = rep.client || null
  const sub = [projNum, client].filter(Boolean).join(" · ")
  const priColor = pri === "red" ? "#EF4444" : pri === "orange" ? "#F59E0B" : "#10B981"
  const priIcon = pri === "green" ? "✓" : "!"
  const ai = getActiveIdx(rep, store)
  const trocknungActive = STEPS[ai]?.id === "trocknung"

  return (
    <tr
      onClick={() => onSelect(rep)}
      style={{ cursor: "pointer", borderBottom: "1px solid var(--border, #E5E7EB)", transition: "background 0.1s", minHeight: 80 }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--color-row-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {/* Status/Priorität */}
      <td style={{ padding: "16px 12px", textAlign: "center", verticalAlign: "middle", width: 46 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${priColor}18`, border: `2px solid ${priColor}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: priColor, fontWeight: 900, fontSize: pri === "green" ? "0.65rem" : "0.8rem" }}>{priIcon}</span>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{pri === "red" ? "Offen" : pri === "orange" ? "Offen" : "Aktiv"}</span>
        </div>
      </td>
      {/* Projekt/Objekt */}
      <td style={{ padding: "16px 12px", verticalAlign: "middle", minWidth: 170, maxWidth: 200 }}>
        {rep.projectNumber && <div style={{ fontSize: "15px", color: "var(--text-main, #111827)", fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.25, marginBottom: 2 }}>{rep.projectNumber}</div>}
        <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-main, #111827)", lineHeight: 1.25, marginBottom: 2 }}>{street}{city ? `, ${city}` : ''}</div>
        {rep.description && <div style={{ fontSize: "14px", color: "var(--text-main, #374151)", marginTop: 3, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{rep.description}</div>}
      </td>

      {/* Start */}
      <td style={{ padding: "16px 12px", verticalAlign: "middle", width: 60, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
          <CalendarDays size={10} color="#475569" />
          <span style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)", fontWeight: 400 }}>{fmt(rep.date) || "—"}</span>
        </div>
      </td>
      {/* Workflow Timeline */}
      <td style={{ padding: "16px 12px", verticalAlign: "middle" }} onClick={e => e.stopPropagation()}>
        <WorkflowTimeline rep={rep} store={store} openKey={openKey} onOpen={onOpen} />
      </td>
      {/* Nächste Aktion */}
      <td style={{ padding: "16px 12px", verticalAlign: "middle", width: 170 }}>
        <NextActionCell rep={rep} store={store} />
      </td>
      {/* Tage offen */}
      <td style={{ padding: "16px 12px", textAlign: "center", verticalAlign: "middle", width: 68 }}>
        {(() => {
          const na = getNextAction(rep, store)
          if (!na || na.days === null) return <span style={{ color: "#334155", fontSize: "0.75rem" }}>—</span>
          const d = na.days
          const color = d < 0 ? "#EF4444" : d === 0 ? "#3B82F6" : d <= 2 ? "#F59E0B" : "#10B981"
          const label = d < 0 ? "überfällig" : d === 0 ? "fällig heute" : d <= 2 ? "bald fällig" : "im Plan"
          const sign = d < 0 ? "+" : ""
          return <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color, lineHeight: 1 }}>{sign}{d < 0 ? Math.abs(d) : d}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)", marginTop: 2, whiteSpace: "nowrap" }}>{label}</div>
          </div>
        })()}
      </td>
    </tr>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function WorkflowStatusOverview({ reports, onSelectReport, currentUser, users = [] }) {
  const [store, setStore] = useState(load)
  const [tab, setTab] = useState("alle")
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const [popover, setPopover] = useState(null)
  const [userFilter, setUserFilter] = useState(currentUser?.name || "")

  const allUsers = useMemo(() => {
    const names = users.map(u => u.name).filter(Boolean)
    return ["alle", ...names]
  }, [users])

  const handleSave = useCallback((rid, sid, data) => {
    setStore(prev => { const n = setSd(prev, rid, sid, data); save(n); return n })
  }, [])
  const handleOpen = useCallback((rid, sid, rect) => { setPopover(prev => prev?.rid === rid && prev?.sid === sid ? null : { rid, sid, rect }) }, [])
  const handleClose = useCallback(() => setPopover(null), [])

  const allActive = useMemo(() => reports.filter(r => r.status !== "Abgeschlossen" && (!userFilter || userFilter === "alle" || r.assignedTo === userFilter)).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [reports, userFilter])
  const archived = useMemo(() => reports.filter(r => r.status === "Abgeschlossen" && (!userFilter || userFilter === "alle" || r.assignedTo === userFilter)), [reports, userFilter])
  const overdue = useMemo(() => allActive.filter(r => getPriority(r, store) === "red"), [allActive, store])
  const trocknungList = useMemo(() => allActive.filter(r => { const ai = getActiveIdx(r, store); return STEPS[ai]?.id === "trocknung" }), [allActive, store])
  const aktiv = useMemo(() => allActive.filter(r => getPriority(r, store) !== "red"), [allActive, store])

  const baseList = tab === "archiv" ? archived : tab === "ueberfaellig" ? overdue : tab === "trocknung" ? trocknungList : tab === "aktiv" ? aktiv : allActive
  const filtered = useMemo(() => {
    if (!search.trim()) return baseList
    const q = search.toLowerCase()
    return baseList.filter(r => [r.street, r.address, r.city, r.zip, r.projectNumber, r.client, r.projectTitle].some(v => v?.toLowerCase().includes(q)))
  }, [baseList, search])

  const tabs = [
    { id: "alle", label: "Alle Projekte", count: allActive.length, color: null },
    { id: "ueberfaellig", label: "Überfällig", count: overdue.length, color: "#EF4444" },
    { id: "trocknung", label: "Trocknung", count: trocknungList.length, color: "#3B82F6" },
    { id: "aktiv", label: "Aktiv", count: aktiv.length, color: "#10B981" },
    { id: "archiv", label: "Archiv", count: archived.length, color: "var(--text-muted, #64748B)" },
  ]

  const openKey = popover ? `${popover.rid}__${popover.sid}` : null
  const popStep = popover ? STEPS.find(s => s.id === popover.sid) : null
  const popSd = popover ? getSd(store, popover.rid, popover.sid) : null

  if (reports.length === 0) return null

  return (
    <div style={{ fontFamily: '"Segoe UI", "Roboto", Arial, sans-serif', marginBottom: "1.5rem", background: "var(--color-surface, #FFFFFF)", borderRadius: 12, border: "1px solid var(--color-border,rgba(255,255,255,0.08))", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "0.75rem 1rem 0", borderBottom: "1px solid var(--color-border,rgba(255,255,255,0.08))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }} onClick={() => setCollapsed(c => !c)}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)" }}>Workflow-Übersicht</h2>
            <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 400 }}>{allActive.length} aktive Projekte</span>
            {overdue.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 8, background: "rgba(239,68,68,0.12)", color: "#EF4444", fontSize: "0.68rem", fontWeight: 700, border: "1px solid rgba(239,68,68,0.2)" }}><AlertTriangle size={10} />{overdue.length} überfällig</span>}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {/* User Filter Dropdown */}
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} onClick={e => e.stopPropagation()} style={{ padding: "0.3rem 0.5rem", borderRadius: 8, border: "1px solid var(--color-border,rgba(255,255,255,0.08))", background: "var(--color-surface-alt,#1E293B)", color: "var(--text-main)", fontSize: "0.75rem", outline: "none", cursor: "pointer", maxWidth: 160 }}>
              {allUsers.map(u => <option key={u} value={u}>{u === "alle" ? "Alle Mitarbeiter" : u}</option>)}
            </select>
            {/* Suche */}
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche…" onClick={e => e.stopPropagation()} style={{ paddingLeft: 26, paddingRight: 10, paddingTop: "0.3rem", paddingBottom: "0.3rem", borderRadius: 8, border: "1px solid var(--color-border,rgba(255,255,255,0.08))", background: "var(--color-surface-alt,#1E293B)", color: "var(--text-main)", fontSize: "0.75rem", width: 160, outline: "none" }} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.2rem" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "0.35rem 0.65rem", borderRadius: "6px 6px 0 0", border: "1px solid var(--color-border,rgba(255,255,255,0.08))", borderBottom: tab === t.id ? "1px solid var(--color-surface,#0F172A)" : "1px solid var(--color-border,rgba(255,255,255,0.08))", background: tab === t.id ? "var(--color-surface,#0F172A)" : "var(--color-surface-alt,#1E293B)", color: tab === t.id ? "var(--text-main)" : "var(--text-muted, #64748B)", fontWeight: tab === t.id ? 700 : 400, fontSize: "0.72rem", cursor: "pointer", transition: "all 0.1s" }}>
              {t.label}{" "}
              <span style={{ padding: "0px 5px", borderRadius: 8, background: tab === t.id ? (t.color || "#3B82F6") + "22" : "rgba(255,255,255,0.05)", color: tab === t.id ? (t.color || "#94A3B8") : "#475569", fontSize: "0.68rem", fontWeight: 700 }}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {!collapsed && (
        <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
          <table style={{ minWidth: 900, borderCollapse: "collapse", width: "100%" }}>
            <thead>
              {/* Row 1: Column labels */}
              <tr style={{ position: "sticky", top: 0, zIndex: 21, background: "var(--background, #F8FAFC)", borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.08))", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                <th style={{ padding: "0.6rem 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em", width: 46, background: "var(--background, #F8FAFC)", opacity: 1 }}>Status</th>
                <th style={{ padding: "0.6rem 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em", width: 170, background: "var(--background, #F8FAFC)", opacity: 1 }}>Objekt / Projekt</th>
                <th style={{ padding: "0.6rem 12px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em", width: 56, background: "var(--background, #F8FAFC)", opacity: 1 }}>Start</th>
                <th style={{ padding: "0.6rem 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--background, #F8FAFC)", opacity: 1 }}>
                  Workflow <span style={{ fontWeight: 500, color: "#475569", fontSize: "11px", textTransform: "none", opacity: 1 }}>— klicken zum setzen</span>
                </th>
                <th colSpan={2} style={{ padding: "0.6rem 12px", background: "var(--background, #F8FAFC)", borderBottom: "none" }} />
              </tr>
              {/* Row 2: Workflow step names aligned under timeline */}
              <tr style={{ position: "sticky", top: 31, zIndex: 20, background: "var(--color-surface-alt, #F1F5F9)", borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.08))" }}>
                <td colSpan={3} style={{ padding: "0.4rem 0 0.5rem 0", background: "var(--color-surface-alt, #F1F5F9)" }} />
                <td style={{ padding: "0.4rem 8px 0.5rem", background: "var(--color-surface-alt, #F1F5F9)" }}>
                  <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    {STEPS.map((step, i) => (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", textAlign: "center", lineHeight: 1, opacity: 1 }}>{step.label}</span>
                        </div>
                        {i < STEPS.length - 1 && <div style={{ flex: 1, minWidth: 4 }} />}
                      </div>
                    ))}
                  </div>
                </td>
                <th style={{ padding: "0.4rem 12px 0.5rem", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.02em", width: 160, background: "var(--color-surface-alt, #F1F5F9)" }}>Nächste Aktion</th>
                <th style={{ padding: "0.4rem 12px 0.5rem", textAlign: "center", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.02em", width: 56, background: "var(--color-surface-alt, #F1F5F9)" }}>Tage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "#334155", fontSize: "0.85rem" }}>Keine Projekte</td></tr>
                : filtered.map(r => <ProjectRow key={r.id} rep={r} store={store} onSave={handleSave} onSelect={onSelectReport} openKey={openKey} onOpen={handleOpen} />)
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div style={{ padding: "0.4rem 1rem", borderTop: "1px solid var(--color-border,rgba(255,255,255,0.08))", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.6rem", color: "#334155", fontWeight: 700, textTransform: "uppercase" }}>Legende:</span>
            {[{ color: "#10B981", label: "Erledigt" }, { color: "#3B82F6", label: "Aktiv" }, { color: "#F59E0B", label: "Warnung" }, { color: "#EF4444", label: "Überfällig" }, { color: "#475569", label: "Entfällt" }].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, opacity: 0.8 }} />
                <span style={{ fontSize: "0.63rem", color: "#475569" }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "1.25rem" }}>
            {[{ l: "Überfällig", c: overdue.length, col: "#EF4444" }, { l: "Trocknung", c: trocknungList.length, col: "#3B82F6" }, { l: "Aktiv", c: aktiv.length, col: "#10B981" }].map(({ l, c, col }) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: col, lineHeight: 1 }}>{c}</div>
                <div style={{ fontSize: "0.6rem", color: "#475569" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {popover && popStep && popSd && (
        <Popover key={openKey} rid={popover.rid} step={popStep} sd={popSd} rect={popover.rect}
          onSave={data => handleSave(popover.rid, popover.sid, data)} onClose={handleClose} />
      )}

      <style>{`
        @keyframes wfFade{from{opacity:0;transform:translateY(-5px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes wfPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.7}}
        @keyframes wfBlink{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </div>
  )
}
