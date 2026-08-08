'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { logout } from '@/app/(auth)/login/actions';

type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null; logo_url: string | null };

const TABS = [
  { href: '/dashboard', label: 'Productores', icon: '⬡' },
  { href: '/cobranza',  label: 'Cobranza',    icon: '₿' },
  { href: '/recorrida', label: 'Recorrida',   icon: '◎' },
  { href: '/analisis',  label: 'Análisis',    icon: '⬡' },
  { href: '/recetas',   label: 'Recetas',     icon: '⬡' },
  { href: '/bitacora',  label: 'Bitácora',    icon: '⬡' },
] as const;

export function AppHeader({
  ingeniero,
  campanas,
  campanaActivaId,
  onCampanaChange,
}: {
  ingeniero: Ingeniero;
  campanas: Campana[];
  campanaActivaId: string;
  onCampanaChange: (id: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const campanaActual = campanas.find((c) => c.id === campanaActivaId);
  const idx = campanas.findIndex((c) => c.id === campanaActivaId);

  const initials = [ingeniero.nombre[0], ingeniero.apellido?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'IA';

  function navCampana(dir: -1 | 1) {
    const next = campanas[idx + dir];
    if (next) onCampanaChange(next.id);
  }

  return (
    <header className="relative z-10 bg-gradient-to-r from-[#0f2818] via-[#1a3d24] to-[#0a0a0a] border-b border-base-5">
      {/* Honeycomb strip */}
      <div className="absolute inset-0 honeycomb-bg opacity-100 pointer-events-none" />

      <div className="relative px-5 pt-4 pb-0">
        {/* Top row */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4">
          {/* Identidad */}
          <div className="flex items-center gap-3">
            {ingeniero.logo_url ? (
              <img
                src={ingeniero.logo_url}
                alt="Logo"
                className="w-12 h-12 rounded-xl border-2 border-ochre object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-base-3 border-2 border-ochre rounded-xl flex items-center justify-center text-ochre font-black text-lg select-none">
                {initials}
              </div>
            )}
            <div>
              <div className="text-ochre font-black text-lg leading-none tracking-wide uppercase">
                {ingeniero.nombre}{ingeniero.apellido ? ` ${ingeniero.apellido}` : ''}
              </div>
              <div className="text-mid text-[10px] tracking-[0.18em] mt-1 uppercase">
                Ing. Agrónomo{ingeniero.matricula ? ` · M.P. ${ingeniero.matricula}` : ''}
              </div>
            </div>
          </div>

          {/* Selector de campaña */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navCampana(-1)}
              disabled={idx <= 0}
              aria-label="Campaña anterior"
              className="w-7 h-7 flex items-center justify-center text-mid hover:text-ochre disabled:opacity-20 transition-colors text-xl"
            >
              ‹
            </button>
            <div className="bg-base-3 border border-base-5 rounded-full px-4 py-2 text-center min-w-[140px]">
              <div className="text-hi font-bold text-sm leading-none">
                Campaña {campanaActual?.nombre ?? '—'}
              </div>
              <div className="text-lo text-[10px] mt-1">
                {campanaActual
                  ? `${fmtDate(campanaActual.fecha_inicio)} → ${fmtDate(campanaActual.fecha_fin)}`
                  : ''}
              </div>
            </div>
            <button
              onClick={() => navCampana(1)}
              disabled={idx >= campanas.length - 1}
              aria-label="Campaña siguiente"
              className="w-7 h-7 flex items-center justify-center text-mid hover:text-ochre disabled:opacity-20 transition-colors text-xl"
            >
              ›
            </button>
          </div>

          {/* Menú perfil */}
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="text-lo hover:text-mid text-xs border border-base-5 rounded px-3 py-1.5 transition-colors"
            >
              ⚙ Perfil
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-36 card py-1 shadow-lg z-50">
                <button
                  onClick={() => { setShowMenu(false); router.push('/perfil'); }}
                  className="w-full text-left px-4 py-2 text-sm text-mid hover:text-hi hover:bg-base-4 transition-colors"
                >
                  Editar perfil
                </button>
                <form action={logout}>
                  <button className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-base-4 transition-colors">
                    Cerrar sesión
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Module tabs */}
        <nav className="flex gap-1 flex-wrap -mb-px">
          {TABS.map((tab) => {
            const active = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={cn(
                  'px-4 py-2 text-xs font-semibold rounded-t-lg border border-b-0 transition-all',
                  active
                    ? 'bg-ochre text-base-DEFAULT border-ochre'
                    : 'bg-transparent text-mid border-transparent hover:border-base-5 hover:text-hi'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
