import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const STATUS_COLOR = { CREADA: '#64748b', PENDIENTE_PAGO: '#d97706', PAGADA: '#16a34a', ENVIADA: '#3b82f6', ENTREGADA: '#15803d', CANCELADA: '#ef4444' };

export default function Admin() {
  const [data, setData]       = useState({ items: [], totals: {} });
  const [users, setUsers]     = useState([]);
  const [tab, setTab]         = useState('commissions');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [deleting, setDeleting] = useState(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/admin/commissions').then(setData),
      apiFetch('/api/admin/users').then(setUsers)
    ]).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const deleteUser = async (id, name) => {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#0D3B87', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#A8CAEA', fontSize: 16 }}>⏳ Cargando...</div>
    </div>
  );

  const totalCommission = parseFloat(data.totals?.total_commission || 0);
  const totalNet        = parseFloat(data.totals?.total_net || 0);
  const totalRevenue    = totalCommission + totalNet;
  const vendedores      = users.filter(u => u.role === 'VENDEDOR').length;
  const compradores     = users.filter(u => u.role === 'COMPRADOR').length;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .tab-btn { transition: all 0.2s; cursor: pointer; }
        .row:hover { background: #f8fafc !important; }
        .row { transition: background 0.15s; }
        .del-btn:hover { background: #dc2626 !important; color: white !important; }
        .del-btn { transition: all 0.2s; }
      `}</style>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0D3B87, #1A4A8A)', boxShadow: '0 4px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 70, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                <img src="/logo-hero.png" alt="Futura" style={{ height: 40, objectFit: 'contain' }} />
              </a>
              <span style={{ color: '#3B75C0', fontSize: 20 }}>›</span>
              <span style={{ color: '#A8CAEA', fontSize: 14, fontWeight: 600 }}>⚙ Panel Administrador</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <a href="/admin/panel" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "white", padding: "8px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>⚙️ Super Admin</a>
              <a href="/admin/stats" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '8px 18px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                📊 Estadísticas
              </a>
              <a href="/admin/disputes" style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", padding: "8px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>⚖️ Disputas</a>
              <a href="/admin/report" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', padding: '8px 18px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                📄 Informe Detallado
              </a>
              <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13, marginLeft: 4 }}>← Inicio</a>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[['commissions', '💰 Comisiones', data.items.length], ['users', '👥 Usuarios', users.length]].map(([key, label, count]) => (
              <button key={key} onClick={() => setTab(key)} className="tab-btn"
                style={{ padding: '14px 24px', border: 'none', fontSize: 14, fontWeight: 700, background: 'transparent', color: tab === key ? 'white' : '#475569', borderBottom: tab === key ? '3px solid #3B75C0' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
                {label}
                <span style={{ background: tab === key ? '#3B75C0' : '#334155', color: 'white', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 40px', animation: 'fadeUp 0.5s ease' }}>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>⚠ {error}</div>}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            ['💵', 'Revenue Total', `S/ ${totalRevenue.toFixed(2)}`, '#f0fdf4', '#15803d', '#166534'],
            ['📊', 'Comisión Futura', `S/ ${totalCommission.toFixed(2)}`, '#eff6ff', '#3B75C0', '#1d4ed8'],
            ['💸', 'Neto Vendedores', `S/ ${totalNet.toFixed(2)}`, '#f5f3ff', '#7c3aed', '#4c1d95'],
            ['🏪', 'Vendedores', vendedores, '#fefce8', '#ca8a04', '#78350f'],
            ['🛒', 'Compradores', compradores, '#fdf4ff', '#a21caf', '#701a75'],
          ].map(([icon, label, val, bg, color, dark]) => (
            <div key={label} style={{ background: bg, borderRadius: 16, padding: '18px 20px', border: `1px solid ${color}25` }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: dark }}>{val}</div>
            </div>
          ))}
        </div>

        {/* COMISIONES */}
        {tab === 'commissions' && (
          <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0D3B87', margin: 0 }}>Detalle de comisiones</h2>
              <span style={{ fontSize: 13, color: '#64748b' }}>{data.items.length} transacciones</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#Orden', 'Producto', 'Vendedor', 'Estado', 'Precio', 'Comisión (10%)', 'Neto'].map((h) => (
                      <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c, i) => (
                    <tr key={`${c.id}-${i}`} className="row" style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#3B75C0' }}>#{c.order_id}</td>
                      <td style={{ padding: '14px 16px', color: '#0D3B87', fontWeight: 600 }}>{c.product_title}</td>
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 700 }}>
                            {c.seller_name?.[0]}
                          </div>
                          {c.seller_name}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: `${STATUS_COLOR[c.order_status] || '#64748b'}15`, color: STATUS_COLOR[c.order_status] || '#64748b', border: `1px solid ${STATUS_COLOR[c.order_status] || '#64748b'}25` }}>
                          {c.order_status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0D3B87' }}>S/ {parseFloat(c.price).toFixed(2)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 800, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: 8 }}>S/ {parseFloat(c.commission).toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#475569' }}>S/ {parseFloat(c.net).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#0D3B87', borderTop: '2px solid #1A4A8A' }}>
                    <td colSpan={4} style={{ padding: '16px', fontWeight: 800, color: 'white', fontSize: 13 }}>TOTALES</td>
                    <td style={{ padding: '16px', fontWeight: 800, color: 'white' }}>S/ {totalRevenue.toFixed(2)}</td>
                    <td style={{ padding: '16px' }}><span style={{ fontWeight: 900, color: '#86efac', background: 'rgba(22,163,74,0.2)', padding: '6px 12px', borderRadius: 8 }}>S/ {totalCommission.toFixed(2)}</span></td>
                    <td style={{ padding: '16px', fontWeight: 800, color: '#A8CAEA' }}>S/ {totalNet.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* USUARIOS CON ELIMINAR */}
        {tab === 'users' && (
          <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0D3B87', margin: 0 }}>Gestión de usuarios</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ background: '#eff6ff', color: '#3B75C0', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{vendedores} vendedores</span>
                <span style={{ background: '#fdf4ff', color: '#a21caf', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{compradores} compradores</span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['#', 'Usuario', 'Email', 'Rol', 'Registro', 'Acción'].map((h) => (
                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const roleColors = { ADMIN: ['#fef2f2', '#ef4444'], VENDEDOR: ['#eff6ff', '#3B75C0'], COMPRADOR: ['#f0fdf4', '#16a34a'] };
                  const [bg, color] = roleColors[u.role] || ['#f8fafc', '#64748b'];
                  return (
                    <tr key={u.id} className="row" style={{ borderBottom: '1px solid #f8fafc', animation: `fadeUp 0.3s ease ${i * 0.03}s both` }}>
                      <td style={{ padding: '14px 16px', color: '#94a3b8', fontWeight: 600 }}>#{u.id}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${color}, ${color}aa)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'white', fontWeight: 800, flexShrink: 0 }}>
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: bg, color, border: `1px solid ${color}30` }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>
                        {new Date(u.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {u.role !== 'ADMIN' ? (
                          <button onClick={() => deleteUser(u.id, u.name)} disabled={deleting === u.id} className="del-btn"
                            style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {deleting === u.id ? '⏳' : '🗑'} {deleting === u.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>— Admin protegido</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
