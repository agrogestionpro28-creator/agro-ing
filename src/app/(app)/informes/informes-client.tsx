'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampana } from '@/components/layout/app-shell'

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
  imagenes: (File | null)[]  // hasta 2 imágenes
  imagenesPreview: (string | null)[]  // data URLs para preview
}

// Estados por grupo de cultivo
const ESTADOS_COMUNES = [
  'Barbecho largo',
  'Barbecho corto',
  'Barbecho intermedio',
  'Cosechado',
  'Sin dato',
]

const ESTADOS_SOJA = [
  'Implantación',
  'VE - Emergencia',
  'V1 - V2',
  'V3 - V5',
  'V6 - V8',
  'R1 - Floración',
  'R2 - Floración plena',
  'R3 - Inicio fructificación',
  'R4 - Fructificación plena',
  'R5 - Inicio llenado',
  'R6 - Llenado pleno',
  'R7 - Madurez fisiológica',
  'R8 - Madurez cosecha',
]

const ESTADOS_MAIZ = [
  'Implantación',
  'VE - Emergencia',
  'V1 - V3',
  'V4 - V6',
  'V7 - V9',
  'V10 - V12',
  'VT - Panojamiento',
  'R1 - Silking / Floración',
  'R2 - Ampolla',
  'R3 - Lechoso',
  'R4 - Masoso',
  'R5 - Dentado',
  'R6 - Madurez fisiológica',
]

const ESTADOS_TRIGO_CEBADA = [
  'Implantación',
  'Macollaje inicial',
  'Macollaje activo',
  'Encañado Z31',
  'Encañado Z32-Z37',
  'Hoja bandera Z39',
  'Espigado Z55',
  'Floración Z65',
  'Grano acuoso',
  'Grano lechoso',
  'Grano pastoso',
  'Madurez fisiológica',
]

const ESTADOS_SORGO = [
  'Implantación',
  'VE - Emergencia',
  'V3 - V5',
  'V6 - V9',
  'Panojamiento',
  'Floración',
  'Grano lechoso',
  'Grano pastoso',
  'Madurez fisiológica',
]

const ESTADOS_GIRASOL = [
  'Implantación',
  'VE - Emergencia',
  'V2 - V4',
  'V6 - V8',
  'R1 - Botón floral',
  'R3 - Floración',
  'R5 - Llenado de grano',
  'R7 - Madurez fisiológica',
  'R9 - Madurez cosecha',
]

function estadosPara(cultivo: string): string[] {
  const s = (cultivo ?? '').toLowerCase()
  let especificos: string[] = []
  if (s.includes('soja')) especificos = ESTADOS_SOJA
  else if (s.includes('maíz') || s.includes('maiz')) especificos = ESTADOS_MAIZ
  else if (s.includes('trigo') || s.includes('cebada')) especificos = ESTADOS_TRIGO_CEBADA
  else if (s.includes('sorgo')) especificos = ESTADOS_SORGO
  else if (s.includes('girasol')) especificos = ESTADOS_GIRASOL
  return [...especificos, ...ESTADOS_COMUNES]
}

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

// Carga una imagen desde File y devuelve HTMLImageElement
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = reject
    img.src = url
  })
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
  const { campanaId: campanaCtxId } = useCampana()

  // ── estado global ──────────────────────────────────────────────
  const [campanaId, setCampanaId] = useState(() => campanas[0]?.id ?? '')
  const [productorId, setProductorId] = useState('')

  useEffect(() => {
    if (campanaCtxId && campanaCtxId !== campanaId) {
      setCampanaId(campanaCtxId)
    }
  }, [campanaCtxId])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [filas, setFilas] = useState<Record<string, LoteInforme>>({})
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState<'carga' | 'preview'>('carga')

  // fechas por defecto: lunes y domingo de la semana actual
  const hoy = new Date()
  const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
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
              imagenes: [null, null],
              imagenesPreview: [null, null],
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

  // Maneja la selección de imagen para un lote (slot 0 o 1)
  function handleImagenChange(loteId: string, slot: 0 | 1, file: File | null) {
    if (!file) {
      setFilas(prev => {
        const f = { ...prev[loteId] }
        const imgs = [...f.imagenes] as (File | null)[]
        const prevs = [...f.imagenesPreview] as (string | null)[]
        imgs[slot] = null
        prevs[slot] = null
        return { ...prev, [loteId]: { ...f, imagenes: imgs, imagenesPreview: prevs } }
      })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setFilas(prev => {
        const f = { ...prev[loteId] }
        const imgs = [...f.imagenes] as (File | null)[]
        const prevs = [...f.imagenesPreview] as (string | null)[]
        imgs[slot] = file
        prevs[slot] = dataUrl
        return { ...prev, [loteId]: { ...f, imagenes: imgs, imagenesPreview: prevs } }
      })
    }
    reader.readAsDataURL(file)
  }

  // lotes con "esta semana" tildado
  const lotesInforme = lotes
    .map(l => filas[l.id])
    .filter(f => f?.esta_semana)

  // ── generar imagen para WhatsApp ───────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function generarImagen() {
    const canvas = canvasRef.current
    if (!canvas || lotesInforme.length === 0) return

    // Pre-cargar todas las imágenes de los lotes
    const imgObjects: (HTMLImageElement | null)[][] = await Promise.all(
      lotesInforme.map(async f => {
        const imgs = await Promise.all(
          (f.imagenes ?? [null, null]).map(async file => {
            if (!file) return null
            try { return await loadImageFromFile(file) } catch { return null }
          })
        )
        return imgs
      })
    )

    const W = 900
    // Altura de cada fila: base + espacio para imágenes si las hay
    const getRowH = (idx: number) => {
      const hasImgs = imgObjects[idx].some(i => i !== null)
      return hasImgs ? 230 : 110
    }
    const HEAD_H = 160
    const totalRows = lotesInforme.reduce((acc, _, i) => acc + getRowH(i), 0)
    const H = HEAD_H + totalRows + 80
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
    let currentY = HEAD_H
    lotesInforme.forEach((f, i) => {
      const rowH = getRowH(i)
      const y = currentY
      const hasImgs = imgObjects[i].some(img => img !== null)

      // fondo alterno
      ctx.fillStyle = i % 2 === 0 ? '#111111' : '#151515'
      ctx.fillRect(0, y, W, rowH)

      // badge cultivo
      const cultColor = cultColorFor(f.cultivo)
      ctx.fillStyle = cultColor
      ctx.beginPath()
      ;(ctx as any).roundRect?.(28, y + 14, 42, 20, 4) || (() => { ctx.rect(28, y + 14, 42, 20) })()
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
        const maxW = hasImgs ? 380 : 580
        const lines = wrapText(ctx, f.comentario, maxW, 12)
        lines.forEach((ln, li) => ctx.fillText(ln, 220, y + 44 + li * 16))
      }

      // aplicación
      if (f.aplicacion) {
        ctx.fillStyle = '#f59e0b'
        ctx.font = 'bold 11px Inter,sans-serif'
        ctx.fillText('📦 ' + f.aplicacion, 220, y + (hasImgs ? 100 : rowH - 18))
      }

      // imágenes (si las hay) — a la derecha, dos columnas
      if (hasImgs) {
        const IMG_W = 170
        const IMG_H = 130
        const IMG_Y = y + 14
        imgObjects[i].forEach((img, slot) => {
          if (!img) return
          const IMG_X = W - (2 - slot) * (IMG_W + 12) - 20
          // recorte proporcional centrado (cover)
          const scale = Math.max(IMG_W / img.naturalWidth, IMG_H / img.naturalHeight)
          const sw = IMG_W / scale
          const sh = IMG_H / scale
          const sx = (img.naturalWidth - sw) / 2
          const sy = (img.naturalHeight - sh) / 2
          // borde redondeado (clip)
          ctx.save()
          ctx.beginPath()
          ;(ctx as any).roundRect?.(IMG_X, IMG_Y, IMG_W, IMG_H, 6) || (() => { ctx.rect(IMG_X, IMG_Y, IMG_W, IMG_H) })()
          ctx.clip()
          ctx.drawImage(img, sx, sy, sw, sh, IMG_X, IMG_Y, IMG_W, IMG_H)
          ctx.restore()
        })
      }

      // separador
      ctx.fillStyle = '#222'
      ctx.fillRect(0, y + rowH - 1, W, 1)

      currentY += rowH
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
    await generarImagen()
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
            className="field w-full text-sm"
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
            className="field w-full text-sm"
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
            className="field w-full text-sm"
          />
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="field w-full text-sm"
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
            const f = filas[l.id] ?? { esta_semana: false, estado: '', comentario: '', aplicacion: '', imagenes: [null, null], imagenesPreview: [null, null] }
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

                {/* Campos */}
                <div className="grid md:grid-cols-3 gap-3">
                  {/* Estado */}
                  <div>
                    <label className="label-xs text-mid block mb-1">Estado del lote</label>
                    <select
                      value={f.estado}
                      onChange={e => setFila(l.id, 'estado', e.target.value)}
                      className="field w-full text-sm"
                    >
                      <option value="">— sin estado —</option>
                      {estadosPara(l.cultivo).map(s => <option key={s} value={s}>{s}</option>)}
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
                      className="field w-full text-sm resize-none"
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
                      className="field w-full text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Imágenes — hasta 2 por lote */}
                <div className="mt-3 pt-3 border-t border-base-5">
                  <p className="label-xs text-mid mb-2">Fotos del lote <span className="text-lo">(hasta 2)</span></p>
                  <div className="flex gap-3 flex-wrap">
                    {([0, 1] as const).map(slot => {
                      const preview = f.imagenesPreview?.[slot] ?? null
                      return (
                        <div key={slot} className="relative">
                          {preview ? (
                            <div className="relative group">
                              <img
                                src={preview}
                                alt={`Foto ${slot + 1}`}
                                className="w-28 h-20 object-cover rounded border border-base-5"
                              />
                              <button
                                onClick={() => handleImagenChange(l.id, slot, null)}
                                className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Quitar foto"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <label className="w-28 h-20 border-2 border-dashed border-base-5 rounded flex flex-col items-center justify-center cursor-pointer hover:border-ochre transition-colors gap-1">
                              <span className="text-xl">📷</span>
                              <span className="text-lo text-xs">Foto {slot + 1}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => handleImagenChange(l.id, slot, e.target.files?.[0] ?? null)}
                              />
                            </label>
                          )}
                        </div>
                      )
                    })}
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
            <div className="space-y-4">
              {lotesInforme.map((f, i) => {
                const previews = (f.imagenesPreview ?? []).filter(Boolean) as string[]
                return (
                  <div key={f.lote_id} className={`rounded border border-base-5 p-3 ${i % 2 === 0 ? 'bg-base-2' : ''}`}>
                    <div className="flex flex-wrap gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{ background: cultColorFor(f.cultivo), color: '#000' }}
                          >
                            {abrevCult(f.cultivo)}
                          </span>
                          <span className="text-ochre font-bold">{f.nombre}</span>
                          <span className="text-lo text-xs">{f.hectareas} ha</span>
                          {f.estado && (
                            <span className="text-green-400 text-xs font-semibold">{f.estado}</span>
                          )}
                        </div>
                        {f.comentario && (
                          <p className="text-mid text-sm mb-1">{f.comentario}</p>
                        )}
                        {f.aplicacion && (
                          <p className="text-ochre text-xs font-semibold">📦 {f.aplicacion}</p>
                        )}
                      </div>

                      {/* Fotos en preview */}
                      {previews.length > 0 && (
                        <div className="flex gap-2 shrink-0">
                          {previews.map((src, si) => (
                            <img
                              key={si}
                              src={src}
                              alt={`Foto ${si + 1}`}
                              className="w-24 h-16 object-cover rounded border border-base-5"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
