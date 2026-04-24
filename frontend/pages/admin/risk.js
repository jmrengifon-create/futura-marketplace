// frontend/pages/admin/risk.js — Centrales de Riesgo + Referidos + Compliance
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const RISK_C = { BAJO:{bg:'#f0fdf4',c:'#15803d',icon:'🟢'}, MEDIO:{bg:'#fefce8',c:'#ca8a04',icon:'🟡'}, ALTO:{bg:'#fff7ed',c:'#ea580c',icon:'🟠'}, BLOQUEADO:{bg:'#fef2f2',c:'#dc2626',icon:'🔴'} };
const fmt = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtMoney = n => `S/ ${parseFloat(n||0).toFixed(2)}`;

export default function AdminRisk() {
  const [tab, setTab]         = useState('risk');
  const [buyers, setBuyers]   = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [msg, setMsg]         = useState('');
  const [checking, setChecking] = useState(null);
  const [checkForm, setCheckForm] = useState({ doc_number:'', credit_id:'' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [b, r, rc] = await Promise.all([
        apiFetch('/api/admin/semaforo').then(d=>d.buyers||[]).catch(()=>[]),
        apiFetch('/api/admin/referrals').catch(()=>[]),
        apiFetch('/api/admin/receipts').catch(()=>[]),
      ]);
      setBuyers(Array.isArray(b)?b:[]); setReferrals(Array.isArray(r)?r:[]); setReceipts(Array.isArray(rc)?rc:[]);
    } catch {}
  };

  const runRiskCheck = async (e) => {
    e.preventDefault();
    if (!checking) return;
    try {
      const r = await apiFetch('/api/admin/credits/risk-check', {
        method:'POST',
        body: JSON.stringify({ buyer_id: checking.buyer_id, doc_number: checkForm.doc_number })
      });
      setMsg(`✅ Consulta realizada — Riesgo: ${r.risk?.risk_level} | Score: ${r.risk?.infocorp_score} | ${r.risk?.notes||'Sin observaciones'}`);
      setChecking(null);
      setCheckForm({ doc_number:'', credit_id:'' });
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const TABS = [['risk','🔍 Central de Riesgo'],['referrals',`🎁 Referidos (${referrals.length})`],['receipts',`🧾 Boletas (${receipts.length})`]];

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn-sm{padding:5px 10px;font-size:12px;border-radius:8px}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:460px;max-width:95vw}
        input:focus,select:focus{outline:none;border-color:#3B75C0!important}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>🔍 Riesgo, Referidos & Boletas</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent' }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        {/* CENTRAL DE RIESGO */}
        {tab === 'risk' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>🔍 Consulta de Centrales de Riesgo</h3>
              <p style={{ margin:0, fontSize:12, color:'#64748b' }}>Consulta el historial crediticio interno de cada comprador. Para SBS/Infocorp real configura SBS_API_KEY en Railway Variables.</p>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                {['Comprador','Email','Score Futura','Nivel Fidelidad','Puntos','Pedidos','Gasto Total','Riesgo','Acción'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {buyers.map(b=>{
                  const risk = parseInt(b.score)>=70?'BAJO':parseInt(b.score)>=40?'MEDIO':'ALTO';
                  const RC = RISK_C[risk];
                  return (
                    <tr key={b.buyer_id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#0D3B87' }}>{b.buyer_name}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{b.email}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ flex:1, height:6, borderRadius:4, background:'#e5e7eb', overflow:'hidden' }}>
                            <div style={{ width:`${b.score||50}%`, height:'100%', background:parseInt(b.score)>=70?'#22c55e':parseInt(b.score)>=40?'#eab308':'#ef4444', borderRadius:4 }} />
                          </div>
                          <span style={{ fontWeight:700, fontSize:12, color:RC.c }}>{b.score||50}</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:b.level_color+'20'||'#f8fafc', color:b.level_color||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{b.icon} {b.loyalty_level||'NUEVO'}</span></td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>⭐ {b.loyalty_points||0}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>{b.total_orders||0}</td>
                      <td style={{ padding:'10px 12px', fontWeight:600, color:'#15803d' }}>{fmtMoney(b.total_spent)}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:RC.bg, color:RC.c, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{RC.icon} {risk}</span></td>
                      <td style={{ padding:'10px 12px' }}>
                        <button onClick={()=>setChecking(b)} className="btn btn-sm">🔍 Consultar</button>
                      </td>
                    </tr>
                  );
                })}
                {buyers.length===0 && <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin compradores registrados</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* REFERIDOS */}
        {tab === 'referrals' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[['🎁','Total Referidos',referrals.length,'#f5f3ff','#7c3aed'],['✅','Recompensados',referrals.filter(r=>r.status==='RECOMPENSADO').length,'#f0fdf4','#15803d'],['⏳','Pendientes',referrals.filter(r=>r.status==='PENDIENTE').length,'#fefce8','#ca8a04']].map(([i,l,v,bg,c])=>(
                <div key={l} className="card" style={{ background:bg, textAlign:'center' }}>
                  <div style={{ fontSize:24 }}>{i}</div>
                  <div style={{ fontSize:10, color:c, fontWeight:700, textTransform:'uppercase', marginTop:6 }}>{l}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9' }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:'#0D3B87' }}>🎁 Programa de Referidos — 500 pts + 5% comisión por referido que compra</h3>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  {['Referidor','Email','Código','Referido','Estado','Creado'].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {referrals.map(r=>(
                    <tr key={r.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.referrer_name}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{r.referrer_email}</td>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:'#7c3aed' }}>{r.referral_code}</td>
                      <td style={{ padding:'10px 12px' }}>{r.referred_name||<span style={{ color:'#94a3b8' }}>Sin usar</span>}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:r.status==='RECOMPENSADO'?'#f0fdf4':r.status==='ACTIVO'?'#eff6ff':'#fefce8', color:r.status==='RECOMPENSADO'?'#15803d':r.status==='ACTIVO'?'#3B75C0':'#ca8a04', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{r.status}</span></td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'#94a3b8' }}>{fmt(r.created_at)}</td>
                    </tr>
                  ))}
                  {referrals.length===0 && <tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin referidos todavía</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOLETAS */}
        {tab === 'receipts' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9' }}>
              <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:800, color:'#0D3B87' }}>🧾 Boletas Electrónicas Emitidas</h3>
              <p style={{ margin:0, fontSize:12, color:'#64748b' }}>Generadas automáticamente. Para emisión oficial SUNAT configura NUBEFACT_TOKEN en Railway Variables.</p>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc' }}>
                {['N° Boleta','Comprador','Email','Subtotal','IGV','Total','Estado','Emitida'].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {receipts.map(r=>(
                  <tr key={r.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:'#3B75C0' }}>{r.receipt_number}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.buyer_name}</td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{r.email}</td>
                    <td style={{ padding:'10px 12px' }}>{fmtMoney(r.subtotal)}</td>
                    <td style={{ padding:'10px 12px' }}>{fmtMoney(r.igv)}</td>
                    <td style={{ padding:'10px 12px', fontWeight:700 }}>{fmtMoney(r.total)}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:r.status==='EMITIDA'?'#f0fdf4':'#fef2f2', color:r.status==='EMITIDA'?'#15803d':'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{r.status}</span></td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:'#94a3b8' }}>{fmt(r.issued_at)}</td>
                  </tr>
                ))}
                {receipts.length===0 && <tr><td colSpan={8} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin boletas todavía</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal consulta de riesgo */}
      {checking && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setChecking(null)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800, color:'#0D3B87' }}>🔍 Consulta de Riesgo: {checking.buyer_name}</h3>
            <div style={{ background:'#eff6ff', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
              <strong>Score Futura:</strong> {checking.score}/100 · <strong>Nivel:</strong> {checking.loyalty_level||'NUEVO'} · <strong>Pedidos:</strong> {checking.total_orders||0}
            </div>
            <form onSubmit={runRiskCheck} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>DNI o RUC del comprador *</label>
                <input required value={checkForm.doc_number} onChange={e=>setCheckForm(p=>({...p,doc_number:e.target.value}))} placeholder="Ej: 12345678 o 20123456789" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
              </div>
              <div style={{ background:'#fefce8', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#78350f' }}>
                ⚠️ <strong>Modo simulación activo.</strong> Para consulta real a SBS e Infocorp configura <code>SBS_API_KEY</code> e <code>INFOCORP_API_KEY</code> en Railway Variables.
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn" style={{ flex:1, padding:12 }}>🔍 Consultar Riesgo</button>
                <button type="button" onClick={()=>setChecking(null)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
