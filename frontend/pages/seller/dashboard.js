import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v||0).toLocaleString('es-PE',{minimumFractionDigits:2})}`;

export default function SellerDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [payout, setPayout] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'VENDEDOR') { router.push('/login'); return; }
    Promise.all([
      apiFetch('/api/seller/dashboard').then(setDash),
      apiFetch('/api/seller/profile').then(d => setProfile(d || {})),
    ]).finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await apiFetch('/api/seller/profile', { method: 'PUT', body: JSON.stringify(profile) });
      setMsg('✅ Perfil actualizado correctamente');
    } catch (err) { setMsg('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const requestPayout = async () => {
    if (!payout || parseFloat(payout) <= 0) return;
    try {
      const r = await apiFetch('/api/seller/payout', { method: 'POST', body: JSON.stringify({ amount: payout }) });
      alert(r.message);
      setPayout('');
    } catch (err) { alert(err.message); }
  };

  const inp = (field, label, type='text', placeholder='') => (
    <div key={field}>
      <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</label>
      <input type={type} placeholder={placeholder} value={profile[field]||''} onChange={e=>setProfile(p=>({...p,[field]:e.target.value}))}
        style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', color:'#0f172a' }} />
    </div>
  );

  if (loading) return <div style={{ fontFamily:'system-ui', minHeight:'100vh', background:'#f0f4f8', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>⏳ Cargando...</div>;

  const s = dash?.stats || {};
  const TABS = [['dashboard','📊 Dashboard'],['profile','👤 Mi Perfil'],['payout','💸 Mis Pagos']];

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important;box-shadow:0 0 0 3px rgba(59,117,192,0.12)!important}`}</style>
      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 40px' }}>
          <div style={{ display:'flex', alignItems:'center', height:64, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <a href="/" style={{ display:'flex', alignItems:'center', textDecoration:'none' }}>
                <img src="/logo-hero.png" alt="Futura" style={{ height:36, objectFit:'contain' }} />
              </a>
              <span style={{ color:'#3B75C0', fontSize:20 }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>Centro del Vendedor</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <a href="/seller/orders" style={{ background:'rgba(59,117,192,0.25)', color:'#A8CAEA', padding:'8px 16px', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>📦 Órdenes</a>
              <a href="/seller/quotations" style={{ background:'rgba(245,158,11,0.2)', color:'#fcd34d', padding:'8px 16px', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>📋 Cotizaciones</a>
              <a href="/seller/new-product" style={{ background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', padding:'8px 16px', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:700 }}>+ Publicar</a>
            </div>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {TABS.map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'12px 20px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent' }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1100, margin:'28px auto', padding:'0 40px', animation:'fadeUp 0.4s ease' }}>

        {/* DASHBOARD TAB */}
        {tab==='dashboard' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
              {[
                ['💰','Neto Total Ganado',fmt(s.neto_total),'#f0fdf4','#15803d'],
                ['📦','Órdenes Activas',parseInt(s.en_produccion||0),'#eff6ff','#3B75C0'],
                ['✅','Órdenes Entregadas',parseInt(s.entregadas||0),'#f5f3ff','#7c3aed'],
                ['📋','Cotizaciones Pendientes',parseInt(s.cotizaciones_pendientes||0),'#fefce8','#ca8a04'],
              ].map(([icon,label,val,bg,color])=>(
                <div key={label} style={{ background:bg, borderRadius:14, padding:'18px 20px', border:`1px solid ${color}25`, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color},${color}44)`, borderRadius:'14px 14px 0 0' }}/>
                  <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
                  <div style={{ fontSize:11, color, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:24, fontWeight:900, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Neto del mes */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
              <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>📈 Ingresos mensuales (neto)</h3>
                {dash?.monthly?.length===0 ? (
                  <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', flexDirection:'column', gap:8 }}>
                    <div style={{ fontSize:40 }}>📊</div>
                    <p style={{ fontSize:13 }}>Sin ventas registradas aún</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {dash?.monthly?.map((m,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ fontSize:12, color:'#64748b', width:70, flexShrink:0 }}>{m.mes}</div>
                        <div style={{ flex:1, height:10, background:'#f1f5f9', borderRadius:5 }}>
                          <div style={{ height:'100%', borderRadius:5, background:'linear-gradient(90deg,#3B75C0,#6FA8D4)', width:`${Math.min((m.neto/Math.max(...dash.monthly.map(x=>x.neto)))*100,100)}%` }}/>
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87', width:90, textAlign:'right' }}>{fmt(m.neto)}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', width:40, textAlign:'right' }}>{m.ordenes}ord</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', margin:'0 0 16px' }}>🏆 Top productos</h3>
                {dash?.topProducts?.length===0 ? (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>Sin ventas aún</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {dash?.topProducts?.map((p,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <img src={p.image_url} alt="" style={{ width:36, height:36, objectFit:'cover', borderRadius:8, flexShrink:0 }} />
                        <div style={{ flex:1, overflow:'hidden' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#0D3B87', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.title}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{p.veces}x · {fmt(p.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rating */}
            {dash?.profile && (
              <div style={{ background:'white', borderRadius:14, padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', gap:32, alignItems:'center' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:40, fontWeight:900, color:'#f59e0b' }}>{parseFloat(dash.profile.rating_avg||0).toFixed(1)}</div>
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Rating promedio</div>
                  <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:4 }}>
                    {[1,2,3,4,5].map(n=><span key={n} style={{ fontSize:16, opacity:n<=Math.round(dash.profile.rating_avg||0)?1:0.2 }}>⭐</span>)}
                  </div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:32, fontWeight:900, color:'#3B75C0' }}>{dash.profile.total_sales}</div>
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Ventas totales</div>
                </div>
                {dash.profile.verified && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:12, padding:'10px 20px', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:22 }}>✓</span>
                    <div><div style={{ fontWeight:700, color:'#15803d', fontSize:14 }}>Vendedor Verificado</div><div style={{ fontSize:11, color:'#16a34a' }}>Aprobado por Futura Digital</div></div>
                  </div>
                )}
                {!dash.profile.verified && (
                  <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:12, padding:'10px 20px' }}>
                    <div style={{ fontWeight:700, color:'#ca8a04', fontSize:13 }}>⏳ Verificación pendiente</div>
                    <div style={{ fontSize:11, color:'#d97706' }}>Completa tu perfil para acelerar la aprobación</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* PROFILE TAB */}
        {tab==='profile' && (
          <div style={{ background:'white', borderRadius:20, padding:'32px', boxShadow:'0 4px 20px rgba(0,0,0,0.07)' }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:'#0D3B87', marginBottom:6 }}>👤 Mi Perfil de Vendedor</h2>
            <p style={{ color:'#64748b', fontSize:13, marginBottom:24 }}>Completa tu perfil para ser aprobado por Futura Digital y aumentar tu credibilidad</p>
            {msg && <div style={{ background: msg.startsWith('✅')?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.startsWith('✅')?'#86efac':'#fecaca'}`, color: msg.startsWith('✅')?'#15803d':'#dc2626', padding:'12px 16px', borderRadius:10, marginBottom:20 }}>{msg}</div>}
            <form onSubmit={saveProfile} style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <h3 style={{ fontSize:14, fontWeight:800, color:'#374151', margin:'0 0 -12px', textTransform:'uppercase', letterSpacing:0.5 }}>Datos personales</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {inp('name','Nombre completo','text','Carlos Ramírez')}
                {inp('phone','Teléfono / WhatsApp','tel','+51 999 000 000')}
              </div>

              <h3 style={{ fontSize:14, fontWeight:800, color:'#374151', margin:'8px 0 -12px', textTransform:'uppercase', letterSpacing:0.5 }}>Datos de empresa</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {inp('business_name','Nombre del negocio','text','Imprenta Carlos SAC')}
                {inp('ruc','RUC','text','20123456789')}
                {inp('location_city','Ciudad','text','Lima')}
                {inp('production_capacity','Capacidad producción (unid/semana)','number','500')}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Dirección del taller</label>
                <input value={profile.location_address||''} onChange={e=>setProfile(p=>({...p,location_address:e.target.value}))}
                  placeholder="Av. Industrial 123, Lima"
                  style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', color:'#0f172a' }} />
              </div>

              <h3 style={{ fontSize:14, fontWeight:800, color:'#374151', margin:'8px 0 -12px', textTransform:'uppercase', letterSpacing:0.5 }}>Maquinaria Futura</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {inp('machine_type','Tipo de máquina','text','Impresora Ecosolvente, DTF')}
                {inp('machine_model','Modelo','text','Roland TrueVIS VG3-640')}
              </div>

              <h3 style={{ fontSize:14, fontWeight:800, color:'#374151', margin:'8px 0 -12px', textTransform:'uppercase', letterSpacing:0.5 }}>Datos bancarios para pagos</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                {inp('bank_name','Banco','text','BCP')}
                {inp('bank_account','Número de cuenta','text','19100012345678')}
                {inp('bank_cci','Código interbancario (CCI)','text','00219100012345678900')}
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Descripción de tu taller / portafolio</label>
                <textarea rows={4} value={profile.portfolio_desc||''} onChange={e=>setProfile(p=>({...p,portfolio_desc:e.target.value}))}
                  placeholder="Describe tu experiencia, equipos, materiales con los que trabajas y tipo de trabajos que realizas..."
                  style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'vertical', color:'#0f172a', lineHeight:1.6 }} />
              </div>

              <button type="submit" disabled={saving}
                style={{ padding:'13px', background:'linear-gradient(135deg,#3B75C0,#6FA8D4)', color:'white', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving?'⏳ Guardando...':'✅ Guardar perfil'}
              </button>
            </form>
          </div>
        )}

        {/* PAYOUT TAB */}
        {tab==='payout' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ background:'white', borderRadius:16, padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:17, fontWeight:800, color:'#0D3B87', marginBottom:6 }}>💸 Solicitar retiro de fondos</h3>
              <p style={{ color:'#64748b', fontSize:13, marginBottom:20 }}>Los fondos se transfieren en 2-3 días hábiles a tu cuenta bancaria registrada</p>
              <div style={{ background:'#f0fdf4', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div><div style={{ fontSize:12, color:'#15803d', fontWeight:700, textTransform:'uppercase' }}>Disponible para retiro</div><div style={{ fontSize:28, fontWeight:900, color:'#166534' }}>{fmt(s.neto_total)}</div></div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>Monto a retirar (S/)</label>
                <input type="number" min="1" step="0.01" value={payout} onChange={e=>setPayout(e.target.value)}
                  placeholder="0.00"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:16, boxSizing:'border-box', color:'#0f172a' }} />
              </div>
              <div style={{ background:'#eff6ff', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12, color:'#3B75C0' }}>
                💳 Banco: {profile.bank_name||'—'} · Cuenta: {profile.bank_account||'No configurada'}
              </div>
              {!profile.bank_account && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#dc2626' }}>
                  ⚠ Configura tu cuenta bancaria en la pestaña "Mi Perfil" primero
                </div>
              )}
              <button onClick={requestPayout} disabled={!profile.bank_account || !payout}
                style={{ width:'100%', padding:'13px', background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:14, opacity:(!profile.bank_account||!payout)?0.5:1 }}>
                💸 Solicitar retiro
              </button>
            </div>

            <div style={{ background:'white', borderRadius:16, padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', marginBottom:16 }}>ℹ️ Información sobre pagos</h3>
              {[
                ['📅 Frecuencia','Los retiros se procesan cada lunes y jueves hábiles'],
                ['⏱ Tiempo de acreditación','2-3 días hábiles después de la solicitud'],
                ['💯 Monto mínimo','S/ 50.00 por retiro'],
                ['🔒 Escrow','Los fondos se retienen 7 días tras la entrega confirmada por el comprador'],
                ['📊 Comisión Futura','10% por venta exitosa (ya descontado en el neto)'],
                ['🏦 Bancos aceptados','BCP, Interbank, BBVA, Scotiabank, BanBif, Banbif, Caja'],
              ].map(([t,d])=>(
                <div key={t} style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:3 }}>{t}</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
