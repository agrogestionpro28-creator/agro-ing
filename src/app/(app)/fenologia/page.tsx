export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FenologiaClient } from './fenologia-client'

export default async function FenologiaPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  // La tabla lotes usa empresa_id (no productor_id) e ingeniero_id directo
  const { data: empresas } = await (sb as any)
    .from('empresas').select('id,razon_social')
    .eq('ingeniero_id', user.id).order('razon_social')

  const { data: campanas } = await (sb as any)
    .from('campanas').select('id,nombre,fecha_inicio,fecha_fin')
    .eq('ingeniero_id', user.id)
    .order('fecha_inicio', { ascending: false })

  // Traer lotes por ingeniero_id directo
  const { data: lotes } = await (sb as any).from('lotes')
    .select('id,nombre,hectareas,cultivo,empresa_id,campana_id,fecha_siembra,fecha_cosecha,tecnologia_soja')
    .eq('ingeniero_id', user.id)

  const loteIds = (lotes ?? []).map((l: any) => l.id)

  const { data: aplicaciones } = loteIds.length
    ? await (sb as any).from('aplicaciones')
        .select('id,lote_id,fecha,tipo,productos,maquinaria,hectareas_apl')
        .in('lote_id', loteIds)
        .order('fecha', { ascending: true })
    : { data: [] }

  // Mapear empresa_id → productor_id para compatibilidad con el cliente
  const lotesNormalizados = (lotes ?? []).map((l: any) => ({
    ...l,
    productor_id: l.empresa_id,
    cultivo_2: null,
    variedad: null,
  }))

  const productoresNormalizados = (empresas ?? []).map((e: any) => ({
    id: e.id,
    razon_social: e.razon_social,
  }))

  return (
    <FenologiaClient
      productores={productoresNormalizados}
      campanas={campanas ?? []}
      lotes={lotesNormalizados}
      aplicaciones={aplicaciones ?? []}
    />
  )
}
