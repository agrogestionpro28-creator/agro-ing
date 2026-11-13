'use client';

import { useMemo } from 'react';
import { cn, fmtFecha } from '@/lib/utils';
import {
  PARAMS, interpretar, limitantes,
  type AnalisisSuelo, type Estado, type ParamKey,
} from '@/lib/suelo';

type Productor = { id: string; razon_social: string };
type Lote      = { id: string; nombre: string; hectareas: number; cultivo: string | null; productor_id: string };
type Fila      = { lote: Lote; a: AnalisisSuelo; productor: Productor };

// ── Colores por cultivo ──────────────────────────────────
const CULTIVO_COLOR: Record<string, { border: string; badge: string; text: string; strip: string }> = {
  'Soja':     { border: '#16a34a', badge: '#f0fdf4', text: '#15803d', strip: '#22c55e' },
  'Soja 2°':  { border: '#059669', badge: '#ecfdf5', text: '#047857', strip: '#34d399' },
  'Maíz':     { border: '#ca8a04', badge: '#fefce8', text: '#a16207', strip: '#facc15' },
  'Trigo':    { border: '#d97706', badge: '#fffbeb', text: '#b45309', strip: '#f59e0b' },
  'Cebada':   { border: '#b45309', badge: '#fef3c7', text: '#92400e', strip: '#fbbf24' },
  'Sorgo':    { border: '#ea580c', badge: '#fff7ed', text: '#c2410c', strip: '#f97316' },
  'Girasol':  { border: '#0284c7', badge: '#f0f9ff', text: '#0369a1', strip: '#38bdf8' },
  'Alfalfa':  { border: '#0d9488', badge: '#f0fdfa', text: '#0f766e', strip: '#14b8a6' },
};
const DEFAULT_COLOR = { border: '#d0dae6', badge: '#f8fafc', text: '#64748b', strip: '#94a3b8' };

function cultColor(c: string) {
  // coincidencia parcial (por si hay "Soja" y viene "Soja 2°")
  for (const [k, v] of Object.entries(CULTIVO_COLOR)) {
    if (c.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(c.toLowerCase())) return v;
  }
  return DEFAULT_COLOR;
}

// ── Helpers de estado ─────────────────────────────────────
const ESTADO_DOT: Record<Estado, string> = {
  crit: 'bg-danger', serious: 'bg-orange-400', warn: 'bg-yellow-400', good: 'bg-afa',
};
const ESTADO_CHIP: Record<Estado, { bg: string; text: string }> = {
  crit:    { bg: '#fee2e2', text: '#dc2626' },
  serious: { bg: '#ffedd5', text: '#ea580c' },
  warn:    { bg: '#fef9c3', text: '#a16207' },
  good:    { bg: '#d1fae5', text: '#059669' },
};

function fmt(n: number, dec = 1) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Parámetros clave a mostrar en el resumen
const PARAMS_CLAVE: ParamKey[] = ['p_bray', 's_so4', 'n_nitratos', 'mo', 'ph', 'zn'];
const PARAM_LABEL: Partial<Record<ParamKey, string>> = {
  p_bray: 'P Bray', s_so4: 'S-SO₄', n_nitratos: 'N-NO₃', mo: 'MO', ph: 'pH', zn: 'Zn',
};
const PARAM_UNIT: Partial<Record<ParamKey, string>> = {
  p_bray: 'ppm', s_so4: 'ppm', n_nitratos: 'ppm', mo: '%', ph: '', zn: 'ppm',
};

// ── Componente principal ──────────────────────────────────
export function AnalisisCultivoClient({
  productores,
  lotes,
  analisis,
}: {
  productores: Productor[];
  lotes:       Lote[];
  analisis:    AnalisisSuelo[];
}) {
  // Último análisis por lote (igual que el cliente de productor)
  const filas: Fila[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Fila[] = [];
    for (const a of analisis) {
      if (seen.has(a.lote_id)) continue;
      const lote = lotes.find(l => l.id === a.lote_id);
      if (!lote) continue;
      const productor = productores.find(p => p.id === lote.productor_id);
      if (!productor) continue;
      seen.add(a.lote_id);
      out.push({ lote, a, productor });
    }
    return out;
  }, [analisis, lotes, productores]);

  // Agrupar por cultivo (usar cultivo del lote o del análisis)
  const porCultivo = useMemo(() => {
    const grupos: Record<string, Fila[]> = {};
    for (const f of filas) {
      const cult = f.lote.cultivo ?? f.a.cultivo ?? 'Sin definir';
      if (!grupos[cult]) grupos[cult] = [];
      grupos[cult].push(f);
    }
    // Ordenar grupos por cantidad de lotes desc
    return Object.entries(grupos).sort((a, b) => b[1].length - a[1].length);
  }, [filas]);

  if (filas.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-4xl mb-3">🌱</p>
        <p className="font-bold text-hi">No hay análisis cargados en esta campaña</p>
        <p className="text-sm text-mid mt-1">Cargá análisis desde la pestaña "Por productor".</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen global */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-afa" />
          <p className="text-3xl font-black tabular-nums text-afa">{filas.length}</p>
          <p className="text-sm font-black mt-1" style={{ color: '#0f172a' }}>Lotes con análisis</p>
          <p className="text-xs mt-0.5 font-semibold text-mid">en la campaña</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-sky-500" />
          <p className="text-3xl font-black tabular-nums text-sky-600">{porCultivo.length}</p>
          <p className="text-sm font-black mt-1" style={{ color: '#0f172a' }}>Cultivos distintos</p>
          <p className="text-xs mt-0.5 font-semibold text-mid">en campaña actual</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-orange-400" />
          <p className="text-3xl font-black tabular-nums text-orange-500">
            {filas.filter(f => limitantes(f.a).some(l => l.int?.estado === 'crit' || l.int?.estado === 'serious')).length}
          </p>
          <p className="text-sm font-black mt-1" style={{ color: '#0f172a' }}>Lotes con limitantes</p>
          <p className="text-xs mt-0.5 font-semibold text-mid">críticos o serios</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: '#94a3b8' }} />
          <p className="text-3xl font-black tabular-nums" style={{ color: '#0f172a' }}>
            {fmt(filas.reduce((s, f) => s + Number(f.lote.hectareas || 0), 0), 0)}
          </p>
          <p className="text-sm font-black mt-1" style={{ color: '#0f172a' }}>Hectáreas</p>
          <p className="text-xs mt-0.5 font-semibold text-mid">con análisis cargado</p>
        </div>
      </div>

      {/* Un bloque por cultivo */}
      {porCultivo.map(([cultivo, fs]) => (
        <BloquecultiVo key={cultivo} cultivo={cultivo} filas={fs} />
      ))}
    </div>
  );
}

// ── Bloque por cultivo ────────────────────────────────────
function BloquecultiVo({ cultivo, filas }: { cultivo: string; filas: Fila[] }) {
  const col = cultColor(cultivo);
  const totalHa = filas.reduce((s, f) => s + Number(f.lote.hectareas || 0), 0);

  // Promedios por parámetro
  const promedios = useMemo(() => {
    const out: Partial<Record<ParamKey, { prom: number; n: number; min: number; max: number }>> = {};
    for (const k of PARAMS_CLAVE) {
      const vals = filas.map(f => f.a[k] as number | null).filter(v => v != null) as number[];
      if (vals.length === 0) continue;
      const prom = vals.reduce((s, v) => s + v, 0) / vals.length;
      out[k] = { prom, n: vals.length, min: Math.min(...vals), max: Math.max(...vals) };
    }
    return out;
  }, [filas]);

  // Limitante más frecuente
  const limFrec = useMemo(() => {
    const conteo: Record<string, number> = {};
    for (const f of filas) {
      for (const l of limitantes(f.a)) {
        if (l.int?.estado !== 'good') conteo[l.key] = (conteo[l.key] ?? 0) + 1;
      }
    }
    return Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [filas]);

  // % lotes sin limitantes críticos/serios
  const lotesSanos = filas.filter(f => !limitantes(f.a).some(l => l.int?.estado === 'crit' || l.int?.estado === 'serious')).length;
  const pctSanos = Math.round((lotesSanos / filas.length) * 100);

  return (
    <div className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: col.border }}>
      {/* Header del cultivo */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5" style={{ background: col.badge, borderBottom: `1px solid ${col.border}20` }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: col.strip }} />
          <h2 className="text-lg font-black" style={{ color: col.text }}>{cultivo}</h2>
          <span className="text-sm font-semibold" style={{ color: col.text, opacity: 0.7 }}>
            {filas.length} {filas.length === 1 ? 'lote' : 'lotes'} · {fmt(totalHa, 0)} ha
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="text-xs font-black px-3 py-1 rounded-full"
            style={{ background: pctSanos >= 70 ? '#d1fae5' : pctSanos >= 40 ? '#fef9c3' : '#fee2e2', color: pctSanos >= 70 ? '#059669' : pctSanos >= 40 ? '#a16207' : '#dc2626' }}
          >
            {pctSanos}% lotes sin limitantes críticos
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Promedios de nutrientes clave */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-mid mb-3">Promedios del conjunto</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {PARAMS_CLAVE.map(k => {
              const d = promedios[k];
              if (!d) return null;
              const interp = interpretar(k, d.prom);
              return (
                <div key={k} className="text-center">
                  <p className="text-[10px] font-bold text-mid uppercase tracking-wider mb-1">
                    {PARAM_LABEL[k]}
                    {PARAM_UNIT[k] ? <span className="normal-case font-normal"> {PARAM_UNIT[k]}</span> : ''}
                  </p>
                  <div
                    className="rounded-lg py-2 px-1"
                    style={interp
                      ? { background: ESTADO_CHIP[interp.estado].bg }
                      : { background: '#f1f5f9' }
                    }
                  >
                    <p
                      className="text-xl font-black tabular-nums leading-none"
                      style={{ color: interp ? ESTADO_CHIP[interp.estado].text : '#475569' }}
                    >
                      {fmt(d.prom, k === 'ph' ? 1 : k === 'mo' ? 2 : 1)}
                    </p>
                    {interp && (
                      <p className="text-[9px] font-bold mt-0.5" style={{ color: interp ? ESTADO_CHIP[interp.estado].text : '#94a3b8' }}>
                        {interp.nivel}
                      </p>
                    )}
                  </div>
                  <p className="text-[9px] text-mid mt-1 font-mono">
                    {fmt(d.min, 1)}–{fmt(d.max, 1)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Limitantes más frecuentes */}
        {limFrec.length > 0 && (
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-mid mb-2">Limitantes más frecuentes</p>
            <div className="flex flex-wrap gap-2">
              {limFrec.map(([key, count]) => {
                // buscar cuál es el estado promedio para ese parámetro
                const vals = filas.map(f => f.a[key as ParamKey] as number | null).filter(v => v != null) as number[];
                const prom = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                const interp = prom != null ? interpretar(key as ParamKey, prom) : null;
                const chip = interp ? ESTADO_CHIP[interp.estado] : ESTADO_CHIP.warn;
                const param = PARAMS.find(p => p.key === key);
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: chip.bg, color: chip.text }}>
                    <span>{param?.corto ?? key}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black" style={{ background: chip.text, color: '#fff' }}>
                      {count}/{filas.length} lotes
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla de lotes */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-mid mb-2">Lote por lote</p>
          <div className="rounded-lg border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mid whitespace-nowrap">Productor</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mid">Lote</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mid">Ha</th>
                  {PARAMS_CLAVE.map(k => (
                    <th key={k} className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mid whitespace-nowrap">
                      {PARAM_LABEL[k]}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mid">Limitantes</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mid whitespace-nowrap">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filas.sort((a, b) => a.lote.nombre.localeCompare(b.lote.nombre)).map(({ lote, a, productor }) => {
                  const lims = limitantes(a);
                  return (
                    <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-xs font-semibold text-mid whitespace-nowrap max-w-[120px] truncate">{productor.razon_social}</td>
                      <td className="px-3 py-2 font-black text-xs" style={{ color: '#0f172a' }}>{lote.nombre}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-mid">{lote.hectareas}</td>
                      {PARAMS_CLAVE.map(k => {
                        const v = a[k] as number | null;
                        const interp = interpretar(k, v);
                        return (
                          <td key={k} className="px-3 py-2 text-right">
                            {v != null ? (
                              <span
                                className="inline-block font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                                style={interp
                                  ? { background: ESTADO_CHIP[interp.estado].bg, color: ESTADO_CHIP[interp.estado].text }
                                  : { color: '#475569' }
                                }
                              >
                                {fmt(v, k === 'ph' ? 1 : k === 'mo' ? 2 : 1)}
                              </span>
                            ) : (
                              <span className="text-mid text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {lims.length === 0
                            ? <span className="text-[10px] text-afa font-bold">✓ OK</span>
                            : lims.slice(0, 3).map(l => (
                              <span
                                key={l.key}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: ESTADO_CHIP[l.int!.estado].bg, color: ESTADO_CHIP[l.int!.estado].text }}
                              >
                                {PARAMS.find(p => p.key === l.key)?.corto}
                              </span>
                            ))
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-mid whitespace-nowrap">
                        {a.fecha_informe ? fmtFecha(a.fecha_informe) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
