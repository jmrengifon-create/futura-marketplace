import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v||0).toFixed(2)}`;

const SEMAFORO = (c) => {
  if (c.status==='PENDIENTE') return { color:'#ca8a04', bg:'#fefce8', icon:'⏳', label:'Pendiente' };
  if (c.blocked)              return { color:'#dc2626', bg:'#fef2f2', icon:'🚫', label:'Bloqueado' };
  if (parseInt(c.cuotas_vencidas)>0) return { color:'#ea580c', bg:'#fff7ed', icon:'⚠️', label:'En mora' };
  if (c.status==='ACTIVO')    return { color:'#15803d', bg:'#f0fdf4', icon:'✅', label:'Al día' };
  if (c.status==='PAGADO')    return { color:'#7c3aed', bg:'#f5f3ff', icon:'⭐', label:'Pagado' };
  if (c.status==='RECHAZADO') return { color:'#dc2626', bg:'#fef2f2', icon:'❌', label:'Rechazado' };
  return { color:'#64748b', bg:'#f8fafc', icon:'•', label:c.status };
};

export default function AdminCredits() {
  const [credits,  setCredits]  = useState([]);
  const [stats,    setStats]    = useState({});
  const [rates,    setRates]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('TODOS');
  const [selected, setSelected] = useState(null);
  const [installs, setInstalls] = useState([]);
  const [msg,      setMsg]      = useState('');
  const [sending,  setSending]  = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payingInst, setPayingInst] = useState(null);
  const [payForm, setPayForm]   = useState({ amount:'', payment_method:'TRANSFERENCIA', reference_code:'', notes:'' });
  const [editRate, setEditRate] = useState(null);
  const [tab, setTab]           = useState('creditos');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role')!=='ADMIN') { window.location.href='/login'; return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        apiFetch('/api/admin/credits'),
        apiFetch('/api/admin/credit-rates').catch(()=>[]),
      ]);
      setCredits(c.credits||[]); setStats(c.stats||{}); setRates(Array.isArray(r)?r:[]);
    } catch(e) { setMsg('❌ '+e.message); }
    setLoading(false);
  };

  const loadInstallments = async (creditId) => {
    try {
      const r = await apiFetch(`/api/buyer/credits`);
      const all = r.installments||[];
      setInstalls(all.filter(i=>i.credit_id===creditId));
    } catch {}
  };

  const approve = async (id) => {
    setSending(true);
    try {
      const r = await apiFetch(`/api/admin/credits/${id}/approve`, { method:'PUT' });
      setMsg(`✅ Crédito aprobado — ${r.installments} cuotas generadas`);
      loadAll();
      if (selected?.id===id) { setSelected(credits.find(c=>c.id===id)); loadInstallments(id); }
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const reject = async (id) => {
    if (!rejectReason) return setMsg('❌ Ingresa el motivo de rechazo');
    setSending(true);
    try {
      await apiFetch(`/api/admin/credits/${id}/reject`, { method:'PUT', body:JSON.stringify({ reason:rejectReason }) });
      setMsg('✅ Crédito rechazado');
      setRejectId(null); setRejectReason('');
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const checkOverdue = async () => {
    setSending(true);
    try {
      const r = await apiFetch('/api/admin/credits/check-overdue', { method:'POST' });
      setMsg(`✅ ${r.message}`);
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const payInstall = async (creditId, instId) => {
    if (!payForm.amount) return setMsg('❌ Ingresa el monto pagado');
    setSending(true);
    try {
      await apiFetch(`/api/admin/credits/${creditId}/pay/${instId}`, { method:'POST', body:JSON.stringify(payForm) });
      setMsg('✅ Pago registrado');
      setPayingInst(null);
      setPayForm({ amount:'', payment_method:'TRANSFERENCIA', reference_code:'', notes:'' });
      loadInstallments(creditId);
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const saveRate = async (id) => {
    try {
      await apiFetch(`/api/admin/credit-rates/${id}`, { method:'PUT', body:JSON.stringify({ monthly_rate: editRate.monthly_rate }) });
      setMsg('✅ Tasa actualizada');
      setEditRate(null);
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
  };

  const filtered = filter==='TODOS' ? credits : filter==='MORA' ? credits.filter(c=>parseInt(c.cuotas_vencidas)>0) : credits.filter(c=>c.status===filter);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0f4f8' }}>
      <div style={{ fontSize:14, color:'#64748b' }}>Cargando panel de créditos...</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn:disabled{opacity:0.6;cursor:not-allowed}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .btn-red{background:linear-gradient(135deg,#dc2626,#ef4444)}
        .btn-amber{background:linear-gradient(135deg,#d97706,#f59e0b)}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .row:hover{background:#f8fafc}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#3B75C0!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 24px', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:52 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700 }}>💳 Gestión de Créditos</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={checkOverdue} className="btn btn-amber" disabled={sending} style={{ fontSize:12 }}>
              ⚠️ Revisar Mora
            </button>
          </div>
        </div>
        <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', gap:2 }}>
          {[['creditos','💳 Créditos'],['tasas','📊 Tasas']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===k?700:400, color:tab===k?'white':'#64748b', borderBottom:tab===k?'3px solid #3B75C0':'3px solid transparent' }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1400, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>

        {msg && (
          <div style={{ padding:'12px 16px', borderRadius:10, marginBottom:16, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}>
            <span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button>
          </div>
        )}

        {/* TAB: Créditos */}
        {tab==='creditos' && (
          <>
            {/* KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
              {[
                ['💳','Créditos Activos', stats.activos||0, '#2563eb'],
                ['⏳','Pendientes',       stats.pendientes||0, '#ca8a04'],
                ['⚠️','Con Mora',         stats.con_mora||0, '#dc2626'],
                ['💰','Portfolio Total',  fmt(stats.portfolio||0), '#15803d'],
              ].map(([icon,label,value,color])=>(
                <div key={label} className="card" style={{ borderTop:`4px solid ${color}` }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{label}</div>
                  <div style={{ fontSize:24, fontWeight:900, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {[['TODOS','📋 Todos'],['PENDIENTE','⏳ Pendientes'],['ACTIVO','✅ Activos'],['MORA','⚠️ En mora'],['PAGADO','⭐ Pagados'],['RECHAZADO','❌ Rechazados']].map(([k,l])=>(
                <button key={k} onClick={()=>setFilter(k)}
                  style={{ padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:filter===k?700:500, background:filter===k?'#2563eb':'white', color:filter===k?'white':'#374151', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
                  {l} {k==='TODOS'?`(${credits.length})`:k==='MORA'?`(${credits.filter(c=>parseInt(c.cuotas_vencidas)>0).length})`:`(${credits.filter(c=>c.status===k).length})`}
                </button>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap:16 }}>
              {/* Lista */}
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                      {['Semáforo','Comprador','Monto','Cuota/mes','Cuotas','Estado','Vencidas','Solicitado','Acción'].map(h=>(
                        <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length===0 ? (
                      <tr><td colSpan={9} style={{ padding:40, textAlign:'center', color:'#64748b' }}>Sin créditos en esta categoría</td></tr>
                    ) : filtered.map(c => {
                      const sem = SEMAFORO(c);
                      return (
                        <tr key={c.id} className="row" style={{ borderBottom:'1px solid #f1f5f9', cursor:'pointer', background:selected?.id===c.id?'#eff6ff':'white' }}
                          onClick={()=>{ setSelected(c); loadInstallments(c.id); }}>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ width:36, height:36, borderRadius:'50%', background:sem.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, border:`2px solid ${sem.color}30` }}>
                              {sem.icon}
                            </div>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ fontWeight:700 }}>{c.buyer_name}</div>
                            <div style={{ fontSize:11, color:'#64748b' }}>{c.buyer_email}</div>
                          </td>
                          <td style={{ padding:'12px 14px', fontWeight:800, color:'#0D3B87' }}>{fmt(c.amount)}</td>
                          <td style={{ padding:'12px 14px' }}>{fmt(c.monthly_payment)}</td>
                          <td style={{ padding:'12px 14px', textAlign:'center' }}>
                            <span style={{ background:'#eff6ff', color:'#2563eb', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>
                              {c.cuotas_pagadas}/{c.total_cuotas||c.installments}
                            </span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ background:sem.bg, color:sem.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{sem.label}</span>
                          </td>
                          <td style={{ padding:'12px 14px', textAlign:'center' }}>
                            {parseInt(c.cuotas_vencidas)>0 && (
                              <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>{c.cuotas_vencidas}</span>
                            )}
                          </td>
                          <td style={{ padding:'12px 14px', color:'#64748b', fontSize:11 }}>
                            {new Date(c.created_at).toLocaleDateString('es-PE')}
                          </td>
                          <td style={{ padding:'12px 14px' }} onClick={e=>e.stopPropagation()}>
                            <div style={{ display:'flex', gap:4 }}>
                              {c.status==='PENDIENTE' && (
                                <>
                                  <button onClick={()=>approve(c.id)} className="btn btn-green" disabled={sending} style={{ padding:'5px 10px', fontSize:11 }}>✅ Aprobar</button>
                                  <button onClick={()=>setRejectId(c.id)} className="btn btn-red" style={{ padding:'5px 10px', fontSize:11 }}>❌</button>
                                </>
                              )}
                              {c.status==='ACTIVO' && (
                                <button onClick={()=>{ setSelected(c); loadInstallments(c.id); setTab('creditos'); }} className="btn" style={{ padding:'5px 10px', fontSize:11 }}>📋 Ver</button>
                              )}
                            </div>
                            {rejectId===c.id && (
                              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }} onClick={e=>e.stopPropagation()}>
                                <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Motivo de rechazo"
                                  style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid #fca5a5', fontSize:12 }}/>
                                <div style={{ display:'flex', gap:4 }}>
                                  <button onClick={()=>reject(c.id)} className="btn btn-red" disabled={sending} style={{ padding:'5px 10px', fontSize:11, flex:1 }}>Confirmar</button>
                                  <button onClick={()=>setRejectId(null)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:11 }}>✕</button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Panel detalle */}
              {selected && (
                <div className="card" style={{ position:'sticky', top:20, maxHeight:'80vh', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15, color:'#0D3B87' }}>{selected.buyer_name}</div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{fmt(selected.amount)} · {selected.installments} cuotas · {selected.interest_rate}% mensual</div>
                    </div>
                    <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748b' }}>✕</button>
                  </div>

                  {selected.penalty_amount>0 && (
                    <div style={{ background:'#fef2f2', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#dc2626', fontWeight:600 }}>
                      ⚠️ Penalidad acumulada: {fmt(selected.penalty_amount)}
                    </div>
                  )}

                  <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87', marginBottom:10 }}>📅 Tabla de Amortización</div>
                  {installs.length===0 ? (
                    <div style={{ textAlign:'center', padding:20, color:'#64748b', fontSize:13 }}>
                      {selected.status==='PENDIENTE' ? 'Aprueba el crédito para generar las cuotas' : 'Sin cuotas generadas'}
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {installs.map(inst => {
                        const STATUS_COLOR = { PENDIENTE:{bg:'#fefce8',color:'#ca8a04'}, PAGADA:{bg:'#f0fdf4',color:'#15803d'}, VENCIDA:{bg:'#fef2f2',color:'#dc2626'}, PARCIAL:{bg:'#eff6ff',color:'#2563eb'} };
                        const st = STATUS_COLOR[inst.status]||STATUS_COLOR.PENDIENTE;
                        const totalDue = parseFloat(inst.amount)+parseFloat(inst.penalty||0);
                        return (
                          <div key={inst.id} style={{ border:`1px solid ${inst.status==='VENCIDA'?'#fca5a5':'#f1f5f9'}`, borderRadius:10, padding:'10px 12px', background:inst.status==='VENCIDA'?'#fff5f5':'white' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                              <div style={{ fontWeight:700, fontSize:13 }}>Cuota #{inst.installment_num}</div>
                              <span style={{ background:st.bg, color:st.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{inst.status}</span>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:11, color:'#64748b', marginBottom:6 }}>
                              <span>Vence: <strong style={{ color:'#374151' }}>{new Date(inst.due_date).toLocaleDateString('es-PE')}</strong></span>
                              <span>Total: <strong style={{ color:'#0D3B87' }}>{fmt(totalDue)}</strong></span>
                              <span>Capital: {fmt(inst.principal)}</span>
                              <span>Interés: {fmt(inst.interest)}</span>
                              {parseFloat(inst.penalty)>0 && <span style={{ color:'#dc2626' }}>Penalidad: {fmt(inst.penalty)}</span>}
                              {parseFloat(inst.paid_amount)>0 && <span style={{ color:'#15803d' }}>Pagado: {fmt(inst.paid_amount)}</span>}
                            </div>
                            {inst.status!=='PAGADA' && (
                              payingInst===inst.id ? (
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  <input type="number" placeholder={`Monto (S/ ${totalDue.toFixed(2)})`} value={payForm.amount}
                                    onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))}
                                    style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:12 }}/>
                                  <select value={payForm.payment_method} onChange={e=>setPayForm(p=>({...p,payment_method:e.target.value}))}
                                    style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:12 }}>
                                    <option value="TRANSFERENCIA">Transferencia</option>
                                    <option value="EFECTIVO">Efectivo</option>
                                    <option value="YAPE">Yape</option>
                                    <option value="PLIN">Plin</option>
                                  </select>
                                  <input placeholder="Referencia" value={payForm.reference_code}
                                    onChange={e=>setPayForm(p=>({...p,reference_code:e.target.value}))}
                                    style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:12 }}/>
                                  <div style={{ display:'flex', gap:4 }}>
                                    <button onClick={()=>payInstall(inst.credit_id, inst.id)} className="btn btn-green" disabled={sending} style={{ flex:1, padding:'6px', fontSize:11 }}>
                                      {sending?'...':'✓ Registrar Pago'}
                                    </button>
                                    <button onClick={()=>setPayingInst(null)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:11 }}>✕</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={()=>setPayingInst(inst.id)} className="btn" style={{ width:'100%', padding:'6px', fontSize:11 }}>
                                  💳 Registrar Pago
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB: Tasas */}
        {tab==='tasas' && (
          <div className="card" style={{ maxWidth:600 }}>
            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📊 Tasas de Interés por Plazo</h3>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                  {['Plazo','Descripción','Tasa mensual','Acción'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rates.map(r=>(
                  <tr key={r.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'12px 14px', fontWeight:700 }}>{r.min_installments}-{r.max_installments} cuotas</td>
                    <td style={{ padding:'12px 14px', color:'#64748b' }}>{r.description}</td>
                    <td style={{ padding:'12px 14px' }}>
                      {editRate?.id===r.id ? (
                        <input type="number" step="0.01" value={editRate.monthly_rate}
                          onChange={e=>setEditRate(p=>({...p,monthly_rate:e.target.value}))}
                          style={{ width:80, padding:'6px 10px', borderRadius:8, border:'1.5px solid #3B75C0', fontSize:13 }}/>
                      ) : (
                        <span style={{ background:r.monthly_rate===0?'#f0fdf4':'#eff6ff', color:r.monthly_rate===0?'#15803d':'#2563eb', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>
                          {r.monthly_rate}%
                        </span>
                      )}
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      {editRate?.id===r.id ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={()=>saveRate(r.id)} className="btn btn-green" style={{ padding:'5px 10px', fontSize:11 }}>✓ Guardar</button>
                          <button onClick={()=>setEditRate(null)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:11 }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={()=>setEditRate({...r})} className="btn" style={{ padding:'5px 10px', fontSize:11 }}>✏️ Editar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
