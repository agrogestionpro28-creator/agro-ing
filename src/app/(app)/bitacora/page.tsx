import { createClient } from '@/lib/supabase/server';
import { BitacoraClient } from './bitacora-client';

export const dynamic = 'force-dynamic';

export default async function BitacoraPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: productores }, { data: alertas }, { data: malezas }] = await Promise.all([
    (sb as any).from('productores')
      .select('id, razon_social')
      .eq('ingeniero_id', user.id)
      .order('razon_social'),
    (sb as any).from('alertas')
      .select('*, productores(razon_social), lotes(nombre)')
      .eq('ingeniero_id', user.id)
      .eq('completada', false)
      .order('fecha_limite', { ascending: true }),
    (sb as any).from('malezas')
      .select('*, lotes(nombre, productor_id, productores(razon_social))')
      .eq('estado', 'activa')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <BitacoraClient
      productores={productores ?? []}
      alertas={alertas ?? []}
      malezas={malezas ?? []}
      userId={user.id}
    />
  );
}
