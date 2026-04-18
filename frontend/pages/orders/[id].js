import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../../lib/api';

const PRODUCTION_STATES = [
  { key:'PAGADA',       label:'Pago confirmado',      icon:'✅', color:'#3B75C0' },
  { key:'EN_PRODUCCION',label:'En producción',         icon:'⚙️', color:'#7c3aed' },
  { key:'LISTO',        label:'Listo para entrega',   icon:'📦', color:'#0891b2' },
  { key:'ENVIADA',      label:'Enviado',              icon:'🚚', color:'#2563eb' },
  { key:'ENTREGADA',    label:'Entregado y confirmado',icon:'✓', color:'#16a34a' },
];

export default function OrderTimeline() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/orders/${id}/timeline`).then(setData).finally(()=>setLoading(false));
  }, [id]);

  if (loading) return <div style={{ fontFamily:'system-ui', minHeight:'100vh', background:'#f0f4f8', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>⏳ Cargando...</div>;
  if (!data) return null;

  const { order, timeline } = data;
  const currentIdx = PRODUCTION_STATES.findIndex(s=>s.key===order?.status);

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 40px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', height:60, gap:14 }}>
          <a href="/my-orders" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:14 }}>← Mis Órdenes</a>
          <span style={{ color:'#3B75C0' }}>›</span>
          <span style={{ color:'white', fontWeight:700 }}>📍 Seguimiento Orden #{id}</span>
        </div>
      </header>

      <div style={{ maxWidth:900, margin:'28px auto', padding:'0 20px', animation:'fadeUp 0.4s ease' }}>

        {/* Progress bar */}
        <div style={{ background:'white', borderRadius:18, padding:'28px 32px', marginBottom:20, boxShadow:'0 4px 16px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#0D3B87', margin:'0 0 24px' }}>Estado del pedido</h2>
          <div style={{ position:'relative', paddingBottom:8 }}>
            {/* Progress line */}
            <div style={{ position:'absolute', top:20, left:'10%', right:'10%', height:4, background:'#e5e7eb', borderRadius:2 }}>
              <div style={{ height:'100%', borderRadius:2, background:'linear-gradient(90deg,#3B75C0,#6FA8D4)', width:`${Math.max(0,(currentIdx/(PRODUCTION_STATES.length-1))*100)}%`, transition:'width 0.5s ease' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', position:'relative' }}>
              {PRODUCTION_STATES.map((s,i)=>{
                const done = i<=currentIdx;
                return (
                  <div key={s.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:`${100/PRODUCTION_STATES.length}%` }}>
                    <div style={{ width:42, height:42, borderRadius:'50%', background:done?s.color:'white', border:`3px solid ${done?s.color:'#e5e7eb'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:done?`0 4px 12px ${s.color}40`:'none', transition:'all 0.3s', zIndex:1 }}>
                      {done?s.icon:'○'}
                    </div>
                    <div style={{ fontSize:11, fontWeight:done?700:400, color:done?s.color:'#94a3b8', textAlign:'center', lineHeight:1.3 }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {order?.tracking_code && (
            <div style={{ marginTop:20, background:'#eff6ff', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🚚</span>
              <div>
                <div style={{ fontSize:12, color:'#3B75C0', fontWeight:700 }}>Código de rastreo</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#0D3B87', fontFamily:'monospace' }}>{order.tracking_code}</div>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div style={{ background:'white', borderRadius:16, padding:'20px', marginBottom:20, boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 14px' }}>Productos de esta orden</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {order?.items?.map((item,i)=>(
              <div key={i} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 12px', background:'#f8fafc', borderRadius:10 }}>
                <img src={item.image_url} alt="" style={{ width:48, height:48, objectFit:'cover', borderRadius:8 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:'#0D3B87' }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>Vendedor: {item.seller_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline logs */}
        <div style={{ background:'white', borderRadius:16, padding:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 20px' }}>📋 Historial de producción</h3>
          {timeline.length===0 ? (
            <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>⏳</div>
              <p style={{ fontSize:13 }}>El vendedor aún no ha registrado actualizaciones de producción</p>
            </div>
          ) : (
            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', left:20, top:0, bottom:0, width:2, background:'#e5e7eb' }}/>
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                {timeline.map((log,i)=>(
                  <div key={log.id} style={{ display:'flex', gap:16, paddingLeft:4 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, flexShrink:0, zIndex:1, boxShadow:'0 2px 8px rgba(59,117,192,0.3)' }}>
                      {i===timeline.length-1?'⭐':'✓'}
                    </div>
                    <div style={{ flex:1, background:'#f8fafc', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                        <span style={{ fontWeight:700, color:'#0D3B87', fontSize:14 }}>{log.status}</span>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>{new Date(log.created_at).toLocaleString('es-PE')}</span>
                      </div>
                      {log.description && <p style={{ fontSize:13, color:'#475569', margin:'0 0 10px', lineHeight:1.6 }}>{log.description}</p>}
                      {log.photo_url && (
                        <div style={{ marginTop:8 }}>
                          <img src={log.photo_url} alt="Evidencia" style={{ maxWidth:'100%', maxHeight:200, objectFit:'cover', borderRadius:8, cursor:'pointer' }}
                            onClick={()=>window.open(log.photo_url,'_blank')} />
                          <p style={{ fontSize:11, color:'#94a3b8', margin:'4px 0 0' }}>📸 Foto de avance (click para ampliar)</p>
                        </div>
                      )}
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>Por: {log.updated_by_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
