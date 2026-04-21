// frontend/pages/admin/whatsapp.js
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (d) => d ? new Date(d).toLocaleString('es-PE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

export default function AdminWhatsApp() {
  const [tab, setTab]               = useState('broadcast');
  const [subscribers, setSubscribers] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loyalty, setLoyalty]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [msg, setMsg]               = useState('');
  const [form, setForm]             = useState({ title: '', message: '', audience: 'ALL' });
  const [bonusForm, setBonusForm]   = useState({ userId: '', points: '', description: '' });
  const [testForm, setTestForm]     = useState({ phone: '', message: '' });
  const [searchSub, setSearchSub]   = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, bcs, loy] = await Promise.all([
        apiFetch('/api/admin/wa/subscribers').catch(() => []),
        apiFetch('/api/admin/wa/broadcasts').catch(() => []),
        apiFetch('/api/admin/loyalty').catch(() => []),
      ]);
      setSubscribers(subs);
      setBroadcasts(bcs);
      setLoyalty(loy);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    if (!token || role !== 'ADMIN') { window.location.href = '/login'; return; }
    loadData();
  }, []);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Enviar a todos los suscriptores (${audienceLabel(form.audience)})?`)) return;
    setSending(true);
    try {
      const r = await apiFetch('/api/admin/wa/broadcast', { method: 'POST', body: JSON.stringify(form) });
      setMsg(`✅ Broadcast enviado a ${r.recipients} suscriptores (ID: #${r.broadcastId})`);
      setForm({ title: '', message: '', audience: 'ALL' });
      setTimeout(loadData, 2000);
    } catch (err) { setMsg('❌ Error al enviar: ' + err.message); }
    finally { setSending(false); }
  };

  const sendTest = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/wa/test', { method: 'POST', body: JSON.stringify(testForm) });
      setMsg('✅ Mensaje de prueba enviado (modo mock si no hay credenciales Meta configuradas)');
    } catch (err) { setMsg('❌ ' + err.message); }
  };

  const toggleSubscriber = async (id) => {
    await apiFetch(`/api/admin/wa/subscribers/${id}/toggle`, { method: 'POST' });
    loadData();
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

  const audienceLabel = (a) => ({ ALL: 'Todos', BUYERS: 'Compradores', VIP: 'VIP (3+ compras)', INACTIVE: 'Inactivos 30 días' }[a] || a);
  const statusColor   = (s) => ({ DONE: '#15803d', SENDING: '#ca8a04', DRAFT: '#64748b', FAILED: '#dc2626' }[s] || '#64748b');
  const statusBg      = (s) => ({ DONE: '#f0fdf4', SENDING: '#fefce8', DRAFT: '#f8fafc', FAILED: '#fef2f2' }[s] || '#f8fafc');

  const filteredSubs = subscribers.filter(s =>
    !searchSub || s.name?.toLowerCase().includes(searchSub.toLowerCase()) ||
    s.phone?.includes(searchSub) || s.email?.toLowerCase().includes(searchSub.toLowerCase())
  );
  const activeSubs  = subscribers.filter(s => s.opted_in).length;

  const TABS = [
    ['broadcast', '📢 Broadcast'],
    ['subscribers', `👥 Suscritos (${activeSubs})`],
    ['history', '📋 Historial'],
    ['loyalty', '⭐ Puntos Fidelidad'],
    ['test', '🧪 Pruebas'],
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important;box-shadow:0 0 0 3px rgba(59,117,192,0.1)!important}
        .btn-primary{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;font-size:13px;transition:opacity 0.2s}
        .btn-primary:hover{opacity:0.9}
        .btn-primary:disabled{opacity:0.6;cursor:not-allowed}
        .card{background:white;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
      `}</style>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow: '0 4px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 60, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="/admin/panel" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 13 }}>← Panel Admin</a>
              <span style={{ color: '#3B75C0' }}>›</span>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>📱 WhatsApp Marketing + Fidelidad</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#A8CAEA' }}>
              <span>👥 {activeSubs} suscritos activos</span>
              <span>📢 {broadcasts.filter(b => b.status === 'DONE').length} broadcasts enviados</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {TABS.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === key ? 700 : 400,
                color: tab === key ? 'white' : '#64748b',
                borderBottom: tab === key ? '3px solid #3B75C0' : '3px solid transparent',
                whiteSpace: 'nowrap'
              }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 32px', animation: 'fadeUp 0.4s ease' }}>
        {msg && (
          <div style={{ background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.startsWith('✅') ? '#86efac' : '#fecaca'}`, color: msg.startsWith('✅') ? '#15803d' : '#dc2626', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg}</span>
            <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* ── BROADCAST TAB ── */}
        {tab === 'broadcast' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', marginBottom: 6 }}>📢 Enviar Broadcast Masivo</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>El mensaje se enviará por WhatsApp a todos los suscriptores activos del segmento elegido.</p>

              <form onSubmit={sendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Segmento de audiencia</label>
                  <select value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, background: 'white' }}>
                    <option value="ALL">👥 Todos los suscriptores</option>
                    <option value="BUYERS">🛒 Solo compradores</option>
                    <option value="VIP">⭐ VIP (3+ compras)</option>
                    <option value="INACTIVE">💤 Inactivos 30+ días</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Título del mensaje *</label>
                  <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="🎉 Oferta especial de verano"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Mensaje *</label>
                  <textarea required rows={5} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Escribe tu promoción aquí. Puedes usar *texto en negrita* y _cursiva_."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Se agrega automáticamente: "Responde STOP para darte de baja"</div>
                </div>
                <button type="submit" className="btn-primary" disabled={sending} style={{ padding: 13, fontSize: 15 }}>
                  {sending ? '⏳ Enviando...' : `📢 Enviar a ${audienceLabel(form.audience)}`}
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['👥', 'Suscritos Activos', activeSubs, '#eff6ff', '#3B75C0'],
                  ['📵', 'Dados de Baja', subscribers.length - activeSubs, '#fef2f2', '#dc2626'],
                  ['📢', 'Broadcasts', broadcasts.filter(b => b.status === 'DONE').length, '#f0fdf4', '#15803d'],
                  ['💬', 'Mensajes Totales', broadcasts.reduce((a, b) => a + (b.sent_count || 0), 0), '#f5f3ff', '#7c3aed'],
                ].map(([icon, label, val, bg, color]) => (
                  <div key={label} style={{ background: bg, borderRadius: 12, padding: '16px', border: `1px solid ${color}25` }}>
                    <div style={{ fontSize: 20 }}>{icon}</div>
                    <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', marginTop: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {(form.title || form.message) && (
                <div className="card">
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>Vista previa del mensaje</div>
                  <div style={{ background: '#dcf8c6', borderRadius: '16px 16px 4px 16px', padding: '12px 16px', fontSize: 14, color: '#0D3B87', whiteSpace: 'pre-wrap', maxWidth: 320 }}>
                    {form.title && <><strong>{form.title}</strong>{'\n\n'}</>}
                    {form.message}{'\n\n'}
                    <em style={{ fontSize: 12, color: '#64748b' }}>_Futura Marketplace — Responde STOP para darte de baja_</em>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SUBSCRIBERS TAB ── */}
        {tab === 'subscribers' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0D3B87' }}>👥 Suscriptores WhatsApp ({subscribers.length})</h3>
              <input placeholder="🔍 Buscar nombre, teléfono o email..."
                value={searchSub} onChange={e => setSearchSub(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, width: 280 }} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    {['#', 'Nombre', 'Teléfono', 'Email', 'Pedidos', 'Suscrito desde', 'Estado', 'Acción'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc', opacity: s.opted_in ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>#{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{s.phone}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{s.email || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ background: '#eff6ff', color: '#3B75C0', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{s.total_orders || 0}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#94a3b8' }}>{fmt(s.opted_at)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: s.opted_in ? '#f0fdf4' : '#fef2f2', color: s.opted_in ? '#15803d' : '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {s.opted_in ? '✓ Activo' : '✗ Baja'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => toggleSubscriber(s.id)}
                          style={{ background: s.opted_in ? '#fef2f2' : '#f0fdf4', color: s.opted_in ? '#dc2626' : '#15803d', border: `1px solid ${s.opted_in ? '#fecaca' : '#86efac'}`, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          {s.opted_in ? 'Dar de baja' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSubs.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      {loading ? 'Cargando...' : 'No hay suscriptores todavía. Se agregan automáticamente cuando los compradores se registran con teléfono.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', marginBottom: 20 }}>📋 Historial de Broadcasts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {broadcasts.map((b) => (
                <div key={b.id} style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '16px 20px', background: statusBg(b.status) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ background: statusBg(b.status), color: statusColor(b.status), border: `1px solid ${statusColor(b.status)}40`, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {b.status}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#0D3B87' }}>{b.title}</span>
                        <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>{audienceLabel(b.audience)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px', whiteSpace: 'pre-line' }}>{b.message.substring(0, 120)}{b.message.length > 120 ? '...' : ''}</p>
                      <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 16 }}>
                        <span>Enviado por: {b.admin_name}</span>
                        <span>Creado: {fmt(b.created_at)}</span>
                        {b.sent_at && <span>Completado: {fmt(b.sent_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexShrink: 0, marginLeft: 20 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d' }}>{b.sent_count}</div>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Enviados</div>
                      </div>
                      {b.fail_count > 0 && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626' }}>{b.fail_count}</div>
                          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Fallidos</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {broadcasts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 48 }}>📢</div>
                  <p>No hay broadcasts enviados todavía</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LOYALTY TAB ── */}
        {tab === 'loyalty' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', marginBottom: 20 }}>⭐ Puntos de Fidelidad por Comprador</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    {['#', 'Comprador', 'Email', 'Saldo', 'Total ganado', 'Pedidos', 'Acción'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loyalty.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>#{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{u.email}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: '#fefce8', color: '#ca8a04', padding: '3px 10px', borderRadius: 20, fontWeight: 800, fontSize: 13 }}>⭐ {u.balance}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.total_earned}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ background: '#eff6ff', color: '#3B75C0', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{u.total_orders}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => setBonusForm(p => ({ ...p, userId: u.id }))}
                          style={{ background: '#fefce8', color: '#ca8a04', border: '1px solid #fde68a', padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          🎁 Dar puntos
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loyalty.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      Los puntos se acumulan automáticamente con cada compra completada (10 pts por cada S/ 1).
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0D3B87', marginBottom: 16 }}>🎁 Otorgar Puntos Bonus</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Da puntos extra a un comprador por fidelidad, referidos o campañas especiales.</p>
              <form onSubmit={sendBonus} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Comprador *</label>
                  <select required value={bonusForm.userId} onChange={e => setBonusForm(p => ({ ...p, userId: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, background: 'white' }}>
                    <option value="">Seleccionar comprador...</option>
                    {loyalty.map(u => <option key={u.id} value={u.id}>{u.name} (⭐{u.balance} pts)</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Puntos a otorgar *</label>
                  <input type="number" required min="1" max="10000" value={bonusForm.points} onChange={e => setBonusForm(p => ({ ...p, points: e.target.value }))}
                    placeholder="Ej: 500"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Motivo</label>
                  <input value={bonusForm.description} onChange={e => setBonusForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ej: Referido activo, Campaña julio..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: 12 }}>🎁 Otorgar Puntos</button>
              </form>

              <div style={{ marginTop: 24, padding: '14px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>⭐ Sistema de Puntos Futura</div>
                <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                  • 10 pts por cada S/ 1 gastado<br />
                  • Se acumulan en cada compra completada<br />
                  • Solo canjeables dentro de Futura Marketplace<br />
                  • Válidos por 12 meses desde su emisión
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TEST TAB ── */}
        {tab === 'test' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', marginBottom: 6 }}>🧪 Probar Mensaje WhatsApp</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                Si no tienes las credenciales de Meta configuradas, el mensaje se enviará en modo mock (solo log en consola del servidor).
                Para envíos reales configura <code>WA_PHONE_ID</code> y <code>WA_ACCESS_TOKEN</code> en Railway.
              </p>
              <form onSubmit={sendTest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Número destino (con código país)</label>
                  <input required value={testForm.phone} onChange={e => setTestForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="51999123456"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Mensaje</label>
                  <textarea rows={4} required value={testForm.message} onChange={e => setTestForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Mensaje de prueba..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
                <button type="submit" className="btn-primary">🧪 Enviar prueba</button>
              </form>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D3B87', marginBottom: 16 }}>⚙️ Estado de credenciales Meta</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                {[
                  ['WA_PHONE_ID', 'Phone Number ID de Meta'],
                  ['WA_ACCESS_TOKEN', 'Token de acceso de Meta'],
                  ['WA_APP_SECRET', 'App Secret para verificar webhooks'],
                  ['WA_VERIFY_TOKEN', 'Token de verificación del webhook'],
                ].map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                    <div>
                      <code style={{ fontSize: 12, color: '#0D3B87' }}>{key}</code>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ca8a04' }}>Configurar en Railway → Variables</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#3B75C0' }}>
                <strong>Webhook URL para Meta:</strong><br />
                <code style={{ fontSize: 11 }}>https://futura-marketplace-production.up.railway.app/api/whatsapp/webhook</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
