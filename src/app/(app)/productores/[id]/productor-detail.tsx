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

// Colores por cultivo
const CROP: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  'Soja':     { color: '#22c55e', bg: '#052010', border: '#22c55e', glow: '0 0 16px rgba(34,197,94,0.35)' },
  'Soja 2°':  { color: '#22c55e', bg: '#052010', border: '#22c55e', glow: '0 0 16px rgba(34,197,94,0.35)' },
  'Maíz':     { color: '#84cc16', bg: '#0d1a00', border: '#84cc16', glow: '0 0 16px rgba(132,204,22,0.35)' },
  'Maíz 1°':  { color: '#84cc16', bg: '#0d1a00', border: '#84cc16', glow: '0 0 16px rgba(132,204,22,0.35)' },
  'Trigo':    { color: '#f59e0b', bg: '#1a0f00', border: '#f59e0b', glow: '0 0 16px rgba(245,158,11,0.35)' },
  'Cebada':   { color: '#fbbf24', bg: '#1a1200', border: '#fbbf24', glow: '0 0 16px rgba(251,191,36,0.35)' },
  'Sorgo':    { color: '#b45309', bg: '#1a0800', border: '#b45309', glow: '0 0 16px rgba(180,83,9,0.35)' },
  'Girasol':  { color: '#38bdf8', bg: '#00101a', border: '#38bdf8', glow: '0 0 16px rgba(56,189,248,0.35)' },
  'Alfalfa':  { color: '#34d399', bg: '#001a10', border: '#34d399', glow: '0 0 16px rgba(52,211,153,0.35)' },
};
const DEFAULT_CROP = { color: '#525252', bg: '#111', border: '#333', glow: 'none' };

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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const campana = campanas.find((c) => c.id === campanaId);
  const totalHas = lotes.reduce((s, l) => s + Number(l.hectareas), 0);

  useEffect(() => { if (campanaId) fetchLotes(); }, [campanaId, productor.id]);

  async function fetchLotes() {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.from('lotes')
      .select('id, nombre, hectareas, cultivo, cultivo_2, variedad, fecha_siembra, notas')
      .eq('productor_id', productor.id).eq('campana_id', campanaId).order('nombre');
    setLotes(data ?? []);
    setLoading(false);
  }

  async function eliminarLote(id: string) {
    const sb = createClient();
    await sb.from('lotes').delete().eq('id', id);
    setConfirmDelete(null);
    await fetchLotes();
  }

  async function exportar() {
    await loadXLSX();
    const rows = [['Nombre','Hectáreas','Cultivo','2do Cultivo','Variedad','Fecha Siembra','Notas'],
      ...lotes.map(l => [l.nombre, l.hectareas, l.cultivo??'', l.cultivo_2??'', l.variedad??'', l.fecha_siembra??'', l.notas??''])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:20},{wch:10},{wch:12},{wch:12},{wch:15},{wch:14},{wch:30}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lotes');
    XLSX.writeFile(wb, `lotes-${productor.razon_social.replace(/\s/g,'-')}-${campana?.nombre??''}.xlsx`);
  }

  async function descargarPlantilla() {
    await loadXLSX();
    const rows = [['Nombre','Hectáreas','Cultivo','2do Cultivo','Variedad','Fecha Siembra','Notas'],
      ['Lote Norte',120.5,'Soja','','DM 4210','2026-11-01','Ejemplo'],
      ['Lote Sur',85,'Trigo','Soja','Klein Tauro','2026-06-15','Doble cultivo']];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:20},{wch:10},{wch:12},{wch:12},{wch:15},{wch:14},{wch:30}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lotes');
    XLSX.writeFile(wb, 'plantilla-lotes.xlsx');
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportando(true); setMsg('');
    try {
      await loadXLSX();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) { setMsg('El archivo está vacío'); setImportando(false); return; }
      const toInsert = rows
        .filter(r => r['Nombre'] || r['nombre'])
        .map(r => ({
          productor_id: productor.id, campana_id: campanaId,
          nombre: String(r['Nombre']||r['nombre']||'').trim(),
          hectareas: parseFloat(String(r['Hectáreas']||r['Hectareas']||r['ha']||r['HA']||0))||0,
          cultivo: String(r['Cultivo']||r['cultivo']||'').trim()||null,
          cultivo_2: String(r['2do Cultivo']||r['cultivo_2']||'').trim()||null,
          variedad: String(r['Variedad']||r['variedad']||'').trim()||null,
          fecha_siembra: parseFecha(r['Fecha Siembra']||r['fecha_siembra']),
          notas: String(r['Notas']||r['notas']||'').trim()||null,
        })).filter(r => r.nombre && r.hectareas > 0);
      if (!toInsert.length) { setMsg('No se encontraron filas válidas. Columnas: Nombre y Hectáreas obligatorias.'); setImportando(false); return; }
      const { error } = await createClient().from('lotes').insert(toInsert);
      if (error) setMsg('Error: ' + error.message);
      else { setMsg(`✓ ${toInsert.length} lotes importados`); await fetchLotes(); }
    } catch (err: any) { setMsg('Error: ' + err.message); }
    setImportando(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      {/* Header */}
      <p className="eyebrow mb-1">Productor</p>
      <h1 className="text-2xl font-bold text-hi mb-1">{productor.razon_social}</h1>
      <p className="text-mid text-sm mb-6">
        {[productor.cuit, productor.localidad, productor.telefono].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Hectáreas', value: `${Math.round(totalHas)} ha`, color: '#22c55e' },
          { label: 'Lotes', value: lotes.length, color: '#f5f5f5' },
          { label: 'Campaña', value: campana?.nombre ?? '—', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-lo text-xs uppercase tracking-wider mb-1">{s.label}</div>
            <div className="font-black text-2xl" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
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
        <p className={cn('text-xs rounded px-3 py-2 mb-4', msg.startsWith('✓') ? 'text-[#22c55e] bg-[#052010] border border-[#22c55e]/30' : 'text-red-400 bg-red-900/20 border border-red-900/40')}>
          {msg}
        </p>
      )}

      {/* Modal confirmar eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="card p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-hi mb-2">¿Eliminar lote?</h3>
            <p className="text-mid text-sm mb-5">
              Esta acción no se puede deshacer. Se eliminará el lote y todos sus datos.
            </p>
            <div className="flex gap-3">
              <button onClick={() => eliminarLote(confirmDelete)} className="btn-danger flex-1">Sí, eliminar</button>
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-mid text-sm">Cargando lotes…</p>
      ) : lotes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-mid text-sm mb-2">No hay lotes para esta campaña.</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={descargarPlantilla} className="btn-ghost text-xs">↓ Plantilla</button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">↑ Importar</button>
            <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs">+ Nuevo lote</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {lotes.map((l) => {
            const actual = getCultivoActual(l.cultivo, l.cultivo_2);
            const cfg = CROP[actual ?? ''] ?? DEFAULT_CROP;
            const cultivos = [l.cultivo, l.cultivo_2].filter(Boolean);

            return (
              <div
                key={l.id}
                className="aspect-square rounded-card flex flex-col relative overflow-hidden group"
                style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, boxShadow: cfg.glow }}
              >
                {/* Panal */}
                <svg className="absolute top-0 right-0 opacity-20 w-16 h-14 pointer-events-none" viewBox="0 0 60 52">
                  <polygon points="15,0 45,0 60,26 45,52 15,52 0,26" fill="none" stroke={cfg.color} strokeWidth="1.5"/>
                </svg>

                {/* Botón eliminar */}
                <button
                  onClick={() => setConfirmDelete(l.id)}
                  className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-900/60"
                  title="Eliminar lote"
                >
                  ×
                </button>

                {/* Link al detalle del lote */}
                <Link href={`/productores/${productor.id}/lotes/${l.id}`} className="flex flex-col justify-between h-full p-3">
                  {/* Nombre */}
                  <div>
                    <p className="text-hi font-bold text-sm leading-tight line-clamp-2">{l.nombre}</p>
                    {l.variedad && <p className="text-[10px] mt-0.5 truncate" style={{ color: cfg.color, opacity: 0.7 }}>{l.variedad}</p>}
                  </div>

                  {/* Has centradas */}
                  <div className="flex items-baseline justify-center gap-1.5 my-2">
                    <span className="font-black text-4xl tabular-nums leading-none" style={{ color: cfg.color }}>
                      {l.hectareas}
                    </span>
                    <span className="font-bold text-sm" style={{ color: cfg.color }}>ha</span>
                  </div>

                  {/* Cultivos + fecha */}
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {cultivos.map((c, i) => {
                        const ccfg = CROP[c ?? ''] ?? DEFAULT_CROP;
                        const esActual = c === actual;
                        return (
                          <span
                            key={c}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              color: ccfg.color,
                              background: esActual ? `${ccfg.color}22` : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${esActual ? ccfg.color : 'transparent'}`,
                              opacity: esActual ? 1 : 0.5,
                            }}
                          >
                            {c}{cultivos.length > 1 ? (i === 0 ? ' 1°' : ' 2°') : ''}
                          </span>
                        );
                      })}
                    </div>
                    {l.fecha_siembra && (
                      <div className="font-mono text-[9px]" style={{ color: cfg.color, opacity: 0.6 }}>
                        Siem: {l.fecha_siembra}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}

          {/* + Nuevo */}
          <Link
            href={`/productores/${productor.id}/lotes/nuevo`}
            className="aspect-square rounded-card flex items-center justify-center border-dashed border border-base-5 hover:border-ochre hover:text-ochre text-lo transition-all group"
          >
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
