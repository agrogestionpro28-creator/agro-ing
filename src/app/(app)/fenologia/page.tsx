export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FenologiaClient } from './fenologia-client'

export default async function FenologiaPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: productores } = await (sb as any)
    .from('productores').select('id,razon_social')
    .eq('ingeniero_id', user.id).eq('activo', true).order('razon_social')

  const { data: campanas } = await (sb as any)
    .from('campanas').select('id,nombre,fecha_inicio,fecha_fin')
    .order('fecha_inicio', { ascending: false })

  const prodIds = (productores ?? []).map((p: any) => p.id)

  // Traer lotes: primero por productor_id, si no hay resultados buscar por campana del ingeniero
  let { data: lotes } = prodIds.length
    ? await (sb as any).from('lotes')
        .select('id,nombre,hectareas,cultivo,cultivo_2,variedad,tecnologia_soja,productor_id,campana_id,fecha_siembra,fecha_cosecha')
        .in('productor_id', prodIds)
    : { data: [] }

  // Fallback: si no hay lotes por productor, buscar por campanas del ingeniero
  if ((!lotes || lotes.length === 0) && campanas && campanas.length > 0) {
    const campanaIds = (campanas as any[]).map((c: any) => c.id)
    const { data: lotesPorCampana } = await (sb as any).from('lotes')
      .select('id,nombre,hectareas,cultivo,cultivo_2,variedad,tecnologia_soja,productor_id,campana_id,fecha_siembra,fecha_cosecha')
      .in('campana_id', campanaIds)
    lotes = lotesPorCampana
  }

  const loteIds = (lotes ?? []).map((l: any) => l.id)

  const { data: aplicaciones } = loteIds.length
    ? await (sb as any).from('aplicaciones')
        .select('id,lote_id,fecha,tipo,productos,maquinaria,hectareas_apl')
        .in('lote_id', loteIds)
        .order('fecha', { ascending: true })
    : { data: [] }

  return (
    <FenologiaClient
      productores={productores ?? []}
      campanas={campanas ?? []}
      lotes={lotes ?? []}
      aplicaciones={aplicaciones ?? []}
    />
  )
}
