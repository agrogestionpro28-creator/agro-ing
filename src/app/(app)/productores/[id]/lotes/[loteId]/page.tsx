import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function LoteDetailPage({ params }: { params: Promise<{ id: string; loteId: string }> }) {
  const { id, loteId } = await params;
  const sb = await createClient();

  const { data: lote } = await sb.from('lotes').select('*').eq('id', loteId).single();
  if (!lote) notFound();

  // Hemisferio sur: el cultivo actual es el 1ro hasta cosecha
  const cultivoActual = lote.cultivo || lote.cultivo_2 || '—';

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-1">Lote</p>
      <h1 className="text-2xl font-bold text-hi mb-1">{lote.nombre}</h1>
      <p className="text-mid text-sm mb-6">
        {lote.hectareas} ha · {[lote.cultivo, lote.cultivo_2].filter(Boolean).join(' → ') || 'Sin cultivo'}
        {lote.variedad ? ` · ${lote.variedad}` : ''}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-lo text-xs uppercase tracking-wider mb-1">Hectáreas</div>
          <div className="text-green-400 font-black text-2xl">{lote.hectareas} ha</div>
        </div>
        <div className="card p-4">
          <div className="text-lo text-xs uppercase tracking-wider mb-1">Cultivo actual</div>
          <div className="text-hi font-bold text-xl">{cultivoActual}</div>
        </div>
        {lote.fecha_siembra && (
          <div className="card p-4">
            <div className="text-lo text-xs uppercase tracking-wider mb-1">Fecha siembra</div>
            <div className="text-hi font-bold">{lote.fecha_siembra}</div>
          </div>
        )}
        {lote.cultivo && lote.cultivo_2 && (
          <div className="card p-4">
            <div className="text-lo text-xs uppercase tracking-wider mb-1">Doble cultivo</div>
            <div className="text-ochre font-bold">{lote.cultivo} → {lote.cultivo_2} (próximo)</div>
          </div>
        )}
      </div>

      {lote.notas && (
        <div className="card p-4 mb-6">
          <div className="text-lo text-xs uppercase tracking-wider mb-2">Notas</div>
          <p className="text-mid text-sm">{lote.notas}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Link href={`/productores/${id}`} className="btn-ghost">← Volver</Link>
      </div>
    </div>
  );
}
