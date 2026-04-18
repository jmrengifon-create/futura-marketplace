import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

export default function Home() {
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ]                   = useState('');
  const [minPrice, setMinPrice]     = useState('');
  const [maxPrice, setMaxPrice]     = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [cartCount, setCartCount]     = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const limit = 20;

  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  const name = typeof window !== 'undefined' ? localStorage.getItem('name') : null;

  useEffect(() => {
    apiFetch('/api/categories').then(setCategories).catch(() => {});
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      apiFetch('/api/cart').then((items) => setCartCount(items.length)).catch(() => {});
      apiFetch('/api/notifications').then((d) => setUnreadCount(d.unread || 0)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ q, page });
    if (minPrice)   params.set('minPrice', minPrice);
    if (maxPrice)   params.set('maxPrice', maxPrice);
    if (categoryId) params.set('categoryId', categoryId);
    apiFetch(`/api/products?${params}`)
      .then((data) => { setProducts(data.products); setTotal(data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q, minPrice, maxPrice, categoryId, page]);

  const totalPages = Math.ceil(total / limit);

  const categoryIcons = {
    'Impresoras Ecosolvente': '🖨️',
    'Impresoras UV': '☀️',
    'Plotters de Corte': '✂️',
    'Impresoras DTF': '🖨️',
    'Sublimación': '🎨',
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .card:hover { transform: translateY(-6px) !important; box-shadow: 0 20px 48px rgba(0,0,0,0.13) !important; }
        .card-img { transition: transform 0.4s ease; }
        .card:hover .card-img { transform: scale(1.06) !important; }
        .cat-btn { transition: all 0.2s; }
        .cat-btn:hover { background: rgba(59,130,246,0.15) !important; color: #A8CAEA !important; }
        .cat-btn.active { background: rgba(59,130,246,0.25) !important; color: #A8CAEA !important; border-color: #3B75C0 !important; }
        .filter-input:focus { outline:none; border-color:#3B75C0 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.12) !important; }
        .nav-a:hover { color:white !important; }
        .nav-a { transition: color 0.2s; }
        .btn-cart:hover { opacity:0.85; transform:scale(1.03); }
        .btn-cart { transition: all 0.2s; }
        .search-input::placeholder { color: #4A6FA8; }
      `}</style>

      {/* ═══ TOPBAR ═══ */}
      <header style={{ background: 'linear-gradient(135deg, #0D3B87 0%, #0D3B87 100%)', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 24px rgba(0,0,0,0.4)' }}>
        {/* Top row */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 68, gap: 24 }}>
          {/* Logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px', lineHeight: 1 }}>FUTURA</div>
              <div style={{ color: '#3B75C0', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Marketplace</div>
            </div>
          </a>

          {/* Search bar */}
          <div style={{ flex: 1, maxWidth: 640, position: 'relative' }}>
            <div style={{ display: 'flex', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
              <input className="search-input"
                placeholder="¿Qué estás buscando?"
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                style={{ flex: 1, padding: '12px 18px', border: 'none', fontSize: 15, color: '#0D3B87', outline: 'none', background: 'transparent' }} />
              <button style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', border: 'none', padding: '0 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'white', fontSize: 18 }}>🔍</span>
              </button>
            </div>
          </div>

          {/* Nav actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginLeft: 'auto', flexShrink: 0 }}>
            {name ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Hola</div>
                  <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{name.split(' ')[0]}</div>
                </div>
                {role === 'COMPRADOR' && (
                  <>
                    <a href="/notifications" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 22 }}>🔔</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>Avisos</span>
                      {unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -8, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{unreadCount}</span>}
                    </a>
                    <a href="/cart" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 22 }}>🛒</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>Carrito</span>
                      {cartCount > 0 && <span style={{ position: 'absolute', top: -4, right: -8, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{cartCount}</span>}
                    </a>
                  </>
                )}
                <a href="/my-orders" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 22 }}>📦</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Mis Pedidos</span>
                </a>
                <a href="/my-quotations" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 22 }}>📋</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Cotizaciones</span>
                </a>
                <a href="/profile" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 22 }}>👤</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Perfil</span>
                </a>
                {role === 'VENDEDOR' && <a href="/seller/dashboard" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>📊 Dashboard</a>}
                {role === 'VENDEDOR' && <a href="/seller/orders" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>📦 Mi Panel</a>}
                {role === 'ADMIN'    && <a href="/admin/commissions" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>⚙ Admin</a>}
                <button onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                  style={{ background: 'transparent', border: '1px solid #1A4A8A', color: '#64748b', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Salir</button>
              </>
            ) : (
              <>
                <a href="/login" className="nav-a" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 22 }}>👤</span>
                  <span style={{ fontSize: 10 }}>Ingresar</span>
                </a>
                <a href="/register" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>
                  Registrarse
                </a>
              </>
            )}
          </div>
        </div>

        {/* Category nav bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto' }}>
            <button onClick={() => { setCategoryId(''); setPage(1); }}
              className={`cat-btn ${categoryId === '' ? 'active' : ''}`}
              style={{ padding: '10px 18px', border: '1px solid transparent', borderRadius: 0, background: 'transparent', color: categoryId === '' ? '#A8CAEA' : '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: categoryId === '' ? '2px solid #3B75C0' : '2px solid transparent' }}>
              🏠 Todos
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => { setCategoryId(String(c.id)); setPage(1); }}
                className={`cat-btn ${categoryId === String(c.id) ? 'active' : ''}`}
                style={{ padding: '10px 18px', border: '1px solid transparent', borderRadius: 0, background: 'transparent', color: categoryId === String(c.id) ? '#A8CAEA' : '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: categoryId === String(c.id) ? '2px solid #3B75C0' : '2px solid transparent' }}>
                {categoryIcons[c.name] || '📦'} {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ═══ HERO BANNER ═══ */}
      <div style={{ background: 'linear-gradient(135deg, #0D3B87 0%, #0A2E6E 60%, #0D3B87 100%)', padding: '40px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.2) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, rgba(6,182,212,0.15) 0%, transparent 55%)' }}/>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, position: 'relative' }}>
          {/* Banner principal */}
          <div style={{ gridColumn: '1 / 3', background: 'linear-gradient(135deg, #1A4A8A, #0A2E6E)', borderRadius: 20, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(59,130,246,0.2)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', right: -20, top: -20, width: 200, height: 200, background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent)', borderRadius: '50%' }}/>
            <div>
              <div style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 20, padding: '4px 14px', fontSize: 11, color: '#A8CAEA', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'inline-block', marginBottom: 14 }}>
                ✦ Tecnología de impresión profesional
              </div>
              <h1 style={{ color: 'white', fontSize: 36, fontWeight: 900, margin: '0 0 12px', letterSpacing: '-1px', lineHeight: 1.15 }}>
                Equipa tu negocio con<br/>
                <span style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>maquinaria de punta</span>
              </h1>
              <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 24px' }}>
                {total > 0 ? `${total} productos disponibles` : '...'} · Vendedores verificados
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <a href="/register" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '11px 24px', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                  Comenzar gratis →
                </a>
              </div>
            </div>
            <img src='/logo-hero.png' alt='Futura' style={{ maxWidth: 420, height: 260, flexShrink: 0, objectFit: 'contain', objectPosition: 'center', mixBlendMode: 'normal' }} />
          </div>

          {/* Banners secundarios */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div onClick={() => { setCategoryId(''); setQ('ecosolvente'); setPage(1); }}
              style={{ background: 'linear-gradient(135deg, #1A4A8A, #0A2E6E)', borderRadius: 16, padding: '20px 24px', border: '1px solid rgba(6,182,212,0.2)', cursor: 'pointer', flex: 1 }}>
              <img src='/logo-hero.png' alt='Futura' style={{ height: 32, objectFit: 'contain', marginBottom: 8 }} />
              <div style={{ color: '#6FA8D4', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Ecosolvente</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Gran formato · Alta resolución</div>
            </div>
            <div onClick={() => { setCategoryId(''); setQ('dtf'); setPage(1); }}
              style={{ background: 'linear-gradient(135deg, #1A3A7A, #0D2E7A)', borderRadius: 16, padding: '20px 24px', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', flex: 1 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🖨️</div>
              <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Impresoras DTF</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Transfer en telas · Alta calidad</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENIDO PRINCIPAL ═══ */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'grid', gridTemplateColumns: sidebarOpen ? '260px 1fr' : '0px 1fr', gap: sidebarOpen ? 24 : 0, transition: 'grid-template-columns 0.3s ease' }}>

        {/* SIDEBAR FILTROS */}
        {sidebarOpen && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ background: 'white', borderRadius: 18, padding: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', position: 'sticky', top: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0D3B87', margin: 0 }}>🎯 Filtrar</h3>
                <button onClick={() => { setCategoryId(''); setMinPrice(''); setMaxPrice(''); setQ(''); setPage(1); }}
                  style={{ fontSize: 11, color: '#3B75C0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpiar</button>
              </div>

              {/* Categorías */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Categoría</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: categoryId === '' ? '#EBF4FF' : 'transparent', transition: 'background 0.2s' }}>
                    <input type="radio" name="cat" checked={categoryId === ''} onChange={() => { setCategoryId(''); setPage(1); }} style={{ accentColor: '#3B75C0' }} />
                    <span style={{ fontSize: 13, color: categoryId === '' ? '#3B75C0' : '#374151', fontWeight: categoryId === '' ? 700 : 400 }}>🏠 Todas las categorías</span>
                  </label>
                  {categories.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: categoryId === String(c.id) ? '#EBF4FF' : 'transparent', transition: 'background 0.2s' }}>
                      <input type="radio" name="cat" checked={categoryId === String(c.id)} onChange={() => { setCategoryId(String(c.id)); setPage(1); }} style={{ accentColor: '#3B75C0' }} />
                      <span style={{ fontSize: 13, color: categoryId === String(c.id) ? '#3B75C0' : '#374151', fontWeight: categoryId === String(c.id) ? 700 : 400 }}>
                        {categoryIcons[c.name] || '📦'} {c.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Precio */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Rango de precio (S/)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="filter-input" type="number" placeholder="Precio mínimo" value={minPrice}
                    onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#0D3B87', width: '100%', boxSizing: 'border-box' }} />
                  <input className="filter-input" type="number" placeholder="Precio máximo" value={maxPrice}
                    onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#0D3B87', width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Info */}
              <div style={{ marginTop: 24, background: '#EBF4FF', borderRadius: 12, padding: '14px', border: '1px solid #A8CAEA' }}>
                <p style={{ fontSize: 12, color: '#2A5CA8', fontWeight: 700, margin: '0 0 6px' }}>🔒 Compra segura</p>
                <p style={{ fontSize: 11, color: '#2A5CA8', margin: 0, lineHeight: 1.6 }}>Pago procesado por Mercado Pago. Tus datos siempre protegidos.</p>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        <div>
          {/* Barra de resultados */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                {sidebarOpen ? '◀ Ocultar filtros' : '▶ Mostrar filtros'}
              </button>
              <span style={{ fontSize: 14, color: '#64748b' }}>
                {loading ? '⏳ Buscando...' : <><strong style={{ color: '#0D3B87' }}>{total}</strong> resultados</>}
              </span>
            </div>
            {categoryId && (
              <span style={{ background: '#EBF4FF', border: '1px solid #C5DCF0', color: '#3B75C0', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                {categories.find(c => String(c.id) === categoryId)?.name}
                <button onClick={() => setCategoryId('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B75C0', fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            )}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: sidebarOpen ? 'repeat(auto-fill, minmax(240px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {products.map((p, i) => (
              <div key={p.id} className="card" style={{ background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', animation: `fadeUp 0.4s ease ${Math.min(i, 8) * 0.05}s both` }}>
                <div style={{ height: 200, overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
                  <img src={p.image_url} alt={p.title} className="card-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 50%)' }}/>
                  {p.category_name && (
                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', color: '#A8CAEA', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase', border: '1px solid rgba(59,130,246,0.3)' }}>
                      {categoryIcons[p.category_name] || '📦'} {p.category_name}
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0D3B87', margin: '0 0 5px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 18, height: 18, background: '#D0E8F5', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>👤</span>
                    {p.seller_name}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>Precio</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0D3B87', letterSpacing: '-0.5px' }}>S/ {parseFloat(p.price).toLocaleString()}</div>
                    </div>
                    <Link href={`/product/${p.id}`} style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', textDecoration: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, boxShadow: '0 3px 10px rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Ver →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {products.length === 0 && !loading && (
            <div style={{ background: 'white', borderRadius: 20, padding: '64px 40px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>🔍</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0D3B87', marginBottom: 8 }}>No se encontraron productos</h3>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>Intenta con otros filtros o términos de búsqueda</p>
              <button onClick={() => { setCategoryId(''); setMinPrice(''); setMaxPrice(''); setQ(''); setPage(1); }}
                style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Ver todos los productos
              </button>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 40 }}>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#374151', fontSize: 16, opacity: page === 1 ? 0.4 : 1 }}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: n === page ? 'linear-gradient(135deg, #3B75C0, #6FA8D4)' : 'white', color: n === page ? 'white' : '#374151', cursor: 'pointer', fontWeight: 800, fontSize: 14, boxShadow: n === page ? '0 4px 12px rgba(59,130,246,0.3)' : '0 2px 8px rgba(0,0,0,0.06)' }}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#374151', fontSize: 16, opacity: page === totalPages ? 0.4 : 1 }}>›</button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#0D3B87', color: '#1A4A8A', marginTop: 60 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 'auto', height: 32 }}><img src='/logo-hero.png' alt='Futura' style={{ height: 36, objectFit: 'contain' }} /></div>
              
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: '#4A6FA8' }}>La plataforma líder en maquinaria gráfica para profesionales del Perú.</p>
          </div>
          {[
            ['Compradores', ['Cómo comprar', 'Métodos de pago', 'Seguimiento de pedidos']],
            ['Vendedores', ['Cómo vender', 'Comisiones', 'Panel de vendedor']],
            ['Soporte', ['Centro de ayuda', 'Contacto', 'Términos y condiciones']],
          ].map(([title, links]) => (
            <div key={title}>
              <h4 style={{ color: 'white', fontSize: 13, fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h4>
              {links.map((l) => <div key={l} style={{ fontSize: 13, color: '#4A6FA8', marginBottom: 8, cursor: 'pointer' }}>{l}</div>)}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #0D3B87', padding: '16px 24px', textAlign: 'center', fontSize: 12, color: '#1A4A8A' }}>
          © 2026 Futura Marketplace · Todos los derechos reservados · Hecho en Perú 🇵🇪
        </div>
      </footer>
    </div>
  );
}