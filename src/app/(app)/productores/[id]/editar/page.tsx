import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditarProductorForm } from './editar-form';

export default async function EditarProductorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: p } = await sb.from('productores').select('*').eq('id', id).single();
  if (!p) notFound();
  return <EditarProductorForm productor={p} />;
}
