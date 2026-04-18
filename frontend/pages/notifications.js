import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

const TYPE_ICON = {
  DISPUTA_RESUELTA:   '⚖️',
  PAGO_CONFIRMADO:    '✅',
  NUEVA_ORDEN:        '📦',
  COTIZACION_RECIBIDA:'💰',
  COTIZACION_ACEPTADA:'🎉',
  NUEVA_COTIZACION:   '📋',
  ORDEN_ENVIADA:      '🚚',
  CUENTA_APROBADA:    '✓',
  DISPUTA_ABIERTA:    '⚠️',
  DISPUTA_ADMIN:      '⚠️',
  REEMBOLSO:          '↩',
  PRODUCCION_UPDATE:  '⚙️',
  PAGO_LIBERADO:      '💸',
  NEWSLETTER:         '📧',
  DEFAULT:            '🔔',
};

export default function Notifications() {
  const router = useRouter();
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    load();
  }, []);

  const load = () => {
    apiFetch('/api/notifications')
      .then(setData)
      .finally(() => setLoading(false));
  };

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read', { method: 'PUT' });
    load();
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)}d`;
  };

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding: '0 40px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Inicio</a>
            <span style={{ color: '#3B75C0' }}>›</span>
            <span style={{ color: 'white', fontWeight: 700 }}>🔔 Notificaciones</span>
            {data.unread > 0 && (
              <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', width: 22, height: 22, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {data.unread}
              </span>
            )}
          </div>
          {data.unread > 0 && (
            <button onClick={markAllRead}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#A8CAEA', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Marcar todas como leídas
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: '28px auto', padding: '0 20px', animation: 'fadeUp 0.4s ease' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Cargando...</div>
        ) : data.notifications.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: 64, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🔔</div>
            <h3 style={{ color: '#0D3B87', margin: '0 0 8px' }}>Sin notificaciones</h3>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Las actualizaciones de tus órdenes y cotizaciones aparecerán aquí</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.notifications.map((n, i) => (
              <a key={n.id} href={n.link || '/'} style={{ textDecoration: 'none', animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>
                <div style={{
                  background: n.read ? 'white' : '#eff6ff',
                  border: n.read ? '0.5px solid #f1f5f9' : '1px solid #bfdbfe',
                  borderRadius: 14,
                  padding: '14px 18px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: n.read ? '#f8fafc' : '#dbeafe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {TYPE_ICON[n.type] || TYPE_ICON.DEFAULT}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                      <span style={{ fontWeight: n.read ? 400 : 700, fontSize: 14, color: '#0D3B87' }}>{n.title}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 10 }}>{timeAgo(n.created_at)}</span>
                    </div>
                    {n.message && <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{n.message}</p>}
                  </div>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B75C0', flexShrink: 0, marginTop: 6 }}/>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
