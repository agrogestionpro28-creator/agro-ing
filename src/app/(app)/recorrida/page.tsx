import { createClient } from '@/lib/supabase/server';
import { RecorridaClient } from './recorrida-client';

export default async function RecorridaPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Get all productores of this engineer with their lotes
  const { data: productores } = await (sb as any)
    .from('productores')
    .select('id, razon_social')
    .eq('ingeniero_id', user.id)
    .order('razon_social');

  // Get all campanas
  const { data: campanas } = await (sb as any)
    .from('campanas')
    .select('id, nombre, fecha_inicio, fecha_fin')
    .eq('ingeniero_id', user.id)
    .order('fecha_inicio', { ascending: false });

  return <RecorridaClient productores={productores ?? []} campanas={campanas ?? []} />;
}
