export default function Success() {
  return (
    <div style={{ fontFamily:'system-ui', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0fdf4', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:72 }}>✅</div>
      <h1 style={{ fontSize:28, fontWeight:700, color:'#14532d' }}>¡Pago exitoso!</h1>
      <p style={{ color:'#166534', fontSize:16 }}>Tu orden fue procesada correctamente. El vendedor te contactará pronto.</p>
      <a href="/" style={{ marginTop:8, padding:'12px 28px', background:'#3B75C0', color:'white', borderRadius:10, textDecoration:'none', fontWeight:600 }}>Volver al catálogo</a>
    </div>
  );
}
