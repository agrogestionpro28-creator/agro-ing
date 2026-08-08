'use client';
import { useActionState } from 'react';
import { guardarPerfil } from './actions';

type Ing = { id: string; nombre: string; apellido: string | null; matricula: string | null; telefono: string | null; email: string | null; logo_url: string | null } | null;
type State = { error?: string; ok?: boolean } | null;

export function PerfilForm({ ingeniero }: { ingeniero: Ing }) {
  const [state, action, pending] = useActionState<State, FormData>(guardarPerfil, null);

  return (
    <div className="max-w-lg mx-auto">
      <p className="eyebrow mb-1">Configuración</p>
      <h1 className="text-2xl font-bold text-hi mb-6">Tu perfil</h1>

      <form action={action} className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Nombre *</label>
            <input name="nombre" type="text" required defaultValue={ingeniero?.nombre ?? ''} className="field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Apellido</label>
            <input name="apellido" type="text" defaultValue={ingeniero?.apellido ?? ''} className="field" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Matrícula (M.P.)</label>
          <input name="matricula" type="text" defaultValue={ingeniero?.matricula ?? ''} className="field" placeholder="882-1-1075" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Teléfono</label>
            <input name="telefono" type="tel" defaultValue={ingeniero?.telefono ?? ''} className="field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Email</label>
            <input name="email" type="email" defaultValue={ingeniero?.email ?? ''} className="field" />
          </div>
        </div>

        {state?.error && (
          <p className="text-xs text-danger bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{state.error}</p>
        )}
        {state?.ok && (
          <p className="text-xs text-afa bg-afa-tint border border-afa/30 rounded px-3 py-2">Perfil guardado.</p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </form>
    </div>
  );
}
