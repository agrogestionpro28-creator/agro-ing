import { createClient } from '@/lib/supabase/server';
import { AnalisisClient } from './analisis-client';

export default async function AnalisisPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: productores }, { data: ingeniero }] = await Promise.all([
    (sb as any).from('productores').select('id, razon_social')
      .eq('ingeniero_id', user.id).eq('activo', true).order('razon_social'),
    (sb as any).from('ingenieros').select('nombre, apellido, matricula').eq('id', user.id).single(),
  ]);

  return <AnalisisClient productores={productores ?? []} ingeniero={ingeniero} userId={user.id} />;
}
