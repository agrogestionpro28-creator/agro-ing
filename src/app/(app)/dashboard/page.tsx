import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Traemos todo lo que necesitamos en paralelo
  const [{ data: productores }, { data: campanas }, { data: hasData }, { data: cobranza }] =
    await Promise.all([
      sb.from('productores')
        .select('id, razon_social, localidad, activo')
        .eq('ingeniero_id', user.id)
        .eq('activo', true)
        .order('razon_social'),
      sb.from('campanas')
        .select('id, nombre')
        .eq('ingeniero_id', user.id)
        .order('fecha_inicio', { ascending: false }),
      sb.from('vw_productor_has')
        .select('productor_id, campana_id, hectareas_total, cantidad_lotes, cultivos, cultivos_2'),
      sb.from('vw_cobranza')
        .select('productor_id, campana_id, estado, total_cobrado, monto_unitario, modalidad'),
    ]);

  return (
    <DashboardClient
      productores={productores ?? []}
      campanas={campanas ?? []}
      hasData={hasData ?? []}
      cobranza={cobranza ?? []}
    />
  );
}
