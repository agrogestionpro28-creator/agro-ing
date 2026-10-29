'use client';

import { createContext, useContext } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from './app-header';

type Campana   = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
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
  const router      = useRouter();
  const searchParams = useSearchParams();

  const campanaIdFromUrl = searchParams.get('campana');
  const campana          = campanas.find(c => c.id === campanaIdFromUrl) ?? campanas[0];
  const campanaId        = campana?.id ?? '';

  function handleCampanaChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('campana', id);
    router.push(`?${params.toString()}`);
  }

  return (
    <CampanaContext.Provider value={{ campanaId, campana }}>
      {/* Layout: sidebar fija (lg+) + área de contenido */}
      <div className="min-h-screen lg:flex">

        {/* Sidebar — renderiza el AppHeader que incluye sidebar + topbar mobile */}
        <AppHeader
          ingeniero={ingeniero}
          campanas={campanas}
          campanaActivaId={campanaId}
          onCampanaChange={handleCampanaChange}
        />

        {/* Área de contenido */}
        <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 overflow-hidden">
          {/* Zona scrolleable */}
          <main className="flex-1 overflow-y-auto bg-base">
            {children}
          </main>
        </div>

      </div>
    </CampanaContext.Provider>
  );
}
