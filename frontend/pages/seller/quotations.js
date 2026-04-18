import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SellerQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState({ quotedPrice: '', productionDays: '', notes: '', status: 'ENVIADA', rejectedReason: '' });
  const [saving, setSaving] = useState(false);

  const load = () => apiFetch('/api/seller/quotations').then(setQuotations).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const respond = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/seller/quotations/${selected.id}`, { method: 'PUT', body: JSON.stringify(reply) });
      setSelected(null);
      load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const URGENCY_COLOR = { NORMAL: '#3B75C0', URGENTE: '#d97706', EXPRESS: '#dc2626' };

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} input:focus,textarea:focus{outline:none;border-color:#3B75C0!important}`}</style>
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding: '0 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/seller/orders" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Mi Panel</a>
            <span style={{ color: '#3B75C0' }}>›</span>
            <span style={{ color: 'white', fontWeight: 700 }}>📋 Cotizaciones recibidas</span>
          </div>
          <span style={{ background: 'rgba(59,117,192,0.3)', color: '#A8CAEA', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            {quotations.filter(q => q.status === 'PENDIENTE').length} pendientes
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '28px auto', padding: '0 20px', animation: 'fadeUp 0.4s ease' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Cargando...</div>
        ) : quotations.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>📋</div>
            <h3 style={{ color: '#0D3B87' }}>Sin solicitudes aún</h3>
            <p style={{ color: '#94a3b8' }}>Las solicitudes de cotización de tus clientes aparecerán aquí</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {quotations.map((q, i) => (
              <div key={q.id} style={{ background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', animation: `fadeUp 0.4s ease ${i*0.05}s both`, border: q.status === 'PENDIENTE' ? '2px solid #fcd34d' : '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0D3B87' }}>
                      {q.product_title || 'Producto personalizado'} — {q.quantity} unid.
                    </h3>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, display: 'flex', gap: 16 }}>
                      <span>👤 {q.buyer_name}</span>
                      {q.buyer_phone && <span>📱 {q.buyer_phone}</span>}
                      <span>📅 {new Date(q.created_at).toLocaleDateString('es-PE')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ background: `${URGENCY_COLOR[q.urgency]}15`, color: URGENCY_COLOR[q.urgency], padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${URGENCY_COLOR[q.urgency]}30` }}>
                      {q.urgency}
                    </span>
                    <span style={{ background: q.status === 'PENDIENTE' ? '#fefce8' : q.status === 'ENVIADA' ? '#eff6ff' : '#f0fdf4', color: q.status === 'PENDIENTE' ? '#ca8a04' : q.status === 'ENVIADA' ? '#3B75C0' : '#15803d', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {q.status}
                    </span>
                  </div>
                </div>

                {q.specifications && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#475569', marginBottom: 10 }}>
                    <strong>Especificaciones:</strong> {q.specifications}
                    {q.material && <span> · Material: <strong>{q.material}</strong></span>}
                    {q.size && <span> · Tamaño: <strong>{q.size}</strong></span>}
                  </div>
                )}

                {q.design_files?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {q.design_files.map((f, fi) => (
                      <a key={fi} href={f.file_url} target="_blank" rel="noreferrer"
                        style={{ background: '#eff6ff', color: '#3B75C0', padding: '4px 12px', borderRadius: 20, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                        📎 {f.file_name?.substring(0, 24)}
                      </a>
                    ))}
                  </div>
                )}

                {q.status === 'PENDIENTE' && (
                  <button onClick={() => { setSelected(q); setReply({ quotedPrice: '', productionDays: '', notes: '', status: 'ENVIADA', rejectedReason: '' }); }}
                    style={{ background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    💬 Responder cotización
                  </button>
                )}
                {q.status === 'ENVIADA' && q.quoted_price && (
                  <div style={{ fontSize: 13, color: '#3B75C0', fontWeight: 600 }}>
                    Cotización enviada: S/ {parseFloat(q.quoted_price).toLocaleString()} · {q.production_days} días
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal responder */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '32px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0D3B87', marginBottom: 4 }}>Responder cotización</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{selected.buyer_name} · {selected.product_title} · {selected.quantity} unid.</p>

            <form onSubmit={respond} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio cotizado (S/) *</label>
                  <input type="number" step="0.01" required value={reply.quotedPrice} onChange={e => setReply(p => ({ ...p, quotedPrice: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Días de producción *</label>
                  <input type="number" min="1" required value={reply.productionDays} onChange={e => setReply(p => ({ ...p, productionDays: e.target.value }))}
                    placeholder="3"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notas para el cliente</label>
                <textarea rows={3} value={reply.notes} onChange={e => setReply(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Detalles adicionales, condiciones, etc..."
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳ Enviando...' : '✓ Enviar cotización'}
                </button>
                <button type="button" onClick={() => { setReply(p => ({ ...p, status: 'RECHAZADA' })); }} style={{ flex: 1, padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  ✗ Rechazar
                </button>
                <button type="button" onClick={() => setSelected(null)} style={{ padding: '12px 18px', background: '#f8fafc', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
