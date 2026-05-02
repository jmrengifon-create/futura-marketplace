import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v||0).toFixed(2)}`;

const STATUS_COLOR = {
  PENDIENTE: { bg:'#fefce8', color:'#ca8a04', label:'Pendiente' },
  PAGADA:    { bg:'#f0fdf4', color:'#15803d', label:'Pagada ✓' },
  VENCIDA:   { bg:'#fef2f2', color:'#dc2626', label:'Vencida ⚠' },
  PARCIAL:   { bg:'#eff6ff', color:'#2563eb', label:'Parcial' },
};

const CREDIT_STATUS = {
  PENDIENTE:  { bg:'#fefce8', color:'#ca8a04', label:'En revisión' },
  ACTIVO:     { bg:'#f0fdf4', color:'#15803d', label:'Activo ✓' },
  RECHAZADO:  { bg:'#fef2f2', color:'#dc2626', label:'Rechazado' },
  PAGADO:     { bg:'#f5f3ff', color:'#7c3aed', label:'Completado ⭐' },
};

export default function BuyerCredits() {
  const [credits,      setCredits]      = useState([]);
  const [installments, setInstallments] = useState([]);
  const [benefits,     setBenefits]     = useState([]);
  const [rates,        setRates]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('creditos');
  const [msg,          setMsg]          = useState('');
  const [form,         setForm]         = useState({ amount:'', installments:'3', notes:'' });
  const [paying,       setPaying]       = useState(null);
  const [payForm,      setPayForm]      = useState({ amount:'', payment_method:'TRANSFERENCIA', reference_code:'' });
  const [sending,      setSending]      = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { window.location.href='/login'; return; }

    // Leer parámetros de URL
    const params        = new URLSearchParams(window.location.search);
    const productAmount = params.get('amount');
    const productName   = params.get('name');
    if (productAmount) {
      setForm(prev => ({ ...prev, amount: productAmount }));
      setShowForm(true);
      if (productName) setMsg(`💳 Financiando: ${decodeURIComponent(productName)}`);
    }

    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, b, r] = await Promise.all([
        apiFetch('/api/buyer/credits'),
        apiFetch('/api/buyer/credits/benefits').catch(()=>[]),
        apiFetch('/api/admin/credit-rates').catch(()=>[]),
      ]);
      setCredits(c.credits||[]);
      setInstallments(c.installments||[]);
      setBenefits(Array.isArray(b)?b:[]);
      setRates(Array.isArray(r)?r:[]);
    } catch(e) { setMsg('❌ '+e.message); }
    setLoading(false);
  };

  const getRate = () => {
    const n = parseInt(form.installments);
    const r = rates.find(r => n >= r.min_installments && n <= r.max_installments);
    return r ? parseFloat(r.monthly_rate) : 0;
  };

  const calcPayment = () => {
    const A = parseFloat(form.amount)||0;
    const n = parseInt(form.installments)||1;
    const r = getRate()/100;
    if (r===0) return (A/n).toFixed(2);
    return (A*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1)).toFixed(2);
  };

  const calcTotal = () => (parseFloat(calcPayment()) * parseInt(form.installments||1)).toFixed(2);

  const requestCredit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const params        = new URLSearchParams(window.location.search);
      const product_id    = params.get('product')  || null;
      const product_name  = params.get('name')     || null;
      const product_price = params.get('amount')   || null;

      const r = await apiFetch('/api/buyer/credits/request', {
        method: 'POST',
        body: JSON.stringify({
          amount:        parseFloat(form.amount),
          installments:  parseInt(form.installments),
          notes:         form.notes,
          product_id:    product_id ? parseInt(product_id) : null,
          product_name:  product_name ? decodeURIComponent(product_name) : null,
          product_price: product_price ? parseFloat(product_price) : null,
        })
      });
      setMsg(`✅ Solicitud enviada. Cuota: ${fmt(r.monthly_payment)} · Tasa: ${r.interest_rate}% mensual`);
      setForm({ amount:'', installments:'3', notes:'' });
      setShowForm(false);
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const payInstallment = async (creditId, instId) => {
    setSending(true);
    try {
      await apiFetch(`/api/buyer/credits/${creditId}/pay/${instId}`, {
        method:'POST', body:JSON.stringify(payForm)
      });
      setMsg('✅ Pago registrado correctamente');
      setPaying(null);
      setPayForm({ amount:'', payment_method:'TRANSFERENCIA', reference_code:'' });
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  // SSR guard — no renderizar hasta que esté en el cliente
  if (!mounted) return null;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0f4f8' }}>
      <div style={{ fontSize:14, color:'#64748b' }}>Cargando créditos...</div>
    </div>
  );

  const activeCredit = credits.find(c=>c.status==='ACTIVO');

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#2563eb,#3b82f6);color:white;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn:disabled{opacity:0.6;cursor:not-allowed}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .card{background:white;border-radius:16px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#2563eb!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 24px', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:52 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/buyer/dashboard" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Mi Panel</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700 }}>💳 Mis Créditos</span>
          </div>
          <button onClick={()=>setShowForm(!showForm)} className="btn" style={{ fontSize:12 }}>
            + Solicitar Crédito
          </button>
        </div>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', gap:2 }}>
          {[['creditos','💳 Mis Créditos'],['cuotas','📅 Mis Cuotas'],['beneficios','⭐ Beneficios']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===k?700:400, color:tab===k?'white':'#64748b', borderBottom:tab===k?'3px solid #3B75C0':'3px solid transparent' }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>

        {msg && (
          <div style={{ padding:'12px 16px', borderRadius:10, marginBottom:16, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}>
            <span>{msg}</span>
            <button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div className="card" style={{ marginBottom:20, border:'2px solid #2563eb20' }}>
            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>💳 Solicitar Crédito</h3>
            <form onSubmit={requestCredit} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Monto</label>
                <input required type="number" min="100" value={form.amount}
                  onChange={e=>setForm(p=>({...p,amount:e.target.value}))}
                  placeholder="S/ 1000"
                  style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Cuotas</label>
                <select value={form.installments} onChange={e=>setForm(p=>({...p,installments:e.target.value}))}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  {[1,2,3,4,6,8,10,12,18,24].map(n=>(
                    <option key={n} value={n}>{n} {n===1?'cuota':'cuotas'}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Notas</label>
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={2}
                  placeholder="Motivo del crédito..."
                  style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical', boxSizing:'border-box' }}/>
              </div>
              {form.amount && (
                <div style={{ gridColumn:'1/-1', background:'#eff6ff', borderRadius:12, padding:16, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  <div><div style={{ fontSize:11, color:'#64748b' }}>Tasa mensual</div><div style={{ fontSize:18, fontWeight:800, color:'#2563eb' }}>{getRate()}%</div></div>
                  <div><div style={{ fontSize:11, color:'#64748b' }}>Cuota mensual</div><div style={{ fontSize:18, fontWeight:800, color:'#15803d' }}>{fmt(calcPayment())}</div></div>
                  <div><div style={{ fontSize:11, color:'#64748b' }}>Total a pagar</div><div style={{ fontSize:18, fontWeight:800, color:'#7c3aed' }}>{fmt(calcTotal())}</div></div>
                </div>
              )}
              <div style={{ gridColumn:'1/-1', display:'flex', gap:10 }}>
                <button type="submit" className="btn btn-green" disabled={sending} style={{ flex:1, padding:12 }}>
                  {sending?'Enviando...':'💳 Solicitar Crédito'}
                </button>
                <button type="button" onClick={()=>setShowForm(false)}
                  style={{ padding:'12px 20px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'white', cursor:'pointer', fontWeight:600 }}>
                  Cancelar
                </button>
              </div>
            </form>
            {rates.length>0 && (
              <div style={{ marginTop:16, borderTop:'1px solid #f1f5f9', paddingTop:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:8 }}>Tasas de interés</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {rates.map(r=>(
                    <div key={r.id} style={{ background:r.monthly_rate===0?'#f0fdf4':'#eff6ff', borderRadius:8, padding:'8px 14px', fontSize:12 }}>
                      <span style={{ fontWeight:700, color:r.monthly_rate===0?'#15803d':'#2563eb' }}>{r.min_installments}-{r.max_installments} cuotas</span>
                      <span style={{ color:'#64748b', marginLeft:6 }}>{r.monthly_rate===0?'Sin interés':`${r.monthly_rate}% mensual`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB Créditos */}
        {tab==='creditos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {credits.length===0 ? (
              <div className="card" style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>💳</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#0D3B87', marginBottom:8 }}>No tienes créditos aún</div>
                <div style={{ color:'#64748b', marginBottom:20 }}>Solicita tu primer crédito y recibe aprobación rápida</div>
                <button onClick={()=>setShowForm(true)} className="btn">+ Solicitar Crédito</button>
              </div>
            ) : credits.map(c=>{
              const st = CREDIT_STATUS[c.status]||CREDIT_STATUS.PENDIENTE;
              const progress = c.total_cuotas>0?((c.cuotas_pagadas/c.total_cuotas)*100).toFixed(0):0;
              return (
                <div key={c.id} className="card" style={{ border:`2px solid ${st.color}20` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#0D3B87' }}>{fmt(c.amount)}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                        {c.installments} cuotas · {fmt(c.monthly_payment)}/mes · {c.interest_rate}% mensual
                      </div>
                      {c.product_name && (
                        <div style={{ fontSize:12, color:'#2563eb', marginTop:4, fontWeight:600 }}>
                          📦 {c.product_name}
                        </div>
                      )}
                    </div>
                    <span style={{ background:st.bg, color:st.color, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>{st.label}</span>
                  </div>
                  {c.status==='ACTIVO' && (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
                        {[['Total',fmt(c.total_with_interest||c.amount),'#7c3aed'],['Pagadas',`${c.cuotas_pagadas}/${c.total_cuotas}`,'#15803d'],['Vencidas',c.cuotas_vencidas||0,'#dc2626'],['Score ⭐',c.good_payer_score||0,'#f59e0b']].map(([l,v,col])=>(
                          <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px' }}>
                            <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', fontWeight:700 }}>{l}</div>
                            <div style={{ fontSize:18, fontWeight:800, color:col, marginTop:2 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background:'#e5e7eb', borderRadius:4, height:8, marginBottom:8 }}>
                        <div style={{ width:`${progress}%`, background:'linear-gradient(90deg,#2563eb,#22c55e)', height:'100%', borderRadius:4 }}/>
                      </div>
                      <div style={{ fontSize:11, color:'#64748b', marginBottom:8 }}>{progress}% completado</div>
                    </>
                  )}
                  {c.status==='PENDIENTE' && (
                    <div style={{ background:'#fefce8', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400e' }}>
                      ⏳ Tu solicitud está en revisión. El admin te notificará pronto.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB Cuotas */}
        {tab==='cuotas' && (
          <div className="card">
            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📅 Tabla de Amortización</h3>
            {installments.length===0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>Sin cuotas programadas aún</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                    {['#','Vencimiento','Capital','Interés','Penalidad','Total','Estado','Acción'].map(h=>(
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {installments.map(inst=>{
                    const st = STATUS_COLOR[inst.status]||STATUS_COLOR.PENDIENTE;
                    const totalDue = parseFloat(inst.amount)+parseFloat(inst.penalty||0);
                    return (
                      <tr key={inst.id} style={{ borderBottom:'1px solid #f1f5f9', background:inst.status==='VENCIDA'?'#fff5f5':'white' }}>
                        <td style={{ padding:'10px 12px', fontWeight:700 }}>#{inst.installment_num}</td>
                        <td style={{ padding:'10px 12px', color:inst.status==='VENCIDA'?'#dc2626':'#374151' }}>
                          {new Date(inst.due_date).toLocaleDateString('es-PE')}
                          {inst.days_overdue>0 && <div style={{ fontSize:10, color:'#dc2626' }}>{inst.days_overdue} días vencida</div>}
                        </td>
                        <td style={{ padding:'10px 12px' }}>{fmt(inst.principal)}</td>
                        <td style={{ padding:'10px 12px', color:'#f59e0b' }}>{fmt(inst.interest)}</td>
                        <td style={{ padding:'10px 12px', color:'#dc2626' }}>{fmt(inst.penalty)}</td>
                        <td style={{ padding:'10px 12px', fontWeight:800 }}>{fmt(totalDue)}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{st.label}</span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          {inst.status!=='PAGADA' && (
                            paying?.id===inst.id ? (
                              <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:180 }}>
                                <input type="number" placeholder={`S/ ${totalDue.toFixed(2)}`} value={payForm.amount}
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
                                  <button onClick={()=>payInstallment(inst.credit_id, inst.id)}
                                    className="btn btn-green" disabled={sending||!payForm.amount}
                                    style={{ flex:1, padding:'6px', fontSize:11 }}>
                                    {sending?'...':'✓ Pagar'}
                                  </button>
                                  <button onClick={()=>setPaying(null)}
                                    style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:11 }}>✕</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={()=>setPaying(inst)} className="btn" style={{ padding:'6px 12px', fontSize:11 }}>
                                💳 Pagar
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB Beneficios */}
        {tab==='beneficios' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
            {benefits.length===0 ? (
              <div className="card" style={{ gridColumn:'1/-1', textAlign:'center', padding:40 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>⭐</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#0D3B87', marginBottom:8 }}>Sin beneficios aún</div>
                <div style={{ color:'#64748b' }}>Paga tus cuotas a tiempo para ganar descuentos y mejores tasas</div>
              </div>
            ) : benefits.map(b=>(
              <div key={b.id} className="card">
                <div style={{ fontSize:32, marginBottom:8 }}>
                  {b.benefit_type==='DESCUENTO'?'🎁':b.benefit_type==='MEJOR_TASA'?'📉':'⭐'}
                </div>
                <div style={{ fontWeight:800, fontSize:14, color:'#0D3B87' }}>{b.description}</div>
                {b.benefit_value>0 && <div style={{ fontSize:22, fontWeight:900, color:'#15803d', marginTop:4 }}>{b.benefit_value}%</div>}
                {b.expires_at && <div style={{ fontSize:11, color:'#64748b', marginTop:6 }}>Vence: {new Date(b.expires_at).toLocaleDateString('es-PE')}</div>}
                <div style={{ marginTop:8 }}>
                  <span style={{ background:b.used?'#f1f5f9':'#f0fdf4', color:b.used?'#64748b':'#15803d', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                    {b.used?'Usado':'Disponible ✓'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
