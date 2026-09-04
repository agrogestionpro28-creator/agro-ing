import { createClient } from '@/lib/supabase/server';
import { CobranzaClient } from './cobranza-client';

export default async function CobranzaPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: campanas } = await (sb as any)
    .from('campanas')
    .select('id,nombre,fecha_inicio,fecha_fin')
    .eq('ingeniero_id', user.id)
    .order('fecha_inicio', { ascending: false });

  const { data: productores } = await (sb as any)
    .from('productores')
    .select('id,razon_social,hectareas_totales')
    .eq('ingeniero_id', user.id)
    .order('razon_social');

  return (
    <CobranzaClient
      campanas={campanas ?? []}
      productores={productores ?? []}
      userId={user.id}
    />
  );
}
