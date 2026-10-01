'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, fmtFecha } from '@/lib/utils';

type Productor = { id: string; razon_social: string };
type Alerta = {
  id: string; tipo: string; titulo: string; descripcion: string | null;
  fecha_limite: string | null; completada: boolean;
  productores: { razon_social: string } | null;
  lotes: { nombre: string } | null;
};
type Maleza = {
  id: string; lote_id: string; nombre: string; nivel: string;
  fecha_deteccion: string; tratamientos: string | null;
  estado: string; observaciones: string | null;
  lotes: { nombre: string; productor_id: string; productores: { razon_social: string } | null } | null;
};

const NIVELES = ['bajo','medio','alto','critico'];
const TIPOS_ALERTA = ['fungicida','cierre_surco','aplicacion','cosecha','otro'];
const MALEZAS_COMUNES = ['Maicillo','Rye grass','Sorgo de alepo','Conyza','Yuyo colorado','Pasto cuaresma','Gramón','Otra'];

const NIVEL_COLOR: Record<string,string> = {
  bajo: 'text-green-400 bg-green-950 border-green-700',
  medio: 'text-yellow-400 bg-yellow-950 border-yellow-700',
  alto: 'text-orange-400 bg-orange-950 border-orange-700',
  critico: 'text-red-400 bg-red-950 border-red-700',
};

const TIPO_ICON: Record<string,string> = {
  fungicida: '🍄', cierre_surco: '🌾', aplicacion: '🚜',
  cosecha: '🌽', otro: '📌',
};

function diasRestantes(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const limite = new Date(fecha + 'T00:00:00');
  return Math.ceil((limite.getTime() - hoy.getTime()) / (1000*60*60*24));
}

export function BitacoraClient({ productores, alertas: alertasInit, malezas: malezasInit, userId }: {
  productores: Productor[]; alertas: Alerta[]; malezas: Maleza[]; userId: string;
}) {
  const [alertas, setAlertas] = useState(alertasInit);
  const [malezas, setMalezas] = useState(malezasInit);
  const [tab, setTab] = useState<'alertas'|'malezas'>('alertas');
  const [lotes, setLotes] = useState<{id:string;nombre:string;productor_id:string}[]>([]);
  const [filtroProductor, setFiltroProductor] = useState('');

  // Modal alerta
  const [showAlerta, setShowAlerta] = useState(false);
  const [alertaForm, setAlertaForm] = useState({
    tipo:'fungicida', titulo:'', descripcion:'', fecha_limite:'',
    productor_id:'', lote_id:'',
  });
  const [savingAlerta, setSavingAlerta] = useState(false);

  // Modal maleza
  const [showMaleza, setShowMaleza] = useState(false);
  const [malezaForm, setMalezaForm] = useState({
    lote_id:'', nombre:'', nivel:'medio',
    fecha_deteccion: new Date().toISOString().slice(0,10),
    tratamientos:'', observaciones:'',
  });
  const [savingMaleza, setSavingMaleza] = useState(false);

  useEffect(() => { fetchLotes(); }, []);

  async function fetchLotes() {
    const { data } = await (createClient() as any).from('lotes')
      .select('id,nombre,productor_id').order('nombre');
    setLotes(data ?? []);
  }

  async function fetchData() {
    const sb = createClient() as any;
    const [{ data: al }, { data: ml }] = await Promise.all([
      sb.from('alertas').select('*, productores(razon_social), lotes(nombre)')
        .eq('ingeniero_id', userId).eq('completada', false)
        .order('fecha_limite', { ascending: true }),
      sb.from('malezas').select('*, lotes(nombre, productor_id, productores(razon_social))')
        .eq('estado', 'activa').order('created_at', { ascending: false }),
    ]);
    setAlertas(al ?? []);
    setMalezas(ml ?? []);
  }

  async function guardarAlerta() {
    if (!alertaForm.titulo) return;
    setSavingAlerta(true);
    const { error } = await (createClient() as any).from('alertas').insert({
      ingeniero_id: userId,
      tipo: alertaForm.tipo,
      titulo: alertaForm.titulo,
      descripcion: alertaForm.descripcion || null,
      fecha_limite: alertaForm.fecha_limite || null,
      productor_id: alertaForm.productor_id || null,
      lote_id: alertaForm.lote_id || null,
    });
    setSavingAlerta(false);
    if (error) { alert(error.message); return; }
    setAlertaForm({ tipo:'fungicida', titulo:'', descripcion:'', fecha_limite:'', productor_id:'', lote_id:'' });
    setShowAlerta(false);
    await fetchData();
  }

  async function completarAlerta(id: string) {
    await (createClient() as any).from('alertas').update({ completada: true }).eq('id', id);
    await fetchData();
  }

  async function eliminarAlerta(id: string) {
    await (createClient() as any).from('alertas').delete().eq('id', id);
    await fetchData();
  }

  async function guardarMaleza() {
    if (!malezaForm.lote_id || !malezaForm.nombre) return;
    setSavingMaleza(true);
    const { error } = await (createClient() as any).from('malezas').insert({
      lote_id: malezaForm.lote_id,
      nombre: malezaForm.nombre,
      nivel: malezaForm.nivel,
      fecha_deteccion: malezaForm.fecha_deteccion,
      tratamientos: malezaForm.tratamientos || null,
      observaciones: malezaForm.observaciones || null,
    });
    setSavingMaleza(false);
    if (error) { alert(error.message); return; }
    setMalezaForm({ lote_id:'', nombre:'', nivel:'medio', fecha_deteccion: new Date().toISOString().slice(0,10), tratamientos:'', observaciones:'' });
    setShowMaleza(false);
    await fetchData();
  }

  async function controlarMaleza(id: string) {
    await (createClient() as any).from('malezas').update({ estado: 'controlada' }).eq('id', id);
    await fetchData();
  }

  const lotesDelProductor = alertaForm.productor_id
    ? lotes.filter(l => l.productor_id === alertaForm.productor_id)
    : lotes;

  const alertasHoy = alertas.filter(a => {
    const d = diasRestantes(a.fecha_limite);
    return d !== null && d <= 3;
  });
  const alertasFuturas = alertas.filter(a => {
    const d = diasRestantes(a.fecha_limite);
    return d === null || d > 3;
  });

  const malezasFiltradas = filtroProductor
    ? malezas.filter(m => m.lotes?.productor_id === filtroProductor)
    : malezas;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Seguimiento</p>
          <h1 className="text-2xl font-bold text-hi">Bitácora</h1>
        </div>
        <div className="flex gap-2">
          {tab === 'alertas'
            ? <button onClick={() => setShowAlerta(true)} className="btn-primary text-xs">+ Nueva alerta</button>
            : <button onClick={() => setShowMaleza(true)} className="btn-afa text-xs">+ Registrar maleza</button>
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-base-5">
        <button onClick={() => setTab('alertas')}
          className={cn('px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px',
            tab==='alertas' ? 'border-ochre text-ochre' : 'border-transparent text-mid hover:text-hi')}>
          🔔 Alertas {alertas.length > 0 && <span className="ml-1 bg-ochre text-[#0a0a0a] text-[10px] font-black px-1.5 py-0.5 rounded-full">{alertas.length}</span>}
        </button>
        <button onClick={() => setTab('malezas')}
          className={cn('px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px',
            tab==='malezas' ? 'border-afa text-afa' : 'border-transparent text-mid hover:text-hi')}>
          🌿 Malezas {malezas.length > 0 && <span className="ml-1 bg-afa text-[#0a0a0a] text-[10px] font-black px-1.5 py-0.5 rounded-full">{malezas.length}</span>}
        </button>
      </div>

      {/* ── ALERTAS ── */}
      {tab === 'alertas' && (
        <div className="space-y-4">
          {alertas.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-mid">Sin alertas pendientes.</p>
              <p className="text-lo text-sm mt-1">Agregá recordatorios de aplicaciones, fungicidas o cierres de surco.</p>
            </div>
          ) : (
            <>
              {alertasHoy.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">⚠ Urgente — próximos 3 días</p>
                  <div className="space-y-2">
                    {alertasHoy.map(a => <AlertaCard key={a.id} alerta={a} onCompletar={completarAlerta} onEliminar={eliminarAlerta}/>)}
                  </div>
                </div>
              )}
              {alertasFuturas.length > 0 && (
                <div>
                  {alertasHoy.length > 0 && <p className="text-xs font-bold text-mid uppercase tracking-wider mb-2 mt-4">Próximamente</p>}
                  <div className="space-y-2">
                    {alertasFuturas.map(a => <AlertaCard key={a.id} alerta={a} onCompletar={completarAlerta} onEliminar={eliminarAlerta}/>)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MALEZAS ── */}
      {tab === 'malezas' && (
        <div>
          {/* Filtro productor */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setFiltroProductor('')}
              className={cn('text-xs px-3 py-1.5 rounded border', !filtroProductor ? 'bg-base-5 text-hi border-base-6' : 'bg-base-3 border-base-5 text-lo hover:border-base-6')}>
              Todos
            </button>
            {productores.map(p => (
              <button key={p.id} onClick={() => setFiltroProductor(f => f===p.id?'':p.id)}
                className={cn('text-xs px-3 py-1.5 rounded border transition-all',
                  filtroProductor===p.id ? 'bg-afa/20 border-afa text-afa' : 'bg-base-3 border-base-5 text-lo hover:border-afa')}>
                {p.razon_social}
              </button>
            ))}
          </div>

          {malezasFiltradas.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl mb-3">🌿</p>
              <p className="text-mid">Sin malezas registradas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {malezasFiltradas.map(m => (
                <div key={m.id} className="card p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-hi">{m.nombre}</span>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border capitalize', NIVEL_COLOR[m.nivel])}>
                          {m.nivel}
                        </span>
                        <span className="text-lo text-xs">{fmtFecha(m.fecha_deteccion)}</span>
                      </div>
                      <p className="text-mid text-xs mb-1">
                        {m.lotes?.productores?.razon_social} · {m.lotes?.nombre}
                      </p>
                      {m.tratamientos && <p className="text-lo text-xs">Tratamientos: {m.tratamientos}</p>}
                      {m.observaciones && <p className="text-lo text-xs italic mt-0.5">{m.observaciones}</p>}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => controlarMaleza(m.id)}
                        className="text-xs text-afa hover:text-afa-light border border-afa/30 px-2 py-1 rounded">
                        ✓ Controlada
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Nueva alerta */}
      {showAlerta && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-md card p-6 space-y-4" style={{borderColor:'rgba(245,158,11,0.4)'}}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-hi">Nueva alerta</h2>
              <button onClick={() => setShowAlerta(false)} className="text-lo hover:text-hi text-xl">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Tipo</label>
              <div className="flex gap-2 flex-wrap">
                {TIPOS_ALERTA.map(t => (
                  <button key={t} type="button" onClick={() => setAlertaForm(f=>({...f,tipo:t}))}
                    className={cn('px-3 py-1.5 rounded text-xs font-semibold border transition-all flex items-center gap-1',
                      alertaForm.tipo===t ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}>
                    {TIPO_ICON[t]} {t.replace('_',' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Título *</label>
              <input value={alertaForm.titulo}
                onChange={e => setAlertaForm(f=>({...f,titulo:e.target.value}))}
                className="field" placeholder="Ej: Fungicida en trigo — Giacosa"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productor</label>
                <select value={alertaForm.productor_id}
                  onChange={e => setAlertaForm(f=>({...f,productor_id:e.target.value,lote_id:''}))}
                  className="field">
                  <option value="">— Todos —</option>
                  {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Lote</label>
                <select value={alertaForm.lote_id}
                  onChange={e => setAlertaForm(f=>({...f,lote_id:e.target.value}))}
                  className="field">
                  <option value="">— Opcional —</option>
                  {lotesDelProductor.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha límite</label>
              <input type="date" value={alertaForm.fecha_limite}
                onChange={e => setAlertaForm(f=>({...f,fecha_limite:e.target.value}))}
                className="field"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Descripción</label>
              <textarea rows={2} value={alertaForm.descripcion}
                onChange={e => setAlertaForm(f=>({...f,descripcion:e.target.value}))}
                className="field resize-none" placeholder="Detalles, dosis, condiciones..."/>
            </div>

            <button onClick={guardarAlerta} disabled={savingAlerta || !alertaForm.titulo}
              className="btn-primary w-full">
              {savingAlerta ? 'Guardando…' : 'Guardar alerta'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Nueva maleza */}
      {showMaleza && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-md card p-6 space-y-4" style={{borderColor:'rgba(46,170,110,0.4)'}}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-hi">Registrar maleza</h2>
              <button onClick={() => setShowMaleza(false)} className="text-lo hover:text-hi text-xl">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Lote *</label>
              <select value={malezaForm.lote_id}
                onChange={e => setMalezaForm(f=>({...f,lote_id:e.target.value}))}
                className="field">
                <option value="">— Seleccioná un lote —</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Maleza *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {MALEZAS_COMUNES.map(m => (
                  <button key={m} type="button"
                    onClick={() => setMalezaForm(f=>({...f,nombre:m}))}
                    className={cn('px-3 py-1 rounded text-xs border transition-all',
                      malezaForm.nombre===m ? 'bg-afa text-[#0a0a0a] border-afa' : 'bg-base-3 border-base-5 text-lo hover:border-afa')}>
                    {m}
                  </button>
                ))}
              </div>
              <input value={malezaForm.nombre}
                onChange={e => setMalezaForm(f=>({...f,nombre:e.target.value}))}
                className="field" placeholder="O escribí el nombre..."/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Nivel de infestación</label>
              <div className="flex gap-2">
                {NIVELES.map(n => (
                  <button key={n} type="button"
                    onClick={() => setMalezaForm(f=>({...f,nivel:n}))}
                    className={cn('flex-1 py-2 rounded text-xs font-bold border capitalize transition-all',
                      malezaForm.nivel===n ? NIVEL_COLOR[n]+' border-current' : 'bg-base-3 border-base-5 text-lo')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha detección</label>
                <input type="date" value={malezaForm.fecha_deteccion}
                  onChange={e => setMalezaForm(f=>({...f,fecha_deteccion:e.target.value}))}
                  className="field"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Tratamientos realizados</label>
              <input value={malezaForm.tratamientos}
                onChange={e => setMalezaForm(f=>({...f,tratamientos:e.target.value}))}
                className="field" placeholder="Ej: Cletodim 1.5 l/ha (15/08/2026)"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
              <textarea rows={2} value={malezaForm.observaciones}
                onChange={e => setMalezaForm(f=>({...f,observaciones:e.target.value}))}
                className="field resize-none"/>
            </div>

            <button onClick={guardarMaleza} disabled={savingMaleza || !malezaForm.lote_id || !malezaForm.nombre}
              className="btn-afa w-full">
              {savingMaleza ? 'Guardando…' : 'Registrar maleza'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertaCard({ alerta, onCompletar, onEliminar }: {
  alerta: Alerta;
  onCompletar: (id:string) => void;
  onEliminar: (id:string) => void;
}) {
  const dias = diasRestantes(alerta.fecha_limite);
  const urgente = dias !== null && dias <= 3;
  const vencida = dias !== null && dias < 0;

  return (
    <div className={cn('card p-4 group', urgente ? 'border-red-600/40' : 'border-base-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-lg">{TIPO_ICON[alerta.tipo] ?? '📌'}</span>
            <span className="font-bold text-hi">{alerta.titulo}</span>
            {alerta.fecha_limite && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded',
                vencida ? 'bg-red-950 text-red-400 border border-red-700' :
                urgente ? 'bg-orange-950 text-orange-400 border border-orange-700' :
                'bg-base-4 text-mid border border-base-5')}>
                {vencida ? `Vencida hace ${Math.abs(dias!)} días` :
                 dias === 0 ? 'Hoy' :
                 dias === 1 ? 'Mañana' :
                 `${dias} días`}
              </span>
            )}
          </div>
          {(alerta.productores || alerta.lotes) && (
            <p className="text-lo text-xs mb-1">
              {alerta.productores?.razon_social}{alerta.lotes ? ' · ' + alerta.lotes.nombre : ''}
            </p>
          )}
          {alerta.descripcion && <p className="text-mid text-xs italic">{alerta.descripcion}</p>}
          {alerta.fecha_limite && <p className="text-lo text-[10px] mt-1">Fecha límite: {fmtFecha(alerta.fecha_limite)}</p>}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onCompletar(alerta.id)}
            className="text-xs text-afa hover:text-afa-light border border-afa/30 px-2 py-1 rounded">
            ✓ Hecho
          </button>
          <button onClick={() => onEliminar(alerta.id)}
            className="text-xs text-lo hover:text-red-400 text-base">🗑</button>
        </div>
      </div>
    </div>
  );
}
