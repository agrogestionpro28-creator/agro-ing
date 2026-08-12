'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function actualizarProductor(_prev: unknown, formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const razon_social = String(formData.get('razon_social') ?? '').trim();
  if (!razon_social) return { error: 'La razón social es obligatoria' };

  const sb = await createClient();
  const { error } = await (sb as any).from('productores').update({
    razon_social,
    cuit:      String(formData.get('cuit') ?? '').trim() || null,
    localidad: String(formData.get('localidad') ?? '').trim() || null,
    telefono:  String(formData.get('telefono') ?? '').trim() || null,
    email:     String(formData.get('email') ?? '').trim() || null,
  }).eq('id', id);

  if (error) return { error: error.message };
  revalidatePath(`/productores/${id}`);
  revalidatePath('/dashboard');
  redirect(`/productores/${id}`);
}
