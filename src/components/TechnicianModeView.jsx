import React from 'react';
import { Camera, Phone, MapPin, Save, ArrowLeft, Plus, X, Settings, CheckCircle } from 'lucide-react';
import AddRoomForm from './AddRoomForm';

const TABS = [
  { id: 'uebersicht', label: 'Übersicht',  icon: '🏠', color: '#3B82F6' },
  { id: 'aufnahme',   label: 'Aufnahme',   icon: '📷', color: '#3B82F6' },
  { id: 'leck',       label: 'Leck',        icon: '💧', color: '#F97316' },
  { id: 'trocknung',  label: 'Trocknung',   icon: '💨', color: '#22C55E' },
  { id: 'messung',    label: 'Messung',     icon: '📐', color: '#A855F7' },
];

const card = (extra={}) => ({
  background:'var(--color-surface, rgba(255,255,255,0.03))',
  border:'1px solid var(--color-border, rgba(255,255,255,0.08))',
  borderRadius:'14px', padding:'1rem', ...extra
});
const label = { fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-text-secondary, #94A3B8)', fontWeight:700, marginBottom:'0.5rem', display:'block' };
const field = { width:'100%', minHeight:'90px', fontFamily:'inherit', lineHeight:'1.5', fontSize:'0.95rem', background:'transparent', border:'none', color: 'var(--text-main)', resize:'vertical', outline:'none' };
const bigBtn = (color) => ({ background:`rgba(${color},0.12)`, border:`1px solid rgba(${color},0.3)`, borderRadius:'12px', padding:'0.85rem 0.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem', color:`rgb(${color})`, fontSize:'0.7rem', fontWeight:700, cursor:'pointer', minHeight:'70px' });

export default function TechnicianModeView({
  formData, setFormData, onCancel, onSave,
  techTab, setTechTab,
  setShowCameraModal, setCameraContext,
  setShowMeasurementModal, setActiveRoomForMeasurement, setIsNewMeasurement,
  showAddDeviceForm, setShowAddDeviceForm,
  handleCategorySelect,
  setShowAddRoomForm, showAddRoomForm,
  newRoom, setNewRoom, handleAddRoom, roomOptions,
}) {
  const activeDevices = (formData.devices||[]).filter(d=>!d.returnedAt);
  const contact = formData.contacts?.[0];
  const addr = [formData.street, formData.zip, formData.city].filter(Boolean).join(' ') || formData.projectTitle || '';
  const projNr = formData.projectNumber || formData.id || '';
  const tabColor = TABS.find(t=>t.id===techTab)?.color || '#3B82F6';

  const statusDone = (s) => {
    const order = ['Schadenaufnahme','Leckortung','Trocknung','Instandsetzung','Abgeschlossen'];
    return order.indexOf(formData.status) > order.indexOf(s);
  };

  return (
    <div style={{minHeight:'100dvh', backgroundColor: 'var(--color-app-bg)', color: 'var(--text-main)', fontFamily:'inherit'}}>

      {/* STICKY HEADER */}
      <div style={{position:'sticky',top:0,zIndex:100,backgroundColor:'rgba(15,23,42,0.97)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        {/* Row 1 */}
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.65rem 1rem 0.4rem'}}>
          <button type="button" onClick={onCancel} style={{background:'rgba(255,255,255,0.07)',border: '1px solid var(--color-border, rgba(255,255,255,0.1))', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',color:'var(--color-text-secondary, #94A3B8)',borderRadius:'10px',padding:'0.45rem 0.7rem',display:'flex',alignItems:'center',gap:'0.35rem',fontSize:'0.8rem',fontWeight:700,cursor:'pointer',minHeight:'40px',flexShrink:0}}>
            <ArrowLeft size={15}/> Zurück
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'1.05rem',fontWeight:800,lineHeight:1.1}}>{projNr}</div>
            <div style={{fontSize:'0.72rem',color:'#64748B',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{addr}</div>
          </div>
          <div style={{background: activeDevices.length>0 ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.12)', border:`1px solid ${activeDevices.length>0?'rgba(34,197,94,0.3)':'rgba(59,130,246,0.25)'}`, color: activeDevices.length>0?'#22C55E':'#60A5FA', borderRadius:'20px',padding:'0.3rem 0.65rem',fontSize:'0.68rem',fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
            {activeDevices.length>0 ? `${activeDevices.length} Gerät${activeDevices.length>1?'e':''} aktiv` : (formData.status||'Aufnahme')}
          </div>
        </div>
        {/* Row 2: Tabs */}
        <div style={{display:'flex',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
          {TABS.map(t=>(
            <button key={t.id} type="button" onClick={()=>setTechTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0.5rem 0.2rem',background:'none',border:'none',cursor:'pointer',color:techTab===t.id?t.color:'#475569',borderBottom:techTab===t.id?`2.5px solid ${t.color}`:'2.5px solid transparent',fontSize:'0.65rem',fontWeight:techTab===t.id?700:500,minHeight:'40px',transition:'all 0.15s'}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{padding:'0.85rem',paddingBottom:'5rem',display:'flex',flexDirection:'column',gap:'0.85rem'}}>

        {/* ── ÜBERSICHT ── */}
        {techTab==='uebersicht' && <>
          {/* Status tiles */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.65rem'}}>
            {[
              {s:'Schadenaufnahme',icon:'📋',c:'59,130,246',tab:'aufnahme',onTileClick:()=>{setTechTab('aufnahme');setShowAddRoomForm&&setShowAddRoomForm(true);}},
              {s:'Leckortung',icon:'💧',c:'249,115,22',tab:'leck',onTileClick:()=>setTechTab('leck')},
              {s:'Trocknung',icon:'💨',c:'34,197,94',tab:'trocknung',onTileClick:()=>setTechTab('trocknung')},
              {s:'Kontrollmessung',icon:'📐',c:'168,85,247',tab:'messung',onTileClick:()=>{
                setActiveRoomForMeasurement(formData.rooms && formData.rooms.length > 0 ? formData.rooms[0] : null);
                setIsNewMeasurement(true);
                setShowMeasurementModal(true);
              }},
            ].map(({s,icon,c,tab,onTileClick})=>{
              const done = statusDone(s) || formData.status==='Abgeschlossen';
              const active = formData.status===s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={onTileClick}
                  style={{
                    ...card(),
                    background:done?`rgba(${c},0.1)`:'rgba(255,255,255,0.02)',
                    border:`1px solid rgba(${c},${done?'0.3':'0.08'})`,
                    cursor:'pointer',
                    textAlign:'left',
                    width:'100%',
                    transition:'all 0.15s',
                    display:'flex',
                    flexDirection:'column',
                    alignItems:'flex-start',
                    gap:'0.15rem',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background=`rgba(${c},0.18)`;e.currentTarget.style.border=`1px solid rgba(${c},0.5)`;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=done?`rgba(${c},0.1)`:'rgba(255,255,255,0.02)';e.currentTarget.style.border=`1px solid rgba(${c},${done?'0.3':'0.08'})`;}}
                >
                  <div style={{fontSize:'1.1rem',marginBottom:'0.2rem'}}>{icon}</div>
                  <div style={{fontSize:'0.78rem',fontWeight:700,color:done?`rgb(${c})`:'var(--text-main, #E2E8F0)'}}>{s}</div>
                  <div style={{fontSize:'0.62rem',fontWeight:600,color:done?'#22C55E':active?'#F97316':'#475569',display:'flex',alignItems:'center',gap:'0.3rem'}}>
                    {done?'✓ Erledigt':active?'● Aktiv':'○ Offen'}
                  </div>
                  <div style={{marginTop:'0.35rem',fontSize:'0.6rem',color:`rgba(${c},0.7)`,fontWeight:600,letterSpacing:'0.05em'}}>→ öffnen</div>
                </button>
              );
            })}
          </div>

          {/* Beschreibung */}
          {formData.description && (
            <div style={card()}>
              <span style={label}>Schaden</span>
              <div style={{fontSize:'0.9rem',color:'#CBD5E1',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{formData.description}</div>
            </div>
          )}

          {/* Nächste Aufgabe */}
          {(()=>{
            const nextTab =
              formData.status==='Schadenaufnahme'?'aufnahme':
              formData.status==='Leckortung'?'leck':
              formData.status==='Trocknung'?'messung':
              formData.status==='Instandsetzung'?'aufnahme':'uebersicht';
            const nextLabel =
              formData.status==='Schadenaufnahme'?'Aufnahme vervollständigen':
              formData.status==='Leckortung'?'Leckortung durchführen':
              formData.status==='Trocknung'?'Kontrollmessung durchführen':
              formData.status==='Instandsetzung'?'Instandsetzung abschliessen':'Projekt abgeschlossen ✓';
            return (
              <button
                type="button"
                onClick={()=>setTechTab(nextTab)}
                style={{...card(),background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.25)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.75rem',cursor:'pointer',width:'100%',textAlign:'left',transition:'all 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.14)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(59,130,246,0.07)';}}
              >
                <div>
                  <span style={{...label,color:'#3B82F6',marginBottom:'0.3rem'}}>➡ Nächste Aufgabe</span>
                  <div style={{fontSize:'0.95rem',fontWeight:700}}>{nextLabel}</div>
                </div>
                <ArrowLeft size={18} style={{color:'#3B82F6',transform:'rotate(180deg)',flexShrink:0}}/>
              </button>
            );
          })()}

          {/* Aktive Geräte */}
          {activeDevices.length>0 && (
            <div style={card()}>
              <span style={label}>💨 Aktive Geräte ({activeDevices.length})</span>
              {activeDevices.slice(0,4).map((d,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.65rem',fontSize:'0.85rem',marginBottom:'0.4rem'}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#22C55E',flexShrink:0}}/>
                  <span style={{fontWeight:600}}>Gerät {d.deviceId}</span>
                  <span style={{color:'#64748B',fontSize:'0.8rem',flex:1}}>{d.model}</span>
                  <span style={{color:'#475569',fontSize:'0.75rem'}}>{d.room}</span>
                </div>
              ))}
            </div>
          )}

          {/* Kontakt */}
          {contact && (
            <div style={{...card(),display:'flex',alignItems:'center',gap:'1rem'}}>
              <div style={{flex:1}}>
                <span style={label}>Kontakt</span>
                <div style={{fontWeight:700,fontSize:'0.95rem'}}>{contact.name}</div>
                {contact.phone && <div style={{fontSize:'0.82rem',color:'#64748B'}}>{contact.phone}</div>}
              </div>
              {contact.phone && (
                <a href={`tel:${contact.phone}`} style={{display:'flex',alignItems:'center',gap:'0.5rem',background:'#22C55E',color: '#FFFFFF',borderRadius:'12px',padding:'0.7rem 1rem',fontSize:'0.82rem',fontWeight:700,textDecoration:'none',flexShrink:0,minHeight:'48px'}}>
                  <Phone size={15}/> Anrufen
                </a>
              )}
            </div>
          )}

          {/* Schnellaktionen */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.5rem'}}>
            {[
              {label:'Foto',icon:<Camera size={20}/>,c:'59,130,246',fn:()=>{setCameraContext(null);setShowCameraModal(true);}},
              {label:'Anrufen',icon:<Phone size={20}/>,c:'34,197,94',fn:()=>{if(contact?.phone)window.location.href=`tel:${contact.phone}`;}},
              {label:'Navigation',icon:<MapPin size={20}/>,c:'249,115,22',fn:()=>{window.open(`https://maps.apple.com/?q=${encodeURIComponent(addr)}`,'_blank');}},
              {label:'Speichern',icon:<Save size={20}/>,c:'168,85,247',fn:()=>onSave&&onSave(formData)},
            ].map(a=>(
              <button key={a.label} type="button" onClick={a.fn} style={bigBtn(a.c)}>{a.icon}{a.label}</button>
            ))}
          </div>
        </>}

        {/* ── AUFNAHME ── */}
        {techTab==='aufnahme' && <>
          <div style={card()}>
            <span style={{...label,color:'#3B82F6'}}>📝 Schadenbeschreibung</span>
            <textarea className="form-input" value={formData.description||''} onChange={e=>setFormData(p=>({...p,description:e.target.value}))} placeholder="Schadenbeschreibung..." style={field}/>
          </div>
          <div style={card()}>
            <span style={{...label,color:'#3B82F6'}}>🔍 Feststellungen</span>
            <textarea className="form-input" value={formData.findings||''} onChange={e=>setFormData(p=>({...p,findings:e.target.value}))} placeholder="Feststellungen vor Ort..." style={{...field,minHeight:'80px'}}/>
          </div>
          {/* Räume */}
          <div style={card()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <span style={{...label,marginBottom:0,color:'#3B82F6'}}>🏠 Räume ({formData.rooms?.length||0})</span>
              <button type="button" onClick={()=>setShowAddRoomForm&&setShowAddRoomForm(v=>!v)} style={{background:showAddRoomForm?'rgba(239,68,68,0.12)':'rgba(59,130,246,0.15)',border:`1px solid ${showAddRoomForm?'rgba(239,68,68,0.3)':'rgba(59,130,246,0.3)'}`,borderRadius:'8px',color:showAddRoomForm?'#EF4444':'#3B82F6',padding:'0.4rem 0.75rem',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,display:'flex',alignItems:'center',gap:'0.3rem',minHeight:'36px'}}>
                {showAddRoomForm ? <><X size={14}/> Abbrechen</> : <><Plus size={14}/> Raum</>}
              </button>
            </div>
            {showAddRoomForm && newRoom !== undefined && (
              <AddRoomForm
                formData={formData}
                newRoom={newRoom}
                setNewRoom={setNewRoom}
                handleAddRoom={handleAddRoom}
                setShowAddRoomForm={setShowAddRoomForm}
                roomOptions={roomOptions}
              />
            )}
            {(formData.rooms||[]).map((room,ri)=>{
              const photos=(formData.images||[]).filter(img=>img.roomId===room.id||img.assignedTo===room.name);
              const lvlColor=room.damageLevel==='Sehr nass'?'#EF4444':room.damageLevel==='Nass'?'#F97316':room.damageLevel==='Feucht'?'#FBBF24':'#22C55E';
              return (
                <div key={room.id||ri} style={{marginBottom:'0.6rem',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'0.75rem'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                    <div style={{fontWeight:700,fontSize:'0.9rem'}}>{room.name}</div>
                    <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                      {room.damageLevel && <span style={{fontSize:'0.68rem',fontWeight:700,color:lvlColor,background:`${lvlColor}22`,borderRadius:'8px',padding:'0.15rem 0.5rem'}}>{room.damageLevel}</span>}
                      <button type="button" onClick={()=>{setCameraContext({roomId:room.id,assignedTo:room.name});setShowCameraModal(true);}} style={{background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'8px',color:'#3B82F6',padding:'0.4rem 0.65rem',cursor:'pointer',minHeight:'36px',display:'flex',alignItems:'center'}}>
                        <Camera size={14}/>
                      </button>
                    </div>
                  </div>
                  {photos.length>0 && (
                    <div style={{display:'flex',gap:'0.4rem',overflowX:'auto'}}>
                      {photos.slice(0,5).map((img,ii)=>(
                        <img key={ii} src={img.preview} alt="" style={{width:56,height:56,objectFit:'cover',borderRadius:8,flexShrink:0,border: '1px solid #E2E8F0', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}}/>
                      ))}
                      {photos.length>5 && <div style={{width:56,height:56,borderRadius:8,background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',color:'#64748B',flexShrink:0}}>+{photos.length-5}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>}

        {/* ── LECK ── */}
        {techTab==='leck' && <>
          <div style={card()}>
            <span style={{...label,color:'#F97316'}}>🔍 Ursache</span>
            <textarea className="form-input" value={formData.cause||''} onChange={e=>setFormData(p=>({...p,cause:e.target.value}))} placeholder="Wie ist der Schaden entstanden?" style={field}/>
          </div>
          <div style={card()}>
            <span style={{...label,color:'#F97316'}}>📍 Fundort / Lecklage</span>
            <textarea className="form-input" value={formData.leakLocation||''} onChange={e=>setFormData(p=>({...p,leakLocation:e.target.value}))} placeholder="Wo wurde die Leckage gefunden?" style={{...field,minHeight:'70px'}}/>
          </div>
          <div style={card()}>
            <span style={{...label,color:'#F97316'}}>🔧 Öffnung</span>
            <textarea className="form-input" value={formData.openingDescription||''} onChange={e=>setFormData(p=>({...p,openingDescription:e.target.value}))} placeholder="Öffnungsbeschreibung..." style={{...field,minHeight:'70px'}}/>
          </div>
          <div style={card()}>
            <span style={{...label,color:'#F97316'}}>✅ Resultat</span>
            <textarea className="form-input" value={formData.leakResult||''} onChange={e=>setFormData(p=>({...p,leakResult:e.target.value}))} placeholder="Ergebnis der Leckortung..." style={{...field,minHeight:'70px'}}/>
          </div>
          {/* Leck-Fotos */}
          <div style={card()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <span style={{...label,color:'#F97316',marginBottom:0}}>📸 Fotos zur Ursache</span>
              <label style={{background:'rgba(249,115,22,0.15)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'8px',padding:'0.4rem 0.8rem',cursor:'pointer',color:'#F97316',fontSize:'0.78rem',fontWeight:700,display:'flex',alignItems:'center',gap:'0.35rem'}}>
                <Camera size={13}/> Hinzufügen
                <input type="file" multiple accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleCategorySelect(e,'Schadenfotos')}/>
              </label>
            </div>
            {(formData.images||[]).filter(img=>img.assignedTo==='Schadenfotos').length===0
              ? <div style={{textAlign:'center',color:'#475569',fontSize:'0.85rem',fontStyle:'italic',padding:'1rem'}}>Keine Fotos vorhanden</div>
              : <div style={{display:'flex',gap:'0.5rem',overflowX:'auto',paddingBottom:'0.25rem'}}>
                  {(formData.images||[]).filter(img=>img.assignedTo==='Schadenfotos').map((img,i)=>(
                    <div key={i} style={{position:'relative',flexShrink:0}}>
                      <img src={img.preview} alt="" style={{width:72,height:72,objectFit:'cover',borderRadius:10,border: '1px solid #E2E8F0', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}}/>
                      <button type="button" onClick={()=>setFormData(p=>({...p,images:p.images.filter(x=>x!==img)}))} style={{position:'absolute',top:2,right:2,background:'rgba(0,0,0,0.6)',border:'none',borderRadius:'50%',color:'#EF4444',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0}}>
                        <X size={10}/>
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </>}

        {/* ── TROCKNUNG ── */}
        {techTab==='trocknung' && <>
          <div style={card()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <span style={{...label,color:'#22C55E',marginBottom:0}}>💨 Aktive Geräte ({activeDevices.length})</span>
              <button type="button" onClick={()=>setShowAddDeviceForm(v=>!v)} style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:'8px',color:'#22C55E',padding:'0.4rem 0.8rem',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'0.35rem',minHeight:'36px'}}>
                <Plus size={13}/> Gerät hinzufügen
              </button>
            </div>
            {activeDevices.length===0
              ? <div style={{textAlign:'center',color:'#475569',fontSize:'0.85rem',fontStyle:'italic',padding:'1rem'}}>Keine aktiven Geräte</div>
              : activeDevices.map((d,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem',background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.15)',borderRadius:'12px',marginBottom:'0.5rem'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'#22C55E',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:'0.9rem'}}>Gerät {d.deviceId}</div>
                    <div style={{fontSize:'0.78rem',color:'#64748B'}}>{d.model} · {d.room}</div>
                    {d.addedAt && <div style={{fontSize:'0.68rem',color:'#475569'}}>Seit {new Date(d.addedAt).toLocaleDateString('de-CH')}</div>}
                  </div>
                  <button type="button" onClick={()=>{if(window.confirm('Gerät zurückgeholt?'))setFormData(p=>({...p,devices:p.devices.map(x=>x===d?{...x,returnedAt:new Date().toISOString()}:x)}));}} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'8px',color:'#EF4444',padding:'0.4rem 0.65rem',cursor:'pointer',fontSize:'0.75rem',fontWeight:700,minHeight:'36px'}}>
                    Rückholen
                  </button>
                </div>
              ))
            }
          </div>
          {/* Rückgeholte Geräte */}
          {(formData.devices||[]).filter(d=>d.returnedAt).length>0 && (
            <div style={card()}>
              <span style={{...label,color:'#475569'}}>Zurückgeholte Geräte</span>
              {(formData.devices||[]).filter(d=>d.returnedAt).map((d,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.82rem',marginBottom:'0.35rem',color:'#64748B'}}>
                  <CheckCircle size={13} color="#475569"/><span>{d.deviceId} · {d.model}</span>
                  <span style={{marginLeft:'auto',fontSize:'0.7rem'}}>{new Date(d.returnedAt).toLocaleDateString('de-CH')}</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── MESSUNG ── */}
        {techTab==='messung' && <>
          {(formData.rooms||[]).map((room,ri)=>{
            const hasMeasurement=!!room.measurementData;
            const date=hasMeasurement&&room.measurementData.globalSettings?.date
              ? new Date(room.measurementData.globalSettings.date).toLocaleDateString('de-CH') : null;
            return (
              <div key={room.id||ri} style={card()}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.6rem'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:'0.95rem'}}>{room.name}</div>
                    <div style={{fontSize:'0.72rem',color: hasMeasurement?'#22C55E':'#475569'}}>{hasMeasurement?`Letzte Messung: ${date}`:'Keine Messdaten'}</div>
                  </div>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {hasMeasurement && (
                      <button type="button" onClick={()=>{setActiveRoomForMeasurement(room);setIsNewMeasurement(true);setShowMeasurementModal(true);}} style={{background:'rgba(168,85,247,0.15)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:'8px',color:'#A855F7',padding:'0.4rem 0.7rem',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',minHeight:'36px'}}>
                        Neu
                      </button>
                    )}
                    <button type="button" onClick={()=>{setActiveRoomForMeasurement(room);setIsNewMeasurement(!hasMeasurement);setShowMeasurementModal(true);}} style={{background: hasMeasurement?'rgba(168,85,247,0.08)':'rgba(34,197,94,0.15)',border:`1px solid ${hasMeasurement?'rgba(168,85,247,0.25)':'rgba(34,197,94,0.3)'}`,borderRadius:'8px',color:hasMeasurement?'#A855F7':'#22C55E',padding:'0.4rem 0.7rem',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',minHeight:'36px'}}>
                      {hasMeasurement?'Bearbeiten':'Starten'}
                    </button>
                  </div>
                </div>
                {hasMeasurement && room.measurementData.canvasImage && (
                  <img src={room.measurementData.canvasImage} alt="Messprotokoll" onClick={()=>window.open(room.measurementData.canvasImage,'_blank')} style={{width:'100%',borderRadius:'10px',border:'1px solid rgba(168,85,247,0.25)',cursor:'pointer',maxHeight:160,objectFit:'contain',background:'var(--surface)'}}/>
                )}
                {(room.measurementHistory||[]).length>0 && (
                  <div style={{marginTop:'0.5rem',fontSize:'0.72rem',color:'#475569'}}>
                    Verlauf: {room.measurementHistory.length} frühere Messung{room.measurementHistory.length>1?'en':''}
                  </div>
                )}
              </div>
            );
          })}
          {(formData.rooms||[]).length===0 && (
            <div style={{...card(),textAlign:'center',color:'#475569',padding:'2rem'}}>Keine Räume vorhanden – bitte im Tab «Aufnahme» Räume anlegen.</div>
          )}
        </>}

      </div>

      {/* FLOATING SAVE */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'0.85rem',paddingBottom:'calc(0.85rem + env(safe-area-inset-bottom))',background:'rgba(15,23,42,0.95)',backdropFilter:'blur(12px)',borderTop:'1px solid rgba(255,255,255,0.06)',zIndex:99}}>
        <button type="button" onClick={()=>onSave&&onSave(formData)} style={{width:'100%',background:'linear-gradient(135deg,#0F6EA3,#1d8fd4)',color: '#FFFFFF',border:'none',borderRadius:'14px',padding:'0.9rem',fontSize:'1rem',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.6rem',boxShadow:'0 4px 20px rgba(15,110,163,0.4)',minHeight:'52px'}}>
          <Save size={18}/> Speichern
        </button>
      </div>
    </div>
  );
}