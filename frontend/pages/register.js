import { useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

export default function Register() {
  const router = useRouter();
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'COMPRADOR' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await apiFetch('/api/register', { method: 'POST', body: JSON.stringify(form) });
      router.push('/login');
    } catch (err) { setError(err.message || 'Error al crear cuenta'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: '100vh', background: '#0D3B87', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        input:focus { outline:none; border-color:#3B75C0 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.15) !important; }
        .role-card { transition: all 0.2s; cursor: pointer; }
        .role-card:hover { border-color: #3B75C0 !important; }
        .btn:hover { opacity:0.9; transform:translateY(-1px); }
        .btn { transition: all 0.2s; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 480, animation: 'fadeUp 0.6s ease' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ width: 'auto', height: 40 }}><img src='/logo-hero.png' alt='Futura' style={{ height: 44, objectFit: 'contain' }} /></div>
          <div>

          </div>
        </div>

        <div style={{ background: '#0D3B87', borderRadius: 24, padding: '40px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <h2 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>Crear cuenta gratis</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Únete a la comunidad de Futura Marketplace</p>

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 14 }}>⚠ {error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[['Nombre completo', 'name', 'text', 'Carlos Ramírez'], ['Correo electrónico', 'email', 'email', 'tu@email.com'], ['Contraseña (mín. 8 caracteres)', 'password', 'password', '••••••••']].map(([label, key, type, ph]) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
                <input type={type} required minLength={key === 'password' ? 8 : undefined} placeholder={ph}
                  value={form[key]} onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #1A4A8A', background: '#0D3B87', color: 'white', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            ))}

            {/* Role selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo de cuenta</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['COMPRADOR', '🛒', 'Comprador', 'Quiero comprar maquinaria'],
                  ['VENDEDOR',  '🏪', 'Vendedor',  'Quiero vender productos']
                ].map(([r, icon, label, desc]) => (
                  <div key={r} className="role-card" onClick={() => setForm(p => ({ ...p, role: r }))}
                    style={{ border: `2px solid ${form.role === r ? '#3B75C0' : '#1A4A8A'}`, borderRadius: 14, padding: '16px', background: form.role === r ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                    <div style={{ color: form.role === r ? '#A8CAEA' : 'white', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: '#4A6FA8', fontSize: 12 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn"
              style={{ padding: '14px', background: 'linear-gradient(135deg, #3B75C0, #6FA8D4)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: '0 4px 20px rgba(59,130,246,0.35)', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Creando cuenta...' : 'Crear cuenta gratis →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#4A6FA8', marginTop: 24 }}>
            ¿Ya tienes cuenta? <a href="/login" style={{ color: '#3B75C0', textDecoration: 'none', fontWeight: 600 }}>Inicia sesión</a>
          </p>
          <p style={{ textAlign: 'center', fontSize: 13, marginTop: 8 }}>
            <a href="/" style={{ color: '#4A6FA8', textDecoration: 'none' }}>← Volver al catálogo</a>
          </p>
        </div>
      </div>
    </div>
  );
}
