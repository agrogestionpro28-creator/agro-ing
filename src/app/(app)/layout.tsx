import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: ingeniero } = await sb.from('ingenieros')
    .select('nombre, apellido, matricula, logo_url')
    .eq('id', user!.id).single();

  const { data: campanas, error: campError } = await sb.from('campanas')
    .select('id, nombre, fecha_inicio, fecha_fin')
    .eq('ingeniero_id', user!.id)
    .order('fecha_inicio', { ascending: false });

  console.log('CAMPANAS:', campanas, 'ERROR:', campError, 'USER:', user!.id);

  if (!ingeniero) redirect('/login');

  return (
    <AppShell
      ingeniero={ingeniero}
      campanas={campanas ?? []}
    >
      {children}
    </AppShell>
  );
}
