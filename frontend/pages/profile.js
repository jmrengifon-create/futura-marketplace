import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [name, setName]       = useState('');
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([
      apiFetch('/api/profile'),
      apiFetch('/api/my-orders').catch(() => [])
    ]).then(([prof, ords]) => {
      setProfile(prof);
      setName(prof.name);
      setOrders(ords);
    }).catch(() => setError('Error al cargar el perfil'))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ name }) });
      localStorage.setItem('name', name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const STATUS_COLOR = { CREADA: '#94a3b8', PENDIENTE_PAGO: '#d97706', PAGADA: '#16a34a', ENVIADA: '#3B75C0', ENTREGADA: '#15803d', CANCELADA: '#dc2626' };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b', fontFamily: 'system-ui' }}>Cargando...</div>;

  return (
    <div style={{ fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ padding: '16px 40px', background: '#0D3B87', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ color: 'white', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>Futura Marketplace</a>
        <a href="/" style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none' }}>← Volver al catálogo</a>
      </header>

      <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px' }}>

        {/* Perfil */}
        <div style={{ background: 'white', borderRadius: 16, padding: '28px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D3B87', marginBottom: 4 }}>Mi Perfil</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
            {profile?.email} · <span style={{ background: '#D0E8F5', color: '#2A5CA8', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{profile?.role}</span>
          </p>

          {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

          <form onSubmit={saveProfile} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Nombre completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={saving}
              style={{ padding: '10px 24px', background: saved ? '#16a34a' : '#3B75C0', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Mis órdenes */}
        <div style={{ background: 'white', borderRadius: 16, padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D3B87', marginBottom: 20 }}>Mis órdenes</h2>
          {orders.length === 0
            ? <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No tienes órdenes aún. <a href="/" style={{ color: '#3B75C0' }}>Ver productos</a></p>
            : orders.map((o) => (
              <div key={o.id} style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#0D3B87' }}>Orden #{o.id}</span>
                    <span style={{ color: '#64748b', fontSize: 13, marginLeft: 10 }}>{new Date(o.created_at).toLocaleDateString('es-PE')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${STATUS_COLOR[o.status]}20`, color: STATUS_COLOR[o.status] }}>
                      {o.status}
                    </span>
                    <strong style={{ color: '#0D3B87' }}>S/ {parseFloat(o.total).toFixed(2)}</strong>
                  </div>
                </div>
                {o.items && o.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f8fafc', fontSize: 14, color: '#4A6FA8' }}>
                    <span>{item.title}</span>
                    <span>S/ {parseFloat(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
