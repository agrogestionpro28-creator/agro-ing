import { createClient } from '@/lib/supabase/server';
import { CosechaClient } from './cosecha-client';

export default async function CosechaPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // IDs de productores activos del ingeniero
  const { data: productoresRaw } = await (sb as any)
    .from('productores').select('id, razon_social')
    .eq('ingeniero_id', user.id).eq('activo', true).order('razon_social');
  const productores = productoresRaw ?? [];
  const prodIds = productores.map((p: { id: string }) => p.id);

  // Campañas
  const { data: campanasRaw } = await (sb as any)
    .from('campanas').select('id, nombre, fecha_inicio, fecha_fin')
    .order('fecha_inicio', { ascending: false });

  // Lotes de todos los productores (todas las campañas)
  const { data: lotesRaw } = prodIds.length
    ? await (sb as any).from('lotes')
        .select('id, nombre, hectareas, cultivo, cultivo_2, productor_id, campana_id, fecha_siembra, fecha_cosecha')
        .in('productor_id', prodIds).order('nombre')
    : { data: [] };

  // Cosechas del ingeniero
  const { data: cosechasRaw } = await (sb as any)
    .from('cosechas').select('*')
    .eq('ingeniero_id', user.id)
    .order('fecha_cosecha', { ascending: false });

  return (
    <CosechaClient
      productores={productores}
      campanas={campanasRaw ?? []}
      lotes={lotesRaw ?? []}
      cosechas={cosechasRaw ?? []}
      userId={user.id}
    />
  );
}
