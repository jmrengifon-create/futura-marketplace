// frontend/pages/admin/whatsapp.js — v4.1 FINAL con Bandeja de Entrada
import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (d) => d ? new Date(d).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' }) : '';

export default function AdminWhatsApp() {
  const [tab, setTab]                 = useState('inbox');
  const [conversations, setConvs]     = useState([]);
  const [activePhone, setActivePhone] = useState(null);
  const [messages, setMessages]       = useState([]);
  const [reply, setReply]             = useState('');
  const [subscribers, setSubscribers] = useState([]);
  const [broadcasts, setBroadcasts]   = useState([]);
  const [loyalty, setLoyalty]         = useState([]);
  const [sending, setSending]         = useState(false);
  const [msg, setMsg]                 = useState('');
  const [form, setForm]               = useState({ title: '', message: '', audience: 'ALL' });
  const [bonusForm, setBonusForm]     = useState({ userId: '', points: '', description: '' });
  const [testForm, setTestForm]       = useState({ phone: '', message: '' });
  const [searchSub, setSearchSub]     = useState('');
  const endRef     = useRef(null);
  const pollRef    = useRef(null);
  const msgPollRef = useRef(null);

  const scrollBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadInbox = async () => {
    try {
      const data = await apiFetch('/api/admin/wa/inbox');
      setConvs(Array.isArray(data) ? data : []);
    } catch {}
  };

  const loadThread = async (phone) => {
    try {
      const data = await apiFetch(`/api/admin/wa/inbox/${encodeURIComponent(phone)}`);
      setMessages(data.messages || []);
      setTimeout(scrollBottom, 100);
    } catch {}
  };

  const loadData = async () => {
    try {
      const [subs, bcs, loy] = await Promise.all([
        apiFetch('/api/admin/wa/subscribers').catch(() => []),
        apiFetch('/api/admin/wa/broadcasts').catch(() => []),
        apiFetch('/api/admin/loyalty').catch(() => []),
      ]);
      setSubscribers(Array.isArray(subs) ? subs : []);
      setBroadcasts(Array.isArray(bcs) ? bcs : []);
      setLoyalty(Array.isArray(loy) ? loy : []);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    if (!token || role !== 'ADMIN') { window.location.href = '/login'; return; }
    loadInbox();
    loadData();
    pollRef.current = setInterval(loadInbox, 3000);
    return () => { clearInterval(pollRef.current); clearInterval(msgPollRef.current); };
  }, []);

  useEffect(() => {
    if (!activePhone) return;
    clearInterval(msgPollRef.current);
    loadThread(activePhone);
    msgPollRef.current = setInterval(() => loadThread(activePhone), 3000);
    return () => clearInterval(msgPollRef.current);
  }, [activePhone]);

  useEffect(() => { scrollBottom(); }, [messages]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activePhone) return;
    try {
      await apiFetch(`/api/admin/wa/inbox/${encodeURIComponent(activePhone)}/reply`, {
        method: 'POST', body: JSON.stringify({ message: reply })
      });
      setReply('');
      await loadThread(activePhone);
    } catch (err) { setMsg('❌ Error al enviar'); }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Enviar broadcast?`)) return;
    setSending(true);
    try {
      const r = await apiFetch('/api/admin/wa/broadcast', { method: 'POST', body: JSON.stringify(form) });
      setMsg(`✅ Broadcast enviado a ${r.recipients} suscriptores`);
      setForm({ title: '', message: '', audience: 'ALL' });
      setTimeout(loadData, 2000);
    } catch (err) { setMsg('❌ ' + err.message); }
    finally { setSending(false); }
  };

  const sendBonus = async (e) => {
    e.preventDefault();
    try {
      const r = await apiFetch('/api/admin/loyalty/bonus', { method: 'POST', body: JSON.stringify(bonusForm) });
      setMsg(`✅ ${r.message}`);
      setBonusForm({ userId: '', points: '', description: '' });
      loadData();
    } catch (err) { setMsg('❌ ' + err.message); }
  };

  const audienceLabel = (a) => ({ ALL:'Todos', BUYERS:'Compradores', VIP:'VIP', INACTIVE:'Inactivos' }[a] || a);
  const totalUnread   = conversations.reduce((a, c) => a + parseInt(c.unread || 0), 0);
  const activeSubs    = subscribers.filter(s => s.opted_in).length;
  const filteredSubs  = subscribers.filter(s => !searchSub || s.name?.toLowerCase().includes(searchSub.toLowerCase()) || s.phone?.includes(searchSub));

  const TABS = [
    ['inbox',       `💬 Bandeja${totalUnread > 0 ? ` (${totalUnread})` : ''}`],
    ['broadcast',   '📢 Broadcast'],
    ['subscribers', `👥 Suscritos (${activeSubs})`],
    ['history',     '📋 Historial'],
    ['loyalty',     '⭐ Fidelidad'],
    ['test',        '🧪 Pruebas'],
  ];

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important;box-shadow:0 0 0 3px rgba(59,117,192,0.1)!important}
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn:disabled{opacity:0.6;cursor:not-allowed}
        .card{background:white;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .conv:hover{background:#f8fafc!important}
        .bubble{animation:fadeUp 0.15s ease}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>📱 WhatsApp Marketing + Fidelidad</span>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:12, color:'#A8CAEA', alignItems:'center' }}>
              {totalUnread > 0 && <span style={{ background:'#ef4444', color:'white', padding:'2px 10px', borderRadius:20, fontWeight:700, animation:'pulse 2s infinite' }}>🔴 {totalUnread} sin leer</span>}
              <span>👥 {activeSubs} suscritos</span>
              <span>📢 {broadcasts.filter(b=>b.status==='DONE').length} broadcasts</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer',
                fontSize:13, fontWeight: tab===key ? 700 : 400,
                color: tab===key ? 'white' : '#64748b',
                borderBottom: tab===key ? '3px solid #3B75C0' : '3px solid transparent',
                whiteSpace:'nowrap'
              }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>
        {msg && (
          <div style={{ background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.startsWith('✅')?'#86efac':'#fecaca'}`, color:msg.startsWith('✅')?'#15803d':'#dc2626', padding:'10px 14px', borderRadius:10, marginBottom:16, fontWeight:600, display:'flex', justifyContent:'space-between' }}>
            <span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18 }}>×</button>
          </div>
        )}

        {/* ── INBOX ── */}
        {tab === 'inbox' && (
          <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, height:'calc(100vh - 160px)' }}>
            <div className="card" style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid #f1f5f9' }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0D3B87' }}>💬 Conversaciones</h3>
                <p style={{ margin:'4px 0 0', fontSize:11, color:'#94a3b8' }}>Actualiza cada 3 seg · Abre /whatsapp-test para simular</p>
              </div>
              <div style={{ overflowY:'auto', flex:1 }}>
                {conversations.length === 0 ? (
                  <div style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>💬</div>
                    <p style={{ fontSize:13, margin:0 }}>Sin conversaciones.<br/>Prueba el simulador en<br/><a href="/whatsapp-test" target="_blank" style={{ color:'#3B75C0' }}>/whatsapp-test</a></p>
                  </div>
                ) : conversations.map(c => (
                  <div key={c.phone} className="conv" onClick={() => setActivePhone(c.phone)}
                    style={{ padding:'12px 14px', borderBottom:'1px solid #f8fafc', cursor:'pointer', background:activePhone===c.phone?'#eff6ff':'white', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:activePhone===c.phone?'#3B75C0':'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>👤</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'#0D3B87' }}>{c.name || 'Cliente'}</span>
                        {parseInt(c.unread) > 0 && <span style={{ background:'#25d366', color:'white', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>{c.unread}</span>}
                      </div>
                      <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{c.phone}</div>
                      <div style={{ fontSize:11, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>
                        {c.last_direction==='ADMIN'?'👤 Tú: ':''}{c.last_message?.substring(0,35)}{c.last_message?.length>35?'...':''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              {!activePhone ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', color:'#94a3b8', gap:12 }}>
                  <div style={{ fontSize:64 }}>💬</div>
                  <p style={{ fontSize:15, fontWeight:600, margin:0 }}>Selecciona una conversación</p>
                  <a href="/whatsapp-test" target="_blank" style={{ fontSize:13, color:'#3B75C0' }}>O abre el simulador de cliente →</a>
                </div>
              ) : (
                <>
                  <div style={{ background:'#075e54', padding:'10px 18px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:'#25d366', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>👤</div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:'white', fontWeight:700, fontSize:14 }}>{conversations.find(c=>c.phone===activePhone)?.name || 'Cliente'}</div>
                      <div style={{ color:'#a8d8b5', fontSize:11, fontFamily:'monospace' }}>{activePhone}</div>
                    </div>
                    <a href="/whatsapp-test" target="_blank" style={{ color:'#a8d8b5', fontSize:11, textDecoration:'none', background:'rgba(255,255,255,0.15)', padding:'4px 10px', borderRadius:8 }}>Simulador ↗</a>
                  </div>

                  <div style={{ flex:1, background:'#ece5dd', overflowY:'auto', padding:'14px 12px', display:'flex', flexDirection:'column', gap:5 }}>
                    {messages.length === 0 && <div style={{ textAlign:'center', color:'#8696a0', fontSize:12, paddingTop:40 }}>Sin mensajes en esta conversación</div>}
                    {messages.map((m, i) => {
                      const isUser = m.direction==='IN';
                      const isAdmin = m.direction==='ADMIN';
                      return (
                        <div key={i} className="bubble" style={{ display:'flex', justifyContent:isUser?'flex-start':'flex-end' }}>
                          {isUser && <div style={{ width:28, height:28, borderRadius:'50%', background:'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, marginRight:6, flexShrink:0, alignSelf:'flex-end' }}>👤</div>}
                          <div style={{ background:isUser?'white':isAdmin?'#d1e8ff':'#dcf8c6', padding:'7px 11px', borderRadius:isUser?'12px 12px 12px 4px':'12px 12px 4px 12px', maxWidth:'72%', fontSize:13, whiteSpace:'pre-wrap', boxShadow:'0 1px 2px rgba(0,0,0,0.08)' }}>
                            {isAdmin && <div style={{ fontSize:10, color:'#3B75C0', fontWeight:700, marginBottom:3 }}>👤 Admin Futura</div>}
                            {m.direction==='OUT' && <div style={{ fontSize:10, color:'#25d366', fontWeight:700, marginBottom:3 }}>🤖 Bot</div>}
                            {m.message}
                            <div style={{ fontSize:10, color:'#8696a0', textAlign:'right', marginTop:3 }}>{fmtTime(m.timestamp)}</div>
                          </div>
                          {isAdmin && <div style={{ width:28, height:28, borderRadius:'50%', background:'#3B75C0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, marginLeft:6, flexShrink:0, alignSelf:'flex-end' }}>👤</div>}
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>

                  <form onSubmit={sendReply} style={{ background:'#f0f0f0', padding:'8px 12px', display:'flex', gap:8, borderTop:'1px solid #e5e7eb' }}>
                    <input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Escribe tu respuesta como administrador..."
                      style={{ flex:1, padding:'10px 16px', borderRadius:24, border:'none', fontSize:14, background:'white', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }} />
                    <button type="submit" disabled={!reply.trim()} style={{ background:reply.trim()?'#3B75C0':'#94a3b8', color:'white', border:'none', borderRadius:'50%', width:42, height:42, fontSize:17, cursor:'pointer', flexShrink:0 }}>➤</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BROADCAST ── */}
        {tab === 'broadcast' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div className="card">
              <h3 style={{ fontSize:16, fontWeight:800, color:'#0D3B87', marginBottom:6 }}>📢 Enviar Broadcast Masivo</h3>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>Envía un mensaje a todos los suscriptores del segmento elegido.</p>
              <form onSubmit={sendBroadcast} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Audiencia</label>
                  <select value={form.audience} onChange={e=>setForm(p=>({...p,audience:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                    <option value="ALL">👥 Todos</option>
                    <option value="BUYERS">🛒 Compradores</option>
                    <option value="VIP">⭐ VIP (3+ compras)</option>
                    <option value="INACTIVE">💤 Inactivos 30+ días</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Título *</label>
                  <input required value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="🎉 Oferta especial de verano" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase' }}>Mensaje *</label>
                  <textarea required rows={5} value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="Escribe tu promoción..." style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Se agrega automáticamente: "Responde STOP para darte de baja"</div>
                </div>
                <button type="submit" className="btn" disabled={sending} style={{ padding:13 }}>{sending?'⏳ Enviando...':`📢 Enviar a ${audienceLabel(form.audience)}`}</button>
              </form>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['👥','Suscritos Activos',activeSubs,'#eff6ff','#3B75C0'],['📢','Broadcasts',broadcasts.filter(b=>b.status==='DONE').length,'#f0fdf4','#15803d'],['💬','Mensajes Totales',broadcasts.reduce((a,b)=>a+(b.sent_count||0),0),'#f5f3ff','#7c3aed'],['💬','Conversaciones',conversations.length,'#fefce8','#ca8a04']].map(([icon,label,val,bg,color])=>(
                  <div key={label} style={{ background:bg, borderRadius:12, padding:'14px', border:`1px solid ${color}25` }}>
                    <div style={{ fontSize:18 }}>{icon}</div>
                    <div style={{ fontSize:10, color, fontWeight:700, textTransform:'uppercase', marginTop:4 }}>{label}</div>
                    <div style={{ fontSize:22, fontWeight:900, color }}>{val}</div>
                  </div>
                ))}
              </div>
              {(form.title||form.message) && (
                <div className="card">
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:10, textTransform:'uppercase' }}>Vista previa</div>
                  <div style={{ background:'#dcf8c6', borderRadius:'16px 16px 4px 16px', padding:'10px 14px', fontSize:13, whiteSpace:'pre-wrap', maxWidth:280 }}>
                    {form.title&&<><strong>{form.title}</strong>{'\n\n'}</>}{form.message}{'\n\n'}<em style={{ fontSize:11, color:'#64748b' }}>_Futura Marketplace — Responde STOP para darte de baja_</em>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SUBSCRIBERS ── */}
        {tab === 'subscribers' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0D3B87' }}>👥 Suscriptores ({subscribers.length})</h3>
              <input placeholder="🔍 Buscar..." value={searchSub} onChange={e=>setSearchSub(e.target.value)} style={{ padding:'8px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, width:260 }} />
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                {['Nombre','Teléfono','Email','Pedidos','Estado','Acción'].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>{filteredSubs.map(s=>(
                <tr key={s.id} style={{ borderBottom:'1px solid #f8fafc', opacity:s.opted_in?1:0.5 }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{s.name||'—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:12 }}>{s.phone}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{s.email||'—'}</td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}><span style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{s.total_orders||0}</span></td>
                  <td style={{ padding:'10px 12px' }}><span style={{ background:s.opted_in?'#f0fdf4':'#fef2f2', color:s.opted_in?'#15803d':'#dc2626', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{s.opted_in?'✓ Activo':'✗ Baja'}</span></td>
                  <td style={{ padding:'10px 12px' }}><button onClick={()=>apiFetch(`/api/admin/wa/subscribers/${s.id}/toggle`,{method:'POST'}).then(loadData)} style={{ background:s.opted_in?'#fef2f2':'#f0fdf4', color:s.opted_in?'#dc2626':'#15803d', border:`1px solid ${s.opted_in?'#fecaca':'#86efac'}`, padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600 }}>{s.opted_in?'Dar de baja':'Reactivar'}</button></td>
                </tr>
              ))}
              {filteredSubs.length===0&&<tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin suscriptores todavía. Se agregan cuando compradores se registran con teléfono.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div className="card">
            <h3 style={{ fontSize:16, fontWeight:800, color:'#0D3B87', marginBottom:16 }}>📋 Historial de Broadcasts</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {broadcasts.map(b=>(
                <div key={b.id} style={{ border:'1px solid #f1f5f9', borderRadius:12, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                      <span style={{ background:b.status==='DONE'?'#f0fdf4':'#fefce8', color:b.status==='DONE'?'#15803d':'#ca8a04', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{b.status}</span>
                      <span style={{ fontWeight:700, fontSize:14, color:'#0D3B87' }}>{b.title}</span>
                      <span style={{ fontSize:11, color:'#64748b', background:'#f1f5f9', padding:'2px 8px', borderRadius:20 }}>{audienceLabel(b.audience)}</span>
                    </div>
                    <p style={{ fontSize:13, color:'#475569', margin:'0 0 6px' }}>{b.message?.substring(0,100)}...</p>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>Por: {b.admin_name} · {fmt(b.created_at)}</div>
                  </div>
                  <div style={{ textAlign:'center', marginLeft:20 }}>
                    <div style={{ fontSize:22, fontWeight:900, color:'#15803d' }}>{b.sent_count}</div>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase' }}>Enviados</div>
                  </div>
                </div>
              ))}
              {broadcasts.length===0&&<div style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>No hay broadcasts todavía</div>}
            </div>
          </div>
        )}

        {/* ── LOYALTY ── */}
        {tab === 'loyalty' && (
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
            <div className="card">
              <h3 style={{ fontSize:16, fontWeight:800, color:'#0D3B87', marginBottom:16 }}>⭐ Puntos por Comprador</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                  {['Comprador','Email','Saldo','Total ganado','Pedidos','Acción'].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loyalty.map(u=>(
                    <tr key={u.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{u.name}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{u.email}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:'#fefce8', color:'#ca8a04', padding:'3px 10px', borderRadius:20, fontWeight:800 }}>⭐ {u.balance}</span></td>
                      <td style={{ padding:'10px 12px', color:'#64748b' }}>{u.total_earned}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}><span style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{u.total_orders}</span></td>
                      <td style={{ padding:'10px 12px' }}><button onClick={()=>setBonusForm(p=>({...p,userId:u.id}))} style={{ background:'#fefce8', color:'#ca8a04', border:'1px solid #fde68a', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600 }}>🎁 Dar puntos</button></td>
                    </tr>
                  ))}
                  {loyalty.length===0&&<tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Los puntos se acumulan con cada compra completada (10 pts / S/ 1)</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', marginBottom:14 }}>🎁 Otorgar Puntos Bonus</h3>
              <form onSubmit={sendBonus} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <select required value={bonusForm.userId} onChange={e=>setBonusForm(p=>({...p,userId:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="">Seleccionar comprador...</option>
                  {loyalty.map(u=><option key={u.id} value={u.id}>{u.name} (⭐{u.balance})</option>)}
                </select>
                <input type="number" required min="1" value={bonusForm.points} onChange={e=>setBonusForm(p=>({...p,points:e.target.value}))} placeholder="Puntos a otorgar" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <input value={bonusForm.description} onChange={e=>setBonusForm(p=>({...p,description:e.target.value}))} placeholder="Motivo (opcional)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <button type="submit" className="btn">🎁 Otorgar Puntos</button>
              </form>
              <div style={{ marginTop:16, padding:'12px 14px', background:'#fffbeb', borderRadius:10, border:'1px solid #fde68a', fontSize:12, color:'#78350f' }}>
                <strong>⭐ Sistema de Puntos Futura</strong><br/>
                • 10 pts por cada S/ 1 gastado<br/>
                • 100 pts de bienvenida al registrarse<br/>
                • Solo canjeables dentro de Futura Marketplace
              </div>
            </div>
          </div>
        )}

        {/* ── TEST ── */}
        {tab === 'test' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div className="card">
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0D3B87', marginBottom:14 }}>🧪 Probar Mensaje Directo</h3>
              <form onSubmit={async(e)=>{e.preventDefault();try{await apiFetch('/api/admin/wa/test',{method:'POST',body:JSON.stringify(testForm)});setMsg('✅ Mensaje enviado (modo mock)');}catch(err){setMsg('❌ '+err.message);}}} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input required value={testForm.phone} onChange={e=>setTestForm(p=>({...p,phone:e.target.value}))} placeholder="51999123456" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
                <textarea rows={4} required value={testForm.message} onChange={e=>setTestForm(p=>({...p,message:e.target.value}))} placeholder="Mensaje de prueba..." style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
                <button type="submit" className="btn">🧪 Enviar prueba</button>
              </form>
            </div>
            <div className="card">
              <h3 style={{ fontSize:15, fontWeight:700, color:'#0D3B87', marginBottom:14 }}>💬 Simulador de cliente</h3>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>Abre el simulador en otra pestaña y los mensajes aparecerán en la pestaña Bandeja en tiempo real.</p>
              <a href="/whatsapp-test" target="_blank" className="btn" style={{ display:'inline-block', textDecoration:'none', textAlign:'center', padding:'12px 20px' }}>Abrir simulador ↗</a>
              <div style={{ marginTop:16, padding:'12px 14px', background:'#eff6ff', borderRadius:8, fontSize:12, color:'#3B75C0' }}>
                El simulador envía mensajes a la Bandeja. Las respuestas del admin aparecen al instante en el simulador del cliente.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
