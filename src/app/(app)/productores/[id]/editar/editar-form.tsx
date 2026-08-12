'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { actualizarProductor } from './actions';

type State = { error?: string; ok?: boolean } | null;
type Productor = { id: string; razon_social: string; cuit: string | null; telefono: string | null; email: string | null; localidad: string | null };

export function EditarProductorForm({ productor }: { productor: Productor }) {
  const [state, action, pending] = useActionState<State, FormData>(actualizarProductor, null);

  return (
    <div className="max-w-lg mx-auto">
      <p className="eyebrow mb-1">Productor</p>
      <h1 className="text-2xl font-bold text-hi mb-6">Editar — {productor.razon_social}</h1>

      <form action={action} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={productor.id} />

        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Razón social *</label>
          <input name="razon_social" type="text" required defaultValue={productor.razon_social} className="field" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">CUIT</label>
            <input name="cuit" type="text" defaultValue={productor.cuit ?? ''} className="field" placeholder="20-12345678-9" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Localidad</label>
            <input name="localidad" type="text" defaultValue={productor.localidad ?? ''} className="field" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Teléfono</label>
            <input name="telefono" type="tel" defaultValue={productor.telefono ?? ''} className="field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Email</label>
            <input name="email" type="email" defaultValue={productor.email ?? ''} className="field" />
          </div>
        </div>

        {state?.error && <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{state.error}</p>}
        {state?.ok && <p className="text-xs text-green-400 bg-green-950 border border-green-800 rounded px-3 py-2">✓ Guardado correctamente</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link href={`/productores/${productor.id}`} className="btn-ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
