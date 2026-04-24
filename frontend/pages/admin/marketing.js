// frontend/pages/admin/marketing.js — Panel de Marketing & Redes Sociales
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const PLATFORMS = { FACEBOOK:{icon:'📘',color:'#1877f2'}, INSTAGRAM:{icon:'📸',color:'#e1306c'}, TIKTOK:{icon:'📱',color:'#010101'}, YOUTUBE:{icon:'▶️',color:'#ff0000'}, WHATSAPP:{icon:'💬',color:'#25d366'} };

export default function AdminMarketing() {
  const [tab, setTab]       = useState('social');
  const [posts, setPosts]   = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [msg, setMsg]       = useState('');
  const [postForm, setPostForm] = useState({ title:'', content:'', media_url:'', media_type:'IMAGE', platforms:['FACEBOOK','INSTAGRAM'], scheduled_at:'' });
  const [emailForm, setEmailForm] = useState({ subject:'', content:'', audience:'ALL', scheduled_at:'' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [p, c, m, s] = await Promise.all([
        apiFetch('/api/admin/social-posts').catch(()=>[]),
        apiFetch('/api/admin/email-campaigns').catch(()=>[]),
        apiFetch('/api/admin/social-metrics').catch(()=>null),
        apiFetch('/api/admin/email-subscribers').catch(()=>[]),
      ]);
      setPosts(Array.isArray(p)?p:[]); setCampaigns(Array.isArray(c)?c:[]); setMetrics(m); setSubscribers(Array.isArray(s)?s:[]);
    } catch {}
  };

  const createPost = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/social-posts', { method:'POST', body:JSON.stringify(postForm) });
      setMsg('✅ Post creado correctamente');
      setPostForm({ title:'', content:'', media_url:'', media_type:'IMAGE', platforms:['FACEBOOK','INSTAGRAM'], scheduled_at:'' });
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const publishPost = async (id) => {
    setSending(true);
    try {
      const r = await apiFetch(`/api/admin/social-posts/${id}/publish`, { method:'POST' });
      setMsg(`✅ Publicado en: ${Object.keys(r.results||{}).join(', ')}${r.mock?' (modo simulación)':''}`);
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
    finally { setSending(false); }
  };

  const sendCampaign = async (id) => {
    setSending(true);
    try {
      const r = await apiFetch(`/api/admin/email-campaigns/${id}/send`, { method:'POST' });
      setMsg(`✅ Campaña enviada a ${r.sent} destinatarios${r.mock?' (modo simulación — configura SENDGRID_API_KEY)':''}`);
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
    finally { setSending(false); }
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/email-campaigns', { method:'POST', body:JSON.stringify(emailForm) });
      setMsg('✅ Campaña creada');
      setEmailForm({ subject:'', content:'', audience:'ALL', scheduled_at:'' });
      loadAll();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const togglePlatform = (p) => {
    setPostForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p) ? prev.platforms.filter(x=>x!==p) : [...prev.platforms, p]
    }));
  };

  const TABS = [['social','📱 Redes Sociales'],['email',`📧 Email (${subscribers.length})`],['metrics','📊 Métricas']];

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn:disabled{opacity:0.6;cursor:not-allowed}
        .btn-sm{padding:5px 10px;font-size:12px;border-radius:8px}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .card{background:white;border-radius:16px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>📢 Marketing & Redes Sociales</span>
            </div>
            <div style={{ fontSize:12, color:'#A8CAEA' }}>
              📱 {posts.filter(p=>p.status==='PUBLISHED').length} publicaciones · 📧 {subscribers.length} suscriptores
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent' }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        {/* SOCIAL POSTS */}
        {tab === 'social' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div className="card">
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📱 Crear Publicación</h3>
              <form onSubmit={createPost} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input required value={postForm.title} onChange={e=>setPostForm(p=>({...p,title:e.target.value}))} placeholder="Título del post" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <textarea required rows={4} value={postForm.content} onChange={e=>setPostForm(p=>({...p,content:e.target.value}))} placeholder="Contenido del post..." style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
                <input value={postForm.media_url} onChange={e=>setPostForm(p=>({...p,media_url:e.target.value}))} placeholder="URL de imagen/video (opcional)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:8, textTransform:'uppercase' }}>Plataformas</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {Object.entries(PLATFORMS).map(([key,{icon,color}])=>(
                      <button type="button" key={key} onClick={()=>togglePlatform(key)}
                        style={{ padding:'6px 12px', borderRadius:20, border:`2px solid ${postForm.platforms.includes(key)?color:'#e5e7eb'}`, background:postForm.platforms.includes(key)?color+'15':'white', color:postForm.platforms.includes(key)?color:'#64748b', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                        {icon} {key}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="datetime-local" value={postForm.scheduled_at} onChange={e=>setPostForm(p=>({...p,scheduled_at:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <button type="submit" className="btn" style={{ padding:12 }}>💾 Guardar Post</button>
              </form>
            </div>

            <div className="card">
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📋 Posts Recientes</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:520, overflowY:'auto' }}>
                {posts.slice(0,10).map(p=>(
                  <div key={p.id} style={{ border:'1px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div>
                        <span style={{ fontWeight:700, fontSize:13, color:'#0D3B87' }}>{p.title}</span>
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{p.admin_name} · {new Date(p.created_at).toLocaleDateString('es-PE')}</div>
                      </div>
                      <span style={{ background:p.status==='PUBLISHED'?'#f0fdf4':p.status==='SCHEDULED'?'#fefce8':'#f8fafc', color:p.status==='PUBLISHED'?'#15803d':p.status==='SCHEDULED'?'#ca8a04':'#64748b', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{p.status}</span>
                    </div>
                    <p style={{ fontSize:12, color:'#475569', margin:'0 0 8px' }}>{p.content?.substring(0,80)}...</p>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        {p.platforms?.map(pl=><span key={pl} style={{ fontSize:14 }}>{PLATFORMS[pl]?.icon||'📢'}</span>)}
                      </div>
                      {p.status !== 'PUBLISHED' && (
                        <button onClick={()=>publishPost(p.id)} className="btn btn-sm btn-green" disabled={sending}>
                          {sending?'⏳':'🚀 Publicar'}
                        </button>
                      )}
                      {p.status === 'PUBLISHED' && <span style={{ fontSize:11, color:'#15803d' }}>👍 {p.likes} · 🔁 {p.shares}</span>}
                    </div>
                  </div>
                ))}
                {posts.length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>Sin posts todavía</div>}
              </div>
            </div>
          </div>
        )}

        {/* EMAIL CAMPAIGNS */}
        {tab === 'email' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div className="card">
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📧 Nueva Campaña de Email</h3>
              <form onSubmit={createCampaign} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input required value={emailForm.subject} onChange={e=>setEmailForm(p=>({...p,subject:e.target.value}))} placeholder="Asunto del email" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <textarea required rows={6} value={emailForm.content} onChange={e=>setEmailForm(p=>({...p,content:e.target.value}))} placeholder="Contenido del email..." style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
                <select value={emailForm.audience} onChange={e=>setEmailForm(p=>({...p,audience:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="ALL">👥 Todos los suscriptores</option>
                  <option value="BUYERS">🛒 Solo compradores</option>
                  <option value="SELLERS">🏪 Solo vendedores</option>
                  <option value="VIP">⭐ VIP (score verde)</option>
                  <option value="INACTIVE">💤 Inactivos</option>
                </select>
                <div style={{ display:'flex', gap:8 }}>
                  <button type="submit" className="btn" style={{ flex:1, padding:12 }}>💾 Guardar Campaña</button>
                </div>
              </form>
            </div>

            <div className="card">
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>📋 Campañas ({campaigns.length})</h3>
              <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>📧 {subscribers.length} suscriptores activos</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:460, overflowY:'auto' }}>
                {campaigns.map(c=>(
                  <div key={c.id} style={{ border:'1px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>{c.subject}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{c.audience} · {new Date(c.created_at).toLocaleDateString('es-PE')}</div>
                        {c.status==='SENT' && <div style={{ fontSize:11, color:'#15803d', marginTop:2 }}>✉️ {c.sent_count} enviados</div>}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                        <span style={{ background:c.status==='SENT'?'#f0fdf4':'#fefce8', color:c.status==='SENT'?'#15803d':'#ca8a04', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{c.status}</span>
                        {c.status !== 'SENT' && c.status !== 'SENDING' && (
                          <button onClick={()=>sendCampaign(c.id)} className="btn btn-sm btn-green" disabled={sending}>
                            {sending?'⏳':'📤 Enviar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {campaigns.length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>Sin campañas todavía</div>}
              </div>
            </div>
          </div>
        )}

        {/* METRICS */}
        {tab === 'metrics' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {metrics?.platforms?.map(p=>(
                <div key={p.platform} className="card" style={{ borderTop:`4px solid ${PLATFORMS[p.platform]?.color||'#64748b'}` }}>
                  <div style={{ fontSize:24 }}>{PLATFORMS[p.platform]?.icon||'📢'}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0D3B87', marginTop:6 }}>{p.platform}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:PLATFORMS[p.platform]?.color||'#64748b' }}>{p.followers?.toLocaleString()}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>seguidores</div>
                  {p.engagement_rate > 0 && <div style={{ fontSize:11, color:'#15803d', marginTop:4 }}>📈 {p.engagement_rate}% engagement</div>}
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {[['📱','Posts Publicados',metrics?.posts?.published||0,'#eff6ff','#3B75C0'],['📧','Emails Enviados',metrics?.campaigns?.total_sent||0,'#f0fdf4','#15803d'],['👥','Suscriptores Email',subscribers.length,'#f5f3ff','#7c3aed']].map(([i,l,v,bg,c])=>(
                <div key={l} className="card" style={{ background:bg }}>
                  <div style={{ fontSize:22 }}>{i}</div>
                  <div style={{ fontSize:10, color:c, fontWeight:700, textTransform:'uppercase', marginTop:6 }}>{l}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:800, color:'#0D3B87' }}>📊 Actualizar métricas manualmente</h3>
              <p style={{ fontSize:13, color:'#64748b', margin:'0 0 12px' }}>Ingresa las métricas actuales de cada red social. Para automatización completa configura las API keys de Meta, TikTok y YouTube en Railway → Variables.</p>
              <div style={{ display:'flex', gap:8 }}>
                {['FACEBOOK','INSTAGRAM','TIKTOK','YOUTUBE'].map(pl=>(
                  <button key={pl} onClick={async()=>{
                    const f = parseInt(prompt(`Seguidores en ${pl}:`)||'0');
                    if(f>0) { await apiFetch('/api/admin/social-metrics/update',{method:'POST',body:JSON.stringify({platform:pl,followers:f})}); loadAll(); setMsg(`✅ ${pl} actualizado`); }
                  }} className="btn btn-sm" style={{ background:PLATFORMS[pl]?.color, fontSize:11 }}>
                    {PLATFORMS[pl]?.icon} {pl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
