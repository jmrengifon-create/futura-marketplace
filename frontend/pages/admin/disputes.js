import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [form, setForm] = useState({ resolution: '', status: 'RESUELTA' });

  const load = () => apiFetch('/api/admin/disputes').then(setDisputes).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const resolve = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/disputes/${resolving.id}/resolve`, { method: 'PUT', body: JSON.stringify(form) });
      setResolving(null);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`textarea:focus{outline:none;border-color:#3B75C0!important}`}</style>
      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 40px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', height:60, justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <a href="/admin/commissions" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:14 }}>← Panel Admin</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700 }}>⚖️ Disputas</span>
          </div>
          <span style={{ background:'rgba(239,68,68,0.2)', color:'#fca5a5', padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:700 }}>
            {disputes.filter(d=>d.status==='ABIERTA').length} abiertas
          </span>
        </div>
      </header>

      <div style={{ maxWidth:1100, margin:'28px auto', padding:'0 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>⏳ Cargando...</div> :
        disputes.length === 0 ? (
          <div style={{ background:'white', borderRadius:20, padding:64, textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>⚖️</div>
            <h3 style={{ color:'#0D3B87' }}>Sin disputas activas</h3>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {disputes.map((d, i) => {
              const color = d.status==='ABIERTA' ? '#dc2626' : d.status==='RESUELTA' ? '#16a34a' : '#d97706';
              return (
                <div key={d.id} style={{ background:'white', borderRadius:16, padding:'20px 24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', borderLeft:`4px solid ${color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <span style={{ fontWeight:800, color:'#0D3B87', fontSize:15 }}>Disputa #{d.id} · Orden #{d.order_id}</span>
                      <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
                        {d.raised_by_name} vs {d.against_name} · S/ {parseFloat(d.total||0).toLocaleString()} · {new Date(d.created_at).toLocaleDateString('es-PE')}
                      </div>
                    </div>
                    <span style={{ background:`${color}15`, color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, border:`1px solid ${color}30` }}>{d.status}</span>
                  </div>
                  <div style={{ background:'#fef2f2', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#374151', marginBottom:10 }}>
                    <strong>Motivo:</strong> {d.reason}
                  </div>
                  {d.resolution && (
                    <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#15803d', marginBottom:10 }}>
                      <strong>Resolución:</strong> {d.resolution}
                    </div>
                  )}
                  {d.status === 'ABIERTA' && (
                    <button onClick={() => { setResolving(d); setForm({ resolution:'', status:'RESUELTA' }); }}
                      style={{ background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', border:'none', padding:'9px 20px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13 }}>
                      ⚖️ Resolver disputa
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {resolving && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'white', borderRadius:20, padding:32, maxWidth:500, width:'100%' }}>
            <h3 style={{ fontSize:18, fontWeight:800, color:'#0D3B87', marginBottom:20 }}>Resolver Disputa #{resolving.id}</h3>
            <form onSubmit={resolve} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <textarea required rows={4} value={form.resolution} onChange={e => setForm(p => ({...p, resolution:e.target.value}))}
                placeholder="Escribe la resolución del caso..."
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'none' }} />
              <select value={form.status} onChange={e => setForm(p => ({...p, status:e.target.value}))}
                style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="RESUELTA">Resuelta</option>
                <option value="CERRADA">Cerrada sin acción</option>
              </select>
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" style={{ flex:1, padding:12, background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700 }}>Confirmar resolución</button>
                <button type="button" onClick={() => setResolving(null)} style={{ padding:'12px 20px', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer', fontWeight:600 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
