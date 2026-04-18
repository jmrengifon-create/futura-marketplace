import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v||0).toLocaleString('es-PE',{minimumFractionDigits:2})}`;

export default function AdminFull() {
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [pending, setPending] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newsletter, setNewsletter] = useState({ title:'', message:'', link:'' });
  const [newCat, setNewCat] = useState({ name:'', commission_rate:10 });
  const [msg, setMsg] = useState('');

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/admin/dashboard').then(setDash).catch(()=>{}),
      apiFetch('/api/admin/sellers/pending').then(setPending).catch(()=>{}),
      apiFetch('/api/admin/products').then(setProducts).catch(()=>{}),
      apiFetch('/api/categories').then(setCategories).catch(()=>{}),
      apiFetch('/api/admin/users').then(setUsers).catch(()=>{}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const approveSeller = async (id) => {
    await apiFetch(`/api/admin/sellers/${id}/approve`, { method:'PUT' });
    loadAll();
  };

  const rejectSeller = async (id) => {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;
    await apiFetch(`/api/admin/sellers/${id}/reject`, { method:'PUT', body:JSON.stringify({ reason }) });
    loadAll();
  };

  const suspendUser = async (id) => {
    const reason = prompt('Motivo de la suspensión:');
    if (!reason) return;
    await apiFetch(`/api/admin/sellers/${id}/suspend`, { method:'PUT', body:JSON.stringify({ reason }) });
    loadAll();
  };

  const moderateProduct = async (id, action) => {
    const reason = action==='reject' ? prompt('Motivo del rechazo:') : null;
    if (action==='reject' && !reason) return;
    await apiFetch(`/api/admin/products/${id}/moderate`, { method:'PUT', body:JSON.stringify({ action, reason }) });
    loadAll();
  };

  const updateCommission = async (catId, rate) => {
    await apiFetch(`/api/admin/categories/${catId}/commission`, { method:'PUT', body:JSON.stringify({ commission_rate: rate }) });
    setMsg('✅ Comisión actualizada');
    loadAll();
  };

  const addCategory = async (e) => {
    e.preventDefault();
    await apiFetch('/api/admin/categories', { method:'POST', body:JSON.stringify(newCat) });
    setNewCat({ name:'', commission_rate:10 });
    loadAll();
  };

  const deleteCategory = async (id) => {
    if (!confirm('¿Eliminar categoría?')) return;
    await apiFetch(`/api/admin/categories/${id}`, { method:'DELETE' });
    loadAll();
  };

  const sendNewsletter = async (e) => {
    e.preventDefault();
    const r = await apiFetch('/api/admin/newsletter', { method:'POST', body:JSON.stringify(newsletter) });
    setMsg(`✅ Newsletter enviado a ${r.sent} compradores`);
    setNewsletter({ title:'', message:'', link:'' });
  };

  const deleteUser = async (id) => {
    if (!confirm('¿Eliminar usuario?')) return;
    await apiFetch(`/api/admin/users/${id}`, { method:'DELETE' });
    loadAll();
  };

  const TABS = [
    ['dashboard','📊 GMV Dashboard'],
    ['pending','🔔 Aprobar Vendedores', pending.length],
    ['products','🛍️ Moderar Productos'],
    ['categories','🏷️ Categorías'],
    ['users','👥 Usuarios'],
    ['newsletter','📧 Newsletter'],
  ];

  const g = dash?.gmv || {};
  const gmvGrowth = g.gmv_mes_anterior > 0 ? (((g.gmv_mes - g.gmv_mes_anterior) / g.gmv_mes_anterior)*100).toFixed(1) : 0;

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important}`}</style>
      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 40px' }}>
          <div style={{ display:'flex', alignItems:'center', height:64, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <a href="/" style={{ textDecoration:'none' }}>
                <img src="/logo-hero.png" alt="Futura" style={{ height:34, objectFit:'contain' }} />
              </a>
              <span style={{ color:'#3B75C0', fontSize:20 }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>⚙ Super Admin Panel</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <a href="/admin/commissions" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:12, padding:'7px 14px', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8 }}>Comisiones</a>
              <a href="/admin/stats" style={{ background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', padding:'7px 16px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700 }}>📊 Power BI</a>
              <a href="/admin/disputes" style={{ background:'rgba(239,68,68,0.2)', color:'#fca5a5', padding:'7px 14px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:600 }}>⚖️ Disputas</a>
              <a href="/" style={{ color:'#64748b', textDecoration:'none', fontSize:12, padding:'7px 12px' }}>← Inicio</a>
            </div>
          </div>
          <div style={{ display:'flex', gap:2, overflowX:'auto' }}>
            {TABS.map(([key,label,badge])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'11px 18px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                {label}
                {badge>0 && <span style={{ background:'#ef4444', color:'white', borderRadius:'50%', width:18, height:18, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>{badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1400, margin:'24px auto', padding:'0 40px', animation:'fadeUp 0.4s ease' }}>
        {msg && <div style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'12px 16px', borderRadius:10, marginBottom:16, fontWeight:600 }}>{msg} <button onClick={()=>setMsg('')} style={{ background:'none', border:'none', cursor:'pointer', float:'right', color:'#15803d' }}>×</button></div>}

        {/* DASHBOARD TAB */}
        {tab==='dashboard' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:20 }}>
              {[
                ['💵','GMV Total',fmt(g.gmv_total),'#f0fdf4','#15803d'],
                ['📅','GMV Este Mes',fmt(g.gmv_mes),'#eff6ff','#3B75C0'],
                ['📊','Comisiones Futura',fmt(g.comision_total),'#f5f3ff','#7c3aed'],
                ['🛒','Ticket Promedio',fmt(g.ticket_promedio),'#fefce8','#ca8a04'],
                ['🏪','Vendedores Activos',dash?.vendedores_activos||0,'#fdf4ff','#a21caf'],
              ].map(([icon,label,val,bg,color])=>(
                <div key={label} style={{ background:bg, borderRadius:14, padding:'16px 18px', border:`1px solid ${color}25` }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                  <div style={{ fontSize:10, color, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              {/* Top Sellers */}
              <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>🏆 Top 10 Vendedores</h3>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ borderBottom:'1px solid #f1f5f9' }}>
                    {['#','Vendedor','Revenue','Neto','Ventas','Rating'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#64748b', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(dash?.top_sellers||[]).map((s,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f8fafc' }}>
                        <td style={{ padding:'10px', fontWeight:800, color:'#0D3B87' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                        <td style={{ padding:'10px', fontWeight:600 }}>{s.name}</td>
                        <td style={{ padding:'10px', color:'#15803d', fontWeight:700 }}>{fmt(s.revenue)}</td>
                        <td style={{ padding:'10px', color:'#64748b' }}>{fmt(s.neto)}</td>
                        <td style={{ padding:'10px', textAlign:'center' }}><span style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{s.ventas}</span></td>
                        <td style={{ padding:'10px', color:'#f59e0b' }}>{'⭐'.repeat(Math.round(s.rating_avg||0))||'—'}</td>
                      </tr>
                    ))}
                    {!(dash?.top_sellers?.length) && <tr><td colSpan={6} style={{ padding:'24px', textAlign:'center', color:'#94a3b8' }}>Sin datos de ventas aún</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Category Stats */}
              <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>🏷️ Revenue por categoría</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(dash?.category_stats||[]).map((c,i)=>{
                    const total = (dash?.category_stats||[]).reduce((a,x)=>a+parseFloat(x.revenue||0),0);
                    const pct = total ? ((c.revenue/total)*100).toFixed(1) : 0;
                    const colors = ['#3B75C0','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ fontSize:12, color:'#64748b', width:140, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre||c.categoria||c.name}</div>
                        <div style={{ flex:1, height:8, background:'#f1f5f9', borderRadius:4 }}>
                          <div style={{ height:'100%', borderRadius:4, background:colors[i%colors.length], width:`${pct}%` }}/>
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#0D3B87', width:80, textAlign:'right' }}>{fmt(c.revenue)}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', width:32, textAlign:'right' }}>{pct}%</div>
                      </div>
                    );
                  })}
                  {!(dash?.category_stats?.length) && <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8', fontSize:13 }}>Sin datos aún</div>}
                </div>

                <div style={{ marginTop:20, padding:'14px', background:'#f8fafc', borderRadius:10, display:'flex', gap:24 }}>
                  <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>Tasa de conversión</div><div style={{ fontSize:20, fontWeight:900, color:'#0D3B87' }}>{dash?.conversion_rate||0}%</div></div>
                  <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>Compradores activos</div><div style={{ fontSize:20, fontWeight:900, color:'#0D3B87' }}>{g.compradores_activos||0}</div></div>
                  <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>Crecimiento GMV</div><div style={{ fontSize:20, fontWeight:900, color:gmvGrowth>=0?'#15803d':'#dc2626' }}>{gmvGrowth>=0?'▲':'▼'}{Math.abs(gmvGrowth)}%</div></div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* PENDING SELLERS TAB */}
        {tab==='pending' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#0D3B87', margin:0 }}>Vendedores pendientes de aprobación ({pending.length})</h2>
            {pending.length===0 ? (
              <div style={{ background:'white', borderRadius:16, padding:'48px', textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <p>No hay vendedores pendientes de aprobación</p>
              </div>
            ) : pending.map((s,i)=>(
              <div key={s.id} style={{ background:'white', borderRadius:14, padding:'20px 24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)', border:'2px solid #fde68a' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16, color:'#0D3B87', marginBottom:4 }}>{s.business_name||s.name}</div>
                    <div style={{ fontSize:13, color:'#64748b', display:'flex', gap:16, flexWrap:'wrap' }}>
                      <span>📧 {s.email}</span>
                      {s.phone && <span>📱 {s.phone}</span>}
                      {s.ruc && <span>🏢 RUC: {s.ruc}</span>}
                      {s.location_city && <span>📍 {s.location_city}</span>}
                    </div>
                    {s.machine_type && <div style={{ marginTop:8, background:'#eff6ff', color:'#3B75C0', display:'inline-block', padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:600 }}>🖨 {s.machine_type} — {s.machine_model}</div>}
                    {s.production_capacity>0 && <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>⚡ Capacidad: {s.production_capacity} unid/semana</div>}
                    {s.portfolio_desc && <div style={{ fontSize:12, color:'#475569', marginTop:8, padding:'8px 12px', background:'#f8fafc', borderRadius:8 }}>{s.portfolio_desc}</div>}
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>Solicitó: {new Date(s.created_at).toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button onClick={()=>approveSeller(s.id)} style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', border:'none', padding:'9px 20px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13 }}>✓ Aprobar</button>
                    <button onClick={()=>rejectSeller(s.id)} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'9px 16px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13 }}>✗ Rechazar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab==='products' && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>Moderación de productos ({products.length})</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {products.map((p,i)=>(
                <div key={p.id} style={{ background:'white', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)', border:p.active?'1px solid #f1f5f9':'2px solid #fecaca' }}>
                  <div style={{ height:160, overflow:'hidden', background:'#f8fafc', position:'relative' }}>
                    <img src={p.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div style={{ position:'absolute', top:8, right:8, background:p.active?'#f0fdf4':'#fef2f2', color:p.active?'#15803d':'#dc2626', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, border:`1px solid ${p.active?'#86efac':'#fecaca'}` }}>
                      {p.active?'● Activo':'● Inactivo'}
                    </div>
                  </div>
                  <div style={{ padding:'14px' }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#0D3B87', marginBottom:3 }}>{p.title}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>
                      👤 {p.seller_name} · {p.category_name||'Sin cat.'} · S/ {parseFloat(p.price).toLocaleString()}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      {!p.active && <button onClick={()=>moderateProduct(p.id,'approve')} style={{ flex:1, background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', border:'none', padding:'8px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>✓ Aprobar</button>}
                      {p.active && <button onClick={()=>moderateProduct(p.id,'reject')} style={{ flex:1, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'8px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:12 }}>✗ Rechazar</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {tab==='categories' && (
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
            <div style={{ background:'white', borderRadius:16, padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:16, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>🏷️ Categorías y comisiones</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                  {['#','Categoría','Comisión (%)','Acción'].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {categories.map((c,i)=>(
                    <tr key={c.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'12px', color:'#94a3b8' }}>#{c.id}</td>
                      <td style={{ padding:'12px', fontWeight:600, color:'#0D3B87' }}>{c.name}</td>
                      <td style={{ padding:'12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <input type="number" min="0" max="50" step="0.5" defaultValue={c.commission_rate} id={`cat-${c.id}`}
                            style={{ width:70, padding:'6px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, textAlign:'center' }} />
                          <span style={{ color:'#64748b', fontSize:12 }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={()=>{ const el=document.getElementById(`cat-${c.id}`); updateCommission(c.id, el.value); }}
                            style={{ background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', border:'none', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>Guardar</button>
                          <button onClick={()=>deleteCategory(c.id)}
                            style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background:'white', borderRadius:16, padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>➕ Nueva categoría</h3>
              <form onSubmit={addCategory} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Nombre</label>
                  <input required value={newCat.name} onChange={e=>setNewCat(p=>({...p,name:e.target.value}))} placeholder="Ej: Textil Corporativo"
                    style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Comisión (%)</label>
                  <input type="number" min="0" max="50" step="0.5" value={newCat.commission_rate} onChange={e=>setNewCat(p=>({...p,commission_rate:e.target.value}))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
                <button type="submit" style={{ padding:'11px', background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700 }}>➕ Agregar categoría</button>
              </form>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab==='users' && (
          <div style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0D3B87' }}>Todos los usuarios ({users.length})</h3>
              <div style={{ fontSize:12, color:'#64748b' }}>
                Admins: {users.filter(u=>u.role==='ADMIN').length} · Vendedores: {users.filter(u=>u.role==='VENDEDOR').length} · Compradores: {users.filter(u=>u.role==='COMPRADOR').length}
              </div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc' }}>
                {['#','Nombre','Email','Rol','Estado','Registro','Acciones'].map(h=><th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {users.map((u,i)=>{
                  const rc={ADMIN:['#fef2f2','#ef4444'],VENDEDOR:['#eff6ff','#3B75C0'],COMPRADOR:['#f0fdf4','#16a34a']};
                  const sc={ACTIVO:['#f0fdf4','#15803d'],PENDIENTE:['#fefce8','#ca8a04'],SUSPENDIDO:['#fef2f2','#dc2626']};
                  const [rbg,rc2]=rc[u.role]||['#f8fafc','#64748b'];
                  const [sbg,sc2]=sc[u.status]||['#f8fafc','#64748b'];
                  return (
                    <tr key={u.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'11px 14px', color:'#94a3b8' }}>#{u.id}</td>
                      <td style={{ padding:'11px 14px', fontWeight:600 }}>{u.name}<br/>{u.business_name&&<span style={{ fontSize:11, color:'#64748b' }}>{u.business_name}</span>}</td>
                      <td style={{ padding:'11px 14px', color:'#475569', fontSize:12 }}>{u.email}</td>
                      <td style={{ padding:'11px 14px' }}><span style={{ background:rbg, color:rc2, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:800 }}>{u.role}</span></td>
                      <td style={{ padding:'11px 14px' }}><span style={{ background:sbg, color:sc2, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{u.status}</span></td>
                      <td style={{ padding:'11px 14px', fontSize:11, color:'#94a3b8' }}>{new Date(u.created_at).toLocaleDateString('es-PE')}</td>
                      <td style={{ padding:'11px 14px' }}>
                        {u.role!=='ADMIN' && (
                          <div style={{ display:'flex', gap:6 }}>
                            {u.role==='VENDEDOR' && u.status==='ACTIVO' && <button onClick={()=>suspendUser(u.id)} style={{ background:'#fefce8', color:'#ca8a04', border:'1px solid #fde68a', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600 }}>Suspender</button>}
                            {u.role==='VENDEDOR' && u.status!=='ACTIVO' && <button onClick={()=>approveSeller(u.id)} style={{ background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600 }}>Activar</button>}
                            <button onClick={()=>deleteUser(u.id)} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'5px 8px', borderRadius:7, cursor:'pointer', fontSize:11 }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* NEWSLETTER TAB */}
        {tab==='newsletter' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ background:'white', borderRadius:16, padding:'28px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:17, fontWeight:800, color:'#0D3B87', marginBottom:6 }}>📧 Enviar Newsletter</h3>
              <p style={{ color:'#64748b', fontSize:13, marginBottom:24 }}>Se enviará como notificación a todos los compradores activos de la plataforma</p>
              <form onSubmit={sendNewsletter} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Asunto *</label>
                  <input required value={newsletter.title} onChange={e=>setNewsletter(p=>({...p,title:e.target.value}))} placeholder="🎉 Nuevos vendedores disponibles en Futura Marketplace"
                    style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Mensaje *</label>
                  <textarea required rows={5} value={newsletter.message} onChange={e=>setNewsletter(p=>({...p,message:e.target.value}))}
                    placeholder="Escribe el contenido del newsletter..."
                    style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Link (opcional)</label>
                  <input value={newsletter.link} onChange={e=>setNewsletter(p=>({...p,link:e.target.value}))} placeholder="/"
                    style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
                <button type="submit" style={{ padding:'13px', background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', border:'none', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:15 }}>
                  📧 Enviar Newsletter
                </button>
              </form>
            </div>
            <div style={{ background:'white', borderRadius:16, padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', marginBottom:16 }}>📊 Estadísticas de usuarios</h3>
              {[['🛒 Compradores activos',users.filter(u=>u.role==='COMPRADOR'&&u.status==='ACTIVO').length,'#f0fdf4','#15803d'],
                ['🏪 Vendedores activos',users.filter(u=>u.role==='VENDEDOR'&&u.status==='ACTIVO').length,'#eff6ff','#3B75C0'],
                ['⏳ Pendientes aprobación',pending.length,'#fefce8','#ca8a04'],
                ['🚫 Suspendidos',users.filter(u=>u.status==='SUSPENDIDO').length,'#fef2f2','#dc2626'],
              ].map(([label,val,bg,color])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', background:bg, borderRadius:10, marginBottom:10, border:`1px solid ${color}20` }}>
                  <span style={{ fontSize:13, color, fontWeight:600 }}>{label}</span>
                  <span style={{ fontSize:22, fontWeight:900, color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
