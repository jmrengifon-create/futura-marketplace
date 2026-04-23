// frontend/pages/admin/crm.js — CRM de Maquinaria Futura
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const CATEGORY_COLORS = { ECOSOLVENTE:'#3B75C0', UV:'#7c3aed', DTF:'#15803d', SUBLIMACION:'#ca8a04', PLOTTER:'#dc2626', OTRO:'#64748b' };
const PRIORITY_COLORS  = { CRITICO:'#dc2626', ALTO:'#ca8a04', NORMAL:'#3B75C0', BAJO:'#64748b' };
const STATUS_COLORS    = { ACTIVA:'#15803d', EN_SERVICIO:'#ca8a04', INACTIVA:'#64748b', VENDIDA:'#94a3b8' };
const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtMoney = (n) => `S/ ${parseFloat(n||0).toLocaleString('es-PE', { minimumFractionDigits:2 })}`;

export default function AdminCRM() {
  const [tab, setTab]             = useState('overview');
  const [buyers, setBuyers]       = useState([]);
  const [machines, setMachines]   = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const [stats, setStats]         = useState(null);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [buyerDetail, setBuyerDetail]     = useState(null);
  const [search, setSearch]       = useState('');
  const [msg, setMsg]             = useState('');
  const [loading, setLoading]     = useState(true);
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [showAddSupply, setShowAddSupply]   = useState(null);
  const [addMachineForm, setAddMachineForm] = useState({ machine_id:'', serial_number:'', purchase_date:'', warranty_until:'', location:'', notes:'' });
  const [addSupplyForm, setAddSupplyForm]   = useState({ supply_name:'', supply_type:'TINTA', quantity:1, notes:'' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    if (!token || role !== 'ADMIN') { window.location.href = '/login'; return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [b, m, a, s] = await Promise.all([
        apiFetch('/api/admin/crm/buyers').catch(()=>[]),
        apiFetch('/api/admin/crm/machines').catch(()=>[]),
        apiFetch('/api/admin/crm/alerts').catch(()=>[]),
        apiFetch('/api/admin/crm/stats').catch(()=>null),
      ]);
      setBuyers(Array.isArray(b)?b:[]);
      setMachines(Array.isArray(m)?m:[]);
      setAlerts(Array.isArray(a)?a:[]);
      setStats(s);
    } finally { setLoading(false); }
  };

  const loadBuyerDetail = async (id) => {
    setSelectedBuyer(id);
    setTab('buyer');
    try {
      const d = await apiFetch(`/api/admin/crm/buyers/${id}`);
      setBuyerDetail(d);
    } catch {}
  };

  const addMachine = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/crm/buyers/${selectedBuyer}/machines`, { method:'POST', body:JSON.stringify(addMachineForm) });
      setMsg('✅ Máquina registrada y alertas de mantenimiento creadas automáticamente');
      setShowAddMachine(false);
      setAddMachineForm({ machine_id:'', serial_number:'', purchase_date:'', warranty_until:'', location:'', notes:'' });
      await loadBuyerDetail(selectedBuyer);
    } catch (err) { setMsg('❌ '+err.message); }
  };

  const addSupplyLog = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/crm/buyer-machines/${showAddSupply}/supply-log`, { method:'POST', body:JSON.stringify(addSupplyForm) });
      setMsg('✅ Insumo registrado correctamente');
      setShowAddSupply(null);
      setAddSupplyForm({ supply_name:'', supply_type:'TINTA', quantity:1, notes:'' });
      await loadBuyerDetail(selectedBuyer);
    } catch (err) { setMsg('❌ '+err.message); }
  };

  const resolveAlert = async (id) => {
    await apiFetch(`/api/admin/crm/alerts/${id}/resolve`, { method:'POST' });
    setMsg('✅ Alerta resuelta');
    loadAll();
    if (buyerDetail) loadBuyerDetail(selectedBuyer);
  };

  const sendWAAlert = async (id) => {
    try {
      await apiFetch(`/api/admin/crm/alerts/${id}/send-wa`, { method:'POST' });
      setMsg('✅ Alerta enviada por WhatsApp');
      loadAll();
    } catch (err) { setMsg('❌ '+err.message); }
  };

  const overdueAlerts  = alerts.filter(a => a.due_date && new Date(a.due_date) < new Date());
  const upcomingAlerts = alerts.filter(a => a.due_date && new Date(a.due_date) >= new Date());
  const filteredBuyers = buyers.filter(b => !search || b.buyer_name?.toLowerCase().includes(search.toLowerCase()) || b.email?.toLowerCase().includes(search.toLowerCase()));

  const TABS = [
    ['overview', '📊 Resumen'],
    ['buyers',   `👥 Compradores (${buyers.length})`],
    ['machines', `🖨️ Catálogo (${machines.length})`],
    ['alerts',   `🔔 Alertas${overdueAlerts.length > 0 ? ' (' + overdueAlerts.length + ')' : ''}`],
    ...(selectedBuyer && buyerDetail ? [['buyer', `👤 ${buyerDetail.buyer?.name?.split(' ')[0]}`]] : []),
  ];

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important;box-shadow:0 0 0 3px rgba(59,117,192,0.1)!important}
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer;font-size:13px;transition:opacity 0.2s}
        .btn:hover{opacity:0.9} .btn-sm{padding:5px 12px;font-size:12px;border-radius:8px}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .btn-red{background:linear-gradient(135deg,#dc2626,#ef4444)}
        .btn-amber{background:linear-gradient(135deg,#ca8a04,#eab308)}
        .card{background:white;border-radius:16px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .row:hover{background:#f8fafc!important}
        .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-block}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>🖨️ CRM Maquinaria Futura</span>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:12, color:'#A8CAEA', alignItems:'center' }}>
              {overdueAlerts.length > 0 && <span style={{ background:'#dc2626', color:'white', padding:'2px 10px', borderRadius:20, fontWeight:700, animation:'pulse 2s infinite' }}>🔴 {overdueAlerts.length} alertas vencidas</span>}
              <span>🖨️ {buyers.reduce((a,b)=>a+parseInt(b.total_machines||0),0)} máquinas registradas</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(([key, label]) => (
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent', whiteSpace:'nowrap' }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>
        {msg && <div style={{ background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.startsWith('✅')?'#86efac':'#fecaca'}`, color:msg.startsWith('✅')?'#15803d':'#dc2626', padding:'10px 14px', borderRadius:10, marginBottom:16, fontWeight:600, display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18 }}>×</button></div>}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {[
                ['🖨️','Máquinas Activas', buyers.reduce((a,b)=>a+parseInt(b.active_machines||0),0), '#eff6ff','#3B75C0'],
                ['👥','Compradores CRM',  buyers.filter(b=>parseInt(b.total_machines)>0).length, '#f0fdf4','#15803d'],
                ['🔔','Alertas Pendientes', alerts.length, overdueAlerts.length>0?'#fef2f2':'#fefce8', overdueAlerts.length>0?'#dc2626':'#ca8a04'],
                ['💰','Revenue Total', fmtMoney(buyers.reduce((a,b)=>a+parseFloat(b.total_spent||0),0)), '#f5f3ff','#7c3aed'],
              ].map(([icon,label,val,bg,color])=>(
                <div key={label} className="card" style={{ background:bg, border:`1px solid ${color}20` }}>
                  <div style={{ fontSize:24 }}>{icon}</div>
                  <div style={{ fontSize:10, color, fontWeight:700, textTransform:'uppercase', marginTop:8 }}>{label}</div>
                  <div style={{ fontSize:24, fontWeight:900, color, marginTop:4 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <div className="card">
                <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>🖨️ Máquinas por Categoría</h3>
                {stats?.machinesByCategory?.map(c=>(
                  <div key={c.category} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:CATEGORY_COLORS[c.category]||'#64748b' }} />
                      <span style={{ fontSize:13, fontWeight:600 }}>{c.category}</span>
                    </div>
                    <span style={{ background:CATEGORY_COLORS[c.category]+'20', color:CATEGORY_COLORS[c.category], padding:'2px 10px', borderRadius:20, fontWeight:700, fontSize:13 }}>{c.total}</span>
                  </div>
                ))}
                {!stats?.machinesByCategory?.length && <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:'20px 0' }}>Registra máquinas para ver estadísticas</p>}
              </div>

              <div className="card">
                <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>⭐ Top Compradores por Máquinas</h3>
                {stats?.topBuyers?.map((b,i)=>(
                  <div key={b.email} className="row" onClick={()=>loadBuyerDetail(buyers.find(x=>x.email===b.email)?.buyer_id)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 6px', borderBottom:'1px solid #f8fafc', cursor:'pointer', borderRadius:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'#0D3B87', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{i+1}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{b.name}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{b.machines} máquinas</div>
                      </div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#15803d' }}>{fmtMoney(b.spent)}</div>
                  </div>
                ))}
                {!stats?.topBuyers?.length && <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:'20px 0' }}>Sin datos todavía</p>}
              </div>
            </div>

            {overdueAlerts.length > 0 && (
              <div className="card" style={{ background:'#fef2f2', border:'1px solid #fecaca' }}>
                <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#dc2626' }}>🔴 Alertas Vencidas ({overdueAlerts.length})</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {overdueAlerts.slice(0,5).map(a=>(
                    <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'10px 14px', borderRadius:10 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87' }}>{a.title}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{a.buyer_name} · {a.machine_name} · Vencía: {fmt(a.due_date)}</div>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>sendWAAlert(a.id)} className="btn btn-sm btn-green">📱 WA</button>
                        <button onClick={()=>resolveAlert(a.id)} className="btn btn-sm" style={{ background:'#f8fafc', color:'#64748b', border:'1px solid #e5e7eb' }}>✓ Resolver</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BUYERS ── */}
        {tab === 'buyers' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0D3B87' }}>👥 Compradores con Maquinaria Futura</h3>
              <input placeholder="🔍 Buscar comprador..." value={search} onChange={e=>setSearch(e.target.value)} style={{ padding:'8px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, width:280 }} />
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                  {['Comprador','Email','Teléfono','Máquinas','Activas','Pedidos','Gasto Total','Alertas','Acción'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredBuyers.map(b=>(
                    <tr key={b.buyer_id} className="row" style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#0D3B87' }}>{b.buyer_name}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{b.email}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, fontFamily:'monospace' }}>{b.phone||'—'}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}><span style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>{b.total_machines||0}</span></td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}><span style={{ background:'#f0fdf4', color:'#15803d', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>{b.active_machines||0}</span></td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>{b.total_orders||0}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#15803d' }}>{fmtMoney(b.total_spent)}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        {parseInt(b.pending_alerts)>0 ? <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontWeight:700, fontSize:11 }}>🔴 {b.pending_alerts}</span> : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <button onClick={()=>loadBuyerDetail(b.buyer_id)} className="btn btn-sm">Ver perfil →</button>
                      </td>
                    </tr>
                  ))}
                  {filteredBuyers.length===0 && <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>{loading?'Cargando...':'Sin compradores registrados todavía.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MACHINES CATALOG ── */}
        {tab === 'machines' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
              {machines.map(m=>(
                <div key={m.id} className="card" style={{ borderTop:`4px solid ${CATEGORY_COLORS[m.category]||'#64748b'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <span className="badge" style={{ background:CATEGORY_COLORS[m.category]+'15', color:CATEGORY_COLORS[m.category], marginBottom:6, display:'block', width:'fit-content' }}>{m.category}</span>
                      <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0D3B87' }}>{m.name}</h3>
                      <p style={{ margin:'2px 0 0', fontSize:12, color:'#94a3b8', fontFamily:'monospace' }}>{m.model}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase' }}>Compradores</div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#0D3B87' }}>{m.buyer_count||0}</div>
                    </div>
                  </div>
                  <p style={{ fontSize:12, color:'#64748b', margin:'0 0 12px' }}>{m.description}</p>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Insumos y servicios requeridos ({m.supply_count||0})</div>
                  <button onClick={async()=>{
                    const supplies = await apiFetch(`/api/admin/crm/machines/${m.id}/supplies`).catch(()=>[]);
                    alert(supplies.map(s=>`[${s.priority}] ${s.supply_type}: ${s.name} — ${s.frequency||'Según uso'}`).join('\n') || 'Sin insumos registrados');
                  }} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, color:'#3B75C0', fontWeight:600 }}>
                    Ver insumos →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ALERTS ── */}
        {tab === 'alerts' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {overdueAlerts.length > 0 && (
              <div>
                <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:800, color:'#dc2626' }}>🔴 Vencidas ({overdueAlerts.length})</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {overdueAlerts.map(a=>(
                    <div key={a.id} className="card" style={{ padding:'14px 18px', borderLeft:'4px solid #dc2626', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#0D3B87' }}>{a.title}</div>
                        <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>👤 {a.buyer_name} · 📱 {a.buyer_phone||'Sin teléfono'} · 🖨️ {a.machine_name}</div>
                        <div style={{ fontSize:11, color:'#dc2626', marginTop:3 }}>⏰ Venció: {fmt(a.due_date)}</div>
                        {a.message && <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>{a.message}</div>}
                      </div>
                      <div style={{ display:'flex', gap:8, flexShrink:0, marginLeft:16 }}>
                        <button onClick={()=>sendWAAlert(a.id)} className="btn btn-sm btn-green" disabled={a.sent_wa}>📱 {a.sent_wa?'Enviado':'Enviar WA'}</button>
                        <button onClick={()=>resolveAlert(a.id)} className="btn btn-sm" style={{ background:'#f8fafc', color:'#64748b', border:'1px solid #e5e7eb' }}>✓ Resolver</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {upcomingAlerts.length > 0 && (
              <div>
                <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:800, color:'#ca8a04' }}>⏰ Próximas ({upcomingAlerts.length})</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {upcomingAlerts.map(a=>(
                    <div key={a.id} className="card" style={{ padding:'14px 18px', borderLeft:'4px solid #ca8a04', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#0D3B87' }}>{a.title}</div>
                        <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>👤 {a.buyer_name} · 🖨️ {a.machine_name}</div>
                        <div style={{ fontSize:11, color:'#ca8a04', marginTop:3 }}>⏰ Vence: {fmt(a.due_date)}</div>
                      </div>
                      <div style={{ display:'flex', gap:8, flexShrink:0, marginLeft:16 }}>
                        <button onClick={()=>sendWAAlert(a.id)} className="btn btn-sm btn-amber">📱 Avisar WA</button>
                        <button onClick={()=>resolveAlert(a.id)} className="btn btn-sm" style={{ background:'#f8fafc', color:'#64748b', border:'1px solid #e5e7eb' }}>✓ Resolver</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {alerts.length === 0 && <div className="card" style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}><div style={{ fontSize:48, marginBottom:12 }}>✅</div><p>Sin alertas pendientes</p></div>}
          </div>
        )}

        {/* ── BUYER DETAIL ── */}
        {tab === 'buyer' && buyerDetail && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Header comprador */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'#0D3B87', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700 }}>{buyerDetail.buyer?.name?.[0]||'?'}</div>
                  <div>
                    <h2 style={{ margin:0, fontSize:20, fontWeight:900, color:'#0D3B87' }}>{buyerDetail.buyer?.name}</h2>
                    <div style={{ fontSize:13, color:'#64748b' }}>{buyerDetail.buyer?.email} · {buyerDetail.buyer?.phone||'Sin teléfono'}</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, textAlign:'center' }}>
                  {[['🖨️','Máquinas',buyerDetail.buyer?.total_machines||0,'#eff6ff','#3B75C0'],['📦','Pedidos',buyerDetail.buyer?.total_orders||0,'#f0fdf4','#15803d'],['💰','Gasto',fmtMoney(buyerDetail.buyer?.total_spent),'#f5f3ff','#7c3aed']].map(([icon,label,val,bg,color])=>(
                    <div key={label} style={{ background:bg, borderRadius:12, padding:'10px 16px' }}>
                      <div style={{ fontSize:18 }}>{icon}</div>
                      <div style={{ fontSize:10, color, fontWeight:700, textTransform:'uppercase' }}>{label}</div>
                      <div style={{ fontSize:18, fontWeight:900, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Máquinas del comprador */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0D3B87' }}>🖨️ Maquinaria Registrada</h3>
                <button onClick={()=>setShowAddMachine(true)} className="btn btn-sm">+ Registrar Máquina</button>
              </div>
              {buyerDetail.machines?.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>
                  <div style={{ fontSize:48 }}>🖨️</div>
                  <p>Sin máquinas registradas. Haz clic en "Registrar Máquina" para agregar.</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                  {buyerDetail.machines?.map(m=>(
                    <div key={m.id} style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:'14px', borderTop:`3px solid ${CATEGORY_COLORS[m.category]||'#64748b'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#0D3B87' }}>{m.machine_name}</div>
                          <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{m.model} {m.serial_number?`· S/N: ${m.serial_number}`:''}</div>
                        </div>
                        <span className="badge" style={{ background:STATUS_COLORS[m.status]+'15', color:STATUS_COLORS[m.status] }}>{m.status}</span>
                      </div>
                      {m.location && <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>📍 {m.location}</div>}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10, fontSize:11, color:'#94a3b8' }}>
                        <div>🛒 Compra: {fmt(m.purchase_date)}</div>
                        <div>🛡️ Garantía: {fmt(m.warranty_until)}</div>
                        <div>🔧 Último srv: {fmt(m.last_service)}</div>
                        <div>⏰ Próx. srv: {fmt(m.next_service)}</div>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setShowAddSupply(m.id)} className="btn btn-sm" style={{ flex:1, textAlign:'center' }}>+ Insumo</button>
                        <span style={{ background:'#eff6ff', color:'#3B75C0', padding:'4px 8px', borderRadius:8, fontSize:11, fontWeight:700, display:'flex', alignItems:'center' }}>{m.supply_logs||0} logs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alertas del comprador */}
            {buyerDetail.alerts?.length > 0 && (
              <div className="card">
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800, color:'#dc2626' }}>🔔 Alertas Pendientes ({buyerDetail.alerts.length})</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {buyerDetail.alerts.map(a=>(
                    <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#fff7ed', borderRadius:10, border:'1px solid #fed7aa' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{a.title}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>🖨️ {a.machine_name} · ⏰ {fmt(a.due_date)}</div>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>sendWAAlert(a.id)} className="btn btn-sm btn-green">📱 WA</button>
                        <button onClick={()=>resolveAlert(a.id)} className="btn btn-sm" style={{ background:'white', color:'#64748b', border:'1px solid #e5e7eb' }}>✓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimos pedidos */}
            <div className="card">
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📦 Últimos Pedidos</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  {['#Orden','Total','Estado','Fecha'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {buyerDetail.orders?.map(o=>(
                    <tr key={o.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'8px 12px', fontWeight:700, color:'#3B75C0' }}>#{o.id}</td>
                      <td style={{ padding:'8px 12px', fontWeight:600 }}>{fmtMoney(o.total)}</td>
                      <td style={{ padding:'8px 12px' }}><span className="badge" style={{ background:'#f0fdf4', color:'#15803d' }}>{o.status}</span></td>
                      <td style={{ padding:'8px 12px', color:'#94a3b8', fontSize:12 }}>{fmt(o.created_at)}</td>
                    </tr>
                  ))}
                  {!buyerDetail.orders?.length && <tr><td colSpan={4} style={{ padding:'20px', textAlign:'center', color:'#94a3b8' }}>Sin pedidos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Agregar Máquina ── */}
      {showAddMachine && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowAddMachine(false)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 20px', fontSize:17, fontWeight:800, color:'#0D3B87' }}>🖨️ Registrar Máquina al Comprador</h3>
            <form onSubmit={addMachine} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Máquina Futura *</label>
                <select required value={addMachineForm.machine_id} onChange={e=>setAddMachineForm(p=>({...p,machine_id:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="">Seleccionar máquina...</option>
                  {machines.map(m=><option key={m.id} value={m.id}>[{m.category}] {m.name} — {m.model}</option>)}
                </select>
              </div>
              {[['Número de serie','serial_number','text','FE-ECO-2024-001'],['Fecha de compra','purchase_date','date',''],['Garantía hasta','warranty_until','date',''],['Ubicación','location','text','Lima, Miraflores']].map(([label,key,type,ph])=>(
                <div key={key}>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>{label}</label>
                  <input type={type} placeholder={ph} value={addMachineForm[key]} onChange={e=>setAddMachineForm(p=>({...p,[key]:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Notas</label>
                <textarea rows={3} value={addMachineForm.notes} onChange={e=>setAddMachineForm(p=>({...p,notes:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" className="btn" style={{ flex:1, padding:12 }}>✅ Registrar Máquina</button>
                <button type="button" onClick={()=>setShowAddMachine(false)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer', fontSize:13 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Registrar Insumo ── */}
      {showAddSupply && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowAddSupply(null)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 20px', fontSize:17, fontWeight:800, color:'#0D3B87' }}>📦 Registrar Insumo / Servicio</h3>
            <form onSubmit={addSupplyLog} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Tipo *</label>
                <select required value={addSupplyForm.supply_type} onChange={e=>setAddSupplyForm(p=>({...p,supply_type:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  {['TINTA','REPUESTO','SERVICIO','CONSUMIBLE','ACCESORIO'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Nombre del insumo *</label>
                <input required value={addSupplyForm.supply_name} onChange={e=>setAddSupplyForm(p=>({...p,supply_name:e.target.value}))} placeholder="ej: Kit Tintas Ecosolvente CMYK 1L x4" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Cantidad</label>
                <input type="number" min="1" value={addSupplyForm.quantity} onChange={e=>setAddSupplyForm(p=>({...p,quantity:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Notas</label>
                <textarea rows={2} value={addSupplyForm.notes} onChange={e=>setAddSupplyForm(p=>({...p,notes:e.target.value}))} placeholder="Observaciones del servicio..." style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" className="btn" style={{ flex:1, padding:12 }}>✅ Registrar</button>
                <button type="button" onClick={()=>setShowAddSupply(null)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer', fontSize:13 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
