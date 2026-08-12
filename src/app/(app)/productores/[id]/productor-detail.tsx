'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCampana } from '@/components/layout/app-shell';
import { cn } from '@/lib/utils';

declare const XLSX: any;

type Productor = { id: string; razon_social: string; cuit: string | null; localidad: string | null; telefono: string | null; email: string | null };
type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Lote = { id: string; nombre: string; hectareas: number; cultivo: string | null; cultivo_2: string | null; variedad: string | null; fecha_siembra: string | null; notas: string | null };

// Colores hardcodeados para que Tailwind los incluya siempre
const CROP_STYLES: Record<string, { cardStyle: string; numColor: string; badgeStyle: string }> = {
  'Soja':    { cardStyle: 'bg-green-950 border-green-500 shadow-[0_0_18px_rgba(34,197,94,0.4)]',    numColor: 'text-green-400',  badgeStyle: 'bg-green-900 text-green-400 border border-green-500' },
  'Soja 2°': { cardStyle: 'bg-green-950 border-green-500 shadow-[0_0_18px_rgba(34,197,94,0.4)]',    numColor: 'text-green-400',  badgeStyle: 'bg-green-900 text-green-400 border border-green-500' },
  'Maíz':    { cardStyle: 'bg-lime-950  border-lime-500  shadow-[0_0_18px_rgba(132,204,22,0.4)]',   numColor: 'text-lime-400',   badgeStyle: 'bg-lime-900 text-lime-400 border border-lime-500' },
  'Maíz 1°': { cardStyle: 'bg-lime-950  border-lime-500  shadow-[0_0_18px_rgba(132,204,22,0.4)]',   numColor: 'text-lime-400',   badgeStyle: 'bg-lime-900 text-lime-400 border border-lime-500' },
  'Trigo':   { cardStyle: 'bg-amber-950 border-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.4)]',   numColor: 'text-amber-400',  badgeStyle: 'bg-amber-900 text-amber-400 border border-amber-500' },
  'Cebada':  { cardStyle: 'bg-yellow-950 border-yellow-500 shadow-[0_0_18px_rgba(234,179,8,0.4)]',  numColor: 'text-yellow-400', badgeStyle: 'bg-yellow-900 text-yellow-400 border border-yellow-500' },
  'Sorgo':   { cardStyle: 'bg-orange-950 border-orange-700 shadow-[0_0_18px_rgba(194,65,12,0.4)]',  numColor: 'text-orange-600', badgeStyle: 'bg-orange-950 text-orange-500 border border-orange-700' },
  'Girasol': { cardStyle: 'bg-sky-950   border-sky-400   shadow-[0_0_18px_rgba(56,189,248,0.4)]',   numColor: 'text-sky-400',    badgeStyle: 'bg-sky-900 text-sky-400 border border-sky-400' },
  'Alfalfa': { cardStyle: 'bg-teal-950  border-teal-500  shadow-[0_0_18px_rgba(20,184,166,0.4)]',   numColor: 'text-teal-400',   badgeStyle: 'bg-teal-900 text-teal-400 border border-teal-500' },
};
const DEFAULT_STYLE = { cardStyle: 'bg-base-3 border-base-5', numColor: 'text-mid', badgeStyle: 'bg-base-4 text-lo border border-base-5' };


// Colores SVG reales por cultivo (fill + stroke para hexágono, bar para barra superior)
const HEX_COLOR: Record<string, { fill: string; stroke: string; bar: string }> = {
  'Soja':     { fill: '#052010', stroke: '#22c55e', bar: 'bg-green-500' },
  'Soja 2°':  { fill: '#052010', stroke: '#22c55e', bar: 'bg-green-500' },
  'Maíz':     { fill: '#0d1a00', stroke: '#84cc16', bar: 'bg-lime-500' },
  'Maíz 1°':  { fill: '#0d1a00', stroke: '#84cc16', bar: 'bg-lime-500' },
  'Trigo':    { fill: '#1a0f00', stroke: '#f59e0b', bar: 'bg-amber-500' },
  'Cebada':   { fill: '#1a1200', stroke: '#fbbf24', bar: 'bg-yellow-400' },
  'Sorgo':    { fill: '#1a0800', stroke: '#c2410c', bar: 'bg-orange-700' },
  'Girasol':  { fill: '#00101a', stroke: '#38bdf8', bar: 'bg-sky-400' },
  'Alfalfa':  { fill: '#001a10', stroke: '#34d399', bar: 'bg-teal-400' },
};

function getCultivoActual(c1: string | null, c2: string | null) { return c2 || c1; }

function parseFecha(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const d = new Date(String(val));
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function loadXLSX(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof XLSX !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export function ProductorDetail({ productor, campanas }: { productor: Productor; campanas: Campana[] }) {
  const { campanaId } = useCampana();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const campana = campanas.find((c) => c.id === campanaId);
  const totalHas = lotes.reduce((s, l) => s + Number(l.hectareas), 0);

  useEffect(() => { if (campanaId) fetchLotes(); }, [campanaId, productor.id]);

  async function fetchLotes() {
    setLoading(true);
    const { data } = await createClient().from('lotes')
      .select('id,nombre,hectareas,cultivo,cultivo_2,variedad,fecha_siembra,notas')
      .eq('productor_id', productor.id).eq('campana_id', campanaId).order('nombre');
    setLotes(data ?? []);
    setLoading(false);
  }

  async function eliminarLote(id: string) {
    await createClient().from('lotes').delete().eq('id', id);
    setConfirmDelete(null);
    await fetchLotes();
  }

  async function exportar() {
    await loadXLSX();
    const rows = [['Nombre','Hectáreas','Cultivo','2do Cultivo','Variedad','Fecha Siembra','Notas'],
      ...lotes.map(l=>[l.nombre,l.hectareas,l.cultivo??'',l.cultivo_2??'',l.variedad??'',l.fecha_siembra??'',l.notas??''])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:20},{wch:10},{wch:12},{wch:12},{wch:15},{wch:14},{wch:30}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Lotes');
    XLSX.writeFile(wb,`lotes-${productor.razon_social.replace(/\s/g,'-')}-${campana?.nombre??''}.xlsx`);
  }

  async function descargarPlantilla() {
    await loadXLSX();
    const rows=[['Nombre','Hectáreas','Cultivo','2do Cultivo','Variedad','Fecha Siembra','Notas'],
      ['Lote Norte',120.5,'Soja','','DM 4210','2026-11-01',''],
      ['Lote Sur',85,'Trigo','Soja','Klein Tauro','2026-06-15','Doble cultivo']];
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:20},{wch:10},{wch:12},{wch:12},{wch:15},{wch:14},{wch:30}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Lotes');
    XLSX.writeFile(wb,'plantilla-lotes.xlsx');
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file) return;
    setImportando(true); setMsg('');
    try {
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
      if(!toInsert.length){setMsg('Sin filas válidas. Columnas: Nombre y Hectáreas obligatorias.');setImportando(false);return;}
      const{error}=await createClient().from('lotes').insert(toInsert);
      if(error) setMsg('Error: '+error.message);
      else{setMsg(`✓ ${toInsert.length} lotes importados`);await fetchLotes();}
    } catch(err:any){setMsg('Error: '+err.message);}
    setImportando(false);
    if(fileRef.current) fileRef.current.value='';
  }

  return (
    <div>
      <p className="eyebrow mb-1">Productor</p>
      <h1 className="text-2xl font-bold text-hi mb-1">{productor.razon_social}</h1>
      <p className="text-mid text-sm mb-6">
        {[productor.cuit,productor.localidad,productor.telefono].filter(Boolean).join(' · ')||'Sin datos adicionales'}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4"><div className="text-lo text-xs uppercase tracking-wider mb-1">Hectáreas</div><div className="text-green-400 font-black text-2xl">{Math.round(totalHas)} ha</div></div>
        <div className="card p-4"><div className="text-lo text-xs uppercase tracking-wider mb-1">Lotes</div><div className="text-hi font-black text-2xl">{lotes.length}</div></div>
        <div className="card p-4"><div className="text-lo text-xs uppercase tracking-wider mb-1">Campaña</div><div className="text-amber-400 font-bold text-lg">{campana?.nombre??'—'}</div></div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-hi">Lotes — Campaña {campana?.nombre}</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={descargarPlantilla} className="btn-ghost text-xs py-1.5 px-3">↓ Plantilla</button>
          <button onClick={()=>fileRef.current?.click()} disabled={importando||!campanaId} className="btn-ghost text-xs py-1.5 px-3">
            {importando?'Importando…':'↑ Importar Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importar}/>
          {lotes.length>0&&<button onClick={exportar} className="btn-ghost text-xs py-1.5 px-3">↓ Exportar</button>}
          <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs py-1.5 px-3">+ Nuevo lote</Link>
        </div>
      </div>

      {msg&&<p className={cn('text-xs rounded px-3 py-2 mb-4',msg.startsWith('✓')?'text-green-400 bg-green-950 border border-green-800':'text-red-400 bg-red-950 border border-red-800')}>{msg}</p>}

      {/* Modal eliminar */}
      {confirmDelete&&(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="font-bold text-hi mb-1">¿Eliminar lote?</h3>
            <p className="text-mid text-sm mb-1"><span className="text-red-400 font-semibold">{confirmDelete.nombre}</span></p>
            <p className="text-lo text-xs mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={()=>eliminarLote(confirmDelete.id)} className="btn-danger flex-1">Sí, eliminar</button>
              <button onClick={()=>setConfirmDelete(null)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading?(
        <p className="text-mid text-sm">Cargando lotes…</p>
      ):lotes.length===0?(
        <div className="card p-8 text-center">
          <p className="text-mid text-sm mb-2">No hay lotes para esta campaña.</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={descargarPlantilla} className="btn-ghost text-xs">↓ Plantilla</button>
            <button onClick={()=>fileRef.current?.click()} className="btn-ghost text-xs">↑ Importar</button>
            <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs">+ Nuevo lote</Link>
          </div>
        </div>
      ):(
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {lotes.map((l)=>{
            const actual=getCultivoActual(l.cultivo,l.cultivo_2);
            const s=CROP_STYLES[actual??'']??DEFAULT_STYLE;
            const cultivos=[l.cultivo,l.cultivo_2].filter(Boolean);
            // Colores directos por cultivo
            const cropColor: Record<string,{fill:string,stroke:string}> = {
              'Soja':    {fill:'#052010',stroke:'#22c55e'},
              'Soja 2°': {fill:'#052010',stroke:'#22c55e'},
              'Maíz':    {fill:'#0d1a00',stroke:'#84cc16'},
              'Maíz 1°': {fill:'#0d1a00',stroke:'#84cc16'},
              'Trigo':   {fill:'#1a0f00',stroke:'#f59e0b'},
              'Cebada':  {fill:'#1a1200',stroke:'#fbbf24'},
              'Sorgo':   {fill:'#1a0500',stroke:'#ea580c'},
              'Girasol': {fill:'#00101a',stroke:'#38bdf8'},
              'Alfalfa': {fill:'#001a10',stroke:'#34d399'},
            };
            const cc = actual ? (cropColor[actual] ?? {fill:'#1a1a1a',stroke:'#444'}) : {fill:'#1a1a1a',stroke:'#444'};
            return (
              <div key={l.id} className="aspect-square rounded-card flex flex-col relative overflow-hidden group bg-base-3 border border-base-5 transition-all duration-150 hover:-translate-y-1 hover:border-base-6">

                {/* Barra de color arriba */}
                <div style={{ height: '4px', background: cc.stroke, width: '100%' }} />

                {/* Hexágono grande con color del cultivo */}
                <div className="absolute top-2 right-2 pointer-events-none">
                  <svg width="52" height="46" viewBox="0 0 60 52">
                    <polygon
                      points="15,0 45,0 60,26 45,52 15,52 0,26"
                      fill={cc.fill}
                      stroke={cc.stroke}
                      strokeWidth="4"
                    />
                  </svg>
                </div>

                {/* Link al detalle */}
                <Link href={`/productores/${productor.id}/lotes/${l.id}`} className="flex flex-col justify-between flex-1 p-3 pb-8">
                  {/* Nombre con acento de color */}
                  <div>
                    <p className="text-hi font-bold text-sm leading-tight line-clamp-2 pr-8">{l.nombre}</p>
                    {l.variedad&&<p className="text-[10px] mt-0.5 truncate text-lo">{l.variedad}</p>}
                  </div>

                  {/* Has centradas */}
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-hi font-black text-4xl tabular-nums leading-none">{l.hectareas}</span>
                    <span className="text-mid font-bold text-sm">ha</span>
                  </div>

                  {/* Cultivos + fecha */}
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {cultivos.map((c,i)=>{
                        const fill = HEX_COLOR[c??'']?.fill ?? '#333';
                        const stroke = HEX_COLOR[c??'']?.stroke ?? '#555';
                        const esActual = c===actual;
                        return(
                          <span key={c}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                            style={{
                              background: esActual ? fill+'33' : 'rgba(255,255,255,0.04)',
                              color: esActual ? stroke : '#525252',
                              border: `1px solid ${esActual ? stroke : '#333'}`,
                            }}
                          >
                            {c}{cultivos.length>1?(i===0?' 1°':' 2°'):''}
                          </span>
                        );
                      })}
                    </div>
                    {l.fecha_siembra&&<div className="font-mono text-[9px] text-lo">Siem: {l.fecha_siembra}</div>}
                  </div>
                </Link>

                {/* Tacho eliminar — abajo derecha */}
                <button
                  onClick={()=>setConfirmDelete({id:l.id,nombre:l.nombre})}
                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-red-800 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white hover:border-red-600 flex items-center justify-center text-sm"
                  title="Eliminar lote"
                >
                  🗑
                </button>
              </div>
            );
          })}

          <Link href={`/productores/${productor.id}/lotes/nuevo`} className="aspect-square rounded-card flex items-center justify-center border-2 border-dashed border-base-5 hover:border-amber-500 hover:text-amber-500 text-lo transition-all group">
            <div className="text-center">
              <div className="text-4xl font-thin mb-1 group-hover:scale-110 transition-transform">+</div>
              <div className="text-[10px] uppercase tracking-wider">Nuevo lote</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
