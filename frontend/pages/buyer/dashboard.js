import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v||0).toFixed(2)}`;

export default function BuyerDashboard() {
  const [profile,  setProfile]  = useState(null);
  const [orders,   setOrders]   = useState([]);
  const [credits,  setCredits]  = useState([]);
  const [notifs,   setNotifs]   = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href='/login'; return; }
    Promise.all([
      apiFetch('/api/profile'),
      apiFetch('/api/my-orders').catch(()=>[]),
      apiFetch('/api/buyer/credits').catch(()=>({ credits:[], installments:[] })),
      apiFetch('/api/notifications').catch(()=>({ notifications:[], unread:0 })),
      apiFetch('/api/buyer/credits/benefits').catch(()=>[]),
    ]).then(([p, o, c, n, b]) => {
      setProfile(p.user);
      setOrders(Array.isArray(o)?o:[]);
      setCredits(c.credits||[]);
      setNotifs(n.notifications||[]);
      setBenefits(Array.isArray(b)?b:[]);
    }).finally(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0f4f8' }}>
      <div style={{ fontSize:14, color:'#64748b' }}>Cargando tu panel...</div>
    </div>
  );

  const activeCredit  = credits.find(c=>c.status==='ACTIVO');
  const pendingCredit = credits.find(c=>c.status==='PENDIENTE');
  const totalSpent    = orders.filter(o=>['PAGADA','ENTREGADA'].includes(o.status)).reduce((a,o)=>a+parseFloat(o.total||0),0);
  const unreadNotifs  = notifs.filter(n=>!n.read);
  const availBenefits = benefits.filter(b=>!b.used);

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .btn{background:linear-gradient(135deg,#2563eb,#3b82f6);color:white;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;font-size:13px;text-decoration:none;display:inline-block}
        .btn:hover{opacity:0.9}
        .menu-item{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;cursor:pointer;text-decoration:none;color:#374151;transition:background 0.2s}
        .menu-item:hover{background:#f0f4f8}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 24px', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Inicio</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700 }}>👤 Mi Panel</span>
          </div>
          <button onClick={()=>{localStorage.clear();window.location.href='/';}}
            style={{ background:'transparent', border:'1px solid #1A4A8A', color:'#94a3b8', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
            Salir
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'24px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>

        {/* Bienvenida */}
        <div className="card" style={{ marginBottom:20, background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', color:'white' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>
                ¡Hola, {profile?.name?.split(' ')[0]}! 👋
              </div>
              <div style={{ fontSize:13, color:'#A8CAEA' }}>{profile?.email}</div>
            </div>
            <div style={{ display:'flex', gap:16, textAlign:'center' }}>
              <div>
                <div style={{ fontSize:24, fontWeight:900 }}>{orders.length}</div>
                <div style={{ fontSize:11, color:'#A8CAEA' }}>Pedidos</div>
              </div>
              <div style={{ width:1, background:'rgba(255,255,255,0.1)' }}/>
              <div>
                <div style={{ fontSize:24, fontWeight:900 }}>{fmt(totalSpent)}</div>
                <div style={{ fontSize:11, color:'#A8CAEA' }}>Total gastado</div>
              </div>
              <div style={{ width:1, background:'rgba(255,255,255,0.1)' }}/>
              <div>
                <div style={{ fontSize:24, fontWeight:900 }}>{unreadNotifs.length}</div>
                <div style={{ fontSize:11, color:'#A8CAEA' }}>Avisos nuevos</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>

          {/* Menú lateral */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="card">
              <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:12 }}>Mi cuenta</div>
              {[
                ['/','🏠','Ir al Marketplace'],
                ['/my-orders','📦','Mis Pedidos'],
                ['/my-quotations','📋','Mis Cotizaciones'],
                ['/buyer/credits','💳','Mis Créditos'],
                ['/notifications','🔔',`Notificaciones${unreadNotifs.length>0?` (${unreadNotifs.length})`:''}` ],
                ['/profile','👤','Mi Perfil'],
              ].map(([href,icon,label])=>(
                <a key={href} href={href} className="menu-item">
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <span style={{ fontSize:14, fontWeight:500 }}>{label}</span>
                </a>
              ))}
            </div>

            {/* Crédito activo */}
            {activeCredit && (
              <div className="card" style={{ border:'2px solid #22c55e30', background:'#f0fdf4' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#15803d', textTransform:'uppercase', marginBottom:10 }}>💳 Crédito Activo</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#15803d' }}>{fmt(activeCredit.amount)}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{fmt(activeCredit.monthly_payment)}/mes · {activeCredit.interest_rate}% mensual</div>
                <div style={{ background:'#e5e7eb', borderRadius:4, height:6, margin:'10px 0' }}>
                  <div style={{ width:`${activeCredit.total_cuotas>0?((activeCredit.cuotas_pagadas/activeCredit.total_cuotas)*100).toFixed(0):0}%`, background:'#22c55e', height:'100%', borderRadius:4 }}/>
                </div>
                <div style={{ fontSize:11, color:'#64748b' }}>{activeCredit.cuotas_pagadas}/{activeCredit.total_cuotas} cuotas pagadas</div>
                {parseInt(activeCredit.cuotas_vencidas)>0 && (
                  <div style={{ marginTop:8, background:'#fef2f2', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#dc2626', fontWeight:600 }}>
                    ⚠️ {activeCredit.cuotas_vencidas} cuota(s) vencida(s)
                  </div>
                )}
                <a href="/buyer/credits" className="btn" style={{ marginTop:12, width:'100%', textAlign:'center', fontSize:12, padding:'8px', boxSizing:'border-box' }}>
                  Ver mis cuotas →
                </a>
              </div>
            )}

            {pendingCredit && !activeCredit && (
              <div className="card" style={{ border:'2px solid #f59e0b30', background:'#fefce8' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#ca8a04', textTransform:'uppercase', marginBottom:6 }}>⏳ Crédito en Revisión</div>
                <div style={{ fontSize:18, fontWeight:900, color:'#ca8a04' }}>{fmt(pendingCredit.amount)}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Tu solicitud está siendo revisada por el administrador.</div>
              </div>
            )}

            {!activeCredit && !pendingCredit && (
              <div className="card" style={{ border:'2px solid #2563eb20', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>💳</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87', marginBottom:6 }}>¿Necesitas financiamiento?</div>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Solicita un crédito y compra ahora, paga en cuotas.</div>
                <a href="/buyer/credits" className="btn" style={{ fontSize:12, padding:'8px 16px' }}>Solicitar crédito</a>
              </div>
            )}

            {/* Beneficios */}
            {availBenefits.length>0 && (
              <div className="card" style={{ border:'2px solid #f59e0b30' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#d97706', textTransform:'uppercase', marginBottom:10 }}>⭐ Tus Beneficios</div>
                {availBenefits.slice(0,3).map(b=>(
                  <div key={b.id} style={{ fontSize:12, color:'#374151', marginBottom:6, display:'flex', gap:8 }}>
                    <span>{b.benefit_type==='DESCUENTO'?'🎁':b.benefit_type==='MEJOR_TASA'?'📉':'⭐'}</span>
                    <span>{b.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contenido principal */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Notificaciones recientes */}
            {unreadNotifs.length>0 && (
              <div className="card" style={{ border:'2px solid #2563eb20' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#0D3B87' }}>🔔 Avisos nuevos ({unreadNotifs.length})</div>
                  <a href="/notifications" style={{ fontSize:12, color:'#2563eb', textDecoration:'none', fontWeight:600 }}>Ver todos →</a>
                </div>
                {unreadNotifs.slice(0,3).map(n=>(
                  <div key={n.id} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {n.type==='CREDITO_APROBADO'?'✅':n.type==='CUOTA_VENCIDA'?'⚠️':n.type==='CREDITO_BLOQUEADO'?'🚫':'🔔'}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87' }}>{n.title}</div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{n.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Últimos pedidos */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#0D3B87' }}>📦 Mis Pedidos Recientes</div>
                <a href="/my-orders" style={{ fontSize:12, color:'#2563eb', textDecoration:'none', fontWeight:600 }}>Ver todos →</a>
              </div>
              {orders.length===0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'#64748b' }}>
                  <div style={{ fontSize:40, marginBottom:8 }}>📦</div>
                  <div>Aún no tienes pedidos</div>
                  <a href="/" className="btn" style={{ marginTop:12, fontSize:12, padding:'8px 16px' }}>Ir al marketplace</a>
                </div>
              ) : orders.slice(0,5).map(o=>{
                const STATUS = { CREADA:{color:'#ca8a04',bg:'#fefce8'}, PAGADA:{color:'#2563eb',bg:'#eff6ff'}, EN_PRODUCCION:{color:'#7c3aed',bg:'#f5f3ff'}, LISTO:{color:'#0891b2',bg:'#ecfeff'}, ENVIADA:{color:'#ea580c',bg:'#fff7ed'}, ENTREGADA:{color:'#15803d',bg:'#f0fdf4'}, CANCELADA:{color:'#dc2626',bg:'#fef2f2'} };
                const st = STATUS[o.status]||{color:'#64748b',bg:'#f8fafc'};
                return (
                  <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87' }}>Orden #{o.id}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{new Date(o.created_at).toLocaleDateString('es-PE')}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#0D3B87' }}>{fmt(o.total)}</div>
                      <span style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{o.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Accesos rápidos */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                ['/','🏪','Comprar ahora','Explorar productos','#2563eb'],
                ['/buyer/credits','💳','Mis Créditos','Cuotas y pagos','#15803d'],
                ['/my-quotations','📋','Cotizaciones','Ver mis solicitudes','#7c3aed'],
              ].map(([href,icon,title,sub,color])=>(
                <a key={href} href={href} style={{ textDecoration:'none' }}>
                  <div className="card" style={{ textAlign:'center', cursor:'pointer', border:`2px solid ${color}15`, transition:'transform 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                    <div style={{ fontSize:32, marginBottom:8 }}>{icon}</div>
                    <div style={{ fontSize:13, fontWeight:800, color }}>{title}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{sub}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
