'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampana } from '@/components/layout/app-shell'

type Productor = { id: string; razon_social: string }
type Campana   = { id: string; nombre: string }
type Lote = {
  id: string; nombre: string; hectareas: number; cultivo: string
  productor_id: string; productor_nombre: string
}
type Aplicacion = {
  id: string; lote_id: string; fecha: string; tipo: string; productos: string; semana: number
}

const TIPO_COLOR: Record<string, string> = {
  'Herbicida':       '#ef4444',
  'Fungicida':       '#8b5cf6',
  'Insecticida':     '#f97316',
  'Fertilización':   '#22c55e',
  'Fertilizacion':   '#22c55e',
  'Fungicida + Fertilización': '#06b6d4',
}
function tipoColor(tipo: string) { return TIPO_COLOR[tipo] ?? '#6b7280' }
function tipoAbrev(tipo: string) {
  if (!tipo) return '?'
  if (tipo.toLowerCase().includes('herb'))   return 'H'
  if (tipo.toLowerCase().includes('fung'))   return 'F'
  if (tipo.toLowerCase().includes('insec'))  return 'I'
  if (tipo.toLowerCase().includes('fertil')) return 'Ft'
  return tipo.slice(0, 2).toUpperCase()
}

function cultColor(c: string) {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja'))   return '#22c55e'
  if (s.includes('maíz') || s.includes('maiz')) return '#f59e0b'
  if (s.includes('trigo') || s.includes('cebada')) return '#d97706'
  if (s.includes('sorgo'))  return '#ef4444'
  if (s.includes('girasol')) return '#eab308'
  return '#6b7280'
}
function cultAbrev(c: string) {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja 2')) return 'S2°'
  if (s.includes('soja'))   return 'SOJ'
  if (s.includes('maíz') || s.includes('maiz')) return 'MAZ'
  if (s.includes('trigo'))  return 'TRI'
  if (s.includes('cebada')) return 'CEB'
  if (s.includes('sorgo'))  return 'SOR'
  if (s.includes('girasol')) return 'GIR'
  return c?.slice(0, 3).toUpperCase() ?? '---'
}

function fmtFecha(iso: string) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
function semanaDeIso(iso: string) {
  const f = new Date(iso + 'T12:00:00')
  const jan1 = new Date(f.getFullYear(), 0, 1)
  return Math.ceil(((f.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
}

export function AplicacionesClient({ productores, campanas }: {
  productores: Productor[]
  campanas: Campana[]
}) {
  const sb = createClient()
  const { campanaId: campanaCtxId } = useCampana()

  const [campanaId, setCampanaId]           = useState(() => campanas[0]?.id ?? '')
  const [productorFiltro, setProductorFiltro] = useState('todos')
  const [tipoFiltro, setTipoFiltro]         = useState('todos')
  const [cultivoFiltro, setCultivoFiltro]   = useState('todos')
  const [lotes, setLotes]                   = useState<Lote[]>([])
  const [aplicaciones, setAplicaciones]     = useState<Aplicacion[]>([])
  const [cargando, setCargando]             = useState(false)

  useEffect(() => {
    if (campanaCtxId && campanaCtxId !== campanaId) setCampanaId(campanaCtxId)
  }, [campanaCtxId])

  useEffect(() => { if (campanaId) cargar() }, [campanaId])

  async function cargar() {
    setCargando(true)
    try {
      const { data: lotesData } = await (sb as any)
        .from('lotes')
        .select('id, nombre, hectareas, cultivo, productor_id, productores!inner(id, razon_social)')
        .eq('campana_id', campanaId)
        .order('nombre')

      const todosLotes: Lote[] = (lotesData ?? []).map((l: any) => ({
        id: l.id,
        nombre: l.nombre,
        hectareas: l.hectareas ?? 0,
        cultivo: l.cultivo ?? '',
        productor_id: l.productores?.id ?? l.productor_id,
        productor_nombre: l.productores?.razon_social ?? '',
      }))
      setLotes(todosLotes)

      if (todosLotes.length === 0) { setAplicaciones([]); return }

      const loteIds = todosLotes.map(l => l.id)
      const { data: apls } = await (sb as any)
        .from('aplicaciones')
        .select('id, lote_id, fecha, tipo, productos')
        .in('lote_id', loteIds)
        .order('fecha', { ascending: true })

      setAplicaciones((apls ?? []).map((a: any) => ({
        id: a.id, lote_id: a.lote_id, fecha: a.fecha,
        tipo: a.tipo ?? '', productos: a.productos ?? '',
        semana: semanaDeIso(a.fecha),
      })))
    } finally { setCargando(false) }
  }

  const cultivosUnicos = [...new Set(lotes.map(l => l.cultivo).filter(Boolean))].sort()
  const tiposUnicos    = [...new Set(aplicaciones.map(a => a.tipo).filter(Boolean))].sort()

  const lotesFiltrados = lotes.filter(l => {
    if (productorFiltro !== 'todos' && l.productor_id !== productorFiltro) return false
    if (cultivoFiltro !== 'todos' && l.cultivo !== cultivoFiltro) return false
    return true
  })
  const aplsFiltradas = aplicaciones.filter(a => {
    const lote = lotes.find(l => l.id === a.lote_id)
    if (!lote) return false
    if (productorFiltro !== 'todos' && lote.productor_id !== productorFiltro) return false
    if (cultivoFiltro !== 'todos' && lote.cultivo !== cultivoFiltro) return false
    if (tipoFiltro !== 'todos' && a.tipo !== tipoFiltro) return false
    return true
  })

  const semanas = [...new Set(aplsFiltradas.map(a => a.semana))].sort((a, b) => a - b)

  const productoresConLotes: Record<string, { nombre: string; lotes: Lote[] }> = {}
  lotesFiltrados.forEach(l => {
    if (!productoresConLotes[l.productor_id])
      productoresConLotes[l.productor_id] = { nombre: l.productor_nombre, lotes: [] }
    productoresConLotes[l.productor_id].lotes.push(l)
  })
  const grupos = Object.entries(productoresConLotes).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))

  function appsLoteSemana(loteId: string, semana: number) {
    return aplsFiltradas.filter(a => a.lote_id === loteId && a.semana === semana)
  }
  function appsLote(loteId: string) {
    return aplsFiltradas.filter(a => a.lote_id === loteId)
  }

  const lotesConApl = new Set(aplsFiltradas.map(a => a.lote_id)).size
  const lotesSinApl = lotesFiltrados.length - lotesConApl
  const totalHa     = lotesFiltrados.reduce((s, l) => s + l.hectareas, 0)
  const pctAplicado = lotesFiltrados.length ? Math.round((lotesConApl / lotesFiltrados.length) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4 animate-fade-in">

      {/* Header */}
      <div>
        <p className="eyebrow mb-0.5">Aplicaciones</p>
        <h1 className="text-2xl font-black text-hi tracking-tight">Aplicaciones por lote</h1>
        <p className="text-lo text-sm mt-0.5">Línea de tiempo por semana · incluye lotes sin aplicación</p>
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
          <select value={productorFiltro} onChange={e => setProductorFiltro(e.target.value)} className="field py-1.5 text-sm min-w-[180px]">
            <option value="todos">Todos los productores</option>
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
        {tiposUnicos.length > 1 && (
          <div className="filter-group">
            <label className="filter-label">Tipo</label>
            <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="field py-1.5 text-sm min-w-[140px]">
              <option value="todos">Todos</option>
              {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        <button onClick={cargar} disabled={cargando} className="btn btn-ghost btn-sm ml-auto">
          {cargando ? '⏳' : '↻'} Actualizar
        </button>

        {/* Leyenda */}
        {tiposUnicos.length > 0 && (
          <div className="w-full flex flex-wrap gap-3 pt-2 border-t border-base-4/40">
            {tiposUnicos.map(t => (
              <button
                key={t}
                onClick={() => setTipoFiltro(tipoFiltro === t ? 'todos' : t)}
                className={`flex items-center gap-1.5 text-[11px] transition-all rounded-full px-2 py-0.5 ${
                  tipoFiltro === t ? 'bg-base-4' : 'hover:bg-base-3'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tipoColor(t) }} />
                <span className="text-mid">{t}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {!cargando && lotesFiltrados.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { val: lotesFiltrados.length,         label: 'lotes totales',   color: 'text-hi' },
              { val: lotesConApl,                   label: 'con aplicación',  color: 'text-afa' },
              { val: lotesSinApl,                   label: 'sin aplicación',  color: lotesSinApl > 0 ? 'text-red-400' : 'text-lo' },
              { val: `${Math.round(totalHa)} ha`,   label: 'hectáreas',       color: 'text-ochre' },
            ].map(({ val, label, color }) => (
              <div key={label} className="card p-3 text-center">
                <p className={`text-2xl font-black tabular-nums leading-none ${color}`}>{val}</p>
                <p className="text-lo text-[11px] mt-1 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          {/* Barra progreso */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-base-4 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-afa to-green-400 rounded-full transition-all duration-500"
                style={{ width: `${pctAplicado}%` }}
              />
            </div>
            <span className="text-xs text-mid tabular-nums shrink-0">{pctAplicado}% aplicado</span>
          </div>
        </div>
      )}

      {cargando && (
        <div className="card p-12 text-center space-y-2">
          <div className="text-3xl animate-pulse">🌱</div>
          <p className="text-lo text-sm">Cargando datos...</p>
        </div>
      )}

      {!cargando && lotesFiltrados.length === 0 && (
        <div className="card p-12 text-center space-y-2">
          <p className="text-4xl">🌱</p>
          <p className="font-bold text-hi">Sin lotes en esta campaña</p>
          <p className="text-lo text-sm">Ajustá los filtros o seleccioná otra campaña</p>
        </div>
      )}

      {/* TABLA POR PRODUCTOR */}
      {!cargando && lotesFiltrados.length > 0 && (
        <div className="space-y-5">
          {grupos.map(([prodId, { nombre, lotes: lotesGrupo }]) => {
            const aplsProd = aplsFiltradas.filter(a => lotesGrupo.some(l => l.id === a.lote_id))
            return (
              <div key={prodId}>
                {/* Cabecera productor */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black bg-ochre text-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    {nombre.split(' ')[0]}
                  </span>
                  <span className="text-hi font-bold text-sm">{nombre}</span>
                  <div className="flex-1 h-px bg-base-4/60 mx-1" />
                  <span className="text-lo text-xs shrink-0">
                    {lotesGrupo.length} lotes · {aplsProd.length} aplicaciones
                  </span>
                </div>

                {/* Tabla */}
                <div className="card overflow-x-auto">
                  <table
                    className="border-collapse w-full"
                    style={{ minWidth: `${Math.max(480, 190 + semanas.length * 100)}px` }}
                  >
                    <thead>
                      <tr className="border-b border-base-5">
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-mid sticky left-0 bg-base-2 z-10 w-[180px]">
                          Lote
                        </th>
                        <th className="text-center py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider text-mid w-10">
                          Ha
                        </th>
                        {semanas.length === 0 ? (
                          <th className="text-center py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider text-mid">
                            Sin aplicaciones aún
                          </th>
                        ) : semanas.map(s => (
                          <th key={s} className="text-center py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider text-mid min-w-[92px]">
                            Semana {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-4/30">
                      {lotesGrupo.map((lote, li) => {
                        const cc = cultColor(lote.cultivo)
                        const appsTotal = appsLote(lote.id)
                        const sinApl = appsTotal.length === 0
                        const rowBg = li % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                        return (
                          <tr key={lote.id} style={{ background: rowBg }} className="hover:bg-base-3/30 transition-colors">
                            {/* Lote sticky */}
                            <td className="py-2 px-3 sticky left-0 z-10" style={{ background: li % 2 === 0 ? '#0d0d0d' : '#0f0f0f' }}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                                  style={{ background: cc, color: '#000' }}
                                >
                                  {cultAbrev(lote.cultivo)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-hi font-semibold text-xs leading-tight truncate">{lote.nombre}</p>
                                  <p className="text-lo text-[10px] truncate">{lote.cultivo || '—'}</p>
                                </div>
                                {sinApl && (
                                  <span className="ml-auto shrink-0 badge badge-pending">
                                    PEND
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Ha */}
                            <td className="text-center py-2 px-2 text-mid text-xs font-mono">
                              {lote.hectareas}
                            </td>

                            {/* Sin semanas */}
                            {semanas.length === 0 && (
                              <td className="py-2 px-3 text-center">
                                <span className="text-lo text-xs">—</span>
                              </td>
                            )}

                            {/* Celdas por semana */}
                            {semanas.map(s => {
                              const apps = appsLoteSemana(lote.id, s)
                              return (
                                <td key={s} className="py-1.5 px-1.5 align-top">
                                  {apps.length === 0 ? (
                                    <div className="h-8 flex items-center justify-center">
                                      <span className="w-1 h-1 rounded-full bg-base-5/50 inline-block" />
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {apps.map(a => {
                                        const tc = tipoColor(a.tipo)
                                        return (
                                          <div
                                            key={a.id}
                                            className="rounded-lg text-[10px] leading-snug overflow-hidden"
                                            style={{ borderLeft: `3px solid ${tc}`, background: tc + '14' }}
                                          >
                                            <div className="px-2 py-1">
                                              <div className="flex items-center gap-1 mb-0.5">
                                                <span
                                                  className="text-[8px] font-black px-1 py-px rounded"
                                                  style={{ background: tc, color: '#fff' }}
                                                >
                                                  {tipoAbrev(a.tipo)}
                                                </span>
                                                <span className="text-[9px] text-mid">{fmtFecha(a.fecha)}</span>
                                              </div>
                                              {a.productos && (
                                                <p className="text-hi text-[10px] leading-tight line-clamp-2">{a.productos}</p>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
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

      {/* Resumen lotes pendientes */}
      {!cargando && lotesSinApl > 0 && (
        <div className="card p-4 border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
            <span>⚠</span> {lotesSinApl} lotes sin aplicación
          </p>
          <div className="flex flex-wrap gap-2">
            {lotesFiltrados
              .filter(l => appsLote(l.id).length === 0)
              .map(l => (
                <span key={l.id} className="text-xs bg-base-3 text-mid px-2.5 py-1 rounded-lg border border-base-5 flex items-center gap-1.5">
                  <span className="text-[9px] font-black px-1 py-px rounded" style={{ background: cultColor(l.cultivo), color: '#000' }}>
                    {cultAbrev(l.cultivo)}
                  </span>
                  {l.nombre}
                  <span className="text-lo">· {l.productor_nombre.split(' ')[0]}</span>
                </span>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
