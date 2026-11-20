'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCampana } from '@/components/layout/app-shell'

type Productor = { id: string; razon_social: string }
type Campana   = { id: string; nombre: string }

type FilaLote = {
  lote_id: string
  productor_id: string
  productor_nombre: string
  nombre: string
  hectareas: number
  cultivo: string
  variedad: string
  fecha_siembra: string
  ferti_id: string | null
  ferti_productos: string
  ferti_fecha: string
  sucio: boolean
  guardando: boolean
  ok: boolean
}

const CULT_STYLE: Record<string, { strip: string; badge: string; text: string }> = {
  'Soja':    { strip: '#22c55e', badge: '#f0fdf4', text: '#15803d' },
  'Soja 2°': { strip: '#34d399', badge: '#ecfdf5', text: '#047857' },
  'Maíz':    { strip: '#facc15', badge: '#fefce8', text: '#a16207' },
  'Trigo':   { strip: '#f59e0b', badge: '#fffbeb', text: '#b45309' },
  'Cebada':  { strip: '#fbbf24', badge: '#fef3c7', text: '#92400e' },
  'Sorgo':   { strip: '#f97316', badge: '#fff7ed', text: '#c2410c' },
  'Girasol': { strip: '#38bdf8', badge: '#f0f9ff', text: '#0369a1' },
}
const DEFAULT_STYLE = { strip: '#94a3b8', badge: '#f8fafc', text: '#64748b' }
function cultStyle(c: string) {
  for (const [k, v] of Object.entries(CULT_STYLE)) if (c.startsWith(k) || k.startsWith(c)) return v
  return DEFAULT_STYLE
}

export function SiembraClient({ productores, campanas }: {
  productores: Productor[]
  campanas: Campana[]
}) {
  const sb = createClient()
  const { campanaId: campanaCtxId } = useCampana()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const TODOS = '__todos__'

  const [campanaId, setCampanaIdState]         = useState(() => searchParams.get('campana') || campanas[0]?.id || '')
  const [productorId, setProductorIdState]     = useState(() => searchParams.get('productor') || TODOS)
  const [cultivoFiltro, setCultivoFiltroState] = useState(() => searchParams.get('cultivo') || 'todos')
  const [filas, setFilas]                      = useState<FilaLote[]>([])
  const [cargando, setCargando]                = useState(false)
  const [guardandoTodo, setGuardandoTodo]      = useState(false)

  function syncUrl(campana: string, productor: string, cultivo: string) {
    const params = new URLSearchParams()
    if (campana) params.set('campana', campana)
    if (productor && productor !== TODOS) params.set('productor', productor)
    if (cultivo && cultivo !== 'todos') params.set('cultivo', cultivo)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function setCampanaId(v: string)     { setCampanaIdState(v);     syncUrl(v, productorId, cultivoFiltro) }
  function setProductorId(v: string)   { setProductorIdState(v);   syncUrl(campanaId, v, cultivoFiltro) }
  function setCultivoFiltro(v: string) { setCultivoFiltroState(v); syncUrl(campanaId, productorId, v) }

  useEffect(() => {
    if (campanaCtxId && campanaCtxId !== campanaId) setCampanaId(campanaCtxId)
  }, [campanaCtxId])

  useEffect(() => {
    if (campanaId) cargar()
  }, [campanaId, productorId])

  async function cargar() {
    setCargando(true)
    try {
      // Construir query según si es todos o uno específico
      let query = (sb as any)
        .from('lotes')
        .select('id, nombre, hectareas, cultivo, variedad, fecha_siembra, productor_id')
        .eq('campana_id', campanaId)
        .order('nombre')

      if (productorId !== TODOS) {
        query = query.eq('productor_id', productorId)
      }

      const { data: lotes } = await query

      if (!lotes || lotes.length === 0) { setFilas([]); return }

      const loteIds = lotes.map((l: any) => l.id)
      const { data: fertis } = await (sb as any)
        .from('fertilizaciones')
        .select('id, lote_id, fecha, productos')
        .in('lote_id', loteIds)
        .eq('momento', 'siembra')
        .order('fecha', { ascending: false })

      const fertiMap: Record<string, any> = {}
      ;(fertis ?? []).forEach((f: any) => {
        if (!fertiMap[f.lote_id]) fertiMap[f.lote_id] = f
      })

      // Mapear productor_id a nombre
      const prodMap: Record<string, string> = {}
      productores.forEach(p => { prodMap[p.id] = p.razon_social })

      setFilas(lotes.map((l: any) => ({
        lote_id: l.id,
        productor_id: l.productor_id,
        productor_nombre: prodMap[l.productor_id] ?? '—',
        nombre: l.nombre,
        hectareas: l.hectareas ?? 0,
        cultivo: l.cultivo ?? '',
        variedad: l.variedad ?? '',
        fecha_siembra: l.fecha_siembra ?? '',
        ferti_id: fertiMap[l.id]?.id ?? null,
        ferti_productos: fertiMap[l.id]?.productos ?? '',
        ferti_fecha: fertiMap[l.id]?.fecha ?? '',
        sucio: false,
        guardando: false,
        ok: false,
      })))
    } finally {
      setCargando(false)
    }
  }

  function setFila(loteId: string, campo: Partial<FilaLote>) {
    setFilas(fs => fs.map(f =>
      f.lote_id === loteId ? { ...f, ...campo, sucio: true, ok: false } : f
    ))
  }

  async function guardarFila(loteId: string) {
    const fila = filas.find(f => f.lote_id === loteId)
    if (!fila) return
    setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, guardando: true } : f))
    try {
      await (sb as any).from('lotes').update({
        variedad: fila.variedad || null,
        fecha_siembra: fila.fecha_siembra || null,
      }).eq('id', loteId)

      if (fila.ferti_productos.trim()) {
        if (fila.ferti_id) {
          await (sb as any).from('fertilizaciones').update({
            productos: fila.ferti_productos.trim(),
            fecha: fila.ferti_fecha || fila.fecha_siembra || new Date().toISOString().slice(0, 10),
          }).eq('id', fila.ferti_id)
        } else {
          const { data: nuevo } = await (sb as any).from('fertilizaciones').insert({
            lote_id: loteId,
            momento: 'siembra',
            productos: fila.ferti_productos.trim(),
            fecha: fila.ferti_fecha || fila.fecha_siembra || new Date().toISOString().slice(0, 10),
          }).select('id').single()
          if (nuevo?.id) {
            setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, ferti_id: nuevo.id } : f))
          }
        }
      } else if (fila.ferti_id) {
        await (sb as any).from('fertilizaciones').delete().eq('id', fila.ferti_id)
        setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, ferti_id: null } : f))
      }

      setFilas(fs => fs.map(f =>
        f.lote_id === loteId ? { ...f, guardando: false, sucio: false, ok: true } : f
      ))
      setTimeout(() => setFilas(fs => fs.map(f =>
        f.lote_id === loteId ? { ...f, ok: false } : f
      )), 2000)
    } catch {
      setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, guardando: false } : f))
    }
  }

  async function guardarTodo() {
    setGuardandoTodo(true)
    await Promise.all(filas.filter(f => f.sucio).map(f => guardarFila(f.lote_id)))
    setGuardandoTodo(false)
  }

  const cultivosUnicos = useMemo(
    () => [...new Set(filas.map(f => f.cultivo).filter(Boolean))].sort(),
    [filas]
  )

  const filasFiltradas = useMemo(() => {
    let fs = filas
    if (cultivoFiltro !== 'todos') fs = fs.filter(f => f.cultivo === cultivoFiltro)
    return fs
  }, [filas, cultivoFiltro])

  const haysucios  = filas.some(f => f.sucio)
  const completos  = filasFiltradas.filter(f => f.fecha_siembra && f.variedad).length
  const pendientes = filasFiltradas.filter(f => !f.fecha_siembra).length
  const totalHa    = filasFiltradas.reduce((s, f) => s + f.hectareas, 0)

  // Para vista "todos": agrupar por productor para sección visual
  const filasPorProductor = useMemo(() => {
    if (productorId !== TODOS) return null
    const grupos: Record<string, FilaLote[]> = {}
    for (const f of filasFiltradas) {
      if (!grupos[f.productor_id]) grupos[f.productor_id] = []
      grupos[f.productor_id].push(f)
    }
    return Object.entries(grupos).map(([pid, fs]) => ({
      productor_id: pid,
      productor_nombre: fs[0]?.productor_nombre ?? '—',
      filas: fs,
    }))
  }, [filasFiltradas, productorId])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-0.5">Siembra</p>
          <h1 className="text-2xl font-black text-hi tracking-tight">Carga de Siembra</h1>
          <p className="text-lo text-sm mt-0.5">Fecha · Variedad o Híbrido · Fertilización de arranque</p>
        </div>
        {haysucios && (
          <button onClick={guardarTodo} disabled={guardandoTodo} className="btn-primary">
            {guardandoTodo
              ? <><span className="animate-spin inline-block">⏳</span> Guardando...</>
              : <>💾 Guardar todo <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-black">{filas.filter(f => f.sucio).length}</span></>
            }
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Campaña */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-mid">Campaña</label>
            <select value={campanaId} onChange={e => setCampanaId(e.target.value)} className="field py-1.5 text-sm min-w-[130px]">
              {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Productor con opción Todos */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-mid">Productor</label>
            <select value={productorId} onChange={e => setProductorId(e.target.value)} className="field py-1.5 text-sm min-w-[200px]">
              <option value={TODOS}>Todos los productores</option>
              {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>

          {/* Cultivo — siempre visible */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-mid">Cultivo</label>
            <select value={cultivoFiltro} onChange={e => setCultivoFiltro(e.target.value)} className="field py-1.5 text-sm min-w-[150px]">
              <option value="todos">Todos los cultivos</option>
              {cultivosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

        </div>
      </div>

      {/* KPIs — solo con datos */}
      {!cargando && filasFiltradas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { val: filasFiltradas.length, label: 'Lotes', accent: '#475569' },
            { val: totalHa > 0 ? totalHa.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—', label: 'Hectáreas', accent: '#0284c7' },
            { val: completos, label: 'Completos', accent: '#0ea87a' },
            { val: pendientes > 0 ? pendientes : '✓', label: pendientes > 0 ? 'Sin fecha' : 'Al día', accent: pendientes > 0 ? '#ef4444' : '#0ea87a' },
          ].map(({ val, label, accent }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 relative overflow-hidden shadow-sm">
              <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: accent }} />
              <p className="text-3xl font-black tabular-nums" style={{ color: accent }}>{val}</p>
              <p className="text-xs font-bold mt-1 text-mid uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Barra progreso */}
      {!cargando && filasFiltradas.length > 0 && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-afa to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${filasFiltradas.length ? (completos / filasFiltradas.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Estado carga */}
      {cargando && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2 shadow-sm">
          <div className="text-3xl animate-pulse">🌱</div>
          <p className="text-mid text-sm">Cargando lotes...</p>
        </div>
      )}

      {!cargando && filasFiltradas.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2 shadow-sm">
          <p className="text-4xl">🌾</p>
          <p className="font-bold text-hi">Sin lotes para esta selección</p>
          <p className="text-mid text-sm">Probá con otro productor, campaña o cultivo</p>
        </div>
      )}

      {/* TABLA — un productor */}
      {!cargando && productorId !== TODOS && filasFiltradas.length > 0 && (
        <TablaEditable filas={filasFiltradas} mostrarProductor={false} onSetFila={setFila} onGuardar={guardarFila} />
      )}

      {/* TABLA — todos los productores (agrupada) */}
      {!cargando && productorId === TODOS && filasPorProductor && filasPorProductor.length > 0 && (
        <div className="space-y-4">
          {filasPorProductor.map(grupo => (
            <div key={grupo.productor_id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Header del grupo */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <h3 className="font-black text-sm text-hi">{grupo.productor_nombre}</h3>
                <span className="text-xs text-mid ml-auto">
                  {grupo.filas.length} lotes · {grupo.filas.reduce((s, f) => s + f.hectareas, 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ha
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{
                  background: grupo.filas.filter(f => f.fecha_siembra && f.variedad).length === grupo.filas.length ? '#f0fdf4' : '#fff7ed',
                  color: grupo.filas.filter(f => f.fecha_siembra && f.variedad).length === grupo.filas.length ? '#15803d' : '#b45309',
                }}>
                  {grupo.filas.filter(f => f.fecha_siembra && f.variedad).length}/{grupo.filas.length} completos
                </span>
              </div>
              <TablaEditable filas={grupo.filas} mostrarProductor={false} onSetFila={setFila} onGuardar={guardarFila} />
            </div>
          ))}
        </div>
      )}

      {/* Guardar todo al pie */}
      {haysucios && filasFiltradas.length > 4 && (
        <div className="flex justify-end">
          <button onClick={guardarTodo} disabled={guardandoTodo} className="btn-primary">
            {guardandoTodo ? 'Guardando...' : `💾 Guardar todo (${filas.filter(f => f.sucio).length} cambios)`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tabla editable reutilizable ───────────────────────────
function TablaEditable({
  filas, mostrarProductor, onSetFila, onGuardar
}: {
  filas: FilaLote[]
  mostrarProductor: boolean
  onSetFila: (loteId: string, campo: Partial<FilaLote>) => void
  onGuardar: (loteId: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-100">
            {mostrarProductor && (
              <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80">Productor</th>
            )}
            <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-[170px]">Lote</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-12">Ha</th>
            <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-[140px]">Fecha siembra</th>
            <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80">Variedad / Híbrido</th>
            <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80">Fertilización arranque</th>
            <th className="bg-slate-50/80 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((fila) => {
            const cs = cultStyle(fila.cultivo)
            const tieneData = fila.fecha_siembra || fila.variedad

            return (
              <tr
                key={fila.lote_id}
                className={`
                  group transition-colors
                  ${fila.ok ? 'bg-green-50/60' : ''}
                  ${fila.sucio && !fila.ok ? 'bg-amber-50/60' : ''}
                  hover:bg-slate-50/80
                `}
              >
                {mostrarProductor && (
                  <td className="py-2 px-4 text-xs text-mid font-semibold">{fila.productor_nombre}</td>
                )}

                {/* Lote */}
                <td className="py-2 px-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: cs.strip, color: '#fff' }}
                    >
                      {fila.cultivo?.slice(0, 3).toUpperCase() || '---'}
                    </span>
                    <div>
                      <p className="text-hi font-semibold text-xs leading-tight">{fila.nombre}</p>
                      {!tieneData && (
                        <p className="text-[9px] text-red-400 font-bold">sin datos</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Ha */}
                <td className="text-center py-2 px-2 text-mid text-xs font-mono">{fila.hectareas}</td>

                {/* Fecha siembra */}
                <td className="py-1.5 px-2">
                  <input
                    type="date"
                    value={fila.fecha_siembra}
                    onChange={e => onSetFila(fila.lote_id, { fecha_siembra: e.target.value })}
                    className="field py-1.5 text-xs"
                    style={{ minWidth: '128px' }}
                  />
                </td>

                {/* Variedad */}
                <td className="py-1.5 px-2">
                  <input
                    type="text"
                    value={fila.variedad}
                    onChange={e => onSetFila(fila.lote_id, { variedad: e.target.value })}
                    placeholder="Ej: DM 4670, NK Iudex..."
                    className="field py-1.5 text-xs"
                  />
                </td>

                {/* Fertilización */}
                <td className="py-1.5 px-2">
                  <input
                    type="text"
                    value={fila.ferti_productos}
                    onChange={e => onSetFila(fila.lote_id, { ferti_productos: e.target.value })}
                    placeholder="Ej: 100 kg MAP + 50 kg Urea"
                    className="field py-1.5 text-xs"
                  />
                </td>

                {/* Estado / Acción */}
                <td className="py-1.5 px-3 text-center">
                  {fila.guardando ? (
                    <span className="text-mid text-xs animate-pulse">guardando</span>
                  ) : fila.ok ? (
                    <span className="inline-flex items-center gap-1 text-afa text-xs font-bold">
                      <span className="text-sm">✓</span> Guardado
                    </span>
                  ) : fila.sucio ? (
                    <button
                      onClick={() => onGuardar(fila.lote_id)}
                      className="text-xs font-bold text-amber-600 hover:text-hi bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-all border border-amber-200"
                    >
                      Guardar
                    </button>
                  ) : (
                    <span className="text-slate-300 text-xs opacity-0 group-hover:opacity-60 transition-opacity">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
