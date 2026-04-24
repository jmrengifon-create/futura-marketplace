// frontend/pages/vendor/offers.js — Panel de Ofertas del Vendedor
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';

export default function VendorOffers() {
  const [offers, setOffers]     = useState([]);
  const [machines, setMachines] = useState([]);
  const [products, setProducts] = useState([]);
  const [msg, setMsg]           = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', discount_pct:0, offer_type:'DESCUENTO', target_audience:'TODOS', machine_id:'', product_id:'', valid_until:'', send_email:true, send_wa:true });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'VENDEDOR') { window.location.href='/login'; return; }
    load();
  }, []);

  const load = async () => {
    try {
      const [o, m, p] = await Promise.all([
        apiFetch('/api/vendor/offers').catch(()=>[]),
        apiFetch('/api/admin/crm/machines').catch(()=>[]),
        apiFetch('/api/products?seller=me').catch(()=>[]),
      ]);
      setOffers(Array.isArray(o)?o:[]); setMachines(Array.isArray(m)?m:[]); setProducts(Array.isArray(p)?p:[]);
    } catch {}
  };

  const createOffer = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/offers', { method:'POST', body:JSON.stringify(form) });
      setMsg('✅ Oferta enviada para aprobación del administrador');
      setShowForm(false);
      setForm({ title:'', description:'', discount_pct:0, offer_type:'DESCUENTO', target_audience:'TODOS', machine_id:'', product_id:'', valid_until:'', send_email:true, send_wa:true });
      load();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const STATUS_C = { PENDIENTE:{bg:'#fefce8',c:'#ca8a04'}, APROBADA:{bg:'#f0fdf4',c:'#15803d'}, RECHAZADA:{bg:'#fef2f2',c:'#dc2626'}, BORRADOR:{bg:'#f8fafc',c:'#64748b'} };

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <a href="/" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Inicio</a>
          <span style={{ color:'white', fontWeight:700, fontSize:15 }}>🏷️ Mis Ofertas</span>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn" style={{ fontSize:12 }}>+ Nueva Oferta</button>
      </header>

      <div style={{ maxWidth:1000, margin:'20px auto', padding:'0 24px' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        <div style={{ background:'#eff6ff', borderRadius:12, padding:'14px 18px', marginBottom:20, fontSize:13, color:'#3B75C0', border:'1px solid #bfdbfe' }}>
          💡 <strong>Cómo funciona:</strong> Crea una oferta → El administrador la revisa y aprueba → Se envía automáticamente a los compradores por notificación, WhatsApp y email.
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {offers.map(o=>(
            <div key={o.id} className="card" style={{ borderLeft:`4px solid ${o.status==='APROBADA'?'#22c55e':o.status==='PENDIENTE'?'#eab308':'#ef4444'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ background:STATUS_C[o.status]?.bg||'#f8fafc', color:STATUS_C[o.status]?.c||'#64748b', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{o.status}</span>
                {o.discount_pct > 0 && <span style={{ background:'#dc2626', color:'white', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{o.discount_pct}% OFF</span>}
              </div>
              <h3 style={{ margin:'0 0 6px', fontSize:14, fontWeight:700, color:'#0D3B87' }}>{o.title}</h3>
              <p style={{ fontSize:12, color:'#64748b', margin:'0 0 10px' }}>{o.description?.substring(0,80)}...</p>
              <div style={{ fontSize:11, color:'#94a3b8' }}>
                <div>🎯 {o.target_audience} · 📅 Vence: {fmt(o.valid_until)}</div>
                {o.admin_notes && <div style={{ marginTop:4, color:'#ca8a04' }}>💬 Admin: {o.admin_notes}</div>}
              </div>
              {o.status === 'APROBADA' && (
                <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #f1f5f9', fontSize:11, color:'#15803d' }}>
                  👁️ {o.views||0} vistas · 🖱️ {o.clicks||0} clics
                </div>
              )}
            </div>
          ))}
          {offers.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px', color:'#94a3b8' }}>
              <div style={{ fontSize:48 }}>🏷️</div>
              <p>No tienes ofertas todavía. ¡Crea tu primera oferta!</p>
              <button onClick={()=>setShowForm(true)} className="btn">+ Crear primera oferta</button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 18px', fontSize:16, fontWeight:800, color:'#0D3B87' }}>🏷️ Crear Nueva Oferta</h3>
            <form onSubmit={createOffer} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input required value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Título de la oferta *" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              <textarea rows={3} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Descripción detallada de la oferta" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>Tipo de oferta</label>
                  <select value={form.offer_type} onChange={e=>setForm(p=>({...p,offer_type:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                    {['DESCUENTO','2X1','REGALO','ENVIO_GRATIS','OTRO'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>Descuento (%)</label>
                  <input type="number" min="0" max="100" value={form.discount_pct} onChange={e=>setForm(p=>({...p,discount_pct:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
              </div>
              <select value={form.target_audience} onChange={e=>setForm(p=>({...p,target_audience:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="TODOS">👥 Todos los compradores</option>
                <option value="VIP">⭐ Solo VIP (score verde)</option>
                <option value="NUEVOS">🌱 Solo nuevos compradores</option>
                <option value="MAQUINA_ESPECIFICA">🖨️ Dueños de máquina específica</option>
              </select>
              {form.target_audience === 'MAQUINA_ESPECIFICA' && (
                <select value={form.machine_id} onChange={e=>setForm(p=>({...p,machine_id:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="">Seleccionar máquina...</option>
                  {machines.map(m=><option key={m.id} value={m.id}>{m.name} — {m.model}</option>)}
                </select>
              )}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>Fecha de vencimiento</label>
                <input type="date" value={form.valid_until} onChange={e=>setForm(p=>({...p,valid_until:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', gap:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={form.send_email} onChange={e=>setForm(p=>({...p,send_email:e.target.checked}))} style={{ accentColor:'#3B75C0', width:16, height:16 }} />
                  📧 Enviar por email
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={form.send_wa} onChange={e=>setForm(p=>({...p,send_wa:e.target.checked}))} style={{ accentColor:'#25d366', width:16, height:16 }} />
                  📱 Enviar por WhatsApp
                </label>
              </div>
              <div style={{ background:'#fffbeb', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#92400e' }}>
                ⚠️ La oferta será enviada al administrador para su aprobación antes de publicarse.
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn" style={{ flex:1, padding:12 }}>📤 Enviar para aprobación</button>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
