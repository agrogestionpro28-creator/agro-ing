import { createClient } from '@/lib/supabase/server'
import { InformesClient } from './informes-client'

export const dynamic = 'force-dynamic'

export default async function InformesPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const [{ data: productores }, { data: campanas }] = await Promise.all([
    (sb as any).from('productores')
      .select('id,razon_social')
      .eq('ingeniero_id', user.id)
      .order('razon_social'),
    (sb as any).from('campanas')
      .select('id,nombre')
      .eq('ingeniero_id', user.id)
      .order('fecha_inicio', { ascending: false }),
  ])

  return (
    <InformesClient
      productores={productores ?? []}
      campanas={campanas ?? []}
      userId={user.id}
    />
  )
}
