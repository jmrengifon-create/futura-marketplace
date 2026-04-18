import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RequestQuote() {
  const router = useRouter();
  const { productId, sellerId } = router.query;
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ quantity: 1, specifications: '', material: '', size: '', urgency: 'NORMAL' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (productId) apiFetch(`/api/products/${productId}`).then(setProduct).catch(() => {});
  }, [productId]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (productId) fd.append('productId', productId);
      if (sellerId)  fd.append('sellerId', sellerId);
      else if (product) fd.append('sellerId', product.seller_id);
      files.forEach(f => fd.append('designFiles', f));
      const r = await fetch(`${BASE}/api/quotations`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      router.push('/my-quotations');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`input:focus,textarea:focus,select:focus{outline:none;border-color:#3B75C0!important;box-shadow:0 0 0 3px rgba(59,117,192,0.12)!important}`}</style>
      <header style={{ background: 'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding: '0 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 14 }}>
          <a href="/" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Catálogo</a>
          <span style={{ color: '#3B75C0' }}>›</span>
          <span style={{ color: 'white', fontWeight: 700 }}>📋 Solicitar Cotización</span>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: '32px auto', padding: '0 20px' }}>
        {product && (
          <div style={{ background: 'white', borderRadius: 16, padding: '20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <img src={product.image_url} alt={product.title} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10 }} />
            <div>
              <h3 style={{ margin: 0, color: '#0D3B87', fontSize: 16, fontWeight: 700 }}>{product.title}</h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Vendedor: {product.seller_name} · Desde S/ {parseFloat(product.price).toLocaleString()}</p>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 20, padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0D3B87', marginBottom: 6 }}>Solicitud de cotización</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Completa los detalles de tu pedido y el vendedor te responderá en menos de 4 horas</p>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, marginBottom: 20 }}>⚠ {error}</div>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cantidad *</label>
                <input type="number" min="1" required value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', color: '#0f172a' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Material</label>
                <input value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))}
                  placeholder="Ej: Lona, Vinil, Tela..."
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', color: '#0f172a' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tamaño</label>
                <input value={form.size} onChange={e => setForm(p => ({ ...p, size: e.target.value }))}
                  placeholder="Ej: 60x90cm, A3..."
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', color: '#0f172a' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Especificaciones técnicas *</label>
              <textarea required rows={4} value={form.specifications} onChange={e => setForm(p => ({ ...p, specifications: e.target.value }))}
                placeholder="Describe detalladamente tu pedido: colores, acabados, uso final, fecha límite de entrega..."
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', resize: 'vertical', color: '#0f172a', lineHeight: 1.6 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Urgencia</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[['NORMAL', '📅 Normal (3-5 días)', '#eff6ff', '#3B75C0'], ['URGENTE', '⚡ Urgente (24-48h)', '#fefce8', '#ca8a04'], ['EXPRESS', '🚀 Express (mismo día)', '#fef2f2', '#dc2626']].map(([val, label, bg, color]) => (
                  <label key={val} style={{ flex: 1, cursor: 'pointer' }}>
                    <input type="radio" name="urgency" value={val} checked={form.urgency === val} onChange={() => setForm(p => ({ ...p, urgency: val }))} style={{ display: 'none' }} />
                    <div style={{ background: form.urgency === val ? bg : 'white', border: `2px solid ${form.urgency === val ? color : '#e5e7eb'}`, borderRadius: 10, padding: '10px 14px', textAlign: 'center', fontSize: 13, fontWeight: form.urgency === val ? 700 : 400, color: form.urgency === val ? color : '#374151' }}>
                      {label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Archivos de diseño (AI, PDF, PSD, PNG)</label>
              <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3B75C0'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <input type="file" multiple accept=".ai,.pdf,.psd,.png,.jpg,.jpeg,.webp" onChange={e => setFiles(Array.from(e.target.files))} style={{ display: 'none' }} />
                {files.length > 0
                  ? <p style={{ color: '#16a34a', fontWeight: 600, margin: 0 }}>✓ {files.length} archivo(s): {files.map(f => f.name).join(', ')}</p>
                  : <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                      <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Arrastra o haz clic para subir tus archivos de diseño</p>
                      <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>Máximo 5 archivos · Formatos: AI, PDF, PSD, PNG, JPG</p>
                    </>
                }
              </label>
            </div>

            <button type="submit" disabled={loading}
              style={{ padding: '14px', background: 'linear-gradient(135deg,#3B75C0,#6FA8D4)', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,117,192,0.3)', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Enviando...' : '📋 Enviar solicitud de cotización'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
