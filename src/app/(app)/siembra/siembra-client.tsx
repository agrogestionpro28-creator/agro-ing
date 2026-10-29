'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCampana } from '@/components/layout/app-shell'

type Productor = { id: string; razon_social: string }
type Campana   = { id: string; nombre: string }

type FilaLote = {
  lote_id: string
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

function cultColor(c: string) {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja')) return '#22c55e'
  if (s.includes('maíz') || s.includes('maiz')) return '#f59e0b'
  if (s.includes('trigo') || s.includes('cebada')) return '#d97706'
  if (s.includes('sorgo')) return '#ef4444'
  if (s.includes('girasol')) return '#eab308'
  return '#6b7280'
}
function cultAbrev(c: string) {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja 2')) return 'S2°'
  if (s.includes('soja')) return 'SOJ'
  if (s.includes('maíz') || s.includes('maiz')) return 'MAZ'
  if (s.includes('trigo')) return 'TRI'
  if (s.includes('cebada')) return 'CEB'
  if (s.includes('sorgo')) return 'SOR'
  if (s.includes('girasol')) return 'GIR'
  return c?.slice(0, 3).toUpperCase() ?? '---'
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

  const [campanaId, setCampanaIdState]         = useState(() => searchParams.get('campana') || campanas[0]?.id || '')
  const [productorId, setProductorIdState]     = useState(() => searchParams.get('productor') || productores[0]?.id || '')
  const [cultivoFiltro, setCultivoFiltroState] = useState(() => searchParams.get('cultivo') || 'todos')
  const [filas, setFilas]                      = useState<FilaLote[]>([])
  const [cargando, setCargando]                = useState(false)
  const [guardandoTodo, setGuardandoTodo]      = useState(false)

  function syncUrl(campana: string, productor: string, cultivo: string) {
    const params = new URLSearchParams()
    if (campana) params.set('campana', campana)
    if (productor) params.set('productor', productor)
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
    if (campanaId && productorId) cargar()
  }, [campanaId, productorId])

  async function cargar() {
    setCargando(true)
    try {
      const { data: lotes } = await (sb as any)
        .from('lotes')
        .select('id, nombre, hectareas, cultivo, variedad, fecha_siembra')
        .eq('campana_id', campanaId)
        .eq('productor_id', productorId)
        .order('nombre')

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

      setFilas(lotes.map((l: any) => ({
        lote_id: l.id,
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

  const cultivosUnicos = [...new Set(filas.map(f => f.cultivo).filter(Boolean))].sort()
  const filasFiltradas = cultivoFiltro === 'todos' ? filas : filas.filter(f => f.cultivo === cultivoFiltro)
  const haysucios  = filas.some(f => f.sucio)
  const completos  = filasFiltradas.filter(f => f.fecha_siembra && f.variedad).length
  const sinDatos   = filasFiltradas.filter(f => !f.fecha_siembra && !f.variedad).length
  const productorActual = productores.find(p => p.id === productorId)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-0.5">Siembra</p>
          <h1 className="text-2xl font-black text-hi tracking-tight">Carga de Siembra</h1>
          <p className="text-lo text-sm mt-0.5">Fecha · Variedad o Híbrido · Fertilización de arranque</p>
        </div>
        {haysucios && (
          <button
            onClick={guardarTodo}
            disabled={guardandoTodo}
            className="btn-primary"
          >
            {guardandoTodo
              ? <><span className="animate-spin inline-block">⏳</span> Guardando...</>
              : <>💾 Guardar todo <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-black">{filas.filter(f => f.sucio).length}</span></>
            }
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-[#111] border border-base-4 rounded-xl p-3 flex flex-wrap gap-3 items-end">
        <div className="filter-group">
          <label className="filter-label">Campaña</label>
          <select value={campanaId} onChange={e => setCampanaId(e.target.value)} className="field py-1.5 text-sm min-w-[130px]">
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Productor</label>
          <select value={productorId} onChange={e => setProductorId(e.target.value)} className="field py-1.5 text-sm min-w-[180px]">
            {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
        </div>
        {cultivosUnicos.length > 1 && (
          <div className="filter-group">
            <label className="filter-label">Cultivo</label>
            <select value={cultivoFiltro} onChange={e => setCultivoFiltro(e.target.value)} className="field py-1.5 text-sm min-w-[130px]">
              <option value="todos">Todos</option>
              {cultivosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Stats inline */}
        {!cargando && filasFiltradas.length > 0 && (
          <div className="ml-auto flex items-center gap-4">
            <div className="text-center">
              <p className="text-hi font-black text-xl tabular-nums leading-none">{filasFiltradas.length}</p>
              <p className="text-lo text-[10px] uppercase tracking-wide">lotes</p>
            </div>
            <div className="w-px h-8 bg-base-5" />
            <div className="text-center">
              <p className="text-afa font-black text-xl tabular-nums leading-none">{completos}</p>
              <p className="text-lo text-[10px] uppercase tracking-wide">completos</p>
            </div>
            {sinDatos > 0 && (
              <>
                <div className="w-px h-8 bg-base-5" />
                <div className="text-center">
                  <p className="text-red-400 font-black text-xl tabular-nums leading-none">{sinDatos}</p>
                  <p className="text-lo text-[10px] uppercase tracking-wide">pendientes</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Progreso visual si hay datos */}
      {!cargando && filasFiltradas.length > 0 && (
        <div className="h-1.5 bg-base-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-afa to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${filasFiltradas.length ? (completos / filasFiltradas.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Estado carga */}
      {cargando && (
        <div className="card p-12 text-center space-y-2">
          <div className="text-3xl animate-pulse">🌱</div>
          <p className="text-lo text-sm">Cargando lotes...</p>
        </div>
      )}

      {!cargando && filasFiltradas.length === 0 && (
        <div className="card p-12 text-center space-y-2">
          <p className="text-4xl">🌾</p>
          <p className="font-bold text-hi">Sin lotes para este productor</p>
          <p className="text-lo text-sm">Seleccioná otro productor o campaña</p>
        </div>
      )}

      {/* PLANILLA */}
      {!cargando && filasFiltradas.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-base-5">
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-mid bg-[#0f0f0f] w-[170px]">
                  Lote
                </th>
                <th className="text-center py-3 px-2 text-[10px] font-bold uppercase tracking-wider text-mid bg-[#0f0f0f] w-12">
                  Ha
                </th>
                <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-[#0f0f0f] w-[140px]">
                  Fecha siembra
                </th>
                <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-[#0f0f0f]">
                  Variedad / Híbrido
                </th>
                <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-[#0f0f0f]">
                  Fertilización arranque
                </th>
                <th className="bg-[#0f0f0f] w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-base-4/40">
              {filasFiltradas.map((fila) => {
                const cc = cultColor(fila.cultivo)
                const tieneData = fila.fecha_siembra || fila.variedad

                return (
                  <tr
                    key={fila.lote_id}
                    className={`
                      group transition-colors
                      ${fila.ok ? 'bg-afa/5' : ''}
                      ${fila.sucio && !fila.ok ? 'bg-ochre/4' : ''}
                      hover:bg-base-3/40
                    `}
                  >
                    {/* Lote */}
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: cc, color: '#000' }}
                        >
                          {cultAbrev(fila.cultivo)}
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
                    <td className="text-center py-2 px-2 text-mid text-xs font-mono">
                      {fila.hectareas}
                    </td>

                    {/* Fecha siembra */}
                    <td className="py-1.5 px-2">
                      <input
                        type="date"
                        value={fila.fecha_siembra}
                        onChange={e => setFila(fila.lote_id, { fecha_siembra: e.target.value })}
                        className="field py-1.5 text-xs"
                        style={{ minWidth: '128px' }}
                      />
                    </td>

                    {/* Variedad */}
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={fila.variedad}
                        onChange={e => setFila(fila.lote_id, { variedad: e.target.value })}
                        placeholder="Ej: DM 4670, NK Iudex..."
                        className="field py-1.5 text-xs"
                      />
                    </td>

                    {/* Fertilización */}
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={fila.ferti_productos}
                        onChange={e => setFila(fila.lote_id, { ferti_productos: e.target.value })}
                        placeholder="Ej: 100 kg MAP + 50 kg Urea"
                        className="field py-1.5 text-xs"
                      />
                    </td>

                    {/* Estado / Acción */}
                    <td className="py-1.5 px-3 text-center">
                      {fila.guardando ? (
                        <span className="text-lo text-xs animate-pulse">guardando</span>
                      ) : fila.ok ? (
                        <span className="inline-flex items-center gap-1 text-afa text-xs font-bold">
                          <span className="text-sm">✓</span> Guardado
                        </span>
                      ) : fila.sucio ? (
                        <button
                          onClick={() => guardarFila(fila.lote_id)}
                          className="text-xs font-bold text-ochre hover:text-hi bg-ochre/10 hover:bg-ochre/20 px-2.5 py-1 rounded-lg transition-all"
                        >
                          Guardar
                        </button>
                      ) : (
                        <span className="text-base-5 text-xs opacity-0 group-hover:opacity-40 transition-opacity">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Guardar todo al pie */}
      {haysucios && filasFiltradas.length > 4 && (
        <div className="flex justify-end">
          <button
            onClick={guardarTodo}
            disabled={guardandoTodo}
            className="btn-primary"
          >
            {guardandoTodo
              ? 'Guardando...'
              : `💾 Guardar todo (${filas.filter(f => f.sucio).length} cambios)`
            }
          </button>
        </div>
      )}
    </div>
  )
}
