export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FenologiaClient } from './fenologia-client'

export default async function FenologiaPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: productores, error: prodError } = await (sb as any)
    .from('productores').select('id,razon_social')
    .eq('ingeniero_id', user.id).eq('activo', true).order('razon_social')

  const { data: campanas, error: campError } = await (sb as any)
    .from('campanas').select('id,nombre,fecha_inicio,fecha_fin')
    .eq('ingeniero_id', user.id)
    .order('fecha_inicio', { ascending: false })

  console.log('[fen] uid:', user.id)
  console.log('[fen] productores:', productores?.length, prodError?.message)
  console.log('[fen] campanas:', campanas?.length, campError?.message)

  const prodIds = (productores ?? []).map((p: any) => p.id)

  const { data: lotes, error: lotesError } = prodIds.length
    ? await (sb as any).from('lotes')
        .select('id,nombre,hectareas,cultivo,cultivo_2,variedad,tecnologia_soja,productor_id,campana_id,fecha_siembra,fecha_cosecha')
        .in('productor_id', prodIds)
    : { data: [], error: null }

  console.log('[fen] lotes:', lotes?.length, lotesError?.message)

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
