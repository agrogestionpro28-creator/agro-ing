'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function crearProductor(_prev: unknown, formData: FormData) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const razon_social = String(formData.get('razon_social') ?? '').trim();
  if (!razon_social) return { error: 'La razón social es obligatoria' };

  const { error } = await sb.from('productores').insert({
    ingeniero_id: user.id,
    razon_social,
    cuit:      String(formData.get('cuit') ?? '').trim()     || null,
    telefono:  String(formData.get('telefono') ?? '').trim() || null,
    email:     String(formData.get('email') ?? '').trim()    || null,
    localidad: String(formData.get('localidad') ?? '').trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  redirect('/dashboard');
}
