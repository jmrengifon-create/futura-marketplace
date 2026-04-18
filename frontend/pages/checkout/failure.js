export default function Failure() {
  return (
    <div style={{ fontFamily:'system-ui', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#fef2f2', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:72 }}>❌</div>
      <h1 style={{ fontSize:28, fontWeight:700, color:'#7f1d1d' }}>Pago rechazado</h1>
      <p style={{ color:'#991b1b', fontSize:16 }}>Hubo un problema al procesar tu pago. Por favor intenta nuevamente.</p>
      <a href="/" style={{ marginTop:8, padding:'12px 28px', background:'#3B75C0', color:'white', borderRadius:10, textDecoration:'none', fontWeight:600 }}>Volver al catálogo</a>
    </div>
  );
}
