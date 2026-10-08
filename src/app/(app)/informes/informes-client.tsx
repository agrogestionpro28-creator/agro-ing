'use client'
import { useState, useEffect } from 'react'
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
  aplicacion: string
  esta_semana: boolean
  imagenes: (File | null)[]
  imagenesPreview: (string | null)[]
}

// ── Estados por cultivo ────────────────────────────────────────
const ESTADOS_COMUNES = [
  'Barbecho largo', 'Barbecho corto', 'Barbecho intermedio', 'Cosechado', 'Sin dato',
]
const ESTADOS_SOJA = [
  'Implantación','VE - Emergencia','V1 - V2','V3 - V5','V6 - V8',
  'R1 - Floración','R2 - Floración plena','R3 - Inicio fructificación',
  'R4 - Fructificación plena','R5 - Inicio llenado','R6 - Llenado pleno',
  'R7 - Madurez fisiológica','R8 - Madurez cosecha',
]
const ESTADOS_MAIZ = [
  'Implantación','VE - Emergencia','V1 - V3','V4 - V6','V7 - V9','V10 - V12',
  'VT - Panojamiento','R1 - Silking / Floración','R2 - Ampolla',
  'R3 - Lechoso','R4 - Masoso','R5 - Dentado','R6 - Madurez fisiológica',
]
const ESTADOS_TRIGO_CEBADA = [
  'Implantación','Macollaje inicial','Macollaje activo','Encañado Z31',
  'Encañado Z32-Z37','Hoja bandera Z39','Espigado Z55','Floración Z65',
  'Grano acuoso','Grano lechoso','Grano pastoso','Madurez fisiológica',
]
const ESTADOS_SORGO = [
  'Implantación','VE - Emergencia','V3 - V5','V6 - V9',
  'Panojamiento','Floración','Grano lechoso','Grano pastoso','Madurez fisiológica',
]
const ESTADOS_GIRASOL = [
  'Implantación','VE - Emergencia','V2 - V4','V6 - V8',
  'R1 - Botón floral','R3 - Floración','R5 - Llenado de grano',
  'R7 - Madurez fisiológica','R9 - Madurez cosecha',
]

function estadosPara(cultivo: string): string[] {
  const s = (cultivo ?? '').toLowerCase()
  let esp: string[] = []
  if (s.includes('soja')) esp = ESTADOS_SOJA
  else if (s.includes('maíz') || s.includes('maiz')) esp = ESTADOS_MAIZ
  else if (s.includes('trigo') || s.includes('cebada')) esp = ESTADOS_TRIGO_CEBADA
  else if (s.includes('sorgo')) esp = ESTADOS_SORGO
  else if (s.includes('girasol')) esp = ESTADOS_GIRASOL
  return [...esp, ...ESTADOS_COMUNES]
}

// ── Helpers ────────────────────────────────────────────────────
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
function cultColorFor(c: string): [number, number, number] {
  const s = (c ?? '').toLowerCase()
  if (s.includes('soja')) return [34, 197, 94]
  if (s.includes('maíz') || s.includes('maiz')) return [245, 158, 11]
  if (s.includes('trigo') || s.includes('cebada')) return [217, 119, 6]
  if (s.includes('sorgo')) return [239, 68, 68]
  if (s.includes('girasol')) return [234, 179, 8]
  return [107, 114, 128]
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

// Convierte File a dataURL
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target!.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── Componente ─────────────────────────────────────────────────
export function InformesClient({
  productores, campanas, userId,
}: {
  productores: Productor[]
  campanas: Campana[]
  userId: string
}) {
  const sb = createClient()
  const { campanaId: campanaCtxId } = useCampana()

  const [campanaId, setCampanaId] = useState(() => campanas[0]?.id ?? '')
  const [productorId, setProductorId] = useState('')

  useEffect(() => {
    if (campanaCtxId && campanaCtxId !== campanaId) setCampanaId(campanaCtxId)
  }, [campanaCtxId])

  const [lotes, setLotes] = useState<Lote[]>([])
  const [filas, setFilas] = useState<Record<string, LoteInforme>>({})
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [vista, setVista] = useState<'carga' | 'preview'>('carga')

  const hoy = new Date()
  const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dow)
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
  const fmtISO = (d: Date) => d.toISOString().slice(0, 10)

  const [fechaDesde, setFechaDesde] = useState(fmtISO(lunes))
  const [fechaHasta, setFechaHasta] = useState(fmtISO(domingo))

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
          if (!next[l.id]) next[l.id] = {
            lote_id: l.id, nombre: l.nombre, hectareas: l.hectareas,
            cultivo: l.cultivo, estado: '', comentario: '', aplicacion: '',
            esta_semana: false, imagenes: [null, null], imagenesPreview: [null, null],
          }
        })
        return next
      })
    })()
  }, [productorId, campanaId])

  function setFila(loteId: string, campo: keyof LoteInforme, valor: any) {
    setFilas(prev => ({ ...prev, [loteId]: { ...prev[loteId], [campo]: valor } }))
  }

  function handleImagenChange(loteId: string, slot: 0 | 1, file: File | null) {
    if (!file) {
      setFilas(prev => {
        const f = { ...prev[loteId] }
        const imgs = [...f.imagenes] as (File | null)[]
        const prevs = [...f.imagenesPreview] as (string | null)[]
        imgs[slot] = null; prevs[slot] = null
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
        imgs[slot] = file; prevs[slot] = dataUrl
        return { ...prev, [loteId]: { ...f, imagenes: imgs, imagenesPreview: prevs } }
      })
    }
    reader.readAsDataURL(file)
  }

  const lotesInforme = lotes.map(l => filas[l.id]).filter(f => f?.esta_semana)

  // ── Generar PDF ────────────────────────────────────────────────
  async function generarPDF(accion: 'descargar' | 'compartir') {
    if (lotesInforme.length === 0) return
    setGenerando(true)
    try {
      const { jsPDF } = await import('jspdf')

      const productor = productores.find(p => p.id === productorId)
      const campana = campanas.find(c => c.id === campanaId)
      const semana = semanaDelAnio(new Date(fechaDesde + 'T12:00:00'))

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const PW = 210   // page width mm
      const PH = 297   // page height mm
      const ML = 14    // margin left
      const MR = 14    // margin right
      const CW = PW - ML - MR  // content width

      // ── Banda verde superior ───────────────────────────────────
      doc.setFillColor(46, 170, 110)
      doc.rect(0, 0, PW, 6, 'F')

      // ── Encabezado ─────────────────────────────────────────────
      doc.setFillColor(10, 10, 10)
      doc.rect(0, 6, PW, 34, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(245, 158, 11)
      doc.text(`INFORME SEMANAL — SEMANA ${semana}`, ML, 14)

      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text((productor?.razon_social ?? '').toUpperCase(), ML, 24)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `${fmtFecha(fechaDesde)} al ${fmtFecha(fechaHasta)}   ·   Campaña ${campana?.nombre ?? ''}`,
        ML, 32
      )

      // línea separadora verde
      doc.setFillColor(46, 170, 110)
      doc.rect(0, 40, PW, 1, 'F')

      // ── Lotes ──────────────────────────────────────────────────
      let y = 46
      const PAGE_BOTTOM = PH - 18

      function checkPage(needed: number) {
        if (y + needed > PAGE_BOTTOM) {
          doc.addPage()
          // banda y fondo en nueva página
          doc.setFillColor(46, 170, 110)
          doc.rect(0, 0, PW, 3, 'F')
          doc.setFillColor(10, 10, 10)
          doc.rect(0, 3, PW, PH - 3, 'F')
          y = 10
        }
      }

      // fondo negro para todo el cuerpo (primera página)
      doc.setFillColor(10, 10, 10)
      doc.rect(0, 41, PW, PH - 41, 'F')

      for (let i = 0; i < lotesInforme.length; i++) {
        const f = lotesInforme[i]
        const [cr, cg, cb] = cultColorFor(f.cultivo)
        const hasImgs = (f.imagenes ?? []).some(img => img !== null)
        const imgs = f.imagenes ?? [null, null]

        // Calcular altura mínima del bloque
        // Texto comentario (aprox 5mm por línea de 90 chars)
        const comentLines = f.comentario
          ? doc.splitTextToSize(f.comentario, hasImgs ? CW - 74 : CW - 4)
          : []
        const aplicLines = f.aplicacion
          ? doc.splitTextToSize(f.aplicacion, hasImgs ? CW - 74 : CW - 4)
          : []

        const textH = 8 + (comentLines.length * 4.5) + (aplicLines.length > 0 ? 5 + aplicLines.length * 4.5 : 0)
        const imgH = hasImgs ? 38 : 0
        const blockH = Math.max(textH, imgH) + 6

        checkPage(blockH + 2)

        // fondo alterno sutil
        doc.setFillColor(i % 2 === 0 ? 17 : 22, i % 2 === 0 ? 17 : 22, i % 2 === 0 ? 17 : 22)
        doc.rect(ML - 2, y - 2, CW + 4, blockH, 'F')

        // badge cultivo
        doc.setFillColor(cr, cg, cb)
        doc.roundedRect(ML, y, 12, 5.5, 1, 1, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setTextColor(0, 0, 0)
        doc.text(abrevCult(f.cultivo), ML + 6, y + 4, { align: 'center' })

        // nombre lote
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(245, 158, 11)
        doc.text(f.nombre, ML + 15, y + 4.5)

        // hectáreas
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        const nmW = doc.getTextWidth(f.nombre)
        doc.text(`${f.hectareas} ha`, ML + 15 + nmW + 2, y + 4.5)

        // estado
        if (f.estado) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(46, 170, 110)
          doc.text(f.estado, ML + 15, y + 10)
        }

        const textX = ML + 15
        const textMaxW = hasImgs ? CW - 72 : CW - 15
        let ty = y + (f.estado ? 16 : 12)

        // comentario
        if (comentLines.length > 0) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(210, 210, 210)
          doc.text(comentLines, textX, ty)
          ty += comentLines.length * 4.5 + 2
        }

        // aplicación
        if (aplicLines.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(245, 158, 11)
          doc.text('Aplicación: ', textX, ty)
          const apW = doc.getTextWidth('Aplicación: ')
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(220, 220, 220)
          // primera línea junto a "Aplicación:"
          if (aplicLines.length > 0) {
            doc.text(aplicLines[0], textX + apW, ty)
            for (let al = 1; al < aplicLines.length; al++) {
              ty += 4.5
              doc.text(aplicLines[al], textX, ty)
            }
          }
        }

        // imágenes a la derecha
        if (hasImgs) {
          const IMG_X_START = ML + CW - 68
          const IMG_W = 32
          const IMG_H = 30
          let xi = 0
          for (const imgFile of imgs) {
            if (!imgFile) { xi++; continue }
            try {
              const dataUrl = await fileToDataUrl(imgFile)
              const imgX = IMG_X_START + xi * (IMG_W + 4)
              doc.addImage(dataUrl, 'JPEG', imgX, y, IMG_W, IMG_H, undefined, 'FAST')
            } catch { /* skip */ }
            xi++
          }
        }

        // separador
        doc.setDrawColor(40, 40, 40)
        doc.setLineWidth(0.3)
        doc.line(ML - 2, y + blockH, ML + CW + 2, y + blockH)

        y += blockH + 3
      }

      // ── Firma ──────────────────────────────────────────────────
      // asegurar que la firma entre en la página actual o agregar nueva
      checkPage(10)
      doc.setFillColor(46, 170, 110)
      doc.rect(0, PH - 10, PW, 10, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(255, 255, 255)
      doc.text('Ing. Agr. Mariano J. Bertaina  —  M.P. 82-1-1075', ML, PH - 4)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(220, 255, 220)
      doc.text(`Generado ${fmtFecha(fmtISO(new Date()))}`, PW - MR, PH - 4, { align: 'right' })

      // ── Salida ─────────────────────────────────────────────────
      const nombreArchivo = `informe-semana${semana}-${(productor?.razon_social ?? 'lote').replace(/\s+/g, '-').toLowerCase()}.pdf`

      if (accion === 'descargar') {
        doc.save(nombreArchivo)
      } else {
        // compartir como blob
        const blob = doc.output('blob')
        const file = new File([blob], nombreArchivo, { type: 'application/pdf' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Informe Semanal' })
        } else {
          doc.save(nombreArchivo)
        }
      }
    } catch (err: any) {
      alert('Error al generar PDF: ' + (err.message ?? String(err)))
    } finally {
      setGenerando(false)
    }
  }

  // ── Guardar en DB ──────────────────────────────────────────────
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
        .select('id').single()
      if (e1) throw e1

      const rows = lotes
        .map(l => filas[l.id])
        .filter(f => f && (f.estado || f.comentario || f.aplicacion))
        .map(f => ({
          lote_id: f.lote_id,
          texto: [f.estado ? `[${f.estado}]` : '', f.comentario].filter(Boolean).join(' — '),
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
      if (rows.length > 0) await (sb as any).from('observaciones_lote').insert(rows)
      alert('✅ Informe guardado')
    } catch (err: any) {
      alert('Error: ' + (err.message ?? JSON.stringify(err)))
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────
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
            <>
              <button
                onClick={() => generarPDF('descargar')}
                disabled={generando}
                className="btn-ghost text-sm"
              >
                {generando ? 'Generando...' : '⬇️ Descargar PDF'}
              </button>
              <button
                onClick={() => generarPDF('compartir')}
                disabled={generando}
                className="btn-ochre text-sm"
              >
                📤 Compartir PDF
              </button>
            </>
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
          <select value={productorId} onChange={e => setProductorId(e.target.value)} className="field w-full text-sm">
            <option value="">— seleccioná —</option>
            {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Campaña</label>
          <select value={campanaId} onChange={e => setCampanaId(e.target.value)} className="field w-full text-sm">
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="field w-full text-sm" />
        </div>
        <div>
          <label className="label-xs text-mid block mb-1">Hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="field w-full text-sm" />
        </div>
      </div>

      {!productorId && (
        <div className="card p-8 text-center text-mid">Seleccioná un productor para cargar los lotes</div>
      )}

      {/* VISTA CARGA */}
      {vista === 'carga' && productorId && lotes.length === 0 && (
        <div className="card p-8 text-center text-mid">Sin lotes para este productor en la campaña seleccionada</div>
      )}

      {vista === 'carga' && productorId && lotes.length > 0 && (
        <div className="space-y-3">
          <p className="text-mid text-sm">
            {lotes.length} lotes · Tildá <strong className="text-ochre">"Esta semana"</strong> en los que visitaste
          </p>
          {lotes.map(l => {
            const f = filas[l.id] ?? { esta_semana: false, estado: '', comentario: '', aplicacion: '', imagenes: [null, null], imagenesPreview: [null, null] }
            const [cr, cg, cb] = cultColorFor(l.cultivo)
            return (
              <div key={l.id} className={`card p-4 transition-all ${f.esta_semana ? 'border border-green-600' : 'border border-transparent opacity-70'}`}>
                {/* Cabecera */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `rgb(${cr},${cg},${cb})`, color: '#000' }}>
                      {abrevCult(l.cultivo)}
                    </span>
                    <span className="text-hi font-bold">{l.nombre}</span>
                    <span className="text-mid text-xs">{l.hectareas} ha</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-sm text-mid">Esta semana</span>
                    <div onClick={() => setFila(l.id, 'esta_semana', !f.esta_semana)} className={`w-10 h-5 rounded-full transition-all relative ${f.esta_semana ? 'bg-green-600' : 'bg-base-5'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${f.esta_semana ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </label>
                </div>

                {/* Campos */}
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="label-xs text-mid block mb-1">Estado del lote</label>
                    <select value={f.estado} onChange={e => setFila(l.id, 'estado', e.target.value)} className="field w-full text-sm">
                      <option value="">— sin estado —</option>
                      {estadosPara(l.cultivo).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-xs text-mid block mb-1">Comentario</label>
                    <textarea value={f.comentario} onChange={e => setFila(l.id, 'comentario', e.target.value)} placeholder="Observaciones del lote esta semana..." rows={3} className="field w-full text-sm resize-none" />
                  </div>
                  <div>
                    <label className="label-xs text-mid block mb-1">Aplicación realizada <span className="text-lo">(productos + dosis)</span></label>
                    <textarea value={f.aplicacion} onChange={e => setFila(l.id, 'aplicacion', e.target.value)} placeholder="Ej: 2 lt Glifo + 1 lt Cletodim + 50 cc Silicona" rows={3} className="field w-full text-sm resize-none" />
                  </div>
                </div>

                {/* Fotos */}
                <div className="mt-3 pt-3 border-t border-base-5">
                  <p className="label-xs text-mid mb-2">Fotos del lote <span className="text-lo">(hasta 2)</span></p>
                  <div className="flex gap-3 flex-wrap">
                    {([0, 1] as const).map(slot => {
                      const preview = f.imagenesPreview?.[slot] ?? null
                      return (
                        <div key={slot} className="relative">
                          {preview ? (
                            <div className="relative group">
                              <img src={preview} alt={`Foto ${slot + 1}`} className="w-28 h-20 object-cover rounded border border-base-5" />
                              <button onClick={() => handleImagenChange(l.id, slot, null)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                            </div>
                          ) : (
                            <label className="w-28 h-20 border-2 border-dashed border-base-5 rounded flex flex-col items-center justify-center cursor-pointer hover:border-ochre transition-colors gap-1">
                              <span className="text-xl">📷</span>
                              <span className="text-lo text-xs">Foto {slot + 1}</span>
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleImagenChange(l.id, slot, e.target.files?.[0] ?? null)} />
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

      {/* VISTA PREVIEW */}
      {vista === 'preview' && productorId && (
        <div className="card p-6 space-y-4">
          <div className="border-b border-base-5 pb-4">
            <p className="text-ochre font-black text-xs uppercase tracking-widest mb-1">
              Informe Semanal · Semana {semanaDelAnio(new Date(fechaDesde + 'T12:00:00'))}
            </p>
            <p className="text-hi text-xl font-black">{productores.find(p => p.id === productorId)?.razon_social ?? ''}</p>
            <p className="text-mid text-sm mt-1">
              {fmtFecha(fechaDesde)} al {fmtFecha(fechaHasta)}&nbsp;·&nbsp;Campaña {campanas.find(c => c.id === campanaId)?.nombre ?? ''}
            </p>
          </div>

          {lotesInforme.length === 0 ? (
            <p className="text-mid text-sm text-center py-6">Ningún lote tildado como "esta semana" todavía</p>
          ) : (
            <div className="space-y-3">
              {lotesInforme.map((f, i) => {
                const [cr, cg, cb] = cultColorFor(f.cultivo)
                const previews = (f.imagenesPreview ?? []).filter(Boolean) as string[]
                return (
                  <div key={f.lote_id} className={`rounded border border-base-5 p-3 ${i % 2 === 0 ? 'bg-base-2' : ''}`}>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `rgb(${cr},${cg},${cb})`, color: '#000' }}>{abrevCult(f.cultivo)}</span>
                          <span className="text-ochre font-bold">{f.nombre}</span>
                          <span className="text-lo text-xs">{f.hectareas} ha</span>
                          {f.estado && <span className="text-green-400 text-xs font-semibold">{f.estado}</span>}
                        </div>
                        {f.comentario && <p className="text-mid text-sm mb-1">{f.comentario}</p>}
                        {f.aplicacion && <p className="text-ochre text-xs font-semibold">📦 {f.aplicacion}</p>}
                      </div>
                      {previews.length > 0 && (
                        <div className="flex gap-2 shrink-0">
                          {previews.map((src, si) => (
                            <img key={si} src={src} alt={`Foto ${si + 1}`} className="w-24 h-16 object-cover rounded border border-base-5" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="border-t border-base-5 pt-3 flex items-center justify-between text-xs text-lo">
            <span className="text-green-500 font-bold">Ing. Agr. Mariano J. Bertaina · M.P. 82-1-1075</span>
            <span>Generado {fmtFecha(fmtISO(new Date()))}</span>
          </div>
        </div>
      )}
    </div>
  )
}
