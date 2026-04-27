import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function BuyerCredits() {
  const [credits, setCredits] = useState([]);
  const [form, setForm] = useState({ amount: '', installments: 12 });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }
    apiFetch('/api/buyer/credits')
      .then(d => setCredits(Array.isArray(d) ? d : []))
      .catch(() => setCredits([]))
      .finally(() => setLoading(false));
  }, []);

  const monthly = form.amount && form.installments
    ? (parseFloat(form.amount) / parseInt(form.installments)).toFixed(2) : '0.00';

  const submit = async () => {
    if (!form.amount) return setMsg('❌ Ingresa el monto');
    try {
      await apiFetch('/api/buyer/credits/request', {
        method: 'POST',
        body: JSON.stringify({ amount: form.amount, installments: form.installments })
      });
      setMsg('✅ Solicitud enviada. El admin la revisará pronto.');
      setForm({ amount: '', installments: 12 });
      apiFetch('/api/buyer/credits').then(d => setCredits(Array.isArray(d) ? d : []));
    } catch(e) { setMsg('❌ ' + e.message); }
  };

  const statusColor = s => s === 'ACTIVO' ? '#15803d' : s === 'PENDIENTE' ? '#ca8a04' : '#dc2626';
  const statusBg   = s => s === 'ACTIVO' ? '#f0fdf4' : s === 'PENDIENTE' ? '#fefce8' : '#fef2f2';

  return (
    <div style={{fontFamily:"'Segoe UI',sans-serif",background:'#f0f4f8',minHeight:'100vh'}}>
      <header style={{background:'linear-gradient(135deg,#0D3B87,#1A4A8A)',padding:'0 24px'}}>
        <div style={{maxWidth:960,margin:'0 auto',height:52,display:'flex',alignItems:'center',gap:12}}>
          <a href="/" style={{color:'#A8CAEA',textDecoration:'none',fontSize:13}}>← Inicio</a>
          <span style={{color:'#3B75C0'}}>›</span>
          <span style={{color:'white',fontWeight:700,fontSize:15}}>💳 Mis Créditos</span>
        </div>
      </header>

      <div style={{maxWidth:960,margin:'24px auto',padding:'0 24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

        {/* Formulario */}
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:800,color:'#0D3B87'}}>💳 Solicitar Crédito</h3>
          {msg && <div style={{padding:'10px 14px',borderRadius:10,marginBottom:14,fontWeight:600,background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2',color:msg.startsWith('✅')?'#15803d':'#dc2626'}}>{msg}</div>}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <label style={{fontSize:12,color:'#64748b',fontWeight:600}}>MONTO A SOLICITAR (S/)</label>
              <input type="number" placeholder="ej: 5000" value={form.amount}
                onChange={e=>setForm({...form,amount:e.target.value})}
                style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #e5e7eb',fontSize:14,marginTop:4,boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{fontSize:12,color:'#64748b',fontWeight:600}}>NÚMERO DE CUOTAS</label>
              <select value={form.installments} onChange={e=>setForm({...form,installments:e.target.value})}
                style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #e5e7eb',fontSize:14,marginTop:4}}>
                {[3,6,9,12,18,24].map(n=><option key={n} value={n}>{n} meses</option>)}
              </select>
            </div>
            <div style={{background:'#eff6ff',borderRadius:10,padding:'12px 16px'}}>
              <div style={{fontSize:12,color:'#3B75C0',fontWeight:600}}>CUOTA MENSUAL ESTIMADA</div>
              <div style={{fontSize:24,fontWeight:900,color:'#0D3B87'}}>S/ {monthly}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>TEA referencial 24% anual</div>
            </div>
            <button onClick={submit}
              style={{background:'linear-gradient(135deg,#0D3B87,#1A56DB)',color:'white',border:'none',borderRadius:10,padding:'12px',fontWeight:700,cursor:'pointer',fontSize:14}}>
              📨 Enviar Solicitud
            </button>
          </div>
        </div>

        {/* Lista de créditos */}
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:800,color:'#0D3B87'}}>📋 Mis Solicitudes</h3>
          {loading ? <p style={{color:'#94a3b8'}}>Cargando...</p>
          : credits.length === 0 ? (
            <div style={{textAlign:'center',padding:32,color:'#94a3b8'}}>
              <div style={{fontSize:40}}>💳</div>
              <p style={{marginTop:12}}>Sin solicitudes todavía</p>
            </div>
          ) : credits.map(c => (
            <div key={c.id} style={{border:'1px solid #e5e7eb',borderRadius:12,padding:'14px 16px',marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:15,color:'#0D3B87'}}>S/ {parseFloat(c.amount).toLocaleString()}</div>
                <span style={{background:statusBg(c.status),color:statusColor(c.status),padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{c.status}</span>
              </div>
              <div style={{fontSize:12,color:'#64748b'}}>{c.installments} cuotas · S/ {c.monthly_payment||monthly} /mes</div>
              {c.rejected_reason && <div style={{fontSize:12,color:'#dc2626',marginTop:6}}>Motivo: {c.rejected_reason}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
