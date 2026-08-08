'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { crearLote } from './actions';

const CULTIVOS = ['Soja','Maíz','Trigo','Girasol','Sorgo','Cebada','Alfalfa','Otro'] as const;

type Productor = { id: string; razon_social: string };
type Campana = { id: string; nombre: string };

export function NuevoLoteForm({ productor, campanas }: { productor: Productor; campanas: Campana[] }) {
  const [state, action, pending] = useActionState(crearLote, null);

  return (
    <div className="max-w-lg mx-auto">
      <p className="eyebrow mb-1">Lotes</p>
      <h1 className="text-2xl font-bold text-hi mb-1">Nuevo lote</h1>
      <p className="text-mid text-sm mb-6">{productor.razon_social}</p>

      <form action={action} className="card p-6 space-y-4">
        <input type="hidden" name="productor_id" value={productor.id} />

        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Campaña *</label>
          <select name="campana_id" required className="field">
            <option value="">Seleccionar campaña…</option>
            {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Nombre del lote *</label>
          <input name="nombre" type="text" required className="field" placeholder="Lote Norte / La Cañada" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Hectáreas *</label>
          <input name="hectareas" type="number" step="0.01" min="0.01" required className="field" placeholder="150.50" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Cultivo</label>
            <select name="cultivo" className="field">
              <option value="">—</option>
              {CULTIVOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">2° cultivo</label>
            <select name="cultivo_2" className="field">
              <option value="">—</option>
              {CULTIVOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Variedad</label>
            <input name="variedad" type="text" className="field" placeholder="DM 4210" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Fecha siembra</label>
            <input name="fecha_siembra" type="date" className="field" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Notas</label>
          <textarea name="notas" rows={2} className="field resize-none" />
        </div>

        {state?.error && (
          <p className="text-xs text-danger bg-red-900/20 border border-red-900/40 rounded px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Guardando…' : 'Guardar lote'}
          </button>
          <Link href={`/productores/${productor.id}`} className="btn-ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
