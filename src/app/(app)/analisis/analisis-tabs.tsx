'use client';

import { useState } from 'react';
import { useCampana } from '@/components/layout/app-shell';
import { AnalisisClient } from './analisis-client';
import { AnalisisCultivoClient } from './analisis-cultivo-client';
import type { AnalisisSuelo } from '@/lib/suelo';

type Productor = { id: string; razon_social: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null } | null;
type Lote = { id: string; nombre: string; hectareas: number; cultivo: string | null; productor_id: string; campana_id: string };

type Props = {
  productores: Productor[];
  ingeniero: Ingeniero;
  userId: string;
  todoLotes: Lote[];
  todoAnalisis: AnalisisSuelo[];
};

export function AnalisisTabs({ productores, ingeniero, userId, todoLotes, todoAnalisis }: Props) {
  const [tab, setTab] = useState<'productor' | 'cultivo'>('productor');
  const { campanaId, campana } = useCampana();

  // Para "Por cultivo": filtrar lotes + análisis de la campaña actual
  const lotesActuales = todoLotes.filter(l => l.campana_id === campanaId);
  const idsLotesActuales = new Set(lotesActuales.map(l => l.id));
  const analisisActuales = todoAnalisis.filter(a => idsLotesActuales.has(a.lote_id));

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="eyebrow">Análisis de suelo · Campaña {campana?.nombre ?? '—'}</p>
        <h1 className="text-2xl font-black tracking-tight mt-1" style={{ color: '#0f172a' }}>Análisis</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        {([
          { id: 'productor', label: 'Por productor' },
          { id: 'cultivo',   label: 'Por cultivo' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all duration-150"
            style={tab === t.id
              ? { background: '#ffffff', color: '#0f172a', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
              : { color: '#64748b' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'productor' ? (
        <AnalisisClient productores={productores} ingeniero={ingeniero} userId={userId} />
      ) : (
        <AnalisisCultivoClient
          productores={productores}
          lotes={lotesActuales}
          analisis={analisisActuales}
        />
      )}
    </div>
  );
}
