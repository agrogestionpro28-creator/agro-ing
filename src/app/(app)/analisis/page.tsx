import { createClient } from '@/lib/supabase/server';
import { AnalisisClient } from './analisis-client';
import { AnalisisCultivoClient } from './analisis-cultivo-client';
import { AnalisisTabs } from './analisis-tabs';

export default async function AnalisisPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [
    { data: productores },
    { data: ingeniero },
    { data: todoLotes },
    { data: todoAnalisis },
  ] = await Promise.all([
    (sb as any).from('productores').select('id, razon_social')
      .eq('ingeniero_id', user.id).eq('activo', true).order('razon_social'),
    (sb as any).from('ingenieros').select('nombre, apellido, matricula').eq('id', user.id).single(),
    // todos los lotes del ingeniero (cualquier campaña, para cruzar con análisis)
    (sb as any).from('lotes').select('id, nombre, hectareas, cultivo, fecha_siembra, productor_id, campana_id')
      .in('productor_id',
        (await (sb as any).from('productores').select('id').eq('ingeniero_id', user.id).eq('activo', true))
          .data?.map((p: { id: string }) => p.id) ?? []
      ),
    // todos los análisis de suelo de los lotes del ingeniero
    (sb as any).from('analisis_suelo').select('*')
      .in('lote_id',
        (await (sb as any).from('lotes').select('id')
          .in('productor_id',
            (await (sb as any).from('productores').select('id').eq('ingeniero_id', user.id).eq('activo', true))
              .data?.map((p: { id: string }) => p.id) ?? []
          )
        ).data?.map((l: { id: string }) => l.id) ?? []
      )
      .order('fecha_informe', { ascending: false }),
  ]);

  return (
    <AnalisisTabs
      productores={productores ?? []}
      ingeniero={ingeniero}
      userId={user.id}
      todoLotes={todoLotes ?? []}
      todoAnalisis={todoAnalisis ?? []}
    />
  );
}
