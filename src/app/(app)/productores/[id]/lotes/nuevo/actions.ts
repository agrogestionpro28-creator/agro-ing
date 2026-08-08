'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function crearLote(_prev: unknown, formData: FormData) {
  const productor_id = String(formData.get('productor_id') ?? '');
  const campana_id   = String(formData.get('campana_id') ?? '');
  const nombre       = String(formData.get('nombre') ?? '').trim();
  const hectareas    = parseFloat(String(formData.get('hectareas') ?? '0'));

  if (!nombre) return { error: 'El nombre es obligatorio' };
  if (!campana_id) return { error: 'Seleccioná una campaña' };
  if (isNaN(hectareas) || hectareas <= 0) return { error: 'Hectáreas debe ser mayor a 0' };

  const sb = await createClient();

  const { error } = await sb.from('lotes').insert({
    productor_id,
    campana_id,
    nombre,
    hectareas,
    cultivo:      String(formData.get('cultivo') ?? '').trim()   || null,
    cultivo_2:    String(formData.get('cultivo_2') ?? '').trim() || null,
    variedad:     String(formData.get('variedad') ?? '').trim()  || null,
    fecha_siembra: String(formData.get('fecha_siembra') ?? '').trim() || null,
    notas:        String(formData.get('notas') ?? '').trim()     || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/productores/${productor_id}`);
  revalidatePath('/dashboard');
  redirect(`/productores/${productor_id}`);
}
