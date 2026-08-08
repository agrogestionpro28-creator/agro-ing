'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCampana } from '@/components/layout/app-shell';

type Productor = { id: string; razon_social: string; cuit: string | null; localidad: string | null; telefono: string | null; email: string | null };
type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Lote = { id: string; nombre: string; hectareas: number; cultivo: string | null; cultivo_2: string | null; variedad: string | null; fecha_siembra: string | null };

export function ProductorDetail({ productor, campanas }: { productor: Productor; campanas: Campana[] }) {
  const { campanaId } = useCampana();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campanaId) return;
    const sb = createClient();
    setLoading(true);
    sb.from('lotes')
      .select('id, nombre, hectareas, cultivo, cultivo_2, variedad, fecha_siembra')
      .eq('productor_id', productor.id)
      .eq('campana_id', campanaId)
      .order('nombre')
      .then(({ data }) => { setLotes(data ?? []); setLoading(false); });
  }, [campanaId, productor.id]);

  const totalHas = lotes.reduce((s, l) => s + Number(l.hectareas), 0);
  const campana = campanas.find((c) => c.id === campanaId);

  return (
    <div>
      <p className="eyebrow mb-1">Productor</p>
      <h1 className="text-2xl font-bold text-hi mb-1">{productor.razon_social}</h1>
      <p className="text-mid text-sm mb-6">
        {[productor.cuit, productor.localidad, productor.telefono].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Hectáreas', value: Math.round(totalHas) + ' ha' },
          { label: 'Lotes', value: lotes.length },
          { label: 'Campaña', value: campana?.nombre ?? '—' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-lo text-xs uppercase tracking-wider mb-1">{s.label}</div>
            <div className="text-hi font-bold text-xl">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Lotes */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-hi">Lotes — Campaña {campana?.nombre}</h2>
        <Link
          href={`/productores/${productor.id}/lotes/nuevo`}
          className="btn-primary text-xs py-1.5"
        >
          + Lote
        </Link>
      </div>

      {loading ? (
        <p className="text-mid text-sm">Cargando lotes…</p>
      ) : lotes.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-mid text-sm mb-3">No hay lotes para esta campaña.</p>
          <Link href={`/productores/${productor.id}/lotes/nuevo`} className="btn-primary text-xs">
            Cargar primer lote
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-base-5 bg-base-2">
              <tr className="text-[10px] uppercase tracking-wider text-lo">
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Cultivo</th>
                <th className="px-4 py-3 text-right">Ha</th>
                <th className="px-4 py-3 text-left">Variedad</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className="border-b border-base-5 last:border-0 hover:bg-base-4 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-hi font-medium">{l.nombre}</span>
                  </td>
                  <td className="px-4 py-3 text-mid">
                    {[l.cultivo, l.cultivo_2].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-afa font-bold">
                    {l.hectareas}
                  </td>
                  <td className="px-4 py-3 text-lo">{l.variedad ?? '—'}</td>
                </tr>
              ))}
              <tr className="bg-base-4 border-t border-base-5">
                <td className="px-4 py-2 text-xs text-mid font-semibold uppercase tracking-wider" colSpan={2}>Total</td>
                <td className="px-4 py-2 text-right text-afa font-black">{Math.round(totalHas)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
