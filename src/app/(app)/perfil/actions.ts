'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function guardarPerfil(_prev: unknown, formData: FormData) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = sb as any;
  const { error } = await client.from('ingenieros').update({
    nombre:    String(formData.get('nombre') ?? '').trim(),
    apellido:  String(formData.get('apellido') ?? '').trim() || null,
    matricula: String(formData.get('matricula') ?? '').trim() || null,
    telefono:  String(formData.get('telefono') ?? '').trim() || null,
    email:     String(formData.get('email') ?? '').trim() || null,
  }).eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { ok: true };
}
