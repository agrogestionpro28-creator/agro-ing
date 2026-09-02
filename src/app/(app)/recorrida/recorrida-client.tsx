'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Productor = { id: string; razon_social: string };
type Campana = { id: string; nombre: string };
type Lote = {
  id: string; nombre: string; hectareas: number;
  cultivo: string | null; cultivo_2: string | null;
  variedad: string | null; fecha_siembra: string | null;
  fecha_cosecha: string | null; notas: string | null;
};

const CULTIVOS_FILTRO = ['Todos','Soja','Maíz','Trigo','Girasol','Sorgo','Cebada'];

function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function RecorridaClient({ productores, campanas }: { productores: Productor[]; campanas: Campana[] }) {
  const [campanaId, setCampanaId] = useState(campanas[0]?.id ?? '');
  const [selProductores, setSelProductores] = useState<string[]>(productores.map(p => p.id));
  const [filtroCultivo, setFiltroCultivo] = useState('Todos');
  const [soloActivos, setSoloActivos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{productor: string; lotes: Lote[]}[]>([]);
  const [generado, setGenerado] = useState(false);

  const campanaActual = campanas.find(c => c.id === campanaId);

  function toggleProductor(id: string) {
    setSelProductores(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setGenerado(false);
  }

  async function generarPreview() {
    if (!campanaId || selProductores.length === 0) return;
    setLoading(true);
    const sb = createClient() as any;
    const result: {productor: string; lotes: Lote[]}[] = [];

    for (const pid of selProductores) {
      const prod = productores.find(p => p.id === pid);
      if (!prod) continue;

      let query = sb.from('lotes').select('*')
        .eq('productor_id', pid)
        .eq('campana_id', campanaId)
        .order('nombre');

      const { data: lotes } = await query;
      if (!lotes?.length) continue;

      let filtrados = lotes as Lote[];

      // Filtro cultivo
      if (filtroCultivo !== 'Todos') {
        filtrados = filtrados.filter(l => l.cultivo === filtroCultivo || l.cultivo_2 === filtroCultivo);
      }

      // Solo activos (sin fecha cosecha)
      if (soloActivos) {
        filtrados = filtrados.filter(l => !l.fecha_cosecha);
      }

      if (filtrados.length > 0) {
        result.push({ productor: prod.razon_social, lotes: filtrados });
      }
    }

    setPreview(result);
    setGenerado(true);
    setLoading(false);
  }

  async function descargarExcel() {
    const wb = XLSX.utils.book_new();
    const campNombre = campanaActual?.nombre ?? '';

    // One sheet with all productores grouped
    const rows: any[][] = [];
    const merges: any[] = [];

    const HEADER_STYLE = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1a3d24' } }, alignment: { horizontal: 'center' } };
    const SUBHEADER_STYLE = { font: { bold: true }, fill: { fgColor: { rgb: 'f59e0b22' } } };

    for (const grupo of preview) {
      // Producer header row
      const prodRow = grupo.productor;
      rows.push([prodRow, '', '', '', '', '']);
      const prodRowIdx = rows.length - 1;
      merges.push({ s: { r: prodRowIdx, c: 0 }, e: { r: prodRowIdx, c: 5 } });

      // Column headers
      rows.push(['Lote', 'Has', 'Cultivo', 'Variedad', 'F. Siembra', 'Notas / Observaciones']);

      // Lote rows
      for (const l of grupo.lotes) {
        const cultivo = [l.cultivo, l.cultivo_2].filter(Boolean).join(' / ');
        rows.push([
          l.nombre,
          l.hectareas,
          cultivo,
          l.variedad ?? '',
          fmtFecha(l.fecha_siembra),
          l.notas ?? '',
        ]);
      }

      // Totals row
      const totalHas = grupo.lotes.reduce((s, l) => s + Number(l.hectareas), 0);
      rows.push(['TOTAL', totalHas, `${grupo.lotes.length} lotes`, '', '', '']);

      // Empty separator
      rows.push(['', '', '', '', '', '']);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 28 }, // Lote
      { wch: 8 },  // Has
      { wch: 14 }, // Cultivo
      { wch: 20 }, // Variedad
      { wch: 12 }, // F. Siembra
      { wch: 35 }, // Notas
    ];

    // Merges
    ws['!merges'] = merges;

    XLSX.utils.book_append_sheet(wb, ws, `Recorrida ${campNombre.replace('/', '-')}`);
    XLSX.writeFile(wb, `recorrida-${campNombre.replace('/','-')}.xlsx`);
  }

  const totalLotes = preview.reduce((s, g) => s + g.lotes.length, 0);
  const totalHas = preview.reduce((s, g) => s + g.lotes.reduce((ss, l) => ss + Number(l.hectareas), 0), 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="eyebrow mb-1">Herramientas</p>
        <h1 className="text-2xl font-bold text-hi">Planilla de Recorrida</h1>
        <p className="text-lo text-sm mt-1">Generá un Excel para llevar al campo con los lotes de tus productores.</p>
      </div>

      {/* Configuración */}
      <div className="card p-6 space-y-6 mb-6">

        {/* Campaña */}
        <div>
          <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Campaña</label>
          <div className="flex gap-2 flex-wrap">
            {campanas.map(c => (
              <button key={c.id} onClick={() => { setCampanaId(c.id); setGenerado(false); }}
                className={cn('px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
                  campanaId === c.id ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}
              >{c.nombre}</button>
            ))}
          </div>
        </div>

        {/* Productores */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-mid uppercase tracking-wider">Productores</label>
            <div className="flex gap-2">
              <button onClick={() => { setSelProductores(productores.map(p => p.id)); setGenerado(false); }}
                className="text-[10px] text-ochre hover:underline">Todos</button>
              <button onClick={() => { setSelProductores([]); setGenerado(false); }}
                className="text-[10px] text-lo hover:underline">Ninguno</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {productores.map(p => {
              const sel = selProductores.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggleProductor(p.id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    sel ? 'bg-afa/20 border-afa text-afa' : 'bg-base-3 border-base-5 text-lo hover:border-afa hover:text-afa')}
                >{p.razon_social}</button>
              );
            })}
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Filtrar por cultivo</label>
            <div className="flex flex-wrap gap-2">
              {CULTIVOS_FILTRO.map(c => (
                <button key={c} onClick={() => { setFiltroCultivo(c); setGenerado(false); }}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    filtroCultivo === c ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-lo hover:border-ochre')}
                >{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Estado</label>
            <div className="flex gap-2">
              {[
                { label: 'Solo activos (sin cosecha)', val: true },
                { label: 'Todos los lotes', val: false },
              ].map(opt => (
                <button key={String(opt.val)} onClick={() => { setSoloActivos(opt.val); setGenerado(false); }}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    soloActivos === opt.val ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-lo hover:border-ochre')}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Botón generar */}
        <button onClick={generarPreview} disabled={loading || selProductores.length === 0}
          className="btn-primary w-full">
          {loading ? 'Cargando lotes…' : '👁 Vista previa'}
        </button>
      </div>

      {/* Preview */}
      {generado && preview.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-mid">Sin lotes para los filtros seleccionados.</p>
        </div>
      )}

      {generado && preview.length > 0 && (
        <>
          {/* Resumen + botón descargar */}
          <div className="flex items-center justify-between mb-4 card p-4">
            <div>
              <p className="text-hi font-bold">{preview.length} productores · {totalLotes} lotes · {Math.round(totalHas)} ha</p>
              <p className="text-lo text-xs">Campaña {campanaActual?.nombre} · {filtroCultivo !== 'Todos' ? filtroCultivo : 'Todos los cultivos'}</p>
            </div>
            <button onClick={descargarExcel} className="btn-primary">
              ↓ Descargar Excel
            </button>
          </div>

          {/* Preview table */}
          {preview.map(grupo => (
            <div key={grupo.productor} className="card overflow-hidden mb-4">
              {/* Producer header */}
              <div className="px-5 py-3 border-b border-base-5" style={{background:'rgba(46,170,110,0.1)'}}>
                <p className="font-bold text-afa text-sm uppercase tracking-wide">{grupo.productor}</p>
                <p className="text-lo text-xs">
                  {grupo.lotes.length} lotes · {Math.round(grupo.lotes.reduce((s,l)=>s+Number(l.hectareas),0))} ha
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-base-4 border-b border-base-5">
                  <tr className="text-[10px] uppercase tracking-wider text-lo">
                    <th className="px-4 py-2 text-left">Lote</th>
                    <th className="px-3 py-2 text-right">Has</th>
                    <th className="px-3 py-2 text-left">Cultivo</th>
                    <th className="px-3 py-2 text-left">Variedad</th>
                    <th className="px-3 py-2 text-left">F. Siembra</th>
                    <th className="px-3 py-2 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.lotes.map(l => (
                    <tr key={l.id} className="border-b border-base-5 last:border-0 hover:bg-base-4">
                      <td className="px-4 py-2 font-semibold text-hi">{l.nombre}</td>
                      <td className="px-3 py-2 text-right text-ochre font-bold">{l.hectareas}</td>
                      <td className="px-3 py-2 text-mid text-xs">{[l.cultivo, l.cultivo_2].filter(Boolean).join(' / ')}</td>
                      <td className="px-3 py-2 text-lo text-xs">{l.variedad ?? '—'}</td>
                      <td className="px-3 py-2 text-lo text-xs">{fmtFecha(l.fecha_siembra) || '—'}</td>
                      <td className="px-3 py-2 text-lo text-xs italic">{l.notas ?? ''}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-base-4 border-t border-base-5">
                    <td className="px-4 py-2 font-bold text-hi text-xs">TOTAL</td>
                    <td className="px-3 py-2 text-right font-black text-ochre">
                      {Math.round(grupo.lotes.reduce((s,l)=>s+Number(l.hectareas),0))}
                    </td>
                    <td colSpan={4} className="px-3 py-2 text-lo text-xs">{grupo.lotes.length} lotes</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div className="text-center">
            <button onClick={descargarExcel} className="btn-primary px-8">
              ↓ Descargar Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
