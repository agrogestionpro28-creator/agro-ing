import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NuevoLoteForm } from './nuevo-lote-form';

export default async function NuevoLotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: productor }, { data: campanas }] = await Promise.all([
    sb.from('productores').select('id, razon_social').eq('id', id).single(),
    sb.from('campanas').select('id, nombre').eq('ingeniero_id', user.id).order('fecha_inicio', { ascending: false }),
  ]);

  if (!productor) notFound();

  return <NuevoLoteForm productor={productor} campanas={campanas ?? []} />;
}
