import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const STATUS_COLOR = {
  CREADA: '#64748b', PENDIENTE_PAGO: '#d97706', PAGADA: '#16a34a',
  ENVIADA: '#3B75C0', ENTREGADA: '#15803d', CANCELADA: '#ef4444'
};
const STATUS_LABEL = {
  CREADA: 'Creada', PENDIENTE_PAGO: 'Pago pendiente', PAGADA: 'Pagada',
  ENVIADA: 'Enviada', ENTREGADA: 'Entregada', CANCELADA: 'Cancelada'
};
const STATUS_ICON = {
  CREADA: '📋', PENDIENTE_PAGO: '⏳', PAGADA: '✅',
  ENVIADA: '🚚', ENTREGADA: '📦', CANCELADA: '❌'
};

export default function SellerPanel() {
  const [tab, setTab]           = useState('orders');
  const [orders, setOrders]     = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const loadOrders   = () => apiFetch('/api/seller/orders').then((data) => setOrders(data.orders || data || [])).catch((e) => setError(e.message));
  const loadProducts = () => apiFetch('/api/seller/products').then(setProducts).catch((e) => setError(e.message));

  useEffect(() => {
    Promise.all([loadOrders(), loadProducts()]).finally(() => setLoading(false));
  }, []);

  const markShipped = async (id) => {
    try { await apiFetch(`/api/orders/${id}/shipped`, { method: 'POST' }); loadOrders(); }
    catch (e) { alert(e.message); }
  };

  const deleteProduct = async (id) => {
    if (!confirm('¿Deseas eliminar este producto?')) return;
    try { await apiFetch(`/api/products/${id}`, { method: 'DELETE' }); loadProducts(); }
    catch (e) { alert(e.message); }
  };

  const totalNeto      = orders.reduce((a, o) => a + parseFloat(o.net || 0), 0);
  const totalComision  = orders.reduce((a, o) => a + parseFloat(o.commission || 0), 0);
  const ordenesPagadas = orders.filter((o) => o.status === 'PAGADA').length;

  if (loading) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#0D3B87', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 16 }}>⏳ Cargando panel...</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .tab-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .tab-btn { transition: all 0.2s; }
        .action-btn:hover { opacity:0.85; transform:scale(1.02); }
        .action-btn { transition: all 0.2s; }
        .card { transition: box-shadow 0.2s; }
        .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.1) !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0D3B87, #0D3B87)', padding: '0', boxShadow: '0 4px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 70, gap: 20, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <div style={{ width: 'auto', height: 36 }}><img src='/logo-hero.png' alt='Futura' style={{ height: 40, objectFit: 'contain' }} /></div>
              </a>
              <span style={{ color: '#1A4A8A', fontSize: 20 }}>›</span>
              <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>Panel Vendedor</span>
            </div>
            <a href="/seller/dashboard" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📊 Mi Dashboard</a>
            <a href="/seller/quotations" style={{ background: "rgba(245,158,11,0.2)", color: "#fcd34d", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📋 Cotizaciones</a>
            <a href="/seller/new-product"
              style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '10px 22px', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 14px rgba(59,130,246,0.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
              + Publicar producto
            </a>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, paddingBottom: 0 }}>
            {[['orders', '📦 Mis Órdenes', orders.length], ['products', '🏪 Mis Productos', products.length]].map(([key, label, count]) => (
              <button key={key} onClick={() => setTab(key)} className="tab-btn"
                style={{ padding: '14px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: 'transparent', color: tab === key ? 'white' : '#4A6FA8', borderBottom: tab === key ? '3px solid #3B75C0' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
                {label}
                <span style={{ background: tab === key ? '#3B75C0' : '#1A4A8A', color: 'white', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 40px', animation: 'fadeUp 0.5s ease' }}>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 14 }}>⚠ {error}</div>}

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            ['💰', 'Neto total ganado', `S/ ${totalNeto.toFixed(2)}`, '#f0fdf4', '#15803d', '#166534'],
            ['📊', 'Comisión Futura (10%)', `S/ ${totalComision.toFixed(2)}`, '#EBF4FF', '#3B75C0', '#2A5CA8'],
            ['✅', 'Órdenes por enviar', ordenesPagadas, '#fefce8', '#ca8a04', '#92400e'],
          ].map(([icon, label, val, bg, color, dark]) => (
            <div key={label} style={{ background: bg, borderRadius: 16, padding: '20px 24px', border: `1px solid ${color}30` }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 12, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: dark }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ÓRDENES */}
        {tab === 'orders' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0D3B87', marginBottom: 16 }}>Historial de órdenes</h2>
            {orders.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 20, padding: '64px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Aún no tienes órdenes</h3>
                <p style={{ color: '#94a3b8', marginBottom: 24 }}>Publica productos para empezar a vender</p>
                <a href="/seller/dashboard" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📊 Mi Dashboard</a>
            <a href="/seller/quotations" style={{ background: "rgba(245,158,11,0.2)", color: "#fcd34d", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📋 Cotizaciones</a>
            <a href="/seller/new-product" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>
                  + Publicar producto
                </a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.map((o, i) => (
                  <div key={`${o.id}-${i}`} className="card" style={{ background: 'white', borderRadius: 16, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', animation: `fadeUp 0.4s ease ${i * 0.04}s both` }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, background: `${STATUS_COLOR[o.status]}15`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${STATUS_COLOR[o.status]}30` }}>
                        {STATUS_ICON[o.status]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0D3B87', fontSize: 15, marginBottom: 4 }}>
                          Orden #{o.id} · <span style={{ color: '#374151' }}>{o.product_title}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16 }}>
                          <span>Total: <strong style={{ color: '#0D3B87' }}>S/ {o.total}</strong></span>
                          <span>Comisión: <strong style={{ color: '#ef4444' }}>S/ {o.commission}</strong></span>
                          <span>Neto: <strong style={{ color: '#16a34a' }}>S/ {o.net}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, background: `${STATUS_COLOR[o.status]}15`, color: STATUS_COLOR[o.status], border: `1px solid ${STATUS_COLOR[o.status]}30` }}>
                        {STATUS_LABEL[o.status]}
                      </span>
                      {o.status === 'PAGADA' && (
                        <button onClick={() => markShipped(o.id)} className="action-btn"
                          style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          🚚 Marcar enviada
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRODUCTOS */}
        {tab === 'products' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0D3B87' }}>Mis productos publicados</h2>
              <a href="/seller/dashboard" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📊 Mi Dashboard</a>
            <a href="/seller/quotations" style={{ background: "rgba(245,158,11,0.2)", color: "#fcd34d", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📋 Cotizaciones</a>
            <a href="/seller/new-product" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '9px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>+ Nuevo</a>
            </div>
            {products.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 20, padding: '64px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🏪</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No tienes productos</h3>
                <a href="/seller/dashboard" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📊 Mi Dashboard</a>
            <a href="/seller/quotations" style={{ background: "rgba(245,158,11,0.2)", color: "#fcd34d", padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, marginRight: 8 }}>📋 Cotizaciones</a>
            <a href="/seller/new-product" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>Publicar ahora</a>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {products.map((p, i) => (
                  <div key={p.id} className="card" style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', animation: `fadeUp 0.4s ease ${i * 0.05}s both` }}>
                    <div style={{ height: 160, overflow: 'hidden', position: 'relative', background: '#f8fafc' }}>
                      <img src={p.image_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 10, right: 10, background: p.active ? '#f0fdf4' : '#fef2f2', border: `1px solid ${p.active ? '#86efac' : '#fca5a5'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: p.active ? '#15803d' : '#dc2626' }}>
                        {p.active ? '● Activo' : '● Inactivo'}
                      </div>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D3B87', margin: '0 0 6px' }}>{p.title}</h3>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0D3B87', marginBottom: 14 }}>S/ {parseFloat(p.price).toLocaleString()}</div>
                      <button onClick={() => deleteProduct(p.id)} className="action-btn"
                        style={{ width: '100%', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 10, padding: '9px', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
                        🗑 Eliminar producto
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
