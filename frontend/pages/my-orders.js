import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

const STATUS_INFO = {
  CREADA:         { label: 'Creada',          color: '#64748b', icon: '📋' },
  PENDIENTE_PAGO: { label: 'Pago pendiente',  color: '#d97706', icon: '💳' },
  PAGADA:         { label: 'Pagada',          color: '#3B75C0', icon: '✅' },
  EN_PRODUCCION:  { label: 'En producción',   color: '#7c3aed', icon: '⚙️' },
  LISTO:          { label: 'Listo para envío',color: '#0891b2', icon: '📦' },
  ENVIADA:        { label: 'Enviada',         color: '#2563eb', icon: '🚚' },
  ENTREGADA:      { label: 'Entregada',       color: '#16a34a', icon: '✓' },
  CANCELADA:      { label: 'Cancelada',       color: '#dc2626', icon: '✗' },
  REEMBOLSADA:    { label: 'Reembolsada',     color: '#64748b', icon: '↩' },
};

export default function MyOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [review, setReview] = useState({ rating: 5, comment: '', qualityOk: true, onTime: true });
  const [disputing, setDisputing] = useState(null);
  const [dispute, setDispute] = useState({ reason: '' });
  const [confirming, setConfirming] = useState(null);

  const load = () => apiFetch('/api/my-orders').then(setOrders).finally(() => setLoading(false));
  useEffect(() => { const t = localStorage.getItem('token'); if (!t) { router.push('/login'); return; } load(); }, []);

  const confirmDelivery = async (orderId) => {
    setConfirming(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/confirm`, { method: 'POST' });
      load();
    } catch (err) { alert(err.message); }
    finally { setConfirming(null); }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify({ orderId: reviewing.id, ...review }) });
      setReviewing(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const submitDispute = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const fd = new FormData();
    fd.append('orderId', disputing.id);
    fd.append('reason', dispute.reason);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/disputes`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      setDisputing(null);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} textarea:focus,input:focus{outline:none;border-color:#3B75C0!important}`}</style>
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding: '0 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <a href="/" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Catálogo</a>
            <span style={{ color: '#3B75C0' }}>›</span>
            <span style={{ color: 'white', fontWeight: 700 }}>📦 Mis Órdenes</span>
          </div>
          <a href="/my-quotations" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 13 }}>📋 Mis cotizaciones</a>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: '28px auto', padding: '0 20px', animation: 'fadeUp 0.4s ease' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Cargando órdenes...</div>
        ) : orders.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
            <h3 style={{ color: '#0D3B87', fontSize: 20, fontWeight: 700 }}>Sin órdenes aún</h3>
            <a href="/" style={{ background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', color: 'white', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>Ver catálogo</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orders.map((o, i) => {
              const si = STATUS_INFO[o.status] || STATUS_INFO.CREADA;
              return (
                <div key={o.id} style={{ background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,0.07)', animation: `fadeUp 0.4s ease ${i*0.06}s both` }}>
                  <div style={{ height: 4, background: `linear-gradient(90deg,${si.color},${si.color}44)` }}/>
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div>
                        <span style={{ fontWeight: 800, color: '#0D3B87', fontSize: 15 }}>Orden #{o.id}</span>
                        <a href={`/orders/${o.id}`} style={{ fontSize:12, color:'#3B75C0', textDecoration:'none', fontWeight:600, background:'#eff6ff', padding:'4px 10px', borderRadius:20 }}>📍 Ver seguimiento</a>
                        <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 10 }}>{new Date(o.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <span style={{ background: `${si.color}15`, color: si.color, padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${si.color}30` }}>
                        {si.icon} {si.label}
                      </span>
                    </div>

                    {/* Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {o.items?.map((item, j) => (
                        <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: 10 }}>
                          <img src={item.image_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{item.title}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Cant: {item.quantity} · Vendedor: {item.seller_name}</div>
                          </div>
                          <div style={{ fontWeight: 800, color: '#0D3B87' }}>S/ {parseFloat(item.price).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tracking */}
                    {o.tracking_code && (
                      <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#3B75C0', fontWeight: 600 }}>
                        🚚 Código de seguimiento: <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{o.tracking_code}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 900, color: '#0D3B87', fontSize: 18 }}>Total: S/ {parseFloat(o.total).toLocaleString()}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(o.status === 'ENVIADA' || o.status === 'LISTO') && (
                          <button onClick={() => confirmDelivery(o.id)} disabled={confirming === o.id}
                            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: confirming === o.id ? 0.7 : 1 }}>
                            {confirming === o.id ? '⏳...' : '✓ Confirmar recepción'}
                          </button>
                        )}
                        {o.status === 'ENTREGADA' && !o.has_review && (
                          <button onClick={() => setReviewing(o)}
                            style={{ background: '#fef3c7', color: '#ca8a04', border: '1px solid #fcd34d', padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                            ⭐ Calificar
                          </button>
                        )}
                        {['PAGADA','EN_PRODUCCION','LISTO','ENVIADA'].includes(o.status) && (
                          <button onClick={() => setDisputing(o)}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                            ⚠ Reportar problema
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal calificar */}
      {reviewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, maxWidth: 480, width: '100%' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0D3B87', marginBottom: 20 }}>⭐ Calificar pedido #{reviewing.id}</h3>
            <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>Calificación</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setReview(p => ({ ...p, rating: n }))}
                      style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', opacity: review.rating >= n ? 1 : 0.3 }}>⭐</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Comentario</label>
                <textarea rows={3} value={review.comment} onChange={e => setReview(p => ({ ...p, comment: e.target.value }))}
                  placeholder="¿Cómo fue tu experiencia?"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[['qualityOk', '✅ Buena calidad'], ['onTime', '⏱ Entrega a tiempo']].map(([k, label]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={review[k]} onChange={e => setReview(p => ({ ...p, [k]: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#3B75C0' }} />
                    {label}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Enviar calificación</button>
                <button type="button" onClick={() => setReviewing(null)} style={{ padding: '12px 20px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal disputa */}
      {disputing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, maxWidth: 480, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginBottom: 8 }}>⚠ Reportar problema — Orden #{disputing.id}</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Describe el problema. El equipo de Futura revisará y mediará la disputa.</p>
            <form onSubmit={submitDispute} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <textarea required rows={4} value={dispute.reason} onChange={e => setDispute({ reason: e.target.value })}
                placeholder="Describe el problema en detalle..."
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'none' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Abrir disputa</button>
                <button type="button" onClick={() => setDisputing(null)} style={{ padding: '12px 20px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
