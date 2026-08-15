import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductorDetail } from './productor-detail';

export default async function ProductorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: p }, { data: campanas }, { data: ingeniero }] = await Promise.all([
    sb.from('productores').select('*').eq('id', id).single(),
    (sb as any).from('campanas').select('id,nombre,fecha_inicio,fecha_fin')
      .eq('ingeniero_id', user.id).order('fecha_inicio', { ascending: false }),
    (sb as any).from('ingenieros').select('nombre,apellido,matricula').eq('id', user.id).single(),
  ]);

  if (!p) notFound();

  return <ProductorDetail productor={p} campanas={campanas ?? []} ingeniero={ingeniero} />;
}
