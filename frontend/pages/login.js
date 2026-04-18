import { useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.id || '');
      localStorage.setItem('role', data.role || '');
      localStorage.setItem('role',  data.role);
      localStorage.setItem('name',  data.name);
      if (data.role === 'VENDEDOR') router.push('/seller/orders');
      else if (data.role === 'ADMIN') router.push('/admin/commissions');
      else router.push('/');
    } catch { setError('Credenciales incorrectas. Verifica tu email y contraseña.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: '100vh', display: 'flex', background: '#0D3B87' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        input:focus { outline: none; border-color: #3B75C0 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important; }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn { transition: all 0.2s; }
        .link:hover { color: #A8CAEA !important; }
      `}</style>

      {/* Panel izquierdo decorativo */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #1A4A8A 0%, #0D3B87 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(6,182,212,0.15) 0%, transparent 60%)' }}/>
        <div style={{ position: 'relative', textAlign: 'center', animation: 'fadeUp 0.8s ease' }}>
          <img src="/logo-hero.png" alt="Futura" style={{ height: 90, objectFit: "contain", marginBottom: 24 }} />
          <h1 style={{ color: 'white', fontSize: 36, fontWeight: 900, letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.2 }}>
            La plataforma de<br/>
            <span style={{ background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>maquinaria gráfica</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.6, maxWidth: 340 }}>
            Conectamos a vendedores de tecnología de impresión con compradores que buscan calidad.
          </p>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: 48 }}>
            {[['🏪', 'Vendedores', 'Verificados'], ['💳', 'Pagos', 'Seguros'], ['📦', 'Envíos', 'Rastreables']].map(([icon, t, s]) => (
              <div key={t} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{t}</div>
                <div style={{ color: '#4A6FA8', fontSize: 11 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{ width: 480, background: '#0D3B87', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 48px', animation: 'fadeUp 0.6s ease' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <div style={{ width: 'auto', height: 36 }}><img src='/logo-hero.png' alt='Futura' style={{ height: 40, objectFit: 'contain' }} /></div>
            <div>

            </div>
          </div>

          <h2 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>Bienvenido de vuelta</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32 }}>Ingresa a tu cuenta para continuar</p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 14 }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="tu@email.com"
                style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid #1A4A8A', background: '#0D3B87', color: 'white', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contraseña</label>
              <input type="password" required value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid #1A4A8A', background: '#0D3B87', color: 'white', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} className="btn"
              style={{ padding: '14px', background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 6, boxShadow: '0 4px 20px rgba(59,130,246,0.35)', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Ingresando...' : 'Ingresar →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#4A6FA8', marginTop: 24 }}>
            ¿No tienes cuenta? <a href="/register" className="link" style={{ color: '#3B75C0', textDecoration: 'none', fontWeight: 600 }}>Regístrate gratis</a>
          </p>
          <a href="/" className="link" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: '#4A6FA8', marginTop: 12, textDecoration: 'none' }}>← Volver al catálogo</a>

          <div style={{ marginTop: 32, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#3B75C0', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Credenciales de prueba</p>
            {[['Admin', 'admin@futura.com'], ['Vendedor', 'vendedor@futura.com'], ['Comprador', 'comprador@futura.com']].map(([r, e]) => (
              <div key={r} style={{ fontSize: 12, color: '#64748b', marginBottom: 3 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>{r}:</span> {e} / <span style={{ color: '#A8CAEA' }}>password</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
