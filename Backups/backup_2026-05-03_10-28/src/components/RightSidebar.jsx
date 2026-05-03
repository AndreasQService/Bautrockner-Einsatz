import { useState, useMemo } from "react"
import { CalendarDays, ChevronRight, AlertTriangle, Clock, BarChart2, TrendingUp } from "lucide-react"

const fmt = ds => { if(!ds) return "—"; const d=new Date(ds); if(isNaN(d)) return "—"; return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(-2)}` }
const t0 = () => { const d=new Date(); d.setHours(0,0,0,0); return d }
const dFrom = ds => { if(!ds) return null; const d=new Date(ds); d.setHours(0,0,0,0); return Math.ceil((d-t0())/86400000) }

function KpiCard({label,value,color,sub}) {
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"0.6rem 0.75rem",display:"flex",flexDirection:"column",gap:2}}>
      <div style={{fontSize:"1.4rem",fontWeight:800,color:color||"#CBD5E1",lineHeight:1}}>{value}</div>
      <div style={{fontSize:"0.68rem",color:"#64748B",fontWeight:600}}>{label}</div>
      {sub&&<div style={{fontSize:"0.6rem",color:"#334155"}}>{sub}</div>}
    </div>
  )
}

export default function RightSidebar({reports,selectedReport,onSelectReport}) {
  const active=reports.filter(r=>r.status!=="Abgeschlossen")
  const overdue=active.filter(r=>r.status==="Leckortung"||r.status==="Bericht")
  const trocknung=active.filter(r=>r.status==="Trocknung")
  const todayStr=new Date().toISOString().split("T")[0]
  const avgDays=useMemo(()=>{
    const closed=reports.filter(r=>r.status==="Abgeschlossen"&&r.date)
    if(!closed.length) return null
    const sum=closed.reduce((a,r)=>{ const d=-dFrom(r.date)||0; return a+d },0)
    return Math.round(sum/closed.length)
  },[reports])

  const sel=selectedReport

  return (
    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:"0.75rem",fontSize:"0.78rem"}}>

      {/* DETAILS */}
      <div style={{background:"var(--color-surface,#0F172A)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"0.6rem 0.75rem",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,fontSize:"0.72rem",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Details anzeigen</span>
        </div>
        <div style={{padding:"0.75rem"}}>
          {!sel?(
            <div style={{color:"#334155",fontSize:"0.75rem",textAlign:"center",padding:"0.5rem 0"}}>
              <div style={{fontSize:"1.5rem",marginBottom:4}}>📋</div>
              Projekt auswählen
              <div style={{fontSize:"0.65rem",color:"#1E293B",marginTop:4}}>Wähle ein Projekt in der Liste, um Details anzuzeigen.</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:"0.45rem"}}>
              <div style={{fontWeight:800,fontSize:"0.92rem",color:"#F1F5F9",lineHeight:1.25}}>
                {sel.street||(sel.address?sel.address.split(",")[0]:sel.projectTitle||"—")}
              </div>
              {sel.city&&<div style={{fontSize:"0.72rem",color:"#64748B"}}>{sel.zip} {sel.city}</div>}
              {[
                {l:"Verwaltung",v:sel.client},
                {l:"Projekt-Nr.",v:sel.projectNumber},
                {l:"Verantwortlich",v:sel.assignedTo},
                {l:"Start",v:fmt(sel.date)},
                {l:"Status",v:sel.status},
              ].filter(x=>x.v).map(({l,v})=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",gap:"0.5rem"}}>
                  <span style={{color:"#475569",fontSize:"0.68rem",flexShrink:0}}>{l}</span>
                  <span style={{color:"#CBD5E1",fontSize:"0.72rem",fontWeight:600,textAlign:"right"}}>{v}</span>
                </div>
              ))}
              <button onClick={()=>onSelectReport(sel)} style={{marginTop:4,padding:"0.4rem 0.6rem",borderRadius:8,border:"none",background:"rgba(59,130,246,0.15)",color:"#3B82F6",fontWeight:700,fontSize:"0.72rem",cursor:"pointer",textAlign:"center"}}>
                Projekt öffnen →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PRIORITÄTEN */}
      <div style={{background:"var(--color-surface,#0F172A)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"0.6rem 0.75rem",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <span style={{fontWeight:700,fontSize:"0.72rem",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Prioritäten</span>
        </div>
        <div style={{padding:"0.5rem 0.75rem",display:"flex",flexDirection:"column",gap:"0.3rem"}}>
          {[
            {label:"Überfällige Projekte",count:overdue.length,color:"#EF4444",icon:"🔴"},
            {label:"Heute fällig",count:active.filter(r=>dFrom(r.date)===0).length,color:"#F59E0B",icon:"🟡"},
            {label:"Diese Woche fällig",count:active.filter(r=>{const d=dFrom(r.date);return d!==null&&d<=7&&d>=0}).length,color:"#3B82F6",icon:"🔵"},
            {label:"Trocknungen aktiv",count:trocknung.length,color:"#10B981",icon:"🟢"},
          ].map(({label,count,color,icon})=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.3rem 0"}}>
              <span style={{color:"#94A3B8",fontSize:"0.73rem"}}>{icon} {label}</span>
              <span style={{fontWeight:800,fontSize:"0.85rem",color}}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* HEUTIGE TERMINE */}
      <div style={{background:"var(--color-surface,#0F172A)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"0.6rem 0.75rem",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <span style={{fontWeight:700,fontSize:"0.72rem",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Heutige Termine</span>
        </div>
        <div style={{padding:"0.5rem 0.75rem",display:"flex",flexDirection:"column",gap:"0.3rem"}}>
          {active.filter(r=>r.date&&dFrom(r.date)===0).slice(0,4).map(r=>(
            <div key={r.id} style={{display:"flex",gap:"0.5rem",alignItems:"flex-start",padding:"0.25rem 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{color:"#3B82F6",fontSize:"0.68rem",fontWeight:700,flexShrink:0,marginTop:1}}>📅</span>
              <div>
                <div style={{color:"#CBD5E1",fontSize:"0.73rem",fontWeight:600,lineHeight:1.2}}>{r.street||(r.address?r.address.split(",")[0]:r.projectTitle)||"—"}</div>
                <div style={{color:"#475569",fontSize:"0.65rem"}}>{r.status}</div>
              </div>
            </div>
          ))}
          {active.filter(r=>r.date&&dFrom(r.date)===0).length===0&&(
            <div style={{color:"#334155",fontSize:"0.72rem",textAlign:"center",padding:"0.5rem 0"}}>Keine Termine heute</div>
          )}
          <button style={{marginTop:4,padding:"0.4rem 0.6rem",borderRadius:8,border:"1px solid rgba(59,130,246,0.2)",background:"transparent",color:"#3B82F6",fontWeight:600,fontSize:"0.72rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            Zum Kalender <ChevronRight size={13}/>
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{background:"var(--color-surface,#0F172A)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"0.6rem 0.75rem",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <span style={{fontWeight:700,fontSize:"0.72rem",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em"}}>KPI Übersicht</span>
        </div>
        <div style={{padding:"0.5rem 0.75rem",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem"}}>
          <KpiCard label="Projekte offen" value={active.length} color="#F1F5F9"/>
          <KpiCard label="Aktiv" value={active.filter(r=>r.status!=="Abgeschlossen").length} color="#3B82F6"/>
          <KpiCard label="Überfällig" value={overdue.length} color="#EF4444"/>
          <KpiCard label="Trocknungen" value={trocknung.length} color="#10B981"/>
          <KpiCard label="Rechnungen offen" value={active.filter(r=>r.status==="Rechnung").length} color="#F59E0B"/>
          <KpiCard label="Ø Durchlauf (Tage)" value={avgDays??"—"} color="#64748B"/>
        </div>
      </div>

    </div>
  )
}
