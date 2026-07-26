export default function KpiCard({label,value,color,sub}) {
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"0.6rem 0.75rem",display:"flex",flexDirection:"column",gap:2}}>
      <div style={{fontSize:"1.4rem",fontWeight:800,color:color||"#CBD5E1",lineHeight:1}}>{value}</div>
      <div style={{fontSize:"0.68rem",color:"#64748B",fontWeight:600}}>{label}</div>
      {sub&&<div style={{fontSize:"0.6rem",color:"#334155"}}>{sub}</div>}
    </div>
  )
}
