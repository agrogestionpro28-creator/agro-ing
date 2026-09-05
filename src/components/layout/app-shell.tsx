'use client';

import { createContext, useContext } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from './app-header';

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
  const searchParams = useSearchParams();

  // Get campana from URL or default to first
  const campanaIdFromUrl = searchParams.get('campana');
  const campana = campanas.find(c => c.id === campanaIdFromUrl) ?? campanas[0];
  const campanaId = campana?.id ?? '';

  function handleCampanaChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('campana', id);
    router.push(`?${params.toString()}`);
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
