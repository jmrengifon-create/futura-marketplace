import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function AdminReport() {
  const [data, setData]         = useState({ items: [], totals: {} });
  const [sellers, setSellers]   = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/commissions'),
      apiFetch('/api/admin/stats/sellers'),
      apiFetch('/api/admin/stats/products'),
      apiFetch('/api/admin/users'),
    ]).then(([d, s, p, u]) => {
      setData(d); setSellers(s); setProducts(p); setUsers(u);
    }).finally(() => setLoading(false));
  }, []);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 200);
  };

  const today = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  const totalComision = parseFloat(data.totals?.total_commission || 0);
  const totalNeto     = parseFloat(data.totals?.total_net || 0);
  const totalRevenue  = totalComision + totalNeto;

  if (loading) return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b' }}>⏳ Generando informe...</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f8fafc', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Toolbar - no imprime */}
      <div className="no-print" style={{ background: 'linear-gradient(135deg, #0D3B87, #1A4A8A)', padding: '0 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/admin/commissions" style={{ color: '#A8CAEA', textDecoration: 'none', fontSize: 14 }}>← Panel Admin</a>
            <span style={{ color: '#3B75C0' }}>›</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>📄 Informe Detallado</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handlePrint} disabled={printing}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              🖨️ {printing ? 'Imprimiendo...' : 'Imprimir / PDF'}
            </button>
            <a href="/admin/stats" style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              📊 Estadísticas
            </a>
          </div>
        </div>
      </div>

      {/* INFORME */}
      <div className="page" style={{ maxWidth: 900, margin: '32px auto', background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden', animation: 'fadeUp 0.5s ease' }}>

        {/* Encabezado del informe */}
        <div style={{ background: 'linear-gradient(135deg, #0D3B87, #1A4A8A)', padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img src="/logo-hero.png" alt="Futura" style={{ height: 44, objectFit: 'contain' }} />
            </div>
            <h1 style={{ color: 'white', fontSize: 24, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Informe de Gestión</h1>
            <p style={{ color: '#A8CAEA', fontSize: 14, margin: 0 }}>Reporte ejecutivo · Futura Marketplace</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#A8CAEA', fontSize: 12, marginBottom: 4 }}>Fecha de emisión</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{today}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Confidencial · Uso interno</div>
          </div>
        </div>

        <div style={{ padding: '36px 48px' }}>

          {/* Resumen ejecutivo */}
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', margin: '0 0 16px', paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>1. RESUMEN EJECUTIVO</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              ['Revenue Total', fmt(totalRevenue), '#f0fdf4', '#166534'],
              ['Comisión Futura Digital (10%)', fmt(totalComision), '#eff6ff', '#0D3B87'],
              ['Total Neto Vendedores', fmt(totalNeto), '#faf5ff', '#5b21b6'],
            ].map(([label, val, bg, color]) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: '18px 20px', border: `1px solid ${color}20` }}>
                <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Usuarios registrados */}
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', margin: '0 0 16px', paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>2. USUARIOS REGISTRADOS</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
            {['ADMIN', 'VENDEDOR', 'COMPRADOR'].map((rol) => {
              const count = users.filter(u => u.role === rol).length;
              const colors = { ADMIN: '#ef4444', VENDEDOR: '#3B75C0', COMPRADOR: '#10b981' };
              return (
                <div key={rol} style={{ border: `1px solid ${colors[rol]}30`, borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{rol}</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: colors[rol] }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Ranking vendedores */}
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', margin: '0 0 16px', paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>3. RENDIMIENTO DE VENDEDORES</h2>
          {sellers.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: 32 }}>Sin datos de ventas registradas.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 32 }}>
              <thead>
                <tr style={{ background: '#0D3B87' }}>
                  {['Pos.', 'Vendedor', 'N° Ventas', 'Total Vendido', 'Comisión Futura', 'Neto Recibido'].map((h) => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellers.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0D3B87' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>{s.vendedor}</td>
                    <td style={{ padding: '12px 14px', color: '#475569', textAlign: 'center' }}>{s.num_ventas}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0D3B87' }}>{fmt(s.total_vendido)}</td>
                    <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 700 }}>{fmt(s.total_comision)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#374151' }}>{fmt(s.total_neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Productos más vendidos */}
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', margin: '0 0 16px', paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>4. PRODUCTOS MÁS VENDIDOS</h2>
          {products.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: 32 }}>Sin datos de productos vendidos.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 32 }}>
              <thead>
                <tr style={{ background: '#0D3B87' }}>
                  {['#', 'Producto', 'Vendedor', 'Categoría', 'Vendido', 'Revenue', 'Neto'].map((h) => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '12px 14px', color: '#94a3b8', fontWeight: 600 }}>#{i+1}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>{p.producto}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{p.vendedor}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: '#eff6ff', color: '#3B75C0', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.categoria || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{p.veces_vendido}x</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0D3B87' }}>{fmt(p.total_generado)}</td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{fmt(p.neto_vendedor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan={5} style={{ padding: '12px 14px', fontWeight: 800, color: '#374151' }}>TOTALES</td>
                  <td style={{ padding: '12px 14px', fontWeight: 900, color: '#0D3B87' }}>{fmt(products.reduce((a, p) => a + parseFloat(p.total_generado || 0), 0))}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 900, color: '#374151' }}>{fmt(products.reduce((a, p) => a + parseFloat(p.neto_vendedor || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Detalle de transacciones */}
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0D3B87', margin: '0 0 16px', paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>5. DETALLE DE TRANSACCIONES</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 32 }}>
            <thead>
              <tr style={{ background: '#0D3B87' }}>
                {['Orden', 'Producto', 'Vendedor', 'Estado', 'Precio', 'Comisión', 'Neto'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((c, i) => (
                <tr key={`${c.id}-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                  <td style={{ padding: '10px 12px', color: '#3B75C0', fontWeight: 700 }}>#{c.order_id}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{c.product_title}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{c.seller_name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: c.order_status === 'PAGADA' ? '#f0fdf4' : '#f8fafc', color: c.order_status === 'PAGADA' ? '#15803d' : '#64748b', fontWeight: 700 }}>
                      {c.order_status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0D3B87' }}>S/ {parseFloat(c.price).toFixed(2)}</td>
                  <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>S/ {parseFloat(c.commission).toFixed(2)}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>S/ {parseFloat(c.net).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pie del informe */}
          <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Generado automáticamente por Futura Marketplace v2.0</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>© 2026 Futura Digital · Todos los derechos reservados</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Fecha: {today}</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>Documento confidencial</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
