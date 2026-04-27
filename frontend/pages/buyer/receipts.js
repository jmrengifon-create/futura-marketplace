import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function BuyerReceipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }
    apiFetch('/api/buyer/receipts')
      .then(d => setReceipts(Array.isArray(d) ? d : []))
      .catch(() => setReceipts([]))
      .finally(() => setLoading(false));
  }, []);

  const fmt = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';

  return (
    <div style={{fontFamily:"'Segoe UI',sans-serif",background:'#f0f4f8',minHeight:'100vh'}}>
      <header style={{background:'linear-gradient(135deg,#0D3B87,#1A4A8A)',padding:'0 24px'}}>
        <div style={{maxWidth:900,margin:'0 auto',height:52,display:'flex',alignItems:'center',gap:12}}>
          <a href="/" style={{color:'#A8CAEA',textDecoration:'none',fontSize:13}}>← Inicio</a>
          <span style={{color:'#3B75C0'}}>›</span>
          <span style={{color:'white',fontWeight:700,fontSize:15}}>🧾 Mis Boletas</span>
        </div>
      </header>
      <div style={{maxWidth:900,margin:'24px auto',padding:'0 24px'}}>
        <div style={{background:'white',borderRadius:16,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #f1f5f9'}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:800,color:'#0D3B87'}}>🧾 Boletas Electrónicas</h3>
            <p style={{margin:'4px 0 0',fontSize:12,color:'#64748b'}}>Generadas automáticamente al confirmar cada pago</p>
          </div>
          {loading ? (
            <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Cargando...</div>
          ) : receipts.length === 0 ? (
            <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>
              <div style={{fontSize:40,marginBottom:12}}>🧾</div>
              <p>Sin boletas todavía. Se generan al completar pagos.</p>
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f8fafc',borderBottom:'1px solid #e5e7eb'}}>
                  {['N° Boleta','Subtotal','IGV','Total','Estado','Fecha'].map(h=>(
                    <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'#64748b',fontWeight:700,textTransform:'uppercase'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'white':'#fafafa'}}>
                    <td style={{padding:'12px 16px',fontWeight:700,color:'#0D3B87'}}>{r.receipt_number}</td>
                    <td style={{padding:'12px 16px'}}>S/ {parseFloat(r.subtotal).toFixed(2)}</td>
                    <td style={{padding:'12px 16px'}}>S/ {parseFloat(r.igv).toFixed(2)}</td>
                    <td style={{padding:'12px 16px',fontWeight:700,color:'#15803d'}}>S/ {parseFloat(r.total).toFixed(2)}</td>
                    <td style={{padding:'12px 16px'}}>
                      <span style={{background:'#f0fdf4',color:'#15803d',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{r.status}</span>
                    </td>
                    <td style={{padding:'12px 16px',color:'#64748b',fontSize:12}}>{fmt(r.issued_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
