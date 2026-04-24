// frontend/pages/admin/offers.js — Gestión de Ofertas de Vendedores
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';

export default function AdminOffers() {
  const [offers, setOffers]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab]         = useState('pending');
  const [msg, setMsg]         = useState('');
  const [reviewForm, setReviewForm] = useState({ action:'APROBADA', notes:'' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    load();
  }, []);

  const load = async () => {
    try { const r = await apiFetch('/api/admin/offers'); setOffers(Array.isArray(r)?r:[]); }
    catch {}
  };

  const review = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/offers/${selected.id}/approve`, { method:'POST', body:JSON.stringify(reviewForm) });
      setMsg(`✅ Oferta ${reviewForm.action === 'APROBADA' ? 'aprobada y enviada a compradores' : 'rechazada'}`);
      setSelected(null);
      load();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const filtered = offers.filter(o => {
    if (tab === 'pending') return o.status === 'PENDIENTE';
    if (tab === 'approved') return o.status === 'APROBADA';
    if (tab === 'rejected') return o.status === 'RECHAZADA';
    return true;
  });

  const pending  = offers.filter(o=>o.status==='PENDIENTE').length;
  const approved = offers.filter(o=>o.status==='APROBADA').length;

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn-sm{padding:5px 10px;font-size:12px;border-radius:8px}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .btn-red{background:linear-gradient(135deg,#dc2626,#ef4444)}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>🏷️ Ofertas de Vendedores</span>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:12, color:'#A8CAEA' }}>
              {pending > 0 && <span style={{ background:'#ca8a04', color:'white', padding:'2px 10px', borderRadius:20, fontWeight:700, animation:'pulse 2s infinite' }}>⏳ {pending} pendientes</span>}
              <span>✅ {approved} aprobadas</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {[['pending',`⏳ Pendientes (${pending})`],['approved',`✅ Aprobadas (${approved})`],['rejected','❌ Rechazadas'],['all','📋 Todas']].map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent' }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {filtered.map(o=>(
            <div key={o.id} className="card" style={{ borderTop:`4px solid ${o.status==='APROBADA'?'#22c55e':o.status==='PENDIENTE'?'#eab308':'#ef4444'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <span style={{ background:o.status==='APROBADA'?'#f0fdf4':o.status==='PENDIENTE'?'#fefce8':'#fef2f2', color:o.status==='APROBADA'?'#15803d':o.status==='PENDIENTE'?'#ca8a04':'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, display:'block', marginBottom:6 }}>{o.status}</span>
                  <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:'#0D3B87' }}>{o.title}</h3>
                </div>
                {o.discount_pct > 0 && <div style={{ background:'#dc2626', color:'white', borderRadius:10, padding:'6px 10px', textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:18, fontWeight:900 }}>{o.discount_pct}%</div>
                  <div style={{ fontSize:9, textTransform:'uppercase' }}>descuento</div>
                </div>}
              </div>
              <p style={{ fontSize:13, color:'#475569', margin:'0 0 10px' }}>{o.description?.substring(0,100)}{o.description?.length>100?'...':''}</p>
              <div style={{ fontSize:11, color:'#94a3b8', display:'flex', flexDirection:'column', gap:3, marginBottom:12 }}>
                <span>🏪 {o.business_name||o.seller_name}</span>
                <span>🎯 Audiencia: {o.target_audience}</span>
                {o.product_title && <span>📦 Producto: {o.product_title}</span>}
                {o.machine_name && <span>🖨️ Máquina: {o.machine_name}</span>}
                {o.valid_until && <span>⏰ Vence: {fmt(o.valid_until)}</span>}
              </div>
              {o.status === 'PENDIENTE' && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>{setSelected(o);setReviewForm({action:'APROBADA',notes:'Oferta aprobada para publicación.'});}} className="btn btn-sm btn-green" style={{ flex:1 }}>✅ Aprobar</button>
                  <button onClick={()=>{setSelected(o);setReviewForm({action:'RECHAZADA',notes:''});}} className="btn btn-sm btn-red" style={{ flex:1 }}>❌ Rechazar</button>
                </div>
              )}
              {o.status === 'APROBADA' && <div style={{ fontSize:12, color:'#15803d' }}>👁️ {o.views||0} vistas · 🖱️ {o.clicks||0} clics</div>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px', color:'#94a3b8' }}>
              <div style={{ fontSize:48 }}>🏷️</div>
              <p>Sin ofertas en esta categoría</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800, color:'#0D3B87' }}>Revisión de Oferta: {selected.title}</h3>
            <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
              <div><strong>Vendedor:</strong> {selected.business_name||selected.seller_name}</div>
              <div><strong>Descuento:</strong> {selected.discount_pct}% · <strong>Tipo:</strong> {selected.offer_type}</div>
              <div><strong>Audiencia:</strong> {selected.target_audience}</div>
              {selected.description && <div style={{ marginTop:8, color:'#475569' }}>{selected.description}</div>}
            </div>
            <form onSubmit={review} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <select value={reviewForm.action} onChange={e=>setReviewForm(p=>({...p,action:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="APROBADA">✅ Aprobar — Publicar a compradores</option>
                <option value="RECHAZADA">❌ Rechazar — Notificar al vendedor</option>
              </select>
              <textarea rows={3} value={reviewForm.notes} onChange={e=>setReviewForm(p=>({...p,notes:e.target.value}))} placeholder="Notas para el vendedor (motivo de rechazo, sugerencias...)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className={`btn ${reviewForm.action==='APROBADA'?'btn-green':'btn-red'}`} style={{ flex:1, padding:12 }}>
                  {reviewForm.action==='APROBADA'?'✅ Aprobar y notificar compradores':'❌ Rechazar y notificar vendedor'}
                </button>
                <button type="button" onClick={()=>setSelected(null)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
