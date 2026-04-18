export default function Pending() {
  return (
    <div style={{ fontFamily:'system-ui', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#fffbeb', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:72 }}>⏳</div>
      <h1 style={{ fontSize:28, fontWeight:700, color:'#78350f' }}>Pago pendiente</h1>
      <p style={{ color:'#92400e', fontSize:16 }}>Tu pago está siendo procesado. Te notificaremos cuando se confirme.</p>
      <a href="/" style={{ marginTop:8, padding:'12px 28px', background:'#3B75C0', color:'white', borderRadius:10, textDecoration:'none', fontWeight:600 }}>Volver al catálogo</a>
    </div>
  );
}
