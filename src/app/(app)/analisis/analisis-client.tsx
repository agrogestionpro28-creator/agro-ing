'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCampana } from '@/components/layout/app-shell';
import { cn, fmtFecha } from '@/lib/utils';
import {
  PARAMS, UMBRAL, interpretar, limitantes, recomendar, cultivoCalc, fmt, fmtValor,
  type AnalisisSuelo, type Estado, type ParamKey, type Recomendacion, type FertAplicado,
} from '@/lib/suelo';

type Productor = { id: string; razon_social: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null } | null;
type Lote = { id: string; nombre: string; hectareas: number; cultivo: string | null; fecha_siembra: string | null };
type Fila = { lote: Lote; a: AnalisisSuelo };

const ESTADO_DOT: Record<Estado, string> = {
  crit: 'bg-danger', serious: 'bg-orange-400', warn: 'bg-ochre', good: 'bg-afa',
};
const ESTADO_CHIP: Record<Estado, string> = {
  crit: 'bg-red-900/30 text-red-300', serious: 'bg-orange-900/30 text-orange-300',
  warn: 'bg-ochre-tint text-ochre-light', good: 'bg-afa-tint text-afa-light',
};

export function AnalisisClient({ productores, ingeniero, userId }: { productores: Productor[]; ingeniero: Ingeniero; userId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { campanaId, campana } = useCampana();
  const productorId = sp.get('productor') ?? productores[0]?.id ?? '';
  const productor = productores.find(p => p.id === productorId);

  const [lotes, setLotes] = useState<Lote[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisSuelo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rindeMaiz, setRindeMaiz] = useState(9);
  const [rindeSoja, setRindeSoja] = useState(3.5);
  const [nMedido, setNMedido] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!productorId || !campanaId) return;
    let cancel = false;
    (async () => {
      setLoading(true); setError(null);
      const sb = createClient() as any;
      const { data: ls, error: e1 } = await sb.from('lotes')
        .select('id, nombre, hectareas, cultivo, fecha_siembra')
        .eq('productor_id', productorId).eq('campana_id', campanaId).order('nombre');
      if (e1) { if (!cancel) { setError(e1.message); setLoading(false); } return; }
      const ids = (ls ?? []).map((l: Lote) => l.id);
      let an: AnalisisSuelo[] = [];
      if (ids.length) {
        const { data, error: e2 } = await sb.from('analisis_suelo').select('*')
          .in('lote_id', ids).order('fecha_informe', { ascending: false });
        if (e2) { if (!cancel) { setError(e2.message); setLoading(false); } return; }
        an = data ?? [];
      }
      if (!cancel) { setLotes(ls ?? []); setAnalisis(an); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [productorId, campanaId, reload]);

  // Último análisis por lote
  const filas: Fila[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Fila[] = [];
    for (const a of analisis) {
      if (seen.has(a.lote_id)) continue;
      const lote = lotes.find(l => l.id === a.lote_id);
      if (!lote) continue;
      seen.add(a.lote_id);
      out.push({ lote, a });
    }
    return out.sort((x, y) => x.lote.nombre.localeCompare(y.lote.nombre));
  }, [analisis, lotes]);

  const recs = useMemo(() => filas.map(f => ({
    ...f,
    rec: recomendar(f.a, f.lote.cultivo, {
      rindeMaiz, rindeSoja,
      nSuelo060: nMedido[f.a.id] ? Number(nMedido[f.a.id]) : null,
    }),
  })), [filas, rindeMaiz, rindeSoja, nMedido]);

  const pedido = useMemo(() => {
    const t: Record<string, number> = {};
    for (const { lote, rec } of recs) for (const p of rec?.productos ?? []) {
      if (!p.kg_ha || p.producto.includes('foliar')) continue;
      t[p.producto] = (t[p.producto] ?? 0) + p.kg_ha * lote.hectareas;
    }
    return t;
  }, [recs]);

  const firma = ingeniero ? `Ing. Agr. ${ingeniero.nombre}${ingeniero.apellido ? ' ' + ingeniero.apellido : ''}${ingeniero.matricula ? ' · M.P. ' + ingeniero.matricula : ''}` : '';

  function setProductor(id: string) {
    const params = new URLSearchParams(sp.toString());
    params.set('productor', id);
    router.push(`?${params.toString()}`);
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setToast('Copiado'); }
    catch { setToast('No se pudo copiar'); }
    setTimeout(() => setToast(null), 1800);
  }

  function textoLote(lote: Lote, rec: Recomendacion) {
    let t = `${productor?.razon_social ?? ''} · Lote ${lote.nombre} (${fmt(lote.hectareas, 0)} ha) · ${rec.cultivo === 'maiz' ? `Maíz ${fmt(rindeMaiz)} t/ha` : `Soja ${fmt(rindeSoja)} t/ha`}\n`;
    t += rec.modo === 'complemento' ? 'Fertilización complementaria:\n' : 'Fertilización a la siembra:\n';
    for (const p of rec.productos) t += `- ${p.producto}${p.kg_ha ? `: ${fmt(p.kg_ha, p.kg_ha < 5 ? 1 : 0)} kg/ha` : ''} (${p.momento})${p.kg_ha >= 5 ? ` → ${fmt(p.kg_ha * lote.hectareas / 1000, 1)} t` : ''}\n`;
    for (const n of rec.notas) t += `· ${n}\n`;
    return t + firma;
  }

  return (
    <div className="space-y-8">
      {/* Encabezado + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Análisis de suelo · Campaña {campana?.nombre ?? ''}</p>
          <h1 className="text-2xl font-black text-hi mt-1">{productor?.razon_social ?? 'Sin productores'}</h1>
          <p className="text-mid text-sm mt-1">Comparación entre los lotes del productor. Último análisis de cada lote.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wider text-lo">Productor</span>
            <select value={productorId} onChange={e => setProductor(e.target.value)} className="field min-w-[220px]">
              {productores.map(p => <option key={p.id} value={p.id} style={{ background: '#111' }}>{p.razon_social}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wider text-lo">Rinde maíz (t/ha)</span>
            <input type="number" step="0.5" min="4" max="16" value={rindeMaiz} onChange={e => setRindeMaiz(Number(e.target.value) || 9)} className="field w-28" />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wider text-lo">Rinde soja (t/ha)</span>
            <input type="number" step="0.1" min="1.5" max="6" value={rindeSoja} onChange={e => setRindeSoja(Number(e.target.value) || 3.5)} className="field w-28" />
          </label>
          <button className="btn-primary" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cerrar' : '+ Cargar análisis'}</button>
        </div>
      </div>

      {showForm && (
        <NuevoAnalisis lotes={lotes} userId={userId} onSaved={() => { setShowForm(false); setReload(r => r + 1); setToast('Análisis guardado'); setTimeout(() => setToast(null), 1800); }} />
      )}

      {error && <div className="card p-4 text-danger text-sm">No se pudieron leer los análisis: {error}</div>}
      {loading && <p className="text-mid text-sm">Cargando…</p>}

      {!loading && !error && filas.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-hi font-semibold">Este productor no tiene análisis de suelo en la campaña {campana?.nombre}.</p>
          <p className="text-mid text-sm mt-1">Usá “Cargar análisis” para sumar el primero.</p>
        </div>
      )}

      {filas.length > 0 && (
        <>
          {/* Limitantes */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-hi">Limitantes por lote</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filas.map(({ lote, a }) => {
                const lim = limitantes(a);
                return (
                  <div key={a.id} className="card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-hi uppercase truncate">{lote.nombre}</p>
                        <p className="text-[11px] text-lo">{lote.cultivo ?? a.cultivo ?? 'Sin cultivo'}{a.estado_cultivo ? ` · ${a.estado_cultivo}` : ''}</p>
                      </div>
                      <span className="text-ochre font-black text-lg leading-none whitespace-nowrap">{fmt(lote.hectareas, 0)}<span className="text-xs text-mid font-semibold"> ha</span></span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lim.length === 0 && <span className="text-xs text-afa">Sin limitantes</span>}
                      {lim.map(x => (
                        <span key={x.key} className={cn('inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full', ESTADO_CHIP[x.int!.estado])}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', ESTADO_DOT[x.int!.estado])} />
                          {PARAMSHORT[x.key]} {fmtValor(x.valor)} · {x.int!.nivel}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-lo font-mono">{a.laboratorio ?? 'Lab.'} · {fmtFecha(a.fecha_informe)}{a.momento === 'post_fertilizacion' ? ' · post-fertilización' : ''}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Gráficos vs umbral */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-hi">Nutrientes frente al umbral del cultivo</h2>
              <div className="flex flex-wrap gap-4 text-[11px] text-mid">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-afa" />Sobre umbral</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-danger" />Bajo umbral ▼</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3 bg-hi" />Umbral</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(['p_bray', 's_so4', 'n_nitratos', 'zn'] as const).map(k => <BarrasUmbral key={k} k={k} filas={filas} />)}
            </div>
            {filas.some(f => f.a.momento === 'post_fertilizacion') && (
              <p className="text-[11px] text-lo">Hay muestras tomadas después de fertilizar: el N-nitratos de esos lotes no refleja el N disponible.</p>
            )}
          </section>

          {/* Semáforo completo */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-hi">Semáforo completo</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-lo">
                    <th className="text-left px-4 py-2.5 font-semibold">Determinación</th>
                    {filas.map(f => <th key={f.a.id} className="text-center px-4 py-3 whitespace-nowrap text-ochre font-black text-sm tracking-wide">{f.lote.nombre}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PARAMS.map((p, i) => (
                    <FilaParam key={p.key} p={p} filas={filas} grupoNuevo={i === 0 || PARAMS[i - 1].grupo !== p.grupo} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recomendaciones */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-hi">Recomendaciones</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {recs.map(({ lote, a, rec }) => (
                <div key={a.id} className="card p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-hi uppercase">{lote.nombre} <span className="text-mid font-semibold normal-case text-sm">· {fmt(lote.hectareas, 0)} ha</span></p>
                      <p className="text-[11px] text-lo">
                        {rec ? (rec.cultivo === 'maiz' ? 'Maíz' : 'Soja') : 'Cultivo sin modelo'}
                        {rec ? (rec.modo === 'complemento' ? ' · complemento de lo aplicado' : ' · fertilización de siembra') : ''}
                      </p>
                    </div>
                    {rec && <button className="btn-ghost text-xs py-1 px-3" onClick={() => copiar(textoLote(lote, rec))}>Copiar para WhatsApp</button>}
                  </div>

                  {!rec && <p className="text-sm text-mid">Por ahora el cálculo cubre maíz y soja. Cargá el cultivo del lote para recomendar.</p>}

                  {rec && (
                    <>
                      {rec.aplicado.n + rec.aplicado.p + rec.aplicado.s > 0 && (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {(['n', 'p', 's', 'zn'] as const).map(k => (
                            <div key={k} className="bg-base-4 rounded p-2">
                              <p className="text-[9px] uppercase tracking-wider text-lo">{k.toUpperCase()} aplicado</p>
                              <p className="text-hi font-bold">{fmt(rec.aplicado[k], k === 'zn' ? 1 : 0)}<span className="text-[10px] text-mid"> kg</span></p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="divide-y divide-base-5">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[10px] uppercase tracking-wider text-lo pb-1.5">
                          <span>Producto · momento</span><span className="text-right">kg/ha</span><span className="text-right w-16">Total</span>
                        </div>
                        {rec.productos.length === 0 && <p className="text-sm text-afa py-2">No hace falta aplicar más.</p>}
                        {rec.productos.map(p => (
                          <div key={p.producto} className="grid grid-cols-[1fr_auto_auto] gap-3 py-1.5 text-sm items-baseline">
                            <span className="min-w-0"><span className="text-hi">{p.producto}</span> <span className="text-lo text-xs">· {p.momento}</span></span>
                            <span className="text-right font-mono text-hi">{p.kg_ha ? fmt(p.kg_ha, p.kg_ha < 5 ? 1 : 0) : '—'}</span>
                            <span className="text-right font-mono text-mid w-16">{p.kg_ha >= 5 ? `${fmt(p.kg_ha * lote.hectareas / 1000, 1)} t` : ''}</span>
                          </div>
                        ))}
                      </div>

                      {rec.cultivo === 'maiz' && (
                        <label className="flex items-center gap-2 text-xs text-mid">
                          N 0–60 cm medido (kg/ha)
                          <input type="number" min="0" className="field w-24 py-1" placeholder="sin dato"
                            value={nMedido[a.id] ?? ''} onChange={e => setNMedido(m => ({ ...m, [a.id]: e.target.value }))} />
                        </label>
                      )}
                      {rec.notas.map(n => <p key={n} className="text-[11px] text-mid">· {n}</p>)}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Pedido */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-hi">Pedido de insumos del productor</h2>
            <div className="card p-4 space-y-3">
              {Object.keys(pedido).length === 0 ? <p className="text-sm text-mid">Sin insumos a pedir.</p> : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(pedido).map(([prod, kg]) => (
                    <div key={prod} className="border-l-2 border-ochre pl-3">
                      <p className="text-xs text-mid">{prod}</p>
                      <p className="text-xl font-black text-hi">{fmt(kg / 1000, 1)} t</p>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-ghost text-xs py-1 px-3" onClick={() => {
                let t = `Pedido de insumos · ${productor?.razon_social} · Campaña ${campana?.nombre}\n`;
                for (const [prod, kg] of Object.entries(pedido)) t += `- ${prod}: ${fmt(kg / 1000, 1)} t\n`;
                copiar(t + firma);
              }}>Copiar pedido</button>
            </div>
          </section>

          <p className="text-[11px] text-lo max-w-4xl">
            Criterios: P Bray umbral 18 ppm maíz / 13 ppm soja; S-SO₄ umbral 10 ppm; N maíz 16 kg N por t de rinde menos N del suelo y lo aplicado; Zn maíz con menos de 1 ppm.
            Cuando la muestra es post-fertilización se descuenta lo aplicado y se recomienda solo el complemento. Dosis orientativas: ajustar con historia del lote.
          </p>
        </>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-hi text-base text-sm px-4 py-2 rounded shadow-xl z-50">{toast}</div>}
    </div>
  );
}

const PARAMSHORT: Record<ParamKey, string> = Object.fromEntries(PARAMS.map(p => [p.key, p.corto])) as Record<ParamKey, string>;

function FilaParam({ p, filas, grupoNuevo }: { p: (typeof PARAMS)[number]; filas: Fila[]; grupoNuevo: boolean }) {
  return (
    <>
      {grupoNuevo && (
        <tr><td colSpan={filas.length + 1} className="bg-base-4 px-4 py-1.5 text-[10px] uppercase tracking-wider text-lo font-semibold">{p.grupo}</td></tr>
      )}
      <tr className="border-t border-base-5">
        <td className="px-4 py-2 whitespace-nowrap"><span className="text-hi">{p.nombre}</span> <span className="text-[11px] text-lo">{p.unidad}</span></td>
        {filas.map(({ a }) => {
          const v = a[p.key] as number | null;
          const it = interpretar(p.key, v);
          return (
            <td key={a.id} className="px-4 py-2 whitespace-nowrap text-center">
              <span className="inline-flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', it ? ESTADO_DOT[it.estado] : 'bg-transparent')} />
                <span className="font-mono text-hi w-12">{fmtValor(v)}</span>
                <span className="text-xs text-mid w-20 text-left">{it?.nivel ?? (v == null ? '' : 'sin rango')}</span>
              </span>
            </td>
          );
        })}
      </tr>
    </>
  );
}

const TITULOS: Record<'p_bray' | 's_so4' | 'n_nitratos' | 'zn', string> = {
  p_bray: 'Fósforo Bray I', s_so4: 'Azufre (S-SO₄)', n_nitratos: 'N-nitratos 0–20 cm', zn: 'Zinc',
};

function BarrasUmbral({ k, filas }: { k: 'p_bray' | 's_so4' | 'n_nitratos' | 'zn'; filas: Fila[] }) {
  const W = 300, lw = 92, rh = 30, top = 6;
  const datos = filas.map(f => {
    const c = cultivoCalc(f.a.cultivo ?? f.lote.cultivo) ?? 'maiz';
    return { nombre: f.lote.nombre, v: (f.a[k] as number | null) ?? 0, th: UMBRAL[k][c] };
  });
  const H = top + datos.length * rh + 22;
  const mx = Math.max(...datos.map(d => Math.max(d.v, d.th))) * 1.18 || 1;
  const nice = mx <= 2 ? Math.ceil(mx * 2) / 2 : mx <= 10 ? Math.ceil(mx / 2) * 2 : Math.ceil(mx / 5) * 5;
  const sx = (v: number) => lw + (v / nice) * (W - lw - 40);
  const ticks = [0, nice / 2, nice];
  return (
    <div className="card p-4 min-w-0">
      <p className="text-sm font-semibold text-hi">{TITULOS[k]}</p>
      <p className="text-[11px] text-lo mb-1">ppm</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${TITULOS[k]} por lote frente al umbral`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 2} y2={H - 20} stroke="#262626" />
            <text x={sx(t)} y={H - 6} textAnchor="middle" fontSize="10" fill="#737373" fontFamily="ui-monospace,monospace">{fmtValor(+t.toFixed(2))}</text>
          </g>
        ))}
        <line x1={lw} x2={lw} y1={top - 2} y2={H - 20} stroke="#404040" />
        {datos.map((d, i) => {
          const y = top + i * rh + 7, low = d.v < d.th, w = Math.max(2, sx(d.v) - lw);
          return (
            <g key={d.nombre}>
              <title>{`${d.nombre}: ${fmtValor(d.v)} ppm · umbral ${fmtValor(d.th)}${low ? ` · ${fmt(d.th - d.v)} por debajo` : ''}`}</title>
              <text x={lw - 8} y={y + 11} textAnchor="end" fontSize="11" fill="#a3a3a3">{d.nombre.length > 13 ? d.nombre.slice(0, 12) + '…' : d.nombre}</text>
              <rect x={lw} y={y} width={w} height={14} rx={3} fill={low ? '#ef4444' : '#2EAA6E'} />
              <text x={lw + w + 5} y={y + 11} fontSize="11" fill="#f5f5f5" fontFamily="ui-monospace,monospace">{fmtValor(d.v)}{low ? ' ▼' : ''}</text>
              <line x1={sx(d.th)} x2={sx(d.th)} y1={y - 4} y2={y + 18} stroke="#f5f5f5" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Formulario de carga ───────────────────────────────────
const CAMPOS: { key: ParamKey; label: string }[] = PARAMS.map(p => ({ key: p.key, label: `${p.corto}${p.unidad ? ` (${p.unidad})` : ''}` }));

function NuevoAnalisis({ lotes, userId, onSaved }: { lotes: Lote[]; userId: string; onSaved: () => void }) {
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const [lab, setLab] = useState('Molisol');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [momento, setMomento] = useState<'presiembra' | 'post_fertilizacion' | 'otro'>('presiembra');
  const [estadoCultivo, setEstadoCultivo] = useState('');
  const [vals, setVals] = useState<Partial<Record<ParamKey, string>>>({});
  const [fert, setFert] = useState<{ producto: string; kg: string }[]>([{ producto: '', kg: '' }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!loteId && lotes[0]) setLoteId(lotes[0].id); }, [lotes, loteId]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!loteId) { setErr('Elegí un lote.'); return; }
    setSaving(true); setErr(null);
    const num = (s?: string) => (s == null || s.trim() === '' ? null : Number(s.replace(',', '.')));
    const fertAplicado: FertAplicado[] = fert
      .filter(f => f.producto.trim() && num(f.kg))
      .map(f => ({ producto: f.producto.trim(), kg_ha: num(f.kg)! }));
    const lote = lotes.find(l => l.id === loteId);
    const row: Record<string, unknown> = {
      lote_id: loteId, ingeniero_id: userId, laboratorio: lab || null, fecha_informe: fecha,
      momento, cultivo: lote?.cultivo ?? null, estado_cultivo: estadoCultivo || null,
      fert_aplicado: fertAplicado.length ? fertAplicado : null,
    };
    for (const c of CAMPOS) row[c.key] = num(vals[c.key]);
    const { error } = await (createClient() as any).from('analisis_suelo').insert(row);
    setSaving(false);
    if (error) { setErr(`No se pudo guardar: ${error.message}`); return; }
    onSaved();
  }

  return (
    <form onSubmit={guardar} className="card p-5 space-y-4">
      <p className="eyebrow">Nuevo análisis de suelo</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-1 text-xs text-mid">Lote
          <select className="field" value={loteId} onChange={e => setLoteId(e.target.value)}>
            {lotes.map(l => <option key={l.id} value={l.id} style={{ background: '#111' }}>{l.nombre} · {fmt(l.hectareas, 0)} ha</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-mid">Laboratorio<input className="field" value={lab} onChange={e => setLab(e.target.value)} /></label>
        <label className="grid gap-1 text-xs text-mid">Fecha del informe<input type="date" className="field" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        <label className="grid gap-1 text-xs text-mid">Momento del muestreo
          <select className="field" value={momento} onChange={e => setMomento(e.target.value as typeof momento)}>
            <option value="presiembra" style={{ background: '#111' }}>Presiembra</option>
            <option value="post_fertilizacion" style={{ background: '#111' }}>Post-fertilización</option>
            <option value="otro" style={{ background: '#111' }}>Otro</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-mid">Estado del cultivo<input className="field" placeholder="ej. V3" value={estadoCultivo} onChange={e => setEstadoCultivo(e.target.value)} /></label>
      </div>

      <div className="grid gap-2 grid-cols-3 sm:grid-cols-6 lg:grid-cols-9">
        {CAMPOS.map(c => (
          <label key={c.key} className="grid gap-1 text-[11px] text-mid">{c.label}
            <input inputMode="decimal" className="field py-1.5" value={vals[c.key] ?? ''} onChange={e => setVals(v => ({ ...v, [c.key]: e.target.value }))} />
          </label>
        ))}
      </div>

      {momento === 'post_fertilizacion' && (
        <div className="space-y-2">
          <p className="text-xs text-mid">Fertilizante aplicado antes del muestreo (grado tipo 12-40-0-5-1Zn o nombre: urea, MAP, SPS, sulfato de amonio)</p>
          {fert.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input className="field flex-1" placeholder="Producto" value={f.producto} onChange={e => setFert(arr => arr.map((x, j) => j === i ? { ...x, producto: e.target.value } : x))} />
              <input className="field w-28" inputMode="decimal" placeholder="kg/ha" value={f.kg} onChange={e => setFert(arr => arr.map((x, j) => j === i ? { ...x, kg: e.target.value } : x))} />
            </div>
          ))}
          <button type="button" className="btn-ghost text-xs py-1 px-3" onClick={() => setFert(a => [...a, { producto: '', kg: '' }])}>+ Otro producto</button>
        </div>
      )}

      {err && <p className="text-danger text-sm">{err}</p>}
      <button type="submit" className="btn-afa" disabled={saving || !lotes.length}>{saving ? 'Guardando…' : 'Guardar análisis'}</button>
      {!lotes.length && <p className="text-xs text-mid">Este productor no tiene lotes en la campaña elegida.</p>}
    </form>
  );
}
