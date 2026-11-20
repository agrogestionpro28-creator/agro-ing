'use client'

import { useMemo, useState, useRef } from 'react'
import { useCampana } from '@/components/layout/app-shell'

// ── Tipos ─────────────────────────────────────────────────
type Productor   = { id: string; razon_social: string }
type Campana     = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string }
type Lote        = {
  id: string; nombre: string; hectareas: number
  cultivo: string | null; cultivo_2: string | null
  variedad: string | null; tecnologia_soja: string | null
  productor_id: string; campana_id: string
  fecha_siembra: string | null; fecha_cosecha: string | null
}
type Aplicacion  = {
  id: string; lote_id: string; fecha: string; tipo: string
  productos: string | null; maquinaria: string; hectareas_apl: number | null
}

// ── Fenología por cultivo (días desde siembra) ────────────
// Basado en imagen: germinación 10d, vegetativo 30-40d, floración 25-35d, fruto 30-40d, maduración 10-15d
const FENOLOGIA: Record<string, { etapas: { label: string; desde: number; hasta: number; color: string }[]; total: number }> = {
  Soja: {
    total: 130,
    etapas: [
      { label: 'Germinación',   desde: 0,   hasta: 10,  color: '#86efac' },
      { label: 'Vegetativo',    desde: 10,  hasta: 50,  color: '#4ade80' },
      { label: 'Floración',     desde: 50,  hasta: 80,  color: '#a78bfa' },
      { label: 'Des. fruto',    desde: 80,  hasta: 115, color: '#fb923c' },
      { label: 'Maduración',    desde: 115, hasta: 130, color: '#fbbf24' },
    ]
  },
  'Soja 2°': {
    total: 110,
    etapas: [
      { label: 'Germinación',   desde: 0,   hasta: 10,  color: '#86efac' },
      { label: 'Vegetativo',    desde: 10,  hasta: 45,  color: '#4ade80' },
      { label: 'Floración',     desde: 45,  hasta: 70,  color: '#a78bfa' },
      { label: 'Des. fruto',    desde: 70,  hasta: 100, color: '#fb923c' },
      { label: 'Maduración',    desde: 100, hasta: 110, color: '#fbbf24' },
    ]
  },
  Maíz: {
    total: 160,
    etapas: [
      { label: 'Germinación',   desde: 0,   hasta: 10,  color: '#fef08a' },
      { label: 'Vegetativo',    desde: 10,  hasta: 65,  color: '#a3e635' },
      { label: 'Floración',     desde: 65,  hasta: 90,  color: '#f9a8d4' },
      { label: 'Des. fruto',    desde: 90,  hasta: 140, color: '#fb923c' },
      { label: 'Maduración',    desde: 140, hasta: 160, color: '#fbbf24' },
    ]
  },
  Trigo: {
    total: 150,
    etapas: [
      { label: 'Implantación',  desde: 0,   hasta: 20,  color: '#d9f99d' },
      { label: 'Macollaje',     desde: 20,  hasta: 60,  color: '#86efac' },
      { label: 'Encañazón',     desde: 60,  hasta: 90,  color: '#4ade80' },
      { label: 'Espigazón',     desde: 90,  hasta: 115, color: '#a78bfa' },
      { label: 'Llenado',       desde: 115, hasta: 140, color: '#fb923c' },
      { label: 'Maduración',    desde: 140, hasta: 150, color: '#fbbf24' },
    ]
  },
  Cebada: {
    total: 145,
    etapas: [
      { label: 'Implantación',  desde: 0,   hasta: 20,  color: '#d9f99d' },
      { label: 'Macollaje',     desde: 20,  hasta: 55,  color: '#86efac' },
      { label: 'Encañazón',     desde: 55,  hasta: 85,  color: '#4ade80' },
      { label: 'Espigazón',     desde: 85,  hasta: 110, color: '#a78bfa' },
      { label: 'Llenado',       desde: 110, hasta: 135, color: '#fb923c' },
      { label: 'Maduración',    desde: 135, hasta: 145, color: '#fbbf24' },
    ]
  },
  Girasol: {
    total: 130,
    etapas: [
      { label: 'Germinación',   desde: 0,   hasta: 10,  color: '#fef08a' },
      { label: 'Vegetativo',    desde: 10,  hasta: 55,  color: '#86efac' },
      { label: 'Floración',     desde: 55,  hasta: 80,  color: '#fde047' },
      { label: 'Llenado',       desde: 80,  hasta: 115, color: '#fb923c' },
      { label: 'Maduración',    desde: 115, hasta: 130, color: '#fbbf24' },
    ]
  },
  Sorgo: {
    total: 140,
    etapas: [
      { label: 'Germinación',   desde: 0,   hasta: 10,  color: '#fca5a5' },
      { label: 'Vegetativo',    desde: 10,  hasta: 60,  color: '#f87171' },
      { label: 'Floración',     desde: 60,  hasta: 85,  color: '#c084fc' },
      { label: 'Llenado',       desde: 85,  hasta: 125, color: '#fb923c' },
      { label: 'Maduración',    desde: 125, hasta: 140, color: '#fbbf24' },
    ]
  },
}
const FENOLOGIA_DEFAULT = FENOLOGIA['Soja']

// ── Colores por tipo de aplicación ───────────────────────
const TIPO_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  'Herbicida':    { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  'Fungicida':    { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  'Insecticida':  { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
  'Fertilizante': { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  'Fertilización':{ bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  'Otro':         { bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
}
function tipoStyle(tipo: string) {
  for (const [k, v] of Object.entries(TIPO_COLOR)) if (tipo.startsWith(k) || tipo.includes(k)) return v
  return TIPO_COLOR['Otro']
}

// ── Badge tecnología soja ─────────────────────────────────
const TECH_STYLE: Record<string, { bg: string; text: string; border: string; tooltip: string }> = {
  'Enlist':       { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6', tooltip: '✅ Tolera 2,4-D · ✅ Tolera Glufosinato' },
  'Conkesta':     { bg: '#fdf4ff', text: '#7e22ce', border: '#a855f7', tooltip: '✅ Bt lepidópteros · ✅ Tolera 2,4-D · ❌ Glufosinato' },
  'IPRO':         { bg: '#f0fdf4', text: '#15803d', border: '#22c55e', tooltip: '✅ Tolera Glufosinato · ❌ 2,4-D' },
  'Convencional': { bg: '#f8fafc', text: '#475569', border: '#94a3b8', tooltip: '❌ 2,4-D · ❌ Glufosinato · ❌ Bt' },
}

function diasDesde(desde: string, hasta: string): number {
  return Math.round((new Date(hasta + 'T12:00:00').getTime() - new Date(desde + 'T12:00:00').getTime()) / 86400000)
}

function fmtFecha(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ── Componente principal ──────────────────────────────────
export function FenologiaClient({
  productores, campanas, lotes, aplicaciones,
}: {
  productores: Productor[]
  campanas:    Campana[]
  lotes:       Lote[]
  aplicaciones: Aplicacion[]
}) {
  const { campanaId } = useCampana()
  const [filtroCultivo, setFiltroCultivo] = useState('todos')
  const [filtroProductor, setFiltroProductor] = useState('todos')

  // Lotes de la campaña actual
  const lotesActuales = useMemo(
    () => lotes.filter(l => l.campana_id === campanaId),
    [lotes, campanaId]
  )

  // Filtrar
  const lotesFiltrados = useMemo(() => lotesActuales.filter(l => {
    if (filtroProductor !== 'todos' && l.productor_id !== filtroProductor) return false
    if (filtroCultivo !== 'todos' && l.cultivo !== filtroCultivo && l.cultivo_2 !== filtroCultivo) return false
    return true
  }), [lotesActuales, filtroProductor, filtroCultivo])

  const loteIds = useMemo(() => new Set(lotesFiltrados.map(l => l.id)), [lotesFiltrados])

  const aplsFiltradas = useMemo(
    () => aplicaciones.filter(a => loteIds.has(a.lote_id)),
    [aplicaciones, loteIds]
  )

  // Cultivos únicos con lotes activos
  const cultivosUnicos = useMemo(() => {
    const s = new Set<string>()
    lotesActuales.forEach(l => { if (l.cultivo) s.add(l.cultivo); if (l.cultivo_2) s.add(l.cultivo_2) })
    return [...s].sort()
  }, [lotesActuales])

  // Agrupar lotes por cultivo (un lote doble aparece en ambos grupos)
  const grupos = useMemo(() => {
    const g: Record<string, Lote[]> = {}
    for (const l of lotesFiltrados) {
      const cultivos = [l.cultivo, l.cultivo_2].filter(Boolean) as string[]
      if (cultivos.length === 0) {
        if (!g['Sin cultivo']) g['Sin cultivo'] = []
        g['Sin cultivo'].push(l)
      } else {
        for (const c of cultivos) {
          if (!g[c]) g[c] = []
          g[c].push(l)
        }
      }
    }
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
  }, [lotesFiltrados])

  // Stats
  const totalAplicaciones = aplsFiltradas.length
  const lotesSinSiembra   = lotesFiltrados.filter(l => !l.fecha_siembra).length

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="eyebrow">Fenología</p>
        <h1 className="text-2xl font-black tracking-tight mt-1" style={{ color: '#0f172a' }}>
          Línea de tiempo fenológica
        </h1>
        <p className="text-sm text-mid mt-0.5">
          Aplicaciones de todos los productores sobre la curva de cada cultivo
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroProductor}
          onChange={e => setFiltroProductor(e.target.value)}
          className="field py-1.5 text-sm min-w-[200px]"
        >
          <option value="todos">Todos los productores</option>
          {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
        </select>
        <select
          value={filtroCultivo}
          onChange={e => setFiltroCultivo(e.target.value)}
          className="field py-1.5 text-sm min-w-[150px]"
        >
          <option value="todos">Todos los cultivos</option>
          {cultivosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Referencia tipos */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPO_COLOR).map(([tipo, st]) => (
          <span key={tipo} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border"
            style={{ background: st.bg, color: st.text, borderColor: st.border }}>
            ▼ {tipo}
          </span>
        ))}
      </div>

      {/* Grupos por cultivo */}
      {grupos.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">🌱</p>
          <p className="font-bold text-hi">No hay lotes con siembra registrada esta campaña</p>
          <p className="text-sm text-mid mt-1">Cargá las fechas de siembra desde cada lote para ver la fenología.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(([cultivo, lotesGrupo]) => (
            <GrupoCultivo
              key={cultivo}
              cultivo={cultivo}
              lotes={lotesGrupo}
              aplicaciones={aplsFiltradas}
              productores={productores}
            />
          ))}
        </div>
      )}

      {lotesSinSiembra > 0 && (
        <p className="text-xs text-mid text-center">
          {lotesSinSiembra} lote{lotesSinSiembra > 1 ? 's' : ''} sin fecha de siembra — no se muestran en la línea de tiempo
        </p>
      )}
    </div>
  )
}

// ── Grupo por cultivo ────────────────────────────────────
function GrupoCultivo({ cultivo, lotes, aplicaciones, productores }: {
  cultivo:      string
  lotes:        Lote[]
  aplicaciones: Aplicacion[]
  productores:  Productor[]
}) {
  const feno = FENOLOGIA[cultivo] ?? FENOLOGIA_DEFAULT
  const PRE  = 15  // días pre-siembra que se muestran
  const totalDias = feno.total + PRE

  // Solo lotes con fecha de siembra
  const lotesConSiembra = lotes.filter(l => l.fecha_siembra)
  if (lotesConSiembra.length === 0) return null

  // Color del cultivo para el encabezado
  const cultColor = (() => {
    const s = cultivo.toLowerCase()
    if (s.includes('soja 2')) return { strip: '#34d399', badge: '#ecfdf5', text: '#047857' }
    if (s.includes('soja'))   return { strip: '#22c55e', badge: '#f0fdf4', text: '#15803d' }
    if (s.includes('maíz') || s.includes('maiz')) return { strip: '#facc15', badge: '#fefce8', text: '#a16207' }
    if (s.includes('trigo'))  return { strip: '#f59e0b', badge: '#fffbeb', text: '#b45309' }
    if (s.includes('cebada')) return { strip: '#fbbf24', badge: '#fef3c7', text: '#92400e' }
    if (s.includes('sorgo'))  return { strip: '#f97316', badge: '#fff7ed', text: '#c2410c' }
    if (s.includes('girasol'))return { strip: '#38bdf8', badge: '#f0f9ff', text: '#0369a1' }
    return { strip: '#94a3b8', badge: '#f8fafc', text: '#64748b' }
  })()

  // Aplicaciones de este grupo
  const loteIds = new Set(lotesConSiembra.map(l => l.id))
  const aplsGrupo = aplicaciones.filter(a => loteIds.has(a.lote_id))

  return (
    <div className="card overflow-hidden">
      {/* Cabecera cultivo */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: cultColor.badge, borderBottom: `1px solid ${cultColor.strip}30` }}>
        <div className="w-1 h-8 rounded-full" style={{ background: cultColor.strip }} />
        <div>
          <h2 className="font-black text-lg" style={{ color: '#0f172a' }}>{cultivo}</h2>
          <p className="text-xs" style={{ color: cultColor.text }}>
            {lotesConSiembra.length} lote{lotesConSiembra.length > 1 ? 's' : ''} · {aplsGrupo.length} aplicacion{aplsGrupo.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Tabla lotes */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Eje fenológico (encabezado) */}
          <EjeFenologico feno={feno} pre={PRE} totalDias={totalDias} />

          {/* Fila por lote */}
          {lotesConSiembra.map(lote => {
            const prod = productores.find(p => p.id === lote.productor_id)
            const aplsLote = aplsGrupo.filter(a => a.lote_id === lote.id)
            return (
              <FilaLote
                key={lote.id}
                lote={lote}
                productorNombre={prod?.razon_social ?? ''}
                aplicaciones={aplsLote}
                feno={feno}
                pre={PRE}
                totalDias={totalDias}
                cultivo={cultivo}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Eje fenológico ────────────────────────────────────────
function EjeFenologico({ feno, pre, totalDias }: {
  feno: typeof FENOLOGIA_DEFAULT
  pre: number
  totalDias: number
}) {
  return (
    <div className="relative h-10 mx-4 mt-3 mb-1">
      {/* Barra de fondo completa */}
      <div className="absolute inset-0 rounded-lg overflow-hidden flex">
        {/* Pre-siembra */}
        <div
          className="h-full flex items-center justify-center text-[9px] font-bold text-mid"
          style={{ width: `${(pre / totalDias) * 100}%`, background: '#f1f5f9', borderRight: '2px dashed #cbd5e1' }}
        >
          Pre-siem.
        </div>
        {/* Etapas fenológicas */}
        {feno.etapas.map((e, i) => (
          <div
            key={i}
            className="h-full flex items-center justify-center text-[9px] font-bold overflow-hidden"
            style={{
              width: `${((e.hasta - e.desde) / totalDias) * 100}%`,
              background: `${e.color}40`,
              borderRight: i < feno.etapas.length - 1 ? `1px solid ${e.color}80` : undefined,
              color: '#374151',
            }}
          >
            <span className="truncate px-1">{e.label}</span>
          </div>
        ))}
      </div>
      {/* Línea de siembra */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
        style={{ left: `${(pre / totalDias) * 100}%` }}
        title="Siembra"
      />
    </div>
  )
}

// ── Fila de un lote ───────────────────────────────────────
function FilaLote({ lote, productorNombre, aplicaciones, feno, pre, totalDias, cultivo }: {
  lote:            Lote
  productorNombre: string
  aplicaciones:    Aplicacion[]
  feno:            typeof FENOLOGIA_DEFAULT
  pre:             number
  totalDias:       number
  cultivo:         string
}) {
  const [tooltip, setTooltip] = useState<{ apl: Aplicacion; x: number; side: 'left' | 'right' } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  if (!lote.fecha_siembra) return null

  // Posición de cada aplicación en % del ancho
  const aplsConPos = aplicaciones.map(a => {
    const dias = diasDesde(lote.fecha_siembra!, a.fecha)
    const pct  = ((dias + pre) / totalDias) * 100
    return { ...a, dias, pct: Math.max(0, Math.min(100, pct)) }
  })

  // Tecnología soja
  const esSoja = cultivo.toLowerCase().includes('soja')
  const tech = esSoja && lote.tecnologia_soja ? TECH_STYLE[lote.tecnologia_soja] : null

  return (
    <div className="border-t border-base-4 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-center px-4 py-2 gap-3">
        {/* Nombre lote */}
        <div className="w-44 shrink-0">
          <p className="font-black text-sm truncate" style={{ color: '#0f172a' }}>{lote.nombre}</p>
          <p className="text-xs text-mid truncate">{productorNombre}</p>
          {tech && (
            <div className="relative group inline-block mt-0.5">
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded border cursor-default"
                style={{ background: tech.bg, color: tech.text, borderColor: tech.border }}
              >
                {lote.tecnologia_soja}
              </span>
              {/* Tooltip tecnología */}
              <div className="absolute left-0 bottom-full mb-1 z-30 hidden group-hover:block">
                <div className="bg-slate-900 text-white text-[10px] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                  <p className="font-black mb-1">{lote.tecnologia_soja}</p>
                  <p>{tech.tooltip}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de tiempo */}
        <div
          ref={barRef}
          className="relative flex-1 h-8 rounded-lg overflow-visible"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          {/* Etapas de fondo */}
          <div className="absolute inset-0 flex rounded-lg overflow-hidden pointer-events-none">
            <div style={{ width: `${(pre / totalDias) * 100}%`, background: '#f1f5f9' }} />
            {feno.etapas.map((e, i) => (
              <div key={i} style={{
                width: `${((e.hasta - e.desde) / totalDias) * 100}%`,
                background: `${e.color}20`,
              }} />
            ))}
          </div>

          {/* Línea de siembra */}
          <div
            className="absolute top-0 bottom-0 w-px z-10 pointer-events-none"
            style={{ left: `${(pre / totalDias) * 100}%`, background: '#94a3b8' }}
          />

          {/* Flechitas de aplicación */}
          {aplsConPos.map(a => {
            const st = tipoStyle(a.tipo)
            return (
              <div
                key={a.id}
                className="absolute top-0 bottom-0 flex flex-col items-center justify-center cursor-pointer z-20 group"
                style={{ left: `calc(${a.pct}% - 6px)`, width: 12 }}
                onMouseEnter={e => {
                  const rect = barRef.current?.getBoundingClientRect()
                  const side = a.pct > 65 ? 'right' : 'left'
                  setTooltip({ apl: a, x: a.pct, side })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Línea vertical */}
                <div className="w-px flex-1" style={{ background: st.border }} />
                {/* Flecha abajo */}
                <div
                  className="w-0 h-0 shrink-0"
                  style={{
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: `7px solid ${st.border}`,
                  }}
                />
              </div>
            )
          })}

          {/* Tooltip aplicación */}
          {tooltip && (
            <div
              className="absolute top-full mt-1 z-50 pointer-events-none"
              style={{
                [tooltip.side === 'left' ? 'left' : 'right']: tooltip.side === 'left'
                  ? `calc(${tooltip.x}% + 4px)`
                  : `calc(${100 - tooltip.x}% + 4px)`,
              }}
            >
              <TooltipAplicacion apl={tooltip.apl} siembra={lote.fecha_siembra!} />
            </div>
          )}
        </div>

        {/* Ha + nº aplicaciones */}
        <div className="w-16 shrink-0 text-right">
          <p className="text-xs font-black tabular-nums" style={{ color: '#0f172a' }}>{lote.hectareas} ha</p>
          <p className="text-[10px] text-mid">{aplicaciones.length} apl.</p>
        </div>
      </div>
    </div>
  )
}

// ── Tooltip de una aplicación ─────────────────────────────
function TooltipAplicacion({ apl, siembra }: { apl: Aplicacion; siembra: string }) {
  const st   = tipoStyle(apl.tipo)
  const dias = diasDesde(siembra, apl.fecha)
  const signo = dias >= 0 ? `+${dias}d` : `${dias}d`

  return (
    <div
      className="rounded-xl shadow-2xl text-xs min-w-[200px] max-w-[280px]"
      style={{ background: '#1e293b', border: `1px solid ${st.border}`, color: '#f1f5f9' }}
    >
      <div className="px-3 py-2 rounded-t-xl flex items-center gap-2" style={{ background: st.bg }}>
        <span className="font-black text-xs" style={{ color: st.text }}>▼ {apl.tipo}</span>
        <span className="ml-auto font-mono text-[10px]" style={{ color: st.text }}>{fmtFecha(apl.fecha)} · {signo}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {apl.productos && (
          <p className="leading-relaxed" style={{ color: '#e2e8f0' }}>{apl.productos}</p>
        )}
        {apl.hectareas_apl && (
          <p className="text-mid">{apl.hectareas_apl} ha aplicadas</p>
        )}
        <p className="text-mid">{apl.maquinaria === 'M' ? '🚜 Mosquito' : apl.maquinaria === 'D' ? '🤖 Dron' : '✈️ Avión'}</p>
      </div>
    </div>
  )
}
