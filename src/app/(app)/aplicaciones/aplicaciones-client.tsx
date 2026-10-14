'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampana } from '@/components/layout/app-shell'

type Productor = { id: string; razon_social: string }
type Campana   = { id: string; nombre: string }

type Aplicacion = {
  id: string
  lote_id: string
  lote_nombre: string
  lote_hectareas: number
  lote_cultivo: string
  productor_id: string
  productor_nombre: string
  fecha: string
  estado: string
  aplicacion: string   // texto libre: "2 lt Glifo + ..."
  semana: number
}

function fmtFecha(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function semanaDeIso(iso: string) {
  const fecha = new Date(iso + 'T12:00:00')
  const oneJan = new Date(fecha.getFullYear(), 0, 1)
  const diff = fecha.getTime() - oneJan.getTime()
  return Math.ceil((diff / 86400000 + oneJan.getDay() + 1) / 7)
}

function cultColorFor(c: string) {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja')) return '#22c55e'
  if (s.includes('maíz') || s.includes('maiz')) return '#f59e0b'
  if (s.includes('trigo') || s.includes('cebada')) return '#d97706'
  if (s.includes('sorgo')) return '#ef4444'
  if (s.includes('girasol')) return '#eab308'
  return '#6b7280'
}

function abrevCult(c: string) {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja 2')) return 'S2°'
  if (s.includes('soja')) return 'SOJ'
  if (s.includes('maíz') || s.includes('maiz')) return 'MAI'
  if (s.includes('trigo')) return 'TRI'
  if (s.includes('cebada')) return 'CEB'
  if (s.includes('sorgo')) return 'SOR'
  if (s.includes('girasol')) return 'GIR'
  return c?.slice(0, 3).toUpperCase() ?? '---'
}

export function AplicacionesClient({
  productores, campanas,
}: {
  productores: Productor[]
  campanas: Campana[]
}) {
  const sb = createClient()
  const { campanaId: campanaCtxId } = useCampana()

  const [campanaId, setCampanaId] = useState(() => campanas[0]?.id ?? '')
  const [productorFiltro, setProductorFiltro] = useState('todos')
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [agrupacion, setAgrupacion] = useState<'productor' | 'cultivo'>('productor')

  useEffect(() => {
    if (campanaCtxId && campanaCtxId !== campanaId) setCampanaId(campanaCtxId)
  }, [campanaCtxId])

  useEffect(() => {
    if (!campanaId) return
    cargar()
  }, [campanaId])

  async function cargar() {
    setCargando(true)
    try {
      // Traer observaciones tipo informe_semanal con aplicación cargada
      // JOIN con lotes y productores via lote_id
      const { data: obs } = await (sb as any)
        .from('observaciones_lote')
        .select(`
          id,
          fecha,
          datos_extra,
          lotes!inner (
            id,
            nombre,
            hectareas,
            cultivo,
            campana_id,
            productor_id,
            productores!inner ( id, razon_social )
          )
        `)
        .eq('tipo', 'informe_semanal')
        .eq('lotes.campana_id', campanaId)
        .not('datos_extra->>aplicacion', 'is', null)
        .neq('datos_extra->>aplicacion', '')
        .order('fecha', { ascending: true })

      const lista: Aplicacion[] = (obs ?? []).map((o: any) => ({
        id: o.id,
        lote_id: o.lotes.id,
        lote_nombre: o.lotes.nombre,
        lote_hectareas: o.lotes.hectareas,
        lote_cultivo: o.lotes.cultivo,
        productor_id: o.lotes.productores.id,
        productor_nombre: o.lotes.productores.razon_social,
        fecha: o.fecha,
        estado: o.datos_extra?.estado ?? '',
        aplicacion: o.datos_extra?.aplicacion ?? '',
        semana: semanaDeIso(o.fecha),
      }))
      setAplicaciones(lista)
    } finally {
      setCargando(false)
    }
  }

  // Filtrar por productor si hay selección
  const filtradas = productorFiltro === 'todos'
    ? aplicaciones
    : aplicaciones.filter(a => a.productor_id === productorFiltro)

  // Semanas únicas ordenadas
  const semanas = [...new Set(filtradas.map(a => a.semana))].sort((a, b) => a - b)

  // Lotes únicos en el filtro actual
  const lotes = [...new Map(filtradas.map(a => [a.lote_id, {
    id: a.lote_id,
    nombre: a.lote_nombre,
    cultivo: a.lote_cultivo,
    hectareas: a.lote_hectareas,
    productor: a.productor_nombre,
    productor_id: a.productor_id,
  }])).values()]

  // Agrupar lotes según modo
  const lotesPorGrupo: Record<string, typeof lotes> = {}
  if (agrupacion === 'productor') {
    lotes.forEach(l => {
      if (!lotesPorGrupo[l.productor]) lotesPorGrupo[l.productor] = []
      lotesPorGrupo[l.productor].push(l)
    })
  } else {
    lotes.forEach(l => {
      const cult = l.cultivo || 'Sin cultivo'
      if (!lotesPorGrupo[cult]) lotesPorGrupo[cult] = []
      lotesPorGrupo[cult].push(l)
    })
  }

  const grupos = Object.keys(lotesPorGrupo).sort()

  // Función: obtener aplicaciones de un lote en una semana
  function appsEnSemana(loteId: string, semana: number): Aplicacion[] {
    return filtradas.filter(a => a.lote_id === loteId && a.semana === semana)
  }

  const totalLotes = lotes.length
  const totalAplicaciones = filtradas.length
  const semanasActivas = semanas.length

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="label-xs text-ochre">MÓDULO</p>
          <h1 className="text-2xl font-black text-hi">Línea de Tiempo · Aplicaciones</h1>
          <p className="text-mid text-sm mt-0.5">Seguimiento de aplicaciones realizadas por lote y semana</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label-xs text-mid block mb-1">Campaña</label>
          <select value={campanaId} onChange={e => setCampanaId(e.target.value)} className="field text-sm">
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Productor</label>
          <select value={productorFiltro} onChange={e => setProductorFiltro(e.target.value)} className="field text-sm">
            <option value="todos">Todos los productores</option>
            {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Agrupar por</label>
          <div className="flex rounded overflow-hidden border border-base-5">
            <button
              onClick={() => setAgrupacion('productor')}
              className={`px-3 py-1.5 text-sm transition-colors ${agrupacion === 'productor' ? 'bg-ochre text-black font-bold' : 'text-mid hover:text-hi'}`}
            >
              Productor
            </button>
            <button
              onClick={() => setAgrupacion('cultivo')}
              className={`px-3 py-1.5 text-sm transition-colors ${agrupacion === 'cultivo' ? 'bg-ochre text-black font-bold' : 'text-mid hover:text-hi'}`}
            >
              Cultivo
            </button>
          </div>
        </div>
        <button onClick={cargar} disabled={cargando} className="btn-ghost text-sm">
          {cargando ? '⏳' : '🔄'} Actualizar
        </button>

        {/* Stats rápidos */}
        {!cargando && totalAplicaciones > 0 && (
          <div className="ml-auto flex gap-4 text-right">
            <div>
              <p className="text-ochre font-black text-lg">{totalAplicaciones}</p>
              <p className="text-lo text-xs">aplicaciones</p>
            </div>
            <div>
              <p className="text-green-400 font-black text-lg">{totalLotes}</p>
              <p className="text-lo text-xs">lotes</p>
            </div>
            <div>
              <p className="text-hi font-black text-lg">{semanasActivas}</p>
              <p className="text-lo text-xs">semanas</p>
            </div>
          </div>
        )}
      </div>

      {cargando && (
        <div className="card p-8 text-center text-mid">Cargando aplicaciones...</div>
      )}

      {!cargando && filtradas.length === 0 && (
        <div className="card p-10 text-center text-mid">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-hi mb-1">Sin aplicaciones registradas</p>
          <p className="text-sm">Las aplicaciones que cargues en Informes Semanales aparecerán acá</p>
        </div>
      )}

      {/* LÍNEA DE TIEMPO */}
      {!cargando && filtradas.length > 0 && (
        <div className="space-y-8">
          {grupos.map(grupo => {
            const lotesGrupo = lotesPorGrupo[grupo]
            return (
              <div key={grupo}>
                {/* Título grupo */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-ochre font-black text-sm uppercase tracking-widest">{grupo}</span>
                  <div className="flex-1 h-px bg-base-5" />
                  <span className="text-lo text-xs">{lotesGrupo.length} lotes</span>
                </div>

                {/* Tabla línea de tiempo */}
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-base-5">
                        {/* Columna lote */}
                        <th className="text-left py-2 px-3 text-mid font-semibold text-xs uppercase sticky left-0 bg-base-3 z-10 min-w-[160px]">
                          Lote
                        </th>
                        {/* Columna por semana */}
                        {semanas.map(s => (
                          <th key={s} className="text-center py-2 px-2 text-mid font-semibold text-xs uppercase min-w-[90px]">
                            Sem {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lotesGrupo.map((lote, li) => {
                        const color = cultColorFor(lote.cultivo)
                        return (
                          <tr key={lote.id} className={`border-b border-base-5/40 ${li % 2 === 0 ? '' : 'bg-base-2/50'}`}>
                            {/* Celda lote */}
                            <td className="py-2 px-3 sticky left-0 bg-base-3 z-10" style={{ background: li % 2 === 0 ? '#111' : '#151515' }}>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                  style={{ background: color, color: '#000' }}
                                >
                                  {abrevCult(lote.cultivo)}
                                </span>
                                <div>
                                  <p className="text-hi font-bold text-xs leading-tight">{lote.nombre}</p>
                                  {agrupacion === 'cultivo' && (
                                    <p className="text-lo text-[10px]">{lote.productor}</p>
                                  )}
                                  <p className="text-lo text-[10px]">{lote.hectareas} ha</p>
                                </div>
                              </div>
                            </td>

                            {/* Celdas semana */}
                            {semanas.map(s => {
                              const apps = appsEnSemana(lote.id, s)
                              return (
                                <td key={s} className="py-2 px-2 align-top">
                                  {apps.length === 0 ? (
                                    <div className="flex items-center justify-center h-8">
                                      <span className="text-base-5 text-lg">·</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {apps.map(a => (
                                        <div
                                          key={a.id}
                                          className="rounded p-1.5 text-[10px] leading-snug group relative"
                                          style={{ background: color + '22', borderLeft: `2px solid ${color}` }}
                                        >
                                          {/* Estado */}
                                          {a.estado && (
                                            <p className="font-bold text-green-400 mb-0.5 text-[9px] uppercase">{a.estado}</p>
                                          )}
                                          {/* Aplicación */}
                                          <p className="text-hi">{a.aplicacion}</p>
                                          {/* Fecha chica */}
                                          <p className="text-lo text-[9px] mt-0.5">{fmtFecha(a.fecha)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
