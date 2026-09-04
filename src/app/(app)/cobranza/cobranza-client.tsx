'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, fmtFecha } from '@/lib/utils';

type Campana = { id: string; nombre: string };
type Productor = { id: string; razon_social: string; hectareas_totales?: number };
type Acuerdo = {
  id: string; productor_id: string; campana_id: string;
  modalidad: string; valor: number | null; hectareas: number | null;
  precio_soja_kg: number | null; fecha_pesifica: string | null;
  total_kg: number | null; total_pesos: number | null;
  observaciones: string | null;
};
type Pago = {
  id: string; acuerdo_id: string; fecha: string;
  monto_pesos: number; forma_pago: string; observaciones: string | null;
};

const MODALIDADES = [
  { value: 'kg_ha_mes',  label: 'kg/ha por mes' },
  { value: 'kg_ha_anio', label: 'kg/ha por año' },
  { value: 'monto_fijo', label: 'Monto fijo ($)' },
];

const FORMAS_PAGO = ['transferencia','efectivo','cheque'];

function fmtPesos(n: number) {
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CobranzaClient({ campanas, productores, userId }: {
  campanas: Campana[]; productores: Productor[]; userId: string;
}) {
  const [campanaId, setCampanaId] = useState(campanas[campanas.length-1]?.id ?? '');
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal acuerdo
  const [showAcuerdo, setShowAcuerdo] = useState(false);
  const [acuerdoForm, setAcuerdoForm] = useState({
    productor_id: '', modalidad: 'kg_ha_anio', valor: '',
    hectareas: '', observaciones: '',
  });
  const [savingAcuerdo, setSavingAcuerdo] = useState(false);

  // Modal pesificar
  const [pesificando, setPesificando] = useState<Acuerdo | null>(null);
  const [precioSoja, setPrecioSoja] = useState('');
  const [fechaPesifica, setFechaPesifica] = useState(new Date().toISOString().slice(0,10));

  // Modal pago
  const [pagandoAcuerdo, setPagandoAcuerdo] = useState<Acuerdo | null>(null);
  const [pagoForm, setPagoForm] = useState({ fecha: new Date().toISOString().slice(0,10), monto_pesos: '', forma_pago: 'transferencia', observaciones: '' });
  const [savingPago, setSavingPago] = useState(false);

  // Expandido
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => { if (campanaId) fetchData(); }, [campanaId]);

  async function fetchData() {
    setLoading(true);
    const sb = createClient() as any;
    const [{ data: ac }, { data: pg }] = await Promise.all([
      sb.from('acuerdos').select('*').eq('campana_id', campanaId).eq('ingeniero_id', userId),
      sb.from('pagos').select('*').order('fecha', { ascending: false }),
    ]);
    setAcuerdos(ac ?? []);
    setPagos(pg ?? []);
    setLoading(false);
  }

  async function guardarAcuerdo() {
    if (!acuerdoForm.productor_id || !acuerdoForm.valor) return;
    setSavingAcuerdo(true);
    const sb = createClient() as any;
    const has = acuerdoForm.hectareas
      ? parseFloat(acuerdoForm.hectareas)
      : productores.find(p => p.id === acuerdoForm.productor_id)?.hectareas_totales ?? null;

    const valor = parseFloat(acuerdoForm.valor);
    // Calcular total_kg
    let total_kg = null;
    if (acuerdoForm.modalidad === 'kg_ha_anio' && has) total_kg = valor * has;
    if (acuerdoForm.modalidad === 'kg_ha_mes' && has) total_kg = valor * has * 12;

    const { error } = await sb.from('acuerdos').upsert({
      productor_id: acuerdoForm.productor_id,
      campana_id: campanaId,
      ingeniero_id: userId,
      modalidad: acuerdoForm.modalidad,
      valor, hectareas: has, total_kg,
      observaciones: acuerdoForm.observaciones || null,
    }, { onConflict: 'productor_id,campana_id' });

    setSavingAcuerdo(false);
    if (error) { alert(error.message); return; }
    setShowAcuerdo(false);
    setAcuerdoForm({ productor_id: '', modalidad: 'kg_ha_anio', valor: '', hectareas: '', observaciones: '' });
    await fetchData();
  }

  async function pesificar() {
    if (!pesificando || !precioSoja) return;
    const precio = parseFloat(precioSoja);
    const total_pesos = (pesificando.total_kg ?? 0) * precio;
    const sb = createClient() as any;
    await sb.from('acuerdos').update({
      precio_soja_kg: precio,
      fecha_pesifica: fechaPesifica,
      total_pesos,
    }).eq('id', pesificando.id);
    setPesificando(null); setPrecioSoja('');
    await fetchData();
  }

  async function guardarPago() {
    if (!pagandoAcuerdo || !pagoForm.monto_pesos) return;
    setSavingPago(true);
    const { error } = await (createClient() as any).from('pagos').insert({
      acuerdo_id: pagandoAcuerdo.id,
      fecha: pagoForm.fecha,
      monto_pesos: parseFloat(pagoForm.monto_pesos),
      forma_pago: pagoForm.forma_pago,
      observaciones: pagoForm.observaciones || null,
    });
    setSavingPago(false);
    if (error) { alert(error.message); return; }
    setPagandoAcuerdo(null);
    setPagoForm({ fecha: new Date().toISOString().slice(0,10), monto_pesos: '', forma_pago: 'transferencia', observaciones: '' });
    await fetchData();
  }

  async function eliminarPago(id: string) {
    await (createClient() as any).from('pagos').delete().eq('id', id);
    await fetchData();
  }

  // Stats generales campaña
  const totalPactado = acuerdos.reduce((s, a) => s + (a.total_pesos ?? 0), 0);
  const totalCobrado = acuerdos.reduce((s, a) => {
    const pgAcuerdo = pagos.filter(p => p.acuerdo_id === a.id);
    return s + pgAcuerdo.reduce((ss, p) => ss + Number(p.monto_pesos), 0);
  }, 0);
  const totalPendiente = totalPactado - totalCobrado;

  const campanaActual = campanas.find(c => c.id === campanaId);

  // Productores sin acuerdo en esta campaña
  const productoresSinAcuerdo = productores.filter(p =>
    !acuerdos.find(a => a.productor_id === p.id)
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Módulo</p>
          <h1 className="text-2xl font-bold text-hi">Cobranza</h1>
        </div>
        <button onClick={() => setShowAcuerdo(true)} className="btn-primary text-xs">
          + Nuevo acuerdo
        </button>
      </div>

      {/* Selector campaña */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {campanas.map(c => (
          <button key={c.id} onClick={() => setCampanaId(c.id)}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
              campanaId === c.id ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}
          >{c.nombre}</button>
        ))}
      </div>

      {/* Stats resumen */}
      {totalPactado > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total pactado', value: fmtPesos(totalPactado), color: 'text-ochre', bg: 'bg-[#1a1000] border-ochre/30' },
            { label: 'Cobrado', value: fmtPesos(totalCobrado), color: 'text-afa', bg: 'bg-[#0a1a12] border-afa/30' },
            { label: 'Pendiente', value: fmtPesos(totalPendiente), color: totalPendiente > 0 ? 'text-red-400' : 'text-afa', bg: totalPendiente > 0 ? 'bg-[#1a0a0a] border-red-600/30' : 'bg-[#0a1a12] border-afa/30' },
          ].map(s => (
            <div key={s.label} className={`card ${s.bg} p-5 text-center`}>
              <p className="text-xs text-lo uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`font-black text-xl ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista acuerdos */}
      {loading ? <p className="text-mid text-sm">Cargando…</p> : acuerdos.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-mid mb-2">Sin acuerdos para {campanaActual?.nombre}</p>
          <p className="text-lo text-sm mb-4">Cargá el acuerdo de honorarios de cada productor.</p>
          <button onClick={() => setShowAcuerdo(true)} className="btn-primary text-xs">+ Nuevo acuerdo</button>
        </div>
      ) : (
        <div className="space-y-3">
          {acuerdos.map(a => {
            const prod = productores.find(p => p.id === a.productor_id);
            const pgAcuerdo = pagos.filter(p => p.acuerdo_id === a.id);
            const cobrado = pgAcuerdo.reduce((s, p) => s + Number(p.monto_pesos), 0);
            const pendiente = (a.total_pesos ?? 0) - cobrado;
            const pct = a.total_pesos ? Math.min(100, (cobrado / a.total_pesos) * 100) : 0;
            const modalLabel = MODALIDADES.find(m => m.value === a.modalidad)?.label ?? a.modalidad;
            const isExpanded = expandido === a.id;

            return (
              <div key={a.id} className="card overflow-hidden">
                {/* Row principal */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-hi">{prod?.razon_social ?? '—'}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-base-4 text-lo border border-base-5">{modalLabel}</span>
                        {a.fecha_pesifica && <span className="text-[10px] text-mid">Pesificado {fmtFecha(a.fecha_pesifica)}</span>}
                      </div>

                      {/* Detalles acuerdo */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-lo mb-3">
                        {a.valor && <span>{a.valor} {a.modalidad.includes('kg') ? 'kg/ha' : '$'}{a.modalidad === 'kg_ha_mes' ? '/mes' : ''}</span>}
                        {a.hectareas && <span>· {a.hectareas} ha</span>}
                        {a.total_kg && <span>· Total: {a.total_kg.toLocaleString('es-AR')} kg</span>}
                        {a.precio_soja_kg && <span>· Soja: ${a.precio_soja_kg}/kg</span>}
                      </div>

                      {/* Barra de progreso */}
                      {a.total_pesos ? (
                        <>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-afa font-semibold">{fmtPesos(cobrado)} cobrado</span>
                            <span className={pendiente > 0 ? 'text-red-400' : 'text-afa'}>{fmtPesos(Math.abs(pendiente))} {pendiente > 0 ? 'pendiente' : '✓ saldado'}</span>
                          </div>
                          <div className="h-2 bg-base-5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct >= 100 ? '#2EAA6E' : '#f59e0b' }} />
                          </div>
                          <p className="text-lo text-[10px] mt-1">Total pactado: {fmtPesos(a.total_pesos)}</p>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">⚠ Sin pesificar</span>
                          {a.total_kg && <span className="text-xs text-mid">— {a.total_kg.toLocaleString('es-AR')} kg pendientes de pesificar</span>}
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {!a.total_pesos && a.total_kg && (
                        <button onClick={() => { setPesificando(a); setPrecioSoja(''); }}
                          className="btn-ghost text-[10px] py-1 px-2">💱 Pesificar</button>
                      )}
                      {a.total_pesos && pendiente > 0 && (
                        <button onClick={() => setPagandoAcuerdo(a)}
                          className="btn-primary text-[10px] py-1 px-2">+ Pago</button>
                      )}
                      <button onClick={() => setExpandido(isExpanded ? null : a.id)}
                        className="btn-ghost text-[10px] py-1 px-2">
                        {isExpanded ? '▲ Ocultar' : '▼ Pagos'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Historial de pagos expandible */}
                {isExpanded && (
                  <div className="border-t border-base-5 bg-base-4">
                    {pgAcuerdo.length === 0 ? (
                      <p className="text-lo text-xs text-center py-4">Sin pagos registrados.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-lo border-b border-base-5">
                            <th className="px-4 py-2 text-left">Fecha</th>
                            <th className="px-4 py-2 text-left">Forma</th>
                            <th className="px-4 py-2 text-right">Monto</th>
                            <th className="px-4 py-2 text-left">Obs.</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {pgAcuerdo.map(p => (
                            <tr key={p.id} className="border-b border-base-5 last:border-0">
                              <td className="px-4 py-2 text-mid text-xs">{fmtFecha(p.fecha)}</td>
                              <td className="px-4 py-2 text-xs text-lo capitalize">{p.forma_pago}</td>
                              <td className="px-4 py-2 text-right font-bold text-afa">{fmtPesos(p.monto_pesos)}</td>
                              <td className="px-4 py-2 text-xs text-lo italic">{p.observaciones ?? '—'}</td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={() => eliminarPago(p.id)} className="text-base-6 hover:text-red-400 text-xs">🗑</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {a.total_pesos && pendiente > 0 && (
                      <div className="px-4 py-3 border-t border-base-5">
                        <button onClick={() => setPagandoAcuerdo(a)} className="btn-primary text-xs w-full">+ Registrar pago</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Productores sin acuerdo */}
      {productoresSinAcuerdo.length > 0 && (
        <div className="mt-6 card p-4">
          <p className="text-xs font-semibold text-lo uppercase tracking-wider mb-3">Sin acuerdo en {campanaActual?.nombre}</p>
          <div className="flex flex-wrap gap-2">
            {productoresSinAcuerdo.map(p => (
              <button key={p.id}
                onClick={() => { setAcuerdoForm(f => ({...f, productor_id: p.id})); setShowAcuerdo(true); }}
                className="text-xs px-3 py-1.5 rounded border border-base-5 text-lo hover:border-ochre hover:text-ochre transition-all">
                + {p.razon_social}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Nuevo acuerdo */}
      {showAcuerdo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-md card p-6 space-y-4" style={{borderColor:'rgba(245,158,11,0.4)'}}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-hi">Nuevo acuerdo de honorarios</h2>
              <button onClick={() => setShowAcuerdo(false)} className="text-lo hover:text-hi text-xl">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productor</label>
              <select value={acuerdoForm.productor_id} onChange={e => setAcuerdoForm(f => ({...f, productor_id: e.target.value}))} className="field">
                <option value="">— Seleccioná —</option>
                {productores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Modalidad</label>
              <div className="flex gap-2 flex-wrap">
                {MODALIDADES.map(m => (
                  <button key={m.value} type="button"
                    onClick={() => setAcuerdoForm(f => ({...f, modalidad: m.value}))}
                    className={cn('px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                      acuerdoForm.modalidad === m.value ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                  >{m.label}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                  {acuerdoForm.modalidad === 'monto_fijo' ? 'Monto ($)' : 'Kg/ha'}
                </label>
                <input type="number" step="0.01" value={acuerdoForm.valor}
                  onChange={e => setAcuerdoForm(f => ({...f, valor: e.target.value}))}
                  className="field" placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                  Hectáreas <span className="text-lo normal-case font-normal">(deja vacío = toma las del productor)</span>
                </label>
                <input type="number" step="0.1" value={acuerdoForm.hectareas}
                  onChange={e => setAcuerdoForm(f => ({...f, hectareas: e.target.value}))}
                  className="field" placeholder="Auto"/>
              </div>
            </div>

            {/* Preview cálculo */}
            {acuerdoForm.valor && acuerdoForm.modalidad !== 'monto_fijo' && (
              <div className="bg-base-4 rounded px-4 py-3 text-sm">
                {(() => {
                  const has = acuerdoForm.hectareas
                    ? parseFloat(acuerdoForm.hectareas)
                    : productores.find(p => p.id === acuerdoForm.productor_id)?.hectareas_totales ?? 0;
                  const val = parseFloat(acuerdoForm.valor);
                  const kg = acuerdoForm.modalidad === 'kg_ha_mes' ? val * has * 12 : val * has;
                  return <><span className="text-mid">Total estimado: </span><span className="text-ochre font-bold">{kg.toLocaleString('es-AR')} kg</span> ({has} ha)</>;
                })()}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
              <input value={acuerdoForm.observaciones}
                onChange={e => setAcuerdoForm(f => ({...f, observaciones: e.target.value}))}
                className="field" placeholder="Condiciones, notas..."/>
            </div>

            <button onClick={guardarAcuerdo} disabled={savingAcuerdo || !acuerdoForm.productor_id || !acuerdoForm.valor}
              className="btn-primary w-full">
              {savingAcuerdo ? 'Guardando…' : 'Guardar acuerdo'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Pesificar */}
      {pesificando && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm card p-6 space-y-4" style={{borderColor:'rgba(46,170,110,0.4)'}}>
            <h2 className="font-bold text-hi">Pesificar honorario</h2>
            <p className="text-mid text-sm">
              {productores.find(p => p.id === pesificando.productor_id)?.razon_social}
              <br/><span className="text-ochre font-bold">{pesificando.total_kg?.toLocaleString('es-AR')} kg</span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Precio soja ($/kg)</label>
              <input type="number" step="1" value={precioSoja} onChange={e => setPrecioSoja(e.target.value)} className="field" placeholder="Ej: 350"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha pesificación</label>
              <input type="date" value={fechaPesifica} onChange={e => setFechaPesifica(e.target.value)} className="field"/>
            </div>
            {precioSoja && pesificando.total_kg && (
              <div className="bg-base-4 rounded px-4 py-3">
                <span className="text-mid text-sm">Total en pesos: </span>
                <span className="text-afa font-black text-lg">{fmtPesos(pesificando.total_kg * parseFloat(precioSoja))}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={pesificar} disabled={!precioSoja} className="btn-afa flex-1">Confirmar pesificación</button>
              <button onClick={() => setPesificando(null)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registrar pago */}
      {pagandoAcuerdo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm card p-6 space-y-4" style={{borderColor:'rgba(46,170,110,0.4)'}}>
            <h2 className="font-bold text-hi">Registrar pago</h2>
            <p className="text-mid text-sm">
              {productores.find(p => p.id === pagandoAcuerdo.productor_id)?.razon_social}
            </p>
            {(() => {
              const cobrado = pagos.filter(p => p.acuerdo_id === pagandoAcuerdo.id).reduce((s,p)=>s+Number(p.monto_pesos),0);
              const pendiente = (pagandoAcuerdo.total_pesos ?? 0) - cobrado;
              return <p className="text-xs text-red-400">Saldo pendiente: <span className="font-bold">{fmtPesos(pendiente)}</span></p>;
            })()}
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label>
              <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({...f, fecha: e.target.value}))} className="field"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Monto ($)</label>
              <input type="number" step="1" value={pagoForm.monto_pesos} onChange={e => setPagoForm(f => ({...f, monto_pesos: e.target.value}))} className="field" placeholder="0"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-2 uppercase tracking-wider">Forma de pago</label>
              <div className="flex gap-2">
                {FORMAS_PAGO.map(fp => (
                  <button key={fp} type="button" onClick={() => setPagoForm(f => ({...f, forma_pago: fp}))}
                    className={cn('flex-1 py-2 rounded text-xs border capitalize transition-all',
                      pagoForm.forma_pago === fp ? 'bg-ochre text-[#0a0a0a] border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre')}
                  >{fp}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
              <input value={pagoForm.observaciones} onChange={e => setPagoForm(f => ({...f, observaciones: e.target.value}))} className="field" placeholder="Opcional"/>
            </div>
            <div className="flex gap-3">
              <button onClick={guardarPago} disabled={savingPago || !pagoForm.monto_pesos} className="btn-primary flex-1">
                {savingPago ? 'Guardando…' : 'Registrar pago'}
              </button>
              <button onClick={() => setPagandoAcuerdo(null)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
