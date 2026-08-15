import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoteDetail } from './lote-detail';

export default async function LoteDetailPage({ params }: { params: Promise<{ id: string; loteId: string }> }) {
  const { id, loteId } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: lote }, { data: productor }, { data: ingeniero }] = await Promise.all([
    sb.from('lotes').select('*').eq('id', loteId).single(),
    (sb as any).from('productores').select('razon_social').eq('id', id).single(),
    (sb as any).from('ingenieros').select('nombre,apellido,matricula,telefono').eq('id', user.id).single(),
  ]);

  if (!lote) notFound();

  return (
    <LoteDetail
      lote={lote}
      productorId={id}
      productorNombre={productor?.razon_social ?? ''}
      ingeniero={ingeniero}
    />
  );
}
