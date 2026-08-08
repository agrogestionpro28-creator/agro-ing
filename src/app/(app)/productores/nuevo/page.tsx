'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { crearProductor } from '../actions';

export default function NuevoProductorPage() {
  const [state, action, pending] = useActionState(crearProductor, null);

  return (
    <div className="max-w-lg mx-auto">
      <p className="eyebrow mb-1">Cartera</p>
      <h1 className="text-2xl font-bold text-hi mb-6">Nuevo productor</h1>

      <form action={action} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">
            Razón social *
          </label>
          <input name="razon_social" type="text" required className="field" placeholder="PÉREZ JUAN / AGRO SA" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">CUIT</label>
            <input name="cuit" type="text" className="field" placeholder="20-12345678-9" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Localidad</label>
            <input name="localidad" type="text" className="field" placeholder="San Carlos Centro" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Teléfono</label>
            <input name="telefono" type="tel" className="field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Email</label>
            <input name="email" type="email" className="field" />
          </div>
        </div>

        {state?.error && (
          <p className="text-xs text-danger bg-red-900/20 border border-red-900/40 rounded px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Guardando…' : 'Guardar productor'}
          </button>
          <Link href="/dashboard" className="btn-ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
