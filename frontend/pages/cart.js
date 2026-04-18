import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Cart() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);
  const [error, setError]     = useState('');
  const [customFile, setCustomFile] = useState(null);

  const load = () => {
    setLoading(true);
    apiFetch('/api/cart').then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const removeItem = async (id) => {
    try { await apiFetch(`/api/cart/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { setError(e.message); }
  };

  const checkout = async () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    setPaying(true); setError('');
    try {
      const token    = localStorage.getItem('token');
      const formData = new FormData();
      if (customFile) formData.append('customFile', customFile);
      const orderRes = await fetch(`${BASE}/api/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: customFile ? formData : undefined
      });
      if (!orderRes.ok) { const e = await orderRes.json(); throw new Error(e.error); }
      const order = await orderRes.json();
      const mp = await apiFetch('/api/payments/create', { method: 'POST', body: JSON.stringify({ orderId: order.orderId }) });
      window.location.href = mp.url;
    } catch (err) { setError(err.message || 'Error al procesar el pago'); setPaying(false); }
  };

  const total = items.reduce((acc, i) => acc + parseFloat(i.price) * i.quantity, 0);

  if (loading) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 16 }}>⏳ Cargando carrito...</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .btn:hover { opacity:0.9; transform:translateY(-1px); }
        .btn { transition: all 0.2s; }
        .remove:hover { background: #fecaca !important; }
        .remove { transition: background 0.2s; }
      `}</style>

      <header style={{ background: 'linear-gradient(135deg, #0D3B87, #0D3B87)', padding: '0 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>← Catálogo</a>
            <span style={{ color: '#1A4A8A' }}>›</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>🛒 Mi Carrito</span>
          </div>
          <span style={{ color: '#4A6FA8', fontSize: 13 }}>{items.length} producto{items.length !== 1 ? 's' : ''}</span>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start', animation: 'fadeUp 0.5s ease' }}>

        {/* Lista de productos */}
        <div>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14 }}>⚠ {error}</div>}

          {items.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 20, padding: '64px 40px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>🛒</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0D3B87', marginBottom: 8 }}>Tu carrito está vacío</h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>Explora nuestro catálogo y encuentra maquinaria de calidad</p>
              <a href="/" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Ver productos</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((i, idx) => (
                <div key={i.id} style={{ background: 'white', borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', animation: `fadeUp 0.4s ease ${idx * 0.05}s both` }}>
                  <img src={i.image_url} alt={i.title} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#0D3B87', marginBottom: 4 }}>{i.title}</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 0 }}>Cantidad: {i.quantity}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0D3B87', marginBottom: 8 }}>S/ {(parseFloat(i.price) * i.quantity).toLocaleString()}</div>
                    <button onClick={() => removeItem(i.id)} className="remove"
                      style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Archivo de personalización */}
          {items.length > 0 && (
            <div style={{ background: 'white', borderRadius: 16, padding: '20px', marginTop: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 4 }}>📎 ¿Tienes un archivo de diseño?</div>
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Puedes adjuntar tu logo o diseño personalizado (opcional)</p>
              <input type="file" onChange={(e) => setCustomFile(e.target.files[0])} style={{ fontSize: 13, color: '#4A6FA8' }} />
              {customFile && <p style={{ fontSize: 12, color: '#16a34a', marginTop: 8, fontWeight: 600 }}>✓ Archivo seleccionado: {customFile.name}</p>}
            </div>
          )}
        </div>

        {/* Resumen */}
        {items.length > 0 && (
          <div style={{ background: 'white', borderRadius: 20, padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', position: 'sticky', top: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', marginBottom: 20 }}>Resumen de orden</h3>
            {items.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
                <span style={{ color: '#4A6FA8', flex: 1, marginRight: 8 }}>{i.title}</span>
                <span style={{ fontWeight: 700, color: '#0D3B87', flexShrink: 0 }}>S/ {(parseFloat(i.price) * i.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0', marginTop: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87' }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#0D3B87' }}>S/ {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', margin: '16px 0', fontSize: 12, color: '#15803d', display: 'flex', gap: 6, alignItems: 'center' }}>
              🔒 Pago 100% seguro y encriptado
            </div>
            <button onClick={checkout} disabled={paying} className="btn"
              style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(59,130,246,0.35)', opacity: paying ? 0.7 : 1 }}>
              {paying ? '⏳ Procesando...' : '💳 Pagar ahora'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
