import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../../lib/api';

export default function Product() {
  const { id }            = useRouter().query;
  const [p, setP]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (id) apiFetch(`/api/products/${id}`).then(setP).catch(() => setError('Producto no encontrado'));
  }, [id]);

  const requestQuote = () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    window.location.href = `/quote/${p.id}`;
  };

  const addToCart = async () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    setLoading(true);
    try {
      await apiFetch('/api/cart', { method: 'POST', body: JSON.stringify({ productId: p.id }) });
      setAdded(true);
      setTimeout(() => setAdded(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (error) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#0D3B87', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>😕</div>
      <p style={{ color: '#94a3b8', fontSize: 18 }}>{error}</p>
      <a href="/" style={{ color: '#3B75C0', textDecoration: 'none', fontWeight: 600 }}>← Volver al catálogo</a>
    </div>
  );

  if (!p) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#0D3B87', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 16 }}>Cargando producto...</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .btn:hover { opacity:0.9; transform:translateY(-2px); box-shadow:0 8px 24px rgba(59,130,246,0.45) !important; }
        .btn { transition: all 0.25s; }
      `}</style>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0D3B87, #0D3B87)', padding: '0 40px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, gap: 20 }}>
          <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>← Catálogo</a>
          <span style={{ color: '#1A4A8A' }}>›</span>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>{p.title}</span>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 20px', animation: 'fadeUp 0.5s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          {/* Imagen */}
          <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.15)', background: '#f8fafc', position: 'relative' }}>
            <img src={p.image_url} alt={p.title} style={{ width: '100%', height: 420, objectFit: 'cover', display: 'block' }} />
            {p.category_name && (
              <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', color: '#A8CAEA', fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {p.category_name}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0D3B87', margin: '0 0 12px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{p.title}</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Vendedor verificado</div>
                <div style={{ fontSize: 15, color: '#0D3B87', fontWeight: 700 }}>{p.seller_name}</div>
              </div>
            </div>

            {/* Precio destacado */}
            <div style={{ background: 'linear-gradient(135deg, #EBF4FF, #D0E8F5)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, border: '1px solid #A8CAEA' }}>
              <div style={{ fontSize: 12, color: '#2A5CA8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Precio de venta</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#0D3B87', letterSpacing: '-1px' }}>S/ {parseFloat(p.price).toLocaleString()}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Incluye IGV · Precio final</div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Descripción</h3>
              <p style={{ fontSize: 15, color: '#4A6FA8', lineHeight: 1.7, margin: 0 }}>{p.description}</p>
            </div>

            {/* Features */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {[['✅', 'Calidad garantizada'], ['🚚', 'Envío a todo el Perú'], ['💳', 'Pago seguro'], ['📞', 'Soporte técnico']].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4A6FA8', background: '#f8fafc', padding: '10px 14px', borderRadius: 10 }}>
                  <span>{icon}</span> {text}
                </div>
              ))}
            </div>

            {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>{error}</div>}

            <button onClick={addToCart} disabled={loading || added} className="btn"
              style={{ width: '100%', padding: '16px', background: added ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(59,130,246,0.35)', letterSpacing: '-0.3px' }}>
              {added ? '✓ Agregado al carrito' : loading ? '⏳ Agregando...' : '🛒 Agregar al carrito'}
            </button>

            <button onClick={requestQuote}
              style={{ width: '100%', padding: '14px', background: 'rgba(59,117,192,0.1)', color: '#3B75C0', border: '2px solid #3B75C0', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 10 }}>
              📋 Solicitar cotización personalizada
            </button>
            {added && (
              <a href="/cart" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: '#3B75C0', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                Ver mi carrito →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}