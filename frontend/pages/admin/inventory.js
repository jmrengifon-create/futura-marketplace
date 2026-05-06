import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const fmt = (v) => `S/ ${parseFloat(v||0).toFixed(2)}`;
const fmtN = (v) => parseInt(v||0).toLocaleString('es-PE');

const SEDE_COLORS = {
  'Lampa':     { color:'#2563eb', bg:'#eff6ff', icon:'🏭' },
  'Boulevard': { color:'#7c3aed', bg:'#f5f3ff', icon:'🏢' },
  'Lurín':     { color:'#15803d', bg:'#f0fdf4', icon:'🏗️' },
  'Pachitea':  { color:'#dc2626', bg:'#fef2f2', icon:'🏬' },
};

const STATUS_COLOR = {
  CRITICO: { color:'#dc2626', bg:'#fef2f2', label:'🔴 Crítico' },
  BAJO:    { color:'#ea580c', bg:'#fff7ed', label:'🟠 Bajo' },
  NORMAL:  { color:'#ca8a04', bg:'#fefce8', label:'🟡 Normal' },
  BUENO:   { color:'#15803d', bg:'#f0fdf4', label:'🟢 Bueno' },
};

export default function AdminInventory() {
  const [tab,          setTab]          = useState('resumen');
  const [sedes,        setSedes]        = useState([]);
  const [items,        setItems]        = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [predictions,  setPredictions]  = useState([]);
  const [cashFlow,     setCashFlow]     = useState({ transactions:[], summary:[] });
  const [reports,      setReports]      = useState([]);
  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState('');
  const [sending,      setSending]      = useState(false);
  const [filterLoc,    setFilterLoc]    = useState('');
  const [showAddItem,  setShowAddItem]  = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [movingItem,   setMovingItem]   = useState(null);

  const [itemForm, setItemForm] = useState({
    location_id:'', item_name:'', item_type:'PRODUCTO',
    quantity:0, min_quantity:1, unit_cost:0, unit_price:0
  });
  const [cashForm, setCashForm] = useState({
    location_id:'', type:'INGRESO', category:'VENTA', amount:'', description:''
  });
  const [movForm, setMovForm] = useState({
    movement_type:'SALIDA', quantity:1, notes:''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('role')!=='ADMIN') { window.location.href='/login'; return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, i, a, p, cf, r, l] = await Promise.all([
        apiFetch('/api/admin/inventory/sede-summary'),
        apiFetch('/api/admin/inventory'),
        apiFetch('/api/admin/inventory/alerts'),
        apiFetch('/api/admin/inventory/predictions'),
        apiFetch('/api/admin/inventory/cash-flow'),
        apiFetch('/api/admin/inventory/reports'),
        apiFetch('/api/locations'),
      ]);
      setSedes(s); setItems(i); setAlerts(a);
      setPredictions(p); setCashFlow(cf); setReports(r); setLocations(l);
    } catch(e) { setMsg('❌ '+e.message); }
    setLoading(false);
  };

  const addItem = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch('/api/admin/inventory', { method:'POST', body:JSON.stringify(itemForm) });
      setMsg('✅ Item agregado correctamente');
      setShowAddItem(false);
      setItemForm({ location_id:'', item_name:'', item_type:'PRODUCTO', quantity:0, min_quantity:1, unit_cost:0, unit_price:0 });
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const addCashFlow = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch('/api/admin/inventory/cash-flow', { method:'POST', body:JSON.stringify(cashForm) });
      setMsg('✅ Movimiento registrado');
      setShowCashForm(false);
      setCashForm({ location_id:'', type:'INGRESO', category:'VENTA', amount:'', description:'' });
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const registerMovement = async (itemId) => {
    setSending(true);
    try {
      await apiFetch(`/api/admin/inventory/${itemId}/movement`, { method:'POST', body:JSON.stringify(movForm) });
      const item = items.find(i=>i.id===itemId);
      const after = movForm.movement_type==='ENTRADA'
        ? parseInt(item.quantity)+parseInt(movForm.quantity)
        : parseInt(item.quantity)-parseInt(movForm.quantity);
      setMsg(`✅ Movimiento registrado. Stock actual: ${after}`);
      setMovingItem(null);
      setMovForm({ movement_type:'SALIDA', quantity:1, notes:'' });
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const resolveAlert = async (id) => {
    try {
      await apiFetch(`/api/admin/inventory/alerts/${id}/resolve`, { method:'PUT' });
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
  };

  const generateReport = async () => {
    setSending(true);
    try {
      const r = await apiFetch('/api/admin/inventory/generate-report', { method:'POST' });
      setMsg(`✅ ${r.message}`);
      loadAll();
    } catch(e) { setMsg('❌ '+e.message); }
    setSending(false);
  };

  const filteredItems = filterLoc ? items.filter(i=>String(i.location_id)===String(filterLoc)) : items;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0f4f8' }}>
      <div style={{ fontSize:14, color:'#64748b' }}>Cargando inventario...</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh' }}>
      <style>{`
        .btn{background:linear-gradient(135deg,#3B75C0,#6FA8D4);color:white;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
        .btn:hover{opacity:0.9} .btn:disabled{opacity:0.6;cursor:not-allowed}
        .btn-green{background:linear-gradient(135deg,#15803d,#22c55e)}
        .btn-red{background:linear-gradient(135deg,#dc2626,#ef4444)}
        .btn-amber{background:linear-gradient(135deg,#d97706,#f59e0b)}
        .card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
        .row:hover{background:#f8fafc}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#3B75C0!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', padding:'0 24px', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:52 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/admin/panel" style={{ color:'#A8CAEA', textDecoration:'none', fontSize:13 }}>← Panel Admin</a>
            <span style={{ color:'#3B75C0' }}>›</span>
            <span style={{ color:'white', fontWeight:700 }}>📦 Inventario Multi-Sede</span>
            {alerts.length>0 && <span style={{ background:'#dc2626', color:'white', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>⚠️ {alerts.length} alertas</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={generateReport} className="btn btn-amber" disabled={sending} style={{ fontSize:12 }}>
              📊 Generar Reporte
            </button>
            <button onClick={()=>setShowAddItem(true)} className="btn btn-green" style={{ fontSize:12 }}>
              + Agregar Item
            </button>
            <button onClick={()=>setShowCashForm(true)} className="btn" style={{ fontSize:12 }}>
              💰 Flujo de Caja
            </button>
          </div>
        </div>
        <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', gap:2 }}>
          {[['resumen','🏭 Resumen'],['inventario','📦 Inventario'],['flujo','💰 Flujo de Caja'],['alertas',`⚠️ Alertas${alerts.length>0?` (${alerts.length})`:''}` ],['prediccion','🔮 Predicción'],['reportes','📊 Reportes']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:tab===k?700:400, color:tab===k?'white':'#64748b', borderBottom:tab===k?'3px solid #3B75C0':'3px solid transparent' }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1400, margin:'20px auto', padding:'0 24px', animation:'fadeUp 0.3s ease' }}>

        {msg && (
          <div style={{ padding:'12px 16px', borderRadius:10, marginBottom:16, fontWeight:600, background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2', color:msg.startsWith('✅')?'#15803d':'#dc2626', display:'flex', justifyContent:'space-between' }}>
            <span>{msg}</span><button onClick={()=>setMsg('')} style={{ background:'none',border:'none',cursor:'pointer' }}>×</button>
          </div>
        )}

        {/* Modal agregar item */}
        {showAddItem && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div className="card" style={{ width:500, maxHeight:'90vh', overflowY:'auto' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>+ Agregar Item al Inventario</h3>
              <form onSubmit={addItem} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <select required value={itemForm.location_id} onChange={e=>setItemForm(p=>({...p,location_id:e.target.value}))}
                  style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="">Selecciona la sede</option>
                  {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <input required value={itemForm.item_name} onChange={e=>setItemForm(p=>({...p,item_name:e.target.value}))}
                  placeholder="Nombre del item" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}/>
                <select value={itemForm.item_type} onChange={e=>setItemForm(p=>({...p,item_type:e.target.value}))}
                  style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="PRODUCTO">Producto</option>
                  <option value="SUPPLY">Insumo</option>
                  <option value="MACHINE">Máquina</option>
                  <option value="REPUESTO">Repuesto</option>
                </select>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:'#64748b', fontWeight:700 }}>Stock inicial</label>
                    <input type="number" value={itemForm.quantity} onChange={e=>setItemForm(p=>({...p,quantity:e.target.value}))}
                      style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'#64748b', fontWeight:700 }}>Stock mínimo</label>
                    <input type="number" value={itemForm.min_quantity} onChange={e=>setItemForm(p=>({...p,min_quantity:e.target.value}))}
                      style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'#64748b', fontWeight:700 }}>Costo unitario</label>
                    <input type="number" value={itemForm.unit_cost} onChange={e=>setItemForm(p=>({...p,unit_cost:e.target.value}))}
                      style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'#64748b', fontWeight:700 }}>Precio de venta</label>
                    <input type="number" value={itemForm.unit_price} onChange={e=>setItemForm(p=>({...p,unit_price:e.target.value}))}
                      style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button type="submit" className="btn btn-green" disabled={sending} style={{ flex:1, padding:12 }}>
                    {sending?'Guardando...':'✅ Guardar Item'}
                  </button>
                  <button type="button" onClick={()=>setShowAddItem(false)}
                    style={{ padding:'12px 20px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'white', cursor:'pointer', fontWeight:600 }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal flujo de caja */}
        {showCashForm && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div className="card" style={{ width:460 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800, color:'#0D3B87' }}>💰 Registrar Movimiento de Caja</h3>
              <form onSubmit={addCashFlow} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <select required value={cashForm.location_id} onChange={e=>setCashForm(p=>({...p,location_id:e.target.value}))}
                  style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                  <option value="">Selecciona la sede</option>
                  {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <select value={cashForm.type} onChange={e=>setCashForm(p=>({...p,type:e.target.value}))}
                    style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                    <option value="INGRESO">💚 Ingreso</option>
                    <option value="EGRESO">🔴 Egreso</option>
                  </select>
                  <select value={cashForm.category} onChange={e=>setCashForm(p=>({...p,category:e.target.value}))}
                    style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}>
                    <option value="VENTA">Venta</option>
                    <option value="COMPRA_STOCK">Compra de stock</option>
                    <option value="GASTO_OPERATIVO">Gasto operativo</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <input required type="number" step="0.01" value={cashForm.amount}
                  onChange={e=>setCashForm(p=>({...p,amount:e.target.value}))}
                  placeholder="Monto (S/)" style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14 }}/>
                <textarea value={cashForm.description} onChange={e=>setCashForm(p=>({...p,description:e.target.value}))}
                  placeholder="Descripción (opcional)" rows={2}
                  style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, resize:'vertical' }}/>
                <div style={{ display:'flex', gap:10 }}>
                  <button type="submit" className="btn btn-green" disabled={sending} style={{ flex:1, padding:12 }}>
                    {sending?'...':'💰 Registrar'}
                  </button>
                  <button type="button" onClick={()=>setShowCashForm(false)}
                    style={{ padding:'12px 20px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'white', cursor:'pointer', fontWeight:600 }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB: Resumen por sede */}
        {tab==='resumen' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {sedes.map(s=>{
                const sc = SEDE_COLORS[s.name]||{ color:'#64748b', bg:'#f8fafc', icon:'🏢' };
                return (
                  <div key={s.id} className="card" style={{ border:`2px solid ${sc.color}20`, borderTop:`4px solid ${sc.color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                      <div style={{ fontSize:28 }}>{sc.icon}</div>
                      {parseInt(s.criticos)>0 && <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>🔴 {s.criticos} críticos</span>}
                    </div>
                    <div style={{ fontSize:16, fontWeight:900, color:sc.color, marginBottom:4 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginBottom:12 }}>{s.city}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[['Items',fmtN(s.total_items),sc.color],['Stock',fmtN(s.total_stock),sc.color],['Stock bajo',fmtN(s.low_stock),'#dc2626'],['Sin stock',fmtN(s.sin_stock),'#dc2626']].map(([l,v,c])=>(
                        <div key={l} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{l}</div>
                          <div style={{ fontSize:16, fontWeight:800, color:c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #f1f5f9' }}>
                      <div style={{ fontSize:11, color:'#64748b' }}>Valor inventario</div>
                      <div style={{ fontSize:18, fontWeight:900, color:sc.color }}>{fmt(s.total_value)}</div>
                      <div style={{ fontSize:11, color:'#15803d', marginTop:2 }}>Retail: {fmt(s.total_retail)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totales globales */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                ['📦','Total Items', fmtN(sedes.reduce((a,s)=>a+parseInt(s.total_items||0),0)),'#2563eb'],
                ['📊','Total Stock', fmtN(sedes.reduce((a,s)=>a+parseInt(s.total_stock||0),0)),'#7c3aed'],
                ['⚠️','Con stock bajo', fmtN(sedes.reduce((a,s)=>a+parseInt(s.low_stock||0),0)),'#dc2626'],
                ['💰','Valor total', fmt(sedes.reduce((a,s)=>a+parseFloat(s.total_value||0),0)),'#15803d'],
              ].map(([icon,label,value,color])=>(
                <div key={label} className="card" style={{ borderTop:`4px solid ${color}`, textAlign:'center' }}>
                  <div style={{ fontSize:24 }}>{icon}</div>
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase', marginTop:6 }}>{label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Inventario */}
        {tab==='inventario' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#0D3B87' }}>📦 Items en Inventario</div>
              <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)}
                style={{ padding:'8px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13 }}>
                <option value="">Todas las sedes</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                  {['QR','Item','Sede','Tipo','Stock','Mín','Estado','Costo','Precio','Días restantes','Acción'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length===0 ? (
                  <tr><td colSpan={11} style={{ padding:40, textAlign:'center', color:'#64748b' }}>Sin items en inventario</td></tr>
                ) : filteredItems.map(item=>{
                  const sc = SEDE_COLORS[item.location_name]||{ color:'#64748b', bg:'#f8fafc' };
                  const isLow = item.quantity <= item.min_quantity;
                  const daysLeft = item.predicted_days_left;
                  const daysStatus = !daysLeft||daysLeft>=999 ? null : daysLeft<7?'CRITICO':daysLeft<15?'BAJO':daysLeft<30?'NORMAL':'BUENO';
                  return (
                    <tr key={item.id} className="row" style={{ borderBottom:'1px solid #f1f5f9', background:isLow?'#fff5f5':'white' }}>
                      <td style={{ padding:'10px 14px', fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>{item.qr_code?.substring(0,12)}...</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#0D3B87' }}>{item.item_name}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                          {item.location_name}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{item.item_type}</td>
                      <td style={{ padding:'10px 14px', fontWeight:800, color:isLow?'#dc2626':'#0D3B87', fontSize:15 }}>{item.quantity}</td>
                      <td style={{ padding:'10px 14px', color:'#94a3b8' }}>{item.min_quantity}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ background:isLow?'#fef2f2':'#f0fdf4', color:isLow?'#dc2626':'#15803d', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                          {isLow?'⚠️ Stock bajo':'✅ OK'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', color:'#64748b' }}>{fmt(item.unit_cost)}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#15803d' }}>{fmt(item.unit_price)}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {daysStatus ? (
                          <span style={{ background:STATUS_COLOR[daysStatus].bg, color:STATUS_COLOR[daysStatus].color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                            {daysLeft} días
                          </span>
                        ) : <span style={{ color:'#94a3b8', fontSize:12 }}>Sin datos</span>}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        {movingItem===item.id ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:180 }}>
                            <select value={movForm.movement_type} onChange={e=>setMovForm(p=>({...p,movement_type:e.target.value}))}
                              style={{ padding:'5px 8px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:11 }}>
                              <option value="SALIDA">📤 Salida</option>
                              <option value="ENTRADA">📥 Entrada</option>
                            </select>
                            <input type="number" min="1" value={movForm.quantity}
                              onChange={e=>setMovForm(p=>({...p,quantity:e.target.value}))}
                              placeholder="Cantidad"
                              style={{ padding:'5px 8px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:11 }}/>
                            <input value={movForm.notes} onChange={e=>setMovForm(p=>({...p,notes:e.target.value}))}
                              placeholder="Notas" style={{ padding:'5px 8px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:11 }}/>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={()=>registerMovement(item.id)} className="btn btn-green" disabled={sending}
                                style={{ flex:1, padding:'5px', fontSize:11 }}>{sending?'...':'✓'}</button>
                              <button onClick={()=>setMovingItem(null)}
                                style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:11 }}>✕</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={()=>setMovingItem(item.id)} className="btn" style={{ padding:'5px 12px', fontSize:11 }}>
                            ± Movimiento
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB: Flujo de Caja */}
        {tab==='flujo' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Resumen por sede */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {cashFlow.summary.map(s=>{
                const sc = SEDE_COLORS[s.location_name]||{ color:'#64748b', bg:'#f8fafc', icon:'🏢' };
                return (
                  <div key={s.location_id} className="card" style={{ borderTop:`4px solid ${sc.color}` }}>
                    <div style={{ fontSize:13, fontWeight:800, color:sc.color, marginBottom:10 }}>{sc.icon} {s.location_name}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                        <span style={{ color:'#64748b' }}>Ingresos</span>
                        <span style={{ fontWeight:700, color:'#15803d' }}>{fmt(s.total_ingresos)}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                        <span style={{ color:'#64748b' }}>Egresos</span>
                        <span style={{ fontWeight:700, color:'#dc2626' }}>{fmt(s.total_egresos)}</span>
                      </div>
                      <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:6, display:'flex', justifyContent:'space-between', fontSize:13 }}>
                        <span style={{ fontWeight:700 }}>Balance</span>
                        <span style={{ fontWeight:900, color:parseFloat(s.balance)>=0?'#15803d':'#dc2626' }}>{fmt(s.balance)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {cashFlow.summary.length===0 && (
                <div className="card" style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'#64748b' }}>
                  Sin movimientos de caja registrados. Usa el botón "💰 Flujo de Caja" para agregar.
                </div>
              )}
            </div>

            {/* Transacciones */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', fontSize:15, fontWeight:800, color:'#0D3B87' }}>
                📋 Últimas transacciones
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                    {['Sede','Tipo','Categoría','Monto','Descripción','Fecha'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.transactions.length===0 ? (
                    <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#64748b' }}>Sin transacciones</td></tr>
                  ) : cashFlow.transactions.map(t=>{
                    const sc = SEDE_COLORS[t.location_name]||{ color:'#64748b', bg:'#f8fafc' };
                    return (
                      <tr key={t.id} className="row" style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{t.location_name}</span>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background:t.type==='INGRESO'?'#f0fdf4':'#fef2f2', color:t.type==='INGRESO'?'#15803d':'#dc2626', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                            {t.type==='INGRESO'?'💚 Ingreso':'🔴 Egreso'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{t.category}</td>
                        <td style={{ padding:'10px 14px', fontWeight:800, color:t.type==='INGRESO'?'#15803d':'#dc2626', fontSize:14 }}>{fmt(t.amount)}</td>
                        <td style={{ padding:'10px 14px', color:'#374151', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description||'—'}</td>
                        <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{new Date(t.created_at).toLocaleDateString('es-PE')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Alertas */}
        {tab==='alertas' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {alerts.length===0 ? (
              <div className="card" style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#15803d' }}>Sin alertas activas</div>
                <div style={{ color:'#64748b', marginTop:8 }}>Todo el inventario está en niveles normales</div>
              </div>
            ) : alerts.map(a=>{
              const sc = SEDE_COLORS[a.location_name]||{ color:'#64748b', bg:'#f8fafc', icon:'🏢' };
              const alertColor = a.alert_type==='STOCK_BAJO'?'#dc2626':a.alert_type==='PREDICCION'?'#ea580c':'#7c3aed';
              return (
                <div key={a.id} className="card" style={{ border:`2px solid ${alertColor}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:`${alertColor}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                      {a.alert_type==='STOCK_BAJO'?'⚠️':a.alert_type==='PREDICCION'?'🔮':'📊'}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#0D3B87' }}>{a.item_name}</div>
                      <div style={{ fontSize:13, color:'#374151', marginTop:2 }}>{a.message}</div>
                      <div style={{ display:'flex', gap:8, marginTop:6 }}>
                        <span style={{ background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{sc.icon} {a.location_name}</span>
                        <span style={{ background:`${alertColor}15`, color:alertColor, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{a.alert_type}</span>
                        <span style={{ color:'#94a3b8', fontSize:11 }}>{new Date(a.created_at).toLocaleDateString('es-PE')}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>resolveAlert(a.id)} className="btn btn-green" style={{ padding:'6px 14px', fontSize:11, flexShrink:0 }}>
                    ✓ Resolver
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Predicción */}
        {tab==='prediccion' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card" style={{ background:'linear-gradient(135deg,#0D3B87,#1A4A8A)', color:'white', padding:'16px 20px' }}>
              <div style={{ fontSize:14, fontWeight:800, marginBottom:4 }}>🔮 Predicción de inventario basada en consumo histórico</div>
              <div style={{ fontSize:12, color:'#A8CAEA' }}>Calculado en base a los últimos 30 días de movimientos. Los items sin movimientos no aparecen.</div>
            </div>
            {predictions.length===0 ? (
              <div className="card" style={{ textAlign:'center', padding:40, color:'#64748b' }}>
                Sin datos de predicción aún. Registra movimientos de inventario para activar las predicciones.
              </div>
            ) : (
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                      {['Item','Sede','Stock actual','Uso diario promedio','Días restantes','Estado','Acción recomendada'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map(p=>{
                      const sc = SEDE_COLORS[p.location_name]||{ color:'#64748b', bg:'#f8fafc' };
                      const ss = STATUS_COLOR[p.stock_status]||STATUS_COLOR.BUENO;
                      const reorder = Math.ceil(parseFloat(p.avg_daily_usage||0) * 30);
                      return (
                        <tr key={p.id} className="row" style={{ borderBottom:'1px solid #f1f5f9', background:p.stock_status==='CRITICO'?'#fff5f5':'white' }}>
                          <td style={{ padding:'10px 14px', fontWeight:700, color:'#0D3B87' }}>{p.item_name}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{p.location_name}</span>
                          </td>
                          <td style={{ padding:'10px 14px', fontWeight:800, fontSize:15 }}>{p.quantity}</td>
                          <td style={{ padding:'10px 14px', color:'#64748b' }}>{parseFloat(p.avg_daily_usage||0).toFixed(1)} uds/día</td>
                          <td style={{ padding:'10px 14px', fontWeight:800, color:ss.color, fontSize:15 }}>
                            {p.predicted_days_left >= 999 ? '∞' : `${p.predicted_days_left} días`}
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:ss.bg, color:ss.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{ss.label}</span>
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:12, color:'#374151' }}>
                            {p.stock_status==='CRITICO' && `🚨 Reordenar urgente: ~${reorder} unidades`}
                            {p.stock_status==='BAJO' && `⚠️ Planificar reorden: ~${reorder} uds/mes`}
                            {p.stock_status==='NORMAL' && `📋 Monitorear — reorden mensual: ~${reorder} uds`}
                            {p.stock_status==='BUENO' && '✅ Nivel óptimo'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Reportes */}
        {tab==='reportes' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#0D3B87' }}>📊 Reportes Diarios por Sede</div>
              <button onClick={generateReport} className="btn btn-amber" disabled={sending} style={{ fontSize:12 }}>
                {sending?'Generando...':'🔄 Generar ahora'}
              </button>
            </div>
            {reports.length===0 ? (
              <div className="card" style={{ textAlign:'center', padding:40, color:'#64748b' }}>
                Sin reportes generados. Haz click en "Generar ahora" para crear el primer reporte.
              </div>
            ) : (
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                      {['Fecha','Sede','Items','Stock total','Stock bajo','Valor','Ingresos','Egresos','Balance'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r=>{
                      const sc = SEDE_COLORS[r.location_name]||{ color:'#64748b', bg:'#f8fafc' };
                      const balance = parseFloat(r.total_ingresos||0) - parseFloat(r.total_egresos||0);
                      return (
                        <tr key={r.id} className="row" style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{ padding:'10px 14px', fontWeight:700, color:'#0D3B87' }}>
                            {new Date(r.report_date).toLocaleDateString('es-PE')}
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{r.location_name}</span>
                          </td>
                          <td style={{ padding:'10px 14px', textAlign:'center' }}>{r.total_items}</td>
                          <td style={{ padding:'10px 14px', textAlign:'center', fontWeight:700 }}>{r.total_stock}</td>
                          <td style={{ padding:'10px 14px', textAlign:'center', color:parseInt(r.low_stock_items)>0?'#dc2626':'#15803d', fontWeight:700 }}>{r.low_stock_items}</td>
                          <td style={{ padding:'10px 14px', fontWeight:700 }}>{fmt(r.total_value)}</td>
                          <td style={{ padding:'10px 14px', color:'#15803d', fontWeight:700 }}>{fmt(r.total_ingresos)}</td>
                          <td style={{ padding:'10px 14px', color:'#dc2626', fontWeight:700 }}>{fmt(r.total_egresos)}</td>
                          <td style={{ padding:'10px 14px', fontWeight:900, color:balance>=0?'#15803d':'#dc2626' }}>{fmt(balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
