'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const CULTIVOS = ['Soja','Maíz','Trigo','Girasol','Sorgo','Cebada','Alfalfa','Otro'];

function cropColor(cultivo: string | null): string {
  if (!cultivo) return '#a3a3a3';
  const n = cultivo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (n.includes('soja'))    return '#22c55e';
  if (n.includes('maiz'))    return '#84cc16';
  if (n.includes('trigo'))   return '#f59e0b';
  if (n.includes('cebada'))  return '#fbbf24';
  if (n.includes('sorgo'))   return '#ea580c';
  if (n.includes('girasol')) return '#38bdf8';
  if (n.includes('alfalfa')) return '#34d399';
  return '#a3a3a3';
}

type Lote = {
  id: string; productor_id: string; campana_id: string;
  nombre: string; hectareas: number;
  cultivo: string | null; cultivo_2: string | null;
  variedad: string | null; fecha_siembra: string | null; notas: string | null;
};

export function LoteDetail({ lote: initial, productorId }: { lote: Lote; productorId: string }) {
  const router = useRouter();
  const [lote, setLote] = useState(initial);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: initial.nombre,
    hectareas: String(initial.hectareas),
    cultivo: initial.cultivo ?? '',
    cultivo_2: initial.cultivo_2 ?? '',
    variedad: initial.variedad ?? '',
    fecha_siembra: initial.fecha_siembra ?? '',
    notas: initial.notas ?? '',
  });
  const [err, setErr] = useState('');

  const cultivoActual = lote.cultivo || lote.cultivo_2;
  const color = cropColor(cultivoActual ?? null);

  async function guardar() {
    setSaving(true); setErr('');
    const sb = createClient();
    const { data, error } = await (sb as any).from('lotes').update({
      nombre: form.nombre.trim(),
      hectareas: parseFloat(form.hectareas) || 0,
      cultivo: form.cultivo.trim() || null,
      cultivo_2: form.cultivo_2.trim() || null,
      variedad: form.variedad.trim() || null,
      fecha_siembra: form.fecha_siembra || null,
      notas: form.notas.trim() || null,
    }).eq('id', lote.id).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setLote(data);
    setEditando(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <p className="eyebrow">Lote</p>
        <div className="flex gap-2">
          {!editando && (
            <button onClick={() => setEditando(true)} className="btn-ghost text-xs py-1 px-3">✏ Editar</button>
          )}
          <Link href={`/productores/${productorId}`} className="btn-ghost text-xs py-1 px-3">← Volver</Link>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-hi mb-1" style={{ color }}>{lote.nombre}</h1>
      <p className="text-mid text-sm mb-6">
        {lote.hectareas} ha
        {lote.cultivo && <> · <span style={{ color }}>{lote.cultivo}</span></>}
        {lote.cultivo_2 && <> → <span style={{ color: cropColor(lote.cultivo_2) }}>{lote.cultivo_2} 2°</span></>}
        {lote.variedad && <> · {lote.variedad}</>}
      </p>

      {!editando ? (
        /* Vista */
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Hectáreas', value: `${lote.hectareas} ha`, color: '#22c55e' },
            { label: 'Cultivo actual', value: cultivoActual ?? '—', color },
            { label: 'Próximo cultivo', value: lote.cultivo && lote.cultivo_2 ? `${lote.cultivo_2} 2°` : '—', color: cropColor(lote.cultivo_2) },
            { label: 'Variedad', value: lote.variedad ?? '—', color: '#a3a3a3' },
            { label: 'Fecha siembra', value: lote.fecha_siembra ?? '—', color: '#a3a3a3' },
            { label: 'Notas', value: lote.notas ?? '—', color: '#525252' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-lo text-[10px] uppercase tracking-wider mb-2">{s.label}</div>
              <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      ) : (
        /* Formulario edición */
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Nombre *</label>
              <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} className="field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Hectáreas *</label>
              <input type="number" step="0.01" value={form.hectareas} onChange={e=>setForm(f=>({...f,hectareas:e.target.value}))} className="field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Cultivo</label>
              <select value={form.cultivo} onChange={e=>setForm(f=>({...f,cultivo:e.target.value}))} className="field">
                <option value="">—</option>
                {CULTIVOS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">2° Cultivo</label>
              <select value={form.cultivo_2} onChange={e=>setForm(f=>({...f,cultivo_2:e.target.value}))} className="field">
                <option value="">—</option>
                {CULTIVOS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Variedad</label>
              <input value={form.variedad} onChange={e=>setForm(f=>({...f,variedad:e.target.value}))} className="field" placeholder="DM 4210" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Fecha siembra</label>
              <input type="date" value={form.fecha_siembra} onChange={e=>setForm(f=>({...f,fecha_siembra:e.target.value}))} className="field" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} className="field resize-none" />
          </div>

          {err && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={guardar} disabled={saving} className="btn-primary">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={()=>setEditando(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
