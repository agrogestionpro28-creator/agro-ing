'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useActionState } from 'react';
import { guardarPerfil } from './actions';

type Ing = { id: string; nombre: string; apellido: string | null; matricula: string | null; telefono: string | null; email: string | null; logo_url: string | null } | null;
type State = { error?: string; ok?: boolean } | null;

export function PerfilForm({ ingeniero, userId }: { ingeniero: Ing; userId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(guardarPerfil, null);
  const [campanas, setCampanas] = useState<any[]>([]);
  const [showNuevaCampana, setShowNuevaCampana] = useState(false);
  const [nuevaCampanaAnio, setNuevaCampanaAnio] = useState(new Date().getFullYear().toString());
  const [savingCampana, setSavingCampana] = useState(false);

  useEffect(() => { fetchCampanas(); }, []);

  async function fetchCampanas() {
    const { data } = await (createClient() as any).from('campanas')
      .select('id,nombre,fecha_inicio,fecha_fin').order('fecha_inicio', { ascending: false });
    setCampanas(data ?? []);
  }

  async function crearCampana() {
    const anio = parseInt(nuevaCampanaAnio);
    if (!anio || anio < 2020 || anio > 2040) return;
    setSavingCampana(true);
    const { error } = await (createClient() as any).from('campanas').insert({
      ingeniero_id: userId,
      nombre: `\${anio}/\${anio+1}`,
      fecha_inicio: `\${anio}-05-20`,
      fecha_fin: `\${anio+1}-05-19`,
    });
    setSavingCampana(false);
    if (error) { alert(error.message); return; }
    setShowNuevaCampana(false);
    await fetchCampanas();
  }

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

      {/* Campañas */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-hi">Campañas</h2>
          <button type="button" onClick={() => setShowNuevaCampana(!showNuevaCampana)} className="btn-ghost text-xs py-1.5 px-3">
            {showNuevaCampana ? '✕ Cancelar' : '+ Nueva campaña'}
          </button>
        </div>

        {showNuevaCampana && (
          <div className="flex gap-3 mb-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-mid mb-1 uppercase tracking-wider">Año de inicio</label>
              <input type="number" value={nuevaCampanaAnio}
                onChange={e => setNuevaCampanaAnio(e.target.value)}
                className="field" placeholder="2025" min="2020" max="2040"/>
              <p className="text-lo text-[10px] mt-1">
                Campaña {nuevaCampanaAnio}/{parseInt(nuevaCampanaAnio)+1}
              </p>
            </div>
            <button type="button" onClick={crearCampana} disabled={savingCampana} className="btn-primary">
              {savingCampana ? 'Creando…' : 'Crear'}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {campanas.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-base-5 last:border-0">
              <span className="font-semibold text-hi">{c.nombre}</span>
              <span className="text-lo text-xs">{c.fecha_inicio} → {c.fecha_fin}</span>
            </div>
          ))}
        </div>
      </div>
  );
}
