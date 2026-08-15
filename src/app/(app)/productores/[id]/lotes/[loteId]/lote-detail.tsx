'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const CULTIVOS = ['Soja','Maíz','Trigo','Girasol','Sorgo','Cebada','Alfalfa','Otro'];
const TIPOS_APL = ['Herbicida','Fungicida','Insecticida','Fertilizante','Fungicida+Insecticida','Otro'];

function cropColor(c: string | null) {
  if (!c) return '#a3a3a3';
  const n = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (n.includes('soja'))    return '#22c55e';
  if (n.includes('maiz'))    return '#84cc16';
  if (n.includes('trigo'))   return '#f59e0b';
  if (n.includes('cebada'))  return '#fbbf24';
  if (n.includes('sorgo'))   return '#ea580c';
  if (n.includes('girasol')) return '#38bdf8';
  if (n.includes('alfalfa')) return '#34d399';
  return '#a3a3a3';
}

type Lote = { id:string; productor_id:string; campana_id:string; nombre:string; hectareas:number; cultivo:string|null; cultivo_2:string|null; variedad:string|null; fecha_siembra:string|null; notas:string|null };
type Aplicacion = { id:string; lote_id:string; fecha:string; tipo:string; productos:string|null; maquinaria:string; propio_alq:string; costo_ha:number|null; hectareas_apl:number|null; observaciones:string|null; created_at:string };

const APL_VACIO = { fecha: new Date().toISOString().slice(0,10), tipo:'Herbicida', productos:'', maquinaria:'M', propio_alq:'Propio', costo_ha:'', hectareas_apl:'', observaciones:'' };

export function LoteDetail({ lote: initial, productorId }: { lote: Lote; productorId: string }) {
  const [lote, setLote] = useState(initial);
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([]);
  const [editando, setEditando] = useState(false);
  const [showAplForm, setShowAplForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingApl, setSavingApl] = useState(false);
  const [err, setErr] = useState('');
  const [aplForm, setAplForm] = useState({...APL_VACIO, hectareas_apl: String(initial.hectareas)});

  const [form, setForm] = useState({
    nombre: initial.nombre, hectareas: String(initial.hectareas),
    cultivo: initial.cultivo??'', cultivo_2: initial.cultivo_2??'',
    variedad: initial.variedad??'', fecha_siembra: initial.fecha_siembra??'', notas: initial.notas??'',
  });

  const cultivoActual = lote.cultivo || lote.cultivo_2;
  const color = cropColor(cultivoActual??null);

  useEffect(() => { fetchAplicaciones(); }, [lote.id]);

  async function fetchAplicaciones() {
    const { data } = await createClient().from('aplicaciones' as any)
      .select('*').eq('lote_id', lote.id).order('fecha', { ascending: false });
    setAplicaciones((data ?? []) as Aplicacion[]);
  }

  async function guardarLote() {
    setSaving(true); setErr('');
    const { data, error } = await (createClient() as any).from('lotes').update({
      nombre: form.nombre.trim(), hectareas: parseFloat(form.hectareas)||0,
      cultivo: form.cultivo||null, cultivo_2: form.cultivo_2||null,
      variedad: form.variedad||null, fecha_siembra: form.fecha_siembra||null, notas: form.notas||null,
    }).eq('id', lote.id).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setLote(data); setEditando(false);
  }

  async function guardarAplicacion() {
    setSavingApl(true); setErr('');
    const hasApl = parseFloat(aplForm.hectareas_apl) || lote.hectareas;
    const costoHa = parseFloat(aplForm.costo_ha) || null;
    const { error } = await (createClient() as any).from('aplicaciones').insert({
      lote_id: lote.id, fecha: aplForm.fecha, tipo: aplForm.tipo,
      productos: aplForm.productos||null, maquinaria: aplForm.maquinaria,
      propio_alq: aplForm.propio_alq, costo_ha: costoHa,
      hectareas_apl: hasApl, observaciones: aplForm.observaciones||null,
    });
    setSavingApl(false);
    if (error) { setErr(error.message); return; }
    setAplForm({...APL_VACIO, hectareas_apl: String(lote.hectareas)});
    setShowAplForm(false);
    await fetchAplicaciones();
  }

  async function eliminarAplicacion(id: string) {
    await (createClient() as any).from('aplicaciones').delete().eq('id', id);
    await fetchAplicaciones();
  }

  const maqLabel: Record<string,string> = { M:'🚜 Mosquito', D:'🚁 Dron', A:'✈ Avión' };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <p className="eyebrow">Lote</p>
        <div className="flex gap-2">
          <button onClick={()=>{setEditando(!editando); setShowAplForm(false);}} className="btn-ghost text-xs py-1 px-3">
            {editando ? '✕ Cancelar' : '✏ Editar'}
          </button>
          <Link href={`/productores/${productorId}`} className="btn-ghost text-xs py-1 px-3">← Volver</Link>
        </div>
      </div>

      {/* Info del lote — siempre visible */}
      {!editando && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{color}}>{lote.nombre}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span className="text-hi font-bold">{lote.hectareas} ha</span>
            {lote.cultivo && <span style={{color: cropColor(lote.cultivo)}} className="font-semibold">{lote.cultivo}{lote.cultivo_2?' →':''}</span>}
            {lote.cultivo_2 && <span style={{color: cropColor(lote.cultivo_2)}} className="font-semibold">{lote.cultivo_2} 2°</span>}
            {lote.variedad && <span className="text-mid">· {lote.variedad}</span>}
            {lote.fecha_siembra && <span className="text-mid">· Siem: {lote.fecha_siembra}</span>}
          </div>
          {lote.notas && <p className="text-lo text-xs mt-2 italic">{lote.notas}</p>}
        </div>
      )}

      {/* Formulario edición */}
      {editando && (
        <div className="card p-5 space-y-4 mb-6">
          <h2 className="font-semibold text-hi text-sm">Editar lote</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Nombre</label>
              <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} className="field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Hectáreas</label>
              <input type="number" step="0.01" value={form.hectareas} onChange={e=>setForm(f=>({...f,hectareas:e.target.value}))} className="field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Cultivo</label>
              <select value={form.cultivo} onChange={e=>setForm(f=>({...f,cultivo:e.target.value}))} className="field">
                <option value="">—</option>
                {CULTIVOS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">2° Cultivo</label>
              <select value={form.cultivo_2} onChange={e=>setForm(f=>({...f,cultivo_2:e.target.value}))} className="field">
                <option value="">—</option>
                {CULTIVOS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Variedad</label>
              <input value={form.variedad} onChange={e=>setForm(f=>({...f,variedad:e.target.value}))} className="field" placeholder="DM 4210" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha siembra</label>
              <input type="date" value={form.fecha_siembra} onChange={e=>setForm(f=>({...f,fecha_siembra:e.target.value}))} className="field" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} className="field resize-none" />
          </div>
          {err && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{err}</p>}
          <button onClick={guardarLote} disabled={saving} className="btn-primary w-full">
            {saving?'Guardando…':'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Aplicaciones */}
      {!editando && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-hi text-sm">Aplicaciones</h2>
            <button onClick={()=>setShowAplForm(!showAplForm)} className="btn-primary text-xs py-1.5 px-3">
              {showAplForm ? '✕ Cancelar' : '+ Agregar aplicación'}
            </button>
          </div>

          {/* Formulario nueva aplicación */}
          {showAplForm && (
            <div className="card p-5 space-y-4 mb-4 border-ochre/40">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Fecha</label>
                  <input type="date" value={aplForm.fecha} onChange={e=>setAplForm(f=>({...f,fecha:e.target.value}))} className="field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Tipo</label>
                  <select value={aplForm.tipo} onChange={e=>setAplForm(f=>({...f,tipo:e.target.value}))} className="field">
                    {TIPOS_APL.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Productos y dosis</label>
                <textarea rows={2} value={aplForm.productos}
                  onChange={e=>setAplForm(f=>({...f,productos:e.target.value}))}
                  className="field resize-none"
                  placeholder="Ej: Roundup 3 l/ha + Banvel 0.5 l/ha" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Maquinaria</label>
                  <div className="flex gap-1">
                    {[['M','🚜'],['D','🚁'],['A','✈']].map(([v,icon])=>(
                      <button key={v} type="button"
                        onClick={()=>setAplForm(f=>({...f,maquinaria:v}))}
                        className={cn('flex-1 py-2 rounded text-sm border transition-all',
                          aplForm.maquinaria===v ? 'bg-ochre text-base-DEFAULT border-ochre' : 'bg-base-3 border-base-5 text-mid hover:border-ochre'
                        )}
                        title={v==='M'?'Mosquito':v==='D'?'Dron':'Avión'}
                      >{icon}</button>
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
                          (aplForm.propio_alq==='Propio'&&v==='Propio')||(aplForm.propio_alq==='Alquilado'&&v==='Alq.')
                            ? 'bg-ochre text-base-DEFAULT border-ochre'
                            : 'bg-base-3 border-base-5 text-mid hover:border-ochre'
                        )}
                      >{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Ha aplicadas</label>
                  <input type="number" step="0.1" value={aplForm.hectareas_apl}
                    onChange={e=>setAplForm(f=>({...f,hectareas_apl:e.target.value}))}
                    className="field" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">
                  Costo de aplicación (U$S/ha)
                  {aplForm.costo_ha && aplForm.hectareas_apl &&
                    <span className="ml-2 text-ochre normal-case tracking-normal">
                      = U$S {(parseFloat(aplForm.costo_ha)*parseFloat(aplForm.hectareas_apl)).toLocaleString('es-AR')} total
                    </span>
                  }
                </label>
                <input type="number" step="0.01" value={aplForm.costo_ha}
                  onChange={e=>setAplForm(f=>({...f,costo_ha:e.target.value}))}
                  className="field" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Observaciones</label>
                <input value={aplForm.observaciones}
                  onChange={e=>setAplForm(f=>({...f,observaciones:e.target.value}))}
                  className="field" placeholder="Opcional" />
              </div>

              {err && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{err}</p>}
              <button onClick={guardarAplicacion} disabled={savingApl} className="btn-primary w-full">
                {savingApl?'Guardando…':'Guardar aplicación'}
              </button>
            </div>
          )}

          {/* Lista de aplicaciones */}
          {aplicaciones.length === 0 ? (
            <p className="text-lo text-sm text-center py-6">Sin aplicaciones registradas.</p>
          ) : (
            <div className="space-y-2">
              {aplicaciones.map(a=>{
                const costoTotal = a.costo_ha && a.hectareas_apl ? a.costo_ha * a.hectareas_apl : null;
                return (
                  <div key={a.id} className="card p-4 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-ochre font-bold text-xs">{a.fecha}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-base-4 text-mid border border-base-5">{a.tipo}</span>
                          <span className="text-[10px] text-lo">{maqLabel[a.maquinaria]??a.maquinaria}</span>
                          <span className="text-[10px] text-lo">{a.propio_alq}</span>
                          {a.hectareas_apl && <span className="text-[10px] text-lo">{a.hectareas_apl} ha</span>}
                          {costoTotal && (
                            <span className="text-[10px] font-bold text-afa">
                              U$S {costoTotal.toLocaleString('es-AR')} total
                            </span>
                          )}
                        </div>
                        {a.productos && <p className="text-hi text-sm">{a.productos}</p>}
                        {a.observaciones && <p className="text-lo text-xs mt-1 italic">{a.observaciones}</p>}
                      </div>
                      <button
                        onClick={()=>eliminarAplicacion(a.id)}
                        className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg hover:text-red-400"
                        title="Eliminar"
                      >🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
