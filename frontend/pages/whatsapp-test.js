// frontend/pages/whatsapp-test.js — v4.1 conectado al panel admin
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';

const QUICK = ['hola', '1', '2', '3', '4', 'menú'];

export default function WaTest() {
  const [phone, setPhone]     = useState('51999000000');
  const [name, setName]       = useState('Cliente Test');
  const [msg, setMsg]         = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline]   = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);

  const scrollBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadHistory = async () => {
    try {
      const data = await apiFetch(`/api/wa/inbox/thread?phone=${phone}`);
      setHistory(data.messages || []);
      setOnline(true);
    } catch { setOnline(false); }
  };

  useEffect(() => {
    loadHistory();
    pollRef.current = setInterval(loadHistory, 3000);
    return () => clearInterval(pollRef.current);
  }, [phone]);

  useEffect(() => { scrollBottom(); }, [history]);

  const send = async (e, quickMsg) => {
    e?.preventDefault();
    const text = quickMsg || msg;
    if (!text.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      await apiFetch('/api/wa/inbox/send', {
        method: 'POST',
        body: JSON.stringify({ phone, name, message: text, direction: 'IN' })
      });
      await loadHistory();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f0f4f8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes typing { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        input:focus { outline: none; }
        .bubble { animation: fadeIn 0.2s ease; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Título */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{ color: '#0D3B87', fontSize: 20, fontWeight: 800, margin: 0 }}>💬 WhatsApp Service — Modo Test</h2>
          <p style={{ color: '#64748b', fontSize: 13, margin: '6px 0 0' }}>Simula conversaciones con el asistente de Futura Marketplace</p>
        </div>

        {/* Config del simulador */}
        <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Tu teléfono (simulado)</div>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Tu nombre</div>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: online ? '#25d366' : '#ef4444', boxShadow: online ? '0 0 6px #25d366' : 'none' }} title={online ? 'Conectado' : 'Sin conexión'} />
          </div>
        </div>

        {/* Chat window */}
        <div style={{ borderRadius: '16px 16px 0 0', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
          {/* Header */}
          <div style={{ background: '#075e54', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Futura Marketplace Bot</div>
              <div style={{ color: '#a8d8b5', fontSize: 12 }}>en línea · El admin puede responder desde /admin/whatsapp</div>
            </div>
            <button onClick={() => { setHistory([]); apiFetch('/api/wa/inbox/clear', { method: 'POST', body: JSON.stringify({ phone }) }).catch(()=>{}); }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11 }}>Nueva conv.</button>
          </div>

          {/* Messages */}
          <div style={{ background: '#ece5dd', minHeight: 360, maxHeight: 420, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>

            {history.length === 0 && (
              <div style={{ textAlign: 'center', color: '#8696a0', fontSize: 13, paddingTop: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
                Escribe "hola" para comenzar la conversación
              </div>
            )}

            {history.map((m, i) => {
              const isUser = m.direction === 'IN';
              const isAdmin = m.direction === 'ADMIN';
              const isBot   = m.direction === 'OUT';
              return (
                <div key={i} className="bubble" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                  {(isBot || isAdmin) && (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isAdmin ? '#3B75C0' : '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 6, flexShrink: 0, alignSelf: 'flex-end' }}>
                      {isAdmin ? '👤' : '🤖'}
                    </div>
                  )}
                  <div style={{ background: isUser ? '#dcf8c6' : 'white', padding: '8px 12px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px', maxWidth: '75%', fontSize: 13, whiteSpace: 'pre-wrap', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                    {isAdmin && <div style={{ fontSize: 10, color: '#3B75C0', fontWeight: 700, marginBottom: 4 }}>Admin Futura</div>}
                    {m.message}
                    <div style={{ fontSize: 10, color: '#8696a0', textAlign: 'right', marginTop: 4 }}>{fmt(m.timestamp)}</div>
                  </div>
                </div>
              );
            })}

            {adminTyping && (
              <div className="bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3B75C0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                <div style={{ background: 'white', padding: '10px 14px', borderRadius: '12px 12px 12px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,0.2,0.4].map((d,i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', animation: `typing 1s ${d}s infinite` }} />)}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Quick replies */}
          <div style={{ background: '#f0f0f0', padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #e5e7eb' }}>
            {QUICK.map(q => (
              <button key={q} onClick={() => send(null, q)}
                style={{ background: 'white', border: '1px solid #e5e7eb', padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: '#475569' }}>
                {q === 'hola' ? 'Inicio "hola"' : q === 'menú' ? 'Menú "menú"' : `${['','Buscar','Pedidos','Cotizar','Soporte'][+q] || q} "${q}"`}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={send} style={{ background: '#f0f0f0', borderRadius: '0 0 16px 16px', padding: '8px 12px', display: 'flex', gap: 8 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Escribe un mensaje..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: 'none', fontSize: 14, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />
            <button type="submit" disabled={loading || !msg.trim()}
              style={{ background: loading ? '#94a3b8' : '#25d366', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>➤</button>
          </form>
        </div>

        <div style={{ marginTop: 12, background: '#fffbeb', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', border: '1px solid #fde68a' }}>
          <strong>Modo mock activo</strong> — para WhatsApp real configura WA_PHONE_ID y WA_ACCESS_TOKEN en .env
        </div>
      </div>
    </div>
  );
}
