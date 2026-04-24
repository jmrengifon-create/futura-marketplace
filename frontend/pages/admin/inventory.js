// frontend/pages/admin/inventory.js — Inventario Multi-Local en Tiempo Real
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmtMoney = n => `S/ ${parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2})}`;
const fmt = d => d ? new Date(d).toLocaleDateString('es-PE') : '—';

export default function AdminInventory() {
  const [tab, setTab]           = useState('summary');
  const [summary, setSummary]   = useState({ locations:[], lowStock:[], todayMovements:[] });
  const [items, setItems]       = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [msg, setMsg]           = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [showMove, setShowMove] = useState(null);
  const [addForm, setAddForm]   = useState({ location_id:'', item_name:'', item_type:'PRODUCT', quantity:0, min_quantity:1, unit_cost:0, unit_price:0 });
  const [moveForm, setMoveForm] = useState({ movement_type:'ENTRADA', quantity:1, unit_price:0, notes:'' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role') !== 'ADMIN') { window.location.href='/login'; return; }
    loadAll();
    const interval = setInterval(loadSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if(tab==='items') loadItems(); }, [tab, selectedLoc]);

  const loadAll = async () => {
    try {
      const [s, l, r] = await Promise.all([
        apiFetch('/api/admin/inventory/summary').catch(()=>({ locations:[], lowStock:[], todayMovements:[] })),
        apiFetch('/api/locations').catch(()=>[]),
        apiFetch('/api/admin/receipts').catch(()=>[]),
      ]);
      setSummary(s); setLocations(Array.isArray(l)?l:[]); setReceipts(Array.isArray(r)?r:[]);
    } catch {}
  };

  const loadSummary = async () => {
    try { const s = await apiFetch('/api/admin/inventory/summary'); setSummary(s); } catch {}
  };

  const loadItems = async () => {
    try {
      const url = `/api/admin/inventory${selectedLoc?`?location_id=${selectedLoc}`:''}`;
      const r = await apiFetch(url);
      setItems(Array.isArray(r)?r:[]);
    } catch {}
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/inventory', { method:'POST', body:JSON.stringify(addForm) });
      setMsg('✅ Item agregado al inventario con QR generado automáticamente');
      setShowAdd(false);
      setAddForm({ location_id:'', item_name:'', item_type:'PRODUCT', quantity:0, min_quantity:1, unit_cost:0, unit_price:0 });
      loadAll(); loadItems();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const registerMovement = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/inventory/${showMove.id}/movement`, { method:'POST', body:JSON.stringify(moveForm) });
      setMsg(`✅ Movimiento registrado: ${moveForm.movement_type} de ${moveForm.quantity} unidades`);
      setShowMove(null);
      loadItems(); loadSummary();
    } catch(err) { setMsg('❌ '+err.message); }
  };

  const STATUS_C = { DISPONIBLE:{bg:'#f0fdf4',c:'#15803d'}, AGOTADO:{bg:'#fef2f2',c:'#dc2626'}, RESERVADO:{bg:'#fefce8',c:'#ca8a04'}, DANADO:{bg:'#fff7ed',c:'#ea580c'} };

  const TABS = [['summary','📊 Resumen'],['items','📦 Inventario'],['receipts',`🧾 Boletas (${receipts.length})`]];

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn-sm{padding:5px 10px;font-size:12px;border-radius:8px}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:white;border-radius:16px;padding:28px;width:480px;max-width:95vw}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#3B75C0!important}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      <header style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', height:52, justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
              <span style={{ color:'#3B75C0' }}>›</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>📦 Inventario Multi-Local</span>
            </div>
            <div style={{ display:'flex', gap:8, fontSize:12, color:'#A8CAEA', alignItems:'center' }}>
              {summary.lowStock?.length > 0 && <span style={{ background:'#dc2626', color:'white', padding:'2px 10px', borderRadius:20, fontWeight:700, animation:'pulse 2s infinite' }}>⚠️ {summary.lowStock.length} stock bajo</span>}
              <span>🏪 {locations.length} locales activos</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400, color:tab===key?'white':'#64748b', borderBottom:tab===key?'3px solid #3B75C0':'3px solid transparent' }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:'20px auto', padding:'0 24px' }}>
        {msg && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}><span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button></div>}

        {/* RESUMEN POR LOCAL */}
        {tab === 'summary' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {summary.locations?.map(l=>(
                <div key={l.location_id} className="card" style={{ borderTop:'4px solid #3B75C0' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#0D3B87', marginBottom:10 }}>🏪 {l.location_name}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {[['📦','Items',l.total_items,'#eff6ff','#3B75C0'],['✅','Disponible',l.available_items,'#f0fdf4','#15803d'],['⚠️','Stock bajo',l.low_stock,'#fefce8','#ca8a04'],['❌','Agotado',l.out_of_stock,'#fef2f2','#dc2626']].map(([ic,lb,v,bg,c])=>(
                      <div key={lb} style={{ background:bg, borderRadius:8, padding:'8px', textAlign:'center' }}>
                        <div style={{ fontSize:14 }}>{ic}</div>
                        <div style={{ fontSize:18, fontWeight:900, color:c }}>{v||0}</div>
                        <div style={{ fontSize:9, color:c, textTransform:'uppercase', fontWeight:700 }}>{lb}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #f1f5f9' }}>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>Valor inventario</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#0D3B87' }}>{fmtMoney(l.inventory_value)}</div>
                  </div>
                </div>
              ))}
              {summary.locations?.length === 0 && [1,2,3,4].map(i=>(
                <div key={i} className="card" style={{ borderTop:'4px solid #e5e7eb', opacity:0.6 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#94a3b8', marginBottom:10 }}>🏪 Local {i}</div>
                  <p style={{ fontSize:12, color:'#94a3b8', margin:0 }}>Sin items registrados</p>
                </div>
              ))}
            </div>

            {summary.lowStock?.length > 0 && (
              <div className="card" style={{ background:'#fff7ed', border:'1px solid #fed7aa' }}>
                <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:800, color:'#ea580c' }}>⚠️ Stock Bajo — Requiere Reposición</h3>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'rgba(234,88,12,0.1)' }}>
                    {['Producto','Local','Stock Actual','Mínimo','Acción'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, color:'#ea580c', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {summary.lowStock.map(i=>(
                      <tr key={i.id} style={{ borderBottom:'1px solid rgba(234,88,12,0.1)' }}>
                        <td style={{ padding:'8px 10px', fontWeight:600 }}>{i.item_name}</td>
                        <td style={{ padding:'8px 10px' }}>{i.location_name}</td>
                        <td style={{ padding:'8px 10px' }}><span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{i.quantity}</span></td>
                        <td style={{ padding:'8px 10px', color:'#94a3b8' }}>{i.min_quantity}</td>
                        <td style={{ padding:'8px 10px' }}><button onClick={()=>{setShowMove(i);setMoveForm({movement_type:'ENTRADA',quantity:i.min_quantity*2,unit_price:i.unit_price,notes:'Reposición urgente'});}} className="btn btn-sm btn-green">+ Reponer</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary.todayMovements?.length > 0 && (
              <div className="card">
                <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:800, color:'#0D3B87' }}>📊 Movimientos de Hoy</h3>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f8fafc' }}>
                    {['Local','Tipo','Operaciones','Valor Total'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {summary.todayMovements.map((m,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f8fafc' }}>
                        <td style={{ padding:'8px 10px', fontWeight:600 }}>{m.location_name}</td>
                        <td style={{ padding:'8px 10px' }}><span style={{ background:m.movement_type==='VENTA'?'#f0fdf4':m.movement_type==='ENTRADA'?'#eff6ff':'#f8fafc', color:m.movement_type==='VENTA'?'#15803d':m.movement_type==='ENTRADA'?'#3B75C0':'#64748b', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{m.movement_type}</span></td>
                        <td style={{ padding:'8px 10px', textAlign:'center' }}>{m.ops}</td>
                        <td style={{ padding:'8px 10px', fontWeight:600, color:'#15803d' }}>{fmtMoney(m.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ITEMS */}
        {tab === 'items' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0D3B87' }}>📦 Items en Inventario</h3>
                <select value={selectedLoc} onChange={e=>{setSelectedLoc(e.target.value);}} style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13 }}>
                  <option value="">Todos los locales</option>
                  {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <button onClick={()=>setShowAdd(true)} className="btn btn-sm btn-green">+ Agregar Item</button>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                  {['QR','Item','Local','Tipo','Stock','Mín','Estado','Costo','Precio','Acción'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {items.map(i=>(
                    <tr key={i.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'#94a3b8' }}>{i.qr_code?.substring(0,12)}...</td>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{i.item_name}</td>
                      <td style={{ padding:'10px 12px', fontSize:12 }}>{i.location_name}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:'#eff6ff', color:'#3B75C0', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{i.item_type}</span></td>
                      <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:700, color:i.quantity<=i.min_quantity?'#dc2626':'#0D3B87' }}>{i.quantity}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center', color:'#94a3b8' }}>{i.min_quantity}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:STATUS_C[i.status]?.bg||'#f8fafc', color:STATUS_C[i.status]?.c||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{i.status}</span></td>
                      <td style={{ padding:'10px 12px', fontSize:12 }}>{fmtMoney(i.unit_cost)}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, fontWeight:600 }}>{fmtMoney(i.unit_price)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <button onClick={()=>{setShowMove(i);setMoveForm({movement_type:'ENTRADA',quantity:1,unit_price:i.unit_price,notes:''}); }} className="btn btn-sm">± Movimiento</button>
                      </td>
                    </tr>
                  ))}
                  {items.length===0 && <tr><td colSpan={10} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin items. Haz clic en "+ Agregar Item" para comenzar.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOLETAS */}
        {tab === 'receipts' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0D3B87' }}>🧾 Boletas Electrónicas</h3>
              <p style={{ margin:'4px 0 0', fontSize:12, color:'#64748b' }}>Generadas automáticamente al confirmar pagos. Para SUNAT real configura NUBEFACT_TOKEN en Railway.</p>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                {['N° Boleta','Comprador','Subtotal','IGV','Total','Estado','Emitida'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {receipts.map(r=>(
                  <tr key={r.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:'#3B75C0' }}>{r.receipt_number}</td>
                    <td style={{ padding:'10px 12px' }}><div style={{ fontWeight:600 }}>{r.buyer_name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{r.email}</div></td>
                    <td style={{ padding:'10px 12px' }}>{fmtMoney(r.subtotal)}</td>
                    <td style={{ padding:'10px 12px' }}>{fmtMoney(r.igv)}</td>
                    <td style={{ padding:'10px 12px', fontWeight:700 }}>{fmtMoney(r.total)}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:r.status==='EMITIDA'?'#f0fdf4':'#fef2f2', color:r.status==='EMITIDA'?'#15803d':'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{r.status}</span></td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:'#94a3b8' }}>{fmt(r.issued_at)}</td>
                  </tr>
                ))}
                {receipts.length===0 && <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Sin boletas. Se generan automáticamente al completar pagos.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal agregar item */}
      {showAdd && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 18px', fontSize:16, fontWeight:800, color:'#0D3B87' }}>📦 Agregar Item al Inventario</h3>
            <form onSubmit={addItem} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <select required value={addForm.location_id} onChange={e=>setAddForm(p=>({...p,location_id:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="">Seleccionar local *</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input required value={addForm.item_name} onChange={e=>setAddForm(p=>({...p,item_name:e.target.value}))} placeholder="Nombre del item *" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              <select value={addForm.item_type} onChange={e=>setAddForm(p=>({...p,item_type:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                <option value="PRODUCT">Producto</option>
                <option value="MACHINE">Máquina</option>
                <option value="SUPPLY">Insumo</option>
              </select>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['Cantidad inicial','quantity','number','0'],['Stock mínimo','min_quantity','number','1'],['Costo unitario (S/)','unit_cost','number','0'],['Precio venta (S/)','unit_price','number','0']].map(([label,key,type,ph])=>(
                  <div key={key}><label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>{label}</label><input type={type} placeholder={ph} value={addForm[key]} onChange={e=>setAddForm(p=>({...p,[key]:e.target.value}))} style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, boxSizing:'border-box' }} /></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn btn-green" style={{ flex:1, padding:12 }}>✅ Agregar + Generar QR</button>
                <button type="button" onClick={()=>setShowAdd(false)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal movimiento */}
      {showMove && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowMove(null)}>
          <div className="modal">
            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>± Registrar Movimiento: {showMove.item_name}</h3>
            <form onSubmit={registerMovement} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <select value={moveForm.movement_type} onChange={e=>setMoveForm(p=>({...p,movement_type:e.target.value}))} style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                {['ENTRADA','SALIDA','VENTA','TRANSFERENCIA','AJUSTE','DEVOLUCION'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" required min="1" value={moveForm.quantity} onChange={e=>setMoveForm(p=>({...p,quantity:e.target.value}))} placeholder="Cantidad" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }} />
              <textarea rows={2} value={moveForm.notes} onChange={e=>setMoveForm(p=>({...p,notes:e.target.value}))} placeholder="Notas (opcional)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }} />
              <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#475569' }}>
                Stock actual: <strong>{showMove.quantity}</strong> → Después: <strong style={{ color:['SALIDA','VENTA'].includes(moveForm.movement_type)?showMove.quantity-parseInt(moveForm.quantity||0)<0?'#dc2626':'#0D3B87':'#15803d' }}>{['ENTRADA','DEVOLUCION'].includes(moveForm.movement_type)?showMove.quantity+parseInt(moveForm.quantity||0):['AJUSTE'].includes(moveForm.movement_type)?parseInt(moveForm.quantity||0):showMove.quantity-parseInt(moveForm.quantity||0)}</strong>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn" style={{ flex:1, padding:12 }}>✅ Registrar</button>
                <button type="button" onClick={()=>setShowMove(null)} style={{ flex:1, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
