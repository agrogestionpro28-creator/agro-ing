'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCampana } from '@/components/layout/app-shell';
import { cn, fmtFecha } from '@/lib/utils';

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
  const { campanaId } = useCampana();
  const [cosechas, setCosechas] = useState<Cosecha[]>(cosechasInit);
  const [tab, setTab] = useState<Tab>('resumen');
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filtroCultivo, setFiltroCultivo] = useState('');
  const [filtroProductor, setFiltroProductor] = useState('');
  const [sugerencia2doCultivo, setSugerencia2doCultivo] = useState<{ lote: Lote; cultivo2: string } | null>(null);
  const [preloadForm, setPreloadForm] = useState<{ loteId: string; productorId: string; cultivo: string } | null>(null);
  const [editando, setEditando] = useState<Cosecha | null>(null);

  // Lotes de la campaña actual
  const lotesActuales = useMemo(() => lotes.filter(l => l.campana_id === campanaId), [lotes, campanaId]);
  const lotesIds = useMemo(() => new Set(lotesActuales.map(l => l.id)), [lotesActuales]);

  // Cosechas de la campaña actual
  const cosechasActuales = useMemo(
    () => cosechas.filter(c => lotesIds.has(c.lote_id)),
    [cosechas, lotesIds]
  );

  // Enriquecer cosechas con datos del lote y productor
  const enriched = useMemo(() => cosechasActuales.map(c => {
    const lote = lotesActuales.find(l => l.id === c.lote_id);
    const prod = productores.find(p => p.id === lote?.productor_id);
    return { ...c, lote, prod };
  }), [cosechasActuales, lotesActuales, productores]);

  // Filtrados
  const filtrados = useMemo(() => enriched.filter(c =>
    (!filtroCultivo || c.cultivo === filtroCultivo) &&
    (!filtroProductor || c.prod?.id === filtroProductor)
  ), [enriched, filtroCultivo, filtroProductor]);

  // Cultivos únicos con cosechas
  const cultivosConCosecha = useMemo(() =>
    [...new Set(cosechasActuales.map(c => c.cultivo))].sort(),
    [cosechasActuales]
  );

  // Estadísticas globales
  const stats = useMemo(() => {
    const cosHaVal = filtrados.filter(c => c.rinde_kg_ha && c.lote?.hectareas);
    const totalHa  = cosHaVal.reduce((s, c) => s + Number(c.lote!.hectareas), 0);
    const promKgHa = cosHaVal.length ? cosHaVal.reduce((s, c) => s + Number(c.rinde_kg_ha), 0) / cosHaVal.length : null;
    const totalTn  = cosHaVal.reduce((s, c) => s + (Number(c.rinde_kg_ha) * Number(c.lote!.hectareas)) / 1000, 0);
    return { totalHa, promKgHa, totalTn, n: filtrados.length };
  }, [filtrados]);

  // Por cultivo (para tab "Por cultivo")
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

  function onEditar(c: Cosecha) {
    setEditando(c);
    setSugerencia2doCultivo(null);
    setPreloadForm(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onGuardado(nueva: Cosecha) {
    const cosechasActualizadas = [nueva, ...cosechas.filter(c => c.id !== nueva.id)];
    setCosechas(cosechasActualizadas);
    setShowForm(false);
    setPreloadForm(null);
    setEditando(null);

    // Verificar si el lote tiene cultivo_2 y no tiene cosecha de ese cultivo aún (solo en carga nueva, no edición)
    const eraEdicion = cosechas.some(c => c.id === nueva.id);
    const lote = lotesActuales.find(l => l.id === nueva.lote_id);
    if (!eraEdicion && lote?.cultivo_2) {
      const yaExiste = cosechasActualizadas.some(
        c => c.lote_id === lote.id && c.cultivo === lote.cultivo_2
      );
      if (!yaExiste) {
        setSugerencia2doCultivo({ lote, cultivo2: lote.cultivo_2 });
        return; // No mostrar toast aún, lo mostrará al aceptar/rechazar
      }
    }

    setToast(eraEdicion ? 'Cosecha actualizada ✓' : 'Cosecha guardada ✓');
    setTimeout(() => setToast(null), 2000);
  }

  function aceptarSegundoCultivo() {
    if (!sugerencia2doCultivo) return;
    const { lote, cultivo2 } = sugerencia2doCultivo;
    setSugerencia2doCultivo(null);
    setPreloadForm({ loteId: lote.id, productorId: lote.productor_id, cultivo: cultivo2 });
    setShowForm(true);
    setToast('Cosecha guardada ✓');
    setTimeout(() => setToast(null), 2000);
  }

  function rechazarSegundoCultivo() {
    setSugerencia2doCultivo(null);
    setToast('Cosecha guardada ✓');
    setTimeout(() => setToast(null), 2000);
  }

  async function onEliminar(id: string) {
    if (!confirm('¿Eliminar este registro de cosecha?')) return;
    await (createClient() as any).from('cosechas').delete().eq('id', id);
    setCosechas(prev => prev.filter(c => c.id !== id));
    setToast('Eliminado');
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Cosecha</p>
          <h1 className="text-2xl font-black tracking-tight mt-1" style={{ color: '#0f172a' }}>Rindes de cosecha</h1>
          <p className="text-sm text-mid mt-0.5">Cargá lote por lote. Comparativas automáticas por cultivo y productor.</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(v => !v); setEditando(null); setPreloadForm(null); setSugerencia2doCultivo(null); }}>
          {showForm ? 'Cerrar' : '+ Cargar rinde'}
        </button>
      </div>

      {/* Banner sugerencia segundo cultivo */}
      {sugerencia2doCultivo && (() => {
        const { lote, cultivo2 } = sugerencia2doCultivo;
        const st = cultStyle(cultivo2);
        const prod = productores.find(p => p.id === lote.productor_id);
        return (
          <div
            className="rounded-2xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ background: st.badge, borderColor: st.border }}
          >
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: st.text }}>
                🌱 Segundo cultivo disponible
              </p>
              <p className="font-black text-base" style={{ color: '#0f172a' }}>
                {lote.nombre}
                <span className="ml-2 text-sm font-semibold" style={{ color: '#475569' }}>
                  · {prod?.razon_social}
                </span>
              </p>
              <p className="text-sm mt-1" style={{ color: '#475569' }}>
                El lote fue cosechado. Ahora está libre para el{' '}
                <strong style={{ color: st.text }}>{cultivo2}</strong> de segunda.
                ¿Querés cargar el rinde?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={aceptarSegundoCultivo}
                className="px-4 py-2 rounded-xl text-sm font-black transition-all"
                style={{ background: st.strip, color: '#fff' }}
              >
                Cargar {cultivo2}
              </button>
              <button
                onClick={rechazarSegundoCultivo}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#f1f5f9', color: '#64748b' }}
              >
                Ahora no
              </button>
            </div>
          </div>
        );
      })()}

      {/* Formulario */}
      {showForm && (
        <FormCosecha
          productores={productores}
          lotes={lotesActuales}
          userId={userId}
          onGuardado={onGuardado}
          preload={preloadForm ?? undefined}
          editando={editando ?? undefined}
        />
      )}

      {cosechasActuales.length === 0 && !showForm && (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">🌾</p>
          <p className="font-bold text-hi">Todavía no hay cosechas cargadas esta campaña</p>
          <p className="text-sm text-mid mt-1">Usá "+ Cargar rinde" para sumar la primera.</p>
        </div>
      )}

      {cosechasActuales.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { val: stats.n, label: 'Lotes cosechados', sub: 'con rinde cargado', accent: '#0ea87a' },
              { val: stats.totalHa > 0 ? fmt(stats.totalHa, 0) : '—', label: 'Hectáreas', sub: 'cosechadas', accent: '#0284c7' },
              { val: stats.promKgHa ? fmt(stats.promKgHa, 0) : '—', label: 'Rinde promedio', sub: 'kg/ha general', accent: '#ca8a04' },
              { val: stats.totalTn > 0 ? fmt(stats.totalTn, 1) : '—', label: 'Producción total', sub: 'toneladas', accent: '#475569' },
            ].map(({ val, label, sub, accent }) => (
              <div key={label} className="card p-4 relative overflow-hidden">
                <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: accent }} />
                <p className="text-3xl font-black tabular-nums" style={{ color: accent }}>{val}</p>
                <p className="text-sm font-black mt-1" style={{ color: '#0f172a' }}>{label}</p>
                <p className="text-xs mt-0.5 font-semibold text-mid">{sub}</p>
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

                        {/* Barra de rinde min-max-prom */}
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
                // Ordenar por rinde desc para ranking
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
                    </div>

                    <div className="p-5">
                      {/* Ranking visual */}
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
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: st.strip }}
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => onEliminar(c.id)}
                                className="text-mid hover:text-danger transition-colors text-xs shrink-0"
                                title="Eliminar"
                              >✕</button>
                            </div>
                          );
                        })}
                        {/* Lotes sin rinde */}
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

                      {/* Tabla con todos los datos */}
                      {g.conRinde.some(c => c.humedad_pct || c.proteina_pct || c.peso_hecto) && (
                        <div className="mt-4 rounded-lg border border-slate-100 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th className="text-left px-3 py-2 font-bold uppercase tracking-wider text-mid">Lote</th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Ha</th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Rinde kg/ha</th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Hum %</th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Rinde std</th>
                                {g.conRinde.some(c => c.proteina_pct) && <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Prot %</th>}
                                {g.conRinde.some(c => c.aceite_pct) && <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Aceite %</th>}
                                {g.conRinde.some(c => c.peso_hecto) && <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">PH</th>}
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-mid">Fecha</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...g.conRinde].sort((a, b) => Number(b.rinde_kg_ha) - Number(a.rinde_kg_ha)).map(c => {
                                const std = c.rinde_kg_ha && c.humedad_pct
                                  ? rindeStd(Number(c.rinde_kg_ha), Number(c.humedad_pct), c.cultivo)
                                  : c.rinde_std_kg_ha;
                                return (
                                  <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="px-3 py-2 font-black" style={{ color: '#0f172a' }}>
                                      {c.lote?.nombre}
                                      <span className="font-normal text-mid"> {c.prod?.razon_social}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-mid">{c.lote?.hectareas}</td>
                                    <td className="px-3 py-2 text-right font-black tabular-nums" style={{ color: st.text }}>
                                      {c.rinde_kg_ha ? fmt(Number(c.rinde_kg_ha), 0) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-mid">
                                      {c.humedad_pct ? fmt(Number(c.humedad_pct), 1) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-mid">
                                      {std ? fmt(Number(std), 0) : '—'}
                                    </td>
                                    {g.conRinde.some(x => x.proteina_pct) && (
                                      <td className="px-3 py-2 text-right font-mono text-mid">
                                        {c.proteina_pct ? fmt(Number(c.proteina_pct), 1) : '—'}
                                      </td>
                                    )}
                                    {g.conRinde.some(x => x.aceite_pct) && (
                                      <td className="px-3 py-2 text-right font-mono text-mid">
                                        {c.aceite_pct ? fmt(Number(c.aceite_pct), 1) : '—'}
                                      </td>
                                    )}
                                    {g.conRinde.some(x => x.peso_hecto) && (
                                      <td className="px-3 py-2 text-right font-mono text-mid">
                                        {c.peso_hecto ? fmt(Number(c.peso_hecto), 1) : '—'}
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-right font-mono text-mid whitespace-nowrap">
                                      {c.fecha_cosecha ? fmtFecha(c.fecha_cosecha) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab Todos los lotes */}
          {tab === 'lotes' && (
            <div className="space-y-3">
              {/* Filtros */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={filtroCultivo}
                  onChange={e => setFiltroCultivo(e.target.value)}
                  className="field py-1.5 text-sm min-w-[150px]"
                >
                  <option value="">Todos los cultivos</option>
                  {cultivosConCosecha.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filtroProductor}
                  onChange={e => setFiltroProductor(e.target.value)}
                  className="field py-1.5 text-sm min-w-[200px]"
                >
                  <option value="">Todos los productores</option>
                  {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>

              <div className="card overflow-x-auto">
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
                                onClick={() => onEditar(c)}
                                className="text-mid hover:text-afa transition-colors text-xs"
                                title="Editar"
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
          title={`Prom: ${fmt(prom, 0)} kg/ha`}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-mid mt-0.5">
        <span>min {fmt(min, 0)}</span>
        <span>max {fmt(max, 0)}</span>
      </div>
    </div>
  );
}

// ── Formulario de carga ───────────────────────────────────
const CULTIVOS_LISTA = ['Soja', 'Soja 2°', 'Maíz', 'Trigo', 'Cebada', 'Sorgo', 'Girasol', 'Alfalfa'];

function FormCosecha({
  productores, lotes, userId, onGuardado, preload, editando,
}: {
  productores: Productor[];
  lotes:       Lote[];
  userId:      string;
  onGuardado:  (c: Cosecha) => void;
  preload?:    { loteId: string; productorId: string; cultivo: string };
  editando?:   Cosecha;
}) {
  // Si editando: usar sus datos; si preload: usar preload; si nada: defaults
  const loteEdit = editando ? lotes.find(l => l.id === editando.lote_id) : null;
  const initProductorId = editando
    ? (loteEdit?.productor_id ?? productores[0]?.id ?? '')
    : (preload?.productorId ?? productores[0]?.id ?? '');

  const [productorId, setProductorId] = useState(initProductorId);
  const [loteId,      setLoteId]      = useState(editando?.lote_id ?? preload?.loteId ?? '');
  const [cultivo,     setCultivo]     = useState(editando?.cultivo ?? preload?.cultivo ?? '');
  const str = (v: number | null | undefined) => v != null ? String(v) : '';
  const [fecha,       setFecha]       = useState(editando?.fecha_cosecha ?? new Date().toISOString().slice(0, 10));
  const [rindeKgHa,   setRindeKgHa]   = useState(str(editando?.rinde_kg_ha));
  const [humedad,     setHumedad]     = useState(str(editando?.humedad_pct));
  const [proteina,    setProteina]    = useState(str(editando?.proteina_pct));
  const [aceite,      setAceite]      = useState(str(editando?.aceite_pct));
  const [pesoHecto,   setPesoHecto]   = useState(str(editando?.peso_hecto));
  const [obs,         setObs]         = useState(editando?.observaciones ?? '');
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);

  const lotesDelProd = lotes.filter(l => l.productor_id === productorId);

  // Cuando cambia el lote, pre-completar cultivo
  function onLote(id: string) {
    setLoteId(id);
    const lote = lotes.find(l => l.id === id);
    if (lote?.cultivo && !cultivo) setCultivo(lote.cultivo);
  }

  function onProductor(id: string) {
    setProductorId(id);
    setLoteId('');
    setCultivo('');
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!loteId || !cultivo) { setErr('Seleccioná lote y cultivo.'); return; }
    setSaving(true); setErr(null);
    const num = (s: string) => s.trim() === '' ? null : Number(s.replace(',', '.'));
    const std = rindeKgHa && humedad
      ? rindeStd(Number(rindeKgHa.replace(',', '.')), Number(humedad.replace(',', '.')), cultivo)
      : null;
    const row = {
      lote_id: loteId, ingeniero_id: userId, cultivo,
      fecha_cosecha: fecha || null,
      rinde_kg_ha:      num(rindeKgHa),
      humedad_pct:      num(humedad),
      rinde_std_kg_ha:  std ? Math.round(std) : null,
      proteina_pct:     num(proteina),
      aceite_pct:       num(aceite),
      peso_hecto:       num(pesoHecto),
      observaciones:    obs || null,
    };
    const sb = createClient() as any;
    const { data, error } = editando
      ? await sb.from('cosechas').update(row).eq('id', editando.id).select().single()
      : await sb.from('cosechas').insert(row).select().single();
    setSaving(false);
    if (error) { setErr(`Error: ${error.message}`); return; }
    onGuardado(data);
  }

  const lotePreloaded = preload ? lotes.find(l => l.id === preload.loteId) : null;
  const prodPreloaded = lotePreloaded ? productores.find(p => p.id === lotePreloaded.productor_id) : null;
  const st2 = preload ? cultStyle(preload.cultivo) : editando ? cultStyle(editando.cultivo) : null;
  const stEdit = editando ? cultStyle(editando.cultivo) : null;
  const loteEditDisplay = editando ? lotes.find(l => l.id === editando.lote_id) : null;
  const prodEditDisplay = loteEditDisplay ? productores.find(p => p.id === loteEditDisplay.productor_id) : null;

  return (
    <form onSubmit={guardar} className="card p-5 space-y-4" style={st2 ? { borderLeft: `4px solid ${st2.strip}` } : undefined}>
      {editando && stEdit ? (
        <div className="flex items-center gap-3">
          <span className="text-lg">✏️</span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: stEdit.text }}>
              Editando cosecha · {editando.cultivo}
            </p>
            <p className="font-black text-sm" style={{ color: '#0f172a' }}>
              {loteEditDisplay?.nombre}
              {prodEditDisplay && <span className="font-normal text-mid ml-1">· {prodEditDisplay.razon_social}</span>}
            </p>
          </div>
        </div>
      ) : preload && st2 ? (
        <div className="flex items-center gap-3">
          <span className="text-lg">🌱</span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: st2.text }}>
              Segundo cultivo · {preload.cultivo}
            </p>
            <p className="font-black text-sm" style={{ color: '#0f172a' }}>
              {lotePreloaded?.nombre}
              {prodPreloaded && <span className="font-normal text-mid ml-1">· {prodPreloaded.razon_social}</span>}
            </p>
          </div>
        </div>
      ) : (
        <p className="eyebrow">Cargar rinde de cosecha</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs text-mid">Productor
          {(preload || editando) ? (
            <div className="field bg-base-3 text-mid cursor-default">
              {editando ? (prodEditDisplay?.razon_social ?? '—') : (prodPreloaded?.razon_social ?? '—')}
            </div>
          ) : (
            <select className="field" value={productorId} onChange={e => onProductor(e.target.value)}>
              {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          )}
        </label>
        <label className="grid gap-1 text-xs text-mid">Lote
          {(preload || editando) ? (
            <div className="field bg-base-3 text-mid cursor-default">
              {editando ? `${loteEditDisplay?.nombre} · ${loteEditDisplay?.hectareas} ha` : `${lotePreloaded?.nombre} · ${lotePreloaded?.hectareas} ha`}
            </div>
          ) : (
            <select className="field" value={loteId} onChange={e => onLote(e.target.value)}>
              <option value="">Seleccionar lote…</option>
              {lotesDelProd.map(l => <option key={l.id} value={l.id}>{l.nombre} · {l.hectareas} ha</option>)}
            </select>
          )}
        </label>
        <label className="grid gap-1 text-xs text-mid">Cultivo cosechado
          {(preload || editando) ? (
            <div className="field font-bold cursor-default" style={{ background: st2!.badge, color: st2!.text, border: `1px solid ${st2!.border}` }}>
              {editando ? editando.cultivo : preload!.cultivo}
            </div>
          ) : (
            <select className="field" value={cultivo} onChange={e => setCultivo(e.target.value)}>
              <option value="">Seleccionar…</option>
              {CULTIVOS_LISTA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </label>
        <label className="grid gap-1 text-xs text-mid">Fecha de cosecha
          <input type="date" className="field" value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="grid gap-1 text-xs text-mid">Rinde kg/ha *
          <input inputMode="decimal" className="field" placeholder="ej. 3200" value={rindeKgHa} onChange={e => setRindeKgHa(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-mid">Humedad %
          <input inputMode="decimal" className="field" placeholder="ej. 14.5" value={humedad} onChange={e => setHumedad(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-mid">
          Rinde std {rindeKgHa && humedad ? `(${fmt(rindeStd(Number(rindeKgHa.replace(',','.')), Number(humedad.replace(',','.')), cultivo || 'Soja'), 0)} kg/ha)` : ''}
          <input readOnly className="field bg-base-3 cursor-default text-mid"
            value={rindeKgHa && humedad ? fmt(rindeStd(Number(rindeKgHa.replace(',','.')), Number(humedad.replace(',','.')), cultivo || 'Soja'), 0) : ''}
            placeholder="auto" />
        </label>
        <label className="grid gap-1 text-xs text-mid">Proteína %
          <input inputMode="decimal" className="field" placeholder="ej. 42" value={proteina} onChange={e => setProteina(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-mid">Aceite %
          <input inputMode="decimal" className="field" placeholder="ej. 20" value={aceite} onChange={e => setAceite(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-mid">Peso hectol.
          <input inputMode="decimal" className="field" placeholder="ej. 78" value={pesoHecto} onChange={e => setPesoHecto(e.target.value)} />
        </label>
      </div>

      <label className="grid gap-1 text-xs text-mid">Observaciones
        <input className="field" placeholder="opcional" value={obs} onChange={e => setObs(e.target.value)} />
      </label>

      {err && <p className="text-danger text-sm">{err}</p>}
      <div className="flex gap-3">
        <button type="submit" className="btn-afa" disabled={saving || !loteId || !cultivo}>
          {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar cosecha'}
        </button>
      </div>
    </form>
  );
}
