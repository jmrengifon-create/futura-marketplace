// frontend/pages/admin/credits.js — Gestión de Créditos
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const STATUS_C = { PENDIENTE:{bg:'#fefce8',c:'#ca8a04'}, APROBADO:{bg:'#f0fdf4',c:'#15803d'}, ACTIVO:{bg:'#eff6ff',c:'#3B75C0'}, RECHAZADO:{bg:'#fef2f2',c:'#dc2626'}, PAGADO:{bg:'#f5f3ff',c:'#7c3aed'}, MOROSO:{bg:'#fef2f2',c:'#dc2626'} };
const TL = { VERDE:'🟢', AMARILLO:'🟡', ROJO:'🔴' };
const fmt = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtMoney = n => `S/ ${parseFloat(n||0).toFixed(2)}`;

export default function AdminCredits() {
  const [credits, setCredits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('pending');
  const [msg, setMsg] = useState('');
  const [reviewForm, setReviewForm] = useState({ action:'APROBADO', notes:'', tea_rate:18 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try { const r = await apiFetch('/api/admin/credits'); setCredits(Array.isArray(r)?r:[]); }
    catch {} finally { setLoading(false); }
  };

  const review = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiFetch(`/api/admin/credits/${selected.id}/review`, { method:'POST', body:JSON.stringify(reviewForm) });
      setMsg(`✅ Crédito ${reviewForm.action === 'APROBADO' ? 'aprobado y cuotas generadas' : 'rechazado'}`);
      setSelected(null);
      await load();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const payInstallment = async (instId) => {
    try {
      await apiFetch(`/api/credits/installments/${instId}/pay`, { method:'POST', body:JSON.stringify({ payment_method:'EFECTIVO' }) });
      setMsg('✅ Pago registrado');
      await load();
      if (selected) setSelected(credits.find(c=>c.id===selected.id));
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const checkAlerts = async () => {
    try {
      const r = await apiFetch('/api/admin/credits/check-alerts', { method:'POST' });
      setMsg(`✅ ${r.alerts_sent} alertas enviadas, ${r.overdue_marked} cuotas marcadas vencidas`);
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const filtered = credits.filter(c => {
    if (tab === 'pending') return c.status === 'PENDIENTE';
    if (tab === 'active')  return c.status === 'ACTIVO';
    if (tab === 'overdue') return c.status === 'MOROSO' || parseInt(c.overdue_installments||0)>0;
    return true;
  });

  const totalActive = credits.filter(c=>c.status==='ACTIVO').reduce((a,c)=>a+parseFloat(c.amount||0),0);
  const totalPending = credits.filter(c=>c.status==='PENDIENTE').length;
  const totalOverdue = credits.filter(c=>parseInt(c.overdue_installments||0)>0).length;

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn-sm{padding:5px 10px;font-size:12px;border-radius:8px}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .btn-red{background:linear-gradient(135deg,#dc2626,#ef4444)}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', height:56, justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700, fontSize:15 }}>💳 Gestión de Créditos</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={checkAlerts} className="btn" style={{ fontSize:12, background:'linear-gradient(135deg,#ca8a04,#eab308)' }}>🔔 Revisar Alertas</button>
            <a href="/admin/semaforo" className="btn" style={{ textDecoration:'none', fontSize:12 }}>🚦 Semáforo</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[['💳','Créditos Activos',credits.filter(c=>c.status==='ACTIVO').length,'#eff6ff','#3B75C0'],['⏳','Pendientes Revisión',totalPending,'#fefce8','#ca8a04'],['🔴','Con Cuotas Vencidas',totalOverdue,'#fef2f2','#dc2626'],['💰','Portfolio Total',`S/ ${totalActive.toLocaleString('es-PE',{minimumFractionDigits:0})}` ,'#f0fdf4','#15803d']].map(([i,l,v,bg,c])=>(
            <div key={l} className="card" style={{ background:bg, border:`1px solid ${c}20` }}>
              <div style={{ fontSize:22 }}>{i}</div>
              <div style={{ fontSize:10, color:c, fontWeight:700, textTransform:'uppercase', marginTop:6 }}>{l}</div>
              <div style={{ fontSize:22, fontWeight:900, color:c, marginTop:2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[['pending',`⏳ Pendientes (${totalPending})`],['active','✅ Activos'],['overdue',`🔴 Vencidos (${totalOverdue})`],['all','📋 Todos']].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{ padding:'7px 14px', border:'none', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:tab===key?700:400, background:tab===key?'#0D3B87':'white', color:tab===key?'white':'#64748b', boxShadow:'0 2px 6px rgba(0,0,0,0.06)' }}>{label}</button>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                {['Semáforo','Comprador','Monto','Cuota/mes','Cuotas','Estado','Vencidas/Pagadas','Solicitado','Acción'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(c=>(
                  <tr key={c.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={{ padding:'10px 12px', fontSize:18 }}>{TL[c.traffic_light||'AMARILLO']}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontWeight:700, color:'#0D3B87' }}>{c.buyer_name}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{c.email}</div>
                    </td>
                    <td style={{ padding:'10px 12px', fontWeight:700 }}>{fmtMoney(c.amount)}</td>
                    <td style={{ padding:'10px 12px' }}>{fmtMoney(c.monthly_payment)}/mes</td>
                    <td style={{ padding:'10px 12px', textAlign:'center' }}>{c.installments}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:STATUS_C[c.status]?.bg||'#f8fafc', color:STATUS_C[c.status]?.c||'#64748b', padding:'3px 10px', borderRadius:20, fontWeight:700, fontSize:11 }}>{c.status}</span>
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'center', fontSize:12 }}>
                      {parseInt(c.overdue_installments||0)>0 && <span style={{ color:'#dc2626', fontWeight:700 }}>🔴 {c.overdue_installments} venc.</span>}
                      {' '}{c.paid_installments||0}/{c.total_installments||c.installments} pagadas
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:'#94a3b8' }}>{fmt(c.created_at)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <button onClick={()=>setSelected(c)} className="btn btn-sm">Ver detalle</button>
                    </td>
                  </tr>
                ))}
                {filtered.length===0 && <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>{loading?'Cargando...':'Sin créditos en esta categoría'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal detalle crédito */}
      {selected && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0D3B87' }}>💳 Crédito #{selected.id} — {selected.buyer_name}</h3>
              <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[['Monto',fmtMoney(selected.amount)],['Inicial',fmtMoney(selected.initial_payment)],['Cuota/mes',fmtMoney(selected.monthly_payment)],['Total c/int.',fmtMoney(selected.total_with_interest)],['Cuotas',selected.installments+' meses'],['TEA',selected.tea_rate+'%']].map(([l,v])=>(
                <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>{l}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#0D3B87' }}>{v}</div>
                </div>
              ))}
            </div>

            {selected.purpose && <div style={{ background:'#eff6ff', borderRadius:10, padding:'10px 12px', marginBottom:14, fontSize:13, color:'#475569' }}><strong>Propósito:</strong> {selected.purpose}</div>}

            {/* Formulario de revisión si está pendiente */}
            {selected.status === 'PENDIENTE' && (
              <form onSubmit={review} style={{ borderTop:'1px solid #f1f5f9', paddingTop:16, display:'flex', flexDirection:'column', gap:12 }}>
                <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:'#0D3B87' }}>Decisión del administrador</h4>
                <select value={reviewForm.action} onChange={e=>setReviewForm(p=>({...p,action:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="APROBADO">✅ Aprobar crédito</option>
                  <option value="RECHAZADO">❌ Rechazar solicitud</option>
                </select>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>TEA (%)</label>
                    <input type="number" step="0.01" value={reviewForm.tea_rate} onChange={e=>setReviewForm(p=>({...p,tea_rate:e.target.value}))} style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                </div>
                <textarea rows={3} placeholder="Notas (opcional)" value={reviewForm.notes} onChange={e=>setReviewForm(p=>({...p,notes:e.target.value}))} style={{ padding:'10px 12px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button type="submit" className={`btn ${reviewForm.action==='APROBADO'?'btn-green':'btn-red'}`} style={{ flex:1, padding:12 }}>
                    {reviewForm.action==='APROBADO'?'✅ Aprobar y generar cuotas':'❌ Rechazar solicitud'}
                  </button>
                  <button type="button" onClick={()=>setSelected(null)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
