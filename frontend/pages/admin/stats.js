import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Scatter
} from 'recharts';

const C = {
  blue:   '#2563eb', blueL: '#3b82f6', blueLL: '#93c5fd',
  green:  '#16a34a', greenL: '#22c55e', greenLL: '#86efac',
  amber:  '#d97706', amberL: '#f59e0b', amberLL: '#fcd34d',
  purple: '#7c3aed', purpleL: '#8b5cf6', purpleLL: '#c4b5fd',
  red:    '#dc2626', redL: '#ef4444',   redLL:  '#fca5a5',
  teal:   '#0891b2', tealL: '#06b6d4',
  bg:     '#0f1623', bg2: '#161e2e', bg3: '#1e2d45',
  card:   '#1a2438', border: 'rgba(59,130,246,0.15)',
  text:   '#e2e8f0', textMuted: '#64748b', textDim: '#94a3b8',
};

const fmt  = (v) => `S/ ${parseFloat(v||0).toLocaleString('es-PE',{minimumFractionDigits:2})}`;
const fmtK = (v) => parseFloat(v||0) >= 1000 ? `S/ ${(v/1000).toFixed(1)}k` : `S/ ${parseFloat(v||0).toFixed(0)}`;
const fmtN = (v) => parseFloat(v||0).toLocaleString('es-PE');

const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1726', border: `1px solid ${C.blueL}40`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.text, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      {label && <p style={{ color: C.blueLL, fontWeight: 700, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }}/>
          <span style={{ color: C.textDim }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: C.text }}>{typeof p.value === 'number' && p.value > 50 ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const KpiCard = ({ icon, label, value, sub, color, delta, mini }) => (
  <div style={{ background: C.card, border: `1px solid ${color}25`, borderRadius: 12, padding: mini ? '14px 16px' : '18px 22px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}44)`, borderRadius: '12px 12px 0 0' }}/>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
      {delta !== undefined && (
        <div style={{ background: delta >= 0 ? `${C.green}18` : `${C.red}18`, border: `1px solid ${delta >= 0 ? C.green : C.red}30`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: delta >= 0 ? C.greenL : C.redL, fontWeight: 700 }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
        </div>
      )}
    </div>
    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: mini ? 20 : 26, fontWeight: 900, color: C.text, letterSpacing: '-0.5px', marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: color, fontWeight: 500 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ icon, title, sub }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
    <div style={{ width: 4, height: 20, background: `linear-gradient(180deg, ${C.blueL}, ${C.tealL})`, borderRadius: 2 }}/>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{icon} {title}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

export default function AdminStats() {
  const [monthly,    setMonthly]    = useState([]);
  const [sellers,    setSellers]    = useState([]);
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [selFilter,  setSelFilter]  = useState('');
  const [error,      setError]      = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/stats/monthly'),
      apiFetch('/api/admin/stats/sellers'),
      apiFetch('/api/admin/stats/products'),
      apiFetch('/api/admin/stats/categories'),
      apiFetch('/api/admin/users'),
    ]).then(([m,s,p,c,u]) => {
      setMonthly(m); setSellers(s); setProducts(p); setCategories(c); setUsers(u);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const totalRev   = sellers.reduce((a,s)=>a+parseFloat(s.total_vendido||0), 0);
  const totalCom   = sellers.reduce((a,s)=>a+parseFloat(s.total_comision||0), 0);
  const totalNet   = sellers.reduce((a,s)=>a+parseFloat(s.total_neto||0), 0);
  const totalOrds  = sellers.reduce((a,s)=>a+parseInt(s.num_ventas||0), 0);
  const avgOrder   = totalOrds ? (totalRev / totalOrds) : 0;
  const uniqueSels = [...new Set(products.map(p=>p.vendedor))];
  const filtProd   = selFilter ? products.filter(p=>p.vendedor===selFilter) : products;

  const monthlyChart = monthly.map(m => ({
    mes: m.mes_label?.replace(' ','\''),
    'Revenue': parseFloat(m.total_ventas),
    'Comisión': parseFloat(m.total_comision),
    'Neto': parseFloat(m.total_neto),
    ordenes: parseInt(m.num_ordenes||0),
  }));

  const sellerChart = sellers.map((s,i) => ({
    name: s.vendedor.split(' ')[0],
    Vendido: parseFloat(s.total_vendido),
    Neto: parseFloat(s.total_neto),
    Comisión: parseFloat(s.total_comision),
    Ventas: parseInt(s.num_ventas),
  }));

  const catChart = categories.map(c => ({
    name: c.categoria?.length > 14 ? c.categoria.substring(0,12)+'…' : c.categoria,
    value: parseFloat(c.total_vendido),
    ventas: parseInt(c.num_ventas||0),
  }));

  const PALETTE = [C.blueL, C.greenL, C.amberL, C.purpleL, C.redL, C.tealL, C.blueLL, C.greenLL];

  if (loading) return (
    <div style={{ fontFamily:'system-ui', background: C.bg, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 20 }}>
      <div style={{ position:'relative', width: 60, height: 60 }}>
        <div style={{ position:'absolute', inset: 0, border:`3px solid ${C.blueL}30`, borderRadius:'50%' }}/>
        <div style={{ position:'absolute', inset: 0, border:`3px solid transparent`, borderTopColor: C.blueL, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      </div>
      <p style={{ color: C.blueLL, fontSize: 14, fontWeight: 600 }}>Cargando Business Analytics…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const tabs = [
    { id:'overview', label:'📊 Overview' },
    { id:'revenue',  label:'💰 Revenue' },
    { id:'sellers',  label:'🏆 Vendedores' },
    { id:'products', label:'📦 Productos' },
  ];

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background: C.bg, minHeight:'100vh', color: C.text }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .hover-row:hover{background:rgba(59,130,246,0.06)!important}
        .tab-btn:hover{background:rgba(59,130,246,0.12)!important}
        select option{background:#1a2438;color:#e2e8f0}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#0f1623}
        ::-webkit-scrollbar-thumb{background:#2563eb55;border-radius:3px}
      `}</style>

      {/* ══════ TOPBAR ══════ */}
      <div style={{ background: C.bg2, borderBottom:`1px solid ${C.border}`, padding:'0 28px' }}>
        <div style={{ maxWidth:1600, margin:'0 auto', display:'flex', alignItems:'center', height: 60, gap: 20, justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
            <a href="/admin/commissions" style={{ color: C.textMuted, textDecoration:'none', fontSize: 13, display:'flex', alignItems:'center', gap: 6 }}>
              ← Panel Admin
            </a>
            <span style={{ color: C.border }}>|</span>
            <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, background:`linear-gradient(135deg,${C.blueL},${C.tealL})`, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14 }}>📊</div>
              <span style={{ fontWeight: 800, fontSize: 15, background:`linear-gradient(135deg,${C.blueLL},${C.tealL})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Business Analytics
              </span>
              <span style={{ background:`${C.blue}30`, border:`1px solid ${C.blue}50`, color: C.blueLL, fontSize: 10, padding:'2px 8px', borderRadius: 20, fontWeight: 700, letterSpacing: 1 }}>POWER BI</span>
            </div>
          </div>
          <div style={{ display:'flex', gap: 10 }}>
            <a href="/admin/report" style={{ background:`linear-gradient(135deg,${C.green},${C.greenL})`, color:'white', padding:'7px 16px', borderRadius: 8, textDecoration:'none', fontSize: 12, fontWeight: 700, display:'flex', alignItems:'center', gap: 6 }}>
              📄 Informe PDF
            </a>
            <a href="/" style={{ color: C.textMuted, textDecoration:'none', fontSize: 12, padding:'7px 12px', borderRadius: 8, border:`1px solid ${C.border}` }}>← Inicio</a>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth:1600, margin:'0 auto', display:'flex', gap: 4, paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} className="tab-btn"
              style={{ padding:'10px 18px', border:'none', background:'transparent', cursor:'pointer', fontSize: 13, fontWeight: activeTab===t.id ? 700 : 400, color: activeTab===t.id ? C.blueLL : C.textMuted, borderBottom: activeTab===t.id ? `2px solid ${C.blueL}` : '2px solid transparent', transition:'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1600, margin:'0 auto', padding:'24px 28px', animation:'fadeUp 0.4s ease' }}>

        {error && <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}40`, color: C.redLL, padding:'12px 16px', borderRadius: 10, marginBottom: 20 }}>⚠ {error}</div>}

        {/* ══════ OVERVIEW TAB ══════ */}
        {activeTab === 'overview' && (
          <>
            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
              <KpiCard icon="💵" label="Revenue Total" value={fmt(totalRev)} sub={`${totalOrds} transacciones`} color={C.greenL} delta={12}/>
              <KpiCard icon="🏦" label="Comisión Futura" value={fmt(totalCom)} sub="10% por venta" color={C.blueL} delta={12}/>
              <KpiCard icon="💸" label="Neto Vendedores" value={fmt(totalNet)} sub="Transferido" color={C.purpleL} delta={11}/>
              <KpiCard icon="🛒" label="Ticket Promedio" value={fmt(avgOrder)} sub="Por orden" color={C.amberL} delta={3}/>
              <KpiCard icon="👥" label="Usuarios" value={users.length} sub={`${sellers.length} vendedores`} color={C.tealL}/>
            </div>

            {/* Main charts row */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Revenue area chart */}
              <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <SectionTitle icon="📈" title="Revenue mensual" sub="Últimos 6 meses · Revenue vs Neto vs Comisión"/>
                {monthlyChart.length === 0 ? (
                  <div style={{ height: 260, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>📊</div>
                    <p style={{ color: C.textMuted, fontSize: 13 }}>Sin datos de ventas aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthlyChart}>
                      <defs>
                        {[['rev',C.blueL],['net',C.greenL],['com',C.amberL]].map(([id,c])=>(
                          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={c} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={c} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="mes" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<PBITooltip/>}/>
                      <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                      <Area type="monotone" dataKey="Revenue" stroke={C.blueL} fill="url(#rev)" strokeWidth={2}/>
                      <Area type="monotone" dataKey="Neto" stroke={C.greenL} fill="url(#net)" strokeWidth={2}/>
                      <Line type="monotone" dataKey="Comisión" stroke={C.amberL} strokeWidth={2} dot={{r:3,fill:C.amberL}} strokeDasharray="5 3"/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Donut categorías */}
              <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <SectionTitle icon="🏷️" title="Revenue por categoría" sub="Distribución porcentual"/>
                {catChart.length === 0 ? (
                  <div style={{ height: 260, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <p style={{ color: C.textMuted }}>Sin datos</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={catChart} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                          {catChart.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'#0d1726',border:`1px solid ${C.blueL}40`,borderRadius:8,fontSize:12}}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
                      {catChart.slice(0,5).map((c,i) => {
                        const total = catChart.reduce((a,x)=>a+x.value,0);
                        const pct = total ? ((c.value/total)*100).toFixed(1) : 0;
                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PALETTE[i%PALETTE.length], flexShrink: 0 }}/>
                            <div style={{ flex: 1, fontSize: 11, color: C.textDim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: PALETTE[i%PALETTE.length], fontWeight: 700 }}>{pct}%</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>{fmt(c.value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Seller mini-summary */}
            <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <SectionTitle icon="🏆" title="Top Vendedores" sub="Ranking por revenue generado"/>
              {sellers.length === 0 ? (
                <p style={{ color: C.textMuted, fontSize: 13 }}>Sin ventas registradas</p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                  {sellers.map((s,i) => {
                    const pct = totalRev ? ((parseFloat(s.total_vendido)/totalRev)*100).toFixed(1) : 0;
                    return (
                      <div key={s.id} style={{ background: C.bg3, border:`1px solid ${PALETTE[i%PALETTE.length]}25`, borderRadius: 10, padding: 14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background:`linear-gradient(135deg,${PALETTE[i%PALETTE.length]},${PALETTE[i%PALETTE.length]}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 16, flexShrink: 0 }}>
                            {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.vendedor}</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>{s.num_ventas} ventas · {pct}% del total</div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ background:`${PALETTE[i%PALETTE.length]}15`, borderRadius: 4, height: 4, marginBottom: 8 }}>
                          <div style={{ width:`${pct}%`, background: PALETTE[i%PALETTE.length], height:'100%', borderRadius: 4 }}/>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6 }}>
                          <div><div style={{ fontSize: 10, color: C.textMuted }}>Total</div><div style={{ fontSize: 13, fontWeight: 800, color: PALETTE[i%PALETTE.length] }}>{fmt(s.total_vendido)}</div></div>
                          <div><div style={{ fontSize: 10, color: C.textMuted }}>Neto</div><div style={{ fontSize: 13, fontWeight: 700, color: C.greenL }}>{fmt(s.total_neto)}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════ REVENUE TAB ══════ */}
        {activeTab === 'revenue' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
              <KpiCard icon="💵" label="Revenue Total" value={fmt(totalRev)} color={C.greenL} delta={12}/>
              <KpiCard icon="🏦" label="Comisión Total" value={fmt(totalCom)} sub="Futura Digital" color={C.blueL}/>
              <KpiCard icon="💸" label="Neto Vendedores" value={fmt(totalNet)} color={C.purpleL}/>
              <KpiCard icon="📊" label="Margen Futura" value={totalRev ? `${((totalCom/totalRev)*100).toFixed(1)}%` : '0%'} sub="Comisión / Revenue" color={C.amberL}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <SectionTitle icon="📈" title="Evolución mensual" sub="Revenue acumulado mes a mes"/>
                {monthlyChart.length === 0 ? (
                  <div style={{ height: 260, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>📈</div>
                    <p style={{ color: C.textMuted, fontSize: 13 }}>Sin datos de ventas aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="mes" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<PBITooltip/>}/>
                      <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                      <Bar dataKey="Revenue" fill={`${C.blueL}80`} radius={[4,4,0,0]}/>
                      <Bar dataKey="Comisión" fill={`${C.amberL}80`} radius={[4,4,0,0]}/>
                      <Line type="monotone" dataKey="Neto" stroke={C.greenL} strokeWidth={2.5} dot={{r:4,fill:C.greenL}}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <SectionTitle icon="📊" title="Órdenes por mes" sub="Volumen de transacciones"/>
                {monthlyChart.length === 0 ? (
                  <div style={{ height: 260, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>📊</div>
                    <p style={{ color: C.textMuted, fontSize: 13 }}>Sin datos de ventas aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="mes" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<PBITooltip/>}/>
                      <Bar dataKey="ordenes" name="Órdenes" radius={[6,6,0,0]}>
                        {monthlyChart.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Revenue breakdown table */}
            <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <SectionTitle icon="🗂️" title="Desglose por mes" sub="Detalle completo de revenue mensual"/>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {['Mes','Revenue','Comisión Futura','Neto Vendedores','Órdenes','Ticket Prom.'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color: C.textMuted, fontWeight: 700, textTransform:'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyChart.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color: C.textMuted }}>Sin datos de ventas aún</td></tr>
                  ) : monthlyChart.map((m,i) => (
                    <tr key={i} className="hover-row" style={{ borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                      <td style={{ padding:'12px 14px', fontWeight: 700, color: C.blueLL }}>{m.mes}</td>
                      <td style={{ padding:'12px 14px', fontWeight: 800, color: C.text }}>{fmt(m.Revenue)}</td>
                      <td style={{ padding:'12px 14px' }}><span style={{ background:`${C.amber}20`, color: C.amberL, padding:'3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{fmt(m.Comisión)}</span></td>
                      <td style={{ padding:'12px 14px', color: C.greenL, fontWeight: 700 }}>{fmt(m.Neto)}</td>
                      <td style={{ padding:'12px 14px', textAlign:'center' }}><span style={{ background:`${C.blue}20`, color: C.blueLL, padding:'3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{m.ordenes}</span></td>
                      <td style={{ padding:'12px 14px', color: C.textDim }}>{m.ordenes ? fmt(m.Revenue/m.ordenes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop:`2px solid ${C.blueL}30` }}>
                    <td style={{ padding:'12px 14px', fontWeight: 800, color: C.blueLL }}>TOTAL</td>
                    <td style={{ padding:'12px 14px', fontWeight: 900, color: C.greenL, fontSize: 15 }}>{fmt(totalRev)}</td>
                    <td style={{ padding:'12px 14px' }}><span style={{ background:`${C.amber}20`, color: C.amberL, padding:'3px 10px', borderRadius: 20, fontWeight: 900 }}>{fmt(totalCom)}</span></td>
                    <td style={{ padding:'12px 14px', color: C.purpleL, fontWeight: 900 }}>{fmt(totalNet)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'center', fontWeight: 900, color: C.blueLL }}>{totalOrds}</td>
                    <td style={{ padding:'12px 14px', color: C.textDim, fontWeight: 700 }}>{fmt(avgOrder)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ══════ SELLERS TAB ══════ */}
        {activeTab === 'sellers' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
              <KpiCard icon="🏪" label="Vendedores activos" value={sellers.length} color={C.blueL}/>
              <KpiCard icon="🛒" label="Total ventas" value={fmtN(totalOrds)} color={C.greenL}/>
              <KpiCard icon="🏦" label="Comisiones generadas" value={fmt(totalCom)} color={C.amberL}/>
              <KpiCard icon="💸" label="Mayor vendedor" value={sellers[0]?.vendedor?.split(' ')[0] || '—'} sub={sellers[0] ? fmt(sellers[0].total_vendido) : ''} color={C.purpleL}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <SectionTitle icon="📊" title="Comparativa de vendedores" sub="Revenue · Neto · Comisión"/>
                {sellerChart.length === 0 ? (
                  <div style={{ height: 260, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>🏪</div>
                    <p style={{ color: C.textMuted, fontSize: 13 }}>Sin ventas registradas aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={sellerChart} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<PBITooltip/>}/>
                      <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                      <Bar dataKey="Vendido" fill={C.blueL} radius={[4,4,0,0]} maxBarSize={40}/>
                      <Bar dataKey="Neto"    fill={C.greenL} radius={[4,4,0,0]} maxBarSize={40}/>
                      <Bar dataKey="Comisión" fill={C.amberL} radius={[4,4,0,0]} maxBarSize={40}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <SectionTitle icon="🎯" title="Participación de mercado" sub="% del revenue total por vendedor"/>
                {sellers.length === 0 ? (
                  <div style={{ height: 260, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>🎯</div>
                    <p style={{ color: C.textMuted, fontSize: 13 }}>Sin datos aún</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={sellers.map(s=>({name:s.vendedor.split(' ')[0],value:parseFloat(s.total_vendido)}))}
                          cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                          {sellers.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'#0d1726',border:`1px solid ${C.blueL}40`,borderRadius:8,fontSize:12}}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                      {sellers.map((s,i) => {
                        const pct = totalRev ? ((parseFloat(s.total_vendido)/totalRev)*100).toFixed(1) : 0;
                        return (
                          <div key={s.id} style={{ display:'flex', alignItems:'center', gap: 8 }}>
                            <div style={{ width:10,height:10,borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0 }}/>
                            <span style={{ flex:1, fontSize:12, color:C.textDim }}>{s.vendedor.split(' ')[0]}</span>
                            <div style={{ width: 80, height: 4, background:`${PALETTE[i%PALETTE.length]}20`, borderRadius: 2 }}>
                              <div style={{ width:`${pct}%`, height:'100%', background:PALETTE[i%PALETTE.length], borderRadius: 2 }}/>
                            </div>
                            <span style={{ fontSize:12, fontWeight:700, color:PALETTE[i%PALETTE.length], minWidth:36, textAlign:'right' }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Seller detail table */}
            <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <SectionTitle icon="📋" title="Tabla de rendimiento" sub="Desglose completo por vendedor"/>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {['Pos.','Vendedor','N° Ventas','Revenue','Comisión (10%)','Neto Recibido','Ticket Prom.','% Mercado'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sellers.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color: C.textMuted }}>Sin ventas registradas aún</td></tr>
                  ) : sellers.map((s,i) => {
                    const pct = totalRev ? ((parseFloat(s.total_vendido)/totalRev)*100).toFixed(1) : 0;
                    const ticket = s.num_ventas ? fmt(parseFloat(s.total_vendido)/s.num_ventas) : '—';
                    return (
                      <tr key={s.id} className="hover-row" style={{ borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding:'12px 14px', fontSize:18 }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                            <div style={{ width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${PALETTE[i%PALETTE.length]},${PALETTE[i%PALETTE.length]}88)`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:13,fontWeight:800 }}>
                              {s.vendedor?.[0]}
                            </div>
                            <span style={{ fontWeight:700 }}>{s.vendedor}</span>
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px', textAlign:'center' }}><span style={{ background:`${C.blue}20`, color:C.blueLL, padding:'3px 10px', borderRadius:20, fontWeight:700 }}>{s.num_ventas}</span></td>
                        <td style={{ padding:'12px 14px', fontWeight:900, color:PALETTE[i%PALETTE.length], fontSize:14 }}>{fmt(s.total_vendido)}</td>
                        <td style={{ padding:'12px 14px' }}><span style={{ background:`${C.amber}15`, color:C.amberL, padding:'3px 10px', borderRadius:8, fontWeight:700 }}>{fmt(s.total_comision)}</span></td>
                        <td style={{ padding:'12px 14px', color:C.greenL, fontWeight:800 }}>{fmt(s.total_neto)}</td>
                        <td style={{ padding:'12px 14px', color:C.textDim }}>{ticket}</td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                            <div style={{ flex:1, height:6, background:`${PALETTE[i%PALETTE.length]}20`, borderRadius:3 }}>
                              <div style={{ width:`${pct}%`, height:'100%', background:PALETTE[i%PALETTE.length], borderRadius:3 }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:PALETTE[i%PALETTE.length], minWidth:34 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════ PRODUCTS TAB ══════ */}
        {activeTab === 'products' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
              <KpiCard icon="📦" label="Productos vendidos" value={products.length} color={C.blueL}/>
              <KpiCard icon="🔝" label="Producto top" value={products[0]?.producto?.substring(0,16)+'…'||'—'} sub={products[0]?fmt(products[0].total_generado):''} color={C.amberL}/>
              <KpiCard icon="💰" label="Revenue productos" value={fmt(products.reduce((a,p)=>a+parseFloat(p.total_generado||0),0))} color={C.greenL}/>
              <KpiCard icon="🏷️" label="Categorías activas" value={categories.length} color={C.purpleL}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <SectionTitle icon="📊" title="Revenue por producto" sub="Top 8 productos más rentables"/>
                  <select value={selFilter} onChange={e=>setSelFilter(e.target.value)}
                    style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${C.border}`, fontSize:12, color:C.text, background:C.bg3, cursor:'pointer' }}>
                    <option value="">Todos los vendedores</option>
                    {uniqueSels.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {filtProd.length === 0 ? (
                  <div style={{ height:240, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
                    <div style={{ fontSize:40, opacity:0.3 }}>📦</div>
                    <p style={{ color:C.textMuted, fontSize:13 }}>Sin productos vendidos aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={filtProd.slice(0,8).map(p=>({name:p.producto.substring(0,14)+'…',Revenue:parseFloat(p.total_generado),Neto:parseFloat(p.neto_vendedor)}))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false}/>
                      <XAxis type="number" tickFormatter={fmtK} tick={{fontSize:10,fill:C.textMuted}} axisLine={false}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.textMuted}} width={110} axisLine={false} tickLine={false}/>
                      <Tooltip content={<PBITooltip/>}/>
                      <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                      <Bar dataKey="Revenue" fill={C.blueL} radius={[0,4,4,0]}/>
                      <Bar dataKey="Neto" fill={C.greenL} radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
                <SectionTitle icon="🏷️" title="Ventas por categoría" sub="Cantidad de órdenes"/>
                {catChart.length === 0 ? (
                  <div style={{ height:260, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
                    <div style={{ fontSize:40, opacity:0.3 }}>🏷️</div>
                    <p style={{ color:C.textMuted, fontSize:13 }}>Sin datos aún</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart cx="50%" cy="50%" outerRadius={80} data={catChart.slice(0,6)}>
                        <PolarGrid stroke="rgba(255,255,255,0.08)"/>
                        <PolarAngleAxis dataKey="name" tick={{fontSize:9,fill:C.textMuted}}/>
                        <Radar name="Ventas" dataKey="ventas" stroke={C.blueL} fill={C.blueL} fillOpacity={0.25}/>
                        <Radar name="Revenue" dataKey="value" stroke={C.amberL} fill={C.amberL} fillOpacity={0.15}/>
                        <Tooltip contentStyle={{background:'#0d1726',border:`1px solid ${C.blueL}40`,borderRadius:8,fontSize:12}}/>
                        <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                      </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {catChart.slice(0,4).map((c,i)=>(
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0 }}/>
                          <span style={{ flex:1, color:C.textDim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</span>
                          <span style={{ color:C.greenL, fontWeight:700 }}>{fmt(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Products table */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
              <SectionTitle icon="📋" title="Detalle de productos" sub={`${filtProd.length} registros · Filtrado por: ${selFilter||'todos los vendedores'}`}/>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                      {['#','Producto','Vendedor','Categoría','Vendido','Revenue','Comisión','Neto'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtProd.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color:C.textMuted }}>Sin productos vendidos aún</td></tr>
                    ) : filtProd.map((p,i)=>(
                      <tr key={i} className="hover-row" style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                        <td style={{ padding:'10px 12px', color:C.textMuted, fontWeight:600 }}>#{i+1}</td>
                        <td style={{ padding:'10px 12px', fontWeight:600, color:C.text, maxWidth:180 }}>{p.producto}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:22,height:22,borderRadius:'50%',background:`linear-gradient(135deg,${PALETTE[uniqueSels.indexOf(p.vendedor)%PALETTE.length]},${PALETTE[uniqueSels.indexOf(p.vendedor)%PALETTE.length]}88)`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:9,fontWeight:800 }}>
                              {p.vendedor?.[0]}
                            </div>
                            <span style={{ color:C.textDim, fontSize:11 }}>{p.vendedor}</span>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px' }}><span style={{ background:`${C.blue}15`, color:C.blueLL, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600 }}>{p.categoria||'—'}</span></td>
                        <td style={{ padding:'10px 12px', textAlign:'center' }}><span style={{ background:`${C.green}15`, color:C.greenL, padding:'3px 10px', borderRadius:20, fontWeight:800 }}>{p.veces_vendido}x</span></td>
                        <td style={{ padding:'10px 12px', fontWeight:800, color:C.amberL }}>{fmt(p.total_generado)}</td>
                        <td style={{ padding:'10px 12px' }}><span style={{ background:`${C.purple}15`, color:C.purpleL, padding:'2px 8px', borderRadius:8, fontWeight:700 }}>{fmt(p.comision_futura)}</span></td>
                        <td style={{ padding:'10px 12px', color:C.greenL, fontWeight:700 }}>{fmt(p.neto_vendedor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:`2px solid ${C.blueL}30` }}>
                      <td colSpan={5} style={{ padding:'12px', color:C.blueLL, fontWeight:800 }}>TOTALES</td>
                      <td style={{ padding:'12px', color:C.amberL, fontWeight:900, fontSize:14 }}>{fmt(filtProd.reduce((a,p)=>a+parseFloat(p.total_generado||0),0))}</td>
                      <td style={{ padding:'12px', color:C.purpleL, fontWeight:900 }}>{fmt(filtProd.reduce((a,p)=>a+parseFloat(p.comision_futura||0),0))}</td>
                      <td style={{ padding:'12px', color:C.greenL, fontWeight:900 }}>{fmt(filtProd.reduce((a,p)=>a+parseFloat(p.neto_vendedor||0),0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
