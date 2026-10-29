'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCampana } from '@/components/layout/app-shell';
import { cn } from '@/lib/utils';

declare const XLSX: any;

type Productor = { id:string; razon_social:string; cuit:string|null; localidad:string|null; telefono:string|null; email:string|null };
type Campana = { id:string; nombre:string; fecha_inicio:string; fecha_fin:string };
type Lote = { id:string; nombre:string; hectareas:number; cultivo:string|null; cultivo_2:string|null; variedad:string|null; fecha_siembra:string|null; notas:string|null };
type Ingeniero = { nombre:string; apellido:string|null; matricula:string|null };

const TIPOS_BASE = ['Herbicida','Fungicida','Insecticida','Fertilizante','Inoculante','Otro'];
const APL_VACIO = { fecha:new Date().toISOString().slice(0,10), tipo:'Herbicida', productos:'', maquinaria:'M', propio_alq:'Propio', contratista:'', costo_ha:'', observaciones:'' };

const CULTIVOS_ORDEN = ['Soja','Maíz','Trigo','Girasol','Sorgo','Cebada','Alfalfa','Otro'];

const CULTIVO_ABREV: Record<string,string> = {
  'Soja':'SOJ', 'Maíz':'MAI', 'Trigo':'TRI', 'Girasol':'GIR',
  'Sorgo':'SOR', 'Cebada':'CEB', 'Alfalfa':'ALF', 'Otro':'OTR',
};
const CULTIVOS_VALIDOS = ['Soja','Maíz','Trigo','Girasol','Sorgo','Cebada','Alfalfa','Otro'];

function abrevCultivo(c: string | null): string {
  if (!c) return '';
  return CULTIVO_ABREV[c] ?? c.slice(0,3).toUpperCase();
}

function esCultivo(c: string | null): boolean {
  if (!c) return false;
  return CULTIVOS_VALIDOS.includes(c);
}

function normalizarCultivo(c: string): string | null {
  if (!c) return null;
  const n = c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (n.includes('soja'))    return 'Soja';
  if (n.includes('maiz') || n.includes('maíz')) return 'Maíz';
  if (n.includes('trigo'))   return 'Trigo';
  if (n.includes('girasol')) return 'Girasol';
  if (n.includes('sorgo'))   return 'Sorgo';
  if (n.includes('cebada'))  return 'Cebada';
  if (n.includes('alfalfa')) return 'Alfalfa';
  if (n.includes('otro'))    return 'Otro';
  // Si tiene texto pero no matchea ningún cultivo conocido → null (es variedad probablemente)
  return null;
}

function cropColor(c:string|null){
  if(!c) return '#a3a3a3';
  const n=c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(n.includes('soja'))    return '#22c55e';
  if(n.includes('maiz'))    return '#84cc16';
  if(n.includes('trigo'))   return '#f59e0b';
  if(n.includes('cebada'))  return '#fbbf24';
  if(n.includes('sorgo'))   return '#ea580c';
  if(n.includes('girasol')) return '#38bdf8';
  if(n.includes('alfalfa')) return '#34d399';
  return '#a3a3a3';
}

function parseFecha(val:any):string|null{
  if(!val) return null;
  if(val instanceof Date) return val.toISOString().slice(0,10);
  const d=new Date(String(val));
  if(!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return null;
}

function loadXLSX():Promise<void>{
  return new Promise(resolve=>{
    if(typeof XLSX!=='undefined'){resolve();return;}
    const s=document.createElement('script');
    s.src='https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    s.onload=()=>resolve(); document.head.appendChild(s);
  });
}

export function ProductorDetail({ productor, campanas, ingeniero }:{ productor:Productor; campanas:Campana[]; ingeniero:Ingeniero|null }) {
  const { campanaId } = useCampana();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState('');
  const [filtroCultivo, setFiltroCultivo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{id:string;nombre:string}|null>(null);
  const [showAplModal, setShowAplModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Aplicación
  const [aplForm, setAplForm] = useState({...APL_VACIO});
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(['Herbicida']);
  const [lotesSeleccionados, setLotesSeleccionados] = useState<string[]>([]);
  const [savingApl, setSavingApl] = useState(false);
  const [aplFiltro, setAplFiltro] = useState('');
  const [errApl, setErrApl] = useState('');

  const campana = campanas.find(c=>c.id===campanaId);
  const totalHas = lotes.reduce((s,l)=>s+Number(l.hectareas),0);
  // Cultivos únicos diferenciando Soja 1° y Soja 2°
  const cultivosUnicos = Array.from(new Set(lotes.flatMap(l => {
    const tags: string[] = [];
    if (esCultivo(l.cultivo)) {
      // Si tiene doble cultivo y el 1ro no es soja, la soja es 2°
      const sojaEs2 = l.cultivo === 'Soja' && esCultivo(l.cultivo_2) && l.cultivo !== l.cultivo_2;
      // Si el 1ro es trigo/cebada y el 2do es soja → 1ro=trigo, 2do=soja 2°
      const primerEsBase = ['Trigo','Cebada'].includes(l.cultivo??'') && l.cultivo_2 === 'Soja';
      tags.push(primerEsBase ? l.cultivo! : l.cultivo!);
      if (primerEsBase) tags.push('Soja 2°');
    }
    if (esCultivo(l.cultivo_2) && !(['Trigo','Cebada'].includes(l.cultivo??'') && l.cultivo_2 === 'Soja')) {
      tags.push(l.cultivo_2!);
    }
    return tags;
  }))).sort();

  const lotesFiltrados = filtroCultivo === 'Soja 2°'
    ? lotes.filter(l => ['Trigo','Cebada'].includes(l.cultivo??'') && l.cultivo_2 === 'Soja')
    : filtroCultivo === 'Soja'
    ? lotes.filter(l => l.cultivo === 'Soja' || (l.cultivo_2 === 'Soja' && !['Trigo','Cebada'].includes(l.cultivo??'')))
    : filtroCultivo
    ? lotes.filter(l => l.cultivo === filtroCultivo || l.cultivo_2 === filtroCultivo)
    : lotes;

  // Lotes filtrados en modal aplicación
  const lotesAplFiltrados = aplFiltro === 'Soja 2°'
    ? lotes.filter(l => ['Trigo','Cebada'].includes(l.cultivo??'') && l.cultivo_2 === 'Soja')
    : aplFiltro === 'Soja'
    ? lotes.filter(l => l.cultivo === 'Soja' || (l.cultivo_2 === 'Soja' && !['Trigo','Cebada'].includes(l.cultivo??'')))
    : aplFiltro
    ? lotes.filter(l => l.cultivo === aplFiltro || l.cultivo_2 === aplFiltro)
    : lotes;
  const hasTotalesApl = lotesSeleccionados.reduce((s,lid)=>{
    const l=lotes.find(x=>x.id===lid); return s+(l?.hectareas||0);
  },0);

  useEffect(()=>{ if(campanaId) fetchLotes(); },[campanaId,productor.id]);

  async function fetchLotes(){
    setLoading(true);
    const {data}=await (createClient() as any).from('lotes')
      .select('id,nombre,hectareas,cultivo,cultivo_2,variedad,fecha_siembra,notas')
      .eq('productor_id',productor.id).eq('campana_id',campanaId).order('nombre');
    const sorted = (data??[]).sort((a:any,b:any) =>
      a.nombre.localeCompare(b.nombre, 'es', {numeric:true, sensitivity:'base'}));
    setLotes(sorted); setLoading(false);
  }

  async function eliminarLote(id:string){
    await (createClient() as any).from('lotes').delete().eq('id',id);
    setConfirmDelete(null); await fetchLotes();
  }

  async function exportar(){
    await loadXLSX();
    const rows=[['Nombre','Hectáreas','Cultivo','2do Cultivo','Variedad','Fecha Siembra','Notas'],
      ...lotes.map(l=>[l.nombre,l.hectareas,l.cultivo??'',l.cultivo_2??'',l.variedad??'',l.fecha_siembra??'',l.notas??''])];
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:20},{wch:10},{wch:12},{wch:12},{wch:15},{wch:14},{wch:30}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Lotes');
    XLSX.writeFile(wb,`lotes-${productor.razon_social.replace(/\s/g,'-')}-${campana?.nombre??''}.xlsx`);
  }

  async function descargarPlantilla(){
    await loadXLSX();
    const rows=[['Nombre','Hectáreas','Cultivo','2do Cultivo','Variedad','Fecha Siembra','Notas'],
      ['Lote Norte',120.5,'Soja','','DM 4210','2026-11-01',''],['Lote Sur',85,'Trigo','Soja','Klein Tauro','2026-06-15','']];
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:20},{wch:10},{wch:12},{wch:12},{wch:15},{wch:14},{wch:30}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Lotes');
    XLSX.writeFile(wb,'plantilla-lotes.xlsx');
  }

  async function importar(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file) return;
    setImportando(true); setMsg('');
    try{
      await loadXLSX();
      const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true});
      const rows:any[]=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      if(!rows.length){setMsg('El archivo está vacío');setImportando(false);return;}
      const toInsert=rows.filter(r=>r['Nombre']||r['nombre']).map(r=>({
        productor_id:productor.id, campana_id:campanaId,
        nombre:String(r['Nombre']||r['nombre']||'').trim(),
        hectareas:parseFloat(String(r['Hectáreas']||r['Hectareas']||r['ha']||r['HA']||0))||0,
        cultivo:String(r['Cultivo']||r['cultivo']||'').trim()||null,
        cultivo_2:String(r['2do Cultivo']||r['cultivo_2']||'').trim()||null,
        variedad:String(r['Variedad']||r['variedad']||'').trim()||null,
        fecha_siembra:parseFecha(r['Fecha Siembra']||r['fecha_siembra']),
        notas:String(r['Notas']||r['notas']||'').trim()||null,
      })).filter(r=>r.nombre&&r.hectareas>0);
      if(!toInsert.length){setMsg('Sin filas válidas.');setImportando(false);return;}
      const{error}=await (createClient() as any).from('lotes').insert(toInsert);
      if(error) setMsg('Error: '+error.message);
      else{setMsg(`✓ ${toInsert.length} lotes importados`); await fetchLotes();}
    }catch(err:any){setMsg('Error: '+err.message);}
    setImportando(false); if(fileRef.current) fileRef.current.value='';
  }

  async function guardarAplicacion(generarImagen = true){
    if(!lotesSeleccionados.length){setErrApl('Seleccioná al menos un lote');return;}
    setSavingApl(true); setErrApl('');
    const costoHa=parseFloat(aplForm.costo_ha)||null;

    // 1. Generar imagen en canvas (solo si se pidió)
    const imagenBlob = generarImagen ? await generarImagenBlob() : null;

    // 2. Subir a Storage
    let imagenUrl: string|null = null;
    if(imagenBlob) {
      const sb = createClient() as any;
      const fileName = `${Date.now()}-${aplForm.tipo.toLowerCase()}-${fmtFecha(aplForm.fecha)}.png`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('aplicaciones').upload(fileName, imagenBlob, { contentType:'image/png', upsert:false });
      if(!uploadError && uploadData) {
        const { data: urlData } = sb.storage.from('aplicaciones').getPublicUrl(fileName);
        imagenUrl = urlData?.publicUrl ?? null;
      }
    }

    // 3. Insertar aplicaciones con imagen_url
    const inserts=lotesSeleccionados.map(lid=>{
      const l=lotes.find(x=>x.id===lid);
      return{ lote_id:lid, fecha:aplForm.fecha,
        tipo: tiposSeleccionados.length > 0 ? tiposSeleccionados.join(' + ') : 'Otro',
        productos:aplForm.productos||null, maquinaria:aplForm.maquinaria,
        propio_alq:aplForm.propio_alq, contratista:aplForm.contratista.trim()||null,
        costo_ha:costoHa, hectareas_apl:l?.hectareas||0,
        observaciones:aplForm.observaciones||null, imagen_url:imagenUrl };
    });
    const{error}=await (createClient() as any).from('aplicaciones').insert(inserts);
    setSavingApl(false);
    if(error){setErrApl(error.message);return;}

    // 4. Descargar imagen localmente también
    if(imagenBlob) {
      const url=URL.createObjectURL(imagenBlob);
      const a=document.createElement('a'); a.href=url;
      a.download=`orden-${aplForm.tipo.toLowerCase()}-${fmtFecha(aplForm.fecha)}.png`; a.click();
      URL.revokeObjectURL(url);
    }

    setAplForm({...APL_VACIO}); setLotesSeleccionados([]); setTiposSeleccionados(['Herbicida']); setShowAplModal(false);
  }

  async function generarImagenBlob(): Promise<Blob|null> {
    const canvas=canvasRef.current; if(!canvas) return null;
    dibujarCanvas(canvas);
    return new Promise(resolve=>canvas.toBlob(b=>resolve(b),'image/png'));
  }

  function generarImagenOrden(){
    const canvas=canvasRef.current; if(!canvas) return;
    dibujarCanvas(canvas);
    const url=canvas.toDataURL('image/png');
    const a=document.createElement('a'); a.href=url;
    a.download=`orden-${aplForm.tipo.toLowerCase()}-${fmtFecha(aplForm.fecha)}.png`; a.click();
  }

  function fmtFecha(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function dibujarCanvas(canvas: HTMLCanvasElement) {
    const lotesInfo = lotes.filter(l => lotesSeleccionados.includes(l.id));
    const prods = aplForm.productos || '—';
    const W = 900;

    // Pre-calcular líneas de producto para altura dinámica
    const tmpC = document.createElement('canvas');
    const tmpX = tmpC.getContext('2d')!;
    tmpX.font = 'bold 17px Inter,sans-serif';
    const pWords = prods.split(' '); let pLine = ''; const pLines: string[] = [];
    for (const w of pWords) {
      const test = pLine + w + ' ';
      if (tmpX.measureText(test).width > W - 80 && pLine) { pLines.push(pLine.trim()); pLine = w + ' '; }
      else pLine = test;
    }
    if (pLine.trim()) pLines.push(pLine.trim());

    const prodBlockH = 22 + pLines.length * 26 + 18;
    const H = Math.max(520, 100 + prodBlockH + 60 + lotesInfo.length * 38 + 100);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Fondo negro
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);

    // Panal fondo
    ctx.strokeStyle = 'rgba(245,158,11,0.07)'; ctx.lineWidth = 1;
    for (let row = 0; row < 30; row++) for (let col = 0; col < 20; col++) {
      const ox = col * 54 + (row % 2 === 0 ? 0 : 27), oy = row * 36 - 18;
      ctx.beginPath();
      [[27,0],[54,18],[54,36],[27,54],[0,36],[0,18]].forEach(([x,y],i) => i===0 ? ctx.moveTo(ox+x,oy+y) : ctx.lineTo(ox+x,oy+y));
      ctx.closePath(); ctx.stroke();
    }

    // Banda verde izquierda
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2EAA6E'); g.addColorStop(1, '#0d2818');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 7, H);

    // ── HEADER ──
    ctx.fillStyle = 'rgba(12,12,12,0.97)'; ctx.fillRect(7, 0, W-7, 98);
    ctx.strokeStyle = 'rgba(245,158,11,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(7, 98); ctx.lineTo(W, 98); ctx.stroke();

    // Eyebrow
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px Inter,sans-serif';
    ctx.letterSpacing = '4px'; ctx.fillText('ORDEN DE APLICACIÓN', 28, 26); ctx.letterSpacing = '0';

    // Tipo
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px Inter,sans-serif';
    ctx.fillText((tiposSeleccionados.length > 0 ? tiposSeleccionados.join(' + ') : 'Herbicida').toUpperCase(), 28, 72);

    // Nombre productor
    ctx.fillStyle = '#777'; ctx.font = 'bold 13px Inter,sans-serif';
    ctx.fillText(productor.razon_social.toUpperCase(), 28, 93);

    // Fecha y maquinaria — derecha
    const maqTexto = aplForm.maquinaria==='M' ? 'Mosquito' : aplForm.maquinaria==='D' ? 'Dron' : 'Avión';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 28px Inter,sans-serif';
    ctx.fillText(fmtFecha(aplForm.fecha), W-28, 46);
    ctx.fillStyle = '#a3a3a3'; ctx.font = '14px Inter,sans-serif';
    ctx.fillText(`${maqTexto} · ${aplForm.propio_alq}${aplForm.contratista ? ' · ' + aplForm.contratista.toUpperCase() : ''}`, W-28, 70);
    ctx.textAlign = 'left';

    // ── PRODUCTOS Y DOSIS — bloque verde AFA ancho completo ──
    let y = 98;
    ctx.fillStyle = '#0f3320'; ctx.fillRect(7, y, W-7, prodBlockH);
    ctx.strokeStyle = '#2EAA6E'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(7, y + prodBlockH); ctx.lineTo(W, y + prodBlockH); ctx.stroke();

    y += 18;
    ctx.fillStyle = '#2EAA6E'; ctx.font = 'bold 9px Inter,sans-serif';
    ctx.letterSpacing = '3px'; ctx.fillText('PRODUCTOS Y DOSIS', 28, y); ctx.letterSpacing = '0';
    y += 22;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px Inter,sans-serif';
    pLines.forEach(l => { ctx.fillText(l, 28, y); y += 26; });
    y += 12;

    // ── LOTES ──
    y += 16;
    ctx.fillStyle = '#444'; ctx.font = 'bold 9px Inter,sans-serif';
    ctx.letterSpacing = '3px'; ctx.fillText('LOTES A APLICAR', 28, y); ctx.letterSpacing = '0';
    y += 20;

    let totalHasApl = 0;
    lotesInfo.forEach(l => {
      totalHasApl += l.hectareas;
      const lc = cropColor(l.cultivo);
      ctx.fillStyle = lc; ctx.font = 'bold 14px Inter,sans-serif';
      ctx.fillText(`▸ ${l.nombre}`, 28, y);
      ctx.fillStyle = '#888'; ctx.font = '12px Inter,sans-serif';
      ctx.fillText(`${l.hectareas} ha${l.cultivo ? ' · ' + l.cultivo : ''}`, 36, y + 16);
      y += 36;
    });

    // ── FOOTER ──
    y += 10;
    ctx.strokeStyle = 'rgba(245,158,11,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(W-22, y); ctx.stroke();
    y += 20;

    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 15px Inter,sans-serif';
    ctx.fillText(`TOTAL: ${totalHasApl} ha`, 28, y);

    const costoHa = parseFloat(aplForm.costo_ha) || 0;
    if (costoHa) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2EAA6E'; ctx.font = 'bold 15px Inter,sans-serif';
      ctx.fillText(`U$S ${(costoHa * totalHasApl).toLocaleString('es-AR')} total · U$S ${costoHa}/ha`, W-28, y);
      ctx.textAlign = 'left';
    }

    if (aplForm.observaciones) {
      y += 22; ctx.fillStyle = '#666'; ctx.font = 'italic 12px Inter,sans-serif';
      ctx.fillText(aplForm.observaciones, 28, y);
    }

    // Firma
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f5f5f5'; ctx.font = 'bold 13px Inter,sans-serif';
    const nomIng = ingeniero ? `Ing. Agr. ${ingeniero.nombre}${ingeniero.apellido ? ' ' + ingeniero.apellido : ''}` : 'Ingeniero Agrónomo';
    ctx.fillText(nomIng, W-28, H-26);
    if (ingeniero?.matricula) {
      ctx.fillStyle = '#a3a3a3'; ctx.font = '11px Inter,sans-serif';
      ctx.fillText(`M.P. ${ingeniero.matricula}`, W-28, H-11);
    }
    ctx.textAlign = 'left';
  }

  // Crop styles for lot cards — fondo claro, acento de color por cultivo
  const CROP_STYLES: Record<string,{
    borderColor:string; accentColor:string; numColor:string;
    badgeBg:string; badgeText:string; badgeBorder:string;
    stripColor:string; lightBg:string;
  }> = {
    'Soja':    { borderColor:'#16a34a', accentColor:'#16a34a', numColor:'#15803d',  badgeBg:'#f0fdf4', badgeText:'#15803d', badgeBorder:'#bbf7d0', stripColor:'#22c55e', lightBg:'#f0fdf4' },
    'Soja 2°': { borderColor:'#059669', accentColor:'#059669', numColor:'#047857',  badgeBg:'#ecfdf5', badgeText:'#047857', badgeBorder:'#a7f3d0', stripColor:'#34d399', lightBg:'#ecfdf5' },
    'Maíz':    { borderColor:'#ca8a04', accentColor:'#ca8a04', numColor:'#a16207',  badgeBg:'#fefce8', badgeText:'#a16207', badgeBorder:'#fde68a', stripColor:'#facc15', lightBg:'#fefce8' },
    'Trigo':   { borderColor:'#d97706', accentColor:'#d97706', numColor:'#b45309',  badgeBg:'#fffbeb', badgeText:'#b45309', badgeBorder:'#fcd34d', stripColor:'#f59e0b', lightBg:'#fffbeb' },
    'Cebada':  { borderColor:'#b45309', accentColor:'#b45309', numColor:'#92400e',  badgeBg:'#fef3c7', badgeText:'#92400e', badgeBorder:'#fde68a', stripColor:'#fbbf24', lightBg:'#fef3c7' },
    'Sorgo':   { borderColor:'#ea580c', accentColor:'#ea580c', numColor:'#c2410c',  badgeBg:'#fff7ed', badgeText:'#c2410c', badgeBorder:'#fed7aa', stripColor:'#f97316', lightBg:'#fff7ed' },
    'Girasol': { borderColor:'#0284c7', accentColor:'#0284c7', numColor:'#0369a1',  badgeBg:'#f0f9ff', badgeText:'#0369a1', badgeBorder:'#bae6fd', stripColor:'#38bdf8', lightBg:'#f0f9ff' },
    'Alfalfa': { borderColor:'#0d9488', accentColor:'#0d9488', numColor:'#0f766e',  badgeBg:'#f0fdfa', badgeText:'#0f766e', badgeBorder:'#99f6e4', stripColor:'#14b8a6', lightBg:'#f0fdfa' },
  };
  const DEFAULT_STYLE={ borderColor:'#d0dae6', accentColor:'#94a3b8', numColor:'#475569', badgeBg:'#f8fafc', badgeText:'#64748b', badgeBorder:'#e2e8f0', stripColor:'#94a3b8', lightBg:'#f8fafc' };

  return (
    <div>
      <canvas ref={canvasRef} className="hidden"/>

      {/* Header compacto */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">Productor</p>
          <h1 className="text-2xl font-bold text-hi">{productor.razon_social}</h1>
          {/* Stats inline */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
            <span className="font-black text-lg" style={{color:'#15803d'}}>{Math.round(totalHas)} ha</span>
            <span className="text-mid">·</span>
            <span className="text-hi font-semibold">{lotes.length} lotes</span>
            <span className="text-mid">·</span>
            <span className="text-amber-400 font-semibold">{campana?.nombre??'—'}</span>
            {productor.cuit && <><span className="text-mid">·</span><span className="text-lo">{productor.cuit}</span></>}
            {productor.localidad && <><span className="text-mid">·</span><span className="text-lo">{productor.localidad}</span></>}
            {productor.telefono && <><span className="text-mid">·</span><span className="text-lo">{productor.telefono}</span></>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={()=>setShowAplModal(true)} className="btn-afa text-xs py-1.5 px-3">+ Aplicación</button>
          <Link href={`/analisis?productor=${productor.id}${campanaId ? `&campana=${campanaId}` : ''}`} className="btn-ghost text-xs py-1.5 px-3">🔬 Suelo</Link>
          <Link href={`/productores/${productor.id}/editar`} className="btn-ghost text-xs py-1.5 px-3">✏ Editar</Link>
        </div>
      </div>

      {/* Donut mini inline + stats — compacto en la misma línea de filtros */}
      {lotes.length > 0 && (() => {
        const CROP_COLORS: Record<string,string> = {
          'Soja':'#22c55e','Maíz':'#84cc16','Trigo':'#f59e0b',
          'Girasol':'#38bdf8','Sorgo':'#ea580c','Cebada':'#fbbf24','Alfalfa':'#34d399',
        };
        const grupos: Record<string,number> = {};
        lotes.forEach(l => {
          const c = l.cultivo || 'Sin cultivo';
          grupos[c] = (grupos[c]||0) + Number(l.hectareas);
        });
        const total = Object.values(grupos).reduce((s,v)=>s+v,0);
        const entries = Object.entries(grupos).sort((a,b)=>b[1]-a[1]);
        const R = 16, cx = 20, cy = 20, strokeW = 6;
        const circumference = 2 * Math.PI * R;
        let offset = 0;
        const segments = entries.map(([name, has]) => {
          const pct = has / total;
          const dasharray = pct * circumference;
          const seg = { name, has, pct, dasharray, offset, color: CROP_COLORS[name] ?? '#525252' };
          offset += dasharray;
          return seg;
        });
        const hasActual = lotesFiltrados.reduce((s,l)=>s+Number(l.hectareas),0);

        return (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Donut mini */}
            <div className="relative shrink-0">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="#222" strokeWidth={strokeW}/>
                {segments.map((s,i) => (
                  <circle key={i} cx={cx} cy={cy} r={R} fill="none"
                    stroke={s.color} strokeWidth={strokeW}
                    strokeDasharray={`${s.dasharray} ${circumference-s.dasharray}`}
                    strokeDashoffset={-(s.offset - circumference/4)}
                  />
                ))}
              </svg>
            </div>
            {/* Leyenda inline clickeable */}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {segments.map(s => (
                <button key={s.name}
                  onClick={()=>setFiltroCultivo(f=>f===s.name?'':s.name)}
                  className={cn('flex items-center gap-1 text-[11px] transition-all rounded px-1.5 py-0.5',
                    filtroCultivo===s.name ? 'bg-base-4' : 'hover:bg-base-4 opacity-70 hover:opacity-100')}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}}/>
                  <span className="text-hi font-semibold">{s.name}</span>
                  <span className="text-lo">{Math.round(s.has)} ha</span>
                </button>
              ))}
            </div>
            {/* Stats dinámicas a la derecha */}
            <div className="ml-auto text-right">
              <p className="text-hi font-black text-sm">
                {filtroCultivo
                  ? <><span style={{color: CROP_COLORS[filtroCultivo]??'#f5f5f5'}}>{filtroCultivo}</span> · {lotesFiltrados.length} lotes · {Math.round(hasActual)} ha</>
                  : <>{lotes.length} lotes · {Math.round(totalHas)} ha</>
                }
              </p>
            </div>
          </div>
        );
      })()}

      {/* Modal aplicación */}
      {showAplModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-2xl card p-6 space-y-5" style={{borderColor:'rgba(46,170,110,0.4)'}}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-hi text-lg">Nueva aplicación</h2>
              <button onClick={()=>{setShowAplModal(false);setLotesSeleccionados([]);setErrApl('');}} className="text-lo hover:text-hi text-xl">✕</button>
            </div>

            {/* Filtro y selección de lotes */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <label className="text-xs font-semibold text-mid uppercase tracking-wider">Seleccionar lotes</label>
                <div className="flex gap-1 flex-wrap ml-2">
                  <button onClick={()=>setAplFiltro('')} className={cn('text-[10px] font-bold px-2 py-1 rounded border',aplFiltro===''?'bg-base-5 text-hi border-base-6':'bg-base-3 text-lo border-base-5 hover:border-base-6')}>Todos</button>
                  {cultivosUnicos.map(c=>{
                    const cc=cropColor(c);
                    return <button key={c} onClick={()=>setAplFiltro(f=>f===c?'':c)}
                      className="text-[10px] font-bold px-2 py-1 rounded border transition-all"
                      style={{color:cc,background:aplFiltro===c?cc+'22':'transparent',borderColor:aplFiltro===c?cc:'#333'}}
                    >{c}</button>;
                  })}
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={()=>setLotesSeleccionados(lotesAplFiltrados.map(l=>l.id))} className="text-[10px] text-ochre hover:underline">Todos los filtrados</button>
                  <button onClick={()=>setLotesSeleccionados([])} className="text-[10px] text-lo hover:underline">Limpiar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                {lotesAplFiltrados.map(l=>{
                  const sel=lotesSeleccionados.includes(l.id);
                  const lc=cropColor(l.cultivo);
                  return <button key={l.id} type="button"
                    onClick={()=>setLotesSeleccionados(prev=>sel?prev.filter(x=>x!==l.id):[...prev,l.id])}
                    className="text-xs px-3 py-1.5 rounded border transition-all"
                    style={{background:sel?lc+'22':'transparent',borderColor:sel?lc:'#333',color:sel?lc:'#525252'}}
                  >{l.nombre} · {l.hectareas} ha</button>;
                })}
              </div>
              {lotesSeleccionados.length>0 && (
                <p className="text-xs text-afa mt-2">{lotesSeleccionados.length} lotes · {hasTotalesApl} ha seleccionadas</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label><input type="date" value={aplForm.fecha} onChange={e=>setAplForm(f=>({...f,fecha:e.target.value}))} className="field"/></div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">
                  Tipo de aplicación
                  {tiposSeleccionados.length > 0 && <span className="ml-2 text-ochre normal-case tracking-normal font-normal">{tiposSeleccionados.join(' + ')}</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_BASE.map(t => {
                    const sel = tiposSeleccionados.includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => setTiposSeleccionados(prev =>
                          sel ? prev.filter(x => x !== t) : [...prev, t]
                        )}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                          sel ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre hover:text-ochre'
                        )}
                      >{t}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productos y dosis</label><textarea rows={2} value={aplForm.productos} onChange={e=>setAplForm(f=>({...f,productos:e.target.value}))} className="field resize-none" placeholder="Ej: Roundup 3 l/ha + Banvel 0.5 l/ha"/></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Maquinaria</label>
                <div className="flex gap-1">
                  {[['M','🚜 Mosquito'],['D','🚁 Dron'],['A','✈ Avión']].map(([v,label])=>(
                    <button key={v} type="button" onClick={()=>setAplForm(f=>({...f,maquinaria:v}))}
                      className={cn('flex-1 py-2 rounded text-xs border transition-all',aplForm.maquinaria===v?'bg-ochre text-base-DEFAULT border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                    >{label}</button>
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
                        (aplForm.propio_alq==='Propio'&&v==='Propio')||(aplForm.propio_alq==='Alquilado'&&v==='Alq.')?'bg-ochre text-base-DEFAULT border-ochre':'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                    >{v}</button>
                  ))}
                </div>
              </div>
            </div>

            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Contratista <span className="text-lo normal-case tracking-normal font-normal">(opcional)</span></label><input value={aplForm.contratista} onChange={e=>setAplForm(f=>({...f,contratista:e.target.value}))} className="field" placeholder="Ej: Pérez Aplicaciones"/></div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                Costo aplicación (U$S/ha)
                {aplForm.costo_ha&&hasTotalesApl>0&&<span className="ml-2 text-afa normal-case tracking-normal font-normal">= U$S {(parseFloat(aplForm.costo_ha)*hasTotalesApl).toLocaleString('es-AR')} total</span>}
              </label>
              <input type="number" step="0.01" value={aplForm.costo_ha} onChange={e=>setAplForm(f=>({...f,costo_ha:e.target.value}))} className="field" placeholder="0.00"/>
            </div>

            <div><label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones / Recomendaciones</label><textarea rows={2} value={aplForm.observaciones} onChange={e=>setAplForm(f=>({...f,observaciones:e.target.value}))} className="field resize-none" placeholder="Condiciones, momento óptimo, precauciones..."/></div>

            {errApl&&<p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{errApl}</p>}

            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>guardarAplicacion(true)} disabled={savingApl} className="btn-afa flex-1">
                {savingApl?'Guardando…':`📷 Guardar + Imagen${lotesSeleccionados.length>0?' ('+lotesSeleccionados.length+')':''}`}
              </button>
              <button onClick={()=>guardarAplicacion(false)} disabled={savingApl} className="btn-ghost flex-1">
                {savingApl?'Guardando…':'💾 Guardar solo'}
              </button>
            </div>
            <button onClick={()=>{setShowAplModal(false);setLotesSeleccionados([]);setErrApl('');}} className="text-lo text-xs hover:text-mid w-full text-center pt-1">Cancelar</button>
          </div>
        </div>
      )}

      {/* Toolbar lotes */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-hi text-sm">Lotes</span>
          <div className="flex gap-1 flex-wrap">
            <button onClick={()=>setFiltroCultivo('')} className={cn('text-[10px] font-bold px-2 py-1 rounded border',filtroCultivo===''?'bg-base-5 text-hi border-base-6':'bg-base-3 text-lo border-base-5 hover:border-base-6')}>Todos</button>
            {cultivosUnicos.map(c=>{const cc=cropColor(c);return(
              <button key={c} onClick={()=>setFiltroCultivo(f=>f===c?'':c)}
                className="text-[10px] font-bold px-2 py-1 rounded border transition-all"
                style={{color:cc,background:filtroCultivo===c?cc+'22':'transparent',borderColor:filtroCultivo===c?cc:'#333'}}
              >{c}</button>
            );})}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={descargarPlantilla} className="btn-ghost text-xs py-1.5 px-3">↓ Plantilla</button>
          <button onClick={()=>fileRef.current?.click()} disabled={importando||!campanaId} className="btn-ghost text-xs py-1.5 px-3">{importando?'Importando…':'↑ Importar'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importar}/>
          {lotes.length>0&&<button onClick={exportar} className="btn-ghost text-xs py-1.5 px-3">↓ Exportar</button>}
          <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs py-1.5 px-3">+ Nuevo lote</Link>
        </div>
      </div>

      {msg&&<p className={cn('text-xs rounded px-3 py-2 mb-4',msg.startsWith('✓')?'text-green-400 bg-green-950 border border-green-800':'text-red-400 bg-red-950 border border-red-800')}>{msg}</p>}

      {confirmDelete&&(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="font-bold text-hi mb-1">¿Eliminar lote?</h3>
            <p className="text-red-400 font-semibold text-sm mb-1">{confirmDelete.nombre}</p>
            <p className="text-lo text-xs mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3"><button onClick={()=>eliminarLote(confirmDelete.id)} className="btn-danger flex-1">Sí, eliminar</button><button onClick={()=>setConfirmDelete(null)} className="btn-ghost flex-1">Cancelar</button></div>
          </div>
        </div>
      )}

      {loading?<p className="text-mid text-sm">Cargando lotes…</p>:lotes.length===0?(
        <div className="card p-8 text-center">
          <p className="text-mid text-sm mb-4">No hay lotes para esta campaña.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={descargarPlantilla} className="btn-ghost text-xs">↓ Plantilla</button>
            <button onClick={()=>fileRef.current?.click()} className="btn-ghost text-xs">↑ Importar</button>
            <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs">+ Nuevo lote</Link>
          </div>
        </div>
      ):(
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {lotesFiltrados.map(l=>{
            const actual=esCultivo(l.cultivo)?l.cultivo:esCultivo(l.cultivo_2)?l.cultivo_2:null;
            const esSegundoCultivo = actual === 'Soja' && esCultivo(l.cultivo) && esCultivo(l.cultivo_2) && l.cultivo !== 'Soja';
            const styleKey = esSegundoCultivo ? 'Soja 2°' : (actual ?? '');
            const s = CROP_STYLES[styleKey] ?? DEFAULT_STYLE;
            const cultivos = [l.cultivo, l.cultivo_2].filter(Boolean);
            return (
              <div key={l.id}
                className="aspect-square rounded-card flex flex-col relative overflow-hidden group transition-all duration-150 hover:-translate-y-1 hover:shadow-lg bg-white"
                style={{ border: `2px solid ${s.borderColor}`, boxShadow: `0 1px 4px rgba(0,0,0,0.06)` }}
              >
                {/* Franja de color superior por cultivo */}
                <div style={{ height: '5px', background: s.stripColor, width: '100%', flexShrink: 0 }} />

                <Link href={`/productores/${productor.id}/lotes/${l.id}`} className="flex flex-col justify-between flex-1 p-3 pb-8">
                  {/* Nombre + variedad */}
                  <div>
                    <p className="font-black text-sm leading-tight line-clamp-2" style={{ color: '#0f172a' }}>{l.nombre}</p>
                    {l.variedad && (
                      <p className="text-[10px] mt-0.5 truncate font-semibold" style={{ color: '#64748b' }}>{l.variedad}</p>
                    )}
                  </div>

                  {/* Hectáreas — centro */}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-black text-4xl tabular-nums leading-none" style={{ color: s.numColor }}>{l.hectareas}</span>
                    <span className="font-bold text-sm" style={{ color: s.numColor }}>ha</span>
                  </div>

                  {/* Badges + fecha */}
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {cultivos.filter(c => esCultivo(c)).map((c, i) => {
                        const cs = CROP_STYLES[c ?? ''] ?? DEFAULT_STYLE;
                        const isActual = c === actual;
                        return (
                          <span key={c}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded"
                            style={isActual
                              ? { background: cs.badgeBg, color: cs.badgeText, border: `1px solid ${cs.badgeBorder}` }
                              : { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }
                            }
                          >
                            {abrevCultivo(c)}{cultivos.filter(x => esCultivo(x)).length > 1 && i === 1 ? ' 2°' : ''}
                          </span>
                        );
                      })}
                    </div>
                    {l.fecha_siembra && (
                      <div className="font-mono text-[9px]" style={{ color: '#94a3b8' }}>
                        Siem: {fmtFecha(l.fecha_siembra)}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Botón eliminar */}
                <button onClick={() => setConfirmDelete({ id: l.id, nombre: l.nombre })}
                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full border border-red-200 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white hover:border-red-500 flex items-center justify-center text-sm bg-white"
                  title="Eliminar lote">🗑</button>
              </div>
            );
          })}
          <Link href={`/productores/${productor.id}/lotes/nuevo`}
            className="aspect-square rounded-card flex items-center justify-center border-2 border-dashed hover:shadow-md transition-all group bg-white"
            style={{ borderColor: '#d0dae6' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0ea87a'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d0dae6'; }}
          >
            <div className="text-center">
              <div className="text-4xl font-thin mb-1 transition-transform group-hover:scale-110" style={{ color: '#94a3b8' }}>+</div>
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Nuevo lote</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
