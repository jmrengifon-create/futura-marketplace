import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

export default function SellerPortfolio() {
  const { id } = useRouter().query;
  const [data, setData] = useState(null);

  useEffect(() => {
    if (id) apiFetch(`/api/sellers/${id}`).then(setData).catch(() => {});
  }, [id]);

  if (!data) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b' }}>⏳ Cargando perfil...</p>
    </div>
  );

  const { seller, products, reviews } = data;
  const stars = Math.round(parseFloat(seller.rating_avg || 0));

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .card:hover{transform:translateY(-4px)!important;box-shadow:0 16px 40px rgba(0,0,0,0.12)!important} .card{transition:all 0.25s}`}</style>
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding: '0 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 14 }}>
          <a href="/" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Catálogo</a>
          <span style={{ color: '#3B75C0' }}>›</span>
          <span style={{ color: 'white', fontWeight: 700 }}>🏪 {seller.business_name || seller.name}</span>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        {/* Header del vendedor */}
        <div style={{ background: 'white', borderRadius: 20, padding: '32px', marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'fadeUp 0.4s ease' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'white', fontWeight: 900, flexShrink: 0 }}>
              {(seller.business_name || seller.name)?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0D3B87' }}>{seller.business_name || seller.name}</h1>
                {seller.verified && <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>✓ Verificado Futura</span>}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                {seller.location_city && <span style={{ fontSize: 13, color: '#64748b' }}>📍 {seller.location_city}</span>}
                {seller.machine_type && <span style={{ fontSize: 13, color: '#64748b' }}>🖨 {seller.machine_type}</span>}
                {seller.production_capacity > 0 && <span style={{ fontSize: 13, color: '#64748b' }}>⚡ {seller.production_capacity} unid/semana</span>}
                {seller.futura_client_since && <span style={{ fontSize: 13, color: '#64748b' }}>📅 Cliente Futura desde {new Date(seller.futura_client_since).getFullYear()}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 18, opacity: n <= stars ? 1 : 0.25 }}>⭐</span>)}
                  <span style={{ fontSize: 14, color: '#374151', fontWeight: 700, marginLeft: 4 }}>{parseFloat(seller.rating_avg || 0).toFixed(1)}</span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>({reviews.length} reseñas)</span>
                </div>
                <span style={{ fontSize: 14, color: '#374151' }}>🛒 {seller.total_sales} ventas</span>
              </div>
            </div>
          </div>
          {seller.portfolio_desc && (
            <div style={{ marginTop: 20, padding: '16px', background: '#f8fafc', borderRadius: 12, fontSize: 14, color: '#475569', lineHeight: 1.7, borderLeft: '4px solid #3B75C0' }}>
              {seller.portfolio_desc}
            </div>
          )}
        </div>

        {/* Productos */}
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0D3B87', marginBottom: 16 }}>📦 Productos y servicios ({products.length})</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20, marginBottom: 32 }}>
          {products.map((p, i) => (
            <div key={p.id} className="card" style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', animation: `fadeUp 0.4s ease ${i*0.05}s both` }}>
              <div style={{ height: 180, overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
                <img src={p.image_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.production_time_days && (
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(15,23,42,0.85)', color: '#93c5fd', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                    ⏱ {p.production_time_days}d
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 16px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0D3B87', margin: '0 0 6px' }}>{p.title}</h3>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>S/ {parseFloat(p.price).toLocaleString()}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/product/${p.id}`} style={{ flex: 1, background: '#eff6ff', color: '#3B75C0', textDecoration: 'none', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                    Ver detalles
                  </Link>
                  <Link href={`/quote/${p.id}`} style={{ flex: 1, background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', color: 'white', textDecoration: 'none', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                    Cotizar
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reseñas */}
        {reviews.length > 0 && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0D3B87', marginBottom: 16 }}>⭐ Reseñas de clientes ({reviews.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {reviews.map((r, i) => (
                <div key={r.id} style={{ background: 'white', borderRadius: 14, padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', animation: `fadeUp 0.4s ease ${i*0.06}s both` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0D3B87' }}>{r.buyer_name}</div>
                    <div>{[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 14, opacity: n <= r.rating ? 1 : 0.2 }}>⭐</span>)}</div>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px', lineHeight: 1.6 }}>{r.comment}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {r.quality_ok && <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✓ Buena calidad</span>}
                    {r.on_time && <span style={{ background: '#eff6ff', color: '#3B75C0', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✓ A tiempo</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{new Date(r.created_at).toLocaleDateString('es-PE')}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
