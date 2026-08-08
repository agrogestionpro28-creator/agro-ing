import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: ingeniero }, { data: campanas }] = await Promise.all([
    sb.from('ingenieros').select('nombre, apellido, matricula, logo_url').eq('id', user.id).single(),
    sb.from('campanas').select('id, nombre, fecha_inicio, fecha_fin')
      .eq('ingeniero_id', user.id)
      .order('fecha_inicio', { ascending: false }),
  ]);

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
