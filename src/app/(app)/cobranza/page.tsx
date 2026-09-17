import { createClient } from '@/lib/supabase/server';
import { CobranzaClient } from './cobranza-client';

export const dynamic = 'force-dynamic';

export default async function CobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{ campana?: string }>;
}) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { campana: campanaParam } = await searchParams;

  const [{ data: campanas }, { data: productores }] = await Promise.all([
    (sb as any).from('campanas')
      .select('id,nombre')
      .eq('ingeniero_id', user.id)
      .order('fecha_inicio', { ascending: false }),
    (sb as any).from('productores')
      .select('id,razon_social,hectareas_totales')
      .eq('ingeniero_id', user.id)
      .order('razon_social'),
  ]);

  const lista = campanas ?? [];
  const campanaId = campanaParam ?? lista[0]?.id ?? '';

  return (
    <CobranzaClient
      campanas={lista}
      campanaIdInicial={campanaId}
      productores={productores ?? []}
      userId={user.id}
    />
  );
}
