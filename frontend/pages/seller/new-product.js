import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function NewProduct() {
  const router = useRouter();
  const [form, setForm]             = useState({ title: '', description: '', price: '', categoryId: '' });
  const [categories, setCategories] = useState([]);
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  useEffect(() => { apiFetch('/api/categories').then(setCategories).catch(() => {}); }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Debes seleccionar una imagen del producto'); return; }
    setError(''); setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      formData.append('image', file);
      const res = await fetch(`${BASE}/api/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      router.push('/seller/orders');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        input:focus, textarea:focus, select:focus { outline:none; border-color:#3B75C0 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.12) !important; }
        .btn:hover { opacity:0.9; transform:translateY(-1px); }
        .btn { transition: all 0.2s; }
      `}</style>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0D3B87, #0D3B87)', padding: '0 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, gap: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 'auto', height: 32 }}><img src='/logo-hero.png' alt='Futura' style={{ height: 36, objectFit: 'contain' }} /></div>
            
          </a>
          <span style={{ color: '#1A4A8A' }}>›</span>
          <a href="/seller/orders" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>Mi Panel</a>
          <span style={{ color: '#1A4A8A' }}>›</span>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>Nuevo Producto</span>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: '36px auto', padding: '0 20px', animation: 'fadeUp 0.5s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 28, alignItems: 'start' }}>

          {/* Formulario */}
          <div style={{ background: 'white', borderRadius: 24, padding: '36px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0D3B87', marginBottom: 6, letterSpacing: '-0.5px' }}>Publicar producto</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>Completa la información de tu producto</p>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 14 }}>⚠ {error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Título del producto *</label>
                <input required value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ej: Impresora Ecosolvente 1.60m"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', color: '#0D3B87' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio (S/) *</label>
                  <input required type="number" step="0.01" min="0.01" max="99999999" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="15900.00"
                    style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', color: '#0D3B87' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Categoría</label>
                  <select value={form.categoryId} onChange={(e) => setForm(p => ({ ...p, categoryId: e.target.value }))}
                    style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 15, color: '#0D3B87', background: 'white', boxSizing: 'border-box' }}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Descripción</label>
                <textarea rows={4} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe las características y especificaciones técnicas..."
                  style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box', resize: 'vertical', color: '#0D3B87', lineHeight: 1.6 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Imagen del producto *</label>
                <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'border-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3B75C0'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: 'none' }} />
                  {file
                    ? <p style={{ color: '#16a34a', fontWeight: 600, fontSize: 14 }}>✓ {file.name}</p>
                    : <>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Haz clic para seleccionar imagen</p>
                        <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>JPG, PNG, WEBP — máx 5 MB</p>
                      </>
                  }
                </label>
              </div>

              <button type="submit" disabled={loading} className="btn"
                style={{ padding: '15px', background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(59,130,246,0.35)', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? '⏳ Publicando...' : '🚀 Publicar producto'}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👁</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Vista previa</span>
              </div>
              <div style={{ height: 200, background: '#f8fafc', overflow: 'hidden' }}>
                {preview
                  ? <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 48 }}>🖼</span>
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>Imagen del producto</span>
                    </div>
                }
              </div>
              <div style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D3B87', margin: '0 0 6px' }}>{form.title || 'Nombre del producto'}</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>Por ti · {categories.find(c => c.id == form.categoryId)?.name || 'Sin categoría'}</p>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0D3B87' }}>
                  {form.price ? `S/ ${parseFloat(form.price).toLocaleString()}` : 'S/ 0.00'}
                </div>
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14, padding: '16px', marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>💡 Consejos para vender más</p>
              <ul style={{ fontSize: 12, color: '#166534', margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                <li>Usa imágenes de alta resolución</li>
                <li>Incluye especificaciones técnicas</li>
                <li>Precio competitivo y justo</li>
                <li>Descripción clara y completa</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
