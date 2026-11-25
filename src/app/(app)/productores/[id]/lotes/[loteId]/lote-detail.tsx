'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const CULTIVOS = ['Soja','Soja 2°','Maíz','Trigo','Girasol','Sorgo','Cebada','Alfalfa','Otro'];
const TIPOS_BASE = ['Herbicida','Fungicida','Insecticida','Fertilizante','Inoculante','Otro'];

function cropColor(c: string | null) {
  if (!c) return '#a3a3a3';
  const n = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (n.includes('soja'))    return '#22c55e';
  if (n.includes('maiz'))    return '#84cc16';
  if (n.includes('trigo'))   return '#f59e0b';
  if (n.includes('cebada'))  return '#fbbf24';
  if (n.includes('sorgo'))   return '#ea580c';
  if (n.includes('girasol')) return '#38bdf8';
  if (n.includes('alfalfa')) return '#34d399';
  return '#a3a3a3';
}

type Lote = { id:string; productor_id:string; campana_id:string; nombre:string; hectareas:number; cultivo:string|null; cultivo_2:string|null; variedad:string|null; fecha_siembra:string|null; fecha_cosecha:string|null; notas:string|null; tecnologia_soja:string|null };
type LoteSimple = { id:string; nombre:string; hectareas:number; cultivo:string|null };
type Aplicacion = { id:string; lote_id:string; fecha:string; tipo:string; productos:string|null; maquinaria:string; propio_alq:string; contratista:string|null; costo_ha:number|null; hectareas_apl:number|null; observaciones:string|null; imagen_url:string|null };
type Ingeniero = { nombre:string; apellido:string|null; matricula:string|null; telefono:string|null };

const APL_VACIO = { fecha:new Date().toISOString().slice(0,10), tipo:'Herbicida', productos:'', maquinaria:'M', propio_alq:'Propio', contratista:'', costo_ha:'', hectareas_apl:'', observaciones:'' };

export function LoteDetail({ lote:initial, productorId, productorNombre, ingeniero }: { lote:Lote; productorId:string; productorNombre:string; ingeniero:Ingeniero|null }) {
  const [lote, setLote] = useState(initial);
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([]);
  const [lotesProductor, setLotesProductor] = useState<LoteSimple[]>([]);
  const [editando, setEditando] = useState(false);
  const [showAplForm, setShowAplForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingApl, setSavingApl] = useState(false);
  const [err, setErr] = useState('');
  const [lotesSeleccionados, setLotesSeleccionados] = useState<string[]>([initial.id]);
  const [aplForm, setAplForm] = useState({...APL_VACIO, hectareas_apl:String(initial.hectareas)});
  const [form, setForm] = useState({ nombre:initial.nombre, hectareas:String(initial.hectareas), cultivo:initial.cultivo??'', cultivo_2:initial.cultivo_2??'', variedad:initial.variedad??'', fecha_siembra:initial.fecha_siembra??'', notas:initial.notas??'', tecnologia_soja:initial.tecnologia_soja??'' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showAplForm2, setShowAplForm2] = useState(false);
  const [aplForm2, setAplForm2] = useState({ fecha: new Date().toISOString().slice(0,10), tipo: 'Herbicida', productos: '', maquinaria: 'M', propio_alq: 'Propio', contratista: '', costo_ha: '', observaciones: '' });
  const [savingApl2, setSavingApl2] = useState(false);
  const [errApl2, setErrApl2] = useState('');
  const [tiposSeleccionados2, setTiposSeleccionados2] = useState<string[]>(['Herbicida']);
  const [editandoApl, setEditandoApl] = useState<Aplicacion|null>(null);
  const [savingEditApl, setSavingEditApl] = useState(false);
  const [fertilizaciones, setFertilizaciones] = useState<any[]>([]);
  const [showFertiForm, setShowFertiForm] = useState(false);
  const [fertiForm, setFertiForm] = useState({ fecha: new Date().toISOString().slice(0,10), momento: 'siembra', productos: '', observaciones: '' });
  const [savingFerti, setSavingFerti] = useState(false);

  const cultivoActual = lote.cultivo || lote.cultivo_2;
  const color = cropColor(cultivoActual??null);
  const maqLabel: Record<string,string> = { M:'🚜 Mosquito', D:'🚁 Dron', A:'✈ Avión' };

  useEffect(() => { fetchAplicaciones(); fetchLotesProductor(); fetchFertilizaciones(); }, [lote.id]);

  async function fetchAplicaciones() {
    const { data } = await (createClient() as any).from('aplicaciones')
      .select('*').eq('lote_id', lote.id).order('fecha', { ascending: false });
    setAplicaciones(data ?? []);
  }

  async function fetchFertilizaciones() {
    const { data } = await (createClient() as any).from('fertilizaciones')
      .select('*').eq('lote_id', lote.id).order('fecha', { ascending: false });
    setFertilizaciones(data ?? []);
  }

  async function guardarFertilizacion() {
    if (!fertiForm.productos.trim()) return;
    setSavingFerti(true);
    const { error } = await (createClient() as any).from('fertilizaciones').insert({
      lote_id: lote.id,
      fecha: fertiForm.fecha,
      momento: fertiForm.momento,
      productos: fertiForm.productos.trim(),
      observaciones: fertiForm.observaciones.trim() || null,
    });
    setSavingFerti(false);
    if (error) return;
    setFertiForm({ fecha: new Date().toISOString().slice(0,10), momento: 'siembra', productos: '', observaciones: '' });
    setShowFertiForm(false);
    await fetchFertilizaciones();
  }

  async function eliminarFertilizacion(id: string) {
    await (createClient() as any).from('fertilizaciones').delete().eq('id', id);
    await fetchFertilizaciones();
  }

  async function fetchLotesProductor() {
    const { data } = await (createClient() as any).from('lotes')
      .select('id,nombre,hectareas,cultivo').eq('productor_id', productorId).eq('campana_id', lote.campana_id).order('nombre');
    const sorted = (data??[]).sort((a:any,b:any) =>
      a.nombre.localeCompare(b.nombre, 'es', {numeric:true, sensitivity:'base'}));
    setLotesProductor(sorted);
  }

  async function guardarLote() {
    setSaving(true); setErr('');
    const { data, error } = await (createClient() as any).from('lotes').update({
      nombre:form.nombre.trim(), hectareas:parseFloat(form.hectareas)||0,
      cultivo:form.cultivo||null, cultivo_2:form.cultivo_2||null,
      variedad:form.variedad||null, fecha_siembra:form.fecha_siembra||null, notas:form.notas||null,
      tecnologia_soja:form.tecnologia_soja||null,
    }).eq('id', lote.id).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setLote(data); setEditando(false);
  }

  async function guardarAplicacion() {
    if (!lotesSeleccionados.length) { setErr('Seleccioná al menos un lote'); return; }
    setSavingApl(true); setErr('');
    const sb = createClient() as any;
    const costoHa = parseFloat(aplForm.costo_ha)||null;
    const inserts = lotesSeleccionados.map(lid => {
      const loteInfo = lotesProductor.find(l=>l.id===lid);
      return {
        lote_id:lid, fecha:aplForm.fecha, tipo:aplForm.tipo,
        productos:aplForm.productos||null, maquinaria:aplForm.maquinaria,
        propio_alq:aplForm.propio_alq, contratista:aplForm.contratista.trim()||null,
        costo_ha:costoHa, hectareas_apl:parseFloat(aplForm.hectareas_apl)||loteInfo?.hectareas||0,
        observaciones:aplForm.observaciones||null,
      };
    });
    const { error } = await sb.from('aplicaciones').insert(inserts);
    setSavingApl(false);
    if (error) { setErr(error.message); return; }
    setAplForm({...APL_VACIO, hectareas_apl:String(lote.hectareas)});
    setLotesSeleccionados([lote.id]);
    setShowAplForm(false);
    await fetchAplicaciones();
  }

  async function eliminarAplicacion(id: string) {
    await (createClient() as any).from('aplicaciones').delete().eq('id', id);
    await fetchAplicaciones();
  }

  // Calcular has totales seleccionadas
  const hasTotalesApl = lotesSeleccionados.reduce((s, lid) => {
    const l = lotesProductor.find(x=>x.id===lid);
    return s + (l?.hectareas||0);
  }, 0);
  const costoTotalApl = aplForm.costo_ha ? parseFloat(aplForm.costo_ha) * hasTotalesApl : 0;

  // ── GENERADOR DE IMAGEN (múltiples lotes) ──
  function generarImagen(apl: Aplicacion) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 900;

    // Medir líneas de productos
    const prods = (apl.productos || '—').toUpperCase();
    const tmpC = document.createElement('canvas');
    const tmpX = tmpC.getContext('2d')!;
    tmpX.font = 'bold 22px Inter,sans-serif';
    const pWords = prods.split(' '); let pLine2 = ''; const pLines2: string[] = [];
    for (const w of pWords) {
      const test = pLine2 + w + ' ';
      if (tmpX.measureText(test).width > W - 80 && pLine2) { pLines2.push(pLine2.trim()); pLine2 = w + ' '; }
      else pLine2 = test;
    }
    if (pLine2.trim()) pLines2.push(pLine2.trim());
    const prodBlockH = 28 + pLines2.length * 32 + 16;

    // Calcular altura de lotes (en línea corrida)
    const lotesInfo = lotesProductor.filter(l=>lotesSeleccionados.includes(l.id));
    const totalHas = lotesInfo.reduce((s,l)=>s+l.hectareas, 0);
    // Lotes en texto inline: "NILDA (16 HA) · OFELIA (16 HA) · RITA (23 HA)"
    tmpX.font = 'bold 15px Inter,sans-serif';
    const lotesStr = lotesInfo.map(l=>`${l.nombre.toUpperCase()} (${l.hectareas} HA)`).join('  ·  ');
    const lotesWords = lotesStr.split(' '); let lLine = ''; const lLines: string[] = [];
    for (const w of lotesWords) {
      const test = lLine + w + ' ';
      if (tmpX.measureText(test).width > W - 80 && lLine) { lLines.push(lLine.trim()); lLine = w + ' '; }
      else lLine = test;
    }
    if (lLine.trim()) lLines.push(lLine.trim());
    const lotesBlockH = 28 + lLines.length * 24 + 16;

    const H = Math.max(400, 110 + prodBlockH + lotesBlockH + 80);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Fondo
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);

    // Panal sutil verde
    ctx.strokeStyle = 'rgba(46,170,110,0.06)'; ctx.lineWidth = 1;
    for (let row = 0; row < 30; row++) for (let col = 0; col < 20; col++) {
      const ox = col*54+(row%2===0?0:27), oy = row*36-18;
      ctx.beginPath();
      [[27,0],[54,18],[54,36],[27,54],[0,36],[0,18]].forEach(([x,yy],i) => i===0?ctx.moveTo(ox+x,oy+yy):ctx.lineTo(ox+x,oy+yy));
      ctx.closePath(); ctx.stroke();
    }

    // Banda lateral verde
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#2EAA6E'); grad.addColorStop(1,'#0d2818');
    ctx.fillStyle = grad; ctx.fillRect(0,0,8,H);

    // ── HEADER ──
    ctx.fillStyle = 'rgba(10,10,10,0.98)'; ctx.fillRect(8,0,W-8,108);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8,108); ctx.lineTo(W,108); ctx.stroke();

    // Eyebrow tipo (verde, chico)
    ctx.fillStyle = '#2EAA6E'; ctx.font = 'bold 10px Inter,sans-serif';
    ctx.letterSpacing = '3px'; ctx.fillText(apl.tipo.toUpperCase(), 28, 28); ctx.letterSpacing = '0';

    // Productor (grande, blanco)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px Inter,sans-serif';
    ctx.fillText(productorNombre.toUpperCase(), 28, 80);

    // Fecha + máquina (derecha)
    const maqTexto = apl.maquinaria==='M'?'MOSQUITO':apl.maquinaria==='D'?'DRON':'AVIÓN';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 32px Inter,sans-serif';
    ctx.fillText(fmtFecha(apl.fecha), W-28, 54);
    ctx.fillStyle = '#666'; ctx.font = 'bold 12px Inter,sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(`${maqTexto}  ·  ${apl.propio_alq.toUpperCase()}${apl.contratista?' · '+apl.contratista.toUpperCase():''}`, W-28, 78);
    ctx.letterSpacing = '0';
    ctx.textAlign = 'left';

    // ── ZONA PRODUCTOS (título grande) ──
    let y = 108;
    ctx.fillStyle = '#0d1f16'; ctx.fillRect(8, y, W-8, prodBlockH);
    ctx.fillStyle = '#2EAA6E'; ctx.fillRect(8, y, 4, prodBlockH);
    ctx.strokeStyle = 'rgba(46,170,110,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, y+prodBlockH); ctx.lineTo(W, y+prodBlockH); ctx.stroke();
    y += 24;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Inter,sans-serif';
    pLines2.forEach(l => { ctx.fillText(l, 28, y); y += 32; });
    y += 8;

    // ── ZONA LOTES (en línea corrida) ──
    const loteZoneTop = y;
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(8, loteZoneTop, W-8, lotesBlockH);
    y += 20;
    ctx.fillStyle = '#444'; ctx.font = 'bold 9px Inter,sans-serif';
    ctx.letterSpacing = '3px'; ctx.fillText('LOTES', 28, y); ctx.letterSpacing = '0';
    y += 22;
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 15px Inter,sans-serif';
    lLines.forEach(l => { ctx.fillText(l, 28, y); y += 24; });
    // Total a la derecha
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2EAA6E'; ctx.font = 'bold 17px Inter,sans-serif';
    ctx.fillText(`TOTAL: ${totalHas} HA`, W-28, loteZoneTop + lotesBlockH - 12);
    ctx.textAlign = 'left';
    y = loteZoneTop + lotesBlockH;

    // ── PIE ──
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, y+10); ctx.lineTo(W-28, y+10); ctx.stroke();
    y += 28;

    const costoTotal = apl.costo_ha ? apl.costo_ha * totalHas : null;
    if (costoTotal) {
      ctx.fillStyle = '#555'; ctx.font = '12px Inter,sans-serif';
      ctx.fillText(`U$S ${apl.costo_ha}/HA · TOTAL U$S ${costoTotal.toLocaleString('es-AR')}`, 28, y);
    }
    if (apl.observaciones) {
      ctx.fillStyle = '#555'; ctx.font = 'italic 12px Inter,sans-serif';
      ctx.fillText(apl.observaciones.toUpperCase(), 28, costoTotal ? y+18 : y);
    }
    if (ingeniero?.matricula) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#333'; ctx.font = '11px Inter,sans-serif';
      ctx.fillText(`M.P. ${ingeniero.matricula}`, W-28, H-14);
      ctx.textAlign = 'left';
    }

    // Descargar
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `orden-aplicacion-${fmtFecha(apl.fecha)}.png`; a.click();
  }

  function compartirWhatsApp(apl: Aplicacion) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    generarImagen(apl);
    setTimeout(() => {
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `orden-${fmtFecha(apl.fecha)}.png`, { type:'image/png' });
        if (navigator.share && navigator.canShare?.({files:[file]})) {
          navigator.share({ files:[file], title:'Orden de aplicación' });
        }
      }, 'image/png');
    }, 100);
  }

  function dibujarCanvasLote(canvas: HTMLCanvasElement, form: { fecha:string; tipo:string; productos:string; maquinaria:string; propio_alq:string; contratista:string; costo_ha:string; observaciones:string }) {
    const prods = (form.productos || '—').toUpperCase();
    const W = 900;
    // Medir líneas de productos (zona prominente — ahora título grande)
    const tmpC = document.createElement('canvas');
    const tmpX = tmpC.getContext('2d')!;
    tmpX.font = 'bold 22px Inter,sans-serif';
    const pWords = prods.split(' '); let pLine = ''; const pLines: string[] = [];
    for (const w of pWords) {
      const test = pLine + w + ' ';
      if (tmpX.measureText(test).width > W - 80 && pLine) { pLines.push(pLine.trim()); pLine = w + ' '; }
      else pLine = test;
    }
    if (pLine.trim()) pLines.push(pLine.trim());
    const prodBlockH = 28 + pLines.length * 32 + 16;

    // Lotes en línea corrida
    const loteTxt = `${lote.nombre.toUpperCase()} (${lote.hectareas} HA)`;
    const lotesBlockH = 50;
    const H = Math.max(400, 110 + prodBlockH + lotesBlockH + 80);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Fondo
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);

    // Panal sutil
    ctx.strokeStyle = 'rgba(46,170,110,0.06)'; ctx.lineWidth = 1;
    for (let row = 0; row < 30; row++) for (let col = 0; col < 20; col++) {
      const ox = col*54+(row%2===0?0:27), oy = row*36-18;
      ctx.beginPath();
      [[27,0],[54,18],[54,36],[27,54],[0,36],[0,18]].forEach(([x,y],i) => i===0?ctx.moveTo(ox+x,oy+y):ctx.lineTo(ox+x,oy+y));
      ctx.closePath(); ctx.stroke();
    }

    // Banda lateral izquierda verde
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#2EAA6E'); g.addColorStop(1,'#0d2818');
    ctx.fillStyle = g; ctx.fillRect(0,0,8,H);

    // ── HEADER (zona oscura top) ──
    ctx.fillStyle = 'rgba(10,10,10,0.98)'; ctx.fillRect(8,0,W-8,108);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8,108); ctx.lineTo(W,108); ctx.stroke();

    // Eyebrow: tipo aplicación (pequeño, verde)
    ctx.fillStyle = '#2EAA6E'; ctx.font = 'bold 10px Inter,sans-serif';
    ctx.letterSpacing = '3px'; ctx.fillText((tiposSeleccionados2.length > 0 ? tiposSeleccionados2.join(' + ') : form.tipo).toUpperCase(), 28, 28); ctx.letterSpacing = '0';

    // Productor (grande, blanco)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px Inter,sans-serif';
    ctx.fillText(productorNombre.toUpperCase(), 28, 80);

    // Fecha (derecha, amarillo grande)
    const maqT = form.maquinaria==='M'?'MOSQUITO':form.maquinaria==='D'?'DRON':'AVIÓN';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 32px Inter,sans-serif';
    ctx.fillText(fmtFecha(form.fecha), W-28, 54);
    ctx.fillStyle = '#666'; ctx.font = 'bold 12px Inter,sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(`${maqT}  ·  ${form.propio_alq.toUpperCase()}${form.contratista?' · '+form.contratista.toUpperCase():''}`, W-28, 78);
    ctx.letterSpacing = '0';
    ctx.textAlign = 'left';

    // ── ZONA PRODUCTOS (título grande — zona central prominente) ──
    let y = 108;
    ctx.fillStyle = '#0d1f16'; ctx.fillRect(8, y, W-8, prodBlockH);
    // línea verde izquierda más gruesa
    ctx.fillStyle = '#2EAA6E'; ctx.fillRect(8, y, 4, prodBlockH);
    ctx.strokeStyle = 'rgba(46,170,110,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, y+prodBlockH); ctx.lineTo(W, y+prodBlockH); ctx.stroke();

    y += 24;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Inter,sans-serif';
    pLines.forEach(l => { ctx.fillText(l, 28, y); y += 32; });
    y += 8;

    // ── ZONA LOTES ──
    const loteZoneTop = y;
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(8, loteZoneTop, W-8, lotesBlockH);

    y += 18;
    ctx.fillStyle = '#444'; ctx.font = 'bold 9px Inter,sans-serif';
    ctx.letterSpacing = '3px'; ctx.fillText('LOTE', 28, y); ctx.letterSpacing = '0';
    y += 22;
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 17px Inter,sans-serif';
    ctx.fillText(loteTxt, 28, y);
    // hectáreas a la derecha
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2EAA6E'; ctx.font = 'bold 17px Inter,sans-serif';
    ctx.fillText(`TOTAL: ${lote.hectareas} HA`, W-28, y);
    ctx.textAlign = 'left';
    y += lotesBlockH;

    // ── PIE ──
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(W-28, y); ctx.stroke();
    y += 20;

    const costoHa = parseFloat(form.costo_ha)||0;
    if (costoHa) {
      ctx.fillStyle = '#555'; ctx.font = '12px Inter,sans-serif';
      ctx.fillText(`U$S ${costoHa}/HA · TOTAL U$S ${(costoHa*lote.hectareas).toLocaleString('es-AR')}`, 28, y);
    }
    if (form.observaciones) {
      ctx.fillStyle = '#555'; ctx.font = 'italic 12px Inter,sans-serif';
      ctx.fillText(form.observaciones.toUpperCase(), 28, costoHa ? y+18 : y);
    }
    // Matrícula discreta (sin nombre)
    if (ingeniero?.matricula) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#333'; ctx.font = '11px Inter,sans-serif';
      ctx.fillText(`M.P. ${ingeniero.matricula}`, W-28, H-14);
      ctx.textAlign = 'left';
    }
  }

  async function guardarAplicacionLote(generarImagen = true) {
    setSavingApl2(true); setErrApl2('');
    const costoHa = parseFloat(aplForm2.costo_ha) || null;

    // Generar imagen (solo si se pidió)
    const canvas = canvasRef.current;
    let imagenUrl: string | null = null;
    if (generarImagen && canvas) {
      dibujarCanvasLote(canvas, aplForm2);
      const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), 'image/png'));
      if (blob) {
        const sb = createClient() as any;
        const fileName = `${Date.now()}-${aplForm2.tipo.toLowerCase()}-${fmtFecha(aplForm2.fecha)}.png`;
        const { data: up, error: upErr } = await sb.storage.from('aplicaciones').upload(fileName, blob, { contentType: 'image/png' });
        if (!upErr && up) {
          const { data: urlData } = sb.storage.from('aplicaciones').getPublicUrl(fileName);
          imagenUrl = urlData?.publicUrl ?? null;
        }
        // Descargar localmente
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `orden-${aplForm2.tipo.toLowerCase()}-${fmtFecha(aplForm2.fecha)}.png`; a.click();
        URL.revokeObjectURL(url);
      }
    }

    const { error } = await (createClient() as any).from('aplicaciones').insert({
      lote_id: lote.id, fecha: aplForm2.fecha, tipo: aplForm2.tipo,
      productos: aplForm2.productos || null, maquinaria: aplForm2.maquinaria,
      propio_alq: aplForm2.propio_alq, contratista: aplForm2.contratista.trim() || null,
      costo_ha: costoHa, hectareas_apl: lote.hectareas,
      observaciones: aplForm2.observaciones || null, imagen_url: imagenUrl,
    });
    setSavingApl2(false);
    if (error) { setErrApl2(error.message); return; }
    setAplForm2({ fecha: new Date().toISOString().slice(0,10), tipo: 'Herbicida', productos: '', maquinaria: 'M', propio_alq: 'Propio', contratista: '', costo_ha: '', observaciones: '' });
    setTiposSeleccionados2(['Herbicida']);
    setShowAplForm2(false);
    await fetchAplicaciones();
  }

  async function guardarEdicionAplicacion(regenerarImagen = false) {
    if (!editandoApl) return;
    setSavingEditApl(true);

    let imagenUrl = editandoApl.imagen_url;

    // Regenerar imagen si se pide
    if (regenerarImagen) {
      const canvas = canvasRef.current;
      if (canvas) {
        const formParaCanvas = {
          fecha: editandoApl.fecha,
          tipo: editandoApl.tipo,
          productos: editandoApl.productos || '',
          maquinaria: editandoApl.maquinaria,
          propio_alq: editandoApl.propio_alq,
          contratista: editandoApl.contratista || '',
          costo_ha: String(editandoApl.costo_ha || ''),
          observaciones: editandoApl.observaciones || '',
        };
        dibujarCanvasLote(canvas, formParaCanvas);
        const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), 'image/png'));
        if (blob) {
          const sb = createClient() as any;
          const fileName = `${Date.now()}-${editandoApl.tipo.toLowerCase()}-${fmtFecha(editandoApl.fecha)}.png`;
          const { data: up, error: upErr } = await sb.storage.from('aplicaciones').upload(fileName, blob, { contentType: 'image/png' });
          if (!upErr && up) {
            const { data: urlData } = sb.storage.from('aplicaciones').getPublicUrl(fileName);
            imagenUrl = urlData?.publicUrl ?? imagenUrl;
          }
          // Descargar también
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url;
          a.download = `orden-${editandoApl.tipo.toLowerCase()}-${fmtFecha(editandoApl.fecha)}.png`; a.click();
          URL.revokeObjectURL(url);
        }
      }
    }

    const { error } = await (createClient() as any).from('aplicaciones').update({
      fecha: editandoApl.fecha,
      tipo: editandoApl.tipo,
      productos: editandoApl.productos || null,
      maquinaria: editandoApl.maquinaria,
      propio_alq: editandoApl.propio_alq,
      contratista: editandoApl.contratista || null,
      costo_ha: editandoApl.costo_ha || null,
      observaciones: editandoApl.observaciones || null,
      imagen_url: imagenUrl,
    }).eq('id', editandoApl.id);
    setSavingEditApl(false);
    if (error) { alert(error.message); return; }
    setEditandoApl(null);
    await fetchAplicaciones();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <canvas ref={canvasRef} className="hidden" />

      {/* Modal editar aplicación */}
      {editandoApl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-lg card p-6 space-y-4" style={{borderColor:'rgba(245,158,11,0.4)'}}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-hi">Editar aplicación</h2>
              <button onClick={()=>setEditandoApl(null)} className="text-lo hover:text-hi text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label>
                <input type="date" value={editandoApl.fecha}
                  onChange={e=>setEditandoApl(a=>a?{...a,fecha:e.target.value}:a)}
                  className="field"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Tipo</label>
                <select value={editandoApl.tipo}
                  onChange={e=>setEditandoApl(a=>a?{...a,tipo:e.target.value}:a)}
                  className="field">
                  {['Herbicida','Fungicida','Insecticida','Fertilizante','Fungicida+Insecticida','Otro'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productos y dosis</label>
              <textarea rows={3} value={editandoApl.productos||''}
                onChange={e=>setEditandoApl(a=>a?{...a,productos:e.target.value}:a)}
                className="field resize-none"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Maquinaria</label>
                <div className="flex gap-1">
                  {[['M','🚜'],['D','🚁'],['A','✈']].map(([v,icon])=>(
                    <button key={v} type="button"
                      onClick={()=>setEditandoApl(a=>a?{...a,maquinaria:v}:a)}
                      className={cn('flex-1 py-2 rounded text-sm border transition-all',
                        editandoApl.maquinaria===v?'bg-ochre text-[#0a0a0a] border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                    >{icon}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Equipo</label>
                <div className="flex gap-1">
                  {['Propio','Alq.'].map(v=>(
                    <button key={v} type="button"
                      onClick={()=>setEditandoApl(a=>a?{...a,propio_alq:v==='Alq.'?'Alquilado':'Propio'}:a)}
                      className={cn('flex-1 py-2 rounded text-xs border transition-all',
                        (editandoApl.propio_alq==='Propio'&&v==='Propio')||(editandoApl.propio_alq==='Alquilado'&&v==='Alq.')?'bg-ochre text-[#0a0a0a] border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                    >{v}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Contratista</label>
              <input value={editandoApl.contratista||''}
                onChange={e=>setEditandoApl(a=>a?{...a,contratista:e.target.value}:a)}
                className="field" placeholder="Opcional"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                Costo aplicación (U$S/ha)
                {editandoApl.costo_ha && lote.hectareas &&
                  <span className="ml-2 text-afa normal-case font-normal">
                    = U$S {(Number(editandoApl.costo_ha)*lote.hectareas).toLocaleString('es-AR')} total
                  </span>
                }
              </label>
              <input type="number" step="0.01"
                value={editandoApl.costo_ha||''}
                onChange={e=>setEditandoApl(a=>a?{...a,costo_ha:parseFloat(e.target.value)||null}:a)}
                className="field" placeholder="0.00"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
              <textarea rows={2} value={editandoApl.observaciones||''}
                onChange={e=>setEditandoApl(a=>a?{...a,observaciones:e.target.value}:a)}
                className="field resize-none"/>
            </div>

            <div className="flex gap-2 pt-1 flex-wrap">
              <button onClick={()=>guardarEdicionAplicacion(false)} disabled={savingEditApl} className="btn-ghost flex-1">
                {savingEditApl?'Guardando…':'Guardar sin imagen'}
              </button>
              <button onClick={()=>guardarEdicionAplicacion(true)} disabled={savingEditApl} className="btn-primary flex-1">
                {savingEditApl?'Generando…':'Guardar + Regenerar imagen 📷'}
              </button>
            </div>
            <button onClick={()=>setEditandoApl(null)} className="text-lo text-xs hover:text-mid w-full text-center pt-1">Cancelar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <p className="eyebrow">Lote</p>
        <div className="flex gap-2">
          <button onClick={()=>{setEditando(!editando); setShowAplForm(false);}} className="btn-ghost text-xs py-1 px-3">
            {editando ? '✕ Cancelar' : '✏ Editar'}
          </button>
          <Link href={`/productores/${productorId}`} className="btn-ghost text-xs py-1 px-3">← Volver</Link>
        </div>
      </div>

      {/* Info limpia */}
      {!editando && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{color}}>{lote.nombre}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span className="text-hi font-bold">{lote.hectareas} ha</span>
            {lote.cultivo && <span style={{color:cropColor(lote.cultivo)}} className="font-semibold">{lote.cultivo}{lote.cultivo_2?' →':''}</span>}
            {lote.cultivo_2 && <span style={{color:cropColor(lote.cultivo_2)}} className="font-semibold">{lote.cultivo_2} 2°</span>}
            {lote.variedad && <span className="text-mid">· {lote.variedad}</span>}
            {lote.fecha_siembra && <span className="text-mid">· Siem: {fmtFecha(lote.fecha_siembra)}</span>}
          </div>
          {lote.fecha_siembra && !lote.fecha_cosecha && <p className="text-lo text-xs mt-1">📅 Siembra: {fmtFecha(lote.fecha_siembra)}</p>}
          {lote.fecha_cosecha && <p className="text-money text-xs mt-1 font-semibold">🌾 Cosecha: {fmtFecha(lote.fecha_cosecha)}</p>}
          {lote.notas && <p className="text-lo text-xs mt-2 italic">{lote.notas}</p>}
        </div>
      )}

      {/* Form editar lote */}
      {editando && (
        <div className="card p-5 space-y-4 mb-6">
          <h2 className="font-semibold text-hi text-sm">Editar lote</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Nombre</label><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} className="field" /></div>
            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Hectáreas</label><input type="number" step="0.01" value={form.hectareas} onChange={e=>setForm(f=>({...f,hectareas:e.target.value}))} className="field" /></div>
            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Cultivo</label><select value={form.cultivo} onChange={e=>setForm(f=>({...f,cultivo:e.target.value}))} className="field"><option value="">—</option>{CULTIVOS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">2° Cultivo</label><select value={form.cultivo_2} onChange={e=>setForm(f=>({...f,cultivo_2:e.target.value}))} className="field"><option value="">—</option>{CULTIVOS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Variedad</label><input value={form.variedad} onChange={e=>setForm(f=>({...f,variedad:e.target.value}))} className="field" /></div>
            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha siembra</label><input type="date" value={form.fecha_siembra} onChange={e=>setForm(f=>({...f,fecha_siembra:e.target.value}))} className="field" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Notas</label><textarea rows={2} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} className="field resize-none" /></div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Tecnología soja</label>
            <select value={form.tecnologia_soja} onChange={e=>setForm(f=>({...f,tecnologia_soja:e.target.value}))} className="field">
              <option value="">— No aplica / Sin definir</option>
              <option value="Enlist">Enlist (tolerante 2,4-D + Glufosinato)</option>
              <option value="Conkesta">Conkesta (Bt lepidópteros + 2,4-D)</option>
              <option value="IPRO">IPRO (tolerante Glufosinato)</option>
              <option value="Convencional">Convencional</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{err}</p>}
          <button onClick={guardarLote} disabled={saving} className="btn-primary w-full">{saving?'Guardando…':'Guardar cambios'}</button>
        </div>
      )}

      {/* Aplicaciones */}
      {!editando && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-hi text-sm">Aplicaciones</h2>
            <div className="flex gap-2">
              <button onClick={()=>{setShowAplForm2(!showAplForm2); setShowAplForm(false);}} className="btn-primary text-xs py-1.5 px-3">
                {showAplForm2 ? '✕ Cancelar' : '+ Aplicación en este lote'}
              </button>
            </div>
          </div>

          {/* Fertilizaciones */}
          <>
            <div className="flex items-center justify-between mb-3 mt-6">
              <h2 className="font-semibold text-hi text-sm">Fertilizaciones</h2>
              <button onClick={()=>setShowFertiForm(!showFertiForm)} className="btn-ghost text-xs py-1.5 px-3">
                {showFertiForm ? '✕ Cancelar' : '+ Agregar fertilización'}
              </button>
            </div>

            {showFertiForm && (
              <div className="card p-4 space-y-3 mb-4" style={{borderColor:'rgba(52,211,153,0.3)'}}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label>
                    <input type="date" value={fertiForm.fecha} onChange={e=>setFertiForm(f=>({...f,fecha:e.target.value}))} className="field"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Momento</label>
                    <select value={fertiForm.momento} onChange={e=>setFertiForm(f=>({...f,momento:e.target.value}))} className="field">
                      {['siembra','macollaje','v4','v6','r1','r3','otro'].map(m=>(
                        <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productos y dosis *</label>
                  <textarea rows={2} value={fertiForm.productos}
                    onChange={e=>setFertiForm(f=>({...f,productos:e.target.value}))}
                    className="field resize-none"
                    placeholder="Ej: Urea 100 kg/ha + MAP 50 kg/ha"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
                  <input value={fertiForm.observaciones} onChange={e=>setFertiForm(f=>({...f,observaciones:e.target.value}))} className="field" placeholder="Opcional"/>
                </div>
                <button onClick={guardarFertilizacion} disabled={savingFerti} className="btn-primary w-full text-xs py-2">
                  {savingFerti ? 'Guardando…' : 'Guardar fertilización'}
                </button>
              </div>
            )}

            {fertilizaciones.length === 0 ? (
              <p className="text-lo text-xs text-center py-3">Sin fertilizaciones registradas.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {fertilizaciones.map(f => (
                  <div key={f.id} className="card p-3 group flex items-start justify-between gap-2"
                    style={{borderColor:'rgba(52,211,153,0.15)'}}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[#34d399] font-bold text-xs">{fmtFecha(f.fecha)}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-base-4 text-mid border border-base-5 capitalize">{f.momento}</span>
                      </div>
                      <p className="text-hi text-sm">{f.productos}</p>
                      {f.observaciones && <p className="text-lo text-xs mt-1 italic">{f.observaciones}</p>}
                    </div>
                    <button onClick={()=>eliminarFertilizacion(f.id)}
                      className="text-base-6 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
                  </div>
                ))}
              </div>
            )}
          </>

      {/* Form aplicación rápida desde el lote */}
          {showAplForm2 && (
            <div className="card p-5 space-y-4 mb-4" style={{borderColor:'rgba(46,170,110,0.4)'}}>
              <p className="text-xs text-afa font-semibold">Lote: {lote.nombre} · {lote.hectareas} ha</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label><input type="date" value={aplForm2.fecha} onChange={e=>setAplForm2(f=>({...f,fecha:e.target.value}))} className="field"/></div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">
                    Tipo
                    {tiposSeleccionados2.length > 0 && <span className="ml-2 text-ochre normal-case tracking-normal font-normal">{tiposSeleccionados2.join(' + ')}</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_BASE.map(t => {
                      const sel = tiposSeleccionados2.includes(t);
                      return (
                        <button key={t} type="button"
                          onClick={() => setTiposSeleccionados2(prev => sel ? prev.filter(x=>x!==t) : [...prev,t])}
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            sel ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                        >{t}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productos y dosis</label>
                <textarea rows={2} value={aplForm2.productos} onChange={e=>setAplForm2(f=>({...f,productos:e.target.value}))} className="field resize-none" placeholder="Ej: Roundup 3 l/ha + Banvel 0.5 l/ha"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Maquinaria</label>
                  <div className="flex gap-1">
                    {[['M','🚜'],['D','🚁'],['A','✈']].map(([v,icon])=>(
                      <button key={v} type="button" onClick={()=>setAplForm2(f=>({...f,maquinaria:v}))}
                        className={cn('flex-1 py-2 rounded text-sm border transition-all',aplForm2.maquinaria===v?'bg-ochre text-[#0a0a0a] border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                      >{icon}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Equipo</label>
                  <div className="flex gap-1">
                    {['Propio','Alq.'].map(v=>(
                      <button key={v} type="button"
                        onClick={()=>setAplForm2(f=>({...f,propio_alq:v==='Alq.'?'Alquilado':'Propio'}))}
                        className={cn('flex-1 py-2 rounded text-xs border transition-all',
                          (aplForm2.propio_alq==='Propio'&&v==='Propio')||(aplForm2.propio_alq==='Alquilado'&&v==='Alq.')?'bg-ochre text-[#0a0a0a] border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Contratista <span className="text-lo normal-case font-normal">(opcional)</span></label>
                <input value={aplForm2.contratista} onChange={e=>setAplForm2(f=>({...f,contratista:e.target.value}))} className="field" placeholder="Ej: Pérez Aplicaciones"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                  Costo aplicación (U$S/ha)
                  {aplForm2.costo_ha && <span className="ml-2 text-afa normal-case font-normal">= U$S {(parseFloat(aplForm2.costo_ha)*lote.hectareas).toLocaleString('es-AR')} total</span>}
                </label>
                <input type="number" step="0.01" value={aplForm2.costo_ha} onChange={e=>setAplForm2(f=>({...f,costo_ha:e.target.value}))} className="field" placeholder="0.00"/>
              </div>
              <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
                <textarea rows={2} value={aplForm2.observaciones} onChange={e=>setAplForm2(f=>({...f,observaciones:e.target.value}))} className="field resize-none" placeholder="Condiciones, recomendaciones..."/>
              </div>
              {errApl2 && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{errApl2}</p>}
              <div className="flex gap-2">
                <button onClick={()=>guardarAplicacionLote(true)} disabled={savingApl2} className="btn-primary flex-1">
                  {savingApl2 ? 'Guardando…' : '📷 Guardar + Imagen'}
                </button>
                <button onClick={()=>guardarAplicacionLote(false)} disabled={savingApl2} className="btn-ghost flex-1">
                  {savingApl2 ? 'Guardando…' : '💾 Guardar solo'}
                </button>
              </div>
            </div>
          )}

          {/* Form nueva aplicación */}
          {showAplForm && (
            <div className="card p-5 space-y-4 mb-4" style={{borderColor:'rgba(245,158,11,0.3)'}}>

              {/* Selección de lotes */}
              <div>
                <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">
                  Lotes a aplicar <span className="text-ochre normal-case tracking-normal font-normal">— {hasTotalesApl} ha seleccionadas</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {lotesProductor.map(l => {
                    const sel = lotesSeleccionados.includes(l.id);
                    const lc = cropColor(l.cultivo);
                    return (
                      <button key={l.id} type="button"
                        onClick={()=>setLotesSeleccionados(prev=>sel?prev.filter(x=>x!==l.id):[...prev,l.id])}
                        className="text-xs px-2 py-1.5 rounded border transition-all"
                        style={{
                          background: sel ? lc+'22' : 'transparent',
                          borderColor: sel ? lc : '#333',
                          color: sel ? lc : '#525252',
                        }}
                      >
                        {l.nombre} · {l.hectareas} ha
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label><input type="date" value={aplForm.fecha} onChange={e=>setAplForm(f=>({...f,fecha:e.target.value}))} className="field" /></div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">
                    Tipo
                    {tiposSeleccionados2.length > 0 && <span className="ml-2 text-ochre normal-case tracking-normal font-normal">{tiposSeleccionados2.join(' + ')}</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_BASE.map(t => {
                      const sel = tiposSeleccionados2.includes(t);
                      return (
                        <button key={t} type="button"
                          onClick={() => setTiposSeleccionados2(prev => sel ? prev.filter(x=>x!==t) : [...prev,t])}
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            sel ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                        >{t}</button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productos y dosis</label>
                <textarea rows={2} value={aplForm.productos} onChange={e=>setAplForm(f=>({...f,productos:e.target.value}))} className="field resize-none" placeholder="Ej: Roundup 3 l/ha + Banvel 0.5 l/ha" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Maquinaria</label>
                  <div className="flex gap-1">
                    {[['M','🚜'],['D','🚁'],['A','✈']].map(([v,icon])=>(
                      <button key={v} type="button" onClick={()=>setAplForm(f=>({...f,maquinaria:v}))}
                        className={cn('flex-1 py-2 rounded text-sm border transition-all', aplForm.maquinaria===v?'bg-ochre text-base-DEFAULT border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                        title={v==='M'?'Mosquito':v==='D'?'Dron':'Avión'}
                      >{icon}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Equipo</label>
                  <div className="flex gap-1">
                    {['Propio','Alq.'].map(v=>(
                      <button key={v} type="button"
                        onClick={()=>setAplForm(f=>({...f,propio_alq:v==='Alq.'?'Alquilado':'Propio'}))}
                        className={cn('flex-1 py-2 rounded text-xs border transition-all',
                          (aplForm.propio_alq==='Propio'&&v==='Propio')||(aplForm.propio_alq==='Alquilado'&&v==='Alq.')
                            ?'bg-ochre text-base-DEFAULT border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                  Contratista <span className="text-lo normal-case tracking-normal font-normal">(opcional)</span>
                </label>
                <input value={aplForm.contratista} onChange={e=>setAplForm(f=>({...f,contratista:e.target.value}))} className="field" placeholder="Ej: Pérez Aplicaciones" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                  Costo aplicación (U$S/ha)
                  {aplForm.costo_ha && hasTotalesApl > 0 &&
                    <span className="ml-2 text-afa normal-case tracking-normal font-normal">
                      = U$S {(parseFloat(aplForm.costo_ha)*hasTotalesApl).toLocaleString('es-AR')} total
                    </span>
                  }
                </label>
                <input type="number" step="0.01" value={aplForm.costo_ha} onChange={e=>setAplForm(f=>({...f,costo_ha:e.target.value}))} className="field" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones / Recomendaciones</label>
                <textarea rows={2} value={aplForm.observaciones} onChange={e=>setAplForm(f=>({...f,observaciones:e.target.value}))} className="field resize-none" placeholder="Condiciones, momento óptimo, precauciones..." />
              </div>

              {err && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{err}</p>}
              <button onClick={guardarAplicacion} disabled={savingApl} className="btn-primary w-full">
                {savingApl?'Guardando…':`Guardar aplicación en ${lotesSeleccionados.length} lote${lotesSeleccionados.length>1?'s':''}`}
              </button>
            </div>
          )}

          {/* Lista aplicaciones */}
          {aplicaciones.length === 0 ? (
            <p className="text-lo text-sm text-center py-6">Sin aplicaciones registradas.</p>
          ) : (
            <div className="space-y-2">
              {aplicaciones.map(a => {
                const costoTotal = a.costo_ha && a.hectareas_apl ? a.costo_ha * a.hectareas_apl : null;
                return (
                  <div key={a.id} className="card p-4 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-ochre font-bold text-xs">{fmtFecha(a.fecha)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-base-4 text-mid border border-base-5">{a.tipo}</span>
                          <span className="text-[10px] text-lo">{maqLabel[a.maquinaria]??a.maquinaria}</span>
                          <span className="text-[10px] text-lo">{a.propio_alq}</span>
                          {a.hectareas_apl && <span className="text-[10px] text-lo">{a.hectareas_apl} ha</span>}
                          {a.contratista && <span className="text-[10px] text-mid">· {a.contratista}</span>}
                          {costoTotal && <span className="text-[10px] font-bold text-afa">U$S {costoTotal.toLocaleString('es-AR')} total</span>}
                        </div>
                        {a.productos && <p className="text-hi text-sm">{a.productos}</p>}
                        {a.observaciones && <p className="text-lo text-xs mt-1 italic">{a.observaciones}</p>}
                      </div>
                      <div className="flex gap-3 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Editar */}
                        <button
                          onClick={()=>setEditandoApl({...a})}
                          title="Editar aplicación"
                          className="text-ochre hover:text-ochre-light text-lg"
                        >✏</button>
                        {/* Compartir imagen */}
                        {a.imagen_url ? (
                          <button
                            onClick={async () => {
                              try {
                                const resp = await fetch(a.imagen_url!);
                                const blob = await resp.blob();
                                const file = new File([blob], `aplicacion-${fmtFecha(a.fecha)}.png`, { type: 'image/png' });
                                if (navigator.share && navigator.canShare?.({ files: [file] })) {
                                  await navigator.share({ files: [file], title: `Aplicación ${a.tipo} - ${fmtFecha(a.fecha)}` });
                                } else {
                                  window.open(a.imagen_url!, '_blank');
                                }
                              } catch {}
                            }}
                            title="Compartir imagen"
                            className="text-afa hover:text-afa-light text-2xl"
                          >📷</button>
                        ) : null}
                        {/* Tacho bien separado */}
                        <button
                          onClick={()=>eliminarAplicacion(a.id)}
                          title="Eliminar"
                          className="text-base-6 hover:text-red-500 text-sm ml-3"
                        >🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
