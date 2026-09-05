'use client';

import { useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from './app-header';
import { getCampanaActual } from '@/lib/utils';

type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null; logo_url: string | null };

type CampanaCtx = { campanaId: string; campana: Campana | undefined };
const CampanaContext = createContext<CampanaCtx>({ campanaId: '', campana: undefined });
export const useCampana = () => useContext(CampanaContext);

export function AppShell({
  ingeniero,
  campanas,
  children,
}: {
  ingeniero: Ingeniero;
  campanas: Campana[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  console.log('SHELL campanas:', campanas?.length, campanas?.map((c:any)=>c.nombre));
  const { nombre: nombreActual } = getCampanaActual();
  const defaultCampana = campanas.find((c) => c.nombre === nombreActual) ?? campanas[0];
  const [campanaId, setCampanaId] = useState(defaultCampana?.id ?? '');

  const campana = campanas.find((c) => c.id === campanaId);

  function handleCampanaChange(id: string) {
    setCampanaId(id);
    router.refresh();
  }

  return (
    <CampanaContext.Provider value={{ campanaId, campana }}>
      <div className="min-h-screen flex flex-col">
        <AppHeader
          ingeniero={ingeniero}
          campanas={campanas}
          campanaActivaId={campanaId}
          onCampanaChange={handleCampanaChange}
        />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </CampanaContext.Provider>
  );
}
