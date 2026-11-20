'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCampana } from '@/components/layout/app-shell';
import { fmtFecha } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────
type Productor = { id: string; razon_social: string };
type Campana   = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Lote      = { id: string; nombre: string; hectareas: number; cultivo: string | null; cultivo_2: string | null; productor_id: string; campana_id: string; fecha_siembra: string | null; fecha_cosecha: string | null };
type Cosecha   = {
  id: string; lote_id: string; ingeniero_id: string; cultivo: string;
  fecha_cosecha: string | null;
  rinde_kg_ha: number | null;
  humedad_pct: number | null;
  rinde_std_kg_ha: number | null;
  proteina_pct: number | null;
  aceite_pct: number | null;
  peso_hecto: number | null;
  observaciones: string | null;
  created_at: string;
};

// Fila para carga masiva tipo planilla
type FilaCosecha = {
  lote_id: string
  lote_nombre: string
  hectareas: number
  productor_nombre: string
  cultivo: string
  cosecha_id: string | null    // null = no existe aún
  fecha_cosecha: string
  rinde_kg_ha: string
  humedad_pct: string
  observaciones: string
  sucio: boolean
  guardando: boolean
  ok: boolean
}

// ── Colores por cultivo ───────────────────────────────────
const CULT_STYLE: Record<string, { strip: string; badge: string; text: string; border: string }> = {
  'Soja':    { strip: '#22c55e', badge: '#f0fdf4', text: '#15803d', border: '#16a34a' },
  'Soja 2°': { strip: '#34d399', badge: '#ecfdf5', text: '#047857', border: '#059669' },
  'Maíz':    { strip: '#facc15', badge: '#fefce8', text: '#a16207', border: '#ca8a04' },
  'Trigo':   { strip: '#f59e0b', badge: '#fffbeb', text: '#b45309', border: '#d97706' },
  'Cebada':  { strip: '#fbbf24', badge: '#fef3c7', text: '#92400e', border: '#b45309' },
  'Sorgo':   { strip: '#f97316', badge: '#fff7ed', text: '#c2410c', border: '#ea580c' },
  'Girasol': { strip: '#38bdf8', badge: '#f0f9ff', text: '#0369a1', border: '#0284c7' },
  'Alfalfa': { strip: '#14b8a6', badge: '#f0fdfa', text: '#0f766e', border: '#0d9488' },
};
const DEFAULT_STYLE = { strip: '#94a3b8', badge: '#f8fafc', text: '#64748b', border: '#d0dae6' };
function cultStyle(c: string) {
  for (const [k, v] of Object.entries(CULT_STYLE)) if (c.startsWith(k) || k.startsWith(c)) return v;
  return DEFAULT_STYLE;
}

// Humedad estándar por cultivo
const HUM_STD: Record<string, number> = {
  Trigo: 14.5, Cebada: 14, Soja: 13.5, 'Soja 2°': 13.5,
  Maíz: 14.5, Girasol: 11, Sorgo: 14, Alfalfa: 12,
};
function rindeStd(kg_ha: number, hum: number, cultivo: string): number {
  const hStd = HUM_STD[cultivo] ?? 14;
  return kg_ha * (100 - hum) / (100 - hStd);
}

function fmt(n: number, dec = 1) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function num(s: string) { const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? null : v; }

// Tabs de vista
type Tab = 'resumen' | 'cultivo' | 'lotes';

// ── Componente principal ──────────────────────────────────
export function CosechaClient({
  productores, campanas, lotes, cosechas: cosechasInit, userId,
}: {
  productores: Productor[];
  campanas:    Campana[];
  lotes:       Lote[];
  cosechas:    Cosecha[];
  userId:      string;
}) {
  const sb = createClient() as any;
  const { campanaId } = useCampana();
  const [cosechas, setCosechas] = useState<Cosecha[]>(cosechasInit);
  const [tab, setTab] = useState<Tab>('resumen');
  const [toast, setToast] = useState<string | null>(null);
  const [filtroGlobal, setFiltroGlobal] = useState('');
  const [filtroCultivo, setFiltroCultivo] = useState('');
  const [filtroProductor, setFiltroProductor] = useState('');

  // Modo carga masiva
  const [modoCarga, setModoCarga] = useState(false);
  const [cultivoCarga, setCultivoCarga] = useState('');
  const [filasCarga, setFilasCarga] = useState<FilaCosecha[]>([]);
  const [guardandoTodo, setGuardandoTodo] = useState(false);

  // Lotes de la campaña actual
  const lotesActuales = useMemo(() => lotes.filter(l => l.campana_id === campanaId), [lotes, campanaId]);
  const lotesIds = useMemo(() => new Set(lotesActuales.map(l => l.id)), [lotesActuales]);

  // Cosechas de la campaña actual
  const cosechasActuales = useMemo(
    () => cosechas.filter(c => lotesIds.has(c.lote_id)),
    [cosechas, lotesIds]
  );

  // Cultivos disponibles en lotes actuales (para el selector de carga masiva)
  const cultivosEnLotes = useMemo(() => {
    const set = new Set<string>();
    for (const l of lotesActuales) {
      if (l.cultivo) set.add(l.cultivo);
      if (l.cultivo_2) set.add(l.cultivo_2);
    }
    return [...set].sort();
  }, [lotesActuales]);

  // Cosechas filtradas por cultivo global
  const cosechasGlobal = useMemo(
    () => filtroGlobal ? cosechasActuales.filter(c => c.cultivo === filtroGlobal) : cosechasActuales,
    [cosechasActuales, filtroGlobal]
  );

  // Enriquecer cosechas
  const enriched = useMemo(() => cosechasGlobal.map(c => {
    const lote = lotesActuales.find(l => l.id === c.lote_id);
    const prod = productores.find(p => p.id === lote?.productor_id);
    return { ...c, lote, prod };
  }), [cosechasGlobal, lotesActuales, productores]);

  // Filtrados (tab Todos los lotes)
  const filtrados = useMemo(() => enriched.filter(c =>
    (!filtroCultivo || c.cultivo === filtroCultivo) &&
    (!filtroProductor || c.prod?.id === filtroProductor)
  ), [enriched, filtroCultivo, filtroProductor]);

  const cultivosConCosecha = useMemo(() =>
    [...new Set(cosechasActuales.map(c => c.cultivo))].sort(),
    [cosechasActuales]
  );

  // Stats globales
  const stats = useMemo(() => {
    const cosHaVal = filtrados.filter(c => c.rinde_kg_ha && c.lote?.hectareas);
    const totalHa  = cosHaVal.reduce((s, c) => s + Number(c.lote!.hectareas), 0);
    const promKgHa = cosHaVal.length ? cosHaVal.reduce((s, c) => s + Number(c.rinde_kg_ha), 0) / cosHaVal.length : null;
    const totalTn  = cosHaVal.reduce((s, c) => s + (Number(c.rinde_kg_ha) * Number(c.lote!.hectareas)) / 1000, 0);
    return { totalHa, promKgHa, totalTn, n: filtrados.length };
  }, [filtrados]);

  // Por cultivo
  const porCultivo = useMemo(() => {
    const grupos: Record<string, typeof enriched> = {};
    for (const c of enriched) {
      if (!grupos[c.cultivo]) grupos[c.cultivo] = [];
      grupos[c.cultivo].push(c);
    }
    return Object.entries(grupos).map(([cultivo, items]) => {
      const conRinde = items.filter(c => c.rinde_kg_ha && c.lote?.hectareas);
      const totalHa  = conRinde.reduce((s, c) => s + Number(c.lote!.hectareas), 0);
      const totalTn  = conRinde.reduce((s, c) => s + (Number(c.rinde_kg_ha) * Number(c.lote!.hectareas)) / 1000, 0);
      const promKgHa = conRinde.length ? conRinde.reduce((s, c) => s + Number(c.rinde_kg_ha), 0) / conRinde.length : null;
      const maxRinde = conRinde.length ? Math.max(...conRinde.map(c => Number(c.rinde_kg_ha))) : null;
      const minRinde = conRinde.length ? Math.min(...conRinde.map(c => Number(c.rinde_kg_ha))) : null;
      const lotesCosechados = conRinde.length;
      const lotesPendientes = items.filter(c => !c.rinde_kg_ha).length;
      return { cultivo, items, conRinde, totalHa, totalTn, promKgHa, maxRinde, minRinde, lotesCosechados, lotesPendientes };
    }).sort((a, b) => (b.totalHa || 0) - (a.totalHa || 0));
  }, [enriched]);

  // ── Carga masiva ─────────────────────────────────────────
  function abrirCarga(cultivo: string) {
    setCultivoCarga(cultivo);
    setModoCarga(true);

    // Buscar lotes que tienen este cultivo (principal o secundario)
    const prodMap: Record<string, string> = {};
    productores.forEach(p => { prodMap[p.id] = p.razon_social; });

    const filas: FilaCosecha[] = [];
    for (const l of lotesActuales) {
      const esPrincipal = l.cultivo === cultivo;
      const esSecundario = l.cultivo_2 === cultivo;
      if (!esPrincipal && !esSecundario) continue;

      // Buscar si ya tiene cosecha de este cultivo
      const cosechaExistente = cosechasActuales.find(c => c.lote_id === l.id && c.cultivo === cultivo);

      filas.push({
        lote_id: l.id,
        lote_nombre: l.nombre,
        hectareas: l.hectareas,
        productor_nombre: prodMap[l.productor_id] ?? '—',
        cultivo,
        cosecha_id: cosechaExistente?.id ?? null,
        fecha_cosecha: cosechaExistente?.fecha_cosecha ?? new Date().toISOString().slice(0, 10),
        rinde_kg_ha: cosechaExistente?.rinde_kg_ha != null ? String(cosechaExistente.rinde_kg_ha) : '',
        humedad_pct: cosechaExistente?.humedad_pct != null ? String(cosechaExistente.humedad_pct) : '',
        observaciones: cosechaExistente?.observaciones ?? '',
        sucio: false,
        guardando: false,
        ok: false,
      });
    }

    // Ordenar: sin rinde primero, luego por productor
    filas.sort((a, b) => {
      if (!a.rinde_kg_ha && b.rinde_kg_ha) return -1;
      if (a.rinde_kg_ha && !b.rinde_kg_ha) return 1;
      return a.productor_nombre.localeCompare(b.productor_nombre) || a.lote_nombre.localeCompare(b.lote_nombre);
    });

    setFilasCarga(filas);
  }

  function cerrarCarga() {
    setModoCarga(false);
    setCultivoCarga('');
    setFilasCarga([]);
  }

  function setFila(loteId: string, campo: Partial<FilaCosecha>) {
    setFilasCarga(fs => fs.map(f =>
      f.lote_id === loteId ? { ...f, ...campo, sucio: true, ok: false } : f
    ));
  }

  async function guardarFila(loteId: string) {
    const fila = filasCarga.find(f => f.lote_id === loteId);
    if (!fila || (!fila.rinde_kg_ha && !fila.fecha_cosecha)) return;
    setFilasCarga(fs => fs.map(f => f.lote_id === loteId ? { ...f, guardando: true } : f));

    const rinde = num(fila.rinde_kg_ha);
    const hum   = num(fila.humedad_pct);
    const std   = rinde && hum ? Math.round(rindeStd(rinde, hum, fila.cultivo)) : null;

    const row = {
      lote_id: loteId,
      ingeniero_id: userId,
      cultivo: fila.cultivo,
      fecha_cosecha: fila.fecha_cosecha || null,
      rinde_kg_ha: rinde,
      humedad_pct: hum,
      rinde_std_kg_ha: std,
      observaciones: fila.observaciones || null,
    };

    try {
      let saved: Cosecha;
      if (fila.cosecha_id) {
        const { data } = await sb.from('cosechas').update(row).eq('id', fila.cosecha_id).select().single();
        saved = data;
      } else {
        const { data } = await sb.from('cosechas').insert(row).select().single();
        saved = data;
        // Actualizar cosecha_id en la fila
        setFilasCarga(fs => fs.map(f => f.lote_id === loteId ? { ...f, cosecha_id: saved.id } : f));
      }
      // Actualizar estado global de cosechas
      setCosechas(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
      setFilasCarga(fs => fs.map(f =>
        f.lote_id === loteId ? { ...f, guardando: false, sucio: false, ok: true } : f
      ));
      setTimeout(() => setFilasCarga(fs => fs.map(f =>
        f.lote_id === loteId ? { ...f, ok: false } : f
      )), 2000);
    } catch {
      setFilasCarga(fs => fs.map(f => f.lote_id === loteId ? { ...f, guardando: false } : f));
    }
  }

  async function guardarTodo() {
    setGuardandoTodo(true);
    const sucias = filasCarga.filter(f => f.sucio && f.rinde_kg_ha);
    await Promise.all(sucias.map(f => guardarFila(f.lote_id)));
    setGuardandoTodo(false);
    setToast(`${sucias.length} registros guardados ✓`);
    setTimeout(() => setToast(null), 2500);
  }

  async function onEliminar(id: string) {
    if (!confirm('¿Eliminar este registro de cosecha?')) return;
    await sb.from('cosechas').delete().eq('id', id);
    setCosechas(prev => prev.filter(c => c.id !== id));
    setToast('Eliminado');
    setTimeout(() => setToast(null), 1800);
  }

  const haysucios = filasCarga.some(f => f.sucio && f.rinde_kg_ha);
  const cs = cultStyle(cultivoCarga);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-0.5">Cosecha</p>
          <h1 className="text-2xl font-black text-hi tracking-tight">Rindes de cosecha</h1>
          <p className="text-lo text-sm mt-0.5">Seleccioná un cultivo y cargá los rindes de todos los lotes a la vez.</p>
        </div>
        {modoCarga && (
          <button onClick={cerrarCarga} className="btn-secondary">
            ← Volver
          </button>
        )}
      </div>

      {/* ── MODO CARGA MASIVA ── */}
      {modoCarga && (
        <div className="space-y-4">
          {/* Header del cultivo */}
          <div
            className="rounded-2xl border-2 px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: cs.badge, borderColor: cs.border }}
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: cs.strip }} />
              <h2 className="text-lg font-black" style={{ color: cs.text }}>{cultivoCarga}</h2>
              <span className="text-sm font-semibold" style={{ color: cs.text, opacity: 0.7 }}>
                {filasCarga.length} lotes · {filasCarga.filter(f => f.rinde_kg_ha).length} con rinde
              </span>
            </div>
            {haysucios && (
              <button onClick={guardarTodo} disabled={guardandoTodo} className="btn-primary">
                {guardandoTodo
                  ? <><span className="animate-spin inline-block">⏳</span> Guardando...</>
                  : <>💾 Guardar todo <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-black">{filasCarga.filter(f => f.sucio && f.rinde_kg_ha).length}</span></>
                }
              </button>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80">Productor / Lote</th>
                  <th className="text-center py-3 px-2 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-12">Ha</th>
                  <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-[140px]">Fecha cosecha</th>
                  <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-[120px]">Rinde kg/ha</th>
                  <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-[100px]">Humedad %</th>
                  <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80 w-[100px]">Std kg/ha</th>
                  <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-mid bg-slate-50/80">Obs.</th>
                  <th className="bg-slate-50/80 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filasCarga.map(fila => {
                  const rindeN = num(fila.rinde_kg_ha);
                  const humN   = num(fila.humedad_pct);
                  const std    = rindeN && humN ? Math.round(rindeStd(rindeN, humN, fila.cultivo)) : null;
                  const tieneRinde = !!fila.cosecha_id || !!fila.rinde_kg_ha;

                  return (
                    <tr
                      key={fila.lote_id}
                      className={`group transition-colors
                        ${fila.ok ? 'bg-green-50/60' : ''}
                        ${fila.sucio && !fila.ok ? 'bg-amber-50/60' : ''}
                        hover:bg-slate-50/80
                      `}
                    >
                      {/* Productor / Lote */}
                      <td className="py-2 px-4">
                        <p className="text-[10px] text-mid font-semibold leading-none mb-0.5">{fila.productor_nombre}</p>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: cs.strip, color: '#fff' }}
                          >
                            {fila.cultivo.slice(0, 3).toUpperCase()}
                          </span>
                          <p className="text-hi font-semibold text-xs">{fila.lote_nombre}</p>
                          {!tieneRinde && <span className="text-[9px] text-red-400 font-bold">sin rinde</span>}
                        </div>
                      </td>

                      {/* Ha */}
                      <td className="text-center py-2 px-2 text-mid text-xs font-mono">{fila.hectareas}</td>

                      {/* Fecha */}
                      <td className="py-1.5 px-2">
                        <input
                          type="date"
                          value={fila.fecha_cosecha}
                          onChange={e => setFila(fila.lote_id, { fecha_cosecha: e.target.value })}
                          className="field py-1.5 text-xs"
                          style={{ minWidth: '128px' }}
                        />
                      </td>

                      {/* Rinde */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={fila.rinde_kg_ha}
                          onChange={e => setFila(fila.lote_id, { rinde_kg_ha: e.target.value })}
                          placeholder="ej. 3200"
                          className="field py-1.5 text-xs font-mono"
                          style={{ minWidth: '90px' }}
                        />
                      </td>

                      {/* Humedad */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={fila.humedad_pct}
                          onChange={e => setFila(fila.lote_id, { humedad_pct: e.target.value })}
                          placeholder="ej. 14.5"
                          className="field py-1.5 text-xs font-mono"
                          style={{ minWidth: '80px' }}
                        />
                      </td>

                      {/* Std — calculado automático */}
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-mid tabular-nums">
                          {std ? fmt(std, 0) : '—'}
                        </span>
                      </td>

                      {/* Observaciones */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={fila.observaciones}
                          onChange={e => setFila(fila.lote_id, { observaciones: e.target.value })}
                          placeholder="opcional"
                          className="field py-1.5 text-xs"
                        />
                      </td>

                      {/* Acción */}
                      <td className="py-1.5 px-3 text-center">
                        {fila.guardando ? (
                          <span className="text-mid text-xs animate-pulse">guardando</span>
                        ) : fila.ok ? (
                          <span className="inline-flex items-center gap-1 text-afa text-xs font-bold">
                            <span>✓</span> Guardado
                          </span>
                        ) : fila.sucio ? (
                          <button
                            onClick={() => guardarFila(fila.lote_id)}
                            className="text-xs font-bold text-amber-600 hover:text-hi bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-all border border-amber-200"
                          >
                            Guardar
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs opacity-0 group-hover:opacity-60 transition-opacity">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Guardar todo al pie */}
          {haysucios && filasCarga.length > 4 && (
            <div className="flex justify-end">
              <button onClick={guardarTodo} disabled={guardandoTodo} className="btn-primary">
                {guardandoTodo ? 'Guardando...' : `💾 Guardar todo (${filasCarga.filter(f => f.sucio && f.rinde_kg_ha).length} cambios)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODO NORMAL ── */}
      {!modoCarga && (
        <>
          {/* Selector de cultivo para carga + filtro global */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">

              {/* Cargar por cultivo */}
              <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-mid">Cargar rindes por cultivo</label>
                <div className="flex gap-2">
                  <select
                    value={cultivoCarga}
                    onChange={e => setCultivoCarga(e.target.value)}
                    className="field py-1.5 text-sm flex-1"
                  >
                    <option value="">Seleccioná un cultivo…</option>
                    {cultivosEnLotes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={() => cultivoCarga && abrirCarga(cultivoCarga)}
                    disabled={!cultivoCarga}
                    className="btn-primary py-1.5 px-4 text-sm disabled:opacity-40"
                  >
                    Cargar →
                  </button>
                </div>
              </div>

              {/* Divisor */}
              {cosechasActuales.length > 0 && (
                <div className="w-px h-10 bg-slate-200 hidden sm:block" />
              )}

              {/* Filtro global para las tabs */}
              {cosechasActuales.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-mid">Filtrar vista</label>
                  <select
                    value={filtroGlobal}
                    onChange={e => setFiltroGlobal(e.target.value)}
                    className="field py-1.5 text-sm min-w-[160px]"
                  >
                    <option value="">Todos los cultivos</option>
                    {cultivosConCosecha.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {cosechasActuales.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2 shadow-sm">
              <p className="text-4xl">🌾</p>
              <p className="font-bold text-hi">Todavía no hay cosechas cargadas esta campaña</p>
              <p className="text-sm text-mid">Seleccioná un cultivo arriba y cargá los rindes.</p>
            </div>
          )}

          {cosechasActuales.length > 0 && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { val: stats.n, label: 'Lotes cosechados', accent: '#0ea87a' },
                  { val: stats.totalHa > 0 ? fmt(stats.totalHa, 0) : '—', label: 'Hectáreas', accent: '#0284c7' },
                  { val: stats.promKgHa ? fmt(stats.promKgHa, 0) : '—', label: 'Rinde prom. kg/ha', accent: '#ca8a04' },
                  { val: stats.totalTn > 0 ? fmt(stats.totalTn, 1) : '—', label: 'Toneladas totales', accent: '#475569' },
                ].map(({ val, label, accent }) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 relative overflow-hidden shadow-sm">
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: accent }} />
                    <p className="text-3xl font-black tabular-nums" style={{ color: accent }}>{val}</p>
                    <p className="text-xs font-bold mt-1 text-mid uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
                {([
                  { id: 'resumen', label: 'Resumen' },
                  { id: 'cultivo', label: 'Por cultivo' },
                  { id: 'lotes',   label: 'Todos los lotes' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="px-4 py-2 rounded-lg text-sm font-bold transition-all duration-150"
                    style={tab === t.id
                      ? { background: '#ffffff', color: '#0f172a', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                      : { color: '#64748b' }
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Resumen */}
              {tab === 'resumen' && (
                <div className="space-y-4">
                  <p className="text-xs font-bold tracking-widest uppercase text-mid">Estado por cultivo</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {porCultivo.map(g => {
                      const st = cultStyle(g.cultivo);
                      return (
                        <div key={g.cultivo} className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: st.border }}>
                          <div className="flex items-center gap-3 px-4 py-3" style={{ background: st.badge }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: st.strip }} />
                            <p className="font-black text-base" style={{ color: st.text }}>{g.cultivo}</p>
                            <span className="text-xs font-semibold ml-auto" style={{ color: st.text, opacity: 0.7 }}>
                              {fmt(g.totalHa, 0)} ha
                            </span>
                            {/* Acceso rápido a carga */}
                            <button
                              onClick={() => abrirCarga(g.cultivo)}
                              className="text-[10px] font-black px-2 py-0.5 rounded-lg transition-all"
                              style={{ background: st.strip, color: '#fff' }}
                              title="Cargar rindes"
                            >
                              + Cargar
                            </button>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-xl font-black tabular-nums" style={{ color: '#0f172a' }}>
                                  {g.promKgHa ? fmt(g.promKgHa, 0) : '—'}
                                </p>
                                <p className="text-[10px] text-mid font-semibold">kg/ha prom.</p>
                              </div>
                              <div>
                                <p className="text-xl font-black tabular-nums text-afa">
                                  {fmt(g.totalTn, 1)}
                                </p>
                                <p className="text-[10px] text-mid font-semibold">t totales</p>
                              </div>
                              <div>
                                <p className="text-xl font-black tabular-nums text-sky-600">
                                  {g.lotesCosechados}
                                  {g.lotesPendientes > 0 && <span className="text-sm text-mid">/{g.lotesCosechados + g.lotesPendientes}</span>}
                                </p>
                                <p className="text-[10px] text-mid font-semibold">lotes</p>
                              </div>
                            </div>
                            {g.minRinde != null && g.maxRinde != null && g.promKgHa != null && g.minRinde !== g.maxRinde && (
                              <BarraRinde min={g.minRinde} max={g.maxRinde} prom={g.promKgHa} color={st.strip} />
                            )}
                            {g.lotesPendientes > 0 && (
                              <p className="text-xs text-mid">{g.lotesPendientes} lote{g.lotesPendientes > 1 ? 's' : ''} sin rinde aún</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab Por cultivo */}
              {tab === 'cultivo' && (
                <div className="space-y-6">
                  {porCultivo.map(g => {
                    const st = cultStyle(g.cultivo);
                    const ranking = [...g.conRinde].sort((a, b) => Number(b.rinde_kg_ha) - Number(a.rinde_kg_ha));
                    const maxR = ranking[0] ? Number(ranking[0].rinde_kg_ha) : 1;
                    return (
                      <div key={g.cultivo} className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: st.border }}>
                        <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: st.badge, borderBottom: `1px solid ${st.border}30` }}>
                          <div className="w-3 h-3 rounded-full" style={{ background: st.strip }} />
                          <h2 className="text-lg font-black" style={{ color: st.text }}>{g.cultivo}</h2>
                          <span className="text-sm font-semibold" style={{ color: st.text, opacity: 0.7 }}>
                            {g.lotesCosechados} lotes · {fmt(g.totalHa, 0)} ha · {fmt(g.totalTn, 1)} t
                          </span>
                          {g.promKgHa && (
                            <span className="ml-auto text-sm font-black px-3 py-0.5 rounded-full" style={{ background: st.badge, color: st.text, border: `1px solid ${st.border}60` }}>
                              Prom: {fmt(g.promKgHa, 0)} kg/ha
                            </span>
                          )}
                          <button
                            onClick={() => abrirCarga(g.cultivo)}
                            className="text-[10px] font-black px-3 py-1 rounded-lg transition-all"
                            style={{ background: st.strip, color: '#fff' }}
                          >
                            + Cargar
                          </button>
                        </div>
                        <div className="p-5">
                          <p className="text-xs font-bold tracking-widest uppercase text-mid mb-3">Ranking de lotes</p>
                          <div className="space-y-2">
                            {ranking.map((c, i) => {
                              const pct = maxR > 0 ? (Number(c.rinde_kg_ha) / maxR) * 100 : 0;
                              return (
                                <div key={c.id} className="flex items-center gap-3">
                                  <span className="text-xs font-black tabular-nums w-5 text-mid">{i + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                      <span className="text-xs font-black truncate" style={{ color: '#0f172a' }}>
                                        {c.lote?.nombre}
                                        <span className="font-semibold text-mid"> · {c.prod?.razon_social}</span>
                                      </span>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-sm font-black tabular-nums" style={{ color: st.text }}>
                                          {fmt(Number(c.rinde_kg_ha), 0)} kg/ha
                                        </span>
                                        <span className="text-xs text-mid font-mono">
                                          {c.lote?.hectareas ? `${fmt(Number(c.rinde_kg_ha) * Number(c.lote.hectareas) / 1000, 1)} t` : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: st.strip }} />
                                    </div>
                                  </div>
                                  <button onClick={() => onEliminar(c.id)} className="text-mid hover:text-danger transition-colors text-xs shrink-0" title="Eliminar">✕</button>
                                </div>
                              );
                            })}
                            {g.items.filter(c => !c.rinde_kg_ha).map(c => (
                              <div key={c.id} className="flex items-center gap-3 opacity-40">
                                <span className="text-xs font-black tabular-nums w-5 text-mid">—</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-xs font-black truncate" style={{ color: '#0f172a' }}>
                                      {c.lote?.nombre}
                                      <span className="font-semibold text-mid"> · {c.prod?.razon_social}</span>
                                    </span>
                                    <span className="text-xs text-mid italic">sin rinde</span>
                                  </div>
                                  <div className="h-2 rounded-full" style={{ background: '#f1f5f9' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab Todos los lotes */}
              {tab === 'lotes' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <select value={filtroCultivo} onChange={e => setFiltroCultivo(e.target.value)} className="field py-1.5 text-sm min-w-[150px]">
                      <option value="">Todos los cultivos</option>
                      {cultivosConCosecha.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filtroProductor} onChange={e => setFiltroProductor(e.target.value)} className="field py-1.5 text-sm min-w-[200px]">
                      <option value="">Todos los productores</option>
                      {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                    </select>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Productor</th>
                          <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Lote</th>
                          <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Cultivo</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Ha</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Rinde kg/ha</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Hum %</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Rinde std</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Total t</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-mid">Fecha</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.length === 0 && (
                          <tr><td colSpan={10} className="px-4 py-6 text-center text-mid text-sm">Sin resultados</td></tr>
                        )}
                        {filtrados.sort((a, b) => a.cultivo.localeCompare(b.cultivo) || (b.rinde_kg_ha ?? 0) - (a.rinde_kg_ha ?? 0)).map(c => {
                          const st = cultStyle(c.cultivo);
                          const std = c.rinde_kg_ha && c.humedad_pct
                            ? rindeStd(Number(c.rinde_kg_ha), Number(c.humedad_pct), c.cultivo)
                            : c.rinde_std_kg_ha;
                          const totalTn = c.rinde_kg_ha && c.lote?.hectareas
                            ? (Number(c.rinde_kg_ha) * Number(c.lote.hectareas)) / 1000
                            : null;
                          return (
                            <tr key={c.id} className="border-t border-base-4 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-mid font-semibold truncate max-w-[130px]">{c.prod?.razon_social}</td>
                              <td className="px-4 py-2.5 font-black text-xs" style={{ color: '#0f172a' }}>{c.lote?.nombre ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: st.badge, color: st.text, border: `1px solid ${st.border}40` }}>
                                  {c.cultivo}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-mid">{c.lote?.hectareas ?? '—'}</td>
                              <td className="px-4 py-2.5 text-right font-black tabular-nums text-sm" style={{ color: st.text }}>
                                {c.rinde_kg_ha ? fmt(Number(c.rinde_kg_ha), 0) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-mid">
                                {c.humedad_pct ? fmt(Number(c.humedad_pct), 1) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-mid">
                                {std ? fmt(Number(std), 0) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black text-sm text-afa">
                                {totalTn ? `${fmt(totalTn, 1)} t` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-mid whitespace-nowrap">
                                {c.fecha_cosecha ? fmtFecha(c.fecha_cosecha) : '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => abrirCarga(c.cultivo)}
                                    className="text-mid hover:text-afa transition-colors text-xs"
                                    title="Editar en planilla"
                                  >✏️</button>
                                  <button
                                    onClick={() => onEliminar(c.id)}
                                    className="text-mid hover:text-danger transition-colors text-xs"
                                    title="Eliminar"
                                  >✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-hi text-base text-sm px-4 py-2 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Barra visual min-max-prom ─────────────────────────────
function BarraRinde({ min, max, prom, color }: { min: number; max: number; prom: number; color: string }) {
  const rng = max - min || 1;
  const promPct = ((prom - min) / rng) * 100;
  return (
    <div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        <div className="absolute h-full rounded-full" style={{ left: '0%', width: '100%', background: `${color}30` }} />
        <div
          className="absolute w-0.5 h-full"
          style={{ left: `${promPct}%`, background: color, transform: 'translateX(-50%)' }}
          title={`Prom: ${prom.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg/ha`}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-mid mt-0.5">
        <span>min {min.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
        <span>max {max.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
