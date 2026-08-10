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

const CULTIVO_COLOR: Record<string, string> = {
  Soja:    'bg-[#1a3d24] text-[#2EAA6E]',
  Maíz:    'bg-[#2a1f00] text-[#f59e0b]',
  Trigo:   'bg-[#2a1500] text-amber-400',
  Girasol: 'bg-[#2a2800] text-yellow-300',
  Sorgo:   'bg-[#2a1a0a] text-orange-400',
  Cebada:  'bg-[#1a2a10] text-green-400',
};

function loadXLSX(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof XLSX !== 'undefined') { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function ProductorDetail({ productor, campanas }: { productor: Productor; campanas: Campana[] }) {
  const { campanaId } = useCampana();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const campana = campanas.find((c) => c.id === campanaId);
  const totalHas = lotes.reduce((s, l) => s + Number(l.hectareas), 0);

  useEffect(() => {
    if (!campanaId) return;
    fetchLotes();
  }, [campanaId, productor.id]);

  async function fetchLotes() {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.from('lotes')
      .select('id, nombre, hectareas, cultivo, cultivo_2, variedad, fecha_siembra, notas')
      .eq('productor_id', productor.id)
      .eq('campana_id', campanaId)
      .order('nombre');
    setLotes(data ?? []);
    setLoading(false);
  }

  async function exportar() {
    await loadXLSX();
    const rows = [
      ['Nombre', 'Hectáreas', 'Cultivo', '2do Cultivo', 'Variedad', 'Fecha Siembra', 'Notas'],
      ...lotes.map(l => [l.nombre, l.hectareas, l.cultivo ?? '', l.cultivo_2 ?? '', l.variedad ?? '', l.fecha_siembra ?? '', l.notas ?? '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lotes');
    XLSX.writeFile(wb, `lotes-${productor.razon_social.replace(/\s/g, '-')}-${campana?.nombre ?? ''}.xlsx`);
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setMsg('');
    try {
      await loadXLSX();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) { setMsg('El archivo está vacío'); setImportando(false); return; }

      const sb = createClient();
      const toInsert = rows
        .filter(r => r['Nombre'] || r['nombre'])
        .map(r => ({
          productor_id:  productor.id,
          campana_id:    campanaId,
          nombre:        String(r['Nombre'] || r['nombre'] || '').trim(),
          hectareas:     parseFloat(String(r['Hectáreas'] || r['Hectareas'] || r['ha'] || r['HA'] || 0)) || 0,
          cultivo:       String(r['Cultivo'] || r['cultivo'] || '').trim() || null,
          cultivo_2:     String(r['2do Cultivo'] || r['cultivo_2'] || '').trim() || null,
          variedad:      String(r['Variedad'] || r['variedad'] || '').trim() || null,
          fecha_siembra: String(r['Fecha Siembra'] || r['fecha_siembra'] || '').trim() || null,
          notas:         String(r['Notas'] || r['notas'] || '').trim() || null,
        }))
        .filter(r => r.nombre && r.hectareas > 0);

      if (toInsert.length === 0) {
        setMsg('No se encontraron filas válidas. Columnas requeridas: Nombre y Hectáreas.');
        setImportando(false);
        return;
      }

      const { error } = await sb.from('lotes').insert(toInsert);
      if (error) { setMsg('Error: ' + error.message); }
      else { setMsg(`✓ ${toInsert.length} lotes importados`); await fetchLotes(); }
    } catch (err: any) {
      setMsg('Error: ' + err.message);
    }
    setImportando(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function descargarPlantilla() {
    await loadXLSX();
    const rows = [
      ['Nombre', 'Hectáreas', 'Cultivo', '2do Cultivo', 'Variedad', 'Fecha Siembra', 'Notas'],
      ['Lote Norte', 120.5, 'Soja', '', 'DM 4210', '2026-11-01', 'Ejemplo'],
      ['Lote Sur', 85, 'Trigo', 'Soja', 'Klein Tauro', '2026-06-15', 'Doble cultivo'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lotes');
    XLSX.writeFile(wb, 'plantilla-lotes.xlsx');
  }

  return (
    <div>
      <p className="eyebrow mb-1">Productor</p>
      <h1 className="text-2xl font-bold text-hi mb-1">{productor.razon_social}</h1>
      <p className="text-mid text-sm mb-6">
        {[productor.cuit, productor.localidad, productor.telefono].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-lo text-xs uppercase tracking-wider mb-1">Hectáreas</div>
          <div className="text-afa font-black text-2xl">{Math.round(totalHas)} ha</div>
        </div>
        <div className="card p-4">
          <div className="text-lo text-xs uppercase tracking-wider mb-1">Lotes</div>
          <div className="text-hi font-bold text-2xl">{lotes.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-lo text-xs uppercase tracking-wider mb-1">Campaña</div>
          <div className="text-ochre font-bold text-lg">{campana?.nombre ?? '—'}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-hi">Lotes — Campaña {campana?.nombre}</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={descargarPlantilla} className="btn-ghost text-xs py-1.5 px-3">↓ Plantilla</button>
          <button onClick={() => fileRef.current?.click()} disabled={importando || !campanaId} className="btn-ghost text-xs py-1.5 px-3">
            {importando ? 'Importando…' : '↑ Importar Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importar} />
          {lotes.length > 0 && <button onClick={exportar} className="btn-ghost text-xs py-1.5 px-3">↓ Exportar</button>}
          <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs py-1.5 px-3">+ Nuevo lote</Link>
        </div>
      </div>

      {msg && (
        <p className={cn('text-xs rounded px-3 py-2 mb-4', msg.startsWith('✓') ? 'text-afa bg-afa-tint border border-afa/30' : 'text-danger bg-red-900/20 border border-red-900/40')}>
          {msg}
        </p>
      )}

      {loading ? (
        <p className="text-mid text-sm">Cargando lotes…</p>
      ) : lotes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-mid text-sm mb-2">No hay lotes para esta campaña.</p>
          <p className="text-lo text-xs mb-4">Importá desde Excel o cargá uno por uno.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={descargarPlantilla} className="btn-ghost text-xs">↓ Plantilla</button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">↑ Importar</button>
            <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs">+ Nuevo lote</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {lotes.map((l) => {
            const cultivos = [l.cultivo, l.cultivo_2].filter(Boolean);
            return (
              <div key={l.id} className="card aspect-square p-3 flex flex-col justify-between relative overflow-hidden hover:border-ochre transition-all duration-150 hover:-translate-y-0.5">
                <svg className="absolute top-0 right-0 opacity-[0.12] w-14 h-12 pointer-events-none" viewBox="0 0 60 52" aria-hidden="true">
                  <polygon points="15,0 45,0 60,26 45,52 15,52 0,26" fill="none" stroke="#f59e0b" strokeWidth="1.5"/>
                </svg>
                <div>
                  <p className="text-hi font-bold text-sm leading-tight line-clamp-2">{l.nombre}</p>
                  {l.variedad && <p className="text-lo text-[10px] mt-0.5 truncate">{l.variedad}</p>}
                </div>
                <div>
                  <div className="text-afa font-black text-3xl leading-none tabular-nums">{l.hectareas}</div>
                  <div className="text-lo text-[10px]">ha</div>
                </div>
                <div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {cultivos.map((c) => (
                      <span key={c} className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', CULTIVO_COLOR[c!] ?? 'bg-base-4 text-mid')}>{c}</span>
                    ))}
                  </div>
                  {l.fecha_siembra && <div className="font-mono text-[9px] text-lo">Siem: {l.fecha_siembra}</div>}
                </div>
              </div>
            );
          })}
          <Link href={`/productores/${productor.id}/lotes/nuevo`} className="card aspect-square flex items-center justify-center border-dashed hover:border-ochre hover:text-ochre text-lo transition-all group">
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
