import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

const STATUS_INFO = {
  PENDIENTE:  { label: 'Esperando respuesta', color: '#d97706', bg: '#fefce8' },
  ENVIADA:    { label: 'Cotización recibida', color: '#3B75C0', bg: '#eff6ff' },
  ACEPTADA:   { label: 'Aceptada',            color: '#16a34a', bg: '#f0fdf4' },
  RECHAZADA:  { label: 'Rechazada',           color: '#dc2626', bg: '#fef2f2' },
  EXPIRADA:   { label: 'Expirada',            color: '#64748b', bg: '#f8fafc' },
};

export default function MyQuotations() {
  const router = useRouter();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    apiFetch('/api/my-quotations').then(setQuotations).finally(() => setLoading(false));
  }, []);

  const accept = async (id) => {
    setAccepting(id);
    try {
      await apiFetch(`/api/quotations/${id}/accept`, { method: 'POST' });
      router.push('/my-orders');
    } catch (err) { alert(err.message); setAccepting(null); }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding: '0 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Catálogo</a>
            <span style={{ color: '#3B75C0' }}>›</span>
            <span style={{ color: 'white', fontWeight: 700 }}>📋 Mis Cotizaciones</span>
          </div>
          <a href="/cart" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 13 }}>🛒 Mi Carrito</a>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 20px', animation: 'fadeUp 0.5s ease' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Cargando cotizaciones...</div>
        ) : quotations.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: '64px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📋</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0D3B87', marginBottom: 8 }}>Sin cotizaciones aún</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>Visita el catálogo y solicita una cotización personalizada</p>
            <a href="/" style={{ background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', color: 'white', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>Ver catálogo</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {quotations.map((q, i) => {
              const si = STATUS_INFO[q.status] || STATUS_INFO.PENDIENTE;
              return (
                <div key={q.id} style={{ background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', animation: `fadeUp 0.4s ease ${i * 0.06}s both` }}>
                  <div style={{ height: 4, background: `linear-gradient(90deg, ${si.color}, ${si.color}44)` }}/>
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        {q.image_url && <img src={q.image_url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />}
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0D3B87' }}>{q.product_title || 'Producto personalizado'}</h3>
                          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Vendedor: {q.seller_name} · Cantidad: {q.quantity}</p>
                          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 12 }}>Solicitado: {new Date(q.created_at).toLocaleDateString('es-PE')}</p>
                        </div>
                      </div>
                      <span style={{ background: si.bg, color: si.color, padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${si.color}30`, whiteSpace: 'nowrap' }}>
                        {si.label}
                      </span>
                    </div>

                    {q.specifications && (
                      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#475569' }}>
                        <strong>Especificaciones:</strong> {q.specifications}
                        {q.material && <span> · Material: {q.material}</span>}
                        {q.size && <span> · Tamaño: {q.size}</span>}
                      </div>
                    )}

                    {q.design_files?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                        {q.design_files.map((f, fi) => (
                          <a key={fi} href={f.file_url} target="_blank" rel="noreferrer"
                            style={{ background: '#eff6ff', color: '#3B75C0', padding: '4px 12px', borderRadius: 20, fontSize: 12, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            📎 {f.file_name?.substring(0, 20)}
                          </a>
                        ))}
                      </div>
                    )}

                    {q.status === 'ENVIADA' && q.quoted_price && (
                      <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #86efac', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600, marginBottom: 4 }}>💰 Propuesta del vendedor</div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: '#166534' }}>S/ {parseFloat(q.quoted_price).toLocaleString()}</div>
                          {q.production_days && <div style={{ fontSize: 12, color: '#16a34a' }}>⏱ Entrega en {q.production_days} días</div>}
                          {q.notes && <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>📝 {q.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => accept(q.id)} disabled={accepting === q.id}
                            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', border: 'none', padding: '11px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: accepting === q.id ? 0.7 : 1 }}>
                            {accepting === q.id ? '⏳ Aceptando...' : '✓ Aceptar y pagar'}
                          </button>
                        </div>
                      </div>
                    )}

                    {q.status === 'RECHAZADA' && q.rejected_reason && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#dc2626' }}>
                        ❌ Motivo del rechazo: {q.rejected_reason}
                      </div>
                    )}

                    {q.status === 'ACEPTADA' && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                        ✅ Cotización aceptada · Orden creada correctamente
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
