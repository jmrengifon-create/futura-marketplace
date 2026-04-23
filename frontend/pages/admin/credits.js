// frontend/pages/admin/semaforo.js — Semáforo de Compradores y Vendedores
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const COLORS = { VERDE:{bg:'#f0fdf4',border:'#86efac',text:'#15803d',dot:'#22c55e'}, AMARILLO:{bg:'#fefce8',border:'#fde68a',text:'#ca8a04',dot:'#eab308'}, ROJO:{bg:'#fef2f2',border:'#fecaca',text:'#dc2626',dot:'#ef4444'} };
const fmtMoney = n => `S/ ${parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2})}`;

export default function Semaforo() {
  const [tab, setTab]     = useState('buyers');
  const [data, setData]   = useState({ buyers:[], sellers:[] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]     = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('TODOS');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try { const r = await apiFetch('/api/admin/semaforo'); setData(r); }
    catch {} finally { setLoading(false); }
  };

  const recalcAll = async () => {
    setMsg('⏳ Recalculando scores...');
    try {
      const r = await apiFetch('/api/admin/semaforo/recalc-all', { method:'POST' });
      setMsg(`✅ ${r.recalculated} scores recalculados`);
      await load();
    } catch(e) { setMsg('❌ '+e.message); }
  };

  const recalc = async (id) => {
    try { await apiFetch(`/api/admin/semaforo/${id}/recalc`, {method:'POST'}); await load(); }
    catch {}
  };

  const list = tab === 'buyers' ? data.buyers : data.sellers;
  const filtered = list.filter(u => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'TODOS' || u.traffic_light === filter;
    return matchSearch && matchFilter;
  });

  const counts = { VERDE: list.filter(u=>u.traffic_light==='VERDE').length, AMARILLO: list.filter(u=>u.traffic_light==='AMARILLO').length, ROJO: list.filter(u=>u.traffic_light==='ROJO').length };

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .card{background:white;border-radius:16px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .row:hover{background:#f8fafc!important}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', height:56, justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700, fontSize:15 }}>🚦 Semáforo de Usuarios</span>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={recalcAll} className="btn" style={{ fontSize:12 }}>🔄 Recalcular todos</button>
            <a href="/admin/credits" className="btn" style={{ textDecoration:'none', fontSize:12 }}>💳 Créditos</a>
            <a href="/admin/offers" className="btn" style={{ textDecoration:'none', fontSize:12 }}>🏷️ Ofertas</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {['VERDE','AMARILLO','ROJO'].map(c => (
            <div key={c} onClick={()=>setFilter(filter===c?'TODOS':c)} style={{ background:COLORS[c].bg, border:`2px solid ${filter===c?COLORS[c].dot:COLORS[c].border}`, borderRadius:14, padding:'16px', cursor:'pointer', textAlign:'center' }}>
              <div style={{ fontSize:36, fontWeight:900, color:COLORS[c].text }}>{counts[c]}</div>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS[c].text, textTransform:'uppercase' }}>
                {c==='VERDE'?'🟢 Excelentes':c==='AMARILLO'?'🟡 Regulares':'🔴 En riesgo'}
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{tab==='buyers'?'Compradores':'Vendedores'}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {[['buyers',`🛒 Compradores (${data.buyers.length})`],['sellers',`🏪 Vendedores (${data.sellers.length})`]].map(([key,label])=>(
            <button key={key} onClick={()=>{setTab(key);setFilter('TODOS');setSearch('');}} style={{ padding:'8px 16px', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, background:tab===key?'#0D3B87':'white', color:tab===key?'white':'#64748b', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>{label}</button>
          ))}
          <input placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, width:260 }} />
        </div>

        {/* Table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                  {(tab==='buyers'
                    ? ['Estado','Comprador','Email','Nivel','Puntos','Pedidos','Gasto','Máquinas','Acción']
                    : ['Estado','Vendedor','Negocio','Productos','Ventas','Revenue','Rating','Acción']
                  ).map(h=><th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const C = COLORS[u.traffic_light||'AMARILLO'];
                  return (
                    <tr key={u.buyer_id||u.id} className="row" style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:12, height:12, borderRadius:'50%', background:C.dot, boxShadow:`0 0 8px ${C.dot}` }} />
                          <span style={{ background:C.bg, color:C.text, padding:'2px 10px', borderRadius:20, fontWeight:700, fontSize:11 }}>{u.traffic_light||'AMARILLO'}</span>
                        </div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Score: {u.score||50}/100</div>
                      </td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#0D3B87' }}>{u.buyer_name||u.name}</td>
                      {tab==='buyers' ? <>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'#64748b' }}>{u.email}</td>
                        <td style={{ padding:'10px 14px' }}><span style={{ background:u.level_color+'20'||'#f8fafc', color:u.level_color||'#64748b', padding:'2px 10px', borderRadius:20, fontWeight:700, fontSize:12 }}>{u.icon} {u.loyalty_level||'NUEVO'}</span></td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}><span style={{ background:'#fefce8', color:'#ca8a04', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>⭐{u.loyalty_points||0}</span></td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>{u.total_orders||0}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:'#15803d' }}>{fmtMoney(u.total_spent)}</td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>{u.total_machines||0}</td>
                      </> : <>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'#64748b' }}>{u.business_name||'—'}</td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>{u.total_products||0}</td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>{u.total_sales||0}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:'#15803d' }}>{fmtMoney(u.total_revenue)}</td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>{u.avg_rating ? `⭐${u.avg_rating}` : '—'}</td>
                      </>}
                      <td style={{ padding:'10px 14px' }}>
                        <button onClick={()=>recalc(u.buyer_id||u.id)} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', padding:'5px 10px', borderRadius:8, cursor:'pointer', fontSize:11, color:'#3B75C0', fontWeight:600 }}>🔄 Recalc</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0 && <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>{loading?'Cargando...':'Sin resultados'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
