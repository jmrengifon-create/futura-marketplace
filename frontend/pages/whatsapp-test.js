import { useState, useEffect, useRef } from 'react';

const WA_URL = 'http://localhost:3007';

export default function WaTest() {
  const [msg, setMsg]         = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [phone]               = useState('51999000000');
  const chatRef               = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [history]);

  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim() || loading) return;
    const sentMsg = msg.trim();
    setMsg('');
    setLoading(true);

    // Add user message immediately for instant feedback
    setHistory(h => [...h, { direction: 'IN', message: sentMsg, ts: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }]);

    try {
      const r = await fetch(`${WA_URL}/api/whatsapp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: sentMsg }),
      });
      const data = await r.json();
      if (data.messages?.length) {
        // Filter to last 2 hours only to avoid old session clutter
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const recent = data.messages.filter(m => new Date(m.timestamp).getTime() > twoHoursAgo);
        const toShow = recent.length > 0 ? recent : data.messages.slice(-20);
        setHistory(toShow.map(m => ({
          direction: m.direction,
          message: m.message,
          ts: new Date(m.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        })));
        // Force scroll after update
        setTimeout(() => {
          if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }, 100);
      }
    } catch (err) {
      setHistory(h => [...h, { direction: 'OUT', message: '⚠ El servicio WhatsApp no responde. Verifica que el contenedor whatsapp esté levantado.', ts: '' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    setHistory([]);
    // Reset FSM state via a special reset message
    await fetch(`${WA_URL}/api/whatsapp/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).catch(() => {});
  };

  const quickSend = (text) => {
    setMsg(text);
    setTimeout(() => document.getElementById('wa-form').requestSubmit(), 100);
  };

  return (
    <div style={{ fontFamily: 'system-ui', background: '#f0f4f8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Title */}
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D3B87', margin: '0 0 4px' }}>WhatsApp Service — Modo Test</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Simula conversaciones con el asistente de Futura Marketplace</p>
        </div>

        {/* Phone frame */}
        <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb' }}>

          {/* Header */}
          <div style={{ background: '#075e54', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🤖</div>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Futura Marketplace Bot</div>
                <div style={{ color: '#a8d8b5', fontSize: 12 }}>en línea</div>
              </div>
            </div>
            <button onClick={clearChat} title="Nueva conversación"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
              Nueva conv.
            </button>
          </div>

          {/* Chat area */}
          <div ref={chatRef} style={{ background: '#ece5dd', height: 380, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.length === 0 && (
              <div style={{ textAlign: 'center', color: '#8696a0', fontSize: 13, paddingTop: 60 }}>
                Escribe "hola" para comenzar
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.direction === 'IN' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: m.direction === 'IN' ? '#dcf8c6' : 'white',
                  padding: '8px 12px', borderRadius: m.direction === 'IN' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  maxWidth: '78%', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}>
                  {m.message}
                  {m.ts && <div style={{ fontSize: 10, color: '#8696a0', textAlign: 'right', marginTop: 4 }}>{m.ts}</div>}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'white', padding: '10px 16px', borderRadius: '12px 12px 12px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: 18, letterSpacing: 4 }}>···</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form id="wa-form" onSubmit={send} style={{ background: '#f0f0f0', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Escribe un mensaje..."
              autoFocus
              style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: 'none', fontSize: 14, outline: 'none', background: 'white' }}
            />
            <button type="submit" disabled={loading || !msg.trim()}
              style={{ background: loading || !msg.trim() ? '#94a3b8' : '#25d366', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 20, cursor: loading || !msg.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ➤
            </button>
          </form>
        </div>

        {/* Quick buttons */}
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {[['hola', 'Inicio'], ['1', 'Buscar'], ['2', 'Pedidos'], ['3', 'Cotizar'], ['4', 'Soporte'], ['menú', 'Menú']].map(([val, label]) => (
            <button key={val} onClick={() => quickSend(val)}
              style={{ background: 'white', border: '1px solid #e5e7eb', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
              {label} <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>"{val}"</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, background: '#eff6ff', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#3B75C0', textAlign: 'center' }}>
          Modo mock activo — para WhatsApp real configura WA_PHONE_ID y WA_ACCESS_TOKEN en .env
        </div>
      </div>
    </div>
  );
}
