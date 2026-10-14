export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AplicacionesClient } from './aplicaciones-client'

export default async function AplicacionesPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const [{ data: productores }, { data: campanas }] = await Promise.all([
    (sb as any).from('productores').select('id,razon_social').eq('ingeniero_id', user.id).order('razon_social'),
    (sb as any).from('campanas').select('id,nombre').eq('ingeniero_id', user.id).order('fecha_inicio', { ascending: false }),
  ])

  return (
    <AplicacionesClient
      productores={productores ?? []}
      campanas={campanas ?? []}
    />
  )
}
