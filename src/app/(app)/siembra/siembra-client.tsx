'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampana } from '@/components/layout/app-shell'

type Productor = { id: string; razon_social: string }
type Campana   = { id: string; nombre: string }

type FilaLote = {
  lote_id: string
  nombre: string
  hectareas: number
  cultivo: string
  // campos editables en lotes
  variedad: string
  fecha_siembra: string
  // fertilización de siembra (tabla fertilizaciones, momento='siembra')
  ferti_id: string | null
  ferti_productos: string
  ferti_fecha: string
  // estado guardado
  sucio: boolean
  guardando: boolean
  ok: boolean
}

const CULTIVOS = ['Soja 1°','Soja 2°','Maíz','Trigo','Cebada','Sorgo','Girasol','Otro']

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

  const [campanaId, setCampanaId]           = useState(() => campanas[0]?.id ?? '')
  const [productorId, setProductorId]       = useState(productores[0]?.id ?? '')
  const [cultivoFiltro, setCultivoFiltro]   = useState('todos')
  const [filas, setFilas]                   = useState<FilaLote[]>([])
  const [cargando, setCargando]             = useState(false)
  const [guardandoTodo, setGuardandoTodo]   = useState(false)

  useEffect(() => {
    if (campanaCtxId && campanaCtxId !== campanaId) setCampanaId(campanaCtxId)
  }, [campanaCtxId])

  useEffect(() => {
    if (campanaId && productorId) cargar()
  }, [campanaId, productorId])

  async function cargar() {
    setCargando(true)
    try {
      // Lotes del productor en esta campaña
      const { data: lotes } = await (sb as any)
        .from('lotes')
        .select('id, nombre, hectareas, cultivo, variedad, fecha_siembra')
        .eq('campana_id', campanaId)
        .eq('productor_id', productorId)
        .order('nombre')

      if (!lotes || lotes.length === 0) { setFilas([]); return }

      const loteIds = lotes.map((l: any) => l.id)

      // Fertilizaciones de siembra de esos lotes
      const { data: fertis } = await (sb as any)
        .from('fertilizaciones')
        .select('id, lote_id, fecha, productos')
        .in('lote_id', loteIds)
        .eq('momento', 'siembra')
        .order('fecha', { ascending: false })

      // Mapa lote → primera ferti de siembra
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

  // Actualizar campo de una fila
  function setFila(loteId: string, campo: Partial<FilaLote>) {
    setFilas(fs => fs.map(f =>
      f.lote_id === loteId ? { ...f, ...campo, sucio: true, ok: false } : f
    ))
  }

  // Guardar una fila individual
  async function guardarFila(loteId: string) {
    const fila = filas.find(f => f.lote_id === loteId)
    if (!fila) return

    setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, guardando: true } : f))

    try {
      // 1. Actualizar lote
      await (sb as any).from('lotes').update({
        variedad: fila.variedad || null,
        fecha_siembra: fila.fecha_siembra || null,
      }).eq('id', loteId)

      // 2. Fertilización de siembra
      if (fila.ferti_productos.trim()) {
        if (fila.ferti_id) {
          // Actualizar existente
          await (sb as any).from('fertilizaciones').update({
            productos: fila.ferti_productos.trim(),
            fecha: fila.ferti_fecha || fila.fecha_siembra || new Date().toISOString().slice(0, 10),
          }).eq('id', fila.ferti_id)
        } else {
          // Insertar nueva
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
        // Borrar si quedó vacío
        await (sb as any).from('fertilizaciones').delete().eq('id', fila.ferti_id)
        setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, ferti_id: null } : f))
      }

      setFilas(fs => fs.map(f =>
        f.lote_id === loteId ? { ...f, guardando: false, sucio: false, ok: true } : f
      ))
      // Quitar ✓ después de 2s
      setTimeout(() => setFilas(fs => fs.map(f =>
        f.lote_id === loteId ? { ...f, ok: false } : f
      )), 2000)

    } catch {
      setFilas(fs => fs.map(f => f.lote_id === loteId ? { ...f, guardando: false } : f))
    }
  }

  // Guardar todos los que están sucios
  async function guardarTodo() {
    setGuardandoTodo(true)
    const sucios = filas.filter(f => f.sucio)
    await Promise.all(sucios.map(f => guardarFila(f.lote_id)))
    setGuardandoTodo(false)
  }

  const cultivosUnicos = [...new Set(filas.map(f => f.cultivo).filter(Boolean))].sort()
  const filasFiltradas = cultivoFiltro === 'todos' ? filas : filas.filter(f => f.cultivo === cultivoFiltro)

  const haysucios = filas.some(f => f.sucio)
  const completos = filasFiltradas.filter(f => f.fecha_siembra && f.variedad).length
  const sinDatos  = filasFiltradas.filter(f => !f.fecha_siembra && !f.variedad).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="label-xs text-ochre">SIEMBRA</p>
          <h1 className="text-2xl font-black text-hi">Carga de siembra</h1>
          <p className="text-mid text-sm">Fecha · Variedad/Híbrido · Fertilización de arranque</p>
        </div>
        {haysucios && (
          <button
            onClick={guardarTodo}
            disabled={guardandoTodo}
            className="btn-primary text-sm px-5"
          >
            {guardandoTodo ? 'Guardando...' : `💾 Guardar todo (${filas.filter(f => f.sucio).length})`}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label-xs text-hi font-bold block mb-1">CAMPAÑA</label>
          <select value={campanaId} onChange={e => setCampanaId(e.target.value)} className="field text-sm">
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs text-hi font-bold block mb-1">PRODUCTOR</label>
          <select value={productorId} onChange={e => setProductorId(e.target.value)} className="field text-sm">
            {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs text-hi font-bold block mb-1">CULTIVO</label>
          <select value={cultivoFiltro} onChange={e => setCultivoFiltro(e.target.value)} className="field text-sm">
            <option value="todos">Todos</option>
            {cultivosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Stats */}
        {!cargando && filasFiltradas.length > 0 && (
          <div className="ml-auto flex gap-4 text-right">
            <div>
              <p className="text-hi font-black text-lg">{filasFiltradas.length}</p>
              <p className="text-lo text-xs">lotes</p>
            </div>
            <div>
              <p className="text-green-400 font-black text-lg">{completos}</p>
              <p className="text-lo text-xs">completos</p>
            </div>
            {sinDatos > 0 && (
              <div>
                <p className="text-red-400 font-black text-lg">{sinDatos}</p>
                <p className="text-lo text-xs">sin datos</p>
              </div>
            )}
          </div>
        )}
      </div>

      {cargando && (
        <div className="card p-10 text-center text-mid">Cargando lotes...</div>
      )}

      {!cargando && filasFiltradas.length === 0 && (
        <div className="card p-10 text-center text-mid">
          <p className="text-3xl mb-2">🌱</p>
          <p className="font-bold text-hi">Sin lotes para este productor en esta campaña</p>
        </div>
      )}

      {/* PLANILLA */}
      {!cargando && filasFiltradas.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-base-5">
                <th className="text-left py-2.5 px-3 text-hi text-[11px] font-bold uppercase tracking-wider w-[160px]">Lote</th>
                <th className="text-center py-2.5 px-2 text-hi text-[11px] font-bold uppercase tracking-wider w-10">Ha</th>
                <th className="text-left py-2.5 px-3 text-hi text-[11px] font-bold uppercase tracking-wider w-[130px]">F. Siembra</th>
                <th className="text-left py-2.5 px-3 text-hi text-[11px] font-bold uppercase tracking-wider">Variedad / Híbrido</th>
                <th className="text-left py-2.5 px-3 text-hi text-[11px] font-bold uppercase tracking-wider">Fertilización arranque</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((fila, li) => {
                const cc = cultColor(fila.cultivo)
                const rowBg = li % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                const tieneData = fila.fecha_siembra || fila.variedad
                return (
                  <tr
                    key={fila.lote_id}
                    className="border-b border-base-5/30 group"
                    style={{ background: rowBg }}
                  >
                    {/* Lote */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: cc, color: '#000' }}
                        >
                          {cultAbrev(fila.cultivo)}
                        </span>
                        <div>
                          <p className="text-hi font-bold text-xs leading-tight">{fila.nombre}</p>
                          {!tieneData && (
                            <p className="text-[9px] text-red-400 font-semibold">sin datos</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Ha */}
                    <td className="text-center py-2 px-2 text-lo text-xs">{fila.hectareas}</td>

                    {/* Fecha siembra */}
                    <td className="py-1.5 px-2">
                      <input
                        type="date"
                        value={fila.fecha_siembra}
                        onChange={e => setFila(fila.lote_id, { fecha_siembra: e.target.value })}
                        className="field text-xs w-full"
                        style={{ minWidth: '120px' }}
                      />
                    </td>

                    {/* Variedad */}
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={fila.variedad}
                        onChange={e => setFila(fila.lote_id, { variedad: e.target.value })}
                        placeholder="Ej: DM 4670, NK Iudex..."
                        className="field text-xs w-full"
                      />
                    </td>

                    {/* Fertilización */}
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={fila.ferti_productos}
                        onChange={e => setFila(fila.lote_id, { ferti_productos: e.target.value })}
                        placeholder="Ej: 100 kg MAP + 50 kg Urea"
                        className="field text-xs w-full"
                      />
                    </td>

                    {/* Acción */}
                    <td className="py-1.5 px-2 text-center">
                      {fila.guardando ? (
                        <span className="text-lo text-xs">⏳</span>
                      ) : fila.ok ? (
                        <span className="text-green-400 text-sm font-black">✓</span>
                      ) : fila.sucio ? (
                        <button
                          onClick={() => guardarFila(fila.lote_id)}
                          className="text-[11px] font-bold text-ochre hover:text-hi transition-colors px-2 py-1 rounded hover:bg-base-4"
                        >
                          Guardar
                        </button>
                      ) : (
                        <span className="text-base-5 text-xs opacity-0 group-hover:opacity-100">·</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Botón guardar todo al pie si hay cambios */}
      {haysucios && filas.length > 3 && (
        <div className="flex justify-end">
          <button
            onClick={guardarTodo}
            disabled={guardandoTodo}
            className="btn-primary text-sm px-5"
          >
            {guardandoTodo ? 'Guardando...' : `💾 Guardar todo (${filas.filter(f => f.sucio).length})`}
          </button>
        </div>
      )}
    </div>
  )
}
