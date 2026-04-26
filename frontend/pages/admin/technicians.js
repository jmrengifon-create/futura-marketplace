// frontend/pages/admin/technicians.js — Panel de Personal Técnico
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
const [showNewTechnician, setShowNewTechnician] = useState(false);
const [newTech, setNewTech] = useState({ name: '', phone: '', specialties: '' });
const STATUS_C = { TRABAJANDO:{bg:'#f0fdf4',c:'#15803d',dot:'#22c55e',label:'🟢 Trabajando'}, COMISION:{bg:'#eff6ff',c:'#3B75C0',dot:'#3B75C0',label:'🔵 Comisión'}, PERMISO:{bg:'#fefce8',c:'#ca8a04',dot:'#eab308',label:'🟡 Permiso'}, LIBRE:{bg:'#f8fafc',c:'#64748b',dot:'#94a3b8',label:'⚪ Libre'} };
const fmt = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtDT = d => d ? new Date(d).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';

export default function AdminTechnicians() {
  const [tab, setTab]       = useState('panel');
  const [techs, setTechs]   = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats]   = useState(null);
  const [msg, setMsg]       = useState('');
  const [selected, setSelected] = useState(null);
  const [statusForm, setStatusForm] = useState({ status:'LIBRE', current_client:'', current_address:'', commission_destination:'', commission_return_date:'', permission_type:'', permission_until:'', notes:'' });
  const [serviceForm, setServiceForm] = useState({ technician_id:'', client_name:'', client_address:'', client_phone:'', service_type:'MANTENIMIENTO', scheduled_at:'', problem_reported:'' });
  const [showNewService, setShowNewService] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    try {
      const [t, s, st] = await Promise.all([
        apiFetch('/api/admin/technicians').catch(()=>[]),
        apiFetch('/api/admin/technical-services?status=EN_CURSO').catch(()=>[]),
        apiFetch('/api/admin/technicians/stats').catch(()=>null),
      ]);
      setTechs(Array.isArray(t)?t:[]); setServices(Array.isArray(s)?s:[]); setStats(st);
    } catch {}
  };

  const updateStatus = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/technicians/${selected.id}/status`, { method:'PUT', body:JSON.stringify(statusForm) });
      setMsg('✅ Estado actualizado');
      setSelected(null);
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const createService = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/technical-services', { method:'POST', body:JSON.stringify(serviceForm) });
      setMsg('✅ Servicio técnico asignado correctamente');
      setShowNewService(false);
      setServiceForm({ technician_id:'', client_name:'', client_address:'', client_phone:'', service_type:'MANTENIMIENTO', scheduled_at:'', problem_reported:'' });
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const TABS = [['panel',`👥 Panel (${techs.length})`],['services',`🔧 Servicios (${services.length})`],['stats','📊 Estadísticas']];

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn-sm{padding:5px 10px;font-size:12px;border-radius:8px}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>🔧 Personal Técnico</span>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              {stats?.counts && (
                <div style={{ display:'flex', gap:8, fontSize:12 }}>
                  <span style={{ color:'#22c55e', fontWeight:700 }}>🟢 {stats.counts.working} trabajando</span>
                  <span style={{ color:'#94a3b8' }}>⚪ {stats.counts.available} libres</span>
                </div>
              )}
  <button
  onClick={() => setShowNewTechnician(true)}
  style={{
    background: '#1A56DB',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginRight: '10px'
  }}
>
  + Nuevo Técnico
</button> 
              <button onClick={()=>setShowNewService(true)} className="btn btn-sm btn-green">+ Nuevo Servicio</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent' }}>{label}</button>
            ))}
          </div>
{showNewTechnician && (
  <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
    <div style={{background:'white',borderRadius:'12px',padding:'32px',width:'400px'}}>
      <h3 style={{marginBottom:'20px'}}>👨‍🔧 Nuevo Técnico</h3>
      <input
        placeholder="Nombre completo *"
        value={newTech.name}
        onChange={e => setNewTech({...newTech, name: e.target.value})}
        style={{width:'100%',padding:'10px',marginBottom:'12px',border:'1px solid #ddd',borderRadius:'8px',boxSizing:'border-box'}}
      />
      <input
        placeholder="Teléfono"
        value={newTech.phone}
        onChange={e => setNewTech({...newTech, phone: e.target.value})}
        style={{width:'100%',padding:'10px',marginBottom:'12px',border:'1px solid #ddd',borderRadius:'8px',boxSizing:'border-box'}}
      />
      <input
        placeholder="Especialidades (ej: Impresoras, Plotters)"
        value={newTech.specialties}
        onChange={e => setNewTech({...newTech, specialties: e.target.value})}
        style={{width:'100%',padding:'10px',marginBottom:'20px',border:'1px solid #ddd',borderRadius:'8px',boxSizing:'border-box'}}
      />
      <div style={{display:'flex',gap:'12px'}}>
        <button
          onClick={async () => {
            if (!newTech.name) return alert('El nombre es obligatorio');
            try {
              const token = localStorage.getItem('token');
              await fetch('/api/admin/technicians', {
                method: 'POST',
                headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                body: JSON.stringify({
                  name: newTech.name,
                  phone: newTech.phone,
                  specialties: newTech.specialties.split(',').map(s => s.trim()).filter(Boolean)
                })
              });
              setShowNewTechnician(false);
              setNewTech({ name: '', phone: '', specialties: '' });
              window.location.reload();
            } catch(e) { alert('Error al crear técnico'); }
          }}
          style={{flex:1,background:'#10B981',color:'white',border:'none',borderRadius:'8px',padding:'12px',cursor:'pointer',fontWeight:'bold'}}
        >
          ✅ Crear Técnico
        </button>
        <button
          onClick={() => setShowNewTechnician(false)}
          style={{flex:1,background:'#E5E7EB',color:'#374151',border:'none',borderRadius:'8px',padding:'12px',cursor:'pointer'}}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}    
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        {/* PANEL DE TÉCNICOS */}
        {tab === 'panel' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
            {techs.map(t => {
              const SC = STATUS_C[t.status] || STATUS_C.LIBRE;
              return (
                <div key={t.id} className="card" style={{ borderTop:`4px solid ${SC.dot}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <div style={{ width:42, height:42, borderRadius:'50%', background:SC.bg, border:`2px solid ${SC.dot}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                        {t.status==='TRABAJANDO'?'🔧':t.status==='COMISION'?'✈️':t.status==='PERMISO'?'🏖️':'💼'}
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, color:'#0D3B87' }}>{t.name}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{t.phone||t.user_phone||'Sin teléfono'}</div>
                      </div>
                    </div>
                    <span style={{ background:SC.bg, color:SC.c, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, animation:t.status==='TRABAJANDO'?'pulse 2s infinite':'' }}>{SC.label}</span>
                  </div>

                  {t.specialties?.length > 0 && (
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                      {t.specialties.slice(0,3).map((s,i)=><span key={i} style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600 }}>{s}</span>)}
                    </div>
                  )}

                  {t.status === 'TRABAJANDO' && t.current_client && (
                    <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 10px', marginBottom:8, fontSize:12 }}>
                      <div style={{ fontWeight:700, color:'#15803d' }}>👤 {t.current_client}</div>
                      {t.current_address && <div style={{ color:'#475569' }}>📍 {t.current_address}</div>}
                    </div>
                  )}
                  {t.status === 'COMISION' && (
                    <div style={{ background:'#eff6ff', borderRadius:8, padding:'8px 10px', marginBottom:8, fontSize:12 }}>
                      <div style={{ fontWeight:700, color:'#3B75C0' }}>✈️ {t.commission_destination}</div>
                      <div style={{ color:'#64748b' }}>Retorno: {fmt(t.commission_return_date)}</div>
                    </div>
                  )}
                  {t.status === 'PERMISO' && (
                    <div style={{ background:'#fefce8', borderRadius:8, padding:'8px 10px', marginBottom:8, fontSize:12 }}>
                      <div style={{ fontWeight:700, color:'#ca8a04' }}>🏖️ {t.permission_type}</div>
                      <div style={{ color:'#64748b' }}>Hasta: {fmt(t.permission_until)}</div>
                    </div>
                  )}

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>⭐ {t.rating_avg||0} · 🔧 {t.total_services||0} servicios</div>
                    <button onClick={()=>{ setSelected(t); setStatusForm({ status:t.status, current_client:t.current_client||'', current_address:t.current_address||'', commission_destination:t.commission_destination||'', commission_return_date:t.commission_return_date||'', permission_type:t.permission_type||'', permission_until:t.permission_until||'', notes:t.notes||'' }); }} className="btn btn-sm">✏️ Estado</button>
                  </div>
                </div>
              );
            })}
            {techs.length === 0 && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px', color:'#94a3b8' }}>
                <div style={{ fontSize:48 }}>👷</div>
                <p>Sin técnicos registrados todavía.</p>
                <p style={{ fontSize:12 }}>Agrega técnicos desde la base de datos o contacta al equipo de desarrollo.</p>
              </div>
            )}
          </div>
        )}

        {/* SERVICIOS */}
        {tab === 'services' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0D3B87' }}>🔧 Servicios Técnicos</h3>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                {['Técnico','Cliente','Dirección','Tipo','Estado','Programado','Costo'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {services.map(s=>(
                  <tr key={s.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{s.technician_name}</td>
                    <td style={{ padding:'10px 12px' }}>{s.client_name||s.buyer_name||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{s.client_address?.substring(0,30)||'—'}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{s.service_type}</span></td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:s.status==='COMPLETADO'?'#f0fdf4':s.status==='EN_CURSO'?'#fefce8':'#f8fafc', color:s.status==='COMPLETADO'?'#15803d':s.status==='EN_CURSO'?'#ca8a04':'#64748b', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{s.status}</span></td>
                    <td style={{ padding:'10px 12px', fontSize:11 }}>{fmtDT(s.scheduled_at)}</td>
                    <td style={{ padding:'10px 12px', fontWeight:s.total_cost>0?700:400, color:s.total_cost>0?'#15803d':'#94a3b8' }}>{s.total_cost>0?`S/ ${s.total_cost}`:'—'}</td>
                  </tr>
                ))}
                {services.length===0 && <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin servicios activos. Usa "+ Nuevo Servicio" para asignar uno.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ESTADÍSTICAS */}
        {tab === 'stats' && stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {[['🟢','Trabajando',stats.counts?.working||0,'#f0fdf4','#15803d'],['✈️','En Comisión',stats.counts?.on_commission||0,'#eff6ff','#3B75C0'],['🏖️','Con Permiso',stats.counts?.on_leave||0,'#fefce8','#ca8a04'],['⚪','Disponibles',stats.counts?.available||0,'#f8fafc','#64748b']].map(([i,l,v,bg,c])=>(
              <div key={l} className="card" style={{ background:bg, textAlign:'center' }}>
                <div style={{ fontSize:32 }}>{i}</div>
                <div style={{ fontSize:10, color:c, fontWeight:700, textTransform:'uppercase', marginTop:6 }}>{l}</div>
                <div style={{ fontSize:28, fontWeight:900, color:c }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal cambio de estado */}
      {selected && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 18px', fontSize:16, fontWeight:800, color:'#0D3B87' }}>✏️ Estado: {selected.name}</h3>
            <form onSubmit={updateStatus} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <select value={statusForm.status} onChange={e=>setStatusForm(p=>({...p,status:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="LIBRE">⚪ Libre — Disponible para atención</option>
                <option value="TRABAJANDO">🟢 Trabajando — En servicio</option>
                <option value="COMISION">🔵 Comisión — Viaje a provincia</option>
                <option value="PERMISO">🟡 Permiso — Vacaciones/licencia</option>
              </select>
              {statusForm.status==='TRABAJANDO' && <>
                <input value={statusForm.current_client} onChange={e=>setStatusForm(p=>({...p,current_client:e.target.value}))} placeholder="Nombre del cliente actual" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <input value={statusForm.current_address} onChange={e=>setStatusForm(p=>({...p,current_address:e.target.value}))} placeholder="Dirección del trabajo" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              </>}
              {statusForm.status==='COMISION' && <>
                <input value={statusForm.commission_destination} onChange={e=>setStatusForm(p=>({...p,commission_destination:e.target.value}))} placeholder="Destino (ciudad/región)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <input type="date" value={statusForm.commission_return_date} onChange={e=>setStatusForm(p=>({...p,commission_return_date:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              </>}
              {statusForm.status==='PERMISO' && <>
                <input value={statusForm.permission_type} onChange={e=>setStatusForm(p=>({...p,permission_type:e.target.value}))} placeholder="Tipo de permiso (vacaciones, médico...)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <input type="date" value={statusForm.permission_until} onChange={e=>setStatusForm(p=>({...p,permission_until:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              </>}
              <textarea rows={2} value={statusForm.notes} onChange={e=>setStatusForm(p=>({...p,notes:e.target.value}))} placeholder="Notas adicionales" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn btn-green" style={{ flex:1, padding:12 }}>✅ Actualizar Estado</button>
                <button type="button" onClick={()=>setSelected(null)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal nuevo servicio */}
      {showNewService && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowNewService(false)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 18px', fontSize:16, fontWeight:800, color:'#0D3B87' }}>🔧 Nuevo Servicio Técnico</h3>
            <form onSubmit={createService} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <select required value={serviceForm.technician_id} onChange={e=>setServiceForm(p=>({...p,technician_id:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="">Asignar técnico *</option>
                {techs.filter(t=>t.status==='LIBRE').map(t=><option key={t.id} value={t.id}>{t.name} — ⚪ Libre</option>)}
                {techs.filter(t=>t.status!=='LIBRE').map(t=><option key={t.id} value={t.id} disabled>{t.name} — {STATUS_C[t.status]?.label||t.status}</option>)}
              </select>
              <select value={serviceForm.service_type} onChange={e=>setServiceForm(p=>({...p,service_type:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                {['MANTENIMIENTO','REPARACION','INSTALACION','CAPACITACION','GARANTIA','OTRO'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              {[['Nombre del cliente *','client_name','text'],['Dirección','client_address','text'],['Teléfono del cliente','client_phone','tel']].map(([label,key,type])=>(
                <input key={key} type={type} required={key==='client_name'} value={serviceForm[key]} onChange={e=>setServiceForm(p=>({...p,[key]:e.target.value}))} placeholder={label} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              ))}
              <input type="datetime-local" value={serviceForm.scheduled_at} onChange={e=>setServiceForm(p=>({...p,scheduled_at:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              <textarea rows={3} value={serviceForm.problem_reported} onChange={e=>setServiceForm(p=>({...p,problem_reported:e.target.value}))} placeholder="Problema reportado por el cliente" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn btn-green" style={{ flex:1, padding:12 }}>✅ Asignar Servicio</button>
                <button type="button" onClick={()=>setShowNewService(false)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
