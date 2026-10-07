'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Productor = { id: string; razon_social: string }
type Campana = { id: string; nombre: string }
type Lote = { id: string; nombre: string; hectareas: number; cultivo: string; productor_id: string }

type LoteInforme = {
  lote_id: string
  nombre: string
  hectareas: number
  cultivo: string
  estado: string
  comentario: string
  aplicacion: string   // texto libre: "2 lt Glifo + 1 lt Cletodim + 50 cc Silicona"
  esta_semana: boolean // interno — no aparece en el informe
}

const ESTADOS = [
  'Barbecho largo',
  'Barbecho intermedio',
  'Naciendo 🌱',
  'V1 - V3',
  'V4 - V6',
  'Macollaje',
  'Encañado',
  'Floración',
  'Llenado de grano',
  'Madurez',
  'Cosechado',
  'Sin dato',
]

function fmtFecha(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function semanaDelAnio(fecha: Date) {
  const oneJan = new Date(fecha.getFullYear(), 0, 1)
  const diff = fecha.getTime() - oneJan.getTime()
  return Math.ceil((diff / 86400000 + oneJan.getDay() + 1) / 7)
}

export function InformesClient({
  productores,
  campanas,
  userId,
}: {
  productores: Productor[]
  campanas: Campana[]
  userId: string
}) {
  const sb = createClient()

  // ── estado global ──────────────────────────────────────────────
  const [campanaId, setCampanaId] = useState(campanas[0]?.id ?? '')
  const [productorId, setProductorId] = useState('')
  const [lotes, setLotes] = useState<Lote[]>([])
  const [filas, setFilas] = useState<Record<string, LoteInforme>>({})
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState<'carga' | 'preview'>('carga')

  // fechas por defecto: lunes y domingo de la semana actual
  const hoy = new Date()
  const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1 // 0=lun
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dow)
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
  const fmtISO = (d: Date) => d.toISOString().slice(0, 10)

  const [fechaDesde, setFechaDesde] = useState(fmtISO(lunes))
  const [fechaHasta, setFechaHasta] = useState(fmtISO(domingo))

  // ── cargar lotes cuando cambia productor/campaña ───────────────
  useEffect(() => {
    if (!productorId || !campanaId) { setLotes([]); return }
    ;(async () => {
      const { data } = await (sb as any)
        .from('lotes')
        .select('id,nombre,hectareas,cultivo,productor_id')
        .eq('productor_id', productorId)
        .eq('campana_id', campanaId)
        .order('nombre')
      const ls: Lote[] = data ?? []
      setLotes(ls)
      // inicializar filas que no existen
      setFilas(prev => {
        const next = { ...prev }
        ls.forEach(l => {
          if (!next[l.id]) {
            next[l.id] = {
              lote_id: l.id,
              nombre: l.nombre,
              hectareas: l.hectareas,
              cultivo: l.cultivo,
              estado: '',
              comentario: '',
              aplicacion: '',
              esta_semana: false,
            }
          }
        })
        return next
      })
    })()
  }, [productorId, campanaId])

  function setFila(loteId: string, campo: keyof LoteInforme, valor: any) {
    setFilas(prev => ({ ...prev, [loteId]: { ...prev[loteId], [campo]: valor } }))
  }

  // lotes con "esta semana" tildado
  const lotesInforme = lotes
    .map(l => filas[l.id])
    .filter(f => f?.esta_semana)

  // ── generar imagen para WhatsApp ───────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function generarImagen() {
    const canvas = canvasRef.current
    if (!canvas || lotesInforme.length === 0) return

    const W = 900
    const ROW_H = 110
    const HEAD_H = 160
    const H = HEAD_H + lotesInforme.length * ROW_H + 80
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext('2d')!
    // fondo
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    // panal de fondo (ocre tenue)
    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#f59e0b'
    for (let row = 0; row < H / 30 + 1; row++) {
      for (let col = 0; col < W / 26 + 1; col++) {
        const x = col * 26 + (row % 2 === 0 ? 0 : 13)
        const y = row * 22
        hexPath(ctx, x, y, 10)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // banda verde superior
    ctx.fillStyle = '#2EAA6E'
    ctx.fillRect(0, 0, W, 8)

    // título
    const productor = productores.find(p => p.id === productorId)
    const semana = semanaDelAnio(new Date(fechaDesde + 'T12:00:00'))
    const campana = campanas.find(c => c.id === campanaId)

    ctx.fillStyle = '#f59e0b'
    ctx.font = 'bold 13px Inter,sans-serif'
    ctx.fillText(`INFORME SEMANAL — SEMANA ${semana}`, 30, 38)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 22px Inter,sans-serif'
    ctx.fillText((productor?.razon_social ?? '').toUpperCase(), 30, 66)

    ctx.fillStyle = '#888'
    ctx.font = '13px Inter,sans-serif'
    ctx.fillText(
      `${fmtFecha(fechaDesde)} al ${fmtFecha(fechaHasta)}  ·  Campaña ${campana?.nombre ?? ''}`,
      30, 88
    )

    // separador
    ctx.fillStyle = '#2EAA6E'
    ctx.fillRect(0, HEAD_H - 8, W, 3)

    // filas
    lotesInforme.forEach((f, i) => {
      const y = HEAD_H + i * ROW_H
      // fondo alterno
      ctx.fillStyle = i % 2 === 0 ? '#111111' : '#151515'
      ctx.fillRect(0, y, W, ROW_H)

      // badge cultivo
      const cultColor = cultColorFor(f.cultivo)
      ctx.fillStyle = cultColor
      ctx.beginPath()
      ctx.roundRect(28, y + 14, 42, 20, 4)
      ctx.fill()
      ctx.fillStyle = '#000'
      ctx.font = 'bold 10px Inter,sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(abrevCult(f.cultivo), 49, y + 28)
      ctx.textAlign = 'left'

      // nombre lote + has
      ctx.fillStyle = '#f59e0b'
      ctx.font = 'bold 14px Inter,sans-serif'
      ctx.fillText(f.nombre, 80, y + 26)
      ctx.fillStyle = '#888'
      ctx.font = '11px Inter,sans-serif'
      ctx.fillText(`${f.hectareas} ha`, 80, y + 42)

      // estado
      if (f.estado) {
        ctx.fillStyle = '#2EAA6E'
        ctx.font = 'bold 12px Inter,sans-serif'
        ctx.fillText(f.estado.toUpperCase(), 220, y + 26)
      }

      // comentario
      if (f.comentario) {
        ctx.fillStyle = '#cccccc'
        ctx.font = '12px Inter,sans-serif'
        const lines = wrapText(ctx, f.comentario, 580, 12)
        lines.forEach((ln, li) => ctx.fillText(ln, 220, y + 44 + li * 16))
      }

      // aplicación
      if (f.aplicacion) {
        ctx.fillStyle = '#f59e0b'
        ctx.font = 'bold 11px Inter,sans-serif'
        ctx.fillText('📦 ' + f.aplicacion, 220, y + ROW_H - 18)
      }

      // separador
      ctx.fillStyle = '#222'
      ctx.fillRect(0, y + ROW_H - 1, W, 1)
    })

    // firma abajo
    ctx.fillStyle = '#2EAA6E'
    ctx.font = 'bold 12px Inter,sans-serif'
    ctx.fillText('Ing. Agr. Mariano J. Bertaina — M.P. 82-1-1075', 30, H - 22)
    ctx.fillStyle = '#555'
    ctx.font = '11px Inter,sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`Generado ${fmtFecha(fmtISO(new Date()))}`, W - 30, H - 22)
    ctx.textAlign = 'left'
  }

  function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const x = cx + r * Math.cos(a)
      const y = cy + r * Math.sin(a)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number) {
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    words.forEach(w => {
      const test = cur ? cur + ' ' + w : w
      if (ctx.measureText(test).width > maxW) { lines.push(cur); cur = w }
      else cur = test
    })
    if (cur) lines.push(cur)
    return lines.slice(0, 3)
  }

  function cultColorFor(c: string) {
    const s = (c ?? '').toLowerCase()
    if (s.includes('soja')) return '#22c55e'
    if (s.includes('maíz') || s.includes('maiz')) return '#f59e0b'
    if (s.includes('trigo')) return '#d97706'
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
    if (s.includes('sorgo')) return 'SOR'
    if (s.includes('girasol')) return 'GIR'
    return c?.slice(0, 3).toUpperCase() ?? '---'
  }

  async function compartirImagen() {
    const canvas = canvasRef.current
    if (!canvas) return
    generarImagen()
    canvas.toBlob(async blob => {
      if (!blob) return
      const file = new File([blob], 'informe-semanal.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Informe Semanal' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'informe-semanal.png'; a.click()
        URL.revokeObjectURL(url)
      }
    })
  }

  // ── guardar en DB ──────────────────────────────────────────────
  async function guardarInforme() {
    if (!productorId || !campanaId) return
    setGuardando(true)
    try {
      // 1. upsert informes_semanales
      const { data: inf, error: e1 } = await (sb as any)
        .from('informes_semanales')
        .upsert({
          ingeniero_id: userId,
          productor_id: productorId,
          campana_id: campanaId,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          titulo: `Semana ${semanaDelAnio(new Date(fechaDesde + 'T12:00:00'))}`,
        }, { onConflict: 'ingeniero_id,productor_id,campana_id,fecha_desde' })
        .select('id')
        .single()
      if (e1) throw e1

      // 2. upsert observaciones_lote para cada fila completa
      const rows = lotes
        .map(l => filas[l.id])
        .filter(f => f && (f.estado || f.comentario || f.aplicacion))
        .map(f => ({
          lote_id: f.lote_id,
          texto: [
            f.estado ? `[${f.estado}]` : '',
            f.comentario,
          ].filter(Boolean).join(' — '),
          tipo: 'informe_semanal',
          fecha: fechaHasta,
          datos_extra: {
            informe_id: inf.id,
            estado: f.estado,
            comentario: f.comentario,
            aplicacion: f.aplicacion,
            esta_semana: f.esta_semana,
          },
        }))
      if (rows.length > 0) {
        await (sb as any).from('observaciones_lote').insert(rows)
      }
      alert('✅ Informe guardado')
    } catch (err: any) {
      alert('Error: ' + (err.message ?? JSON.stringify(err)))
    } finally {
      setGuardando(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="label-xs text-ochre">MÓDULO</p>
          <h1 className="text-2xl font-black text-hi">Informe Semanal</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setVista(v => v === 'carga' ? 'preview' : 'carga')}
            className="btn-ghost text-sm"
          >
            {vista === 'carga' ? '👁 Ver informe' : '✏️ Editar'}
          </button>
          {vista === 'preview' && lotesInforme.length > 0 && (
            <button onClick={compartirImagen} className="btn-ochre text-sm">
              📷 Compartir imagen
            </button>
          )}
          <button
            onClick={guardarInforme}
            disabled={guardando || !productorId}
            className="btn-green text-sm"
          >
            {guardando ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label-xs text-mid block mb-1">Productor</label>
          <select
            value={productorId}
            onChange={e => setProductorId(e.target.value)}
            className="input-field w-full text-sm"
          >
            <option value="">— seleccioná —</option>
            {productores.map(p => (
              <option key={p.id} value={p.id}>{p.razon_social}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Campaña</label>
          <select
            value={campanaId}
            onChange={e => setCampanaId(e.target.value)}
            className="input-field w-full text-sm"
          >
            {campanas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="input-field w-full text-sm"
          />
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="input-field w-full text-sm"
          />
        </div>
      </div>

      {/* Sin productor */}
      {!productorId && (
        <div className="card p-8 text-center text-mid">
          Seleccioná un productor para cargar los lotes
        </div>
      )}

      {/* VISTA CARGA */}
      {vista === 'carga' && productorId && lotes.length === 0 && (
        <div className="card p-8 text-center text-mid">
          Sin lotes para este productor en la campaña seleccionada
        </div>
      )}

      {vista === 'carga' && productorId && lotes.length > 0 && (
        <div className="space-y-3">
          <p className="text-mid text-sm">
            {lotes.length} lotes · Tildá <strong className="text-ochre">"Esta semana"</strong> en los que visitaste
          </p>
          {lotes.map(l => {
            const f = filas[l.id] ?? { esta_semana: false, estado: '', comentario: '', aplicacion: '' }
            return (
              <div
                key={l.id}
                className={`card p-4 transition-all ${f.esta_semana ? 'border border-green-600' : 'border border-transparent opacity-70'}`}
              >
                {/* Cabecera lote */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: cultColorFor(l.cultivo), color: '#000' }}
                    >
                      {abrevCult(l.cultivo)}
                    </span>
                    <span className="text-hi font-bold">{l.nombre}</span>
                    <span className="text-mid text-xs">{l.hectareas} ha</span>
                  </div>
                  {/* Toggle esta semana */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-sm text-mid">Esta semana</span>
                    <div
                      onClick={() => setFila(l.id, 'esta_semana', !f.esta_semana)}
                      className={`w-10 h-5 rounded-full transition-all relative ${f.esta_semana ? 'bg-green-600' : 'bg-base-5'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${f.esta_semana ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </label>
                </div>

                {/* Campos — siempre visibles para poder escribir */}
                <div className="grid md:grid-cols-3 gap-3">
                  {/* Estado */}
                  <div>
                    <label className="label-xs text-mid block mb-1">Estado del lote</label>
                    <select
                      value={f.estado}
                      onChange={e => setFila(l.id, 'estado', e.target.value)}
                      className="input-field w-full text-sm"
                    >
                      <option value="">— sin estado —</option>
                      {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Comentario */}
                  <div>
                    <label className="label-xs text-mid block mb-1">Comentario</label>
                    <textarea
                      value={f.comentario}
                      onChange={e => setFila(l.id, 'comentario', e.target.value)}
                      placeholder="Observaciones del lote esta semana..."
                      rows={3}
                      className="input-field w-full text-sm resize-none"
                    />
                  </div>

                  {/* Aplicación */}
                  <div>
                    <label className="label-xs text-mid block mb-1">
                      Aplicación realizada
                      <span className="text-lo ml-1">(productos + dosis)</span>
                    </label>
                    <textarea
                      value={f.aplicacion}
                      onChange={e => setFila(l.id, 'aplicacion', e.target.value)}
                      placeholder="Ej: 2 lt Glifo + 1 lt Cletodim + 50 cc Silicona"
                      rows={3}
                      className="input-field w-full text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VISTA PREVIEW — informe */}
      {vista === 'preview' && productorId && (
        <div className="card p-6 space-y-4">
          {/* Encabezado informe */}
          <div className="border-b border-base-5 pb-4">
            <p className="text-ochre font-black text-xs uppercase tracking-widest mb-1">
              Informe Semanal · Semana {semanaDelAnio(new Date(fechaDesde + 'T12:00:00'))}
            </p>
            <p className="text-hi text-xl font-black">
              {productores.find(p => p.id === productorId)?.razon_social ?? ''}
            </p>
            <p className="text-mid text-sm mt-1">
              {fmtFecha(fechaDesde)} al {fmtFecha(fechaHasta)}
              &nbsp;·&nbsp; Campaña {campanas.find(c => c.id === campanaId)?.nombre ?? ''}
            </p>
          </div>

          {lotesInforme.length === 0 ? (
            <p className="text-mid text-sm text-center py-6">
              Ningún lote tildado como "esta semana" todavía
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-base-5">
                  <th className="text-left py-2 pr-4 text-mid font-semibold text-xs uppercase">Lote</th>
                  <th className="text-left py-2 pr-4 text-mid font-semibold text-xs uppercase">Estado</th>
                  <th className="text-left py-2 pr-4 text-mid font-semibold text-xs uppercase">Comentario</th>
                  <th className="text-left py-2 text-mid font-semibold text-xs uppercase">Aplicación</th>
                </tr>
              </thead>
              <tbody>
                {lotesInforme.map((f, i) => (
                  <tr key={f.lote_id} className={i % 2 === 0 ? 'bg-base-2' : ''}>
                    <td className="py-2 pr-4 font-bold text-ochre align-top whitespace-nowrap">
                      {f.nombre}
                      <span className="text-lo text-xs font-normal ml-1">{f.hectareas} ha</span>
                    </td>
                    <td className="py-2 pr-4 text-green-400 align-top whitespace-nowrap">
                      {f.estado || <span className="text-lo">—</span>}
                    </td>
                    <td className="py-2 pr-4 text-mid align-top">
                      {f.comentario || <span className="text-lo">—</span>}
                    </td>
                    <td className="py-2 text-hi align-top">
                      {f.aplicacion || <span className="text-lo">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Firma */}
          <div className="border-t border-base-5 pt-3 flex items-center justify-between text-xs text-lo">
            <span className="text-green-500 font-bold">Ing. Agr. Mariano J. Bertaina · M.P. 82-1-1075</span>
            <span>Generado {fmtFecha(fmtISO(new Date()))}</span>
          </div>
        </div>
      )}

      {/* Canvas oculto para imagen */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
