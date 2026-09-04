import { createClient } from '@/lib/supabase/server';
import { PerfilForm } from './perfil-form';

export default async function PerfilPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: ing } = await sb.from('ingenieros').select('*').eq('id', user.id).single();
  return <PerfilForm ingeniero={ing} userId={user.id} />;
}
