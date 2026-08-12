import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoteDetail } from './lote-detail';

export default async function LoteDetailPage({ params }: { params: Promise<{ id: string; loteId: string }> }) {
  const { id, loteId } = await params;
  const sb = await createClient();
  const { data: lote } = await sb.from('lotes').select('*').eq('id', loteId).single();
  if (!lote) notFound();
  return <LoteDetail lote={lote} productorId={id} />;
}
